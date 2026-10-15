const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync } = require('../../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
const root = path.resolve(__dirname, '../../../../../..');
const target = 'src/components/Form/MobileForm/components/ChildTable/utils.ts';
const translate = (text: string, ...args: unknown[]) =>
  text.replace(/%(\d+)/g, (_: string, i: string) => String(args[Number(i)]));

function invoke(module: object, name: string, args: unknown[]): unknown {
  const fn: unknown = Reflect.get(module, name);
  if (typeof fn !== 'function') throw new Error(name);
  return Reflect.apply(fn, undefined, args);
}

function load(
  source: string,
  imports: Record<string, unknown> = {},
  env: Record<string, unknown> = {},
): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const globals = { _l: translate, ...env };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected dependency: ' + name);
    },
    ...Object.values(globals),
  );
  return output.exports;
}

function selected(relative: string, names: string[]): string {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const item = ast.program.body.find(statement => {
        const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        return node?.type === 'FunctionDeclaration'
          ? node.id?.name === name
          : node?.type === 'VariableDeclaration' &&
              node.declarations.some(d => d.id.type === 'Identifier' && d.id.name === name);
      });
      assert.ok(item?.start != null && item.end != null, name);
      const raw = source.slice(item.start, item.end);
      return raw.startsWith('export ') ? raw : 'export ' + raw;
    })
    .join('\n');
}

const globalSource = fs.readFileSync(path.join(root, 'src/common/global.ts'), 'utf8');
const parserStart = globalSource.indexOf('window.safeParse =');
const parserEnd = globalSource.indexOf('\n};', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart);
const parserWindow: Record<string, unknown> = {};
new Function(
  'window',
  'console',
  transformSync(globalSource.slice(parserStart, parserEnd + 3), { filename: target }).code,
)(parserWindow, { error: () => {} });
const env = { safeParse: parserWindow['safeParse'], console: { log: () => {}, error: () => {} } };
const widget = load(selected('src/pages/widgetConfig/config/widget.ts', ['WIDGETS_TO_API_TYPE_ENUM']));
const config = load(
  fs.readFileSync(path.join(root, 'src/components/Form/core/config.ts'), 'utf8'),
  { lodash, moment },
  env,
);
const common = load(
  'import _ from "lodash";\n' + selected('src/utils/controlCommon.ts', ['NEW_RECORD_FROM', 'controlState']),
  { lodash },
);
const empty = load(selected('src/utils/control.ts', ['checkCellIsEmpty']));
const records = load(selected('src/utils/record.ts', ['filterEmptyChildTableRows']), {}, env);
const dataFormatSource = fs.readFileSync(path.join(root, 'src/components/Form/core/DataFormat.ts'), 'utf8');
const getterStart = dataFormatSource.indexOf('  getErrorControls() {');
const getterEnd = dataFormatSource.indexOf('\n  }', getterStart);
assert.ok(getterStart > 0 && getterEnd > getterStart);
interface Field {
  controlId?: string;
  value?: unknown;
  [key: string]: unknown;
}
interface FormError {
  controlId?: string;
  errorType?: string;
  errorMessage?: string;
}
interface RuleScenario {
  locked?: boolean;
  formErrors?: FormError[];
  ruleError?: { controlId: string; message: string };
  fail?: boolean;
}
const before = process.env['CHILD_TABLE_BEFORE_REV'];
const currentSource = fs.readFileSync(path.join(root, target), 'utf8');
const historicalSource = before
  ? cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' })
  : undefined;

function runtime(historical: boolean, scenario: RuleScenario = {}) {
  const events: unknown[] = [];
  const elements: { style: Record<string, string>; innerText: string; offsetWidth: number; appendChild: () => void }[] =
    [];
  let mounted = 0;
  let failMeasurement = false;
  const documentFixture = {
    body: {
      appendChild: () => {
        mounted++;
      },
      removeChild: () => {
        mounted--;
      },
    },
    createElement: () => {
      const element = {
        style: {},
        innerText: '',
        appendChild: () => {},
        get offsetWidth() {
          if (failMeasurement) throw new Error('Measurement failed');
          return this.innerText.length * 10;
        },
      };
      elements.push(element);
      return element;
    },
  };
  // Exercise the real error getter; validation outcomes are controlled so each collector branch is explicit.
  const DataFormat = new Function(
    'events',
    'scenario',
    'return class { constructor(options) { events.push(["format", options]); this.errorItems = scenario.formErrors || []; }' +
      dataFormatSource.slice(getterStart, getterEnd + 4) +
      '\n}',
  )(events, scenario);
  const ruleModule = load(fs.readFileSync(path.join(root, 'src/utils/rule.ts'), 'utf8'), {
    lodash,
    'src/components/Form/core/formUtils/rowRuleAdapter': {
      updateRulesDataOfRow: (props: {
        data: Field[];
        recordId?: string;
        checkRuleValidator: (...args: unknown[]) => void;
      }) => {
        events.push(['rules', props.recordId, structuredClone(props.data)]);
        if (scenario.fail) throw new Error('Rule evaluation failed');
        if (scenario.ruleError)
          props.checkRuleValidator(scenario.ruleError.controlId, 'RULE_ERROR', scenario.ruleError.message);
        return props.data;
      },
    },
  });
  const module = load(
    historical && historicalSource ? historicalSource : currentSource,
    {
      lodash,
      'src/components/Form/core/DataFormat': DataFormat,
      'src/pages/widgetConfig/config/widget': widget,
      'src/utils/control': { ...common, ...empty },
      'src/utils/record': records,
      'src/utils/rule': ruleModule,
      '../../../core/config': config,
      '../../../core/formUtils': {
        checkRuleLocked: (_rules: unknown, controls: Field[], rowid?: string) => {
          events.push(['locked', rowid, structuredClone(controls)]);
          return !!scenario.locked;
        },
        checkValueByFilterRegex: (_control: Field, value: unknown) => {
          events.push(['regex', value]);
          return 'Custom validation failed';
        },
      },
    },
    { ...env, document: documentFixture, alert: (...args: unknown[]) => events.push(['alert', ...args]) },
  );
  return {
    module,
    events,
    elements,
    get mounted() {
      return mounted;
    },
    set failMeasurement(value: boolean) {
      failMeasurement = value;
    },
  };
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

let checks = 0;

function compare(name: string, args: unknown[], scenario: RuleScenario = {}): unknown {
  const run = (historical: boolean) => {
    const r = runtime(historical, scenario);
    const inputs = structuredClone(args);
    freeze(inputs);
    const value = invoke(r.module, name, inputs);
    assert.deepEqual(inputs, args, 'Preserve input fields and values');
    assert.equal(r.mounted, 0, 'Remove the measurement wrapper');
    return { value, events: r.events };
  };

  const now = run(false);
  if (historicalSource) assert.deepEqual(now, run(true), name + ' historical output and callback ordering');
  checks++;
  return now.value;
}

const object = (value: unknown) => Object(value);

for (const kind of [19, 23, 24, 26, 27, 29, 35, 48]) {
  for (const values of [
    [],
    ['x'],
    [{ id: 'id' }, { accountId: 'account', id: 'secondary' }],
    ['{"id":"json"}', '{"accountId":"account"}'],
    [{ departmentId: 'dept' }, { organizeId: 'org' }, { rowid: 'row' }],
    [null, false, 0, 42, true, ''],
    ['{malformed'],
    [{ unknown: 'drop' }],
  ]) {
    compare('normalizeSDKFilterControls', [[{ controlId: 'c', dataType: kind, values }]]);
  }
}

for (const dataType of [2, 6, 15, 16])
  for (const filterType of [2, 17, 37]) {
    compare('normalizeSDKFilterControls', [
      [
        {
          controlId: 'c',
          dataType,
          filterType,
          dateRange: 18,
          dateRangeType: 3,
          minValue: '',
          maxValue: '',
          value: 'wire',
        },
      ],
    ]);
  }

for (const condition of [
  {},
  { values: null, dynamicSource: null, spliceType: 0 },
  { dataType: null, isGroup: null, value: { keep: true } },
]) {
  compare('normalizeSDKFilterControls', [[condition]]);
  compare('normalizeSDKFilterControls', [[{ isGroup: true, groupFilters: [condition], extra: 'keep' }]]);
}

for (const value of [null, undefined, []]) compare('normalizeSDKFilterControls', [value]);
const filters = compare('normalizeSDKFilterControls', [
  [
    {
      controlId: 'date',
      dataType: 16,
      filterType: 17,
      dateRange: 18,
      dateRangeType: 3,
      maxValue: '',
      minValue: '',
      future: 'omit',
    },
  ],
]);
const condition = object(filters)[0].groupFilters[0];
assert.equal(condition.filterType, 37);
assert.equal(condition.dateRangeType, 1);
assert.equal('maxValue' in condition, false);
assert.equal('future' in condition, false);
for (const value of [
  {},
  'invalid',
  [null],
  new Array(1),
  [{ dataType: 'bad' }],
  [{ values: {} }],
  [{ groupFilters: [null] }],
]) {
  assert.throws(() => invoke(runtime(false).module, 'normalizeSDKFilterControls', [value]), TypeError);
}

for (const length of [0, 1, 3, 5, 10, 17, 20, 100]) {
  const columns = [
    { controlId: 'text', controlName: 'Title', metadata: { keep: 1 } },
    { controlId: 'delete', width: 30 },
  ];
  const value = compare('addWidthToColumns', [columns, [{ rowid: 'row', text: 'x'.repeat(length) }]]);
  assert.equal(object(value)[0].width, Math.min(200, Math.max(80, Math.max(5, length) * 10 + 30)));
  assert.equal(object(value)[1].width, 30);
}

compare('addWidthToColumns', [[{}], []]);
const widthRuntime = runtime(false);
const deleteColumn = { controlId: 'delete', width: 30 };
const width = invoke(widthRuntime.module, 'addWidthToColumns', [[deleteColumn], []]);
assert.equal(object(width)[0], deleteColumn);
widthRuntime.failMeasurement = true;
assert.throws(() => invoke(widthRuntime.module, 'addWidthToColumns', [[{ controlId: 'c' }], []]), /Measurement failed/);
assert.equal(widthRuntime.mounted, 0, 'Cleanup when layout measurement fails');
for (const [type, id] of [
  [26, 'accountId'],
  [27, 'departmentId'],
  [29, 'sid'],
  [48, 'organizeId'],
] as const) {
  const controls = [{ controlId: 'c', type, unique: true }];
  const a = JSON.stringify([{ [id]: 'a' }, { [id]: 'b' }]);
  const b = JSON.stringify([{ [id]: 'b' }, { [id]: 'a' }]);
  const errors = compare('getSubListError', [
    {
      rows: [
        { rowid: 'r1', c: a },
        { rowid: 'r2', c: b },
      ],
      rules: [],
    },
    controls,
    ['c'],
  ]);
  assert.deepEqual(errors, { 'r1-c': '不允许重复', 'r2-c': '不允许重复' });
  compare('getSubListError', [
    {
      rows: [
        { rowid: 'r', c: a },
        { rowid: 'empty1', c: '' },
        { rowid: 'deleted', c: 'deleteRowIds[]' },
      ],
      rules: [],
    },
    controls,
    ['c'],
  ]);
}

for (const scenario of [
  {},
  { locked: true },
  { formErrors: [{ controlId: 'c', errorType: 'REQUIRED' }] },
  { formErrors: [{ controlId: 'c', errorType: 'CUSTOM' }] },
  { ruleError: { controlId: 'c', message: 'Rule error' } },
]) {
  compare(
    'getSubListError',
    [{ rows: [{ rowid: 'r', c: '' }], rules: [] }, [{ controlId: 'c', type: 2, controlName: 'Text' }], ['c'], 3, {}],
    scenario,
  );
}

compare('getSubListError', [
  { rows: [{ rowid: 'r', c: 'value' }], rules: [] },
  [{ controlId: 'c', fieldPermission: '000' }],
  ['c'],
]);
const numbers = runtime(false);
const numberErrors = invoke(numbers.module, 'getSubListError', [
  {
    rows: [
      { rowid: 'a', c: 1 },
      { rowid: 'b', c: '1' },
      { rowid: 'c', c: 1 },
    ],
    rules: [],
  },
  [{ controlId: 'c', type: 6, unique: true }],
  ['c'],
]);
assert.deepEqual(
  numberErrors,
  { 'a-c': '不允许重复', 'c-c': '不允许重复' },
  'Numeric values retain identity and comparison type',
);
const failed = runtime(false, { fail: true });
assert.throws(
  () => invoke(failed.module, 'getSubListError', [{ rows: [{ rowid: 'r' }], rules: [] }, [], []]),
  /Rule evaluation failed/,
);
assert.ok(
  failed.events.some(e => Array.isArray(e) && e[0] === 'alert'),
  'Synchronous validation failure reaches the caller',
);
console.log(
  `Mobile child table SDK, width, rules and unique values passed (${checks} cases${historicalSource ? ' with historical comparison' : ''}); malformed SDK and numeric/error boundaries passed`,
);
