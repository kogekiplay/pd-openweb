import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const before = process.env['DYNAMIC_TIME_BEFORE_REV'];
const modalPath = 'src/pages/Statistics/components/DataSource/components/TimeModal.tsx';
const scopePath = 'src/pages/Statistics/components/FilterScope/index.tsx';

function readSource(file: string): string {
  return before
    ? cp.execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(record(value), 'object receiver for ' + key);
  return value[key];
}
function invoke(fn: unknown, receiver: unknown, args: unknown[] = []): unknown {
  assert.equal(typeof fn, 'function');
  if (typeof fn !== 'function') throw new TypeError('Expected callable fixture');
  return Reflect.apply(fn, receiver, args);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  return invoke(read(value, key), value, args);
}
function load(source: string, file: string, imports: Record<string, unknown> = {}, env: Record<string, unknown> = {}) {
  const module: { exports: unknown } = { exports: {} };
  const environment = {
    _l: (text: string, ...args: unknown[]) => text.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)])),
    window: {},
    ...env,
  };
  const code = harness.transformSync(source, { filename: path.join(root, file) }).code;
  new Function('module', 'exports', 'require', ...Object.keys(environment), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['react', 'react/jsx-runtime', 'lodash', 'moment', 'moment/locale/zh-cn', 'redux'].includes(name)) {
        return require(name);
      }
      if (name.startsWith('@babel/runtime/')) return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(environment),
  );
  return module.exports;
}
function declaration(file: string, name: string): string {
  const source = readSource(file);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const node = ast.program.body.find(s => {
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    return (
      d?.type === 'VariableDeclaration' && d.declarations.some(v => v.id.type === 'Identifier' && v.id.name === name)
    );
  });
  assert.ok(node?.start != null && node.end != null, name);
  return source.slice(node.start, node.end);
}
const widgetPath = 'src/pages/widgetConfig/config/widget.ts';
const widget = load(declaration(widgetPath, 'WIDGETS_TO_API_TYPE_ENUM'), widgetPath);
const controlPath = 'src/pages/Statistics/common/controlUtils.ts';
const controls = load(readSource(controlPath), controlPath, { 'src/pages/widgetConfig/config/widget': widget });
const timePath = 'src/pages/Statistics/common/timeUtils.ts';
const time = load(readSource(timePath), timePath, {
  'src/pages/widgetConfig/config/widget': widget,
  './controlUtils': controls,
});
const numberPath = 'src/utils/control.ts';
const number = load(declaration(numberPath, 'formatNumberFromInput'), numberPath);
const typesPath = 'src/pages/Statistics/Charts/reportTypes.ts';
const reportTypes = load(readSource(typesPath), typesPath);
const Input = () => null;
const Select = Object.assign(() => null, { Option: () => null });
const Button = () => null;
const leaf = () => null;
const imports = {
  antd: { Input, Select, Button, Modal: leaf, Checkbox: leaf, Dropdown: leaf, Menu: leaf },
  'antd/es/date-picker/locale/zh_CN': {},
  'ming-ui': { Icon: leaf, Dialog: leaf, ScrollView: leaf, TimeZoneTag: leaf },
  'ming-ui/antd-components': { Tooltip: leaf },
  'ming-ui/components/TimeZoneTag': leaf,
  'statistics/common/timeUtils': time,
  'statistics/common/controlUtils': controls,
  'statistics/Charts/common': reportTypes,
  'statistics/redux/actions': {},
  'react-redux': { connect: () => (component: unknown) => component },
  'src/utils/control': number,
  'src/ming-ui/components/mdAntPickers': { DatePicker: { RangePicker: leaf } },
  'worksheet/common/WorkSheetFilter/common/FilterConfig': leaf,
  'worksheet/common/WorkSheetFilter/util': {},
  'src/pages/FormSet/components/columnRules/config': {},
  'src/pages/widgetConfig/widgetSetting/components/FilterData/FilterItemTexts': leaf,
  classnames: () => '',
  './index.less': {},
};
const ModalClass = read(load(readSource(modalPath), modalPath, imports), 'default');
const ScopeClass = read(load(readSource(scopePath), scopePath, imports), 'default');

function elements(node: unknown, type: unknown): import('react').ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(n => elements(n, type));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [...(node.type === type ? [node] : []), ...elements(node.props.children, type)];
}
function event(component: unknown, type: unknown, index: number, handler: string, value: unknown): void {
  const found = elements(call(component, 'renderDynamicFilter'), type)[index];
  assert.ok(found, 'actual rendered control ' + index);
  invoke(found.props[handler], undefined, [value]);
}
function instance(ctor: unknown, props: Record<string, unknown>, dynamic: unknown) {
  assert.equal(typeof ctor, 'function');
  if (typeof ctor !== 'function') throw new TypeError('Expected class');
  const component: unknown = Reflect.construct(ctor, [props]);
  assert.ok(record(component));
  // React assigns props after construction, including legacy super() components.
  component['props'] = props;
  const initial = read(component, 'state');
  assert.ok(record(initial));
  component['state'] = { ...initial, dynamicFilter: dynamic };
  component['setState'] = (patch: unknown, callback: unknown) => {
    assert.ok(record(patch));
    const state = read(component, 'state');
    assert.ok(record(state));
    component['state'] = { ...state, ...patch };
    if (callback !== undefined) invoke(callback, component);
  };
  return component;
}
function dynamic(component: unknown): unknown {
  return read(read(component, 'state'), 'dynamicFilter');
}
function seed() {
  return { startType: 5, startCount: 2, startUnit: 3, endType: 6, endCount: 7, endUnit: 4 };
}
function setup(ctor: unknown, value: unknown = seed()) {
  const events: unknown[][] = [];
  const filter = { rangeType: 21, rangeValue: null, filterRangeId: 'created', today: false, dynamicFilter: value };
  const props = {
    id: 'test',
    appId: 'app',
    filter,
    controls: [{ controlId: 'created', controlName: 'Created' }],
    currentReport: { filter },
    base: { sheetVisible: false },
    onChangeFilter: (patch: unknown) => events.push(['modal-save', patch]),
    changeCurrentReport: (patch: unknown, request: unknown) => events.push(['scope-save', patch, request]),
    onCancel: () => events.push(['cancel']),
  };
  return { component: instance(ctor, props, value), events, props };
}
let checks = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    checks++;
  } catch (error) {
    failures.push(name + ': ' + String(error));
  }
}

test('TimeModal end blur preserves start count and normalizes only end count', () => {
  const { component, events } = setup(ModalClass);
  event(component, Input, 1, 'onBlur', { target: { value: '12' } });
  assert.equal(read(dynamic(component), 'startCount'), 2);
  assert.equal(read(dynamic(component), 'endCount'), 12);
  assert.deepEqual(events, [], 'modal waits for confirmation');
});
test('TimeModal blank end blur sets only end count to zero', () => {
  const { component } = setup(ModalClass);
  event(component, Input, 1, 'onBlur', { target: { value: '' } });
  assert.equal(read(dynamic(component), 'startCount'), 2);
  assert.equal(read(dynamic(component), 'endCount'), 0);
});
for (const [label, index, key] of [
  ['start', 0, 'startCount'],
  ['end', 1, 'endCount'],
] as const) {
  test('FilterScope ' + label + ' uses the received event without window.event', () => {
    const { component, events } = setup(ScopeClass);
    let reads = 0;
    event(component, Input, index, 'onChange', {
      target: {
        get value() {
          reads++;
          return '-12.3x';
        },
      },
    });
    assert.equal(reads, 1);
    assert.equal(read(dynamic(component), key), '12.3');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.[0], 'scope-save');
    assert.equal(events[0]?.[2], true);
    assert.equal(read(read(events[0]?.[1], 'filter'), 'dynamicFilter'), dynamic(component));
  });
}
test('FilterScope end type updates end unit and leaves start unit untouched', () => {
  const { component } = setup(ScopeClass);
  event(component, Select, 2, 'onChange', 1);
  assert.equal(read(dynamic(component), 'startUnit'), 3);
  assert.equal(read(dynamic(component), 'endUnit'), 1);
  assert.equal(read(dynamic(component), 'endType'), 1);
});
test('FilterScope relative end type retains the selected end unit', () => {
  const { component } = setup(ScopeClass);
  event(component, Select, 2, 'onChange', 5);
  assert.equal(read(dynamic(component), 'startUnit'), 3);
  assert.equal(read(dynamic(component), 'endUnit'), 4);
});
for (const ctor of [ModalClass, ScopeClass]) {
  test('dynamic spread preserves getter order, extra references and own undefined', () => {
    const log: string[] = [],
      extra = {};
    const original = {
      ...seed(),
      get retained() {
        log.push('retained');
        return extra;
      },
      absent: undefined,
    };
    const { component } = setup(ctor, original);
    event(component, Select, 1, 'onChange', 4);
    const result = dynamic(component);
    assert.notEqual(result, original);
    assert.equal(read(result, 'retained'), extra);
    assert.ok(record(result) && Object.hasOwn(result, 'absent'));
    assert.deepEqual(log, ['retained']);
    assert.equal(original.startUnit, 3);
    assert.equal(read(result, 'startUnit'), 4);
    assert.deepEqual(Object.keys(result), Object.keys(original));
  });
  test('dynamic spread preserves the original thrown getter', () => {
    const failure = new Error('native getter failure');
    const original = {
      ...seed(),
      get retained() {
        throw failure;
      },
    };
    const { component, events } = setup(ctor, original);
    assert.throws(
      () => event(component, Select, 1, 'onChange', 4),
      error => error === failure,
    );
    assert.equal(dynamic(component), original);
    assert.deepEqual(events, []);
  });
}

test('actual formatter accepts in-progress string counts and missing counts', () => {
  assert.equal(
    call(time, 'formatrChartTimeText', [{ rangeType: 21, dynamicFilter: { ...seed(), endCount: '12.3' } }]),
    '过去2月至将来12.3年',
  );
  assert.equal(
    call(time, 'formatrChartTimeText', [{ rangeType: 21, dynamicFilter: { startType: 5, endType: 6 } }]),
    '过去至将来',
  );
});

async function verifyConsumers() {
  const { component, props } = setup(ScopeClass);
  const actionsPath = 'src/pages/Statistics/redux/actions.ts';
  const reducersPath = 'src/pages/Statistics/redux/reducers.ts';
  const reducer = read(
    load(readSource(reducersPath), reducersPath, { '../Charts/reportTypes': reportTypes }),
    'default',
  );
  let state = invoke(reducer, undefined, [undefined, { type: 'init' }]);
  const requestAction = { type: 'fixture-request' };
  const requests: unknown[] = [];
  const actions = load(
    declaration(actionsPath, 'changeCurrentReport') + '\n' + declaration(actionsPath, 'getReportSingleCacheId'),
    actionsPath,
    {},
    {
      getReportData: () => requestAction,
      reportRequestAjax: {
        getReportSingleCacheId: (payload: unknown) => {
          requests.push(payload);
          return Promise.resolve({});
        },
      },
    },
  );
  const dispatch = (action: unknown) => {
    state = invoke(reducer, undefined, [state, action]);
  };
  const getState = () => ({
    statistics: {
      currentReport: read(state, 'currentReport'),
      base: { report: { id: 'report' }, sheetId: 'sheet' },
      worksheetInfo: {},
    },
  });
  dispatch({ type: 'CHANGE_STATISTICS_CURRENT_REPORT', data: { ...props.currentReport, retained: 'report-data' } });
  props.changeCurrentReport = (patch, request) => {
    const thunk = call(actions, 'changeCurrentReport', [patch, request]);
    invoke(thunk, undefined, [dispatch, getState]);
    return 0;
  };
  event(component, Select, 2, 'onChange', 1);
  const report = read(state, 'currentReport');
  assert.equal(read(report, 'retained'), 'report-data');
  assert.equal(read(read(report, 'filter'), 'dynamicFilter'), dynamic(component));
  const thunk = call(actions, 'getReportSingleCacheId', [{ isPersonal: false, match: null, contrastType: 0 }]);
  invoke(thunk, undefined, [dispatch, getState]);
  await Promise.resolve();
  assert.equal(requests.length, 1);
  assert.equal(read(requests[0], 'dynamicFilter'), dynamic(component));
  assert.equal(read(read(requests[0], 'dynamicFilter'), 'startUnit'), 3);
  assert.equal(read(read(requests[0], 'dynamicFilter'), 'endUnit'), 1);
  checks++;
}
void verifyConsumers()
  .catch(error => failures.push('actual Redux and request consumers: ' + String(error)))
  .then(() => {
    for (const failure of failures) console.error(failure);
    console.log(
      JSON.stringify({
        checks,
        failures: failures.length,
        fullComponents: true,
        actualReduxAndRequestMapping: true,
        uiLeavesAndTransportAreFixtures: true,
        before: before || null,
      }),
    );
    if (failures.length) process.exitCode = 1;
  });
