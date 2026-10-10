import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const moment: typeof import('moment') = require('moment');
const lodash: typeof import('lodash') = require('lodash');
const sc: typeof import('styled-components') = require('styled-components');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const generate: typeof import('@babel/generator').default = require('@babel/generator').default;
const root = path.resolve(__dirname, '../../../../..');
const beforeDirectory = process.env['PRIMITIVE_BEFORE_DIR'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return Reflect.get(value, key);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing actual method ' + key);
  return Reflect.apply(fn, value, args);
}
function state(value: unknown): Record<string, unknown> {
  const data = read(value, 'state');
  if (!object(data)) throw new Error('Invalid state');
  return data;
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(node);
  throw new TypeError('Invalid actual render result');
}
function walk(value: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  return [{ type: value['type'], props: value['props'] }, ...walk(value['props']['children'])];
}
function event(element: unknown, name: string, args: unknown[] = []): unknown {
  const props = read(element, 'props');
  if (!object(props)) throw new Error('Invalid element props');
  return call(props, name, args);
}
function find(value: unknown, id: string): { type: unknown; props: Record<string, unknown> } {
  const result = walk(value).find(
    element =>
      element.props['data-fixture'] === id || element.props['name'] === id || element.props['className'] === id,
  );
  if (!result) throw new Error('Missing actual element ' + id);
  return result;
}
function normalizedHtml(value: unknown): string {
  return ReactDOM.renderToStaticMarkup(React.createElement(React.Fragment, null, node(value)))
    .replace(/maxLength=/g, 'maxlength=')
    .replace(/sc-[a-zA-Z0-9_-]+/g, 'sc-generated-component');
}
function styledOutput(value: unknown): { html: string; css: string } {
  const sheet = new sc.ServerStyleSheet();
  try {
    const html = ReactDOM.renderToStaticMarkup(sheet.collectStyles(node(value)));
    return {
      html: html.replace(/sc-[a-zA-Z0-9_-]+/g, 'sc-generated-component'),
      css: sheet
        .getStyleTags()
        .replace(/sc-[a-zA-Z0-9_-]+/g, 'sc-generated-component')
        .replace(/data-styled\.g\d+/g, 'data-styled.g'),
    };
  } finally {
    sheet.seal();
  }
}
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  lastPatch: unknown;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(patch: unknown): void {
    this.lastPatch = patch;
    if (!object(patch)) throw new Error('Invalid state patch');
    Object.assign(this.state, patch);
  }
}
const translate = (text: string, ...args: unknown[]) =>
  text.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)]));
function selectSource(relative: string, names: string[]): string {
  const filename = path.join(root, relative);
  const parsed = harness.parser.parse(fs.readFileSync(filename, 'utf8'), { sourceType: 'module' });
  const selections: string[] = [];
  for (const item of parsed.program.body) {
    const declaration = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    if (!declaration) continue;
    if (
      declaration.type === 'VariableDeclaration' &&
      declaration.declarations.some(d => d.id.type === 'Identifier' && names.includes(d.id.name))
    )
      selections.push(generate(declaration).code);
    if (
      declaration.type === 'FunctionDeclaration' &&
      declaration.id &&
      names.includes(declaration.id.name) &&
      declaration.body
    )
      selections.push(generate(declaration).code);
  }
  assert.equal(selections.length, names.length, 'Every requested actual helper exists');
  return selections.join('\n') + '\nmodule.exports={' + names.join(',') + '};';
}
interface Loaded {
  create(name: string, props: Record<string, unknown>): unknown;
  render(name: string, instance: unknown): unknown;
  enum: unknown;
  positions: unknown[];
}
function fixture(before: boolean): Loaded {
  const cache = new Map<string, unknown>();
  let styledIndex = 0;
  // Old/current modules share deterministic component ids while executing the
  // installed SC factory and their untouched tagged-template CSS text.
  const styled = {
    get div() {
      return sc.default.div.withConfig({ componentId: 'primitive-fixture-' + styledIndex++ });
    },
  };
  const positions: unknown[] = [];
  const globals = {
    _l: translate,
    getCookie: () => undefined,
    window: { getDefaultLangKey: () => 'en' },
    $: () => ({
      css(key: unknown) {
        if (key === 'left') return '14px';
        positions.push(key);
        return undefined;
      },
    }),
  };
  const ant = require('antd');
  function UI(props: Record<string, unknown>): ReactNode {
    return React.createElement('span', null, node(props['text']), node(props['children']));
  }
  const Range = (props: Record<string, unknown>) =>
    React.createElement('input', {
      'data-fixture': 'date-range',
      disabled: Boolean(props['disabled']),
      'data-format': String(props['format']),
      value: Array.isArray(props['value'])
        ? props['value'].map(v => (moment.isMoment(v) ? v.format() : String(v))).join('|')
        : undefined,
      readOnly: true,
    });
  const TimeRange = (props: Record<string, unknown>) =>
    React.createElement('input', {
      'data-fixture': 'time-range',
      'data-format': String(props['format']),
      value: Array.isArray(props['defaultValue'])
        ? props['defaultValue'].map(v => (moment.isMoment(v) ? v.format() : String(v))).join('|')
        : undefined,
      readOnly: true,
    });
  const DateWidget = (props: Record<string, unknown>) =>
    React.createElement('input', {
      'data-fixture': 'date-widget',
      'data-type': String(props['type']),
      disabled: Boolean(props['disabled']),
      value: moment.isMoment(props['value']) ? props['value'].format() : String(props['value'] || ''),
      readOnly: true,
    });
  const TimeWidget = (props: Record<string, unknown>) =>
    React.createElement('input', {
      'data-fixture': 'time-widget',
      value: moment.isMoment(props['value']) ? props['value'].format('HH:mm:ss') : String(props['value'] || ''),
      readOnly: true,
    });
  function compile(source: string, filename: string, extra: Record<string, unknown> = {}): unknown {
    const output: { exports: unknown } = { exports: {} };
    const transformed = harness.transformSync(source, {
      filename,
      comments: false,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
    });
    assert.ok(transformed?.code);
    new Function('module', 'exports', 'require', ...Object.keys(globals), ...Object.keys(extra), transformed.code)(
      output,
      output.exports,
      (name: string): unknown => {
        if (name === 'react') return { ...React, Component };
        if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
        if (name === 'antd') return ant;
        if (['lodash', 'moment', 'prop-types', 'classnames', 'react-redux'].includes(name)) return require(name);
        if (name === 'src/utils/typedStyled' || name === 'styled-components')
          return { __esModule: true, default: styled };
        if (name === '../../primitiveTypes') return load(path.join(__dirname, 'primitiveTypes.ts'));
        if (name === '../../enum') return load(path.join(__dirname, 'enum.ts'));
        if (name === 'ming-ui')
          return {
            Checkbox: UI,
            Dropdown: (props: Record<string, unknown>) =>
              React.createElement(
                'div',
                {
                  'data-fixture': 'dropdown',
                  'data-value': String(props['value']),
                  'data-disabled': String(props['disabled']),
                },
                String(props['value'] || ''),
              ),
            Icon: UI,
            RadioGroup: (props: Record<string, unknown>) =>
              React.createElement(
                'div',
                {
                  'data-fixture': 'radio',
                  'data-checked': String(props['checkedValue']),
                  'data-disabled': String(props['disabled']),
                },
                Array.isArray(props['data']) ? props['data'].map(v => String(read(v, 'text'))).join('|') : '',
              ),
            MdAntDateRangePicker: Range,
          };
        if (name === 'ming-ui/components/TimeZoneTag') return UI;
        if (name === 'src/components/Form/DesktopForm/widgets/Date') return DateWidget;
        if (name === 'src/components/Form/DesktopForm/widgets/Time') return TimeWidget;
        if (name === 'src/ming-ui/components/mdAntPickers') return { TimePicker: { RangePicker: TimeRange } };
        if (name === 'src/pages/widgetConfig/util/setting.js') return helpers;
        if (name === 'src/utils/control') return switchHelper;
        if (name.startsWith('antd/es/date-picker/locale/')) return require(name.replace('/es/', '/lib/'));
        throw new Error('Unstubbed primitive dependency ' + name);
      },
      ...Object.values(globals),
      ...Object.values(extra),
    );
    return output.exports;
  }
  function load(filename: string): unknown {
    const found = cache.get(filename);
    if (found) return found;
    const value = compile(fs.readFileSync(filename, 'utf8'), filename);
    cache.set(filename, value);
    return value;
  }
  const rawAdvance = (data: unknown, key?: string): unknown => {
    const settings = object(data) && object(data['advancedSetting']) ? data['advancedSetting'] : {};
    if (!key) return settings;
    const value = settings[key];
    if (!value) return '';
    try {
      return JSON.parse(String(value));
    } catch {
      return '';
    }
  };
  const helpers = compile(
    selectSource('src/utils/controlCommon.ts', ['DATE_SHOW_TYPES', 'getDatePickerConfigs', 'getShowFormat']),
    'actual-date-helper.ts',
    { _: lodash, getAdvanceSetting: rawAdvance },
  );
  const defaultText = compile(
    selectSource('src/components/Form/core/enum.ts', ['DEFAULT_TEXT']),
    'actual-default-text.ts',
  );
  const switchHelper = compile(
    selectSource('src/utils/control.ts', ['getSwitchItemNames']),
    'actual-switch-helper.ts',
    { getAdvanceSetting: rawAdvance, DEFAULT_TEXT: read(defaultText, 'DEFAULT_TEXT') },
  );
  const enums = load(path.join(__dirname, 'enum.ts'));
  return {
    enum: enums,
    positions,
    create(name, props) {
      const filename =
        before && beforeDirectory
          ? path.join(beforeDirectory, name + '.tsx')
          : path.join(__dirname, 'components/contents', name + '.tsx');
      const exports = load(filename),
        component = read(exports, 'default');
      if (typeof component !== 'function') throw new Error('Missing actual primitive ' + name);
      return name === 'Date' ? Reflect.apply(component, undefined, [props]) : Reflect.construct(component, [props]);
    },
    render(name, instance) {
      return name === 'Date' ? instance : call(instance, 'render');
    },
  };
}
const current = fixture(false),
  previous = fixture(true);
const F = read(current.enum, 'FILTER_CONDITION_TYPE');
function filter(key: string): number {
  const value = read(F, key);
  assert.equal(typeof value, 'number');
  if (typeof value !== 'number') throw new Error('Invalid enum');
  return value;
}
let observations = 0;
function parity(name: string, props: Record<string, unknown>): [unknown, unknown] {
  const a = current.create(name, { ...props }),
    b = previous.create(name, { ...props });
  const outA = current.render(name, a),
    outB = previous.render(name, b);
  if (beforeDirectory) assert.equal(normalizedHtml(outA), normalizedHtml(outB), name + ' normal DOM');
  observations++;
  return [a, b];
}
// Numeric producer values include literal numbers and serialized strings. Never
// normalize their state/callback protocol just to satisfy a native input prop.
for (const type of [filter('EQ'), filter('BETWEEN'), filter('NBETWEEN')])
  for (const value of [undefined, null, '', 0, '0', 1e-7, '12.5', NaN])
    for (const disabled of [undefined, true, false])
      parity('Number', { type, value, minValue: value, maxValue: value, disabled, onChange() {} });
for (const [minValue, maxValue] of [
  ['20', '2'],
  [20, 2],
  [0, -5],
  ['0', '-5'],
  [1e-7, 1e-8],
  [null, 3],
  [undefined, ''],
]) {
  const eventsA: unknown[] = [],
    eventsB: unknown[] = [];
  const [a, b] = parity('Number', { type: filter('BETWEEN'), minValue, maxValue, value: 'keep', onChange() {} });
  for (const [target, events] of [
    [a, eventsA],
    [b, eventsB],
  ]) {
    if (!object(target) || !object(target['props'])) throw new Error('Invalid Number fixture');
    target['props']['onChange'] = (value: unknown) => {
      if (!Array.isArray(events)) throw new Error('Invalid events');
      events.push(value);
    };
    call(target, 'setValue', ['minValue', ' 20a']);
    call(target, 'setValue', ['maxValue', '2.5']);
    call(target, 'handleChange');
  }
  assert.deepEqual(eventsA, eventsB);
  assert.deepEqual(state(a), state(b));
  assert.equal(read(eventsA[0], 'value'), undefined, 'swap output does not gain a value key');
}
{
  const events: unknown[] = [];
  const n = current.create('Number', { value: 1, onChange: (v: unknown) => events.push(v) });
  const ref = state(n);
  const oldProps = read(n, 'props');
  assert.ok(object(n));
  n['props'] = { value: 2, minValue: null, maxValue: 3, onChange: (v: unknown) => events.push(v) };
  call(n, 'componentDidUpdate', [oldProps]);
  assert.equal(state(n), ref, 'Object.assign state mutation reference retained');
  assert.equal(read(n, 'lastPatch'), ref);
  const rendered = current.render('Number', n);
  event(find(rendered, 'contentsNumber3'), 'onChange', [{ target: { value: ' -3a.4 ' } }]);
  event(find(rendered, 'contentsNumber3'), 'onBlur');
  assert.equal(read(events[0], 'value'), '-3.4');
}
const dateTypes = [
  'DATE_EQ',
  'DATE_NE',
  'DATE_BETWEEN',
  'DATE_NBETWEEN',
  'DATE_GT',
  'DATE_GTE',
  'DATE_LT',
  'DATE_LTE',
  'DATEENUM',
  'NDATEENUM',
].map(filter);
for (const type of dateTypes)
  for (const showtype of ['1', '2', '3', '4', '5', '6'])
    for (const dateRange of [18, 101, 102, 1])
      parity('Date', {
        type,
        control: { type: 16, advancedSetting: { showtype } },
        value: '2026-01-02 03:04:05',
        values: ['today'],
        minValue: '2026-01-01',
        maxValue: '2026-01-02',
        dateRange,
        dateRangeType: 3,
        onChange() {},
      });
for (const dateRangeType of [1, 2, 3, '3', 4, '04', 5, 6, 11])
  for (const from of ['', 'subTotal', 2])
    parity('Date', {
      type: filter('DATE_EQ'),
      control: { type: 16, advancedSetting: { showtype: '6' } },
      dateRange: 101,
      dateRangeType,
      from,
      value: '101',
      onChange() {},
    });
for (const type of dateTypes) {
  const eventsA: unknown[] = [],
    eventsB: unknown[] = [];
  const props = {
    type,
    control: { type: 16, advancedSetting: { showtype: '6' } },
    value: '2026-01-02 03:04:05',
    dateRange: 18,
    dateRangeType: 2,
    minValue: '2026-01-01',
    maxValue: '2026-01-02',
  };
  const a = current.create('Date', { ...props, onChange: (v: unknown) => eventsA.push(v) }),
    b = previous.create('Date', { ...props, onChange: (v: unknown) => eventsB.push(v) });
  if ([filter('DATE_BETWEEN'), filter('DATE_NBETWEEN')].includes(type)) {
    const rangeA = walk(a).find(n => typeof n.props['onChange'] === 'function' && n.props['format'] !== undefined),
      rangeB = walk(b).find(n => typeof n.props['onChange'] === 'function' && n.props['format'] !== undefined);
    assert.ok(rangeA && rangeB);
    for (const value of [
      [moment('2026-01-01 12:00'), moment('2026-01-03 15:00')],
      null,
      [null, null],
      [moment('2026-01-01'), null],
      [],
    ]) {
      event(rangeA, 'onChange', [value, []]);
      event(rangeB, 'onChange', [value, []]);
    }
  } else {
    const rangesA = walk(a).filter(n => Array.isArray(n.props['data']) && n.props['hiddenValue'] !== undefined),
      rangesB = walk(b).filter(n => Array.isArray(n.props['data']) && n.props['hiddenValue'] !== undefined);
    for (const value of [18, 18.1, 18.2, 1, 2, 3, 101, 102, 10, 11, undefined, 999]) {
      event(rangesA[0], 'onChange', [value]);
      event(rangesB[0], 'onChange', [value]);
    }
    const widgetA = walk(a).find(n => n.props['notConvertZone'] === true),
      widgetB = walk(b).find(n => n.props['notConvertZone'] === true);
    assert.ok(widgetA && widgetB);
    for (const value of ['2026-01-02 03:04:05', '', null, undefined, 0]) {
      event(widgetA, 'onChange', [value]);
      event(widgetB, 'onChange', [value]);
    }
  }
  assert.deepEqual(eventsA, eventsB, 'date exact output keys/null/undefined/format');
}
for (const day of ['0', 0, '101', 101, null, undefined, ''])
  for (const dateRangeType of [5, '5', 3, 11]) {
    const aEvents: unknown[] = [],
      bEvents: unknown[] = [];
    const props = {
      type: filter('DATE_EQ'),
      dateRange: 101,
      dateRangeType,
      value: day,
      control: { type: 15, advancedSetting: { showtype: '3' } },
      values: ['today'],
    };
    const a = current.create('Date', { ...props, onChange: (v: unknown) => aEvents.push(v) }),
      b = previous.create('Date', { ...props, onChange: (v: unknown) => bEvents.push(v) });
    for (const tree of [a, b]) {
      const input = find(tree, 'contentsDate');
      event(input, 'onBlur');
      event(input, 'onChange', [{ target: { value: '12a-3' } }]);
      const unit = walk(tree).find(n => n.props['className'] === 'dateRangeType');
      assert.ok(unit);
      event(unit, 'onChange', [5]);
      const today = walk(tree).find(n => n.props['className'] === 'includeToday');
      if (today) event(today, 'onClick');
    }
    assert.deepEqual(aEvents, bEvents, 'date clamps only numeric YEAR and non-stringzero blur');
  }
for (const unit of ['1', '8', '6', undefined])
  for (const type of [filter('DATE_EQ'), filter('DATE_BETWEEN'), filter('DATE_NBETWEEN')])
    for (const disabled of [true, false])
      parity('Time', {
        type,
        disabled,
        control: { unit },
        value: '12:34:56',
        minValue: '10:00:00',
        maxValue: '15:00:00',
        onChange() {},
      });
for (const unit of ['1', '8', '6'])
  for (const type of [filter('DATE_EQ'), filter('DATE_BETWEEN')]) {
    const aEvents: unknown[] = [],
      bEvents: unknown[] = [];
    const props = { type, control: { unit }, value: '12:34:56' };
    const a = current.create('Time', { ...props, onChange: (v: unknown) => aEvents.push(v) }),
      b = previous.create('Time', { ...props, onChange: (v: unknown) => bEvents.push(v) });
    const tA = walk(current.render('Time', a)).find(n => typeof n.props['onChange'] === 'function'),
      tB = walk(previous.render('Time', b)).find(n => typeof n.props['onChange'] === 'function');
    assert.ok(tA && tB);
    if (type === filter('DATE_BETWEEN')) {
      for (const value of [[moment('10:11', 'HH:mm'), moment('12:13', 'HH:mm')], null, [null, null], []]) {
        event(tA, 'onChange', [value, []]);
        event(tB, 'onChange', [value, []]);
      }
      event(tA, 'onOpenChange', [true]);
      event(tB, 'onOpenChange', [true]);
    } else
      for (const value of ['12:34:56', '', null, undefined, 0]) {
        event(tA, 'onChange', [value]);
        event(tB, 'onChange', [value]);
      }
    assert.deepEqual(aEvents, bEvents, 'time exact callback output');
  }
for (const type of [36, 40, 41, 14, 21, 42])
  for (const filterType of [filter('EQ'), filter('NE'), filter('HASVALUE'), filter('ISNULL')])
    for (const disabled of [true, false]) {
      const aEvents: unknown[] = [],
        bEvents: unknown[] = [];
      const props = {
        type: filterType,
        disabled,
        control: { type, advancedSetting: { showtype: '2', itemnames: '[{"key":"1","value":"Custom"}]' } },
      };
      const [a, b] = parity('YesNo', { ...props, onChange() {} });
      if (!object(a) || !object(b)) throw new Error('Invalid YesNo');
      read(a, 'props');
      const ap = read(a, 'props'),
        bp = read(b, 'props');
      if (!object(ap) || !object(bp)) throw new Error('Invalid YesNo props');
      ap['onChange'] = (v: unknown) => aEvents.push(v);
      bp['onChange'] = (v: unknown) => bEvents.push(v);
      const radioA = walk(current.render('YesNo', a)).find(n => n.props['checkedValue'] !== undefined),
        radioB = walk(previous.render('YesNo', b)).find(n => n.props['checkedValue'] !== undefined);
      assert.ok(radioA && radioB);
      for (const value of [0, 1, undefined]) {
        event(radioA, 'onChange', [value]);
        event(radioB, 'onChange', [value]);
      }
      assert.deepEqual(aEvents, bEvents);
    }
for (const values of [undefined, null, [], ['one', 'one', 'two']])
  for (const disabled of [undefined, true, false]) {
    const aEvents: unknown[] = [],
      bEvents: unknown[] = [];
    const a = current.create('Text', { values, disabled, onChange: (v: unknown) => aEvents.push(v) }),
      b = previous.create('Text', { values, disabled, onChange: (v: unknown) => bEvents.push(v) });
    const propsA = read(current.render('Text', a), 'props'),
      propsB = read(previous.render('Text', b), 'props');
    assert.ok(object(propsA) && object(propsB));
    const actualSearchA = propsA['showSearch'],
      actualSearchB = propsB['showSearch'];
    call(actualSearchA, 'onSearch', ['selected']);
    call(actualSearchB, 'onSearch', ['selected']);
    call(propsA, 'onChange', [['selected']]);
    call(propsB, 'onChange', [['selected']]);
    for (const target of [a, b]) {
      call(target, 'onSearch', [' duplicate ']);
      call(target, 'onInputKeyDown', [{ key: 'Enter' }]);
      call(target, 'onSearch', ['']);
      call(target, 'onInputKeyDown', [{ key: 'Enter' }]);
      call(target, 'onChange', [['one', 'one', 'two']]);
      call(target, 'onRemove', [{ value: 'one' }]);
      call(target, 'onInputKeyDown', [{ key: 'Escape' }]);
    }
    assert.deepEqual(aEvents, bEvents);
    assert.deepEqual(state(a), state(b));
    if (beforeDirectory)
      assert.equal(
        normalizedHtml(current.render('Text', a)),
        normalizedHtml(previous.render('Text', b)),
        'actual Antd Select SSR',
      );
    for (const search of ['word', '']) {
      call(a, 'onSearch', [search]);
      call(b, 'onSearch', [search]);
      const outA = call(a, 'dropdownRender'),
        outB = call(b, 'dropdownRender');
      if (beforeDirectory) assert.deepEqual(styledOutput(outA), styledOutput(outB), 'styled text popup CSS/HTML');
    }
    const tag = { value: 'two' };
    if (beforeDirectory)
      assert.deepEqual(
        styledOutput(call(a, 'tagRender', [tag])),
        styledOutput(call(b, 'tagRender', [tag])),
        'styled tagCSS/HTML',
      );
    observations++;
  }
{
  const text = current.create('Text', { values: ['same'], onChange() {} });
  call(text, 'onSearch', ['same']);
  call(text, 'onInputKeyDown', [{ key: 'Enter' }]);
  assert.deepEqual(state(text)['values'], ['same', 'same'], 'historical duplicate Enter behavior is preserved');
  const element = call(text, 'tagRender', [{ value: 'same' }]);
  const remove = walk(element).find(n => n.props['icon'] === 'clear');
  assert.ok(remove);
  event(remove, 'onClick');
  assert.deepEqual(state(text)['values'], []);
  assert.throws(
    () => call(text, 'tagRender', [{ value: {} }]),
    /Invalid filter text tag/,
    'unknown SDK tag cannot become rendered object',
  );
  const typed = current.create('Number', {
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
    onChange() {
      throw new Error('empty update');
    },
  });
  call(typed, 'handleChange');
}
// Independent protocol expectations run even without the historical fixture.
{
  const values: unknown[] = [];
  const date = current.create('Date', {
    type: filter('DATE_EQ'),
    dateRange: 18,
    dateRangeType: 1,
    control: { type: 16, advancedSetting: { showtype: '6' } },
    onChange: (change: unknown) => values.push(change),
  });
  const menu = walk(date).find(v => v.props['hiddenValue'] !== undefined);
  assert.ok(menu);
  event(menu, 'onChange', [18]);
  assert.deepEqual(values[0], { dateRange: 18, value: undefined, values: [], dateRangeType: '3' });
  event(menu, 'onChange', [18.1]);
  assert.deepEqual(values[1], { dateRange: 18, value: undefined, values: [], dateRangeType: 1 });
  const picker = walk(date).find(v => v.props['notConvertZone'] === true);
  assert.ok(picker);
  event(picker, 'onChange', [null]);
  assert.deepEqual(values[2], { value: undefined });
  const range = current.create('Date', {
    type: filter('DATE_BETWEEN'),
    control: { type: 16, advancedSetting: { showtype: '2' } },
    onChange: (change: unknown) => values.push(change),
  });
  const rangeNode = walk(range).find(v => v.props['format'] !== undefined);
  assert.ok(rangeNode);
  event(rangeNode, 'onChange', [null, []]);
  assert.deepEqual(values[3], { minValue: undefined, maxValue: undefined });
  event(rangeNode, 'onChange', [[null, null], []]);
  assert.deepEqual(values[4], { minValue: null, maxValue: null });
  const time = current.create('Time', {
    type: filter('DATE_EQ'),
    control: { unit: '6' },
    disabled: true,
    onChange: (v: unknown) => values.push(v),
  });
  const timeNode = walk(current.render('Time', time)).find(v => typeof v.props['onChange'] === 'function');
  assert.ok(timeNode);
  assert.equal(timeNode.props['disabled'], undefined, 'legacy Time does not forward top-level disabled to widget');
  event(timeNode, 'onChange', ['']);
  assert.deepEqual(values[5], { dateRange: 18, value: undefined });
  const yesNo = current.create('YesNo', { control: { type: 36 }, onChange: (v: unknown) => values.push(v) });
  const radio = walk(current.render('YesNo', yesNo)).find(v => v.props['checkedValue'] !== undefined);
  assert.ok(radio);
  event(radio, 'onChange', [undefined]);
  assert.deepEqual(values[6], { type: filter('NE'), value: 1 });
}
console.log(
  `Primitive filters real source/state/render callbacks/ReactDOM/Antd/SC tests passed (${observations} normal render observations${beforeDirectory ? ' with historical AB' : ''})`,
);
