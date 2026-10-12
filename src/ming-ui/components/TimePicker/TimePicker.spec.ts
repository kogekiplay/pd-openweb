import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const moment: typeof import('moment') = require('moment');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const before = process.env['TIME_PICKER_BEFORE_REV'];
moment.now = () => Date.UTC(2026, 9, 12, 10, 12, 34);
Reflect.set(globalThis, '_l', (value: string) => value);
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(object(value));
  return value[key];
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing observed callable');
  return Reflect.apply(fn, receiver, args);
}
class NodeStub {
  nodeType = 1;
  classList = { contains: (_name: string) => false };
  children = new Set<unknown>();
  offsetTop = 96;
  scrollTop = 0;
  contains(value: unknown) {
    return value === this || this.children.has(value);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, bottom: 52, right: 90, width: 80, height: 32 };
  }
  querySelector() {
    return null;
  }
}
const listeners = new Set<unknown>(),
  frames = new Map<number, unknown>();
let frameId = 0;
const schedule = (fn: unknown) => {
  const id = ++frameId;
  frames.set(id, fn);
  return id;
};
Reflect.set(globalThis, 'Node', NodeStub);
Reflect.set(globalThis, 'document', {
  addEventListener: (_name: string, fn: unknown) => listeners.add(fn),
  removeEventListener: (_name: string, fn: unknown) => listeners.delete(fn),
});
Reflect.set(globalThis, 'window', {
  requestAnimationFrame: schedule,
  cancelAnimationFrame: (id: number) => frames.delete(id),
  setTimeout: schedule,
  clearTimeout: (id: number) => frames.delete(id),
  getComputedStyle: () => ({ getPropertyValue: () => '32px' }),
});
function flushFrames() {
  let steps = 0;
  while (frames.size) {
    if (++steps > 100) throw new Error('Animation did not terminate');
    const current = [...frames.values()];
    frames.clear();
    for (const fn of current) invoke(undefined, fn, 0);
  }
}

function fixture(revision?: string) {
  const cache = new Map<string, Record<string, unknown>>();
  const Position = (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-layer': props['visible'] ? 'open' : 'closed' },
      props['children'] as import('react').ReactNode,
    );
  const Icon = (props: Record<string, unknown>) => React.createElement('i', { className: props['className'] });
  const Dropdown = (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { className: 'dropdown' },
      String(('value' in props ? props['value'] : props['defaultValue']) || ''),
    );
  function load(name: string): Record<string, unknown> {
    const old = cache.get(name);
    if (old) return old;
    const extension = name === 'TimePicker/utils' || name === 'DatePicker/locale/zh_CN' ? '.ts' : '.tsx';
    const file = `src/ming-ui/components/${name}${extension}`;
    const source = revision
      ? execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, file), 'utf8');
    const result = harness.transformSync(source, {
      filename: path.join(root, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(result?.code);
    const target: { exports: Record<string, unknown> } = { exports: {} };
    function imports(request: string): unknown {
      if (request === 'ming-ui/components/PositionContainer') return { __esModule: true, default: Position };
      if (request === 'ming-ui/components/Icon') return { __esModule: true, default: Icon };
      if (request === 'ming-ui/components/Dropdown') return { __esModule: true, default: Dropdown };
      if (
        request === 'ming-ui/components/Menu' ||
        request === 'ming-ui/components/MenuItem' ||
        request === './CalendarRange'
      )
        return { __esModule: true, default: Position };
      if (request === 'ming-ui/components/TimePicker/TimePicker') return load('TimePicker/TimePicker');
      if (request === '../ClickAway') return load('ClickAway');
      if (request.startsWith('./') && !request.endsWith('.less'))
        return load(path.posix.normalize(path.posix.join(path.posix.dirname(name), request)));
      if (request.endsWith('.less')) return {};
      return require(request);
    }
    new Function('module', 'exports', 'require', result.code)(target, target.exports, imports);
    cache.set(name, target.exports);
    return target.exports;
  }
  function make(name: string, props: Record<string, unknown> = {}) {
    const component = load(name)['default'];
    if (typeof component !== 'function') throw new TypeError('Missing actual class');
    const defaults = read(component, 'defaultProps');
    const supplied = object(defaults) ? { ...defaults, ...props } : props;
    const value: unknown = Reflect.construct(component, [supplied]);
    assert.ok(object(value));
    value['setState'] = (patch: unknown) => {
      assert.ok(object(patch));
      const state = read(value, 'state');
      assert.ok(object(state));
      value['state'] = { ...state, ...patch };
    };
    return {
      value,
      call(name: string, ...args: unknown[]) {
        return invoke(value, read(value, name), ...args);
      },
      update(patch: Record<string, unknown>) {
        const previous = read(value, 'props');
        assert.ok(object(previous));
        value['props'] = { ...previous, ...patch };
        this.call('componentDidUpdate', previous);
      },
      render() {
        const el = this.call('render');
        assert.ok(React.isValidElement<Record<string, unknown>>(el));
        return el;
      },
    };
  }
  function markup(name: string, props: Record<string, unknown>) {
    const component = load(name)['default'];
    if (typeof component !== 'function') throw new TypeError('Missing actual component');
    return ReactDOM.renderToStaticMarkup(
      React.createElement(component as import('react').ComponentType<Record<string, unknown>>, props),
    );
  }
  return { load, make, markup };
}

function publicContracts() {
  const temp = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-time-picker-contract-'));
  try {
    const source = path.join(temp, 'contract.tsx'),
      styles = path.join(temp, 'styles.d.ts'),
      config = path.join(temp, 'tsconfig.json');
    fs.writeFileSync(
      source,
      `import React from 'react'; import moment from 'moment';
import TimePicker from '${root}/src/ming-ui/components/TimePicker';
import type {TimePickerProps} from '${root}/src/ming-ui/components/TimePicker/types';
import RangeFooter from '${root}/src/ming-ui/components/DatePicker/RangeFooter';
import CalendarFooter from '${root}/src/ming-ui/components/DatePicker/CalendarFooter';
import locale from '${root}/src/ming-ui/components/DatePicker/locale/zh_CN';
export const valid=<TimePicker value={moment()} onChange={value=>{ const selected:moment.Moment|null=value;void selected; }} optionFormatter={(value,index,all)=>{const a:number[]=all;void a;return String(value+index);}} />;
export const empty=<TimePicker value={null} defaultValue={undefined} popupParentNode={()=>null} />;
export const trigger=<TimePicker><button type="button"><span>Open</span></button></TimePicker>;
export const range=<RangeFooter prefixCls="range" locale={locale} startValue={null} mode="task" onStartTimeSelect={value=>{if(value)value.hour();}} />;
export const footer=<CalendarFooter prefixCls="date" locale={locale} value={moment()} />;
// @ts-expect-error Callbacks must handle clear's null value.
export const narrow=<TimePicker onChange={(value:moment.Moment)=>{void value;}} />;
// @ts-expect-error Classic picker accepts Moment values, not serialized strings.
export const stringValue=<TimePicker value="10:00" />;
// @ts-expect-error Disabled option indices are numbers.
export const disabled=<TimePicker disabledHours={()=>['0']} />;
// @ts-expect-error Formatter's first argument is a number.
export const formatter=<TimePicker optionFormatter={(value:string)=>value} />;
// @ts-expect-error Trigger must be a real element.
export const badTrigger=<TimePicker>text</TimePicker>;
export const props:TimePickerProps={value:null,resultFormatter:value=>value?.format('HH:mm')||''};
void React;
`,
    );
    fs.writeFileSync(styles, "declare module '*.less';\n");
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [source, styles, path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function elements(value: unknown): import('react').ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props['children'])];
}
function main() {
  const current = fixture(),
    old = before ? fixture(before) : undefined;
  const value = moment.utc('2026-10-12T09:12:34Z'),
    initial = value.clone();
  const renderCases: Record<string, unknown>[] = [
    {},
    { value },
    { value: null },
    { defaultValue: value, showSecond: false },
    { value, showHour: false, showSecond: false },
    { disabled: true, value, className: 'disabled' },
    {
      value,
      showMinute: false,
      showSecond: false,
      resultFormatter: (v: unknown) => (moment.isMoment(v) ? v.format('HH:00') : '— —'),
    },
  ];
  for (const props of renderCases) {
    const html = current.markup('TimePicker/TimePicker', props);
    if (old) assert.equal(html, old.markup('TimePicker/TimePicker', props));
  }
  const panelCases: Record<string, unknown>[] = [
    { showHour: true, showMinute: true, showSecond: true },
    { showHour: true, showMinute: false, showSecond: false },
    { showHour: false, showMinute: true, showSecond: false },
    { showHour: true, disabledHours: () => [1, 2], disabledMinutes: () => [5] },
  ];
  for (const props of panelCases) {
    const all = {
      ...props,
      value,
      defaultOpenValue: initial,
      format: (v: unknown) => (moment.isMoment(v) ? v.format('HH:mm:ss') : ''),
    };
    const html = current.markup('TimePicker/Panel', all);
    if (old) assert.equal(html, old.markup('TimePicker/Panel', all));
  }
  const locale = read(current.load('DatePicker/locale/zh_CN'), 'default');
  for (const props of [
    { locale, prefixCls: 'date', mode: 'date', view: 'date' },
    { locale, prefixCls: 'date', mode: 'datetime', value },
    { locale, prefixCls: 'date', mode: 'datetime', view: 'year' },
  ]) {
    const html = current.markup('DatePicker/CalendarFooter', props);
    if (old) assert.equal(html, old.markup('DatePicker/CalendarFooter', props));
  }
  for (const props of [
    { locale, prefixCls: 'range' },
    { locale, prefixCls: 'range', mode: 'halfday', halfStart: 'AM', halfEnd: 'PM' },
    { locale, prefixCls: 'range', timePicker: true, startValue: value, endValue: value.clone().add(1, 'hour') },
  ]) {
    const html = current.markup('DatePicker/RangeFooter', props);
    if (old) assert.equal(html, old.markup('DatePicker/RangeFooter', props));
  }
  const emitted: unknown[] = [];
  const free = current.make('TimePicker/TimePicker', {
    defaultValue: value,
    onChange: (selected: unknown) => emitted.push(selected),
  });
  free.call('handleChange', value.clone().hour(10));
  assert.equal(
    invoke(read(read(free.value, 'state'), 'value'), read(read(read(free.value, 'state'), 'value'), 'hour')),
    10,
  );
  free.call('handleClear');
  assert.equal(read(read(free.value, 'state'), 'value'), null);
  assert.equal(emitted[1], null);
  const controlled = current.make('TimePicker/TimePicker', {
    value,
    onChange: (selected: unknown) => emitted.push(selected),
  });
  controlled.call('handleChange', value.clone().hour(11));
  assert.equal(read(read(controlled.value, 'state'), 'value'), value);
  controlled.call('handleClear');
  assert.equal(read(read(controlled.value, 'state'), 'value'), value);
  const disabled = current.make('TimePicker/TimePicker', {
    value,
    disabled: true,
    onChange: (selected: unknown) => emitted.push(selected),
  });
  const count = emitted.length;
  disabled.call('handleChange', value.clone());
  disabled.call('handleClear');
  assert.equal(emitted.length, count);
  const anchor = new NodeStub(),
    nested = new NodeStub(),
    panelNode = new NodeStub(),
    outside = new NodeStub();
  anchor.children.add(nested);
  Object.assign(free.value, { _timepicker: anchor, _panel: panelNode });
  free.call('componentDidMount');
  assert.equal(listeners.size, 1);
  free.call('handleFocus');
  // Replay the native body listener that receives the opening click after React commits.
  const layerElement = elements(free.render()).find(el => el.props['onHide'] === read(free.value, 'handleClose'));
  assert.ok(layerElement);
  const layer = current.make('PositionContainer', layerElement.props);
  Object.assign(layer.value, { mounted: true });
  layer.call('destroy', { target: anchor });
  layer.call('destroy', { target: nested });
  assert.equal(read(read(free.value, 'state'), 'visible'), true, 'The opening click must survive the body listener');
  free.call('withClickAway', { target: nested });
  assert.equal(read(read(free.value, 'state'), 'visible'), true);
  layer.call('destroy', { target: outside });
  assert.equal(read(read(free.value, 'state'), 'visible'), false);
  free.call('handleFocus');
  free.call('withClickAway', { target: outside });
  assert.equal(read(read(free.value, 'state'), 'visible'), false);
  free.call('componentWillUnmount');
  assert.equal(listeners.size, 0);
  if (old) {
    const previousPicker = old.make('TimePicker/TimePicker', { defaultValue: value });
    Object.assign(previousPicker.value, { _timepicker: anchor });
    previousPicker.call('handleFocus');
    const previousLayerElement = elements(previousPicker.render()).find(
      el => el.props['onHide'] === read(previousPicker.value, 'handleClose'),
    );
    assert.ok(previousLayerElement);
    const previousLayer = current.make('PositionContainer', previousLayerElement.props);
    Object.assign(previousLayer.value, { mounted: true });
    previousLayer.call('destroy', { target: anchor });
    assert.equal(
      read(read(previousPicker.value, 'state'), 'visible'),
      false,
      'The old producer reproduced immediate close',
    );
  }
  for (const [name, focus, close, visible] of [
    ['DatePicker/Picker', 'onClick', 'onClose', 'visible'],
    ['DatePicker/DateDropdDown', 'handleClick', 'handleCloseMenu', 'visibleMenu'],
  ]) {
    assert.ok(name && focus && close && visible);
    const producer = current.make(name, {
      children: name.endsWith('/Picker') ? () => React.createElement('button') : React.createElement('button'),
      calendar: React.createElement('div'),
    });
    const trigger = producer.call('getChildrenElement');
    assert.ok(React.isValidElement<Record<string, unknown>>(trigger));
    invoke(undefined, trigger.props['ref'], anchor);
    producer.call(focus);
    const positionElement = elements(producer.render()).find(el => el.props['onHide'] === read(producer.value, close));
    assert.ok(positionElement);
    const actualPosition = current.make('PositionContainer', positionElement.props);
    Object.assign(actualPosition.value, { mounted: true });
    actualPosition.call('destroy', { target: nested });
    assert.equal(read(read(producer.value, 'state'), visible), true);
    actualPosition.call('destroy', { target: outside });
    assert.equal(read(read(producer.value, 'state'), visible), false);
    invoke(undefined, trigger.props['ref'], null);
    producer.call(focus);
    assert.equal(read(read(producer.value, 'state'), visible), false, 'A cleared trigger ref must not reopen');
  }
  const formatterCalls: unknown[][] = [];
  const formatted = current.make('TimePicker/Panel', {
    value,
    defaultOpenValue: initial,
    showHour: true,
    format: () => '',
    optionFormatter: (...args: unknown[]) => {
      formatterCalls.push(args);
      return String(args[0]).padStart(2, '0') + ':00';
    },
  });
  const hours = formatted.call('renderHour');
  assert.ok(React.isValidElement<Record<string, unknown>>(hours));
  assert.equal(hours.props['selectedIndex'], 9);
  assert.equal(formatterCalls.length, 24);
  assert.deepEqual(formatterCalls[9]?.slice(0, 2), [9, 9]);
  const formattedValues = formatterCalls[9]?.[2];
  assert.ok(Array.isArray(formattedValues));
  assert.equal(formattedValues.length, 24);
  const changed: unknown[] = [];
  const panel = current.make('TimePicker/Panel', {
    value,
    defaultOpenValue: initial,
    showHour: true,
    showMinute: false,
    showSecond: false,
    format: () => '',
    onChange: (selected: unknown) => changed.push(selected),
    onClose: () => changed.push('closed'),
  });
  panel.call('handleSelect', 'hour', 15);
  assert.equal(changed[0], 'closed');
  assert.ok(moment.isMoment(changed[1]));
  assert.equal(changed[1].hour(), 15);
  assert.equal(value.valueOf(), initial.valueOf(), 'Selecting must clone the caller Moment');
  const taskChanges: unknown[] = [];
  const task = current.make('DatePicker/RangeFooter', {
    locale,
    prefixCls: 'range',
    mode: 'task',
    timePicker: true,
    startValue: value,
    endValue: value,
    onStartTimeSelect: (selected: unknown) => taskChanges.push(selected),
    onEndTimeSelect: (selected: unknown) => taskChanges.push(selected),
  });
  const picks = elements(task.render()).filter(el => el.type === current.load('TimePicker/TimePicker')['default']);
  assert.equal(picks.length, 2);
  invoke(undefined, picks[0]?.props['onChange'], null);
  invoke(undefined, picks[1]?.props['onChange'], null);
  assert.ok(moment.isMoment(taskChanges[0]) && moment.isMoment(taskChanges[1]));
  assert.equal(taskChanges[0].hour(), 9);
  assert.equal(taskChanges[1].hour(), 18);
  const item = current.make('TimePicker/SelectItem', { value: 3, onClick: (...args: unknown[]) => changed.push(args) });
  item.call('handleClick', { currentTarget: { offsetTop: 96 }, target: { offsetTop: 1 } });
  assert.deepEqual(changed[2], [3, 96]);
  const blockedItem = current.make('TimePicker/SelectItem', {
    value: 3,
    disabled: true,
    onClick: () => changed.push('blocked'),
  });
  blockedItem.call('handleClick', { currentTarget: { offsetTop: 96 } });
  assert.equal(changed.length, 3);
  const selections: unknown[] = [];
  const column = current.make('TimePicker/PanelSelect', {
    options: ['00', '01', '02', '03'],
    type: 'hour',
    disabledSelect: [3],
    onSelect: (...args: unknown[]) => selections.push(args),
  });
  const columnNode = new NodeStub();
  Object.assign(column.value, { _select: columnNode });
  column.call('handleClick', 3, 96);
  assert.equal(frames.size, 0);
  assert.equal(selections.length, 0);
  column.call('handleClick', 2, 64);
  column.call('handleClick', 1, 32);
  assert.equal(frames.size, 1, 'Changing selection cancels the previous animation');
  assert.deepEqual(selections, [
    ['hour', 2],
    ['hour', 1],
  ]);
  column.call('componentWillUnmount');
  assert.equal(frames.size, 0);
  const scroll = current.load('TimePicker/utils')['scrollTo'];
  const node = { scrollTop: 0 };
  const cancel = invoke(undefined, scroll, node, 120, 200);
  flushFrames();
  assert.equal(node.scrollTop, 120);
  invoke(undefined, cancel);
  const cancelled = invoke(undefined, scroll, node, 240, 200);
  assert.ok(frames.size);
  invoke(undefined, cancelled);
  flushFrames();
  assert.equal(node.scrollTop, 120);
  const oldWindow = read(globalThis, 'window');
  assert.ok(object(oldWindow));
  oldWindow['requestAnimationFrame'] = undefined;
  const fallback = invoke(undefined, scroll, node, 300, 200);
  flushFrames();
  assert.equal(node.scrollTop, 300);
  invoke(undefined, fallback);
  oldWindow['requestAnimationFrame'] = schedule;
  publicContracts();
  console.log(
    JSON.stringify({
      pickerRenderings: renderCases.length,
      panelRenderings: panelCases.length,
      footerRenderings: 6,
      historicalAB: !!old,
      controlledAndClear: true,
      formatterProtocolAndHighlight: true,
      actualTaskDefaults: true,
      immutableMoment: true,
      triggerDescendants: true,
      firstOpeningClickAndBodyListener: true,
      dateTriggerProducersAndNullRefs: true,
      animationAndCleanup: true,
      publicContracts: true,
    }),
  );
}
try {
  main();
} catch (error: unknown) {
  if (object(error) && typeof error['stdout'] === 'string') console.error(error['stdout']);
  console.error(error);
  process.exitCode = 1;
}
