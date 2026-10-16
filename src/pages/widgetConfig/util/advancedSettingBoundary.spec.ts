const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { transformFileSync, transformSync } = require('../../../../scripts/spec-harness.ts');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const lodash = require('lodash');
global._l = (value: string) => value;
function load(file: string, imports: Record<string, unknown>, revision?: string) {
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    (revision
      ? transformSync(
          execFileSync('git', ['show', `${revision}:${path.relative(repo, file)}`], { cwd: repo, encoding: 'utf8' }),
          { filename: file, plugins: ['@babel/plugin-transform-modules-commonjs'] },
        )
      : transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] })
    ).code,
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
const dragConfig = load(path.join(repo, 'src/pages/widgetConfig/config/Drag.ts'), {});
const scoreConfig = load(path.join(repo, 'src/pages/widgetConfig/config/score.ts'), { lodash });
const widgetConfig = load(path.join(repo, 'src/pages/widgetConfig/config/widget.ts'), {
  lodash,
  uuid: require('uuid'),
  './Drag': dragConfig,
  './score': scoreConfig,
});
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
  assert.deepStrictEqual(
    read({ advancedSetting: { [key]: JSON.stringify(countries) } }, key),
    countries,
    key + ' retains full telephone country objects',
  );
}
assert.deepStrictEqual(
  read({ advancedSetting: { commcountries: '["CN","US"]' } }, 'commcountries'),
  ['CN', 'US'],
  'area country identifiers remain strings',
);
assert.deepStrictEqual(
  read({ advancedSetting: { defsource: '[{"cid":"","rcid":"","staticValue":3}]' } }, 'defsource'),
  [{ cid: '', rcid: '', staticValue: 3 }],
  'numeric score defaults are not filtered out',
);
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
function field(value: unknown, name: string): unknown {
  if (value === null || typeof value !== 'object') throw new TypeError('Missing observed producer field');
  return Reflect.get(value, name);
}
const autoIdDefaults = field(field(widgetConfig.DEFAULT_DATA, 'AUTO_ID'), 'advancedSetting');
const actualIncrease = field(autoIdDefaults, 'increase');
assert.strictEqual(typeof actualIncrease, 'string');
const actualRules: unknown = JSON.parse(String(actualIncrease));
if (!Array.isArray(actualRules)) throw new TypeError('Expected built-in auto-number rules');
assert.strictEqual(
  field(actualRules[0], 'start'),
  null,
  'Exercise the built-in auto-number producer, not a synthesized empty string',
);
assert.deepStrictEqual(read({ advancedSetting: { increase: actualIncrease } }, 'increase'), actualRules);
assert.strictEqual(
  read({ advancedSetting: { increase: actualRules } }, 'increase'),
  actualRules,
  'Already decoded null defaults retain identity',
);
const persistedAutoNumberRules = [
  {
    rcid: null,
    relationControlName: null,
    controlId: 'UAT-',
    controlType: 0,
    controlName: null,
    format: null,
    repeatType: 0,
    length: 0,
    start: null,
    type: 2,
  },
  {
    rcid: null,
    relationControlName: null,
    controlId: null,
    controlType: 0,
    controlName: null,
    format: null,
    repeatType: 0,
    length: 4,
    start: '1',
    type: 1,
  },
];
assert.deepStrictEqual(
  read({ advancedSetting: { increase: JSON.stringify(persistedAutoNumberRules) } }, 'increase'),
  persistedAutoNumberRules,
  'Persisted auto-number rules may use null placeholders for optional prefix and format fields',
);
for (const start of [null, '', 0, 1, '007', undefined]) {
  const value = [{ type: 1, repeatType: 0, start, length: 0, format: '' }];
  assert.deepStrictEqual(
    read({ advancedSetting: { increase: JSON.stringify(value) } }, 'increase'),
    JSON.parse(JSON.stringify(value)),
  );
}
for (const start of [true, {}, []]) {
  assert.throws(
    () => read({ advancedSetting: { increase: JSON.stringify([{ type: 1, start }]) } }, 'increase'),
    /Invalid widget setting list/,
  );
}
const before = process.env['WIDGET_SETTING_BEFORE_REV'];
if (before) {
  const previous = load(
    path.join(__dirname, 'advancedSettingBoundary.ts'),
    { 'src/utils/controlCommon': controlCommon },
    before,
  );
  const previousRead = previous.getWidgetAdvanceSetting as ReadSetting;
  assert.throws(
    () => previousRead({ advancedSetting: { increase: actualIncrease } }, 'increase'),
    /Invalid widget setting list/,
    'The actual producer reproduces the production exception before the fix',
  );
}
const filterRegexBefore = process.env['WIDGET_FILTERREGEX_BEFORE_REV'];
if (filterRegexBefore) {
  const previous = load(
    path.join(__dirname, 'advancedSettingBoundary.ts'),
    { 'src/utils/controlCommon': controlCommon },
    filterRegexBefore,
  );
  const previousRead = previous.getWidgetAdvanceSetting as ReadSetting;
  assert.throws(
    () =>
      previousRead(
        { advancedSetting: { filterregex: JSON.stringify([null, { value: 4 }, { value: '^ok$' }]) } },
        'filterregex',
      ),
    /Invalid widget setting list/,
    'The production malformed filterregex payload reproduces the previous exception',
  );
}

// Execute the actual pre-save and formatting functions with their real setting decoder.
const dataSource = fs.readFileSync(path.join(__dirname, 'data.tsx'), 'utf8');
const saveStart = dataSource.indexOf('export const checkWidgetBeforeSave =');
const saveEnd = dataSource.indexOf('// 处理查询输入参数层级关系', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart);
const settingSource = fs.readFileSync(path.join(__dirname, 'setting.ts'), 'utf8');
const changeStart = settingSource.indexOf('export const handleAdvancedSettingChange =');
const changeEnd = settingSource.indexOf('// 根据row、col排序controls', changeStart);
assert.ok(changeStart >= 0 && changeEnd > changeStart);
const consumerSource = settingSource.slice(changeStart, changeEnd) + dataSource.slice(saveStart, saveEnd);
const consumerCode = transformSync(consumerSource, {
  filename: path.join(__dirname, 'save-chain.tsx'),
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const resetCalls: unknown[] = [];
const consumer: { exports: Record<string, unknown> } = { exports: {} };
const localWindow = { auto_id_reset: { autonumber: true } };
const names = [
  'getAdvanceSetting',
  '_',
  'find',
  'findIndex',
  'isEmpty',
  'update',
  'window',
  'sheetAjax',
  'canAsUniqueWidget',
];
new Function('module', 'exports', ...names, consumerCode)(
  consumer,
  consumer.exports,
  read,
  lodash,
  lodash.find,
  lodash.findIndex,
  lodash.isEmpty,
  require('immutability-helper'),
  localWindow,
  { resetControlIncrease: (args: unknown) => resetCalls.push(args) },
  () => false,
);
function callSave(name: string, ...args: unknown[]): unknown {
  const fn = consumer.exports[name];
  if (typeof fn !== 'function') throw new TypeError('Missing actual save consumer');
  return Reflect.apply(fn, undefined, args);
}
const actualControl = { controlId: 'autonumber', type: 33, advancedSetting: { increase: actualIncrease } };
const scope = { appId: 'app', worksheetId: 'worksheet' };
assert.doesNotThrow(() => callSave('checkWidgetBeforeSave', [actualControl], [actualControl], scope));
assert.deepStrictEqual(resetCalls, [], 'An unchanged null start must not reset an auto-number sequence');
const formatted: unknown = callSave('formatControlsData', [actualControl]);
if (!Array.isArray(formatted)) throw new TypeError('Expected formatted controls');
const savedRules: unknown = read(
  { advancedSetting: field(formatted[0], 'advancedSetting') as Record<string, unknown> },
  'increase',
);
if (!Array.isArray(savedRules)) throw new TypeError('Expected saved rules');
assert.strictEqual(field(savedRules[0], 'start'), 1, 'The existing save formatter initializes an unset start to one');
assert.strictEqual(field(actualRules[0], 'start'), null, 'Reading and formatting do not mutate producer defaults');
callSave('checkWidgetBeforeSave', formatted, [actualControl], scope);
assert.deepStrictEqual(resetCalls, [{ appId: 'app', worksheetId: 'worksheet', controlId: 'autonumber', initNum: 0 }]);
const sublist = {
  controlId: 'sublist',
  type: 34,
  dataSource: 'child-sheet',
  advancedSetting: { detailworksheettype: '2' },
  relationControls: [actualControl],
};
assert.doesNotThrow(() => callSave('checkWidgetBeforeSave', [sublist], [sublist], scope));
for (const [key, value] of Object.entries({
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
const regexSettings = boundary.regexSettings as (value: unknown) => unknown;
const sortSettings = boundary.sortSettings as (value: unknown) => unknown;
const styleSetting = boundary.styleSetting as (value: unknown) => unknown;
const numberSetting = boundary.numberSetting as (value: unknown) => unknown;
assert.deepStrictEqual(filterSettings(''), []);
assert.deepStrictEqual(sortSettings(''), []);
assert.deepStrictEqual(styleSetting(''), {});
assert.strictEqual(numberSetting({ value: 3 }), '');
assert.deepStrictEqual(
  regexSettings([null, { value: 4 }, { value: '^ok$', filters: [{ controlId: 'field' }] }]),
  [{ value: '^ok$', filters: [{ controlId: 'field' }] }],
  'Legacy malformed filterregex entries are ignored while valid rules remain',
);
assert.deepStrictEqual(regexSettings('not-json'), [], 'Malformed filterregex containers are treated as empty');
assert.throws(() => filterSettings({ groupFilters: [] }), /Invalid widget setting list/);
assert.throws(() => styleSetting({ color: { invalid: true } }), /Invalid widget setting object/);
assert.deepStrictEqual(read({ advancedSetting: { widths: '["wrong", 240]' } }, 'widths'), [160, 240]);
console.log('widget advanced setting valid parity, missing defaults and invalid payload tests passed');
