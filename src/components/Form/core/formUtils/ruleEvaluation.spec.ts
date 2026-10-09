const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const moment = require('moment');
const lodash = require('lodash');
interface Control {
  controlId?: string;
  type?: number;
  value?: unknown;
  advancedSetting?: Record<string, string>;
  defaultState?: { fieldPermission?: string; required?: boolean };
  relationControls?: Control[];
  required?: boolean;
  fieldPermission?: string;
  controlPermissions?: string;
  hidden?: boolean;
  dot?: number;
  enumDefault?: number;
  enumDefault2?: number;
  options?: { key?: string; value?: string }[];
}
interface Condition {
  controlId?: string;
  filterType?: number;
  dataType?: number;
  value?: string;
  values?: string[];
  dateRange?: number;
  dynamicSource?: { cid?: string }[];
}
interface Target {
  controlId?: string;
  childControlIds?: string[];
  isCustom?: boolean;
  permission?: string[];
  type?: string;
  value?: string;
}
interface Rule {
  ruleId?: string;
  type?: number;
  filters?: { groupFilters?: Condition[] }[];
  ruleItems?: { type?: number; message?: string; controls?: Target[] }[];
}
interface RulesProps {
  rules?: Rule[];
  data?: Control[];
  currentRuleControlIds?: string[];
  updateControlIds?: string[];
  checkAllUpdate?: boolean;
  disabledRuleSet?: boolean;
  recordId?: string;
  handleChange?: (...args: unknown[]) => void;
  checkRuleValidator?: (...args: unknown[]) => void;
}
interface Modules {
  default?: (input: { filterData: Condition; originControl: Control; data?: Control[] }) => unknown;
  getConditionType?: (condition: {
    controlType?: number;
    type?: number;
    conditionGroupType?: number;
  }) => number | undefined;
  getTypeKey?: (type?: number) => string | undefined;
  redefineComplexControl?: (control: Control) => Control;
  updateRulesData?: (props: RulesProps) => Control[];
  updateRulesDataByRule?: (props: RulesProps, dependencies: unknown) => Control[];
  checkValueAvailable?: (rule: Rule, data: Control[]) => unknown;
  updateDataPermission?: (props: unknown) => void;
  getAvailableFilters?: (rules: Rule[], data: Control[]) => unknown;
  updateRulesDataOfRow?: (props: RulesProps) => Control[];
  FILTER_CONDITION_TYPE?: Record<string, number>;
  CONTROL_FILTER_WHITELIST?: Record<string, { value: number; keys: number[] }>;
  API_ENUM_TO_TYPE?: Record<string, number>;
  checkRulesErrorOfRow?: (props: { rules: Rule[]; controls: Control[]; row: Record<string, unknown> }) => {
    errors: Array<{ controlId?: string; errorMessage?: string }>;
  };
}
const root = path.resolve(__dirname, '../../../../..');
const cache = new Map<string, Modules>();
const changes: unknown[][] = [];
const sets: Target[][] = [];
const globals = { Account: { accountId: 'self', isPortal: false } };
globalThis.md = { global: globals };
globalThis.window = { isPublicWorksheet: false };
const parse = (value: unknown, type?: string): unknown => {
  if (!value) return type === 'array' ? [] : {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return type === 'array' ? [] : {};
  }
};
function load(file: string): Modules {
  const old = cache.get(file);
  if (old) return old;
  const moduleLike: { exports: Modules } = { exports: {} };
  cache.set(file, moduleLike.exports);
  const { code } = transformFileSync(file, {
    plugins: ['@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs'],
  });
  const stubs: Record<string, unknown> = {
    'src/utils/common': { accMul: (a: number, b: number) => a * b, accDiv: (a: number, b: number) => a / b },
    'src/utils/project': {
      dateAppZoneToServerZone: (value: unknown) => value,
      dateConvertToServerZone: (value: unknown) => value,
      dateServerZoneToAppZone: (value: unknown) => value,
    },
    'src/utils/controlCommon': {
      controlState: (control: Control) => ({ visible: control.fieldPermission?.[0] !== '0' }),
      isSheetDisplay: () => false,
      isEmptyValue: (value: unknown) => value === '' || value === null || value === undefined,
      toFixed: (value: number, dot?: number) => Number(value).toFixed(dot || 0),
      getDatePickerConfigs: (control?: Control) => ({
        formatMode:
          control?.advancedSetting?.showtype === '1'
            ? 'YYYY'
            : control?.type === 16
              ? 'YYYY-MM-DD HH:mm:ss'
              : 'YYYY-MM-DD',
      }),
    },
    'src/utils/control': {
      controlState: (control: Control) => ({ visible: control.fieldPermission?.[0] !== '0' }),
      isSheetDisplay: () => false,
      isRelateRecordTableControl: () => false,
      checkCellIsEmpty: (value: unknown) => value === '' || value === undefined,
      formatStrZero: (value: unknown) => value,
      getSwitchItemNames: () => [],
      toFixed: (value: number, dot?: number) => Number(value).toFixed(dot || 0),
    },
    'src/utils/record': { filterEmptyChildTableRows: (rows: unknown[]) => rows },
    'ming-ui/components/PhoneNumberInput/util': { telIsValidNumber: () => true },
    'src/pages/widgetConfig/util/data.js': { formatColumnToText: (control: Control) => control.value },
    'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util': {
      transferValue: (value: unknown) => value,
      isEnableScoreOption: () => false,
    },
    'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec': {},
    'src/pages/worksheet/components/WorksheetRecordLog/enum.js': { WFSTATUS_OPTIONS: [] },
    'worksheet/constants/enum': { RELATE_RECORD_SHOW_TYPE: { CARD: 3 } },
    '../customEvent': {
      handleSetValueActions: async (items: Target[], props: { handleChange: (...args: unknown[]) => void }) => {
        sets.push(items);
        await Promise.resolve();
        props.handleChange('set', items[0]?.controlId, {}, false);
      },
    },
  };
  const localRequire = (name: string): unknown => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === 'ming-ui/components/PhoneNumberInput/DialCodeSelect/utils') {
      return { getDefaultCode: () => '+86' };
    }
    if (name === 'lodash' || name === 'moment' || name === 'hot-formula-parser') return require(name);
    if (name === 'src/pages/worksheet/common/WorkSheetFilter/util') {
      const text = fs.readFileSync(path.join(root, 'src/pages/worksheet/common/WorkSheetFilter/util.ts'), 'utf8');
      const enums = load(path.join(root, 'src/pages/worksheet/common/WorkSheetFilter/enum.ts'));
      const helperCode =
        text.slice(
          text.indexOf('export function getConditionType'),
          text.indexOf('export function formatConditionForSave'),
        ) +
        '\n' +
        text.slice(
          text.indexOf('export function getTypeKey'),
          text.indexOf('export function formatValuesOfOriginConditions'),
        ) +
        '\n' +
        text.slice(
          text.indexOf('export function redefineComplexControl'),
          text.indexOf('// export const API_ENUM_TO_TYPE'),
        );
      const { transformSync } = require('../../../../../scripts/spec-harness.ts');
      const compiled = transformSync(helperCode, {
        filename: 'filterHelpers.ts',
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      }).code;
      const result: { exports: Modules } = { exports: {} };
      new Function('module', 'exports', '_', 'CONTROL_FILTER_WHITELIST', 'FILTER_CONDITION_TYPE', compiled)(
        result,
        result.exports,
        lodash,
        enums.CONTROL_FILTER_WHITELIST,
        enums.FILTER_CONDITION_TYPE,
      );
      return result.exports;
    }
    if (name.startsWith('src/')) return load(path.join(root, name.replace(/\.js$/, '') + '.ts'));
    if (name.startsWith('.')) {
      const filename = path.resolve(path.dirname(file), name.replace(/\.js$/, '') + '.ts');
      if (file.startsWith('/private/tmp/hap-filter-rules-strict-20261009/')) {
        const previousFile = filename + '.before.ts';
        return load(
          fs.existsSync(previousFile) ? previousFile : path.join(__dirname, name.replace(/\.js$/, '') + '.ts'),
        );
      }
      return load(filename);
    }
    throw new Error(`Unexpected rule dependency ${name}`);
  };
  new Function('module', 'exports', 'require', 'safeParse', '_l', 'console', code)(
    moduleLike,
    moduleLike.exports,
    localRequire,
    parse,
    (value: string) => value,
    { log: () => {} },
  );
  return moduleLike.exports;
}
const base = process.env.RULE_EVALUATION_DIRECTORY || __dirname;
const filter = load(path.join(base, process.env.RULE_OLD === '1' ? 'filterFn.ts.before.ts' : 'filterFn.ts')).default;
assert.equal(typeof filter, 'function');
const callFilter = filter as NonNullable<Modules['default']>;
const enums = load(path.join(root, 'src/pages/worksheet/common/WorkSheetFilter/enum.ts'));
const kinds = enums.FILTER_CONDITION_TYPE as Record<string, number>;
const previousNow = moment.now;
moment.now = () => Date.parse('2026-10-09T12:00:00Z');
try {
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.LIKE, dataType: 2, values: ['needle'] },
      originControl: { type: 2, value: 'find needle now' },
    }),
    true,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.EQ, dataType: 6, value: '2.5' },
      originControl: { type: 6, value: '2.50' },
    }),
    true,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.EQ, dataType: 26, values: ['{"id":"self"}'] },
      originControl: { type: 26, value: '[{"accountId":"self"}]' },
    }),
    true,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.RCEQ, dataType: 29, values: ['{"id":"record"}'] },
      originControl: { type: 29, value: '[{"sid":"record"}]' },
    }),
    true,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.HASVALUE, dataType: 19 },
      originControl: { type: 19, value: '{"code":"CN"}' },
    }),
    'CN',
  );
  const values = ['b', 'a'];
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.ARREQ, dataType: 10, values },
      originControl: { type: 10, value: '["a","b"]' },
    }),
    true,
  );
  assert.deepEqual(
    values,
    ['b', 'a'],
    'The existing filter creates its comparison array before sorting; source order must remain unchanged',
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.DATEENUM, dataType: 15, dynamicSource: [{ cid: 'other' }] },
      originControl: { type: 15, value: '2026-01-01', advancedSetting: { showtype: '1' } },
      data: [{ controlId: 'other', type: 15, value: '2026-10-01', advancedSetting: { showtype: '1' } }],
    }),
    true,
    'The historic year-space unit keeps the formatted-year millisecond comparison',
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.DATE_GT, dataType: 15, dynamicSource: [{ cid: 'other' }] },
      originControl: { type: 15, value: '2026-10-01', advancedSetting: { showtype: '1' } },
      data: [{ controlId: 'other', type: 15, value: '2026-01-01', advancedSetting: { showtype: '1' } }],
    }),
    true,
    'A year-space comparison keeps raw millisecond ordering within the same year',
  );
  assert.equal(
    callFilter({ filterData: { filterType: kinds.BETWEEN, dataType: 9 }, originControl: { type: 9, value: '["x"]' } }),
    undefined,
    'Unsupported combinations retain an undefined result',
  );
  console.log('real filter evaluation contracts passed');
} finally {
  moment.now = previousNow;
}
{
  const update = load(
    path.join(base, process.env.RULE_OLD === '1' ? 'updateRulesData.ts.before.ts' : 'updateRulesData.ts'),
  ).updateRulesData as NonNullable<Modules['updateRulesData']>;
  const condition: Condition = { controlId: 'source', dataType: 2, filterType: kinds.EQ, values: ['yes'] };
  const data: Control[] = [
    { controlId: 'source', type: 2, value: 'yes' },
    { controlId: 'target', type: 2, fieldPermission: '000', defaultState: { fieldPermission: '111' } },
  ];
  const rule = (type: number, targets: Target[], category = 0, message?: string): Rule => ({
    type: category,
    filters: [{ groupFilters: [condition] }],
    ruleItems: [{ type, controls: targets, message }],
  });
  let output = update({ data, rules: [rule(2, [{ controlId: 'target' }])] });
  assert.equal(output.find(control => control.controlId === 'target')?.fieldPermission, '011');
  output = update({ data: [{ ...data[0], value: 'no' }, data[1]], rules: [rule(2, [{ controlId: 'target' }])] });
  assert.equal(
    output.find(control => control.controlId === 'target')?.fieldPermission,
    '111',
    'A false hide condition restores the original visible state',
  );
  assert.equal(data[1].fieldPermission, '000', 'Rules return cloned controls and preserve source metadata');
  const messages: unknown[][] = [];
  output = update({
    data,
    rules: [rule(5, [{ controlId: 'target' }])],
    checkRuleValidator: (...args) => messages.push(args),
  });
  assert.equal(output.find(control => control.controlId === 'target')?.required, true);
  assert.ok(messages.some(args => args[0] === 'target' && args[1] === 'RULE_REQUIRED'));
  output = update({
    data,
    rules: [
      rule(3, [{ controlId: 'target', isCustom: true, permission: ['edit'] }]),
      rule(3, [{ controlId: 'target', isCustom: true, permission: ['add'] }]),
    ],
  });
  assert.equal(output.find(control => control.controlId === 'target')?.fieldPermission, '111');
  output = update({
    data,
    rules: [rule(0, [{ controlId: 'target', value: '{"color":"override"}' }], 3, '{"color":"base","showtype":"1"}')],
  });
  assert.deepEqual(
    output.find(control => control.controlId === 'target')?.advancedSetting,
    { color: 'override', showtype: '1' },
    'Target styles override the rule style message in stored order',
  );
  messages.length = 0;
  update({
    data,
    rules: [rule(6, [{ controlId: 'target' }], 1, 'Denied')],
    checkAllUpdate: true,
    checkRuleValidator: (...args) => messages.push(args),
  });
  assert.ok(messages.some(args => args[0] === 'target' && args[1] === 'RULE_ERROR' && args[2] === 'Denied'));
  console.log('real rule updates permissions/styles/errors passed');
  async function verifyDynamic(): Promise<void> {
    const props = { data, currentRuleControlIds: ['source'], handleChange: (...args: unknown[]) => changes.push(args) };
    update({
      ...props,
      rules: [
        rule(9, [{ controlId: 'target', type: '0', value: 'first' }]),
        rule(9, [{ controlId: 'target', type: '0', value: 'last' }]),
      ],
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sets.length, 1);
    assert.equal(sets[0][0].value, 'last', 'Multiple assignments choose the last actual rule target');
    assert.equal(changes[0][0], 'set');
    assert.deepEqual(
      changes.at(-1),
      [undefined, undefined, undefined, false, true],
      'Completion is emitted after the real dynamic callback',
    );
    const before = sets.length;
    update({ ...props, disabledRuleSet: true, rules: [rule(9, [{ controlId: 'target', type: '0', value: 'skip' }])] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sets.length, before);
    console.log('real dynamic rule assignments ordering passed');
  }
  void verifyDynamic().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
if (process.env.RULE_OLD !== '1') {
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.NE, dataType: 10, values: ['a'] },
      originControl: { type: 10, value: 'null' },
    }),
    undefined,
    'A broken selection must not become a matching negative condition',
  );
  assert.equal(
    callFilter({ filterData: { filterType: kinds.ISNULL, dataType: 26 }, originControl: { type: 26, value: 'null' } }),
    undefined,
    'Corrupt JSON null is not a valid empty person selection',
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.RCEQ, dataType: 29, values: ['{"id":"record"}'] },
      originControl: { type: 29, value: '[null]' },
    }),
    undefined,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.ISNULL, dataType: 29 },
      originControl: { type: 29, value: '0', advancedSetting: { showtype: '2' } },
    }),
    true,
    'Related-record table count zero retains its scalar protocol',
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.HASVALUE, dataType: 29 },
      originControl: { type: 29, value: '3', advancedSetting: { showtype: '2' } },
    }),
    true,
  );
  assert.equal(
    callFilter({
      filterData: { filterType: kinds.HASVALUE, dataType: 19 },
      originControl: { type: 19, value: '{"code":{}}' },
    }),
    undefined,
  );
  console.log('real malformed filter evaluation stays unavailable');
}

if (process.env.RULE_OLD !== '1') {
  const rulesError = load(path.join(root, 'src/utils/rule.ts')).checkRulesErrorOfRow as NonNullable<
    Modules['checkRulesErrorOfRow']
  >;
  const rule: Rule = {
    type: 1,
    filters: [{ groupFilters: [{ controlId: 'source', dataType: 2, filterType: kinds.EQ, values: ['yes'] }] }],
    ruleItems: [{ type: 6, message: 'Denied', controls: [{ controlId: 'target' }] }],
  };
  const result = rulesError({
    rules: [rule],
    controls: [
      { controlId: 'source', type: 2 },
      { controlId: 'target', type: 2 },
    ],
    row: { rowid: 'row', source: 'yes' },
  });
  assert.deepEqual(result.errors, [
    { controlId: 'target', errorType: 'RULE_ERROR', errorMessage: 'Denied', ignoreErrorMessage: false },
  ]);
  const broken = rulesError({
    rules: [{ ...rule, ruleItems: [{ type: 6, message: 'Denied', controls: [{}] }] }],
    controls: [{ controlId: 'source', type: 2 }, { type: 2 }],
    row: { rowid: 'row', source: 'yes' },
  });
  assert.deepEqual(broken.errors, [], 'A missing control ID cannot be submitted as an error entry');
  console.log('real row error adapter ID boundaries passed');
}
