const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

interface Control {
  attribute?: number;
  controlId?: string;
  type?: number;
  enumDefault?: number;
  enumDefault2?: number;
  value?: unknown;
  advancedSetting?: Record<string, string>;
  options?: { key?: string; value?: string; score?: number; isDeleted?: boolean }[];
  relationControls?: Control[];
  dot?: number;
  dataSource?: string;
  sourceControlId?: string;
  unit?: string;
  required?: boolean;
}
interface FormUtils {
  getCurrentValue: (source: Control | undefined, value: unknown, target: Control) => unknown;
  getDynamicValue: (
    controls: Control[],
    target: Control,
    master?: { worksheetId?: string; formData?: Control[] },
  ) => unknown;
  handleDotAndRound: (control: Control, value: string | number) => string;
  parseNewFormula: (controls: Control[], target: Control) => { result?: number | null; columnIsUndefined?: boolean };
  parseDateFormula: (controls: Control[], target: Control, createTime?: string) => unknown;
  checkValueByFilterRegex: (control: Control, value?: string, controls?: Control[]) => unknown;
  checkValueAvailable: (
    rule: unknown,
    controls: Control[],
    recordId?: string,
  ) => { isAvailable: boolean; filterControlIds: unknown[]; availableControlIds: unknown[] };
  getRuleErrorInfo: (rules: unknown[], badData: string[]) => unknown[];
  onValidator: (options: { item: Control; data?: Control[] }) => { errorType: string; errorText?: string };
}
interface HelperUtils {
  getControlValue: (controls: Control[], target: Control, controlId?: string, value?: unknown) => unknown;
  getAttachmentData: (control: Control) => unknown[];
  getOtherWorksheetFieldValue: (args: { data: Control[]; dataSource?: string; sourceControlId?: string }) => unknown;
}
interface Boundaries {
  dateBoundaryValue: (value: unknown, timeOnly?: boolean) => string | null;
  eventLinkValue: (value: unknown) => string | undefined;
}
const globalScope = globalThis;
globalScope.md = {
  global: { Account: { accountId: 'self', fullname: 'Current User', avatarMiddle: 'avatar', isPortal: false } },
};
globalScope.window = { isPublicWorksheet: false, worksheetControlsCache: {} };
globalScope.localStorage = { getItem: () => null };
const errors = {
  REQUIRED: 'REQUIRED',
  CUSTOM: 'CUSTOM',
  NUMBER_RANGE: 'NUMBER_RANGE',
  TEXT_RANGE: 'TEXT_RANGE',
  MULTI_SELECT_RANGE: 'MULTI_SELECT_RANGE',
  DATE_TIME_RANGE: 'DATE_TIME_RANGE',
  RULE_ERROR: 'RULE_ERROR',
};
const stubs: Record<string, unknown> = {
  'ming-ui/components/PhoneNumberInput/util': { telIsValidNumber: () => true },
  'worksheet/constants/enum': { RELATE_RECORD_SHOW_TYPE: { CARD: 3 } },
  'src/pages/widgetConfig/util/data.js': { formatColumnToText: (control: Control) => String(control.value ?? '') },
  'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util': {
    transferValue: (value: unknown) => value,
    isEnableScoreOption: (control: Control) => [9, 10, 11].includes(control.type) && !!control.enumDefault,
  },
  'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec': {
    __esModule: true,
    default: () => ({ value: 'done' }),
  },
  'src/pages/worksheet/components/WorksheetRecordLog/enum.js': {
    WFSTATUS_OPTIONS: [{ key: 'approved', value: 'Approved' }],
  },
  'src/utils/common': { accMul: (a: number, b: number) => a * b, calcDate: () => ({ error: true }) },
  'src/utils/control': {
    controlState: () => ({ visible: true }),
    formatStrZero: (value: string) => value.replace(/\.0+$/, ''),
    getSwitchItemNames: () => [{ key: '1', value: 'Yes' }],
    isRelateRecordTableControl: () => false,
    renderText: (control: Control) => control.value,
    toFixed: (value: number, decimals: number) => value.toFixed(decimals),
    checkCellIsEmpty: (value: unknown) => value === '' || value === undefined,
  },
  'src/utils/controlCommon': {
    getShowFormat: (control: Control) => (control.type === 15 ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'),
    isSheetDisplay: () => false,
    toFixed: (value: number, decimals: number) => value.toFixed(decimals),
  },
  'src/utils/project': {
    dateConvertToServerZone: (value: unknown) => value,
    dateServerZoneToAppZone: (value: unknown) => value,
    getContactInfo: (key: string) => (key === 'mobilePhone' ? '123' : 'self@example.test'),
  },
  'src/utils/record': { filterEmptyChildTableRows: (rows: unknown[]) => rows },
  '../config': {
    FORM_ERROR_TYPE: errors,
    FORM_ERROR_TYPE_TEXT: {
      REQUIRED: () => 'Required',
      MOBILE_PHONE: '',
      TEL_PHONE: '',
      EMAIL: '',
      ID_CARD: '',
      PASSPORT: '',
      HK_PASSPORT: '',
      TW_PASSPORT: '',
      OTHER_REQUIRED: () => 'Required',
      CHILD_TABLE_ROWS_LIMIT: () => '',
      UNIQUE: () => '',
      NUMBER_RANGE: () => '',
      MULTI_SELECT_RANGE: () => '',
      DATE: () => '',
      DATE_TIME: () => '',
      TEXT_RANGE: () => '',
      DATE_TIME_RANGE: () => '',
    },
    TIME_UNIT: { 1: 'm', 2: 'h', 3: 'd', 4: 'M', 5: 'y', 6: 's' },
  },
  './filterFn': {
    __esModule: true,
    default: ({ filterData }: { filterData: { result?: boolean } }) => filterData.result !== false,
  },
};
const moduleCache = new Map<string, Record<string, unknown> & Partial<FormUtils & HelperUtils & Boundaries>>();
function loadModule(file: string): Record<string, unknown> & Partial<FormUtils & HelperUtils & Boundaries> {
  const full = path.resolve(file);
  const old = moduleCache.get(full);
  if (old) return old;
  const moduleLike: { exports: Record<string, unknown> & Partial<FormUtils & HelperUtils & Boundaries> } = {
    exports: {},
  };
  moduleCache.set(full, moduleLike.exports);
  const { code } = transformFileSync(full, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', 'safeParse', '_l', 'console', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (name.startsWith('.')) {
        const original =
          full.startsWith('/private/tmp/hap-form-utils-strict-20261009/') && ['./helper', './ruleUtils'].includes(name)
            ? path.join('/private/tmp/hap-form-utils-strict-20261009', name.slice(2) + '.before.ts')
            : undefined;
        return loadModule(original || path.join(path.dirname(full), name.replace(/\.js$/, '') + '.ts'));
      }
      return require(name);
    },
    (value: unknown, fallback?: string) => {
      if (!value) return fallback === 'array' ? [] : {};
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return fallback === 'array' ? [] : {};
      }
    },
    (value: string) => value,
    { log: () => {} },
  );
  return moduleLike.exports;
}
const source = process.env.FORM_UTIL_SOURCE || path.join(__dirname, 'index.ts');
const utils = loadModule(source) as FormUtils;
const helper = loadModule(path.join(__dirname, 'helper.ts')) as HelperUtils;
const boundaries = loadModule(path.join(__dirname, 'valueBoundary.ts')) as Boundaries;

// The source and target controls are real payloads, not a second implementation of the helper.
assert.equal(
  utils.getCurrentValue({ type: 26 }, '[{"accountId":"self","fullname":"old"},{"accountId":"other","name":"Other"}]', {
    type: 2,
  }),
  'Current User、Other',
);
assert.equal(utils.getCurrentValue({ type: 27 }, '[{"departmentName":"Ops"}]', { type: 2 }), 'Ops');
assert.equal(utils.getCurrentValue({ type: 19 }, '{"name":"Shanghai"}', { type: 2 }), 'Shanghai');
const choices = {
  controlId: 'choice',
  type: 10,
  enumDefault: 1,
  value: '["a","b"]',
  options: [
    { key: 'a', value: 'First', score: 2 },
    { key: 'b', value: 'Second', score: 3 },
    { key: 'removed', value: 'Deleted', isDeleted: true },
  ],
};
assert.equal(utils.getCurrentValue(choices, '["a","add_New","other:Extra"]', { type: 2 }), 'First, New, Extra');
assert.equal(utils.getCurrentValue(choices, '["a","b"]', { type: 6 }), 5);
assert.equal(
  utils.getCurrentValue(
    { type: 14 },
    '{"attachments":[{"originalFilename":"a.txt"}],"attachmentData":[{"originalFileName":"b.txt"}]}',
    { type: 2 },
  ),
  'b.txt、a.txt',
);
assert.equal(
  utils.getCurrentValue(
    { type: 29, relationControls: [{ controlId: 'title', attribute: 1 }] },
    '[{"name":"Record title"}]',
    { type: 2 },
  ),
  'Record title',
);
assert.equal(
  utils.getDynamicValue([choices], {
    type: 10,
    options: choices.options,
    advancedSetting: { defsource: '[{"cid":"choice"}]' },
  }),
  '["a","b"]',
);
assert.equal(helper.getControlValue([choices], { type: 6 }, 'choice'), 5);
assert.equal(
  utils.getDynamicValue([{ controlId: 'source', type: 2, value: 'Keep' }], {
    type: 2,
    advancedSetting: { defsource: '[{"cid":"source"}]' },
  }),
  'Keep',
);
assert.equal(
  utils.getDynamicValue([], { type: 2, advancedSetting: { defsource: '[{"staticValue":"Literal"}]' } }),
  'Literal',
);
assert.equal(
  utils.getDynamicValue([], { type: 26, advancedSetting: { defsource: '[{"cid":"user-self"}]' } }),
  '[{"accountId":"self","fullname":"Current User","avatarMiddle":"avatar","avatar":"avatar","name":"Current User"}]',
);
assert.equal(
  utils.getDynamicValue(
    [{ controlId: 'field', type: 2, value: 'From master' }],
    { type: 2, advancedSetting: { defsource: '[{"rcid":"master","cid":"field"}]' } },
    { worksheetId: 'master', formData: [{ controlId: 'field', type: 2, value: 'From master' }] },
  ),
  'From master',
);
assert.equal(
  utils.getDynamicValue([], {
    type: 26,
    advancedSetting: {
      defsource: '[{"staticValue":"{\\\"accountId\\\":\\\"other\\\",\\\"fullname\\\":\\\"Other\\\"}"}]',
    },
  }),
  '[{"accountId":"other","fullname":"Other"}]',
);
assert.equal(utils.handleDotAndRound({ type: 6, dot: 2, advancedSetting: { roundtype: '2' } }, '-1.236'), '-1.24');
const formulaControl = {
  type: 31,
  dot: 2,
  dataSource: '$number$+1',
  advancedSetting: { nullzero: '1', roundtype: '2' },
};
assert.deepEqual(utils.parseNewFormula([{ controlId: 'number', type: 6, value: '2.5' }], formulaControl), {
  result: 3.5,
});
assert.deepEqual(utils.parseNewFormula([], { ...formulaControl, advancedSetting: { nullzero: '0', roundtype: '2' } }), {
  columnIsUndefined: true,
});
assert.equal(
  utils.parseDateFormula([], {
    type: 38,
    enumDefault: 1,
    sourceControlId: '2026-10-01',
    dataSource: '2026-10-03',
    unit: '3',
    dot: 0,
    advancedSetting: {},
  }),
  '2',
);
assert.equal(
  utils.checkValueByFilterRegex(
    { type: 2, advancedSetting: { filterregex: '[{"value":"^ok$","err":"Invalid"}]' } },
    'bad',
    [],
  ),
  'Invalid',
);
assert.equal(
  utils.checkValueByFilterRegex(
    { type: 2, advancedSetting: { filterregex: '[{"value":"^ok$","err":"Invalid"}]' } },
    'ok',
    [],
  ),
  '',
);
const rule = {
  ruleId: 'rule',
  type: 1,
  filters: [{ groupFilters: [{ controlId: 'field', result: true }] }],
  ruleItems: [{ type: 6, message: 'Denied', controls: [{ controlId: 'field' }] }],
};
assert.deepEqual(utils.checkValueAvailable(rule, [{ controlId: 'field', type: 2 }]), {
  isAvailable: true,
  filterControlIds: [],
  availableControlIds: ['field'],
});
assert.deepEqual(utils.getRuleErrorInfo([rule], ['prefix:field:rule:row']), [
  {
    rowId: 'row',
    controlId: 'field',
    errorInfo: [
      {
        controlId: 'field',
        errorMessage: 'Denied',
        ruleId: 'rule',
        errorType: 'RULE_ERROR',
        showError: true,
        ignoreErrorMessage: false,
      },
    ],
  },
]);
console.log('form utilities valid payloads passed');

if (process.env.FORM_NORMAL_ONLY !== '1') {
  assert.equal(utils.getDynamicValue([], { type: 2, advancedSetting: { defsource: 'null' } }), '');
  assert.equal(
    utils.getDynamicValue([], { type: 2, advancedSetting: { defsource: '[null,{"cid":4},{"staticValue":"valid"}]' } }),
    'valid',
  );
  assert.equal(utils.getCurrentValue({ type: 26 }, 'null', { type: 2 }), '');
  assert.equal(utils.getCurrentValue({ type: 29 }, '[null]', { type: 2 }), undefined);
  assert.deepEqual(helper.getAttachmentData({ value: 'null' }), []);
  assert.deepEqual(
    helper.getAttachmentData({ value: '{"attachments":{},"attachmentData":[null,{"originalFilename":"keep.txt"}]}' }),
    [{ originalFilename: 'keep.txt' }],
  );
  assert.equal(
    utils.checkValueByFilterRegex({ advancedSetting: { filterregex: '[null,{"value":4}]' } }, 'any'),
    undefined,
  );
  assert.equal(
    utils.checkValueByFilterRegex(
      {
        advancedSetting: {
          filterregex: '[{"value":"^ok$","err":"bad","filters":[{"isGroup":"yes","groupFilters":[]}]}]',
        },
      },
      'bad',
    ),
    undefined,
    'A malformed group flag cannot pass the declared boolean condition decoder',
  );
  assert.equal(helper.getOtherWorksheetFieldValue({ data: [], dataSource: undefined, sourceControlId: 'field' }), '');
  assert.equal(utils.handleDotAndRound({ type: 6, dot: 2 }, '1.2'), '1.20');
  assert.equal(boundaries.dateBoundaryValue({ date: '2026-10-01' }), null);
  assert.equal(boundaries.dateBoundaryValue('2026-10-01'), '2026-10-01');
  assert.equal(boundaries.dateBoundaryValue('2026-13-01'), null);
  assert.equal(boundaries.dateBoundaryValue('13:30:00', true), '13:30:00');
  assert.equal(boundaries.dateBoundaryValue('33:30:00', true), null);
  assert.equal(boundaries.eventLinkValue('https://example.test/path'), 'https://example.test/path');
  assert.equal(boundaries.eventLinkValue({ href: 'https://example.test' }), undefined);
  assert.equal(boundaries.eventLinkValue(['https://example.test']), undefined);
  assert.equal(boundaries.eventLinkValue(42), '42');
  console.log('form utilities malformed boundaries passed');
}
