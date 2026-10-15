import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
const React: typeof import('react') = require('react');
const root = path.resolve(__dirname, '../../../../..');
const target = 'src/pages/FormSet/components/columnRules/config.ts';
const beforeRev = process.env['COLUMN_RULE_BEFORE_REV'];
const source = (relative: string, historical = false): string =>
  historical && beforeRev
    ? cp.execFileSync('git', ['show', beforeRev + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture object');
  return value[key];
}

function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing method ' + key);
  return Reflect.apply(fn, value, args);
}

function selected(relative: string, names: string[]): string {
  const text = source(relative);
  const parsed = harness.parser.parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const node = parsed.program.body.find(statement => {
        const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        return d?.type === 'FunctionDeclaration'
          ? d.id?.name === name && !!d.body
          : d?.type === 'VariableDeclaration' &&
              d.declarations.some(v => v.id.type === 'Identifier' && v.id.name === name);
      });
      assert.ok(node?.start != null && node.end != null, name);
      const raw = text.slice(node.start, node.end);
      return raw.startsWith('export ') ? raw : 'export ' + raw;
    })
    .join('\n');
}

const globals = source('src/common/global.ts');
const globalWindow: Record<string, unknown> = {};

for (const name of ['_l', 'safeParse']) {
  const begin = globals.indexOf('window.' + name + ' =');
  const end = globals.indexOf('\n};', begin);
  assert.ok(begin >= 0 && end > begin);
  new Function('window', 'console', harness.transformSync(globals.slice(begin, end + 3), { filename: target }).code)(
    globalWindow,
    { error: () => {} },
  );
}

const alerts: unknown[][] = [];
const dom: string[] = [];

function jquery(selector: string) {
  let text = '';
  const node = {
    0: { getBoundingClientRect: () => ({ width: text.length * 7.2 }) },
    text(value: string) {
      text = value;
      return node;
    },
    css() {
      return node;
    },
    append() {
      dom.push(selector);
      return node;
    },
    remove() {
      dom.push('remove');
    },
  };
  return node;
}

function load(text: string, dependencies: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const env = {
    _l: globalWindow['_l'],
    safeParse: globalWindow['safeParse'],
    $: jquery,
    alert: (...args: unknown[]) => alerts.push(args),
    console: { log: () => {}, error: () => {} },
    ...extra,
  };
  const code = harness.transformSync(text, {
    filename: target + 'x',
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (['lodash', 'moment', 'react', 'react/jsx-runtime'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(env),
  );
  return module.exports;
}

const widget = load(
  selected('src/pages/widgetConfig/config/widget.ts', [
    'WIDGETS_TO_API_TYPE_ENUM',
    'ROW_ID_CONTROL',
    'SYSTEM_DATE_CONTROL',
    'SYSTEM_CONTROL',
    'WORKFLOW_SYSTEM_CONTROL',
    'SYS',
    'ALL_SYS',
    'NORMAL_CONTROLS',
    'SYS_CONTROLS',
  ]),
);
const advanced = load(source('src/utils/advancedSettingBoundary.ts'));
const common = load(
  'import _, {get} from "lodash";\n' +
    selected('src/utils/controlCommon.ts', ['getAdvanceSetting', 'getDatePickerConfigs']),
  {},
  advanced,
);
const defaults = load(selected('src/components/Form/core/enum.ts', ['DEFAULT_TEXT']));
const switchNames = load(selected('src/utils/control.ts', ['getSwitchItemNames']), {}, { ...common, ...defaults });
const widgetUtils = load(
  'import _, {includes,get} from "lodash";\n' +
    selected('src/pages/widgetConfig/util/index.ts', ['isSheetDisplay', 'isCustomWidget']),
);
// Icon lookup is a controlled dependency; OCR whitelist behavior belongs to the target itself.
widgetUtils['getIconByType'] = (type: unknown) => 'fixture-icon-' + String(type);
const names = load('import _ from "lodash";\n' + selected('src/utils/common.ts', ['getUnUniqName']));
const enums = load(source('src/pages/worksheet/common/WorkSheetFilter/enum.ts'));
const filterBoundary = load(source('src/pages/worksheet/common/WorkSheetFilter/filterModelBoundary.ts'));
const filterUtils = load(source('src/pages/worksheet/common/WorkSheetFilter/util.ts'), {
  'src/pages/widgetConfig/config/widget': widget,
  'src/pages/widgetConfig/util/setting.js': common,
  'src/utils/common': {},
  'src/utils/control': {},
  'src/utils/project': {},
  'src/utils/subListStoreTypes': {},
  './enum': enums,
  './filterModelBoundary': filterBoundary,
});
const imports = {
  'pages/widgetConfig/config/widget': widget,
  uuid: { v4: () => 'fixture-rule-uuid' },
  'src/pages/widgetConfig/util': widgetUtils,
  'src/pages/widgetConfig/util/setting': common,
  'src/pages/worksheet/common/WorkSheetFilter/enum.js': enums,
  'src/pages/worksheet/common/WorkSheetFilter/util.js': filterUtils,
  'src/utils/common': names,
  'src/utils/control': switchNames,
};
const current = load(source(target), imports);
const previous = beforeRev ? load(source(target, true), imports) : undefined;
let cases = 0;

function run(module: unknown, name: string, input: unknown[]) {
  const args = lodash.cloneDeep(input);
  alerts.length = 0;
  dom.length = 0;
  const value = invoke(module, name, args);
  return { value, args, alerts: lodash.cloneDeep(alerts), dom: [...dom] };
}

function compare(name: string, input: unknown[], expected?: unknown) {
  const actual = run(current, name, input);
  if (previous) assert.deepEqual(actual, run(previous, name, input), name + ' historical case ' + cases);
  if (arguments.length > 2) assert.deepEqual(actual.value, expected, name);
  cases++;
  return actual.value;
}

const controls = [
  { controlId: 'text', controlName: '名称', type: 2 },
  { controlId: 'num', controlName: '金额', type: 6 },
  {
    controlId: 'options',
    controlName: '状态',
    type: 9,
    options: [
      { key: 'a', value: '有效' },
      { key: 'b', value: '删除', isDeleted: true },
    ],
  },
  { controlId: 'date', controlName: '日期', type: 15, advancedSetting: { showtype: '3' } },
  { controlId: 'person', controlName: '人员', type: 26, enumDefault: 1 },
  {
    controlId: 'sub',
    controlName: '子表',
    type: 34,
    showControls: ['child'],
    relationControls: [
      { controlId: 'child', controlName: '明细', type: 2 },
      { controlId: 'hidden', type: 2 },
      { controlId: 'ctime', type: 16 },
    ],
  },
  {
    controlId: 'rel',
    controlName: '关联',
    type: 29,
    advancedSetting: { showtype: '2' },
    relationControls: [{ controlId: 'rchild', type: 6 }],
    showControls: ['rchild'],
  },
  { controlId: 'formula', type: 31 },
  { controlId: 'custom', type: 54 },
  { controlId: 'ownerid', type: 26 },
];
const section = [
  { controlId: 'section', type: 52, controlName: '标签' },
  { controlId: 'nested', type: 2, controlName: '标签字段', sectionId: 'section' },
];

for (const action of [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, undefined]) {
  for (const tree of [controls, [...controls, ...section], []]) {
    compare('getNewDropDownData', [tree, action]);
    compare('getTextById', [
      tree,
      [
        { controlId: 'text' },
        { controlId: 'sub', childControlIds: ['child', 'deleted'] },
        { controlId: 'gone' },
        { controlId: 'nested' },
      ],
      action,
      'rule',
    ]);
    compare('filterUnAvailable', [
      {
        type: action,
        message: 'keep',
        controls: [
          { controlId: 'sub', permission: 3, isCustom: true, childControlIds: ['child', 'gone'] },
          { controlId: 'nested' },
          { controlId: 'gone' },
        ],
      },
      tree,
      action,
    ]);
  }

  compare('getActionLabelByType', [action]);
  for (const from of ['rule', 'event'])
    for (const selected of [[], [{ controlId: 'sub' }], [{ controlId: 'sub', childControlIds: ['child'] }]]) {
      compare('showTableSetting', [controls[5], selected, action, from]);
      compare('showArrowSetting', [controls[5], selected, action, from]);
    }
}

compare('getReTree', [controls]);
compare('deepSearch', [controls, 'child']);
compare('deepSearch', [controls, 'missing'], null);
const duplicate = [
  { controlId: 'same', controlName: 'first' },
  { controlId: 'same', controlName: 'last' },
];
assert.equal(read(invoke(current, 'deepSearch', [duplicate, 'same']), 'controlName'), 'last');
for (const type of [2, 6, 9, 10, 11, 15, 16, 19, 23, 24, 26, 27, 28, 29, 35, 36, 46, 48, 999]) {
  for (const condition of [
    {},
    { values: [] },
    { value: '', values: ['a'] },
    { value: '0', values: ['a'], minValue: 0, maxValue: 2 },
    { isDynamicsource: true, dynamicSource: [] },
    { isDynamicsource: true, dynamicSource: [{ cid: 'text', rcid: 'parent' }] },
  ])
    compare('checkConditionError', [{ dataType: type, filterType: 1, ...condition }]);
}

const F = read(enums, 'FILTER_CONDITION_TYPE');
for (const group of [
  [],
  [{ dataType: 2, filterType: read(F, 'EQ'), values: ['abc'] }],
  [{ isGroup: true, groupFilters: [] }],
  [{ isGroup: true, groupFilters: [{ dataType: 6, filterType: read(F, 'BETWEEN'), minValue: '1', maxValue: '9' }] }],
])
  compare('checkConditionCanSave', [group]);
for (const type of [26, 27, 29, 19, 23, 24, 35, 48, 2]) {
  const c = {
    controlId: 'x',
    dataType: type,
    filterType: 1,
    spliceType: 2,
    minValue: '',
    values: ['{"id":"u","name":"用户"}', 'raw', { id: 'object' }],
    metadata: 'retain',
  };
  compare('formatFilterValue', [c]);
  compare('formatValues', [[{ isGroup: true, spliceType: 2, extra: 'keep', groupFilters: [c] }]]);
}

compare('filterDeleteOptions', [
  [
    { controlId: 'options', dataType: 9, values: ['a', 'b', 'gone'] },
    { controlId: 'num', dataType: 6, value: 0 },
  ],
  controls,
]);
for (const type of [15, 16])
  for (const range of [1, 2, 3, 4, 7, 10, 11, 101, 102, 18, 21, 33]) {
    const c = {
      controlId: 'date',
      dataType: type,
      filterType: 17,
      dateRange: range,
      dateRangeType: 3,
      value: '2026-10-15',
    };
    compare('filterText', [4, c, controls[3]]);
  }

for (const [key, c, control] of [
  [2, { filterType: read(F, 'BETWEEN'), minValue: 0, maxValue: 10 }, controls[1]],
  [4, { minValue: '2026-10-01', maxValue: '2026-10-15' }, controls[3]],
  [10, { value: '12:34:56' }, { type: 46, unit: '2' }],
  [10, { minValue: '12:30', maxValue: '14:30' }, { type: 46, unit: '1' }],
  [3, { filterType: read(F, 'EQ') }, { type: 36, advancedSetting: { showtype: '2' } }],
  [5, { dataType: 9, values: ['a', 'b', 'gone'] }, controls[2]],
  [5, { dataType: 9, values: ['a'] }, { data: { options: [{ key: 'a', value: 'wrapped' }] } }],
  [5, { dataType: 27, values: ['{"id":"a","name":"部门"}'] }, {}],
  [6, { values: ['{"id":"a","name":"用户"}'] }, {}],
  [7, { values: ['{"id":"a","name":"记录"}'] }, {}],
  [8, { values: ['{"id":"a","name":"级联"}'] }, {}],
  [99, { values: ['a', 'b'] }, {}],
])
  compare('filterText', [key, c, control]);
compare('filterDataRelationText', [[], controls], '');
compare('filterDataRelationText', [
  [{ cid: 'text' }, { cid: 'missing', rcid: 'parent' }, { cid: 'num', rcid: 'url' }, {}],
  controls,
]);
const conditions = [
  { controlId: 'text', dataType: 2, filterType: 1, values: ['ABC'] },
  { controlId: 'person', dataType: 26, filterType: read(F, 'EQ_FOR_SINGLE'), values: ['{"id":"u","name":"用户"}'] },
  { controlId: 'num', dataType: 6, filterType: 11, minValue: '1', maxValue: '9' },
  { controlId: 'gone', dataType: 2, filterType: 1, values: ['x'] },
];
for (const setting of [false, true])
  for (const filters of [
    conditions,
    [{ isGroup: true, spliceType: 1, groupFilters: conditions }],
    [{ isGroup: true, groupFilters: [] }],
  ])
    compare('filterData', [controls, filters, setting, controls]);
compare('filterData', [[{ data: { controlId: 'text', controlName: '包装字段', type: 2 } }], conditions]);
compare('filterData', [
  controls,
  [{ controlId: 'text', dataType: 2, filterType: 1, dynamicSource: [{ cid: 'num', rcid: 'parent' }] }],
  true,
  controls,
]);
for (const tree of [[], controls, [...controls, ...section]]) {
  compare('getErrorControls', [tree]);
  compare('getStyleRuleControls', [tree]);
}

for (const tab of [0, 1, 2, 3])
  compare('getDefaultRuleName', [
    [
      { type: tab, name: '交互 规则 1' },
      { type: tab, name: '交互 规则 2' },
    ],
    tab,
  ]);
for (const action of [
  {},
  { type: 7 },
  { type: 6, message: '' },
  { type: 6, message: '错误' },
  { type: 1, controls: [] },
  { type: 9, controls: [{ controlId: 'text', value: '{"field":"value"}' }] },
])
  compare('getActionError', [action]);
for (const rule of [{}, { ruleId: 'new-id' }, { ruleId: 'saved', name: '旧名' }, { ruleId: 'saved', name: '新名' }])
  for (const silent of [false, true]) compare('hasRuleChanged', [[{ ruleId: 'saved', name: '旧名' }], rule, silent]);
for (const count of [0, 99, 100, 101])
  compare('checkRuleEnableLimit', [
    Array.from({ length: count }, () => ({ disabled: false })).concat({ disabled: true }),
  ]);
for (const control of [
  { type: 43, enumDefault: 1 },
  { type: 43, enumDefault: 2 },
  { type: 43, enumDefault: 3 },
  { type: 43 },
  { type: 2 },
])
  compare('getNewIconByType', [control]);
compare('getNameWidth', ['业务规则'], 34);
// Deleted field styling must follow the actual isDel flag returned by getTextById.
const dropSource = source('src/pages/FormSet/components/columnRules/actionDropdown/ActionDropDown.tsx');
const dropAst = harness.parser.parse(dropSource, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const declaration = dropAst.program.body.find(n => n.type === 'ExportDefaultDeclaration');
assert.ok(declaration?.type === 'ExportDefaultDeclaration' && declaration.declaration.type === 'ClassDeclaration');
const method = declaration.declaration.body.body.find(
  n => n.type === 'ClassMethod' && n.key.type === 'Identifier' && n.key.name === 'getTextByValue',
);
assert.ok(method?.start != null && method.end != null);
const fixture = load(
  'import {Fragment} from "react"; import cx from "classnames"; import _ from "lodash";\nexport class Fixture { constructor(props){this.props=props;}\n' +
    dropSource.slice(method.start, method.end) +
    '\n}',
  { classnames: require('classnames') },
  { ...current, Tooltip: () => null },
);
const ctor = fixture['Fixture'];
assert.equal(typeof ctor, 'function');
if (typeof ctor !== 'function') throw new Error('Missing actual method fixture');
const instance: unknown = Reflect.construct(ctor, [
  { values: [{ controlId: 'gone' }], dropDownData: [], actionType: 1 },
]);

function walk(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!React.isValidElement(value)) return [];
  return [value, ...walk(read(value.props, 'children'))];
}

assert.ok(
  walk(invoke(instance, 'getTextByValue')).some(node =>
    String(read(read(node, 'props'), 'className')).includes('disabled'),
  ),
);
assert.throws(() => invoke(current, 'filterText', [4, { dateRange: 999 }, {}]), TypeError);
assert.throws(() => invoke(current, 'filterDeleteOptions', [[{ dataType: 9 }], []]), TypeError);
assert.throws(
  () => invoke(current, 'formatValues', [[{ groupFilters: [{ dataType: 26, values: ['null'] }] }]]),
  TypeError,
);

for (const mode of ['1', '2'])
  compare('getTextById', [controls, [{ controlId: 'text', type: mode, value: '{"field":"value"}' }], 9, 'rule']);
for (const value of [true, false]) compare('filterText', [10, { value }, { type: 46, unit: '1' }]);
// Execute the actual Select callback against action state, including clearing dependent fields.
function selectHandler(historical: boolean, type: unknown) {
  const file = source('src/pages/FormSet/components/columnRules/EditBox.tsx', historical);
  const ast = harness.parser.parse(file, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let callback: string | undefined;

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!object(value)) return;
    if (
      value['type'] === 'ArrowFunctionExpression' &&
      typeof value['start'] === 'number' &&
      typeof value['end'] === 'number'
    ) {
      const raw = file.slice(value['start'], value['end']);
      if (raw.includes('currentActionData.type = type') && !raw.includes('<Select')) callback = raw;
    }

    Object.values(value).forEach(visit);
  }

  visit(ast.program);
  assert.ok(callback);
  const items = [{ type: 1, message: '提示', controls: [{ controlId: 'text' }], extra: 'keep' }];
  const updates: unknown[] = [];
  const handler = load(
    'export const select = ' + callback,
    {},
    {
      ...current,
      _: lodash,
      ruleItems: items,
      actionIndex: 0,
      worksheetControls: controls,
      updateSelectRule: (...args: unknown[]) => updates.push(lodash.cloneDeep(args)),
    },
  );
  invoke(handler, 'select', [type]);
  return { items, updates };
}

for (const type of [1, 2, 3, 4, 5, 7, 9]) {
  const actual = selectHandler(false, type);
  if (previous) assert.deepEqual(actual, selectHandler(true, type));
  assert.equal(actual.updates.length, 1);
}

assert.equal(selectHandler(false, 'invalid').updates.length, 0);

console.log(
  `Column rules helpers passed (${cases} cases${previous ? ' with historical comparison' : ''}); actual deleted-field render and invalid boundaries passed`,
);
