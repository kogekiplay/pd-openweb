/** Run the installed native ActionButton algorithm; hook state/render and close animation are controlled boundaries. */
import type { SpecHarness } from '../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const helpers: typeof import('./staticActions') = require('./staticActions.ts');
const is: unknown = require('antd/lib/_util/is.js');
const buttonHelpers: unknown = require('antd/lib/button/buttonHelpers.js');
const target = require.resolve('antd/es/_util/ActionButton.js');
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
function nativeButton(action: unknown) {
  let closed = 0;
  const fakeReact = { useRef: (current: unknown) => ({ current }), useEffect: () => {}, createElement: (_type: unknown, props: unknown) => ({ props }) };
  const imports: Record<string, unknown> = { react: fakeReact, '@rc-component/util': { useState: (value: unknown) => [value, () => {}] }, '../button/Button': 'button', '../button/buttonHelpers': buttonHelpers, './is': is };
  const compiled = harness.transformFileSync(target, { plugins: ['@babel/plugin-transform-modules-commonjs'] }); assert.ok(compiled?.code);
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', compiled.code)(moduleLike, moduleLike.exports, (name: string): unknown => {
    if (!Object.hasOwn(imports, name)) throw new Error('Unexpected native action dependency ' + name); return imports[name];
  });
  const Component = moduleLike.exports['default']; if (typeof Component !== 'function') throw new TypeError('Missing native ActionButton');
  const rendered: unknown = Reflect.apply(Component, undefined, [{ actionFn: action, close: () => { closed++; }, isSilent: () => true }]);
  if (!object(rendered) || !object(rendered['props'])) throw new TypeError('Missing native button props');
  const click = rendered['props']['onClick']; if (typeof click !== 'function') throw new TypeError('Missing native click');
  return { click: () => Reflect.apply(click, undefined, [{}]), get closed() { return closed; } };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
(async () => {
  let calls = 0, resolve: ((value: unknown) => void) | undefined;
  const action = helpers.getStaticAction(() => { calls++; return new Promise<unknown>(done => { resolve = done; }); });
  const button = nativeButton(action); button.click(); button.click(); assert.equal(calls, 1);
  assert.ok(resolve); resolve('done'); await tick(); assert.equal(button.closed, 1); button.click(); assert.equal(calls, 1);
  let valid = false; const validation = nativeButton(helpers.getStaticAction(() => valid ? undefined : false));
  validation.click(); assert.equal(validation.closed, 0); valid = true; validation.click(); assert.equal(validation.closed, 1);
  let attempts = 0, reject: ((reason: unknown) => void) | undefined;
  const retry = nativeButton(helpers.getStaticAction(() => { attempts++; return attempts === 1 ? new Promise<unknown>((_ok, no) => { reject = no; }) : undefined; }));
  retry.click(); assert.ok(reject); reject(new Error('request failed')); await tick(); retry.click(); assert.equal(attempts, 2); assert.equal(retry.closed, 1);
  const result = { same: 'reference' }, close = () => {};
  const manual = helpers.getStaticAction(value => { assert.equal(value, close); return result; }); assert.ok(manual); assert.equal(manual(close), result);
  const reason = new Error('native synchronous failure'), throwing = helpers.getStaticAction(() => { throw reason; }); assert.ok(throwing);
  assert.throws(() => throwing(close), (error: unknown) => error === reason);
  let arityReads = 0; const original = new Proxy(() => false, { get(target, key, receiver) { if (key === 'length') arityReads++; return Reflect.get(target, key, receiver); } });
  const arity = nativeButton(helpers.getStaticAction(original)); assert.equal(arityReads, 0); arity.click(); assert.equal(arityReads, 1); assert.equal(arity.closed, 0);
  console.log('Actual native ActionButton: pending/success close lock, validation false, rejection retry, manual close/return identity, synchronous failure and arity timing');
})().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
