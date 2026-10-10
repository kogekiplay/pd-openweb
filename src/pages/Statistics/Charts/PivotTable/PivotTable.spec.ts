import type { ReactElement, ReactNode } from 'react';
import type { Node } from '@babel/types';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const generator: typeof import('@babel/generator').default = require('@babel/generator').default;
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const {
  transformSync,
}: { transformSync: typeof import('@babel/core').transformSync } = require('../../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
const { TinyColor }: typeof import('@ctrl/tinycolor') = require('@ctrl/tinycolor');
const root = path.resolve(__dirname, '../../../../..');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const beforeRevision = process.env['PIVOT_BEFORE_REV'];
const beforeSource = (relative: string): string => {
  if (!beforeRevision) throw new Error('PIVOT_BEFORE_REV is required for historical A/B');
  return execFileSync('git', ['show', beforeRevision + ':' + relative], { cwd: root, encoding: 'utf8' });
};
interface TestColumn {
  title?: unknown;
  dataIndex?: string | undefined;
  children?: TestColumn[] | undefined;
  render?: unknown;
  onCell?: unknown;
  [key: string]: unknown;
}
interface TestRecord {
  key: string | number;
  [key: string]: unknown;
}
function object(value: unknown): Record<string, unknown> {
  if (!rawObject(value)) throw new TypeError('Expected an actual object');
  return value;
}
function rawObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function call(receiver: Record<string, unknown>, name: string, args: unknown[] = []): unknown {
  const method = receiver[name];
  if (typeof method !== 'function') throw new TypeError('Missing actual method ' + name);
  const result: unknown = Reflect.apply(method, receiver, args);
  return result;
}
function results(value: unknown): Result[] {
  function row(item: unknown): item is Result {
    if (
      !rawObject(item) ||
      typeof item['t_id'] !== 'string' ||
      !Array.isArray(item['y']) ||
      !Array.isArray(item['data'])
    )
      return false;
    if (item['sum'] !== undefined && typeof item['sum'] !== 'number') return false;
    if (item['summary_col'] !== undefined && typeof item['summary_col'] !== 'boolean') return false;
    return true;
  }
  if (!Array.isArray(value) || !value.every(row)) throw new TypeError('Invalid test result rows');
  return value;
}
function rows(value: unknown): TestRecord[] {
  function row(item: unknown): item is TestRecord {
    return rawObject(item) && (typeof item['key'] === 'string' || typeof item['key'] === 'number');
  }
  if (!Array.isArray(value) || !value.every(row)) throw new TypeError('Invalid test table rows');
  return value;
}
interface TestLine {
  key: string;
  data: unknown[];
}
function lines(value: unknown): TestLine[] {
  function line(item: unknown): item is TestLine {
    return rawObject(item) && typeof item['key'] === 'string' && Array.isArray(item['data']);
  }
  if (!Array.isArray(value) || !value.every(line)) throw new TypeError('Invalid test lines');
  return value;
}
function columns(value: unknown): TestColumn[] {
  function column(item: unknown): item is TestColumn {
    if (!rawObject(item)) return false;
    if (item['dataIndex'] !== undefined && typeof item['dataIndex'] !== 'string') return false;
    if (item['children'] !== undefined && (!Array.isArray(item['children']) || !item['children'].every(column)))
      return false;
    return true;
  }
  if (!Array.isArray(value) || !value.every(column)) throw new TypeError('Invalid test columns');
  return value;
}
function checkedNode(value: unknown, seen = new WeakSet<object>()): ReactNode {
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('Cyclic test node');
    seen.add(value);
    const children = Array.from(value, item => checkedNode(item, seen));
    seen.delete(value);
    return children;
  }
  if (React.isValidElement(value)) return value;
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  throw new TypeError('Invalid test render node');
}
function renderOutput(value: unknown): ReactNode {
  if (rawObject(value) && 'children' in value && !React.isValidElement(value)) {
    if (value['props'] !== undefined) {
      const props = object(value['props']);
      for (const key of ['rowSpan', 'colSpan']) assert.ok(props[key] === undefined || typeof props[key] === 'number');
      if (props['style'] !== undefined) object(props['style']);
    }
    return checkedNode(value['children']);
  }
  return checkedNode(value);
}
interface State {
  pageIndex: number;
  dragValue: number;
  pageSize?: number | undefined;
  [key: string]: unknown;
}
function state(value: unknown): value is State {
  return (
    rawObject(value) &&
    typeof value['pageIndex'] === 'number' &&
    typeof value['dragValue'] === 'number' &&
    (value['pageSize'] === undefined || typeof value['pageSize'] === 'number')
  );
}
class RuntimePivot {
  readonly target: Record<string, unknown>;
  constructor(value: unknown) {
    if (!rawObject(value)) throw new TypeError('Invalid actual class instance');
    this.target = value;
    value['setState'] = (change: object, callback?: () => void) => {
      Object.assign(this.state, change);
      callback?.();
    };
  }
  get state(): State {
    const value = this.target['state'];
    if (!state(value)) throw new TypeError('Invalid actual state');
    return value;
  }
  getResult(): Result[] {
    return results(call(this.target, 'getResult'));
  }
  getLinesData(): TestLine[] {
    return lines(call(this.target, 'getLinesData'));
  }
  getDataSource(result: Result[], input: unknown[]): TestRecord[] {
    return rows(call(this.target, 'getDataSource', [result, input]));
  }
  getColumnsHeader(input: unknown[]): TestColumn[] {
    return columns(call(this.target, 'getColumnsHeader', [input]));
  }
  getColumnsContent(result: Result[], ranges: object, colors: object): TestColumn[] {
    return columns(call(this.target, 'getColumnsContent', [result, ranges, colors]));
  }
  getColorRuleConfig(): object {
    return object(call(this.target, 'getColorRuleConfig'));
  }
  render(): ReactNode {
    return checkedNode(call(this.target, 'render'));
  }
  renderLineTd(...args: unknown[]): unknown {
    return call(this.target, 'renderLineTd', args);
  }
  renderSheetControl(...args: unknown[]): unknown {
    return call(this.target, 'renderSheetControl', args);
  }
  handleClick(value: object): void {
    call(this.target, 'handleClick', [value]);
  }
  handleAutoLinkage(): void {
    call(this.target, 'handleAutoLinkage');
  }
  handleRequestOriginalData(): void {
    call(this.target, 'handleRequestOriginalData');
  }
  getColumnWidth(index: number): unknown {
    return call(this.target, 'getColumnWidth', [index]);
  }
  getColumnWidthConfig(): object {
    return object(call(this.target, 'getColumnWidthConfig'));
  }
  setColumnWidth(index: number, width: number): void {
    call(this.target, 'setColumnWidth', [index, width]);
  }
}
interface Result {
  t_id: string;
  y: unknown[];
  data: unknown[];
  sum?: number | undefined;
  summary_col?: boolean | undefined;
}
interface Report {
  reportId: string;
  showLineTotal?: boolean;
  showColumnTotal?: boolean;
  columns: Array<{ controlId: string; cid: string; controlName: string; controlType: number }>;
  lines: Array<{ controlId: string; cid: string; controlName: string; controlType: number; [key: string]: unknown }>;
  yaxisList: Array<{ controlId: string; controlName: string; controlType: number; [key: string]: unknown }>;
  data: { x: Record<string, string[]>[]; data: Result[] };
  style: Record<string, unknown>;
  displaySetup: Record<string, unknown>;
  lineSummary: { location: number; controlList: object[]; rename: string };
  columnSummary: { location: number; controlList: object[]; rename: string };
  valueMap: Record<string, Record<string, unknown>>;
  yvalueMap: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}
function compile(
  source: string,
  filename: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): Record<string, unknown> {
  const target: { exports: unknown } = { exports: {} };
  const transformed = transformSync(source, { filename, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  assert.ok(transformed?.code);
  const code = transformed.code;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    target,
    target.exports,
    (name: string) => (name in imports ? imports[name] : require(name)),
    ...Object.values(globals),
  );
  return object(target.exports);
}
function selections(relative: string, names: string[], globals: Record<string, unknown> = {}): Record<string, unknown> {
  const filename = path.join(root, relative);
  const ast = parser.parse(fs.readFileSync(filename, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const selected: Node[] = [];
  for (const node of ast.program.body) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (
      declaration?.type === 'VariableDeclaration' &&
      declaration.declarations.some(item => item.id.type === 'Identifier' && names.includes(item.id.name))
    )
      selected.push(declaration);
    if (declaration?.type === 'FunctionDeclaration' && declaration.id && names.includes(declaration.id.name))
      selected.push(declaration);
  }
  assert.equal(selected.length, names.length, 'Read every actual dependency declaration');
  return compile(
    selected.map(item => generator(item).code).join('\n') + '\nmodule.exports={' + names.join(',') + '};',
    filename,
    {},
    globals,
  );
}
const environment: Record<string, unknown> = {
  _l: (text: string, ...args: unknown[]) => text.replace(/%0/g, String(args[0])),
  console: { ...console, log() {} },
  window: {
    safeParse(value: unknown) {
      try {
        return JSON.parse(String(value));
      } catch {
        return {};
      }
    },
    getCurrentLang: () => 'en',
    isWindows: false,
    isFirefox: false,
  },
  localStorage: { currentProjectId: 'project' },
};
const widget = selections('src/pages/widgetConfig/config/widget.ts', ['WIDGETS_TO_API_TYPE_ENUM'], environment);
const control = selections('src/utils/control.ts', ['formatNumberThousand', 'toFixed'], { ...environment, _: lodash });
const common = compile(
  fs.readFileSync(path.join(root, 'src/pages/Statistics/Charts/common.ts'), 'utf8'),
  path.join(root, 'src/pages/Statistics/Charts/common.ts'),
  {
    'src/utils/control': control,
    'src/utils/project': {},
    './reportTypes': { reportTypes: {} },
  },
  environment,
);
const controls = compile(
  fs.readFileSync(path.join(root, 'src/pages/Statistics/common/controlUtils.ts'), 'utf8'),
  'controlUtils.ts',
  { 'src/pages/widgetConfig/config/widget': widget },
  environment,
);
const mask = selections('src/utils/controlCommon.ts', ['dealMaskValue'], {
  ...environment,
  _: lodash,
  getAdvanceSetting: (data: { advancedSetting?: object }) => data.advancedSetting || {},
});
const imageSizes = selections('src/pages/Statistics/common/reportConfigUtils.ts', ['relevanceImageSize'], environment);
const span = (props: { children?: ReactNode }) => React.createElement('span', {}, props.children);
const boundary = compile(fs.readFileSync(path.join(__dirname, 'boundary.ts'), 'utf8'), 'boundary.ts', {});
const styles = compile(fs.readFileSync(path.join(__dirname, 'styled.ts'), 'utf8'), 'styled.ts', {
  'src/utils/typedStyled': require('styled-components'),
});
function fixture(
  isOriginal: boolean,
  mobile = false,
  print = false,
): {
  module: Record<string, unknown>;
  storage: Map<string, string>;
  util: Record<string, unknown>;
  document: { onmousemove: ((event: object) => void) | null; onmouseup: ((event: object) => void) | null };
} {
  const stored = new Map<string, string>();
  const doc: {
    body: { clientWidth: number };
    querySelector: () => object;
    onmousemove: ((event: object) => void) | null;
    onmouseup: ((event: object) => void) | null;
  } = {
    body: { clientWidth: 900 },
    querySelector: () => ({ clientWidth: 1000, offsetHeight: 600, getBoundingClientRect: () => ({ x: 10, y: 20 }) }),
    onmousemove: null,
    onmouseup: null,
  };
  const utilFilename = path.join(__dirname, 'util.ts');
  const util = compile(
    isOriginal ? beforeSource('src/pages/Statistics/Charts/PivotTable/util.ts') : fs.readFileSync(utilFilename, 'utf8'),
    utilFilename,
    {
      'src/pages/widgetConfig/config/widget': widget,
      'src/pages/widgetConfig/widgetSetting/components/WidgetSecurity/util': mask,
      './boundary': boundary,
    },
    environment,
  );
  const filename = path.join(__dirname, 'index.tsx');
  const source =
    (isOriginal
      ? beforeSource('src/pages/Statistics/Charts/PivotTable/index.tsx')
      : fs.readFileSync(filename, 'utf8')) + '\nmodule.exports.PivotTable = PivotTable;';
  const result = compile(
    source,
    filename,
    {
      './boundary': boundary,
      './util': util,
      './styled': styles,
      '../common': common,
      'ming-ui': { Icon: span, Linkify: span, UserCard: span },
      'ming-ui/components/ErrorBoundary': { wrap: (value: unknown) => value },
      'statistics/common/controlUtils': controls,
      'statistics/common/reportConfigUtils': imageSizes,
      'src/components/Form/DesktopForm/widgets/DepartmentSelect/DepartmentTooltip': span,
      'src/components/previewAttachments/previewAttachments': () => {},
      'src/pages/customPage/util': {
        isLightColor: (value: string) => new TinyColor(value).isLight(),
      },
      'src/pages/widgetConfig/config/widget': widget,
      'src/utils/common': { browserIsMobile: () => mobile, getClassNameByExt: () => 'file' },
      'src/utils/expression': { fileIsPicture: () => true },
    },
    {
      ...environment,
      location: { href: print ? '/printPivotTable/id' : '/report' },
      document: doc,
      sessionStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
      HTMLElement: class {},
    },
  );
  assert.equal(typeof result['PivotTable'], 'function');
  return { module: result, util, storage: stored, document: doc };
}
function report(): Report {
  return {
    reportId: 'report',
    appId: 'sheet',
    name: 'Sales',
    reportType: 8,
    columns: [],
    lines: [{ controlId: 'region', cid: 'region', controlName: 'Region', controlType: 2 }],
    yaxisList: [
      { controlId: 'sales', controlName: 'Sales', controlType: 6, magnitude: 1, ydot: 0, suffix: '', dot: 0 },
    ],
    data: {
      x: [{ region: ['East', 'East', 'West'] }],
      data: [{ t_id: 'sales', y: [], data: [20, 30, 40], sum: 90, summary_col: false }],
    },
    style: { paginationSize: 20 },
    displaySetup: { mergeCell: true, showRowList: true, colorRules: [] },
    lineSummary: { location: 2, rename: 'Row sum', controlList: [{ controlId: 'sales', number: true }] },
    columnSummary: { location: 4, rename: 'Column sum', controlList: [{ controlId: 'sales', number: true }] },
    valueMap: {},
    yvalueMap: {},
  };
}
function instance(module: Record<string, unknown>, data: Report, props: object = {}): RuntimePivot {
  const constructor = module['PivotTable'];
  if (typeof constructor !== 'function') throw new TypeError('Missing actual PivotTable constructor');
  const component: unknown = Reflect.construct(constructor, [{ reportData: data, ...props }]);
  return new RuntimePivot(component);
}
function columnTitles(columns: TestColumn[]): unknown[] {
  return columns.map(column => ({
    title:
      typeof column.title === 'function'
        ? renderToStaticMarkup(
            React.createElement(React.Fragment, {}, checkedNode(Reflect.apply(column.title, column, []))),
          )
        : column.title,
    dataIndex: column.dataIndex,
    colSpan: column['colSpan'],
    width: column['width'],
    fixed: column['fixed'] || undefined,
    children: column.children ? columnTitles(column.children) : undefined,
  }));
}
function normalizedHtml(value: ReactNode): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, {}, value)).replace(
    /ant-table-unique-[^" ]*/g,
    'ant-table-unique',
  );
}
function tableNodeForSpec(value: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(value)) return undefined;
  if (Object.hasOwn(value.props, 'dataSource')) return value;
  const children: unknown = value.props['children'];
  const list: unknown[] = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = tableNodeForSpec(checkedNode(child));
    if (found) return found;
  }
  return undefined;
}
const defaultFixture = fixture(false);
const defaultReport = report();
const defaultPivot = instance(defaultFixture.module, defaultReport);
const result = defaultPivot.getResult();
const lineData = defaultPivot.getLinesData();
assert.equal(defaultPivot.getResult(), result, 'actual result cache reference');
assert.equal(defaultPivot.getLinesData(), lineData, 'actual lines cache reference');
assert.deepEqual(lineData, [
  { key: 'region', xaxisEmptyType: undefined, name: 'Region', data: [{ value: 'East', length: 2 }, null, 'West'] },
]);
assert.deepEqual(defaultPivot.getDataSource(result, lineData), [
  { key: 0, region: { value: 'East', length: 2 }, 'sales-0': 20 },
  { key: 1, region: null, 'sales-0': 30 },
  { key: 2, region: 'West', 'sales-0': 40 },
]);
const defaultMarkup = normalizedHtml(defaultPivot.render());
assert.ok(defaultMarkup.includes('Region') && defaultMarkup.includes('Sales') && defaultMarkup.includes('West'));
assert.ok(/rowspan="2"/i.test(defaultMarkup), 'actual merged cell span');
const emptyReport = report();
emptyReport.columns = [];
emptyReport.lines = [];
emptyReport.yaxisList = [];
emptyReport.data = { x: [], data: [] };
const emptyPivot = instance(defaultFixture.module, emptyReport);
assert.deepEqual(emptyPivot.getColumnsHeader([]), []);
assert.deepEqual(emptyPivot.getColumnsContent([], {}, emptyPivot.getColorRuleConfig()), []);
assert.ok(normalizedHtml(emptyPivot.render()).includes('hideBody'), 'empty-data hiding preserves the table container');
const paginatedReport = report();
paginatedReport.style['paginationVisible'] = true;
paginatedReport.style['paginationSize'] = 2;
paginatedReport.showLineTotal = true;
const paginated = instance(defaultFixture.module, paginatedReport);
const pageRows = paginated.getDataSource(paginated.getResult(), paginated.getLinesData());
assert.deepEqual(
  pageRows.map(row => row.key),
  [0, 1],
);
paginated.state.pageIndex = 2;
assert.deepEqual(
  paginated.getDataSource(paginated.getResult(), paginated.getLinesData()).map(row => row.key),
  [2, 'sum'],
);
const table = tableNodeForSpec(paginated.render());
assert.ok(table);
const pagination = object(table.props['pagination']);
call(pagination, 'onShowSizeChange', [1, 25]);
assert.equal(paginated.state.pageIndex, 1);
assert.equal(paginated.state.pageSize, 25);
const requests: unknown[] = [];
const linked = instance(defaultFixture.module, report(), {
  isViewOriginalData: true,
  requestOriginalData: (request: unknown) => requests.push(request),
});
linked.handleClick({ event: { pageX: 100, pageY: 70 }, index: 0, record: { key: 0 } });
assert.deepEqual(requests, [{ isPersonal: false, match: { region: 'East' } }]);
const actualNode = React.createElement('b', {}, 'node');
const sharedNode: ReactNode[] = [actualNode, 'text', false, null];
assert.equal(call(boundary, 'renderNode', [sharedNode]), sharedNode);
assert.equal(call(boundary, 'renderNode', [actualNode]), actualNode);
const sharedBranches: ReactNode[] = [sharedNode, sharedNode];
assert.equal(call(boundary, 'renderNode', [sharedBranches]), sharedBranches);
const cycles: unknown[] = [];
cycles.push(cycles);
assert.throws(() => call(boundary, 'renderNode', [cycles]), TypeError);
const sparse: ReactNode[] = new Array(3);
sparse[2] = actualNode;
assert.equal(call(boundary, 'renderNode', [sparse]), sparse);
assert.throws(() => call(boundary, 'cellObject', [{ value: 'valid', length: 'bad' }]), TypeError);
assert.throws(() => call(boundary, 'cellObject', [{ value: 'valid', sum: 1 }]), TypeError);
assert.throws(() => call(boundary, 'renderNode', [{ value: 'raw non-node' }]), TypeError);
assert.deepEqual(call(defaultFixture.util, 'uniqMerge', [['A', 'A', 'B'], { defaultEmpty: '--' }]), [
  { value: 'A', length: 2 },
  null,
  'B',
]);
assert.deepEqual(
  call(defaultFixture.util, 'getControlMinAndMax', [
    defaultReport.yaxisList,
    [{ t_id: 'sales', y: [], data: [null, 5, 10] }],
  ]),
  { sales: { min: 5, max: 10, center: 7.5 } },
);
const rangeRules = [
  {
    controlId: 'sales',
    textColorRule: { model: 2, scopeRules: [{ type: 1, min: 0, max: 50, and: 6, color: '#f00' }] },
  },
];
const config = object(call(defaultFixture.util, 'compileColorRuleConfig', [defaultReport.yaxisList, rangeRules]));
const ruleMap = object(config['colorRuleMap']);
const salesRule = object(ruleMap['sales']);
assert.equal(
  call(defaultFixture.util, 'getCompiledStyleColor', [
    { value: 20, rule: salesRule['textColorRule'], controlId: 'sales' },
  ]),
  '#f00',
);
defaultPivot.setColumnWidth(1, 123);
assert.equal(defaultFixture.storage.get('pivotTableColumnWidthConfig-report'), '{"1":123}');
defaultFixture.storage.set('pivotTableColumnWidthConfig-report', '{"1":"150"}');
assert.equal(defaultPivot.getColumnWidth(1), 150);
defaultFixture.storage.set('pivotTableColumnWidthConfig-report', '{"1":{}}');
assert.throws(() => defaultPivot.getColumnWidthConfig(), TypeError);
assert.ok(
  normalizedHtml(
    checkedNode(defaultPivot.renderSheetControl('{"value":3,"color":"#fff"}', { controlId: 'score', controlType: 28 })),
  ).includes('3'),
  'numeric option/score field values retain React number rendering',
);
console.log(
  'PivotTable independent complete-class data/SSR/pagination/events/colors/cache/node-boundary assertions passed',
);
const sparseFiles: unknown[] = new Array(1);
assert.throws(
  () =>
    defaultPivot.renderLineTd(
      [sparseFiles],
      { key: 0 },
      0,
      { controlId: 'related', controlType: 29, fields: [{ controlId: 'files', controlType: 14, size: 2 }] },
      0,
    ),
  TypeError,
  'sparse unknown attachment list is rejected before typed file consumption',
);
if (beforeRevision) {
  const mutations: Array<(value: Report) => void> = [
    () => {},
    value => {
      value.lines = [];
      value.data.x = [];
      value.data.data[0]!.data = [20];
    },
    value => {
      value.lines = [];
      value.yaxisList = [];
      value.data = { x: [], data: [] };
    },
    value => {
      value.showLineTotal = true;
      value.lineSummary.location = 1;
    },
    value => {
      value.showLineTotal = true;
      value.lineSummary.location = 2;
      value.style['paginationVisible'] = true;
      value.style['paginationSize'] = 2;
    },
    value => {
      value.style['pivotTableLineFreeze'] = true;
      value.style['pivotTableLineFreezeIndex'] = 0;
      value.style['pivotTableColumnFreeze'] = true;
    },
    value => {
      value.yaxisList.push({ controlId: 'count', controlName: 'Count', controlType: 6 });
      value.data.data.push({ t_id: 'count', y: [], data: [1, 2, 3], sum: 6 });
    },
    value => {
      value.yaxisList[0]!['hide'] = true;
    },
    value => {
      value.data.x = [{ region: ['West', 'East', 'North'] }];
      value.data.data[0]!.data = [40, 30, 20];
    },
    value => {
      value.columns = [{ controlId: 'category', cid: 'category', controlName: 'Category', controlType: 2 }];
      value.data.data = [
        { t_id: 'sales', y: ['A'], data: [1, 2, 3], sum: 6, summary_col: false },
        { t_id: 'sales', y: ['B'], data: [10, 20, 30], sum: 60, summary_col: false },
        { t_id: 'sales', y: [], data: [11, 22, 33], sum: 66, summary_col: true },
      ];
      value.showColumnTotal = true;
    },
    value => {
      value.data.data[0]!.data = [20, 30, 'subTotal-50'];
      value.yvalueMap['sales'] = { 'subTotal-50': 50 };
      value.yaxisList[0]!['percent'] = { enable: true, type: 1, dot: 1 };
    },
    value => {
      value.displaySetup['colorRules'] = [
        {
          controlId: 'sales',
          textColorRule: {
            model: 2,
            controlId: 'sales',
            scopeRules: [{ type: 1, min: 15, and: 6, max: 30, color: '#f00' }],
          },
          dataBarRule: { min: 0, max: 100, direction: 1, positiveNumberColor: '#00f', onlyShowBar: false },
        },
      ];
    },
  ];
  let comparisons = 0;
  for (const mobile of [false, true])
    for (const print of [false, true]) {
      const before = fixture(true, mobile, print);
      const after = fixture(false, mobile, print);
      for (const mutate of mutations) {
        const a = report(),
          b = report();
        mutate(a);
        mutate(b);
        const old = instance(before.module, a),
          current = instance(after.module, b);
        const oldResult = old.getResult(),
          newResult = current.getResult();
        assert.deepEqual(newResult, oldResult, 'column merge preserves data');
        assert.equal(current.getResult(), newResult, 'typed cache preserves computed result reference');
        const oldLines = old.getLinesData(),
          newLines = current.getLinesData();
        assert.deepEqual(newLines, oldLines, 'line merge preserves grouping/subtotals');
        assert.equal(current.getLinesData(), newLines, 'line cache reference');
        assert.deepEqual(current.getDataSource(newResult, newLines), old.getDataSource(oldResult, oldLines));
        assert.deepEqual(
          columnTitles(current.getColumnsHeader(newLines)),
          columnTitles(old.getColumnsHeader(oldLines)),
        );
        assert.deepEqual(
          columnTitles(current.getColumnsContent(newResult, {}, current.getColorRuleConfig())),
          columnTitles(old.getColumnsContent(oldResult, {}, old.getColorRuleConfig())),
        );
        assert.equal(
          normalizedHtml(current.render()),
          normalizedHtml(old.render()),
          'actual React + Antd + styled-components SSR output',
        );
        old.state.pageIndex = current.state.pageIndex = 2;
        assert.deepEqual(
          current.getDataSource(newResult, newLines),
          old.getDataSource(oldResult, oldLines),
          'next-page row/total placement',
        );
        comparisons++;
      }
    }
  const after = fixture(false),
    before = fixture(true);
  for (const view of [false, true])
    for (const linkage of [false, true]) {
      const eventsA: unknown[] = [],
        eventsB: unknown[] = [];
      const props = (events: unknown[]) => ({
        isViewOriginalData: view,
        isLinkageData: linkage,
        requestOriginalData: (value: unknown) => events.push(value),
        onUpdateLinkageFiltersGroup: (value: unknown) => events.push(value),
      });
      const a = instance(before.module, report(), props(eventsA)),
        b = instance(after.module, report(), props(eventsB));
      const args = { event: { pageX: 100, pageY: 70 }, index: 0, record: { key: 0 } };
      a.handleClick(args);
      b.handleClick(args);
      assert.deepEqual(b.state, a.state, 'click dropdown/match/filter payload');
      assert.deepEqual(eventsB, eventsA);
      if (view && linkage) {
        a.handleAutoLinkage();
        b.handleAutoLinkage();
        a.handleRequestOriginalData();
        b.handleRequestOriginalData();
        assert.deepEqual(eventsB, eventsA);
      }
    }
  const callbackReport = report();
  callbackReport.style['paginationVisible'] = true;
  const callbackInstance = instance(after.module, callbackReport);
  const tableNode = (value: ReactNode): ReactElement<Record<string, unknown>> | undefined => {
    if (!React.isValidElement<Record<string, unknown>>(value)) return undefined;
    if (Object.hasOwn(value.props, 'dataSource')) return value;
    const children: unknown = value.props['children'];
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      const result = tableNode(child);
      if (result) return result;
    }
    return undefined;
  };
  const oldCallbackInstance = instance(before.module, { ...callbackReport });
  for (const tableInstance of [oldCallbackInstance, callbackInstance]) {
    const node = tableNode(tableInstance.render());
    assert.ok(node);
    const pagination = node.props['pagination'];
    assert.ok(pagination && typeof pagination === 'object');
    const change: unknown = Reflect.get(pagination, 'onChange');
    const resize: unknown = Reflect.get(pagination, 'onShowSizeChange');
    assert.equal(typeof change, 'function');
    assert.equal(typeof resize, 'function');
    if (typeof change !== 'function') throw new TypeError('Missing page callback');
    Reflect.apply(change, pagination, [3]);
    if (typeof resize !== 'function') throw new TypeError('Missing size callback');
    Reflect.apply(resize, pagination, [2, 25]);
  }
  assert.deepEqual(callbackInstance.state, oldCallbackInstance.state, 'actual Antd pagination callback updates');
  const current = instance(after.module, report());
  const node = React.createElement('b', {}, 'Actual node');
  const array: ReactNode[] = [node, 'text', false, null];
  const rendered = current.renderLineTd(array, { key: 0 }, 0, { controlId: 'text', controlType: 2 }, 0);
  assert.equal(React.isValidElement(rendered), true);
  assert.ok(normalizedHtml(checkedNode(rendered)).includes('<b>Actual node</b>'));
  const boundaryModule = {
    renderNode: (value: unknown) => call(boundary, 'renderNode', [value]),
    cellObject: (value: unknown) => call(boundary, 'cellObject', [value]),
  };
  assert.equal(boundaryModule.renderNode(array), array, 'valid React array identity is preserved');
  assert.equal(boundaryModule.renderNode(node), node, 'React element identity');
  assert.equal(boundaryModule.renderNode(true), true, 'booleans remain React booleans');
  assert.throws(() => boundaryModule.renderNode({ text: 'bad object' }), TypeError);
  assert.throws(() => boundaryModule.cellObject({ value: 'kept', length: 'bad' }), TypeError);
  assert.throws(() => boundaryModule.cellObject({ value: 'kept', sum: 1 }), TypeError);
  current.setColumnWidth(1, 123);
  assert.equal(after.storage.get('pivotTableColumnWidthConfig-report'), '{"1":123}');
  after.storage.set('pivotTableColumnWidthConfig-report', '{"1":"150"}');
  assert.equal(current.getColumnWidth(1), 150, 'numeric-string stored widths preserve existing coercion');
  after.storage.set('pivotTableColumnWidthConfig-report', '{"1":{}}');
  assert.throws(() => current.getColumnWidthConfig(), TypeError, 'malformed stored widths are not claimed as valid');
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.throws(() => boundaryModule.renderNode(cyclic), TypeError, 'cycle rejects without recursion overflow');
  const shared: ReactNode[] = [node, 'shared'];
  const branches: ReactNode[] = [shared, shared];
  assert.equal(boundaryModule.renderNode(branches), branches, 'shared acyclic arrays remain valid');
  const sparse = new Array<ReactNode>(3);
  sparse[2] = node;
  assert.equal(
    boundaryModule.renderNode(sparse),
    sparse,
    'React accepts undefined sparse children and keeps array identity',
  );
  class UtilHarness {
    readonly target: Record<string, unknown>;
    constructor(target: Record<string, unknown>) {
      this.target = target;
    }
    uniqMerge(value: unknown[], config: object): unknown {
      return call(this.target, 'uniqMerge', [value, config]);
    }
    mergeTableCell(value: unknown[], pageSize?: number, mergeCell?: boolean): unknown {
      return call(this.target, 'mergeTableCell', [value, pageSize, mergeCell]);
    }
    getControlMinAndMax(fields: object[], data: Result[]): unknown {
      return call(this.target, 'getControlMinAndMax', [fields, data]);
    }
    compileColorRuleConfig(
      fields: object[],
      rules: object[],
    ): { yaxisMap: Record<string, unknown>; colorRuleMap: Record<string, Record<string, unknown>> } {
      const value: unknown = call(this.target, 'compileColorRuleConfig', [fields, rules]);
      function isConfig(
        input: unknown,
      ): input is { yaxisMap: Record<string, unknown>; colorRuleMap: Record<string, Record<string, unknown>> } {
        if (!rawObject(input) || !rawObject(input['yaxisMap']) || !rawObject(input['colorRuleMap'])) return false;
        return Object.values(input['colorRuleMap']).every(rawObject);
      }
      if (!isConfig(value)) throw new TypeError('Invalid compiled test config');
      return value;
    }
    getCompiledStyleColor(args: object): unknown {
      return call(this.target, 'getCompiledStyleColor', [args]);
    }
    getCompiledBarStyleColor(args: object): unknown {
      return call(this.target, 'getCompiledBarStyleColor', [args]);
    }
  }
  const oldUtil = new UtilHarness(before.util);
  const newUtil = new UtilHarness(after.util);
  const mergeCases = [
    [],
    ['one'],
    ['one', 'one', 'two', 'two'],
    [0, '', false, undefined, null],
    ['a', 'a', 'a', 'a', 'a'],
  ];
  for (const values of mergeCases)
    for (const pageSize of [0, 2, 3])
      for (const mergeCell of [true, false]) {
        const params = { pageSize, defaultEmpty: '--', mergeCell };
        assert.deepEqual(newUtil.uniqMerge(values, params), oldUtil.uniqMerge(values, params));
      }
  const specialCell = { value: 'same', length: 2, metadata: { retained: true } };
  assert.deepEqual(
    newUtil.uniqMerge(['same', specialCell], { defaultEmpty: '--' }),
    oldUtil.uniqMerge(['same', specialCell], { defaultEmpty: '--' }),
  );
  const sourceColumns = [
    { data: ['a', 'a', 'b'], marker: 'first' },
    { data: ['1', '1', '2'], marker: 'second' },
  ];
  const oldColumns = lodash.cloneDeep(sourceColumns),
    newColumns = lodash.cloneDeep(sourceColumns);
  assert.equal(newUtil.mergeTableCell(newColumns), newColumns, 'matrix merge retains array reference');
  oldUtil.mergeTableCell(oldColumns);
  assert.deepEqual(newColumns, oldColumns, 'in-place matrix grouping matches old behavior');
  for (const values of [
    [],
    [0],
    [undefined],
    [null],
    [-10, 0, 5],
    [null, 5, 10],
    ['10', '2'],
    [NaN, Infinity, -Infinity],
  ]) {
    const data = [{ t_id: 'sales', data: values, y: [], summary_col: false }];
    assert.deepEqual(
      newUtil.getControlMinAndMax(report().yaxisList, data),
      oldUtil.getControlMinAndMax(report().yaxisList, data),
      'range min/max/center preserve empty, null and string ordering',
    );
  }
  const colorValues = [undefined, null, 0, -10, 20, 50, 100, NaN];
  for (const model of [1, 2]) {
    const rule =
      model === 1
        ? {
            model,
            applyValue: 2,
            controlId: 'sales',
            colors: Array.from({ length: 100 }, (_, index) => '#' + index),
            min: { value: -10 },
            max: { value: 100 },
            center: { value: 50 },
            centerVisible: true,
          }
        : {
            model,
            controlId: 'sales',
            scopeRules: [
              { type: 1, min: 0, max: 50, and: 6, color: '#f00' },
              { type: 3, value: 100, color: '#0f0' },
              { type: 4, color: '#00f' },
            ],
          };
    const ruleMetadata = { untouched: true };
    const rules = [
      {
        controlId: 'sales',
        textColorRule: { ...rule, ruleMetadata },
        dataBarRule: {
          min: 0,
          max: 100,
          direction: 2,
          positiveNumberColor: '#f00',
          negativeNumberColor: '#00f',
          axisColor: '#ccc',
        },
        metadata: ruleMetadata,
      },
    ];
    const oldConfig = oldUtil.compileColorRuleConfig(report().yaxisList, rules),
      newConfig = newUtil.compileColorRuleConfig(report().yaxisList, rules);
    assert.deepEqual(newConfig, oldConfig, 'compiled protocol fields match exactly');
    assert.equal(newConfig.colorRuleMap['sales']?.['metadata'], ruleMetadata, 'open metadata reference is retained');
    assert.equal(
      object(newConfig.colorRuleMap['sales']?.['textColorRule'])['ruleMetadata'],
      ruleMetadata,
      'nested rule metadata reference',
    );
    const sharedFields = report().yaxisList;
    const indexConfig = newUtil.compileColorRuleConfig(sharedFields, []);
    assert.equal(indexConfig.yaxisMap['sales'], sharedFields[0], 'axis map retains original field');
    for (const value of colorValues) {
      const config = { value, controlMinAndMax: {}, controlId: 'sales', record: { key: 0 }, emptyShowType: 1 };
      assert.equal(
        newUtil.getCompiledStyleColor({ ...config, rule: newConfig.colorRuleMap['sales']?.['textColorRule'] }),
        oldUtil.getCompiledStyleColor({ ...config, rule: oldConfig.colorRuleMap['sales']?.['textColorRule'] }),
      );
      assert.deepEqual(
        newUtil.getCompiledBarStyleColor({ value, rule: newConfig.colorRuleMap['sales']?.['dataBarRule'] }),
        oldUtil.getCompiledBarStyleColor({ value, rule: oldConfig.colorRuleMap['sales']?.['dataBarRule'] }),
      );
    }
  }
  const controlTypes = [2, 9, 26, 27, 36];
  for (const type of controlTypes) {
    const data =
      type === 26
        ? '{"accountId":"user","fullname":"Name","avatar":"avatar"}'
        : type === 27
          ? '{"projectId":"project","departmentName":"Dept"}'
          : type === 9
            ? '{"value":"Option","color":"#f00"}'
            : '1';
    const props = {
      controlId: 'field',
      controlType: type,
      advancedSetting: { showtype: '0' },
      displayMode: 'fieldStyle',
    };
    assert.equal(
      normalizedHtml(checkedNode(current.renderSheetControl(data, props))),
      normalizedHtml(checkedNode(instance(before.module, report()).renderSheetControl(data, props))),
      'field style actual UI nodes match',
    );
  }
  for (const input of [
    'subTotalEmpty-0',
    'subTotalFreezeEmpty-0',
    null,
    { value: 'subtotal', length: 2 },
    { value: 'value', length: 3, sum: true },
  ]) {
    assert.deepEqual(
      current.renderLineTd(input, { key: 0 }, 0, { controlId: 'region', controlType: 2 }, 0),
      instance(before.module, report()).renderLineTd(input, { key: 0 }, 0, { controlId: 'region', controlType: 2 }, 0),
    );
  }
  const picture = {
    fileID: 'f',
    previewUrl: 'https://example.test/imageView2/2/w/60/h/60',
    ext: '.png',
    metadata: { keep: true },
  };
  const attachmentField = { controlId: 'file', controlType: 14, size: 2 };
  const related = {
    controlId: 'related',
    controlType: 29,
    fields: [attachmentField, { controlId: 'text', controlType: 2 }],
  };
  const relatedValues = [[picture], ['label', 'other']];
  const currentRelated = current.renderLineTd(relatedValues, { key: 0 }, 0, related, 0);
  const oldRelated = instance(before.module, report()).renderLineTd(relatedValues, { key: 0 }, 0, related, 0);
  assert.equal(
    normalizedHtml(renderOutput(currentRelated)),
    normalizedHtml(renderOutput(oldRelated)),
    'attachment thumbnails + relation field layout actual before/after',
  );
  for (const malformed of [[{ fileID: 3, previewUrl: 'url', ext: '.png' }], [{ previewUrl: 42, ext: '.png' }]]) {
    assert.throws(
      () => current.renderLineTd([malformed], { key: 0 }, 0, related, 0),
      TypeError,
      'bad attachment fields fail at their leaf boundary',
    );
  }
  console.log(
    'PivotTable complete class: ' +
      comparisons +
      ' production Babel/React/Antd/SC before-after scenarios, cache, pagination, linkage, node identity and malformed boundaries passed',
  );
}
