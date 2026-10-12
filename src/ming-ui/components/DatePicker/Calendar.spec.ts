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
const before = process.env['CALENDAR_BEFORE_REV'];
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
Reflect.set(globalThis, 'Node', NodeStub);

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
    const extension =
      name === 'TimePicker/utils' || name === 'DatePicker/locale/zh_CN' || name === 'DatePicker/types' ? '.ts' : '.tsx';
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
        request === 'ming-ui/components/Checkbox'
      )
        return { __esModule: true, default: Position };
      if (request === 'ming-ui/components/ClickAway')
        return { __esModule: true, default: { wrap: (component: unknown) => component } };
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
      const state = read(value, 'state');
      assert.ok(object(state));
      const next = typeof patch === 'function' ? invoke(undefined, patch, state) : patch;
      assert.ok(object(next));
      value['state'] = { ...state, ...next };
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

function elements(value: unknown): import('react').ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props['children'])];
}
function date(value: unknown): import('moment').Moment {
  assert.ok(moment.isMoment(value));
  return value;
}
function state(value: unknown, key: string): unknown {
  return read(read(value, 'state'), key);
}
function publicContracts() {
  const temp = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-calendar-contract-'));
  try {
    const source = path.join(temp, 'contract.tsx'),
      styles = path.join(temp, 'styles.d.ts'),
      config = path.join(temp, 'tsconfig.json');
    fs.writeFileSync(
      source,
      `import React from 'react'; import moment from 'moment';
import DatePicker from '${root}/src/ming-ui/components/DatePicker/DatePicker';
import RangePicker from '${root}/src/ming-ui/components/DatePicker/RangePicker';
import Calendar from '${root}/src/ming-ui/components/DatePicker/Calendar';
import CalendarRange from '${root}/src/ming-ui/components/DatePicker/CalendarRange';
import DateTable from '${root}/src/ming-ui/components/DatePicker/DateTable';
import DateDropdDown from '${root}/src/ming-ui/components/DatePicker/DateDropdDown';
export const single=<DatePicker selectedValue={moment()} onSelect={(value,cause)=>{value?.format();const source:string|undefined=cause.source;void source;}} />;
export const range=<RangePicker selectedValue={[moment(),null]} halfData={['AM','PM']} onOk={(values,halves)=>{values[0]?.format();void halves;}} />;
export const inputs=<CalendarRange selectedValue={['2026-10-12',0]} onSelect={values=>{const item:moment.Moment|null|undefined=values[0];void item;}} />;
export const clear=<Calendar value={null} selectedValue={undefined} />;
export const table=<DateTable value={moment()} selectedValue={[moment(),null]} />;
export const dropdown=<DateDropdDown data={[{text:'one',value:1}]} onChange={value=>{const selected:number|'customDate'=value;void selected;}} />;
// @ts-expect-error Single dates are Moment values.
export const invalidSingle=<DatePicker selectedValue="2026-10-12" />;
// @ts-expect-error Ranges contain at most two dates.
export const tooMany=<RangePicker selectedValue={[moment(),moment(),moment()]} />;
// @ts-expect-error Half-day values are AM or PM.
export const wrongHalf=<CalendarRange halfData={['morning','PM']} />;
// @ts-expect-error Table requires a real Moment anchor.
export const wrongAnchor=<DateTable value="today" />;
// @ts-expect-error Callbacks must accept a null clear value.
export const narrow=<Calendar onSelect={(value:moment.Moment)=>{void value;}} />;
// @ts-expect-error Numeric option callbacks must also accept the custom action.
export const narrowMenu=<DateDropdDown data={[{text:'one',value:1}]} onChange={(value:number)=>{void value;}} />;
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
    previous = before ? fixture(before) : undefined;
  const anchor = moment.utc('2026-10-12T09:12:34Z'),
    end = anchor.clone().add(2, 'days');
  const cases: [string, Record<string, unknown>][] = [];
  for (const mode of ['date', 'datetime', 'month', 'year'])
    cases.push(['DatePicker/Calendar', { value: anchor, mode }]);
  cases.push(['DatePicker/Calendar', { value: anchor, allowClear: false }]);
  for (const mode of ['default', 'task', 'halfday'])
    cases.push(['DatePicker/CalendarRange', { selectedValue: [anchor, end], timePicker: mode === 'task', mode }]);
  cases.push(['DatePicker/CalendarRange', {}]);
  cases.push(['DatePicker/DatePicker', { selectedValue: anchor, timePicker: true }]);
  cases.push([
    'DatePicker/DatePicker',
    { selectedValue: anchor, disabled: true, children: React.createElement('button', null, 'Date') },
  ]);
  cases.push(['DatePicker/RangePicker', { selectedValue: [anchor, end], separator: ' / ' }]);
  cases.push(['DatePicker/RangePicker', { selectedValue: [], children: React.createElement('button', null, 'Range') }]);
  cases.push(['DatePicker/MonthTable', { value: 10 }]);
  cases.push(['DatePicker/YearTable', { value: 2026, page: 2017 }]);
  for (const [name, props] of cases) {
    const html = current.markup(name, props);
    if (previous) assert.equal(html, previous.markup(name, props), name);
  }
  const emptySelection = current.make('DatePicker/Calendar', { value: anchor, selectedValue: null });
  assert.equal(state(emptySelection.value, 'selectedValue'), null);
  assert.ok(
    !current.markup('DatePicker/Calendar', { value: anchor, selectedValue: null }).includes('Calendar-selected-date'),
  );
  if (previous) {
    assert.equal(
      state(previous.make('DatePicker/Calendar', { value: anchor, selectedValue: null }).value, 'selectedValue'),
      anchor,
    );
  }
  const callbacks: unknown[][] = [];
  const controlled = current.make('DatePicker/Calendar', {
    value: anchor,
    selectedValue: anchor,
    onChange: (...args: unknown[]) => callbacks.push(['change', ...args]),
    onSelect: (...args: unknown[]) => callbacks.push(['select', ...args]),
    onClear: () => callbacks.push(['clear']),
  });
  controlled.call('yearChanged', {}, 2027);
  assert.equal(anchor.year(), 2026);
  assert.equal(date(callbacks[0]?.[1]).year(), 2027);
  assert.equal(state(controlled.value, 'value'), anchor);
  assert.equal(read(callbacks[1]?.[2], 'source'), 'yearTable');
  controlled.call('monthChanged', {}, 2);
  assert.equal(anchor.month(), 9);
  assert.equal(date(callbacks[2]?.[1]).month(), 1);
  controlled.call('onClear');
  assert.equal(callbacks[4]?.[1], null);
  assert.equal(callbacks[5]?.[0], 'clear');
  if (previous) {
    const oldAnchor = anchor.clone(),
      oldCalendar = previous.make('DatePicker/Calendar', { value: oldAnchor });
    oldCalendar.call('yearChanged', {}, 2027);
    assert.equal(oldAnchor.year(), 2027, 'Old year selection mutated the caller Moment');
  }
  const tableSelections: unknown[] = [];
  const body = current.make('DatePicker/DateTBody', {
    value: anchor,
    prefixCls: 'Calendar',
    disabledDate: (v: unknown) => date(v).date() === 13,
    onSelect: (v: unknown) => tableSelections.push(v),
  });
  const cells = elements(body.render()).filter(el => typeof el.props['title'] === 'string');
  assert.equal(cells.length, 42);
  const blocked = cells.find(el => el.props['title'] === '13' && !String(el.props['className']).includes('last-month'));
  assert.ok(blocked);
  assert.equal(blocked.props['onClick'], undefined);
  const available = cells.find(el => el.props['title'] === '14' && typeof el.props['onClick'] === 'function');
  assert.ok(available);
  invoke(undefined, available.props['onClick']);
  assert.equal(date(tableSelections[0]).date(), 14);
  assert.equal(anchor.date(), 12);
  const years = current.make('DatePicker/YearTable').call('renderList');
  const numbers = elements(years).map(el => el.props['children']);
  assert.equal(numbers.length, 16);
  assert.ok(numbers.every(v => typeof v === 'number' && Number.isFinite(v)));
  assert.ok(numbers.includes(new Date().getFullYear()));
  if (previous)
    assert.ok(
      elements(previous.make('DatePicker/YearTable').call('renderList')).every(el => Number(el.props['children']) < 16),
      'Old missing page rendered 0..15',
    );
  const halves = Object.freeze(['AM', 'PM']);
  const rangeCalls: unknown[][] = [];
  const range = current.make('DatePicker/CalendarRange', {
    halfData: halves,
    onSelect: (...args: unknown[]) => rangeCalls.push(args),
  });
  range.call('onStartDateSelect', anchor);
  range.call('onEndDateSelect', end);
  assert.equal(date(read(state(range.value, 'selectedValue'), '0')).date(), 12);
  range.call('toggleValue', 'start', false);
  assert.equal(read(state(range.value, 'selectedValue'), '0'), null);
  range.call('toggleValue', 'start', true);
  assert.equal(date(read(state(range.value, 'selectedValue'), '0')).valueOf(), anchor.valueOf());
  range.call('halfOnChange', 'PM', 'start');
  assert.deepEqual(halves, ['AM', 'PM']);
  assert.deepEqual(state(range.value, 'halfData'), ['PM', 'PM']);
  assert.deepEqual(rangeCalls.at(-1)?.[2], ['PM', 'PM']);
  range.update({ halfData: ['AM', 'AM'] });
  assert.deepEqual(state(range.value, 'halfData'), ['AM', 'AM']);
  range.call('clear');
  assert.deepEqual(state(range.value, 'selectedValue'), []);
  const normalized = current.make('DatePicker/CalendarRange', {
    selectedValue: [anchor, end],
    onOk: (...args: unknown[]) => rangeCalls.push(args),
  });
  normalized.update({ selectedValue: [0, '2026-10-12'] });
  assert.equal(date(read(state(normalized.value, 'selectedValue'), '0')).valueOf(), 0);
  normalized.call('onOk');
  let alerts = 0;
  Reflect.set(globalThis, 'alert', () => alerts++);
  normalized.update({ selectedValue: [end, anchor] });
  const beforeOk = rangeCalls.length;
  normalized.call('onOk');
  assert.equal(alerts, 1);
  assert.equal(rangeCalls.length, beforeOk);
  assert.equal(state(normalized.value, 'waingAble'), true);
  const defaults = current.make('DatePicker/CalendarRange', { defaultValue: [anchor, end] });
  assert.equal(date(defaults.call('getStartValue')).valueOf(), anchor.valueOf());
  defaults.update({ value: [end, anchor] });
  assert.equal(date(defaults.call('getStartValue')).valueOf(), end.valueOf());
  const order: unknown[] = [];
  const receiver = { name: 'calendar' };
  const selection = [anchor, end];
  const picker = current.make('DatePicker/Picker', {
    children: () => React.createElement('button'),
    calendar: React.createElement('div', {
      onSelect: function (this: unknown, ...args: unknown[]) {
        order.push(this, args);
      },
    }),
  });
  const calendar = picker.call('getCalendarElement');
  assert.ok(React.isValidElement<Record<string, unknown>>(calendar));
  invoke(receiver, calendar.props['onSelect'], selection, { source: 'dateTable' }, halves);
  assert.equal(order[0], receiver);
  assert.deepEqual(order[1], [selection, { source: 'dateTable' }, halves]);
  assert.equal(state(picker.value, 'value'), selection);
  assert.equal(state(picker.value, 'visible'), true);
  const payload = { id: 'opaque' },
    menuCalls: unknown[] = [];
  const menu = current.make('DatePicker/DateDropdDown', {
    data: [
      { text: 'object', value: payload },
      { text: 'blocked', value: 2, disabled: true },
    ],
    onChange: (v: unknown) => menuCalls.push(v),
  });
  menu.call('handleChange', payload);
  menu.call('handleChange', 2);
  menu.call('handleSelectRange');
  assert.equal(menuCalls[0], payload);
  assert.deepEqual(menuCalls.slice(1), ['customDate']);
  publicContracts();
  console.log(
    JSON.stringify({
      renderings: cases.length,
      historicalAB: !!previous,
      immutableCalendar: true,
      gridAndDisabledDates: true,
      yearFallback: true,
      uncontrolledRangeAndTaskMemory: true,
      serializedPropUpdatesAndEpoch: true,
      halfDayOwnershipAndUpdates: true,
      rangeOrdering: true,
      defaultAndControlledAnchors: true,
      chainedCallbackProtocol: true,
      genericMenuIdentity: true,
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
