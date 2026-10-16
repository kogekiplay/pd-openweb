import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const lodash: typeof import('lodash') = require('lodash');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/Statistics/common/reportConfigUtils.ts';
const historicalRev = process.env['REPORT_CONFIG_BEFORE_REV'];

function readSource(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!record(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}

function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing actual method ' + key);
  return Reflect.apply(fn, value, args);
}

const runtime: Record<string, unknown> = {};
const globalSource = readSource('src/common/global.ts');
const start = globalSource.indexOf('window._l =');
const end = globalSource.indexOf('\n};', start);
assert.ok(start >= 0 && end > start);
new Function('window', harness.transformSync(globalSource.slice(start, end + 3), { filename: target }).code)(runtime);
function load(text: string, imports: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const env = { _l: runtime['_l'], ...extra };
  const code = harness.transformSync(text, {
    filename: target,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['lodash', '@ctrl/tinycolor'].includes(name) || name.startsWith('@babel/runtime/')) return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(env),
  );
  return module.exports;
}

function declarations(relative: string, names: string[]): string {
  const source = readSource(relative);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const statement = ast.program.body.find(s => {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        return d?.type === 'FunctionDeclaration'
          ? d.id?.name === name && !!d.body
          : d?.type === 'VariableDeclaration' &&
              d.declarations.some(v => v.id.type === 'Identifier' && v.id.name === name);
      });
      assert.ok(statement?.start != null && statement.end != null, name);
      const raw = source.slice(statement.start, statement.end);
      return raw.startsWith('export ') ? raw : 'export ' + raw;
    })
    .join('\n');
}

const widget = load(declarations('src/pages/widgetConfig/config/widget.ts', ['WIDGETS_TO_API_TYPE_ENUM']));
const types = load(readSource('src/pages/Statistics/Charts/reportTypes.ts'));
const enums = load(
  declarations('src/pages/Statistics/enum.ts', ['normTypes', 'defaultNumberChartStyle', 'defaultPivotTableStyle']),
);
const time = load(declarations('src/pages/Statistics/common/timeUtils.ts', ['defaultDropdownScopeData']));
const control = load(readSource('src/pages/Statistics/common/controlUtils.ts'), {
  'src/pages/widgetConfig/config/widget': widget,
});
const colorValue = load('import _ from "lodash";\n' + declarations('src/utils/controlCommon.ts', ['getColorValue']));
const colorControl = load(
  'import {TinyColor} from "@ctrl/tinycolor";\n' + declarations('src/utils/control.ts', ['isLightColor']),
  {},
  colorValue,
);
const sysColor = load(declarations('src/pages/Admin/settings/config.ts', ['SYS_COLOR']));
const color = load(
  'import _ from "lodash";\n' + declarations('src/pages/customPage/util.ts', ['isLightColor']),
  {},
  { ...sysColor, utilsIsLightColor: colorControl['isLightColor'] },
);
let measurementFailure = false;
let highlightPresent = true;
const domEvents: unknown[][] = [];
const handlers = new Map<string, unknown>();
const highlight = {};
class Span {
  style: Record<string, string> = {};
  private text = '';
  get innerText(): string {
    return this.text;
  }
  set innerText(value: unknown) {
    this.text = String(value);
  }
  getBoundingClientRect() {
    if (measurementFailure) throw new Error('measure failed');
    return { width: [...this.innerText].length * 7, height: 14 };
  }
}
const measuredChildren: unknown[] = [];
const node = {
  clientWidth: 160,
  parentHeight: 180,
  children: measuredChildren,
  appendChild(child: unknown) {
    this.children.push(child);
    domEvents.push(['append']);
  },
  removeChild(child: unknown) {
    this.children.splice(this.children.indexOf(child), 1);
    domEvents.push(['remove']);
  },
};

function jquery(value: unknown) {
  const present = value != null;
  return {
    parent: () => ({ height: () => node.parentHeight }),
    addClass: (name: string) => {
      if (present) domEvents.push(['addClass', name]);
      return jquery(value);
    },
    removeClass: (name: string) => {
      if (present) domEvents.push(['removeClass', name]);
      return jquery(value);
    },
    on: (name: string, callback: unknown) => {
      if (present) {
        handlers.set(name, callback);
        domEvents.push(['on', name]);
      }
    },
  };
}

const deps = {
  'src/pages/customPage/util': color,
  'src/pages/widgetConfig/config/widget': widget,
  '../Charts/reportTypes': types,
  '../enum': enums,
  './controlUtils': control,
  './timeUtils': time,
};
const environment = {
  $: jquery,
  document: { createElement: () => new Span(), querySelector: () => (highlightPresent ? highlight : null) },
};
const current = load(readSource(target), deps, environment);
const before = historicalRev
  ? load(
      cp.execFileSync('git', ['show', historicalRev + ':' + target], { cwd: root, encoding: 'utf8' }),
      deps,
      environment,
    )
  : undefined;
let cases = 0;

function run(module: unknown, name: string, args: unknown[]) {
  const input = lodash.cloneDeep(args);
  domEvents.length = 0;
  const output = call(module, name, input);
  return { output, input, dom: [...domEvents] };
}

function compare(name: string, args: unknown[], expected?: unknown) {
  const now = run(current, name, args);
  if (before) assert.deepEqual(now, run(before, name, args), name + ' historical ' + cases);
  if (arguments.length > 2) assert.deepEqual(now.output, expected, name);
  cases++;
  return now.output;
}

const reportTypes = read(types, 'reportTypes');
assert.ok(record(reportTypes));
const typeValues = Object.values(reportTypes);
assert.ok(typeValues.every(v => typeof v === 'number'));
const fields = [
  { controlId: 'text', controlName: '标题', type: 2 },
  { controlId: 'num', controlName: '数值', type: 6, dot: 2 },
  { controlId: 'date', controlName: '日期', type: 16 },
  { controlId: 'linked', controlName: '他表数值', type: 30, sourceControlType: 6 },
  { controlId: 'formula-number', type: 38, enumDefault: 1 },
  { controlId: 'formula-date', type: 38, enumDefault: 2 },
  { controlId: 'subtotal', type: 37, enumDefault2: 6 },
  { controlId: 'area', controlName: '地区', type: 19 },
  { controlId: 'encrypted', type: 6, encryId: 'encrypted' },
];

function config(reportType: unknown) {
  return {
    reportType,
    name: '旧图表',
    appType: 1,
    controls: lodash.cloneDeep(fields),
    formulas: [{ controlId: 'formula', type: 6, controlName: '公式', dot: 4 }],
    xaxes: { controlId: 'text', controlType: 2, rename: '别名', extra: 'x' },
    split: { controlId: 'area', controlType: 19 },
    yaxisList: [
      { controlId: 'num', normType: 1, controlType: 6 },
      { controlId: 'linked', normType: 2, controlType: 6 },
      { controlId: 'formula', normType: 3, controlType: 6 },
    ],
    summary: { type: 1, name: '', controlId: 'num' },
    sorts: [{ num: 1 }, { linked: 2 }, { formula: [] }],
    displaySetup: { xdisplay: { title: '' }, ydisplay: { title: '' }, showTotal: true, showChartType: 2 },
    rightY: {
      yaxisList: [{ controlId: 'linked', controlType: 6 }],
      split: {},
      summary: { type: 1, name: '', controlId: 'linked' },
      display: { ydisplay: { title: '' } },
    },
    pivotTable: { lines: [], columns: [] },
    country: { particleSizeType: 2, drillFilterCode: 'CN' },
    config: { min: null, max: null, targetList: [] },
    style: null,
    filter: { rangeType: 18, today: true },
    auth: { role: 'keep' },
    extra: { opaque: [1, 2] },
  };
}

for (const type of typeValues) {
  compare('initConfigDetail', [undefined, config(type), {}, {}]);
  compare('initConfigDetail', ['saved', config(type), {}, {}]);
  compare('initConfigDetail', [
    'saved',
    config(type),
    {},
    {
      pivoTableColor: '#ffffff',
      pivoTableColorIndex: 3,
      numberChartColor: '#123456',
      chartColor: { chartColorIndex: 3, customColors: ['#000000'] },
    },
  ]);
  for (const oldType of typeValues)
    for (const variant of [0, 1]) {
      const previous = config(oldType);

      if (variant) {
        previous.xaxes = { ...previous.xaxes, controlId: 'date', controlType: 16 };
        previous.yaxisList = [
          { controlId: 'num', controlType: 6, normType: 1 },
          { controlId: 'num', controlType: 6, normType: 2 },
          { controlId: '', controlType: 6, normType: 5 },
        ];
      }

      compare('initConfigDetail', [undefined, config(type), previous, {}]);
    }

  const existing = config(type);
  existing.style = {};
  compare('getNewReport', [
    {
      currentReport: existing,
      worksheetInfo: { worksheetId: 'sheet' },
      base: { isPublic: false, sourceType: 2, report: { id: 'id' } },
    },
  ]);
  compare('getNewReport', [{ currentReport: existing, worksheetInfo: {}, base: {} }]);
  compare('getAlreadySelectControlId', [config(type)]);
  for (const display of [undefined, 1, 2]) compare('getAxisText', [type, display]);
}

const transitioned = config(1);
transitioned.xaxes.controlType = 40;
compare('initConfigDetail', [undefined, config(3), transitioned, {}]);
compare('initConfigDetail', [undefined, config(1), { country: { particleSizeType: 2 } }, {}]);
const appType2 = config(1);
appType2.appType = 2;
compare('initConfigDetail', [undefined, appType2, {}, {}]);
const noArea = config(9);
noArea.controls = [];
compare('initConfigDetail', [undefined, noArea, config(1), {}]);
for (const type of [
  2,
  6,
  8,
  9,
  10,
  11,
  14,
  15,
  16,
  19,
  23,
  24,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  38,
  40,
  41,
  45,
  48,
  50,
  10000000,
  10000001,
  0,
  undefined,
]) {
  compare('isXAxisControl', [type]);
  for (const normType of [undefined, 0, 1, 2, 3, 4, 5, 6, 7]) {
    compare('getSortData', [{ controlType: type, normType }]);
    compare('isCustomSort', [{ controlType: type, normType }]);
  }
}

compare('filterXAxisControls', [fields]);
const sortInputs = [
  [],
  [{ a: 1 }, { b: 2 }],
  [{ a: 1 }, { a: 2 }, { 'a-right': [] }],
  [{ a: 0 }, { b: false }],
  [null, {}, { '': 1 }, { a: ['x', 'y'] }],
];
const identities = [
  [],
  ['a'],
  ['a', 'a-right'],
  ['a-right', 'a'],
  ['a', 'a-yaxis', 'a-right', 'b'],
  [undefined, '', null, 'b', 'a'],
];
for (const sorts of sortInputs)
  for (const ids of identities) for (const same of [[], ['a'], ['b']]) compare('formatSorts', [sorts, ids, same]);
compare('formatSorts', [[{ a: 2 }], ['a', 'a-right'], []], [{ a: 2 }, { a: 0 }]);
for (const size of [0, 1, 2, 3, undefined])
  for (const width of [0, 80, 160, 500])
    for (const sum of ['', 0, 1, 123456789, '很长的中文统计值']) {
      node.clientWidth = width;
      compare('getPerfectFontSize', [node, sum, size]);
    }

for (const color of ['#ffffff', '#000000', '#FF9300', '#A00416'])
  for (const type of [8, 10, 1]) {
    const raw = config(type);
    raw.style = {};
    compare('initConfigDetail', ['saved', raw, {}, { pivoTableColor: color, numberChartColor: color }]);
  }

for (const type of [19, 23, 24, undefined])
  for (const chooserange of [undefined, '', 'CN', 'US'])
    compare('filterAreaParticleSizeDropdownData', [{ type, advancedSetting: { chooserange } }]);
compare('filterDisableParticleSizeTypes', ['a', ['a-1', 'a-2', 'b-3', 'a-invalid']], [1, 2, NaN]);
for (const color of ['#ffffff', '#112233', '#000000', '#FF9300', '#abc', 'bad'])
  for (const end of ['#ffffff', '#000000'])
    for (const step of [0, 1, 2, 7, -1, 2.5]) compare('getGradientColors', [color, end, step]);
for (const selected of [undefined, 0, 1, 2])
  compare('checkedDropdownItem', [
    selected,
    [{ value: 0 }, { value: 1 }, { value: 2, className: 'old', extra: 'keep' }],
  ]);
const list = [{ value: 1, className: 'old' }];
const out = call(current, 'checkedDropdownItem', [1, list]);
assert.ok(Array.isArray(out));
assert.equal(out[0], list[0]);
assert.equal(list[0]?.className, 'colorPrimary');
compare('checkedDropdownItem', [1, null], []);
for (const id of ['ownerid', 'caid', 'ctime', 'utime', 'text']) compare('isSystemControl', [id]);
for (const present of [true, false]) {
  highlightPresent = present;
  compare('addCalculateControlHighlight', []);
  if (present) {
    const fn = [...handlers.values()][0];
    assert.equal(typeof fn, 'function');
    if (typeof fn === 'function') Reflect.apply(fn, highlight, []);
    assert.deepEqual(domEvents.at(-1), ['removeClass', 'highlight']);
  }
}

const saveSource = config(1);
const saveSnapshot = lodash.cloneDeep(saveSource);
const saved = call(current, 'getNewReport', [
  { currentReport: saveSource, worksheetInfo: { worksheetId: 'sheet' }, base: {} },
]);
assert.deepEqual(saveSource, saveSnapshot, 'Saving builds a copy');
assert.notEqual(saved, saveSource);
assert.deepEqual(call(current, 'getAlreadySelectControlId', [config(1)]), [
  'num',
  'linked',
  'formula',
  'text',
  'area',
  'linked',
]);

measurementFailure = true;
assert.throws(() => call(current, 'getPerfectFontSize', [node, 'bad', 1]), /measure failed/);
assert.equal(node.children.length, 0);
measurementFailure = false;
assert.throws(
  () => call(current, 'initConfigDetail', ['saved', { ...config(1), summary: { type: 999 } }, {}, {}]),
  TypeError,
);
assert.throws(() => call(current, 'initConfigDetail', [undefined, config(1), { name: 'incomplete' }, {}]), TypeError);
console.log(
  `Report configuration passed (${cases} cases${before ? ' with historical comparison' : ''}); actual control/color/summary helpers, input mutations, duplicate-axis queues and DOM cleanup verified`,
);
