const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function isTree(value: unknown): value is Tree {
  return isRecord(value) && 'type' in value && isRecord(value['props']);
}
function trees(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(trees);
  if (!isTree(value)) return [];
  return [value, ...trees(value.props['children'])];
}
function callable(value: unknown): (...args: unknown[]) => unknown {
  if (typeof value !== 'function') throw new TypeError('Expected actual source callback');
  return (...args) => Reflect.apply(value, undefined, args);
}
const effects: Array<() => unknown> = [],
  refs: Array<{ current: unknown }> = [],
  timers: Array<() => void> = [],
  trace: unknown[] = [];
let handle: Record<string, unknown> = {},
  sizeVersion = 0;
const React = {
  Fragment: 'Fragment',
  useRef(initial: unknown) {
    const reference = { current: initial };
    refs.push(reference);
    return reference;
  },
  useState(initial: unknown) {
    return [
      initial,
      (next: unknown) => {
        if (typeof next === 'function') sizeVersion = next(sizeVersion);
      },
    ];
  },
  useMemo(callback: () => unknown) {
    return callback();
  },
  useCallback(callback: unknown) {
    return callback;
  },
  useEffect(callback: () => unknown) {
    effects.push(callback);
  },
  useLayoutEffect(callback: () => unknown) {
    effects.push(callback);
  },
  useImperativeHandle(_ref: unknown, factory: () => Record<string, unknown>) {
    handle = factory();
  },
};
const jsx = (type: unknown, props: Record<string, unknown>): Tree => ({ type, props });
class ElementFixture {
  scrollLeft = 0;
  scrollTop = 0;
  clientHeight = 100;
  scrollHeight = 300;
  closest(_selector: string) {
    return null;
  }
}
class Viewport extends ElementFixture {
  addEventListener(name: string, callback: unknown) {
    trace.push(['listen', name, callback]);
  }
  removeEventListener(name: string, callback: unknown) {
    trace.push(['remove', name, callback]);
  }
}
const x = new Viewport(),
  y = new Viewport();
const root = {
  querySelector(selector: string) {
    return selector.includes('.scroll-x') ? x : y;
  },
  addEventListener(name: string, callback: unknown) {
    trace.push(['listen', name, callback]);
  },
  removeEventListener(name: string, callback: unknown) {
    trace.push(['remove', name, callback]);
  },
};
const hammerInstances: Array<{ callbacks: Map<string, unknown> }> = [];
class HammerFixture {
  static TouchInput = 'Touch';
  static DIRECTION_HORIZONTAL = 6;
  static DIRECTION_ALL = 30;
  callbacks = new Map<string, unknown>();
  constructor(element: unknown, options: unknown) {
    trace.push(['hammer', element, options]);
    hammerInstances.push(this);
  }
  get(name: string) {
    return { set: (options: unknown) => trace.push(['hammerSet', name, options]) };
  }
  on(name: string, callback: unknown) {
    this.callbacks.set(name, callback);
  }
  off(name: string, callback: unknown) {
    assert.equal(this.callbacks.get(name), callback);
    this.callbacks.delete(name);
  }
  destroy() {
    trace.push('destroyHammer');
  }
}
const windowFixture: Record<string, unknown> = { isWindows: false };
const cache = new Map<string, unknown>();
function load(file: string): Record<string, unknown> {
  const full = path.join(__dirname, file);
  const cached = cache.get(full);
  if (isRecord(cached)) return cached;
  const moduleLike: { exports: unknown } = { exports: {} };
  const code = transformFileSync(full, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  new Function(
    'require',
    'module',
    'exports',
    'window',
    'document',
    'Element',
    'setTimeout',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    code,
  )(
    (name: string) => {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-window') return { Grid: 'WindowGrid' };
      if (name === 'src/utils/typedStyled' || name === 'styled-components')
        return { __esModule: true, default: { div: () => 'Con' } };
      if (name === 'hammerjs') return { __esModule: true, default: HammerFixture };
      if (name === 'overlayscrollbars')
        return { OverlayScrollbars: () => ({ update: (force: boolean) => trace.push(['update', force]) }) };
      if (name === 'src/utils/common') return { getScrollBarWidth: () => 11 };
      if (name === 'ming-ui' || name === 'ming-ui/components/ScrollView')
        return { ScrollView: 'ScrollView', default: 'ScrollView' };
      if (name === './Grid') return { __esModule: true, default: 'Grid' };
      if (name === './ScrollBar') return { __esModule: true, default: 'ScrollBar' };
      if (name === '../Skeleton') return { __esModule: true, default: 'Skeleton' };
      if (name === './useRefCache') return load('useRefCache.ts');
      if (name === '../gridCellStyle') return load('../gridCellStyle.ts');
      if (name.endsWith('.less')) return {};
      return require(name);
    },
    moduleLike,
    moduleLike.exports,
    windowFixture,
    { body: { style: {} } },
    ElementFixture,
    (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    () => {},
  );
  assert.ok(isRecord(moduleLike.exports));
  cache.set(full, moduleLike.exports);
  return moduleLike.exports;
}
const fixed = callable(load('index.tsx')['default']);
const Grid = callable(load('Grid.tsx')['default']);
const ScrollBar = callable(load('ScrollBar.tsx')['default']);
const Cell = (props: Record<string, unknown>) => jsx('Cell', props);
const data = { rows: ['First', 'Second'], opaque: { preserved: true } };
const props = {
  width: 500,
  height: 300,
  rowCount: 20,
  columnCount: 6,
  leftFixedCount: 1,
  rightFixedCount: 1,
  showHead: true,
  showFoot: true,
  getColumnWidth: () => 150,
  rowHeight: 34,
  barWidth: 11,
  Cell,
  tableData: data,
  renderEmpty: (args: unknown) => jsx('Empty', { args }),
};
function frame(patch: Record<string, unknown> = {}) {
  effects.length = refs.length = timers.length = 0;
  const tree = fixed({ ...props, ...patch, ref: { current: null } });
  const nodes = trees(tree);
  const grids = nodes.filter(node => node.type === 'Grid');
  const dom = refs[0];
  assert.ok(dom);
  dom.current = root;
  for (const grid of grids) callable(grid.props['setRef'])({ element: new Viewport() });
  for (const scroll of nodes.filter(node => node.type === 'ScrollBar'))
    callable(scroll.props['setRef'])(scroll.props['type'] === 'x' ? x : y);
  return { tree, nodes, grids, dom, handle: { ...handle }, effectCallbacks: effects.slice() };
}
const frame1 = frame();
assert.deepEqual(
  frame1.grids.map(grid => grid.props['id']),
  [
    'top-left',
    'top-center',
    'top-right',
    'main-left',
    'main-center',
    'main-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ],
);
for (const grid of frame1.grids) {
  refs.length = 0;
  const output = Grid(grid.props);
  const windowGrid = trees(output).find(node => node.type === 'WindowGrid');
  assert.ok(windowGrid);
  const cellProps = windowGrid.props['cellProps'];
  assert.ok(isRecord(cellProps));
  const cellData = cellProps['data'];
  assert.ok(isRecord(cellData));
  assert.equal(cellData['rows'], data.rows);
  assert.equal(cellData['opaque'], data.opaque);
  const position = cellData['grid'];
  assert.ok(isRecord(position));
  for (const key of [
    'id',
    'tableColumnCount',
    'leftFixed',
    'rightFixed',
    'topFixed',
    'bottomFixed',
    'rightFixedCount',
    'leftFixedCount',
  ])
    assert.ok(key in position);
  const normalized = callable(windowGrid.props['cellComponent'])({
    ...cellProps,
    columnIndex: 0,
    rowIndex: 0,
    ariaAttributes: { role: 'gridcell' },
    style: { left: 0, transform: 'translate(20px, 34px)', width: 150, height: 34 },
  });
  assert.ok(isTree(normalized));
  assert.ok(!('ariaAttributes' in normalized.props));
  assert.deepEqual(normalized.props['style'], { left: 20, top: 34, width: 150, height: 34 });
  assert.equal(normalized.props['data'], cellData);
  const width = callable(windowGrid.props['columnWidth']);
  assert.equal(width(0), 150);
  const api = { element: new Viewport() };
  callable(windowGrid.props['gridRef'])(api);
}
assert.equal(
  Grid({
    ...frame1.grids[0]?.props,
    width: 0,
    leftFixedCount: 0,
    rightFixedCount: 0,
    id: 'main-center',
    columnCount: 0,
  }),
  undefined,
);
callable(frame1.handle['forceUpdate'])();
assert.equal(sizeVersion, 1);
callable(frame1.handle['setScroll'])(70, 80);
assert.equal(x.scrollLeft, 70);
assert.equal(y.scrollTop, 80);
const cache1 = windowFixture['cache'];
assert.ok(isRecord(cache1));
callable(frame1.handle['setScrollX'])(130);
assert.equal(x.scrollLeft, 70, 'Grid-only setScrollX never writes slider viewport');
for (const name of ['top-center', 'main-center', 'bottom-center']) {
  const entry: unknown = cache1[name];
  assert.ok(isRecord(entry));
  const element = entry['element'];
  assert.ok(element instanceof Viewport);
  assert.equal(element.scrollLeft, 130);
}
const vertical = frame1.nodes.find(node => node.type === 'ScrollBar' && node.props['type'] === 'y');
assert.ok(vertical);
callable(vertical.props['setScrollY'])(-10);
for (const name of ['main-left', 'main-center', 'main-right']) {
  const entry: unknown = cache1[name];
  assert.ok(isRecord(entry));
  const element = entry['element'];
  assert.ok(element instanceof Viewport);
  assert.equal(element.scrollTop, 0);
}
const scrollTrace: unknown[] = [];
const scroll = ScrollBar({
  type: 'x',
  barWidth: 11,
  onScroll: (instance: unknown) => scrollTrace.push(instance),
  setScrollX: (left: unknown) => scrollTrace.push(left),
  setRef: () => {},
});
assert.ok(isTree(scroll));
const instance = {
  elements() {
    assert.equal(this, instance);
    return { scrollOffsetElement: x };
  },
};
callable(scroll.props['customScroll'])(instance);
assert.deepEqual(scrollTrace, [instance, 70]);
const cleanups = frame1.effectCallbacks.map(callback => callback()).filter(value => typeof value === 'function');
timers.splice(0).forEach(callback => callback());
assert.equal(hammerInstances.length, 1);
const hammer = hammerInstances[0];
assert.ok(hammer);
callable(hammer.callbacks.get('panmove'))({ deltaX: 5, deltaY: 30 });
assert.equal(y.scrollTop, 50);
callable(hammer.callbacks.get('panend'))();
cleanups.forEach(callback => callable(callback)());
assert.ok(trace.includes('destroyHammer'));
const empty = frame({ rowCount: 0 });
assert.deepEqual(
  empty.grids.map(grid => grid.props['id']),
  ['top-left', 'top-center', 'top-right'],
);
assert.ok(empty.nodes.some(node => node.type === 'Empty'));
const loading = frame({ loading: true });
assert.deepEqual(
  loading.grids.map(grid => grid.props['id']),
  ['top-left', 'top-center', 'top-right'],
);
assert.ok(loading.nodes.some(node => node.type === 'Skeleton'));
const mask = frame({ showLoadingMask: true, loadingMaskChildren: 'Blocked' });
assert.ok(mask.nodes.some(node => node.props['children'] === 'Blocked'));
const reversed = frame({ tableData: { rows: data.rows.slice().reverse() } });
const sorted = reversed.grids.find(grid => grid.props['id'] === 'main-center');
assert.ok(sorted);
assert.ok(isRecord(sorted.props['tableData']));
assert.deepEqual(sorted.props['tableData']['rows'], ['Second', 'First']);
assert.deepEqual(data.rows, ['First', 'Second']);
const withoutData = frame({ tableData: undefined });
assert.ok(
  withoutData.grids.every(
    grid => isRecord(grid.props['tableData']) && Object.keys(grid.props['tableData']).length === 0,
  ),
);
const hook = callable(load('useRefCache.ts')['useRefCache']);
const pair = hook({ value: 1, optional: 'yes' });
assert.ok(Array.isArray(pair));
const current = pair[0];
assert.ok(isRecord(current));
callable(pair[1])('value', 2);
assert.equal(current['value'], 2);
callable(pair[1])('optional', undefined);
assert.ok(!('optional' in current));
console.log(
  'Actual FixedTable nine grids, normalized cells, cache identity/mutate/delete, public refs, scrollbar/pan, empty/loading and row reorder passed',
);
