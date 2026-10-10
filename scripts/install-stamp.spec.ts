import type { SpecHarness } from './spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const crypto: typeof import('node:crypto') = require('node:crypto');
const { spawnSync }: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('./spec-harness.ts');
const sourcePath = path.join(__dirname, 'install-stamp.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const historicalPath = process.env['INSTALL_STAMP_BEFORE_SOURCE'];
const historical = historicalPath ? fs.readFileSync(historicalPath, 'utf8') : undefined;
const root = '/fixture-install-stamp';
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'bun.lock');
const stampPath = path.join(root, 'node_modules/.install-stamp.json');
const fixedTime = '2026-10-11T12:34:56.000Z';
class Exit extends Error {
  readonly code: number;
  constructor(code: number) {
    super('exit ' + code);
    this.code = code;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
interface Memory {
  files: Map<string, string | Buffer>;
  reads: Array<{ file: string; encoding: string | undefined }>;
  writes: Array<{ file: string; text: string }>;
  nodeModules: boolean;
  readFailure: string | undefined;
  writeFailure: boolean;
}
interface Execution {
  exit: number | undefined;
  thrown: unknown;
  warnings: unknown[][];
  errors: unknown[][];
  exports: unknown;
}
function execute(text: string, memory: Memory, mode: string | undefined): Execution {
  const output: { exports: unknown } = { exports: {} };
  const warnings: unknown[][] = [],
    errors: unknown[][] = [];
  const compiled = harness.transformSync(text, {
    filename: sourcePath,
    presets: [['@babel/preset-env', { targets: { node: process.versions.node } }]],
    comments: false,
  });
  assert.ok(compiled?.code);
  const result: Execution = { exit: undefined, thrown: undefined, warnings, errors, exports: undefined };
  const memoryFs = {
    existsSync(file: string): boolean {
      return file === path.join(root, 'node_modules') ? memory.nodeModules : memory.files.has(file);
    },
    readFileSync(file: string, encoding?: string): Buffer | string {
      memory.reads.push({ file, encoding });
      if (file === memory.readFailure) throw new Error('EIO ' + file);
      const value = memory.files.get(file);
      if (value === undefined) throw new Error('ENOENT ' + file);
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
      return encoding === 'utf8' ? buffer.toString('utf8') : buffer;
    },
    writeFileSync(file: string, value: string): void {
      if (memory.writeFailure) throw new Error('EACCES ' + file);
      memory.writes.push({ file, text: value });
      memory.files.set(file, value);
    },
  };
  class FixedDate extends Date {
    override toISOString(): string {
      return fixedTime;
    }
  }
  try {
    new Function(
      'require',
      '__dirname',
      'process',
      'module',
      'exports',
      'console',
      'Date',
      compiled.code.replace(/^#![^\n]*\n/, ''),
    )(
      (name: string): unknown => {
        if (name === 'fs') return memoryFs;
        if (name === 'path') return path;
        if (name === 'crypto') return crypto;
        throw new Error('Unexpected install-stamp dependency: ' + name);
      },
      path.join(root, 'scripts'),
      {
        argv: [process.execPath, sourcePath, mode],
        exit(code: number): never {
          throw new Exit(code);
        },
      },
      output,
      output.exports,
      { warn: (...args: unknown[]) => warnings.push(args), error: (...args: unknown[]) => errors.push(args) },
      FixedDate,
    );
  } catch (error: unknown) {
    if (error instanceof Exit) result.exit = error.code;
    else result.thrown = error;
  }
  result.exports = output.exports;
  return result;
}
function memory(pkg: unknown = {}, lock: string | Buffer = '{"lockfileVersion":2,}', stamp?: string): Memory {
  const files = new Map<string, string | Buffer>([
    [pkgPath, JSON.stringify(pkg)],
    [lockPath, lock],
  ]);
  if (stamp !== undefined) files.set(stampPath, stamp);
  return { files, reads: [], writes: [], nodeModules: true, readFailure: undefined, writeFailure: false };
}
function cloneMemory(value: Memory): Memory {
  return { ...value, files: new Map(value.files), reads: [], writes: [] };
}
function call(value: unknown, method: string, args: unknown[] = []): unknown {
  if (!record(value)) throw new TypeError('Invalid actual exports');
  const fn: unknown = value[method];
  if (typeof fn !== 'function') throw new TypeError('Missing actual ' + method);
  return Reflect.apply(fn, value, args);
}
function fingerprintOf(pkg: unknown, lock: string | Buffer = 'lock'): string {
  const m = memory(pkg, lock);
  const execution = execute(source, m, 'write');
  assert.equal(execution.exit, 0);
  assert.equal(execution.thrown, undefined);
  const value: unknown = call(execution.exports, 'fingerprint');
  assert.equal(typeof value, 'string');
  if (typeof value !== 'string') throw new Error('Invalid fingerprint');
  return value;
}
const pkg = {
  name: 'Fixture',
  dependencies: { z: '^2', a: '1' },
  devDependencies: { types: '3' },
  trustedDependencies: ['z', 'a'],
};
const initial = memory(pkg);
const written = execute(source, initial, 'write');
assert.equal(written.exit, 0, String(written.thrown));
assert.equal(written.thrown, undefined);
assert.equal(initial.writes.length, 1);
assert.deepEqual(initial.reads, [
  { file: pkgPath, encoding: 'utf8' },
  { file: lockPath, encoding: undefined },
]);
const writtenText = initial.files.get(stampPath);
assert.ok(typeof writtenText === 'string');
const parsedStamp: unknown = JSON.parse(writtenText);
assert.ok(record(parsedStamp));
assert.equal(parsedStamp['version'], 1);
assert.equal(parsedStamp['at'], fixedTime);
assert.match(writtenText, /\n$/);
assert.equal(execute(source, initial, 'check').exit, 0);
initial.files.set(lockPath, 'changed lock');
assert.equal(execute(source, initial, 'check').exit, 1);
assert.equal(execute(source, memory(pkg), 'check').exit, 2);
for (const stamp of ['bad JSON', 'null', '[]', '1', '{"version":0}', '{"version":"1"}'])
  assert.equal(execute(source, memory(pkg, 'lock', stamp), 'check').exit, 2, stamp);
for (const fingerprint of [undefined, null, 42, false, {}, []]) {
  const stamp = JSON.stringify({ version: 1, fingerprint });
  assert.equal(
    execute(source, memory(pkg, 'lock', stamp), 'check').exit,
    1,
    'version 1 malformed fingerprint stays stale',
  );
}
for (const mode of [undefined, '', 'not-a-mode']) {
  const run = execute(source, memory(), mode);
  assert.equal(run.exit, 64);
  assert.equal(run.errors.length, 1);
}
const missingDirectory = memory();
missingDirectory.nodeModules = false;
assert.equal(execute(source, missingDirectory, 'write').exit, 0);
assert.equal(missingDirectory.reads.length, 0);
assert.equal(missingDirectory.writes.length, 0);
for (const failure of ['package', 'lock', 'write']) {
  const m = memory();
  if (failure === 'write') m.writeFailure = true;
  else m.readFailure = failure === 'package' ? pkgPath : lockPath;
  const run = execute(source, m, 'write');
  assert.equal(run.exit, 0);
  assert.equal(run.warnings.length, 1);
  assert.equal(m.writes.length, 0);
}
const badPackage = memory();
badPackage.files.set(pkgPath, '{bad');
assert.equal(execute(source, badPackage, 'write').exit, 0);
const nullPackage = memory(null);
assert.equal(execute(source, nullPackage, 'write').exit, 0);
assert.equal(nullPackage.writes.length, 0);
const fingerprintFailure = memory({}, 'lock', '{"version":1,"fingerprint":"old"}');
fingerprintFailure.readFailure = lockPath;
const failureRun = execute(source, fingerprintFailure, 'check');
assert.equal(failureRun.exit, undefined);
assert.ok(failureRun.thrown instanceof Error, 'fingerprint IO failure does not pretend success/stale');
assert.equal(fingerprintOf({ dependencies: { z: '2', a: '1' } }), fingerprintOf({ dependencies: { a: '1', z: '2' } }));
assert.equal(
  fingerprintOf({ dependencies: { a: '1' }, name: 'Before', version: '1', scripts: { build: 'x' } }),
  fingerprintOf({
    dependencies: { a: '1' },
    name: 'After',
    version: '2',
    scripts: { build: 'y' },
    metadata: [null, 0],
  }),
);
assert.notEqual(fingerprintOf({ dependencies: { a: '1' } }), fingerprintOf({ dependencies: { a: '^1' } }));
assert.notEqual(fingerprintOf({ trustedDependencies: ['a', 'z'] }), fingerprintOf({ trustedDependencies: ['z', 'a'] }));
for (const field of [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'resolutions',
  'trustedDependencies',
]) {
  for (const falsy of [null, false, 0, ''])
    assert.equal(fingerprintOf({ [field]: falsy }), fingerprintOf({}), field + ' original || default');
  assert.notEqual(fingerprintOf({ [field]: ['a'] }), fingerprintOf({}), field + ' raw JSON array participates');
}
assert.notEqual(fingerprintOf({}, 'lock'), fingerprintOf({}, 'lock\n'), 'lock bytes are not parsed or normalized');
const rawLock = Buffer.from([0, 1, 255, 10]);
assert.notEqual(fingerprintOf({}, rawLock), fingerprintOf({}, Buffer.from([0, 1, 254, 10])));
const exposed = execute(source, memory(), 'none').exports;
for (const value of [
  null,
  false,
  0,
  -0,
  NaN,
  Infinity,
  'text',
  [null, false, { z: 1, a: 0 }],
  { '10': true, '2': false, z: null, a: ['second', 'first'] },
]) {
  const canonical = call(exposed, 'canonical', [value]);
  assert.equal(JSON.stringify(canonical), JSON.stringify(call(exposed, 'canonical', [canonical])));
}
assert.equal(JSON.stringify(call(exposed, 'canonical', [{ z: 1, a: 2 }])), '{"a":2,"z":1}');
const prototypeJson: unknown = JSON.parse('{"dependencies":{"__proto__":{"nested":true},"z":"2","a":"1"}}');
assert.equal(typeof fingerprintOf(prototypeJson), 'string');
const deepMetadata = memory({});
deepMetadata.files.set(
  pkgPath,
  '{"dependencies":{"a":"1"},"unrelated":' + '['.repeat(20000) + '0' + ']'.repeat(20000) + '}',
);
const deepRun = execute(source, deepMetadata, 'write');
assert.equal(deepRun.exit, 0);
assert.equal(deepRun.warnings.length, 0);
assert.equal(deepMetadata.writes.length, 1, 'irrelevant deep JSON is not recursively traversed');
let abCases = 0;
if (historical) {
  const packages: unknown[] = [
    {},
    pkg,
    0,
    true,
    'scalar',
    [],
    ...[null, false, 0, '', 'range', [], ['a', 'b'], { z: null, a: { z: false, a: 1 } }].flatMap(value =>
      ['dependencies', 'resolutions', 'trustedDependencies'].map(field => ({ [field]: value })),
    ),
    prototypeJson,
  ];
  for (const pkgValue of packages)
    for (const lock of ['lock', '{"lockfileVersion":2,}', 'lock\r\n', rawLock]) {
      const before = memory(pkgValue, lock),
        current = cloneMemory(before);
      const oldRun = execute(historical, before, 'write'),
        newRun = execute(source, current, 'write');
      assert.equal(newRun.exit, oldRun.exit);
      assert.equal(newRun.thrown, oldRun.thrown);
      assert.deepEqual(newRun.warnings, oldRun.warnings);
      assert.deepEqual(current.writes, before.writes, 'exact historical stamp bytes and fingerprint');
      const oldCheck = execute(historical, before, 'check'),
        newCheck = execute(source, current, 'check');
      assert.equal(newCheck.exit, oldCheck.exit);
      assert.equal(newCheck.thrown, oldCheck.thrown);
      abCases++;
    }
  for (const stamp of ['bad', '{}', '{"version":0}', '{"version":1}', '{"version":1,"fingerprint":false}']) {
    const before = memory({}, 'lock', stamp),
      after = cloneMemory(before);
    assert.equal(execute(source, after, 'check').exit, execute(historical, before, 'check').exit);
    abCases++;
  }
  const beforeDeep = cloneMemory(deepMetadata);
  beforeDeep.files.delete(stampPath);
  const afterDeep = cloneMemory(beforeDeep);
  execute(historical, beforeDeep, 'write');
  execute(source, afterDeep, 'write');
  assert.deepEqual(
    afterDeep.writes,
    beforeDeep.writes,
    'unrelated deep JSON fingerprints match original without added recursion',
  );
  abCases++;
}
// Run the actual CJS CLI against an isolated package tree, never this project's stamp.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-install-stamp-spec-'));
try {
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.copyFileSync(sourcePath, path.join(directory, 'scripts/install-stamp.ts'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(directory, 'bun.lock'), 'raw-lock');
  const run = (mode?: string) =>
    spawnSync(
      process.execPath,
      [path.join(directory, 'scripts/install-stamp.ts'), ...(mode === undefined ? [] : [mode])],
      { cwd: directory, encoding: 'utf8', timeout: 5000 },
    );
  assert.equal(run('check').status, 2);
  assert.equal(run('write').status, 0);
  assert.equal(fs.existsSync(path.join(directory, 'node_modules')), false, 'missing node_modules not created');
  fs.mkdirSync(path.join(directory, 'node_modules'));
  assert.equal(run('write').status, 0);
  assert.equal(run('check').status, 0);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ ...pkg, name: 'Unrelated' }));
  assert.equal(run('check').status, 0);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ ...pkg, dependencies: { z: '^3', a: '1' } }));
  assert.equal(run('check').status, 1);
  assert.equal(run('write').status, 0);
  assert.equal(run('check').status, 0);
  fs.writeFileSync(path.join(directory, 'bun.lock'), 'raw-lock\n');
  assert.equal(run('check').status, 1);
  fs.writeFileSync(path.join(directory, 'node_modules/.install-stamp.json'), 'null');
  assert.equal(run('check').status, 2);
  assert.equal(run('oops').status, 64);
  assert.equal(run().status, 64);
  fs.unlinkSync(path.join(directory, 'node_modules/.install-stamp.json'));
  fs.mkdirSync(path.join(directory, 'node_modules/.install-stamp.json'));
  const warn = run('write');
  assert.equal(warn.status, 0);
  assert.match(warn.stderr, /install-stamp/);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log(
  `Install stamp real CJS/official fs+crypto/mock IO/JSON fingerprint/exit-code tests passed (${abCases} historical runtime byte comparisons)`,
);
