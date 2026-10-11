const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: {
  transformFileSync: (file: string, options?: Record<string, unknown>) => { code: string | null };
} = require('../../../../../scripts/spec-harness.ts');

interface BoundaryModule {
  loadedRecord(value: unknown): { formData: unknown[] };
  portalDiscussion(value: unknown): Record<string, unknown>;
  recordError(value: unknown): { resultCode?: number; errorCode?: number };
  recordRow(value: unknown): Record<string, unknown>;
  rowEditLock(value: unknown): Record<string, string>;
  recordDictionaryOrEmpty(value: unknown): Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function load(): BoundaryModule {
  const source = harness.transformFileSync(path.join(__dirname, 'recordInfoBoundary.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  if (!source.code) throw new TypeError('record boundary transform returned no code');
  const moduleValue: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', source.code)(moduleValue, moduleValue.exports, require);
  const raw: unknown = moduleValue.exports;
  if (!object(raw)) throw new TypeError('record boundary module is not an object');
  const names: Array<keyof BoundaryModule> = [
    'loadedRecord',
    'portalDiscussion',
    'recordError',
    'recordRow',
    'rowEditLock',
    'recordDictionaryOrEmpty',
  ];
  for (const name of names) if (typeof raw[name] !== 'function') throw new TypeError(`missing boundary ${name}`);
  return raw as unknown as BoundaryModule;
}
const boundary = load();
const controls: unknown[] = [];
const loaded = boundary.loadedRecord({ formData: controls, rules: [] });
assert.strictEqual(loaded.formData, controls, 'canonical formData reference is preserved');
const portal = { allowExAccountDiscuss: true, isEnable: true };
assert.strictEqual(boundary.portalDiscussion(portal), portal, 'portal config identity is preserved');
assert.deepEqual(boundary.recordError({ resultCode: 4, errorCode: 10 }), { resultCode: 4, errorCode: 10 });
const row: Record<string, unknown> = { rowid: 'r1', custom: { opaque: true } };
assert.strictEqual(boundary.recordRow(row), row, 'record row identity is preserved');
assert.deepEqual(boundary.rowEditLock(undefined), {});
assert.deepEqual(boundary.recordDictionaryOrEmpty(undefined), {});
assert.throws(() => boundary.loadedRecord({ formData: {} }), TypeError);
assert.throws(() => boundary.portalDiscussion({ isEnable: 'yes' }), TypeError);
assert.throws(() => boundary.recordRow({ rowid: 7 }), TypeError);
assert.throws(() => boundary.rowEditLock({ expiretime: 7 }), TypeError);
