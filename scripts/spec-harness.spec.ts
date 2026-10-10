import type { SpecHarness } from './spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const NodeModule: typeof import('node:module') = require('node:module');
const harness: SpecHarness = require('./spec-harness.ts');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-harness-spec-'));

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
try {
  const target = path.join(directory, 'entry.ts');
  fs.writeFileSync(target, 'export const answer: number = 42;');
  assert.equal(harness.resolveSpecTarget(path.join(directory, 'entry.js')), target);
  assert.equal(harness.stripStale(path.join(directory, 'entry.jsx')), path.join(directory, 'entry'));
  assert.equal(harness.readSource(directory, 'entry.js'), 'export const answer: number = 42;');
  assert.equal(harness.resolveFile(path.join(directory, 'missing')), null);
  assert.throws(() => harness.resolveSpecTarget(path.join(directory, 'missing.js')), /cannot resolve/);
  fs.mkdirSync(path.join(directory, 'nested'));
  fs.writeFileSync(path.join(directory, 'nested/index.ts'), 'export default 3;');
  assert.equal(harness.resolveFile(path.join(directory, 'nested')), path.join(directory, 'nested/index.ts'));
  fs.writeFileSync(path.join(directory, 'entry.js'), 'module.exports = 9;');
  assert.equal(harness.resolveSpecTarget(path.join(directory, 'entry.js')), path.join(directory, 'entry.js'));
  fs.unlinkSync(path.join(directory, 'entry.js'));

  const transformed = harness.transformSync('export const view = <div>{42}</div>;', { filename: 'fixture.tsx' });
  assert.ok(transformed && typeof transformed.code === 'string');
  assert.match(transformed.code, /react\/jsx-runtime/);
  assert.doesNotMatch(transformed.code, /jsxDEV|React\.createElement/);
  const withPreset = harness.transformSync('const view: number = 2;', {
    filename: 'fixture.ts',
    presets: [['@babel/preset-typescript', { allExtensions: true }]],
  });
  assert.ok(withPreset && typeof withPreset.code === 'string');
  assert.doesNotMatch(withPreset.code, /: number/);
  const classic = harness.transformSync('export const view = <div />;', {
    filename: 'fixture.tsx',
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
  });
  assert.ok(classic && typeof classic.code === 'string');
  assert.match(classic.code, /React\.createElement/);
  assert.equal(harness.transformFileSync(target, { ignore: [target] }), null, 'Babel ignored-file output stays null');
  const astOnly = harness.transformFileSync(target, { code: false, ast: true });
  assert.ok(astOnly?.ast);
  assert.equal(astOnly.code, null, 'AST-only output is not falsely declared compiled code');
  const ast = harness.parser.parse('@dec class Fixture { value: number = 2; }', { sourceType: 'module' });
  assert.equal(ast.program.body[0]?.type, 'ClassDeclaration');

  const events: Array<{ type: unknown; props: Record<string, unknown>; children: unknown[] }> = [];
  const jsx = harness.jsxRuntimeFrom((type, props, ...children) => {
    const element = { type, props, children };
    events.push(element);
    return element;
  }, 'fragment');
  const opaque = { kept: true };
  const single = jsx.jsx('div', { children: ['a', 'b'], opaque }, 'key');
  assert.equal(single.props['opaque'], opaque);
  assert.deepEqual(single.children, [['a', 'b']]);
  assert.equal(single.props['key'], 'key');
  assert.deepEqual(jsx.jsxs('div', { children: ['a', 'b'] }).children, ['a', 'b']);
  assert.deepEqual(jsx.jsxs('div', { children: new Set(['a', 'b']) }).children, ['a', 'b']);
  assert.deepEqual(jsx.jsxs('div', { children: 'ab' }).children, ['a', 'b']);
  assert.deepEqual(jsx.jsx('div', null).children, []);
  assert.equal(jsx.Fragment, 'fragment');
  assert.throws(() => jsx.jsxs('div', { children: {} }), TypeError);
  assert.throws(() => jsx.jsxs('div', { children: { [Symbol.iterator]: () => 3 } }), TypeError);
  assert.throws(() => jsx.jsxs('div', { children: { [Symbol.iterator]: () => ({ next: () => 3 }) } }), TypeError);
  assert.equal(events.length, 5);

  const originalResolve: unknown = Reflect.get(NodeModule, '_resolveFilename');
  harness.installRequireHook();
  assert.equal(Reflect.get(NodeModule, '_resolveFilename'), originalResolve, 'Installation remains idempotent');
  fs.writeFileSync(path.join(directory, 'dependency.ts'), 'export const value: number = 7;');
  fs.writeFileSync(path.join(directory, 'parent.ts'), "export { value } from './dependency.js';");
  const loaded: unknown = require(path.join(directory, 'parent.ts'));
  assert.ok(object(loaded));
  assert.equal(loaded['value'], 7, 'Actual CommonJS hook resolves a transitive stale extension');
  assert.throws(() => require(path.join(directory, 'nonexistent.ts')), /Cannot find module/);

  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    harness.expectedFailure('known assertion', () => assert.equal(1, 2));
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0]?.[0]), /known-failure.*known assertion/);
    assert.throws(() => harness.expectedFailure('already fixed', () => {}), /PASSED/);
    const failure = new TypeError('runtime failure');
    assert.throws(
      () =>
        harness.expectedFailure('not an assertion', () => {
          throw failure;
        }),
      error => error === failure,
    );
    for (const value of [null, undefined, 'bad', 3, { code: 'ERR_ASSERTION', message: 3 }]) {
      let caught: unknown = Symbol('uncaught');
      try {
        harness.expectedFailure('malformed exception', () => {
          throw value;
        });
      } catch (error) {
        caught = error;
      }
      assert.equal(caught, value);
    }
    assert.equal(warnings.length, 1, 'Unknown exceptions cannot become independent known-failure warnings');
  } finally {
    console.warn = warn;
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log('Actual spec harness resolution/Babel/AST/JSX/CJS hooks/known-failure boundaries passed');
