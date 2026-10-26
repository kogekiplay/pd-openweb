const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const h: typeof import('../../../../scripts/spec-harness') = require('../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const before = process.env['WIDGET_FILTER_BEFORE_REV'];
function source(file: string): string {
  return before && (file.endsWith('/widgetConfig/util/advancedSettingBoundary.ts') || file.endsWith('/widgetConfig/util/data.tsx'))
    ? cp.execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function call(value: unknown, ...args: unknown[]): unknown {
  assert.equal(typeof value, 'function');
  if (typeof value !== 'function') throw new TypeError('Missing actual export');
  return Reflect.apply(value, undefined, args);
}
function load(file: string, imports: Record<string, unknown>): Record<string, unknown> {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', h.transformSync(source(file), { filename: path.join(root, file) }).code)(
    module, module.exports, (name: string) => {
      if (!Object.hasOwn(imports, name)) throw new Error('Unstubbed module ' + name);
      return imports[name];
    }, (text: string) => text,
  );
  return module.exports;
}
const primitive = load('src/utils/advancedSettingBoundary.ts', {});
const common = load('src/utils/controlCommon.ts', {
  lodash, moment: require('moment'), 'immutability-helper': require('immutability-helper'),
  'src/components/Form/core/enum': { HAVE_VALUE_STYLE_WIDGET: [] }, './advancedSettingBoundary': primitive,
});
const boundary = load('src/pages/widgetConfig/util/advancedSettingBoundary.ts', { 'src/utils/controlCommon': common });
const data = source('src/pages/widgetConfig/util/data.tsx');
const setting = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/util/setting.ts'), 'utf8');
const starts = {
  condition: data.indexOf('export function handleCondition('),
  filters: data.indexOf('export function handleFilters('),
  save: data.indexOf('export const checkWidgetBeforeSave ='),
  saveEnd: data.indexOf('// 处理查询输入参数层级关系'),
  extreme: data.indexOf('export function handleExtremeValue('),
  extremeEnd: data.indexOf('export function dealRelateSheetDefaultValue('),
  change: setting.indexOf('export const handleAdvancedSettingChange ='),
  changeEnd: setting.indexOf('// 根据row、col排序controls'),
};
assert.ok(Object.values(starts).every(value => value >= 0));
const conditionEnd = data.indexOf('const canSelectedControls =', starts.filters);
assert.ok(conditionEnd > starts.filters);
// Verbatim actual export bodies, as in the existing advancedSettingBoundary spec.
// UI-only imports and unrelated service actions are excluded; no implementation is copied.
const actual = data.slice(data.indexOf('function parseSettingItems('), data.indexOf('export const getMsgByCode =')) +
  setting.slice(starts.change, starts.changeEnd) +
  data.slice(starts.condition, conditionEnd) +
  data.slice(starts.extreme, data.indexOf('const use_ids:')) + data.slice(starts.save, starts.saveEnd);
const actualModule: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', '_', 'getAdvanceSetting', 'filterSettings', 'widgetObject', 'find', 'findIndex', 'isEmpty', 'update', 'window', 'sheetAjax', 'canAsUniqueWidget', '_l', 'omit', h.transformSync(actual, { filename: path.join(root, 'src/pages/widgetConfig/util/actual-filter-save.tsx') }).code)(
  actualModule, actualModule.exports, lodash, boundary['getWidgetAdvanceSetting'], boundary['filterSettings'], boundary['widgetObject'], lodash.find, lodash.findIndex, lodash.isEmpty,
  require('immutability-helper'), {}, { resetControlIncrease() { throw new Error('Unexpected service call'); } }, () => false, (text: string) => text, lodash.omit,
);
let checks = 0;
function test(name: string, fn: () => void) {
  if (process.env['WIDGET_FILTER_CASE'] === 'producer' && !name.startsWith('real producer')) return;
  fn(); checks++; console.log('PASS ' + name);
}
const filterRead = boundary['getWidgetAdvanceSetting'];
const format = actualModule.exports['formatControlsData'];
const keys = ['filters', 'resultfilters', 'topfilters'];
for (const key of keys) {
  test(key + ' preserves nullable inactive lists through real read and save formatter', () => {
    const filters = [{ controlId: 'text-field', dataType: 2, filterType: 2, values: null, dynamicSource: null, groupFilters: null }];
    const row = { type: 29, controlId: 'relation', dataSource: 'related-sheet', advancedSetting: { [key]: JSON.stringify(filters), topshow: '3' } };
    assert.deepEqual(call(filterRead, row, key), filters);
    const out = call(format, [row]); assert.ok(Array.isArray(out)); assert.ok(record(out[0]));
    assert.deepEqual(call(filterRead, out[0], key), filters);
    const inMemory = { ...row, advancedSetting: { [key]: filters, topshow: '3' } };
    assert.equal(call(filterRead, inMemory, key), filters);
  });
}
for (const raw of ['{}', '{"name":"missing ID"}', '{"id":123}', '{"id":null}', '{"id":"actual-id"}']) {
  test('real producer never corrupts selection ' + raw, () => {
    const original = [{ controlId: 'selection', dataType: 29, filterType: 1, values: [raw] }];
    const row = { type: 29, controlId: 'relation', dataSource: 'related-sheet', advancedSetting: { filters: JSON.stringify(original) } };
    const once = call(format, [row]); assert.ok(Array.isArray(once)); assert.ok(record(once[0]));
    const value = call(filterRead, once[0], 'filters'); assert.ok(Array.isArray(value)); assert.ok(record(value[0]));
    assert.deepEqual(value[0]['values'], [raw === '{"id":"actual-id"}' ? 'actual-id' : raw]);
    const twice = call(format, once); assert.ok(Array.isArray(twice)); assert.ok(record(twice[0]));
    assert.deepEqual(call(filterRead, twice[0], 'filters'), value);
  });
}
test('previously persisted null selection placeholder remains in its rule', () => {
  const filters = [{ controlId: 'selection', dataType: 29, filterType: 1, values: [null, 'real-id'] }];
  assert.equal(call(boundary['filterSettings'], filters), filters);
  const row = { type: 29, controlId: 'relation', dataSource: 'sheet', advancedSetting: { filters: JSON.stringify(filters) } };
  const formatted = call(format, [row]); assert.ok(Array.isArray(formatted)); assert.ok(record(formatted[0]));
  assert.deepEqual(call(filterRead, formatted[0], 'filters'), filters);
});
test('finite numeric static values preserve dynamic source references', () => {
  const filters = [{ controlId: 'numeric', dataType: 6, isDynamicsource: true, dynamicSource: [{ cid: '', rcid: '', staticValue: 3 }] }];
  assert.equal(call(boundary['filterSettings'], filters), filters);
});
test('malformed filters still fail rather than disappearing', () => {
  for (const invalid of [{}, [null], [{ values: [5] }], [{ dataType: 29, values: [5] }], [{ values: {} }], [{ dynamicSource: {} }], [{ groupFilters: {} }], [{ dynamicSource: [{ staticValue: {} }] }], [{ dynamicSource: [{ staticValue: NaN }] }]]) {
    assert.throws(() => call(boundary['filterSettings'], invalid), TypeError);
  }
});
console.log(JSON.stringify({ checks, before: before || null, actualExports: ['getWidgetAdvanceSetting', 'filterSettings', 'handleCondition', 'handleFilters', 'formatControlsData'], serviceCalls: 0 }));
