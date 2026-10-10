import type { CascaderHandle, CascaderOption, CascaderProps, CascaderValue } from './types';

const assert = require('node:assert/strict');
const path = require('node:path');
const lodash = require('lodash');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
interface Effect {
  deps: unknown[] | undefined;
  cleanup?: (() => void) | undefined;
}
interface HookRuntime {
  values: unknown[];
  effects: Map<number, Effect>;
  callbacks: Map<number, { deps: unknown[] | undefined; value: unknown }>;
  pending: Array<() => void>;
  cursor: number;
  dirty: boolean;
  alive: boolean;
  lateUpdates: number;
}
let current: HookRuntime;
class Hooks<P = CascaderProps> {
  values: unknown[] = [];
  effects = new Map<number, Effect>();
  callbacks = new Map<number, { deps: unknown[] | undefined; value: unknown }>();
  pending: Array<() => void> = [];
  cursor = 0;
  dirty = false;
  alive = true;
  lateUpdates = 0;
  tree: Tree = { type: '', props: {} };
  ref: { current: CascaderHandle | null } = { current: null };
  component: (props: P, ref: { current: CascaderHandle | null }) => Tree;
  props: P;
  constructor(component: Hooks<P>['component'], props: P) {
    this.component = component;
    this.props = props;
  }
  render() {
    current = this;
    this.cursor = 0;
    this.dirty = false;
    this.tree = this.component(this.props, this.ref);
    this.pending.splice(0).forEach(effect => effect());
    return this.tree;
  }
  flush() {
    for (let i = 0; this.dirty && i < 15; i++) this.render();
    return this.tree;
  }
  unmount() {
    this.effects.forEach(effect => effect.cleanup?.());
    this.alive = false;
  }
}
function equal(a: unknown[] | undefined, b: unknown[] | undefined) {
  return !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}
function useState(initial: unknown) {
  const host = current,
    index = host.cursor++;
  if (!(index in host.values)) host.values[index] = typeof initial === 'function' ? initial() : initial;
  return [
    host.values[index],
    (value: unknown) => {
      if (!host.alive) {
        host.lateUpdates++;
        return;
      }
      const next = typeof value === 'function' ? value(host.values[index]) : value;
      if (!Object.is(next, host.values[index])) {
        host.values[index] = next;
        host.dirty = true;
      }
    },
  ];
}
function useRef(initial: unknown) {
  const host = current,
    index = host.cursor++;
  if (!(index in host.values)) host.values[index] = { current: initial };
  return host.values[index];
}
function useMemo(callback: () => unknown, deps?: unknown[]) {
  const host = current,
    index = host.cursor++,
    old = host.callbacks.get(index);
  if (old && equal(old.deps, deps)) return old.value;
  const value = callback();
  host.callbacks.set(index, { deps, value });
  return value;
}
function useEffect(callback: () => void | (() => void), deps?: unknown[]) {
  const host = current,
    index = host.cursor++,
    old = host.effects.get(index);
  if (old && equal(old.deps, deps)) return;
  host.pending.push(() => {
    old?.cleanup?.();
    const cleanup = callback();
    host.effects.set(index, { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined });
  });
}
const React = {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback: (fn: () => unknown, deps: unknown[]) => useMemo(() => fn, deps),
  forwardRef: (fn: unknown) => fn,
  Fragment: 'Fragment',
  useImperativeHandle: (ref: { current: unknown }, callback: () => unknown, deps: unknown[]) => {
    const handle = useMemo(callback, deps);
    ref.current = handle;
  },
};
interface ApiRequest {
  args: Record<string, unknown>;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(value: unknown): void;
  aborted: number;
}
const apiRequests: ApiRequest[] = [];
function apiRequest(args: Record<string, unknown>) {
  let resolve: (value: unknown) => void = () => {},
    reject: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const item = { args, promise, resolve, reject, aborted: 0 };
  apiRequests.push(item);
  return Object.assign(promise, {
    abort() {
      item.aborted++;
    },
  });
}
const cache = new Map<string, unknown>();
function load(file: string): unknown {
  const full = path.join(__dirname, file);
  if (cache.has(full)) return cache.get(full);
  const result = { exports: {} };
  new Function('module', 'exports', 'require', transformFileSync(full).code)(result, result.exports, (name: string) => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime')
      return {
        jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
      };
    if (name === 'lodash') return lodash;
    if (name === 'classnames')
      return (...values: unknown[]) => values.filter(value => typeof value === 'string').join(' ');
    if (name === 'src/utils/typedStyled' || name === 'styled-components')
      return { __esModule: true, default: { div: () => 'Wrapper' } };
    if (name === 'src/api/worksheet') return { __esModule: true, default: { chooseRelationRows: apiRequest } };
    if (name === 'src/components/restrictAccessStatus') return { __esModule: true, default: 'Restrict' };
    if (name === 'src/pages/worksheet/common/WorkSheetFilter/util') return { getFilter: () => [] };
    if (name === 'src/utils/control')
      return {
        checkCellIsEmpty: (value: unknown) => !value,
        renderText: (control: Record<string, unknown>) => control['value'],
      };
    if (name.endsWith('core/useFormEventManager')) return { useWidgetEvent() {} };
    if (name === 'ming-ui/antd-components/Cascader') return { __esModule: true, default: 'Cascader' };
    if (name === 'ming-ui/antd-components/Cascader/boundary') return load('boundary.ts');
    if (name === 'prop-types') return require('prop-types');
    if (name === 'antd') return { TreeSelect: { SHOW_ALL: 'all' }, Checkbox: 'Checkbox', Input: 'Input', Spin: 'Spin' };
    if (name === '@ant-design/icons') return { LoadingOutlined: 'Loading' };
    if (name === '@rc-component/trigger') return { __esModule: true, default: 'Trigger' };
    if (name === 'ming-ui') return { Icon: 'Icon' };
    if (name === './boundary')
      return file.includes('DesktopForm')
        ? load('../../../components/Form/DesktopForm/widgets/Cascader/boundary.ts')
        : load('boundary.ts');
    if (/\.(less|css)$/.test(name)) return {};
    throw new Error('Unexpected Cascader dependency: ' + name);
  });
  cache.set(full, result.exports);
  return result.exports;
}
Object.assign(globalThis, {
  $: () => [],
  safeParse: (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  },
  _l: (text: string) => text,
  window: { isMacOs: false },
});
const moduleAbi = load('index.tsx') as { default: Hooks['component'] };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isTree(value: unknown): value is Tree {
  return record(value) && 'type' in value && record(value['props']);
}
function walk(value: unknown): Tree[] {
  if (!isTree(value)) return [];
  const tree: Tree = value;
  const children = tree.props['children'];
  return [tree, ...(Array.isArray(children) ? children : [children]).flatMap(walk)];
}
function popup(host: Hooks): Tree {
  const render = host.tree.props['popup'];
  if (typeof render !== 'function') throw new Error('Missing real popup callback');
  return render();
}
function option(host: Hooks, label: string): Tree {
  const item = walk(popup(host)).find(
    tree =>
      tree.props['className'] === 'cascader-option' && walk(tree).some(child => child.props['children'] === label),
  );
  if (!item) throw new Error('Missing option ' + label);
  return item;
}
function click(tree: Tree) {
  const onClick = tree.props['onClick'];
  if (typeof onClick !== 'function') throw new Error('Missing actual click');
  onClick({ stopPropagation() {} });
}
function show(host: Hooks, visible: boolean) {
  const callback = host.tree.props['onPopupVisibleChange'];
  if (typeof callback !== 'function') throw new Error('Missing popup callback');
  callback(visible);
  host.flush();
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {},
    reject: (value: unknown) => void = () => {};
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

async function run() {
  const changes: CascaderValue[][] = [],
    visibility: boolean[] = [];
  const child: CascaderOption = { value: 'child', label: 'Child', isLeaf: true, opaque: { id: 7 } };
  const parent: CascaderOption = { value: 'parent', label: 'Parent', children: [child], isLeaf: false };
  const host = new Hooks(moduleAbi.default, {
    options: [parent],
    searchValue: '',
    onChange: value => changes.push(value),
    onDropdownVisibleChange: visible => visibility.push(visible),
  });
  host.render();
  host.flush();
  show(host, true);
  click(option(host, 'Parent'));
  host.flush();
  click(option(host, 'Child'));
  host.flush();
  assert.deepEqual(changes, [[{ value: 'child', label: 'Child' }]]);
  assert.deepEqual(visibility, [true, false]);
  assert.equal(parent.children?.[0], child, 'Selection must not replace producer child objects');
  let clearing: Hooks;
  clearing = new Hooks(moduleAbi.default, {
    options: [child],
    value: [{ value: 'child', label: 'Child' }],
    searchValue: '',
    onChange: value => {
      clearing.props = { ...clearing.props, value };
    },
  });
  clearing.render();
  clearing.flush();
  show(clearing, true);
  const clearIcon = walk(clearing.tree).find(tree => tree.type === 'Icon' && tree.props['icon'] === 'cancel Font14');
  if (!clearIcon) throw new Error('Missing actual clear control');
  click(clearIcon);
  clearing.flush();
  assert.equal(
    clearing.tree.props['popupVisible'],
    false,
    'The current popup state must be used by a stable onChange callback',
  );

  const selected = { value: 'kept', label: 'Kept', opaque: { same: true } };
  let multi: Hooks;
  multi = new Hooks(moduleAbi.default, {
    options: [child],
    value: [selected],
    multiple: true,
    searchValue: '',
    onChange: value => {
      changes.push(value);
      multi.props = { ...multi.props, value };
    },
  });
  multi.render();
  multi.flush();
  click(option(multi, 'Child'));
  multi.flush();
  assert.equal(changes.at(-1)?.[0], selected);
  click(option(multi, 'Child'));
  multi.flush();
  assert.deepEqual(changes.at(-1), [selected]);
  const close = walk(multi.tree).find(tree => tree.type === 'Icon' && tree.props['icon'] === 'close Font14');
  if (!close) throw new Error('Missing remove-tag callback');
  click(close);
  multi.flush();
  assert.deepEqual(changes.at(-1), []);

  const work = deferred<void>();
  let calls = 0;
  const loader = new Hooks(moduleAbi.default, {
    options: [{ value: 'load', label: 'Load', isLeaf: false }],
    searchValue: '',
    loadData: () => {
      calls++;
      return work.promise;
    },
  });
  loader.render();
  loader.flush();
  click(option(loader, 'Load'));
  loader.flush();
  assert.equal(calls, 1);
  assert.ok(walk(popup(loader)).some(tree => tree.type === 'Spin'));
  click(option(loader, 'Load'));
  assert.equal(calls, 1, 'Duplicate pending expansion must share the active request');
  work.reject(new Error('offline'));
  await tick();
  loader.flush();
  assert.equal(popup(loader).props['role'], 'alert');
  const retryWork = deferred<void>();
  loader.props = {
    ...loader.props,
    loadData: () => {
      calls++;
      return retryWork.promise;
    },
  };
  loader.render();
  loader.flush();
  const retry = walk(popup(loader)).find(tree => tree.type === 'button');
  if (!retry) throw new Error('Missing retry');
  click(retry);
  loader.flush();
  assert.equal(calls, 2);
  assert.ok(walk(popup(loader)).some(tree => tree.type === 'Spin'));
  retryWork.resolve(undefined);
  await tick();
  loader.flush();
  assert.equal(popup(loader).props['role'], undefined);
  assert.ok(!walk(popup(loader)).some(tree => tree.type === 'Spin'));

  const old = deferred<void>(),
    latest = deferred<void>();
  let next = 0;
  const stale = new Hooks(moduleAbi.default, {
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    searchValue: '',
    loadData: () => (next++ === 0 ? old.promise : latest.promise),
  });
  stale.render();
  stale.flush();
  click(option(stale, 'A'));
  stale.flush();
  click(option(stale, 'B'));
  stale.flush();
  latest.resolve(undefined);
  await tick();
  stale.flush();
  old.reject(new Error('old failure'));
  await tick();
  stale.flush();
  assert.equal(popup(stale).props['role'], undefined);

  const cachedWork = deferred<void>();
  const cached = new Hooks(moduleAbi.default, {
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'Cached B', children: [child] },
    ],
    searchValue: '',
    loadData: () => cachedWork.promise,
  });
  cached.render();
  cached.flush();
  click(option(cached, 'A'));
  cached.flush();
  click(option(cached, 'Cached B'));
  cached.flush();
  cachedWork.reject(new Error('Old A failed'));
  await tick();
  cached.flush();
  assert.equal(popup(cached).props['role'], undefined, 'An earlier request failure cannot cover a cached later branch');
  assert.ok(option(cached, 'Child'));
  cached.unmount();
  const searchPending = deferred<void>();
  const searching = new Hooks(moduleAbi.default, {
    options: [{ value: 's', label: 'Search' }],
    loadData: () => searchPending.promise,
  });
  searching.render();
  searching.flush();
  click(option(searching, 'Search'));
  searching.flush();
  const searchInput = walk(searching.tree).find(tree => tree.type === 'Input');
  const searchChange = searchInput?.props['onChange'];
  if (typeof searchChange !== 'function') throw new Error('Missing search change');
  searchChange({ target: { value: 'next' } });
  searching.flush();
  searchPending.reject(new Error('Previous branch failed'));
  await tick();
  searching.flush();
  assert.notEqual(popup(searching).props['role'], 'alert', 'A new search ignores the old branch failure');
  searching.unmount();
  const closedWork = deferred<void>();
  const closed = new Hooks(moduleAbi.default, {
    options: [{ value: 'closed', label: 'Closed' }],
    searchValue: '',
    loadData: () => closedWork.promise,
  });
  closed.render();
  closed.flush();
  show(closed, true);
  click(option(closed, 'Closed'));
  closed.flush();
  show(closed, false);
  closedWork.reject(new Error('closed failure'));
  await tick();
  closed.flush();
  assert.equal(popup(closed).props['role'], undefined);
  const disabledWork = deferred<void>();
  const disabled = new Hooks(moduleAbi.default, {
    options: [{ value: 'disabled', label: 'Disabled' }],
    searchValue: '',
    loadData: () => disabledWork.promise,
  });
  disabled.render();
  disabled.flush();
  show(disabled, true);
  click(option(disabled, 'Disabled'));
  disabled.flush();
  disabled.props = { ...disabled.props, disabled: true };
  disabled.render();
  disabled.flush();
  disabledWork.reject(new Error('disabled failure'));
  await tick();
  disabled.flush();
  assert.equal(disabled.tree.props['popupVisible'], false);
  assert.equal(popup(disabled).props['role'], undefined);
  closed.unmount();
  disabled.unmount();
  const pending = deferred<void>();
  const unmount = new Hooks(moduleAbi.default, {
    options: [{ value: 'u', label: 'Unmount' }],
    loadData: () => pending.promise,
  });
  unmount.render();
  unmount.flush();
  click(option(unmount, 'Unmount'));
  unmount.flush();
  unmount.unmount();
  pending.reject(new Error('late failure'));
  await tick();
  assert.equal(unmount.lateUpdates, 0);

  const emptyKey = new Hooks(moduleAbi.default, { options: [{ value: '', label: 'Empty key', isLeaf: true }] });
  emptyKey.render();
  emptyKey.flush();
  assert.ok(
    !walk(popup(emptyKey)).some(tree => tree.type === 'Spin'),
    'An empty-string key is not the no-request sentinel',
  );
  emptyKey.unmount();
  const malformed = new Hooks(moduleAbi.default, { options: Array(1), searchValue: '' });
  malformed.render();
  malformed.flush();
  assert.equal(popup(malformed).props['role'], 'alert');
  const badSearch = new Hooks(moduleAbi.default, {
    options: [{ value: 'x', label: 'X', path: '[1]' }],
    searchValue: 'x',
  });
  badSearch.render();
  badSearch.flush();
  assert.equal(popup(badSearch).props['role'], 'alert');
  const uncontrolled = new Hooks(moduleAbi.default, { options: [child] });
  uncontrolled.render();
  uncontrolled.flush();
  assert.equal(popup(uncontrolled).props['role'], undefined);
  const input = walk(uncontrolled.tree).find(tree => tree.type === 'Input');
  if (!input) throw new Error('Missing input');
  const change = input.props['onChange'];
  if (typeof change !== 'function') throw new Error('Missing native input handler');
  change({ target: { value: 'child' } });
  uncontrolled.flush();
  const keyDown = input.props['onKeyDown'];
  if (typeof keyDown !== 'function') throw new Error('Missing native keyboard handler');
  show(uncontrolled, true);
  keyDown({ key: 'Escape', ctrlKey: false, metaKey: false });
  uncontrolled.flush();
  assert.equal(uncontrolled.tree.props['popupVisible'], false);
  [host, clearing, multi, loader, stale, malformed, badSearch, uncontrolled].forEach(host => host.unmount());
  interface WidgetProps {
    controlId: string;
    dataSource: string;
    worksheetId: string;
    viewId: string;
    value: string;
    enumDefault: number;
    formData: [];
    advancedSetting: { showtype: string; anylevel: string };
    onChange(value: string): void;
  }
  const widgetModule = load('../../../components/Form/DesktopForm/widgets/Cascader/index.tsx') as {
    default: Hooks<WidgetProps>['component'];
  };
  const widget = new Hooks<WidgetProps>(widgetModule.default, {
    controlId: 'cascade',
    dataSource: 'source',
    worksheetId: 'sheet',
    viewId: 'view',
    value: '',
    enumDefault: 1,
    formData: [],
    advancedSetting: { showtype: '3', anylevel: '0' },
    onChange() {},
  });
  const success = (rows: unknown[]) => ({
    resultCode: 1,
    template: { controls: [{ controlId: 'title', type: 2, attribute: 1, enumDefault: 2 }] },
    data: rows,
  });
  widget.render();
  widget.flush();
  apiRequests
    .at(-1)
    ?.resolve(success([{ rowid: 'parent', title: 'Parent', childrenids: '["child"]', path: '["Parent"]' }]));
  await tick();
  widget.flush();
  assert.equal(widget.tree.type, 'Cascader');
  const initialOptions = widget.tree.props['options'];
  assert.ok(Array.isArray(initialOptions));
  const widgetLoad = widget.tree.props['loadData'];
  if (typeof widgetLoad !== 'function') throw new Error('Missing real widget loader');
  const realFailed = widgetLoad({ value: 'parent', label: 'Parent' });
  const failedRequest = apiRequests.at(-1);
  assert.equal(failedRequest?.args['kanbanKey'], 'parent');
  failedRequest?.reject({ errorCode: 300016 });
  const failedOutcome: unknown = await realFailed;
  assert.ok(record(failedOutcome));
  assert.equal(failedOutcome['status'], 'failed');
  widget.flush();
  assert.equal(widget.tree.props['options'], initialOptions, 'A failed request preserves the previous rows');
  const realRetry = widgetLoad({ value: 'parent', label: 'Parent' });
  apiRequests.at(-1)?.resolve(success([{ rowid: 'child', title: 'Child', path: '["Parent","Child"]' }]));
  const retryOutcome: unknown = await realRetry;
  assert.ok(record(retryOutcome));
  assert.equal(retryOutcome['status'], 'loaded');
  widget.flush();
  const retried = widget.tree.props['options'];
  assert.ok(Array.isArray(retried));
  assert.ok(record(retried[0]));
  assert.ok(Array.isArray(retried[0]['children']));
  assert.equal(retried[0]['children'][0]['value'], 'child');
  const older = widgetLoad({ value: 'parent', label: 'Parent' });
  const oldRequest = apiRequests.at(-1);
  const newer = widgetLoad({ value: 'parent', label: 'Parent' });
  const newRequest = apiRequests.at(-1);
  assert.equal(oldRequest?.aborted, 1);
  newRequest?.resolve(success([]));
  oldRequest?.resolve(success([{ rowid: 'late', title: 'Late' }]));
  const newOutcome: unknown = await newer,
    oldOutcome: unknown = await older;
  assert.ok(record(newOutcome));
  assert.equal(newOutcome['status'], 'loaded');
  assert.ok(record(oldOutcome));
  assert.equal(oldOutcome['status'], 'cancelled');
  widget.flush();
  const malformedWidget = widgetLoad({ value: 'parent', label: 'Parent' });
  apiRequests.at(-1)?.resolve({ resultCode: 1, data: [] });
  const missingTemplate: unknown = await malformedWidget;
  assert.ok(record(missingTemplate));
  assert.equal(missingTemplate['status'], 'failed', 'Missing template/data is not a successful empty subtree');
  const realCancelled = widgetLoad({ value: 'parent', label: 'Parent' });
  apiRequests.at(-1)?.reject({ errorCode: 1 });
  const cancelled: unknown = await realCancelled;
  assert.ok(record(cancelled));
  assert.equal(cancelled['status'], 'cancelled');
  const beforeUnmount = widgetLoad({ value: 'parent', label: 'Parent' });
  const lastRequest = apiRequests.at(-1);
  widget.unmount();
  lastRequest?.resolve(success([]));
  const afterUnmount: unknown = await beforeUnmount;
  assert.ok(record(afterUnmount));
  assert.equal(afterUnmount['status'], 'cancelled');
  assert.equal(widget.lateUpdates, 0);
  const searchWidget = new Hooks<WidgetProps>(widgetModule.default, { ...widget.props });
  searchWidget.render();
  searchWidget.flush();
  apiRequests.at(-1)?.resolve(success([]));
  await tick();
  searchWidget.flush();
  const query = searchWidget.tree.props['onSearch'];
  if (typeof query !== 'function') throw new Error('Missing real widget search');
  query('needle');
  searchWidget.flush();
  assert.equal(apiRequests.at(-1)?.args['keywords'], 'needle');
  apiRequests.at(-1)?.reject(new Error('search failed'));
  await tick();
  searchWidget.flush();
  assert.equal(
    searchWidget.tree.props['loadError'],
    true,
    'The real failed search must publish an error instead of perpetual searching',
  );
  assert.equal(searchWidget.tree.props['loading'], false);
  const retryRequest = searchWidget.tree.props['onRetry'];
  if (typeof retryRequest !== 'function') throw new Error('Missing real widget search retry');
  const externalMessage = searchWidget.tree.props['notFoundContent'];
  if (typeof externalMessage !== 'string') throw new Error('Missing real search failure label');
  let external: Hooks;
  external = new Hooks(moduleAbi.default, {
    options: [],
    searchValue: 'needle',
    loadError: true,
    notFoundContent: externalMessage,
    onRetry: () => retryRequest(),
  });
  external.render();
  external.flush();
  assert.equal(popup(external).props['role'], 'alert');
  const externalButton = walk(popup(external)).find(tree => tree.type === 'button');
  if (!externalButton) throw new Error('Missing actual popup retry');
  click(externalButton);
  searchWidget.flush();
  assert.equal(apiRequests.at(-1)?.args['keywords'], 'needle');
  assert.equal(searchWidget.tree.props['loading'], true);
  apiRequests.at(-1)?.resolve(success([{ rowid: 'found', title: 'Found', path: '["Found"]' }]));
  await tick();
  searchWidget.flush();
  assert.equal(searchWidget.tree.props['loadError'], false);
  assert.equal(searchWidget.tree.props['loading'], false);
  external.props = {
    ...external.props,
    loadError: false,
    options: [{ value: 'found', label: 'Found', path: '["Found"]', isLeaf: true }],
  };
  external.render();
  external.flush();
  assert.equal(popup(external).props['role'], undefined);
  external.unmount();
  searchWidget.unmount();
  const nativeWidget = new Hooks<WidgetProps>(widgetModule.default, {
    ...widget.props,
    advancedSetting: { showtype: '4', anylevel: '0' },
  });
  nativeWidget.render();
  nativeWidget.flush();
  apiRequests.at(-1)?.resolve(success([{ rowid: 'native', title: 'Native', childrenids: '["child"]' }]));
  await tick();
  nativeWidget.flush();
  const nativeLoad = nativeWidget.tree.props['loadData'];
  if (typeof nativeLoad !== 'function') throw new Error('Missing real native-tree loader');
  let nativeSettled = false;
  const nativePromise = nativeLoad({ value: 'native' });
  Promise.resolve(nativePromise).then(() => {
    nativeSettled = true;
  });
  await tick();
  assert.equal(
    nativeSettled,
    false,
    'Native TreeSelect must wait for the actual row API, not an immediate fake resolve',
  );
  apiRequests.at(-1)?.resolve(success([]));
  await nativePromise;
  await tick();
  assert.equal(nativeSettled, true);
  const nativeFailure = nativeLoad({ value: 'native' });
  const rejected = assert.rejects(nativeFailure);
  apiRequests.at(-1)?.reject(new Error('native failed'));
  await rejected;
  nativeWidget.unmount();
  console.log('Actual Cascader selection/expansion/tags/loader failure/retry/stale/unmount/search/keyboard passed');
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
