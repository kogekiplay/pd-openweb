import type { ReactElement, ReactNode } from 'react';
import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const directory = 'src/pages/worksheet/components/BaseColumnHead';
const beforeRevision = process.env['BASE_COLUMN_BEFORE_REV'];
const menuBeforeRevision = process.env['COLUMN_MENU_BEFORE_REV'];
function object(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return Reflect.get(value, key);
}
function invoke(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture method');
  return Reflect.apply(fn, value, args);
}
function renderable(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(renderable);
  throw new TypeError('Invalid render node');
}
function walk(value: unknown): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...walk(value.props['children']), ...walk(value.props['popup'])];
}
function elementProps(value: unknown): Record<string, unknown> {
  if (!React.isValidElement<Record<string, unknown>>(value)) throw new TypeError('Missing actual React element');
  return value.props;
}
class NativeParent {
  className = 'sheetViewTable id-table-id';
  scrollLeft = 0;
  getBoundingClientRect() {
    return { left: 10 };
  }
  querySelector() {
    return this;
  }
}
class HtmlNode {
  style: Record<string, string | number> = {};
  children: HtmlNode[] = [];
  offsetWidth = 0;
  innerText = '';
  parentElement: { closest: () => NativeParent } | null = null;
  listeners = new Map<string, unknown>();
  removed = false;
  addEventListener(name: string, handler: unknown) {
    this.listeners.set(name, handler);
  }
  removeEventListener(name: string, handler: unknown) {
    if (this.listeners.get(name) === handler) this.listeners.delete(name);
  }
  appendChild(node: HtmlNode) {
    this.children.push(node);
    return node;
  }
  remove() {
    this.removed = true;
  }
}
const body = new HtmlNode();
Object.assign(globalThis, {
  HTMLElement: HtmlNode,
  document: { body, querySelector: () => null, createElement: () => new HtmlNode() },
  window: { dragclicktimer: undefined, isFirefox: false, shareState: {}, isPublicApp: false },
  _l: (key: string) => key,
  $: (node: unknown) => ({
    parents: () => {
      const parent = read(node, 'parentElement');
      return parent ? [invoke(parent, 'closest')] : [];
    },
    find: () => [node],
  }),
});
function fixture(old = false, revision = beforeRevision) {
  const events: unknown[][] = [];
  const timers: Array<() => void> = [];
  const draws: Record<string, unknown>[] = [];
  const shell = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-fixture': name }, renderable(props['children']));
  const Trigger = shell('Trigger'),
    Menu = shell('Menu'),
    MenuItem = shell('MenuItem'),
    Tooltip = shell('Tooltip'),
    Cell = shell('Cell');
  const cache = new Map<string, unknown>();
  function load(file: string): unknown {
    file = harness.resolveSpecTarget(path.resolve(root, file));
    file = path.relative(root, file);
    if (cache.has(file)) return cache.get(file);
    const source =
      old && revision
        ? execFileSync('git', ['show', revision + ':' + file], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(path.join(root, file), 'utf8');
    const output: { exports: unknown } = { exports: {} };
    const compiled = harness.transformSync(source, {
      filename: path.join(root, file),
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
      comments: false,
    });
    if (!compiled?.code) throw new TypeError('Missing actual Babel output');
    new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', compiled.code)(
      output,
      output.exports,
      (name: string): unknown => {
        if (name.endsWith('.less')) return {};
        if (name === 'react') return React;
        if (name === 'react-redux') return { connect: () => (component: unknown) => component };
        if (name === 'redux') return { bindActionCreators: (actions: unknown) => actions };
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-dom') return { flushSync: (fn: () => void) => fn() };
        if (name === 'react-dom/client')
          return {
            createRoot: (node: HtmlNode) => ({
              render: (element: unknown) => {
                const props = elementProps(element);
                draws.push(props);
                const row = read(props, 'row'),
                  child = new HtmlNode();
                child.offsetWidth = Number(read(row, 'measurement') || 0);
                node.children = [child];
              },
            }),
          };
        if (['lodash', 'prop-types', 'classnames'].includes(name) || name.startsWith('@babel/runtime/'))
          return require(name);
        if (name === '@rc-component/trigger') return { __esModule: true, default: Trigger };
        if (name === 'styled-components' || name === 'src/utils/typedStyled')
          return { __esModule: true, default: { div: () => shell('RowHeadColumn') } };
        if (name === 'ming-ui/antd-components') return { Tooltip };
        if (name === 'ming-ui')
          return { Menu, MenuItem, Tooltip, Icon: shell('Icon'), Input: shell('Input'), Dialog: { confirm: () => {} } };
        if (name.startsWith('ming-ui/components/'))
          return {
            __esModule: true,
            default: name.endsWith('/MenuItem')
              ? MenuItem
              : name.endsWith('/Menu')
                ? Menu
                : name.endsWith('/Tooltip')
                  ? Tooltip
                  : shell(name),
          };
        if (name === 'worksheet/components/CellControls') return { __esModule: true, default: Cell };
        if (name === 'worksheet/components/BaseColumnHead')
          return { __esModule: true, default: shell('BaseColumnHead') };
        if (name === 'worksheet/components/BaseColumnHead/getTableColumnWidth')
          return { __esModule: true, default: () => 100 };
        if (name === 'worksheet/common/Sheet/SheetContext')
          return { __esModule: true, default: React.createContext({}) };
        if (name === 'worksheet/common/WorkSheetFilter/enum')
          return { CONTROL_FILTER_WHITELIST: { text: { keys: [2] } } };
        if (name.endsWith('/WorkSheetFilter/filterControlEvents'))
          return { publishFilterControl: (...args: unknown[]) => events.push(args) };
        if (name.endsWith('/WorkSheetFilter/filterPanelBoundary')) return { headerContext: (value: unknown) => value };
        if (name === 'worksheet/constants/enum')
          return { CONTROL_EDITABLE_WHITELIST: [2], WORKSHEET_ALLOW_SET_ALIGN_CONTROLS: [2] };
        if (name === 'worksheet/redux/actions/sheetview')
          return {
            clearHiddenColumn() {},
            frozenColumn() {},
            hideColumn() {},
            saveColumnStylesToLocal() {},
            sortByControl() {},
            updateColumnStyles() {},
          };
        if (name.endsWith('/widgetConfig/config/widget') || name.endsWith('/widgetConfig/config/widget.js'))
          return {
            SYS: [],
            WIDGETS_TO_API_TYPE_ENUM: { ATTACHMENT: 14, FLAT_MENU: 11, DROP_DOWN: 9, MULTI_SELECT: 10 },
          };
        if (name === 'src/pages/worksheet/common/ViewConfig/components/BatchSet') return { showTypeData: [] };
        if (name === 'src/pages/worksheet/common/ViewConfig/config.js') return { COVER_DISPLAY_FILL: [] };
        if (name === 'worksheet/common/WorkSheetFilter/util')
          return { redefineComplexControl: (control: unknown) => control };
        if (name === 'src/pages/widgetConfig/util') return { isOtherShowFeild: () => false };
        if (name === 'src/utils/common')
          return { emitter: { emit: (...args: unknown[]) => events.push(args) }, saveLRUWorksheetConfig: () => {} };
        if (name === 'src/utils/control')
          return {
            fieldCanSort: () => true,
            controlBatchCanEdit: () => true,
            getSortData: () => [
              { value: 1, text: 'descending' },
              { value: 2, text: 'ascending' },
            ],
            controlState: () => ({ editable: true }),
            controlIsNumber: () => false,
            checkIsTextControl: () => false,
          };
        if (name.startsWith('.'))
          return load(path.relative(root, path.resolve(path.dirname(path.join(root, file)), name)));
        throw new Error('Unexpected base-column fixture dependency ' + name);
      },
      (fn: () => void) => {
        timers.push(fn);
        return timers.length;
      },
      () => {},
    );
    cache.set(file, output.exports);
    return output.exports;
  }
  const source = load(directory + '/BaseColumnHead.tsx'),
    Klass = read(source, 'default');
  function create(props: Record<string, unknown>) {
    if (typeof Klass !== 'function') throw new TypeError('Missing actual class');
    const result: unknown = Reflect.construct(Klass, [props]);
    if (!object(result)) throw new TypeError('Missing instance');
    result['setState'] = (update: unknown) => {
      const state = read(result, 'state');
      if (!object(state) || !object(update)) throw new TypeError('Invalid state');
      Object.assign(state, update);
    };
    return result;
  }
  return { create, load, Trigger, MenuItem, events, timers, draws };
}
function exercise(old = false) {
  const f = fixture(old),
    observations: unknown[] = [];
  for (const isAsc of [undefined, false, true])
    for (const disabled of [false, true])
      for (const width of [60, 200, '240']) {
        const sorts: unknown[] = [];
        const p = {
          control: { controlId: 'field', controlName: 'Field', type: 2, required: true, desc: 'Description' },
          style: { width, height: 34 },
          className: 'headAlignCenter',
          isAsc,
          disabled,
          showDropdown: true,
          showRequired: true,
          changeSort: (value: unknown) => sorts.push(value),
          updateSheetColumnWidths: () => {},
        };
        const instance = f.create(p),
          tree = invoke(instance, 'render');
        invoke(instance, 'handleChangeSort');
        observations.push({ isAsc, disabled, width, sorts, html: ReactDOM.renderToStaticMarkup(renderable(tree)) });
      }
  const widthModule = f.load(directory + '/getTableColumnWidth.tsx'),
    widthFn = read(widthModule, 'default');
  assert.equal(typeof widthFn, 'function');
  for (const measurement of [0, 30, 60, 100, 601, 1000]) {
    if (typeof widthFn !== 'function') throw new Error();
    const row = { field: { opaque: true }, measurement };
    const width = Reflect.apply(widthFn, undefined, [
      body,
      [row],
      { controlId: 'field', type: 2 },
      undefined,
      'worksheet',
    ]);
    assert.equal(
      read(read(f.draws[f.draws.length - 1], 'cell'), 'value'),
      row.field,
      'Renderer receives exact cell value reference',
    );
    observations.push({ measurement, width });
  }
  for (const isLast of [false, true])
    for (const specialNumber of [false, true])
      for (const width of [100, '240']) {
        const changes: unknown[] = [];
        const parent = new NativeParent();
        const drag = new HtmlNode();
        drag.parentElement = { closest: () => parent };
        const instance = f.create({
          control: {
            controlId: 'field',
            type: specialNumber ? 6 : 2,
            appendWidth: 5,
            advancedSetting: { showtype: '2' },
          },
          columnIndex: 3,
          isLast,
          style: { width },
          updateSheetColumnWidths: (value: unknown) => changes.push(value),
        });
        instance['drag'] = drag;
        invoke(instance, 'resizeColumn', [{ clientX: 310 }]);
        const event = f.events[f.events.length - 1];
        assert.ok(event);
        const payload = event[1];
        const callback = read(payload, 'callback');
        assert.equal(read(payload, 'target'), parent);
        if (typeof callback !== 'function') throw new TypeError('Missing actual resize callback');
        callback(350);
        f.timers.splice(0).forEach(fn => fn());
        observations.push({
          isLast,
          specialNumber,
          width,
          event: event[0],
          columnWidth: read(payload, 'columnWidth'),
          defaultLeft: read(payload, 'defaultLeft'),
          maskMinLeft: read(payload, 'maskMinLeft'),
          changes,
          scrollLeft: parent.scrollLeft,
        });
      }
  const rowHead = read(f.load(directory + '/RowHeadColumn.tsx'), 'default');
  if (typeof rowHead !== 'function') throw new TypeError('Missing actual row head');
  for (const rowIndex of [0, 9])
    for (const showNumber of [false, true])
      for (const required of [false, true]) {
        const tree: unknown = rowHead({
          control: { controlName: 'Field', required },
          style: { width: 100, height: 34 },
          rowIndex,
          showNumber,
          showRequired: true,
        });
        observations.push({ rowIndex, showNumber, required, html: ReactDOM.renderToStaticMarkup(renderable(tree)) });
      }
  const after = f.create({
    control: { type: 2, controlName: 'Field' },
    style: { width: 100, height: 34 },
    className: 'x',
  });
  const node = new HtmlNode();
  if (!object(after)) throw new Error();
  after['drag'] = node;
  invoke(after, 'componentDidMount');
  assert.ok(node.listeners.has('mousedown'));
  if (!old) {
    invoke(after, 'componentWillUnmount');
    assert.ok(!node.listeners.has('mousedown'), 'Actual React lifecycle removes resize listener');
  }
  return observations;
}
const current = exercise();
if (beforeRevision)
  assert.deepEqual(
    current,
    exercise(true),
    'Actual normal BaseColumnHead rendering/sort/width results match old source',
  );
console.log(
  'base-column: ' +
    current.length +
    ' actual source render/sort/measurement cases passed' +
    (beforeRevision ? ' with historical production Babel A/B' : ''),
);

function textContent(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (React.isValidElement<Record<string, unknown>>(value)) return textContent(value.props['children']);
  return '';
}
function exerciseMenus(old = false) {
  const f = fixture(old, menuBeforeRevision);
  const observations: unknown[] = [];
  const files = [
    'src/pages/worksheet/components/RelateRecordTable/RelateRecordTableColumnHead.tsx',
    'src/pages/worksheet/components/WorksheetTable/components/ColumnHead/ColumnHead.tsx',
  ];
  for (const file of files) {
    const Component = read(f.load(file), 'default');
    if (typeof Component !== 'function') throw new TypeError('Missing actual publisher');
    for (const columnIndex of [undefined, 0, 1, 10, 11])
      for (const fixedColumnCount of [undefined, 0, 2])
        for (const hideFrozen of [false, true]) {
          const calls: unknown[][] = [];
          const control = { controlId: 'field', controlName: 'Field', type: 2, hideFrozen, advancedSetting: {} };
          const props = {
            control,
            columnIndex,
            fixedColumnCount,
            style: { width: 100, height: 34 },
            worksheetId: 'worksheet',
            viewId: 'view',
            tableId: 'table',
            sortControls: [],
            readonly: true,
            changeSort: (value: unknown) => calls.push(['sort', value]),
            sortByControl: (value: unknown) => calls.push(['sort', value]),
            updateDefaultScrollLeft: () => calls.push(['scroll']),
            frozen: (value: unknown) => calls.push(['freeze', value]),
            frozenColumn: (value: unknown) => calls.push(['freeze', value]),
            hideColumn: (value: unknown) => calls.push(['hide', value]),
            clearHiddenColumn: () => calls.push(['clear']),
            updateSheetColumnWidths: () => {},
            saveColumnStylesToLocal: () => {},
            updateColumnStyles: () => {},
          };
          let tree: unknown;
          if (file.includes('RelateRecordTable')) {
            tree = Reflect.apply(Component, undefined, [props]);
          } else {
            const instance: unknown = Reflect.construct(Component, [props]);
            if (!object(instance)) throw new TypeError('Missing actual worksheet header');
            instance['context'] = { hideColumnFilter: false, isSingleView: false };
            tree = invoke(instance, 'render');
          }
          const renderPopup = read(elementProps(tree), 'renderPopup');
          if (typeof renderPopup !== 'function') throw new TypeError('Missing actual popup');
          const menu: unknown = renderPopup({ closeMenu: () => calls.push(['close']) });
          const items = walk(menu).filter(item => item.type === f.MenuItem);
          const labels = items.map(textContent);
          if (columnIndex === undefined) {
            assert.ok(!labels.includes('冻结'), 'A missing index must not offer an invalid freeze action');
            assert.ok(!labels.includes('解冻所有列') && !labels.includes('解冻'));
          }
          for (const item of items) {
            if (!['冻结', '解冻', '解冻所有列', '筛选', '隐藏', 'descending', 'ascending'].includes(textContent(item)))
              continue;
            const onClick = read(item.props, 'onClick');
            if (typeof onClick !== 'function') throw new TypeError('Missing actual action');
            onClick();
          }
          assert.ok(calls.every(call => call[0] !== 'freeze' || (typeof call[1] === 'number' && call[1] >= 0)));
          observations.push({
            file,
            columnIndex,
            fixedColumnCount,
            hideFrozen,
            labels,
            calls,
            html: ReactDOM.renderToStaticMarkup(renderable(menu)),
          });
        }
  }
  return observations;
}
const menus = exerciseMenus();
if (menuBeforeRevision)
  assert.deepEqual(menus, exerciseMenus(true), 'Actual publisher menus and callbacks match pre-default source');
console.log(
  'column-menus: ' +
    menus.length +
    ' actual popup/action cases passed' +
    (menuBeforeRevision ? ' with historical production Babel A/B' : ''),
);
