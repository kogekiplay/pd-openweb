const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const root = process.env.QUICK_FILTER_REPO || '/Users/kogeki/dev/pd-openweb-dnd';
const localRequire = createRequire(path.join(root, 'package.json'));
const { transformFileSync, transformSync } = localRequire('./scripts/spec-harness.ts');
const parser = localRequire('@babel/parser');

interface TestCondition {
  controlId?: string;
  dataType?: number;
  filterType?: number;
  originalFilterType?: number;
  dateType?: number;
  dateRange?: number;
  dateRangeType?: number;
  value?: number | string;
  values?: string[];
  minValue?: number | string;
  maxValue?: number | string;
  advancedSetting?: { daterange?: string };
  dynamicSource?: { cid?: string; rcid?: string; staticValue?: string }[];
  metadata?: { name: string };
}
interface TestControl {
  controlId: string;
  type: number;
  sourceControlType?: number;
  enumDefault2?: number;
  options?: { key: string; value: string }[];
}
interface FilterModule {
  formatFilterValues(controlType: number, values?: string[]): unknown[];
  formatFilterValuesToServer(controlType: number, values?: unknown[]): string[];
  handleConditionsDefault(conditions: unknown[], controls: TestControl[]): TestCondition[];
}
const WIDGETS_TO_API_TYPE_ENUM = {
  USER_PICKER: 26,
  ORG_ROLE: 48,
  DEPARTMENT: 27,
  AREA_PROVINCE: 19,
  AREA_CITY: 23,
  AREA_COUNTY: 24,
  RELATE_SHEET: 29,
  CASCADER: 35,
  TEXT: 2,
  RICH_TEXT: 41,
  EMAIL: 5,
  MOBILE_PHONE: 3,
  CRED: 7,
  NUMBER: 6,
  MONEY: 8,
  FLAT_MENU: 9,
  MULTI_SELECT: 10,
  DROP_DOWN: 11,
  DATE: 15,
  DATE_TIME: 16,
  TIME: 46,
  SWITCH: 36,
  SHEET_FIELD: 30,
  SUBTOTAL: 37,
  SEARCH: 50,
  FORMULA_FUNC: 53,
};
const FILTER_CONDITION_TYPE = {
  BETWEEN: 11,
  DATE_BETWEEN: 31,
  DATEENUM: 17,
  NE: 6,
  EQ: 2,
};
const DATE_RANGE_TYPE = { MINUTE: 1, HOUR: 2, DAY: 3 };
let query: Record<string, string | string[] | null> = {};
const safeParse = (value: string, defaultValue: unknown = {}): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue === 'array' ? [] : defaultValue;
  }
};
function requireEsm(file: string, stubs: Record<string, unknown> = {}): unknown {
  const target: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(file, {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'safeParse', code)(
    target,
    target.exports,
    (request: string) => (Object.hasOwn(stubs, request) ? stubs[request] : localRequire(request)),
    safeParse,
  );
  return target.exports;
}
// Load the actual normalization/validation functions without importing unrelated UI dependencies.
const utilityFile = path.join(root, 'src/pages/worksheet/common/WorkSheetFilter/util.ts');
const utilitySource = fs.readFileSync(utilityFile, 'utf8');
const ast = parser.parse(utilitySource, {
  sourceType: 'module',
  plugins: ['typescript'],
});
const functionNames = ['redefineComplexControl', 'getType', 'validate'];
const functionSource = ast.program.body
  .filter(
    (node: { type: string; declaration?: { id?: { name?: string } } }) =>
      node.type === 'ExportNamedDeclaration' && functionNames.includes(node.declaration?.id?.name || ''),
  )
  .map((node: { declaration: { start: number; end: number } }) =>
    utilitySource.slice(node.declaration.start, node.declaration.end),
  )
  .join('\n');
const utilityCode = transformSync(functionSource, {
  filename: utilityFile,
  babelrc: false,
  plugins: [],
}).code;
const actualUtilities = new Function(
  '_',
  'WIDGETS_TO_API_TYPE_ENUM',
  'FILTER_CONDITION_TYPE',
  utilityCode + ';return { redefineComplexControl, getType, validate };',
)(localRequire('lodash'), WIDGETS_TO_API_TYPE_ENUM, FILTER_CONDITION_TYPE);
const source =
  process.env.QUICK_FILTER_SOURCE || path.join(root, 'src/pages/worksheet/common/Sheet/QuickFilter/utils.ts');
const sourceDir = path.dirname(source);
const boundaries = requireEsm(path.join(sourceDir, 'boundaries.ts'));
const { formatFilterValues, formatFilterValuesToServer, handleConditionsDefault } = requireEsm(source, {
  'pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM },
  'worksheet/common/WorkSheetFilter/enum': {
    DATE_RANGE_TYPE,
    FILTER_CONDITION_TYPE,
  },
  'src/pages/worksheet/common/WorkSheetFilter/util': actualUtilities,
  'src/utils/common': { getRequest: () => query },
  './boundaries': boundaries,
}) as FilterModule;

const referenceSource = process.env.QUICK_FILTER_REFERENCE;
const reference = referenceSource
  ? (requireEsm(referenceSource, {
      'pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM },
      'worksheet/common/WorkSheetFilter/enum': { DATE_RANGE_TYPE, FILTER_CONDITION_TYPE },
      'src/pages/worksheet/common/WorkSheetFilter/util': actualUtilities,
      'src/utils/common': { getRequest: () => query },
    }) as FilterModule)
  : undefined;

const valueCases: [number, string, Record<string, unknown>][] = [
  [
    26,
    '{"id":"account-1","name":"张三","avatar":"avatar.png"}',
    { accountId: 'account-1', fullname: '张三', avatar: 'avatar.png' },
  ],
  [48, '{"id":"role-1","name":"经理"}', { organizeId: 'role-1', organizeName: '经理' }],
  [27, '{"id":"department-1","name":"开发部"}', { departmentId: 'department-1', departmentName: '开发部' }],
  [19, '{"id":"province-1","name":"安徽"}', { id: 'province-1', name: '安徽' }],
  [23, '{"id":"city-1","name":"合肥"}', { id: 'city-1', name: '合肥' }],
  [24, '{"id":"county-1","name":"蜀山"}', { id: 'county-1', name: '蜀山' }],
  [29, '{"id":"row-1","name":"记录一"}', { rowid: 'row-1', name: '记录一' }],
  [35, '{"id":"child-1","name":"级联一"}', { rowid: 'child-1', name: '级联一' }],
];
for (const [type, serialized, expected] of valueCases) {
  assert.deepEqual(formatFilterValues(type, [serialized]), [expected]);
  if (reference) {
    assert.deepEqual(
      formatFilterValues(type, [serialized, 'raw-id']),
      reference.formatFilterValues(type, [serialized, 'raw-id']),
    );
    assert.deepEqual(
      formatFilterValuesToServer(type, [expected, null, undefined]),
      reference.formatFilterValuesToServer(type, [expected, null, undefined]),
    );
  }
  assert.deepEqual(formatFilterValuesToServer(type, [expected, null, undefined]), [JSON.parse(serialized).id]);
  const rawIdValues = formatFilterValues(type, ['raw-id']);
  assert.deepEqual(formatFilterValuesToServer(type, rawIdValues), ['raw-id']);
}
const plain = ['文本', ''];
assert.equal(formatFilterValues(2, plain), plain, 'Plain string defaults retain the same array instance');
assert.deepEqual(formatFilterValuesToServer(2, ['文本', 123, undefined, '', false, null]), ['文本']);
assert.deepEqual(formatFilterValues(26), []);
assert.deepEqual(formatFilterValuesToServer(26), []);
assert.deepEqual(
  formatFilterValuesToServer(26, [{ accountId: 'account-1' }, {}, { accountId: 1 }, null]),
  ['account-1'],
  'Unidentified/non-string selections must not send undefined IDs',
);
assert.deepEqual(formatFilterValues(26, ['{"id":123,"name":false,"avatar":[]}']), [
  { accountId: undefined, fullname: undefined, avatar: undefined },
]);

function dynamicCondition(
  type: number,
  input: string,
  condition: TestCondition = {},
  controlChanges: Partial<TestControl> = {},
): TestCondition {
  query = { default: input };
  const source = {
    controlId: 'field',
    dataType: type,
    values: [],
    dynamicSource: [{ rcid: 'url', cid: 'default', staticValue: '' }],
    ...condition,
  };
  const controls = [{ controlId: 'field', type, ...controlChanges }];
  const result = handleConditionsDefault([source], controls)[0];
  assert.ok(result);
  if (reference) assert.deepEqual(result, reference.handleConditionsDefault([source], controls)[0]);
  assert.deepEqual(source.values, [], 'Default parsing must not mutate saved configuration');
  return result;
}
for (const type of [2, 41, 5, 3, 7]) assert.deepEqual(dynamicCondition(type, '动态中文值').values, ['动态中文值']);
assert.equal(dynamicCondition(6, '12.5').value, 12.5);
assert.equal(dynamicCondition(8, '2', { filterType: 2 }).value, 2);
assert.deepEqual(
  [dynamicCondition(6, '1-3', { filterType: 11 }).minValue, dynamicCondition(6, '1-3', { filterType: 11 }).maxValue],
  [1, 3],
);
assert.equal(dynamicCondition(6, 'not-a-number').value, undefined);
for (const type of [9, 10, 11])
  assert.deepEqual(
    dynamicCondition(
      type,
      '第一,未配置,第二',
      {},
      {
        options: [
          { key: 'first', value: '第一' },
          { key: 'second', value: '第二' },
        ],
      },
    ).values,
    ['first', 'second'],
  );
assert.equal(dynamicCondition(15, '2026-10-09 13:42:53', { dateRangeType: 1 }).value, '2026-10-09 13:42');
assert.equal(dynamicCondition(16, '2026-10-09 13:42:53', { dateRangeType: 2 }).value, '2026-10-09 13');
assert.equal(dynamicCondition(15, '2026-10-09 13:42:53', { dateRangeType: 3 }).value, '2026-10-09');
assert.equal(dynamicCondition(15, '2026-10-09').dateRange, 18);
assert.equal(dynamicCondition(15, '2026-10-09').dateType, 15);
const times = dynamicCondition(46, '01:02:03-04:05:06');
assert.deepEqual([times.minValue, times.maxValue, times.filterType, times.dateRange], ['01:02:03', '04:05:06', 31, 18]);
for (const input of ['true', '1']) assert.equal(dynamicCondition(36, input).filterType, 2);
for (const input of ['false', '0']) assert.equal(dynamicCondition(36, input).filterType, 6);
assert.equal(dynamicCondition(36, 'invalid').filterType, 0);
assert.equal(
  dynamicCondition(30, '42', {}, { sourceControlType: 6 }).value,
  42,
  'The actual complex-control normalizer must decide the URL value format',
);
const saved: TestCondition = {
  controlId: 'date',
  dataType: 15,
  filterType: 31,
  dateRange: 3,
  values: [],
  metadata: { name: 'kept' },
};
const dateDefault = handleConditionsDefault([saved], [{ controlId: 'date', type: 15 }])[0];
assert.deepEqual([dateDefault?.originalFilterType, dateDefault?.filterType], [31, 17]);
assert.equal(dateDefault?.metadata, saved.metadata, 'Unknown condition metadata is retained without deep mutation');
assert.equal(saved.filterType, 31);
assert.equal(
  handleConditionsDefault([{ ...saved, advancedSetting: { daterange: '[]' } }], [{ controlId: 'date', type: 15 }])[0]
    ?.filterType,
  31,
);
assert.equal(
  handleConditionsDefault([{ controlId: 'text', values: ['isEmpty'] }], [{ controlId: 'text', type: 2 }])[0]
    ?.filterType,
  7,
);
assert.equal(
  handleConditionsDefault([{ controlId: 'switch' }], [{ controlId: 'switch', type: 36 }])[0]?.value,
  1,
  'Default-less switches must not crash while inspecting missing values',
);
assert.deepEqual(handleConditionsDefault([null, [], 'bad', { values: [123] }, { dataType: '26' }], []), []);
query = { default: ['first', 'second'] };
assert.deepEqual(
  handleConditionsDefault(
    [
      {
        controlId: 'text',
        values: [],
        dynamicSource: [{ rcid: 'url', cid: 'default' }],
      },
    ],
    [{ controlId: 'text', type: 2 }],
  )[0]?.values,
  [],
  'Repeated URL params must not call split on an array',
);
assert.deepEqual(handleConditionsDefault([{ controlId: 'missing', dataType: 2, values: ['kept'] }], []), [
  { controlId: 'missing', dataType: 2, values: ['kept'] },
]);
console.log(
  'QuickFilter actual helper typed values, unknown boundaries, URL defaults, dates and complex controls passed',
);
