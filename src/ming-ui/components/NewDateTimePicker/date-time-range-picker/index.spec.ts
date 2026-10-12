import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const moment: typeof import('moment') = require('moment');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const before = process.env['MODERN_DATE_BEFORE_REV'];
const NativeDate = Date,
  fixed = Date.UTC(2026, 9, 13, 1, 12, 34);
const ClockDate = new Proxy(NativeDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [fixed], newTarget);
  },
});
Reflect.set(globalThis, 'Date', ClockDate);
moment.now = () => fixed;
Reflect.set(globalThis, '_l', (text: string, ...args: unknown[]) =>
  text.replace(/%([0-9]+)/g, (_match: string, index: string) => String(args[Number(index)] ?? '')),
);
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
function date(value: unknown): Date {
  assert.ok(value instanceof NativeDate);
  return value;
}
class NodeStub {
  nodeType = 1;
  children = new Set<unknown>();
  offsetHeight = 600;
  scrollTop = 0;
  parentElement: NodeStub | null = null;
  contains(value: unknown) {
    return value === this || this.children.has(value);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, width: 100, height: 32, right: 110, bottom: 52 };
  }
}
const listeners = new Map<string, Set<unknown>>();
Reflect.set(globalThis, 'Node', NodeStub);
Reflect.set(globalThis, 'window', {
  innerHeight: 720,
  innerWidth: 1280,
  addEventListener: (name: string, fn: unknown) => {
    const set = listeners.get(name) || new Set();
    set.add(fn);
    listeners.set(name, set);
  },
  removeEventListener: (name: string, fn: unknown) => listeners.get(name)?.delete(fn),
});
let alerts = 0;
Reflect.set(globalThis, 'alert', () => alerts++);
function fixture(revision?: string) {
  const cache = new Map<string, Record<string, unknown>>();
  const Position = (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-layer': props['visible'] ? 'open' : 'closed' },
      props['children'] as import('react').ReactNode,
    );
  const Button = (props: Record<string, unknown>) =>
    React.createElement('button', { className: props['type'] }, props['children'] as import('react').ReactNode);
  const Checkbox = (props: Record<string, unknown>) =>
    React.createElement('label', null, props['children'] as import('react').ReactNode);
  const Dropdown = (props: Record<string, unknown>) =>
    React.createElement('div', { className: 'Dropdown' }, String(props['value'] || ''));
  function load(name: string): Record<string, unknown> {
    const old = cache.get(name);
    if (old) return old;
    const extension = name.endsWith('/types') || name.endsWith('/lib/calender') ? '.ts' : '.tsx';
    const file = 'src/ming-ui/components/' + name + extension;
    const source = revision
      ? execFileSync('git', ['show', revision + ':' + file], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, file), 'utf8');
    const result = harness.transformSync(source, {
      filename: path.join(root, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(result?.code);
    const target: { exports: Record<string, unknown> } = { exports: {} };
    function imports(request: string): unknown {
      if (request.endsWith('.less')) return {};
      if (request === 'ming-ui/components/PositionContainer') return { __esModule: true, default: Position };
      if (request === 'ming-ui/components/Button' || request === '../../Button')
        return { __esModule: true, default: Button };
      if (request === '../../Checkbox') return { __esModule: true, default: Checkbox };
      if (request === '../../Dropdown') return { __esModule: true, default: Dropdown };
      if (request === 'ming-ui/components/Icon')
        return {
          __esModule: true,
          default: (props: Record<string, unknown>) => React.createElement('i', { className: props['className'] }),
        };
      if (request.startsWith('ming-ui/components/')) {
        const relative = request.slice('ming-ui/components/'.length);
        return load(
          relative +
            (relative.endsWith('/date-time') ||
            relative.endsWith('/date-time-range') ||
            relative.endsWith('/date-time-picker') ||
            relative.endsWith('/date-time-range-picker') ||
            relative.endsWith('/date-picker-base') ||
            relative.endsWith('/calender') ||
            relative === 'NewTimePicker'
              ? '/index'
              : ''),
        );
      }
      if (request.startsWith('.')) {
        let targetName = path.posix.normalize(path.posix.join(path.posix.dirname(name), request));
        if (
          !fs.existsSync(path.join(root, 'src/ming-ui/components', targetName + '.ts')) &&
          !fs.existsSync(path.join(root, 'src/ming-ui/components', targetName + '.tsx'))
        )
          targetName += '/index';
        return load(targetName);
      }
      return require(request);
    }
    new Function('module', 'exports', 'require', result.code)(target, target.exports, imports);
    cache.set(name, target.exports);
    return target.exports;
  }
  function component(name: string) {
    const exports = load(name);
    return exports['DateTimeRange'] || exports['default'];
  }
  function make(name: string, props: Record<string, unknown> = {}) {
    const type = component(name);
    if (typeof type !== 'function') throw new TypeError('Missing actual class');
    const defaults = read(type, 'defaultProps');
    const all = object(defaults) ? { ...defaults, ...props } : props;
    const value: unknown = Reflect.construct(type, [all]);
    assert.ok(object(value));
    value['setState'] = (patch: unknown, callback?: unknown) => {
      const state = read(value, 'state');
      assert.ok(object(state));
      const next = typeof patch === 'function' ? invoke(undefined, patch, state) : patch;
      assert.ok(object(next));
      value['state'] = { ...state, ...next };
      if (callback) invoke(undefined, callback);
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
    const type = component(name);
    if (typeof type !== 'function') throw new TypeError('Missing render class');
    return ReactDOM.renderToStaticMarkup(
      React.createElement(type as import('react').ComponentType<Record<string, unknown>>, props),
    );
  }
  return { load, make, markup };
}
function state(value: unknown, key: string): unknown {
  return read(read(value, 'state'), key);
}
function elements(value: unknown): import('react').ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props['children'])];
}
function publicContracts() {
  const temp = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-modern-date-contract-'));
  try {
    const source = path.join(temp, 'contract.tsx'),
      styles = path.join(temp, 'styles.d.ts'),
      config = path.join(temp, 'tsconfig.json');
    fs.writeFileSync(
      source,
      `import React from 'react';import moment from 'moment';
import DatePicker from '${root}/src/ming-ui/components/DatePicker';
import Time from '${root}/src/ming-ui/components/NewTimePicker';
export const single=<DatePicker selectedValue={0} min={moment()} format="YYYY-MM-DD" disabledDate={date=>date.isBefore(moment(),'day')} onOk={value=>value.format()} />;
export const range=<DatePicker.RangePicker selectedValue={[moment(),null]} onOk={value=>{value[0].format();value[1].format();}} />;
export const partial=<DatePicker.RangePicker mode="task" onOk={value=>{value[0]?.format();}} />;
export const clock=<Time type="hour" value={{hour:9,minute:0,second:0}} onChange={(event,value,label)=>{const selected:number=value.hour;const text:string=label;event.currentTarget.focus();void selected;void text;}} />;
// @ts-expect-error Three endpoints do not form a range.
export const tooMany=<DatePicker.RangePicker selectedValue={[moment(),moment(),moment()]} />;
// @ts-expect-error Date mode is finite.
export const mode=<DatePicker mode="quarter" />;
// @ts-expect-error Task callbacks must handle unchecked endpoints.
export const narrow=<DatePicker.RangePicker mode="task" onOk={(value:readonly[moment.Moment,moment.Moment])=>{void value;}} />;
// @ts-expect-error Clock values have numeric units.
export const badClock=<Time value={{hour:'9',minute:0,second:0}} />;
// @ts-expect-error Date predicates receive Moment values.
export const predicate=<DatePicker disabledDate={(value:string)=>!!value} />;
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
function main() {
  const current = fixture(),
    old = before ? fixture(before) : undefined;
  const start = new Date(2026, 9, 13, 9, 12, 34),
    end = new Date(2026, 9, 13, 18, 45, 12),
    clock = { hour: 9, minute: 12, second: 34 };
  const renderings: [string, Record<string, unknown>][] = [];
  for (const type of ['date', 'month', 'year']) {
    renderings.push(['NewDateTimePicker/date-picker-base/index', { type, value: start }]);
    renderings.push(['NewDateTimePicker/date-time-picker/index', { type, value: start }]);
  }
  renderings.push(['NewDateTimePicker/date-time-picker/index', { type: 'datetime', value: start, timeType: 'second' }]);
  for (const type of ['date', 'datetime', 'half'])
    renderings.push([
      'NewDateTimePicker/date-time-range-picker/index',
      {
        type,
        value: [start, end],
        config: { start: true, end: true },
        timeType: 'minute',
        halfStart: 'AM',
        halfEnd: 'PM',
      },
    ]);
  for (const mode of ['minute', 'second']) renderings.push(['NewTimePicker/index', { type: mode, value: clock }]);
  renderings.push(['NewDateTimePicker/date-time/index', { selectedValue: start }]);
  renderings.push(['NewDateTimePicker/date-time-range/index', { selectedValue: [start, end] }]);
  const normalize = (html: string) => html.replace(/ (?:aria-disabled="false"|disabled="")/g, '');
  for (const [name, props] of renderings) {
    const html = current.markup(name, props);
    if (old) assert.equal(normalize(html), normalize(old.markup(name, props)), name);
  }
  const lib = read(current.load('NewDateTimePicker/lib/calender'), 'default');
  assert.equal(invoke(lib, read(lib, 'daysOfMonth'), 2024, 1), 29);
  assert.equal(date(invoke(lib, read(lib, 'nextMonth'), new Date(2026, 11, 30))).getFullYear(), 2027);
  assert.equal(invoke(lib, read(lib, 'formatTime'), start, 'half', 'minute'), '2026-10-13');
  const picker = current.make('NewDateTimePicker/date-time-picker/index', {
    value: start,
    type: 'datetime',
    timeType: 'hour',
  });
  const actions: unknown[][] = [];
  picker.update({
    onChange: (...args: unknown[]) => actions.push(['change', ...args]),
    onOk: (...args: unknown[]) => actions.push(['ok', ...args]),
    onClear: () => actions.push(['clear']),
  });
  picker.call('buttonOnClick', {}, 'ok');
  assert.equal(start.getMinutes(), 12);
  assert.equal(date(actions[0]?.[2]).getMinutes(), 0);
  assert.equal(date(actions[0]?.[2]).getSeconds(), 0);
  assert.equal(actions[1]?.[0], 'ok');
  picker.call('buttonOnClick', {}, 'clear');
  assert.equal(actions[2]?.[2], null);
  assert.equal(actions[3]?.[0], 'clear');
  const helpers = current.load('NewDateTimePicker/types');
  const min = new Date(2026, 9, 13, 8, 30),
    max = new Date(2026, 9, 13, 10);
  const rounded = helpers['roundedDate'];
  assert.equal(date(invoke(undefined, rounded, new Date(2026, 9, 13, 8, 45), 'hour', { min, max })).getHours(), 9);
  assert.equal(
    invoke(undefined, rounded, new Date(2026, 9, 13, 8, 45), 'hour', { min, max: new Date(2026, 9, 13, 8, 50) }),
    null,
  );
  const range = current.make('NewDateTimePicker/date-time-range-picker/index', {
    value: [start, end],
    config: { start: true, end: true },
    onChange: (...args: unknown[]) => actions.push(args),
    onClear: () => actions.push(['rangeClear']),
  });
  range.call('buttonOnClick', {}, 'clear');
  assert.equal(actions.at(-2)?.[1], null);
  assert.deepEqual(actions.at(-2)?.[2], { start: false, end: false });
  assert.deepEqual(actions.at(-1), ['rangeClear']);
  const nightStart = new Date(2026, 9, 13, 22, 45),
    nightEnd = new Date(2026, 9, 13, 23, 45);
  const rollover = current.make('NewDateTimePicker/date-time-range-picker/index', {
    type: 'datetime',
    value: [nightStart, nightEnd],
    config: { start: true, end: true },
    autoFillEndTime: 2,
  });
  rollover.call('timeOnChange', null, { hour: 23, minute: 45, second: 0 }, 0);
  const finish = date(read(state(rollover.value, 'value'), '1'));
  assert.equal(finish.getDate(), 14);
  assert.equal(finish.getHours(), 1);
  assert.equal(read(read(state(rollover.value, 'endTime'), 'value'), 'hour'), finish.getHours());
  assert.equal(nightEnd.getDate(), 13);
  rollover.update({ min: new Date(2026, 9, 13) });
  assert.equal(date(read(state(rollover.value, 'value'), '1')).getDate(), 14);
  const partial = current.make('NewDateTimePicker/date-time-range-picker/index', {
    partial: true,
    value: [null, null],
    config: { start: false, end: false },
    onOk: (...args: unknown[]) => actions.push(args),
  });
  partial.call('buttonOnClick', {}, 'ok');
  assert.deepEqual(actions.at(-1)?.[0], [null, null]);
  partial.call('dateOnChange', {}, [start, end], 0);
  partial.update({ min: new Date(2026, 9, 1) });
  assert.equal(state(partial.value, 'partialStart'), true);
  assert.equal(state(partial.value, 'partialEnd'), false);
  const invalid = current.make('NewDateTimePicker/date-time-range-picker/index', {
    value: [end, start],
    config: { start: true, end: true },
    onOk: () => actions.push(['invalid']),
  });
  const oldAlerts = alerts;
  invalid.call('buttonOnClick', {}, 'ok');
  assert.equal(alerts, oldAlerts + 1);
  assert.notDeepEqual(actions.at(-1), ['invalid']);
  const time = current.make('NewTimePicker/index', { type: 'hour', value: clock });
  assert.equal(state(time.value, 'label'), '09');
  time.call('onPick', {}, { hour: 10, minute: 12, second: 34 });
  time.update({ type: 'minute' });
  assert.equal(state(time.value, 'label'), '10:12');
  time.call('componentDidMount');
  assert.equal(listeners.get('mousedown')?.size, 1);
  time.call('componentWillUnmount');
  assert.equal(listeners.get('mousedown')?.size, 0);
  const disabled = current.make('NewTimePicker/index', { disabled: true, value: clock });
  disabled.call('toggleMenuOpened');
  assert.equal(state(disabled.value, 'menuOpened'), false);
  const list = current.make('NewTimePicker/time-menu/list/index', { data: [] });
  list.call('scrollToVisibleRange');
  const menu = current.make('NewTimePicker/time-menu/index', { value: { hour: Number.NaN, minute: 0, second: 0 } });
  const hours = state(menu.value, 'hourList');
  assert.ok(Array.isArray(hours));
  assert.equal(hours.filter(item => read(item, 'current')).length, 1);
  const base = current.make('NewDateTimePicker/date-picker-base/index', { value: start });
  base.call('headerButtonOnClick', {}, 'year');
  base.update({ onChange: () => {} });
  assert.equal(state(base.value, 'mode'), 'year');
  const visible: unknown[] = [];
  const outer = current.make('NewDateTimePicker/date-time-range/index', {
    selectedValue: [start, end],
    onVisibleChange: (v: unknown) => visible.push(v),
  });
  Object.assign(outer.value, { _picker: new NodeStub() });
  outer.call('showMenu');
  outer.update({ selectedValue: [start, new Date(2026, 9, 14, 18)] });
  assert.equal(state(outer.value, 'menuOpened'), true);
  outer.call('toggleMenuOpened');
  assert.equal(visible.at(-1), false);
  const half = current.make('NewDateTimePicker/date-time-range/index', { mode: 'half', selectedValue: [start, end] });
  assert.equal(state(half.value, 'label'), '2026-10-13 ~ 2026-10-13');
  const empty = current.make('NewDateTimePicker/date-time/index', { selectedValue: 0 });
  assert.ok(date(state(empty.value, 'value')).getTime() === 0);
  const localized = current.make('NewDateTimePicker/date-time/index', {
    selectedValue: start,
    locale: { lang: { dateFormat: 'YYYY/MM/DD' } },
  });
  assert.equal(state(localized.value, 'label'), '2026/10/13');
  localized.call('onChange', {}, end);
  assert.equal(state(localized.value, 'label'), '2026/10/13');
  const disabledDay = current.make('NewDateTimePicker/calender/index', {
    value: start,
    cursor: start,
    disabledDate: (time: unknown) => date(time).getDate() === 13,
  });
  const dateRows = state(disabledDay.value, 'dateList');
  assert.ok(Array.isArray(dateRows));
  const disabledCells = dateRows.flat().filter(cell => read(cell, 'value') === 13);
  assert.ok(disabledCells.length && disabledCells.every(cell => read(cell, 'disabled') === true));
  const blockedConfirm = current.make('NewDateTimePicker/date-time-picker/index', {
    value: start,
    disabledDate: () => true,
    onOk: () => actions.push(['blockedDate']),
  });
  const blockedAlertCount = alerts;
  blockedConfirm.call('buttonOnClick', {}, 'ok');
  assert.equal(alerts, blockedAlertCount + 1);
  assert.notDeepEqual(actions.at(-1), ['blockedDate']);
  for (const file of [
    'src/components/createTask/createTask.tsx',
    'src/pages/task/components/quickCreateTask/quickCreateTask.tsx',
    'src/pages/task/containers/taskStage/taskStage.tsx',
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const body = source.match(/onOk=\{selectedValue => \{([\s\S]*?)\n\s*\}\}/)?.[1];
    assert.ok(body, 'The actual task callback is required');
    const captured = new Map<string, unknown>();
    const store = {
      data: (key: string, value: unknown) => captured.set(key, value),
      html: (value: unknown) => captured.set('html', value),
    };
    const fn: unknown = new Function(
      '$txtLastDate',
      '$createSingleDate',
      '$stageDate',
      '$',
      'formatTaskTime',
      `return (selectedValue) => {${body}};`,
    )(
      store,
      store,
      store,
      () => store,
      (...args: unknown[]) => args.join('|'),
    );
    const selected = [moment(start), null];
    invoke(undefined, fn, selected);
    assert.equal(captured.get('start'), '2026-10-13 09:00');
    assert.equal(captured.get('end'), '');
    assert.equal(selected[0]?.minutes(), 12);
    const originalAlerts = alerts;
    invoke(undefined, fn, [moment(end), moment(start)]);
    assert.equal(alerts, originalAlerts + 1);
  }
  publicContracts();
  const html = current.markup('NewDateTimePicker/date-time-range-picker/index', {
    type: 'datetime',
    value: [start, end],
    config: { start: true, end: true },
  });
  assert.equal((html.match(/timePickerGroup/g) || []).length, 2);
  assert.ok(html.includes('时间'));
  assert.ok(html.includes('09:12'));
  const style = fs.readFileSync(path.join(__dirname, 'style.less'), 'utf8');
  assert.ok(style.includes('.timePickerGroup'));
  assert.ok(/align-items:\s*center/.test(style));
  assert.ok(/text-align:\s*center/.test(style));
  assert.ok(/color:\s*var\(--color-text-title\)/.test(style));
  assert.ok(/justify-content:\s*flex-start/.test(style));
  assert.ok(/justify-content:\s*space-between/.test(style));
  assert.ok(!/position:\s*absolute/.test(style));
  console.log(
    JSON.stringify({
      renderings: renderings.length,
      historicalAB: !!old,
      calendarBounds: true,
      immutableConfirmation: true,
      hourRoundingAndBounds: true,
      rangeClear: true,
      midnightAutofill: true,
      partialEndpointsAndEditing: true,
      callbackOrder: true,
      listMissingSelection: true,
      ownedClockAndListeners: true,
      viewAndVisibilityPreserved: true,
      publicContracts: true,
      existingTimeGroups: true,
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
