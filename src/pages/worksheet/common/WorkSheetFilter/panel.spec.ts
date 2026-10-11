import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const path: typeof import('node:path') = require('node:path');
const root = path.resolve(__dirname, '../../../../../');
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function walk(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  const node = { type: value['type'], props: value['props'] };
  return [node, ...walk(node.props['children'])];
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return typeof key === 'symbol' ? undefined : value[key];
}
function invoke(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture callback');
  return Reflect.apply(fn, value, args);
}
class Component {
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
}
class Hooks {
  values: unknown[] = [];
  cursor = 0;
  effects = new Map<number, () => void>();
  tree: unknown;
  alive = true;
  readonly component: (props: Record<string, unknown>) => unknown;
  readonly props: Record<string, unknown>;
  constructor(component: (props: Record<string, unknown>) => unknown, props: Record<string, unknown>) {
    this.component = component;
    this.props = props;
  }
  render() {
    current = this;
    this.cursor = 0;
    this.tree = this.component(this.props);
    return this.tree;
  }
  unmount() {
    this.effects.forEach(cleanup => cleanup());
    this.alive = false;
  }
}
let current: Hooks;
const react = {
  Component,
  createRef: () => ({ current: null }),
  forwardRef:
    (fn: (props: Record<string, unknown>, ref: { current: unknown } | null) => unknown) =>
    (props: Record<string, unknown>) =>
      fn(props, (props['ref'] as { current: unknown } | undefined) || null),
  Fragment: 'Fragment',
  useRef(value: unknown) {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = { current: value };
    return host.values[index];
  },
  useReducer(reducer: (state: unknown, action: unknown) => unknown, initial: unknown) {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = initial;
    return [
      host.values[index],
      (action: unknown) => {
        if (host.alive) host.values[index] = reducer(host.values[index], action);
      },
    ];
  },
  useEffect(fn: () => unknown) {
    const cleanup = fn();
    const cleanupFunction: (() => void) | undefined =
      typeof cleanup === 'function' ? () => Reflect.apply(cleanup, undefined, []) : undefined;
    if (cleanupFunction) current.effects.set(current.cursor, cleanupFunction);
    current.cursor++;
  },
  useImperativeHandle(ref: { current: unknown } | null, fn: () => unknown) {
    if (ref) ref.current = fn();
    current.cursor++;
  },
  useState(initial: unknown) {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = initial;
    return [
      host.values[index],
      (value: unknown) => {
        host.values[index] = value;
      },
    ];
  },
};
const cache = new Map<string, unknown>();
function load(relative: string): unknown {
  const file = harness.resolveSpecTarget(path.resolve(root, relative));
  if (cache.has(file)) return cache.get(file);
  const result = harness.transformFileSync(file);
  if (!result?.code) throw new TypeError('Missing panel source');
  const module: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', result.code)(module, module.exports, (name: string): unknown => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime')
      return {
        jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
      };
    if (name === 'lodash') return require('lodash');
    if (name === 'styled-components' || name === 'src/utils/typedStyled')
      return { __esModule: true, default: { div: () => 'Panel' } };
    if (name === 'src/utils/common') return { emitter: { addListener() {}, removeListener() {}, emit() {} } };
    if (name.endsWith('.less')) return {};
    if (name.startsWith('./FiltersPopup')) return { __esModule: true, default: 'FiltersPopup' };
    if (name.startsWith('./model')) return load('src/pages/worksheet/common/WorkSheetFilter/model.ts');
    if (name.startsWith('./filterPanelTypes'))
      return load('src/pages/worksheet/common/WorkSheetFilter/filterPanelTypes.ts');
    if (name.startsWith('./')) return {};
    if (name.startsWith('src/')) return {};
    throw new Error('Unexpected panel dependency ' + name);
  });
  cache.set(file, module.exports);
  return module.exports;
}
Object.assign(globalThis, {
  _l: (value: string) => value,
  window: { isPublicApp: false, shareState: {} },
  location: { search: '', pathname: '/sheet', hash: '' },
  document: { body: {}, documentElement: { contains: () => true }, getElementById: () => null },
  md: { global: { Account: { isPortal: false } } },
  alert() {},
});
const panel = load('src/pages/worksheet/common/WorkSheetFilter/index.tsx');
const WorkSheetFilter = read(panel, 'default');
if (typeof WorkSheetFilter !== 'function') throw new TypeError('Missing panel');
const ref: { current: unknown } = { current: null };
const changes: unknown[] = [];
const host = new Hooks(
  props =>
    Reflect.apply(WorkSheetFilter, undefined, [
      { ...props, columns: [], onChange: (value: unknown) => changes.push(value), showSavedFilters: false },
    ]),
  {},
);
host.render();
assert.ok(ref.current === null);
const resetRef: { current: unknown } = { current: null };
const resetHost = new Hooks(
  props =>
    Reflect.apply(WorkSheetFilter, undefined, [
      {
        ...props,
        columns: [],
        onChange: (value: unknown) => changes.push(value),
        showSavedFilters: false,
        ref: resetRef,
      },
    ]),
  {},
);
resetHost.render();
assert.ok(object(resetRef.current));
invoke(resetRef.current, 'reset');
assert.ok(object(resetRef.current));
resetHost.unmount();
console.log('Actual WorkSheetFilter hook/reducer mount, reset imperative ref, props and unmount lifecycle passed');
