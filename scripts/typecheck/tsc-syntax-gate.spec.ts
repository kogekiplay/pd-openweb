/** Real TS7 API controls: syntax fails, semantic TS1xxx stays outside this gate. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const { spawnSync }: typeof import('node:child_process') = require('node:child_process');
const { API }: typeof import('@typescript/native/unstable/sync') = require('@typescript/native/unstable/sync');
const gate: import('./tsc-syntax-gate').SyntaxGateExports = require('./tsc-syntax-gate.ts');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-syntax-gate-'));
const gatePath = path.join(__dirname, 'tsc-syntax-gate.ts');
const launcher = 'process.exit(require(process.argv[1]).main(process.argv[2], process.argv[3]));';

function project(name: string, files: Readonly<Record<string, string>>) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const config = path.join(dir, 'tsconfig.gate.json');
  fs.writeFileSync(config, JSON.stringify({ compilerOptions: { noLib: true, types: [] }, files: Object.keys(files) }));
  return { dir, config };
}
function run(input: ReturnType<typeof project>) {
  const result = spawnSync(process.execPath, ['-e', launcher, gatePath, input.dir, input.config], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.error, undefined, 'native API client must terminate and close its process');
  assert.equal(result.signal, null);
  return result;
}

try {
  const valid = run(project('valid', { 'a.ts': 'const a = 1;\n' }));
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /1 个文件，0 条语法诊断/);

  const semanticInput = project('semantic', { 'a.ts': 'const missing;\nconst x: string = 1;\n' });
  const api = new API({ cwd: semanticInput.dir });
  try {
    const nativeProject = api.updateSnapshot({ openProjects: [semanticInput.config] }).getProject(semanticInput.config);
    assert.ok(nativeProject);
    assert.equal(nativeProject.program.getSyntacticDiagnostics().length, 0);
    assert.ok(nativeProject.program.getSemanticDiagnostics().some(d => d.code === 1155));
  } finally {
    api.close();
  }
  assert.equal(run(semanticInput).status, 0, 'semantic TS1155 must not be classified as syntax by its code');

  const broken = run(project('broken', { 'a.ts': 'const good = 1;\nconst broken = ;\n' }));
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /a\.ts\s+\(1 条\)/);
  assert.match(broken.stderr, /\(2,16\) TS1109/);
  const jsx = run(project('jsx-ts', { 'a.ts': 'const element = <div />;\n' }));
  assert.equal(jsx.status, 1, 'JSX in .ts must fail');
  assert.match(jsx.stderr, /TS\d+/);
  assert.equal(run(project('jsx-tsx', { 'a.tsx': 'const element = <div />;\n' })).status, 0);

  const noise = run(
    project('noise', {
      'a.ts': 'const a = 1;\n',
      'src/library/vendor.ts': 'const bad = ;\n',
      'src/__probe.ts': 'const bad = ;\n',
    }),
  );
  assert.equal(noise.status, 0, 'existing noise exclusions must stay narrow');
  assert.equal(run(project('near-noise', { 'src/library-other/a.ts': 'const bad = ;\n' })).status, 1);

  const positions = path.join(root, 'positions.ts');
  fs.writeFileSync(positions, '中😀\r\nnext\n');
  assert.deepEqual(gate.posToLineCol(positions, 0), { line: 1, col: 1 });
  assert.deepEqual(gate.posToLineCol(positions, 5), { line: 2, col: 1 });
  assert.deepEqual(gate.posToLineCol(positions, 10), { line: 3, col: 1 });
  assert.deepEqual(gate.posToLineCol(path.join(root, 'missing.ts'), 0), { line: 0, col: 0 });
  console.log('tsc-syntax-gate: real native syntax/semantic/noise/JSX/UTF-16 controls passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
