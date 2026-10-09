const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
global._l = (value: string) => value;
function load(file: string, imports: Record<string, unknown>) {
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code,
  )(loaded, loaded.exports, (name: string) => {
    if (!(name in imports)) throw new Error('Unstubbed ' + name);
    return imports[name];
  });
  return loaded.exports;
}
const repo = path.resolve(__dirname, '../../../..');
const sourceBoundary = load(path.join(repo, 'src/utils/advancedSettingBoundary.ts'), {});
const controlCommon = load(path.join(repo, 'src/utils/controlCommon.ts'), {
  'immutability-helper': require('immutability-helper'),
  lodash,
  moment: require('moment'),
  'src/components/Form/core/enum': { HAVE_VALUE_STYLE_WIDGET: [] },
  './advancedSettingBoundary': sourceBoundary,
});
const boundary = load(path.join(__dirname, 'advancedSettingBoundary.ts'), { 'src/utils/controlCommon': controlCommon });
type ReadSetting = (data: { advancedSetting?: Record<string, unknown> }, key?: string | string[]) => unknown;
const read = boundary.getWidgetAdvanceSetting as ReadSetting;
const raw = controlCommon.getAdvanceSetting as ReadSetting;
const cases: Record<string, unknown> = {
  custom_event: [
    {
      eventId: 'event',
      eventType: '1',
      eventActions: [
        {
          eventName: 'Condition',
          filters: [{ valueType: '1', filterItems: [{ controlId: 'field', filterType: 1, values: ['text'] }] }],
          actions: [{ actionType: '5', actionItems: [{ controlId: 'field', type: '3', value: '[]' }] }],
        },
      ],
    },
  ],
  widths: [160, 240],
  sorts: [{ controlId: 'field', isAsc: false }],
  choosesorts: [{ controlId: 'ctime', isAsc: true }],
  requestmap: [{ id: 'parameter', defsource: '[{"cid":"field"}]' }],
  responsemap: [{ id: 'parameter', cid: 'field', type: 2 }],
  filters: [{ isGroup: true, groupFilters: [{ controlId: 'field', dataType: 2, filterType: 1, values: ['value'] }] }],
  reference: [{ cid: 'field', name: 'fieldValue' }],
  reportsetting: [{ controlId: 'field', type: '1' }],
  statisticsseting: [{ id: 'field', type: 'SUM' }],
  cardtitlestyle: { direction: '2', size: '3', style: '1000', extra: { preserved: true } },
  defaultfunc: { type: 'javascript', expression: 'return 1', status: 1, parameters: ['kept'] },
  dynamicsrc: { id: 'query', metadata: 'kept' },
  filterregex: [{ name: 'Text', value: '^.*$', filters: [{ controlId: 'field' }] }],
  increase: [{ type: 1, repeatType: 0, start: '', length: 4, format: '' }],
  chooserange: [{ cid: 'field', rcid: '', type: 4 }],
  topfilters: ['{"id":"root","name":"Root"}'],
  currency: { currencycode: 'USD' },
  defaultarea: { id: 'country', dialCode: '+86' },
};
for (const [key, value] of Object.entries(cases)) {
  assert.strictEqual(read({}, key), '', key + ' preserves missing sentinel and caller defaults');
  const data = { advancedSetting: { [key]: JSON.stringify(value) } };
  assert.deepStrictEqual(read(data, key), raw(data, key), key + ' preserves valid JSON and metadata');
  assert.strictEqual(
    read({ advancedSetting: { [key]: value } }, key),
    value,
    key + ' retains already parsed object identity',
  );
}
assert.deepStrictEqual(
  read({ advancedSetting: { topfilters: JSON.stringify([{ controlId: 'field', filterType: 1 }]) } }, 'topfilters'),
  [{ controlId: 'field', filterType: 1 }],
  'topfilters also supports condition groups',
);
for (const key of ['showtype', 'checktype', 'topshow', 'querytype', 'min', 'max', 'rownum', 'blankrow']) {
  assert.strictEqual(read({ advancedSetting: { [key]: '0' } }, key), 0, key + ' preserves numeric zero');
}
for (const key of ['allowcountries', 'commcountries']) {
  const countries = [{ name: 'China', iso2: 'cn', dialCode: '86' }];
  assert.deepStrictEqual(read({ advancedSetting: { [key]: JSON.stringify(countries) } }, key), countries, key + ' retains full telephone country objects');
}
assert.deepStrictEqual(read({ advancedSetting: { commcountries: '["CN","US"]' } }, 'commcountries'), ['CN', 'US'], 'area country identifiers remain strings');
assert.deepStrictEqual(read({ advancedSetting: { defsource: '[{"cid":"","rcid":"","staticValue":3}]' } }, 'defsource'), [{ cid: '', rcid: '', staticValue: 3 }], 'numeric score defaults are not filtered out');
const defaultRules = [{ type: 1, repeatType: 0, start: '', length: 0, format: '' }];
assert.strictEqual(
  read({}, 'increase') || defaultRules,
  defaultRules,
  'missing auto-ID rules keep the original default',
);
assert.deepStrictEqual(
  read({ advancedSetting: { increase: '[]' } }, 'increase'),
  [],
  'explicit empty rules remain explicit',
);
for (const [key, value] of Object.entries({
  widths: ['wrong'],
  sorts: [{ isAsc: 'yes' }],
  requestmap: [{ defsource: {} }],
  responsemap: [{ cid: 1 }],
  filters: [{ values: [5] }],
  reference: [{ name: 7 }],
  cardtitlestyle: { style: 1 },
  custom_event: [{ eventActions: [{ actions: [{ actionType: 5 }] }] }],
})) {
  assert.throws(() => read({ advancedSetting: { [key]: JSON.stringify(value) } }, key), /Invalid widget setting/);
}
const filterSettings = boundary.filterSettings as (value: unknown) => unknown;
const sortSettings = boundary.sortSettings as (value: unknown) => unknown;
const styleSetting = boundary.styleSetting as (value: unknown) => unknown;
const numberSetting = boundary.numberSetting as (value: unknown) => unknown;
assert.deepStrictEqual(filterSettings(''), []);
assert.deepStrictEqual(sortSettings(''), []);
assert.deepStrictEqual(styleSetting(''), {});
assert.strictEqual(numberSetting({ value: 3 }), '');
assert.throws(() => filterSettings({ groupFilters: [] }), /Invalid widget setting list/);
assert.throws(() => styleSetting({ color: { invalid: true } }), /Invalid widget setting object/);
console.log('widget advanced setting valid parity, missing defaults and invalid payload tests passed');
