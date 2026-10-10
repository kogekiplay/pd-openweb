/// <reference path="../../../../types/hap-api.d.ts" />
import type { DepartmentChoice, DepartmentRequest, DepartmentSelectorOptions } from './types';

const assert = require('node:assert/strict');
const path = require('node:path');
const lodash = require('lodash');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function read(value: unknown, key: string): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function'))
    throw new TypeError('Expected fixture receiver');
  return Reflect.get(value, key);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Expected actual array');
  return value;
}
function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing actual source method ' + key);
  return Reflect.apply(fn, value, args);
}
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function tree(value: unknown): value is Tree {
  return object(value) && object(value['props']) && 'type' in value;
}
function walk(value: unknown): Tree[] {
  if (!tree(value)) return [];
  const children = value.props['children'];
  return [value, ...(Array.isArray(children) ? children : [children]).flatMap(walk)];
}
function jsx(type: unknown, props: Record<string, unknown>): Tree {
  return { type, props };
}
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  updates = 0;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(patch: unknown, callback?: () => void) {
    const value: unknown =
      typeof patch === 'function' ? Reflect.apply(patch, undefined, [this.state, this.props]) : patch;
    if (!object(value)) throw new TypeError('Invalid state fixture');
    Object.assign(this.state, value);
    this.updates++;
    callback?.();
  }
}
interface Request {
  name: string;
  args: DepartmentRequest;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(value: unknown): void;
  aborted: number;
}
const requests: Request[] = [];
function api(name: string, args: DepartmentRequest) {
  let resolve: (value: unknown) => void = () => {},
    reject: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const request: Request = { name, args, promise, resolve, reject, aborted: 0 };
  requests.push(request);
  return Object.assign(promise, {
    abort() {
      assert.equal(this, promise);
      request.aborted++;
    },
  });
}
interface Effects {
  deps: unknown[] | undefined;
  cleanup?: (() => void) | undefined;
}
let current: Hooks;
class Hooks {
  values: unknown[] = [];
  effects = new Map<number, Effects>();
  callbacks = new Map<number, { deps: unknown[]; value: unknown }>();
  pending: Array<() => void> = [];
  cursor = 0;
  dirty = false;
  alive = true;
  lateUpdates = 0;
  rendered: Tree = { type: '', props: {} };
  away: (() => void) | undefined;
  readonly component: (props: Record<string, unknown>) => Tree;
  readonly props: Record<string, unknown>;
  constructor(component: (props: Record<string, unknown>) => Tree, props: Record<string, unknown>) {
    this.component = component;
    this.props = props;
  }
  render() {
    current = this;
    this.cursor = 0;
    this.dirty = false;
    this.rendered = this.component(this.props);
    this.pending.splice(0).forEach(effect => effect());
    return this.rendered;
  }
  flush() {
    for (let i = 0; this.dirty && i < 12; i++) this.render();
    return this.rendered;
  }
  unmount() {
    this.effects.forEach(effect => effect.cleanup?.());
    this.alive = false;
  }
}
function same(a: unknown[] | undefined, b: unknown[] | undefined) {
  return !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}
function useRef(value: unknown) {
  const host = current,
    index = host.cursor++;
  if (!(index in host.values)) host.values[index] = { current: value };
  return host.values[index];
}
function useSetState(value: Record<string, unknown>) {
  const host = current,
    index = host.cursor++;
  if (!(index in host.values)) host.values[index] = value;
  return [
    host.values[index],
    (patch: unknown) => {
      if (!host.alive) {
        host.lateUpdates++;
        return;
      }
      if (!object(patch) || !object(host.values[index])) throw new TypeError('Invalid hook state fixture');
      Object.assign(host.values[index], patch);
      host.dirty = true;
    },
  ];
}
function useEffect(fn: () => unknown, deps?: unknown[]) {
  const host = current,
    index = host.cursor++,
    prior = host.effects.get(index);
  if (prior && same(prior.deps, deps)) return;
  host.pending.push(() => {
    prior?.cleanup?.();
    const cleanup = fn();
    host.effects.set(index, {
      deps,
      cleanup: typeof cleanup === 'function' ? () => Reflect.apply(cleanup, undefined, []) : undefined,
    });
  });
}
function useCallback(fn: unknown, deps: unknown[]) {
  const host = current,
    index = host.cursor++,
    prior = host.callbacks.get(index);
  if (prior && same(prior.deps, deps)) return prior.value;
  host.callbacks.set(index, { deps, value: fn });
  return fn;
}
const debounced: Array<{ flush(): unknown; cancel(): void }> = [];
const lib = Object.assign({}, lodash, {
  debounce(fn: () => unknown, delay: number) {
    const result = lodash.debounce(fn, delay);
    debounced.push(result);
    return result;
  },
});
let wrapped: { target: unknown; options: Record<string, unknown> } | undefined;
const roots: Array<{ node?: unknown; unmounted: boolean }> = [];
const children: object[] = [];
const body = {
  addEventListener() {},
  removeEventListener() {},
  appendChild(child: object) {
    children.push(child);
    Object.assign(child, { parentNode: body });
  },
  removeChild(child: object) {
    const index = children.indexOf(child);
    if (index >= 0) children.splice(index, 1);
  },
  contains(child: object) {
    return children.includes(child);
  },
};
const storage = new Map<string, string>();
function element() {
  const style: Record<string, unknown> = {};
  let zIndex = '';
  Object.defineProperty(style, 'zIndex', {
    enumerable: true,
    get: () => zIndex,
    set: (value: unknown) => {
      zIndex = String(value);
    },
  });
  return { style };
}
Object.assign(globalThis, {
  md: { global: { Account: { projects: [{ projectId: 'project', companyName: 'Organization' }] } } },
  document: { body, createElement: element },
  window: { innerWidth: 900, innerHeight: 700 },
  location: { href: '/app' },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
  },
  _l: (text: string) => text,
});
const cache = new Map<string, Record<string, unknown>>();
function load(file: string): Record<string, unknown> {
  const full = path.resolve(__dirname, file);
  if (cache.has(full)) return cache.get(full)!;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', transformFileSync(full).code)(module, module.exports, (name: string) => {
    if (name === 'react')
      return { Component, Fragment: 'Fragment', createRef: () => ({ current: null }), useRef, useEffect, useCallback };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-dom/client')
      return {
        createRoot: () => {
          const state: { node?: unknown; unmounted: boolean } = { unmounted: false };
          roots.push(state);
          return {
            render: (node: unknown) => {
              state.node = node;
            },
            unmount: () => {
              state.unmounted = true;
            },
          };
        },
      };
    if (name === 'react-use')
      return {
        useSetState,
        useClickAway: (_ref: unknown, fn: () => void) => {
          current.away = fn;
        },
      };
    if (name === 'lodash') return lib;
    if (name === 'classnames') return require('classnames');
    if (name === 'src/api/department')
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_object, name) => (args: DepartmentRequest) => api(String(name), args) }),
      };
    if (name === 'ming-ui')
      return {
        Dialog: 'Dialog',
        Checkbox: 'Checkbox',
        Radio: 'Radio',
        Icon: 'Icon',
        ScrollView: 'ScrollView',
        LoadDiv: 'LoadDiv',
        FunctionWrap: (target: unknown, options: Record<string, unknown>) => {
          wrapped = { target, options };
        },
      };
    if (name === 'ming-ui/components/FunctionWrap')
      return {
        __esModule: true,
        default: (target: unknown, options: Record<string, unknown>) => {
          wrapped = { target, options };
        },
      };
    if (name.startsWith('ming-ui/components/')) return { __esModule: true, default: name.split('/').at(-1) };
    if (name === 'src/components/checkPermission') return { checkPermission: () => true };
    if (name === 'src/pages/Admin/enum') return { PERMISSION_ENUM: { DEPARTMENT: 7 } };
    if (name.endsWith('/NoData')) return { __esModule: true, default: 'NoData' };
    if (name.endsWith('/DepartmentList')) return { __esModule: true, default: 'DepartmentList' };
    if (name === '../dialogSelectUser/GeneralSelect/boundary')
      return load('../dialogSelectUser/GeneralSelect/boundary.ts');
    if (name === '../../quickSelectUser/boundary') return load('../quickSelectUser/boundary.ts');
    if (name === 'src/utils/typedStyled') return load('../../../utils/typedStyled.ts');
    if (name === 'styled-components') return { __esModule: true, default: { div: () => 'Styled' } };
    if (name === '../dialogSelectDept') return load('index.tsx');
    if (name === '../dialogSelectDept/boundary') return load('boundary.ts');
    if (name === './boundary') return load('boundary.ts');
    if (name.endsWith('.less')) return {};
    if (name.startsWith('@babel/runtime/')) return require(name);
    throw new Error('Unexpected department dependency: ' + name);
  });
  if (!object(module.exports)) throw new TypeError('Invalid module fixture');
  cache.set(full, module.exports);
  return module.exports;
}
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const node = (departmentId: string, children: unknown[] = []) => ({
  departmentId,
  departmentName: departmentId,
  userCount: 8,
  haveSubDepartment: children.length > 0,
  subDepartments: children,
  metadata: { stable: true },
});
function instantiate(options: DepartmentSelectorOptions): unknown {
  const entry = load('index.tsx')['default'];
  if (typeof entry !== 'function') throw new Error('Expected actual department entry');
  Reflect.apply(entry, undefined, [options]);
  if (!wrapped || typeof wrapped.target !== 'function') throw new Error('Missing actual FunctionWrap constructor');
  return Reflect.construct(wrapped.target, [wrapped.options]);
}
function firstRequest(): Request {
  const request = requests.at(-1);
  if (!request) throw new Error('Missing actual API request');
  return request;
}

async function run() {
  const boundary = load('boundary.ts');
  const child = node('child');
  const parent = node('parent', [child]);
  const payload = [parent];
  assert.equal(invoke(boundary, 'departmentTree', [payload]), payload);
  assert.equal(read(invoke(boundary, 'rootResult', [{ item1: false, item2: payload }, true]), 'departments'), payload);
  assert.equal(
    invoke(boundary, 'departmentChoices', [[{ departmentId: 'root', departmentName: undefined }]]) instanceof Array,
    true,
  );
  for (const open of [false, true, 0, 2])
    assert.equal(invoke(boundary, 'departmentTree', [[{ ...parent, open }]]) instanceof Array, true);
  for (const open of [NaN, -1, 0.2])
    assert.throws(() => invoke(boundary, 'departmentTree', [[{ ...parent, open }]]), TypeError);
  for (const bad of [
    {},
    [undefined],
    new Array(1),
    [{ ...parent, departmentId: 4 }],
    [{ ...parent, subDepartments: [null] }],
  ])
    assert.throws(() => invoke(boundary, 'departmentTree', [bad]), TypeError);
  const cycle = node('cycle');
  cycle.subDepartments.push(cycle);
  assert.throws(() => invoke(boundary, 'departmentTree', [[cycle]]), TypeError);
  for (const bad of [{}, { item1: false }, { item2: [null] }, { item1: 'false', item2: [] }])
    assert.throws(() => invoke(boundary, 'rootResult', [bad, true]), TypeError);
  assert.deepEqual(invoke(boundary, 'memberIds', [{ hasMemberIds: ['a'], hasMemberIdsInTree: ['a', 'b'] }]), [
    'a',
    'a',
    'b',
  ]);
  assert.deepEqual(invoke(boundary, 'memberIds', [{}]), []);
  assert.throws(() => invoke(boundary, 'memberIds', [{ hasMemberIds: [4] }]), TypeError);
  assert.deepEqual(invoke(boundary, 'requestIds', [['a', null, undefined, '', 'b']]), ['a', 'b']);
  assert.throws(() => invoke(boundary, 'requestIds', [[42]]), TypeError);

  const callback: unknown[][] = [],
    close: unknown[] = [];
  const selected: DepartmentChoice[] = [{ departmentId: 'parent', departmentName: 'parent' }];
  const dialog = instantiate({
    projectId: 'project',
    selectedDepartment: selected,
    fetchCount: true,
    selectFn: (...args) => callback.push(args),
    onClose: value => close.push(value),
  });
  assert.equal(
    read(read(dialog, 'state'), 'selectedDepartment'),
    selected,
    'Initial selections retain the original array',
  );
  invoke(dialog, 'componentDidMount');
  const initial = firstRequest();
  assert.equal(initial.name, 'searchDepartment2');
  initial.resolve({ item1: false, item2: payload });
  await tick();
  const list = read(read(dialog, 'state'), 'list');
  if (!Array.isArray(list)) throw new Error('Missing actual loaded tree');
  assert.equal(list[0]['subDepartments'], parent.subDepartments, 'Normal root mapping retains the backend child array');
  assert.equal(list[0]['subDepartments'][0], child, 'Nested backend entries retain identity');
  const save = invoke(dialog, 'selectFn');
  const count = firstRequest();
  assert.equal(count.name, 'keepHasMemberIds');
  count.resolve({ hasMemberIds: ['parent'], hasMemberIdsInTree: [] });
  await save;
  assert.equal(read(array(callback[0]?.[0])[0], 'userCount'), 1);
  assert.deepEqual(close, [true]);
  const countFailure = invoke(dialog, 'selectFn');
  const failureAssert = assert.rejects(countFailure);
  firstRequest().reject(new Error('count offline'));
  await failureAssert;
  assert.equal(callback.length, 1);
  assert.equal(close.length, 1, 'Count failure does not emit selection or close');
  const rowsBefore = read(read(dialog, 'state'), 'list');
  invoke(dialog, 'fetchData');
  firstRequest().resolve({});
  await tick();
  assert.equal(read(read(dialog, 'state'), 'loading'), false);
  assert.equal(read(read(dialog, 'state'), 'list'), rowsBefore);
  assert.equal(read(read(dialog, 'state'), 'loadError'), true, 'Bad endpoint payload is an explicit failure');
  const retryTree = invoke(dialog, 'renderContent');
  const retry = walk(retryTree).find(item => item.type === 'button');
  if (!retry) throw new Error('Missing actual retry');
  invoke(retry.props, 'onClick');
  firstRequest().resolve({ item1: false, item2: payload });
  await tick();
  assert.equal(read(read(dialog, 'state'), 'loadError'), false);
  const older = invoke(dialog, 'fetchData');
  const oldRequest = firstRequest();
  const newer = invoke(dialog, 'fetchData');
  const newRequest = firstRequest();
  assert.equal(oldRequest.aborted, 1);
  newRequest.resolve({ item1: false, item2: [node('latest')] });
  oldRequest.resolve({ item1: false, item2: [node('stale')] });
  await newer;
  await older;
  const newest = array(read(read(dialog, 'state'), 'list'));
  assert.equal(read(newest[0], 'departmentId'), 'latest');
  invoke(dialog, 'fetchData');
  const late = firstRequest();
  invoke(dialog, 'componentWillUnmount');
  const updates = read(dialog, 'updates');
  late.resolve({ item1: false, item2: payload });
  await tick();
  assert.equal(read(dialog, 'updates'), updates);

  for (const failAfterClear of [false, true]) {
    const clearing = instantiate({ projectId: 'project' });
    invoke(clearing, 'componentDidMount');
    firstRequest().resolve({ item1: false, item2: [node('old-page')] });
    await tick();
    invoke(clearing, 'setState', [
      { rootPageIndex: 3, departmentMoreIds: [{ departmentId: 'old-page', pageIndex: 3 }] },
    ]);
    invoke(clearing, 'handleChange', [{ target: { value: 'pending search' } }]);
    invoke(read(clearing, 'search'), 'flush');
    const pendingSearch = firstRequest();
    const beforeClearCount = requests.length;
    invoke(clearing, 'clearKeywords');
    const emptyQuery = firstRequest();
    assert.equal(requests.length, beforeClearCount + 1, 'Clear starts a real root request');
    assert.equal(emptyQuery.args.keywords, '');
    assert.equal(emptyQuery.args.pageIndex, 1);
    assert.ok(pendingSearch.aborted >= 1);
    pendingSearch.reject(new Error('stale request cancelled'));
    await tick();
    assert.equal(
      read(read(clearing, 'state'), 'loading'),
      true,
      'Clear waits for the new API rather than publishing old data',
    );
    assert.deepEqual(read(read(clearing, 'state'), 'departmentMoreIds'), []);
    if (failAfterClear) {
      emptyQuery.reject(new Error('root refresh failed'));
      await tick();
      assert.equal(read(read(clearing, 'state'), 'loading'), false);
      assert.equal(read(read(clearing, 'state'), 'loadError'), true);
      const actualRetry = walk(invoke(clearing, 'renderContent')).find(item => item.type === 'button');
      if (!actualRetry) throw new Error('Missing clear-failure retry');
      invoke(actualRetry.props, 'onClick');
      assert.equal(firstRequest().args.keywords, '');
      assert.equal(firstRequest().args.pageIndex, 1);
      firstRequest().resolve({ item1: false, item2: [node('cleared-root')] });
      await tick();
    } else {
      emptyQuery.resolve({ item1: false, item2: [node('cleared-root')] });
      await tick();
    }
    assert.equal(read(read(clearing, 'state'), 'loading'), false);
    assert.equal(read(read(clearing, 'state'), 'loadError'), false);
    assert.deepEqual(
      array(read(read(clearing, 'state'), 'list')).map(item => read(item, 'departmentId')),
      ['cleared-root'],
      'Page three search data is replaced, not concatenated',
    );
    invoke(clearing, 'componentWillUnmount');
  }
  for (const options of [
    { isAnalysis: true },
    { departrangetype: '1', appointedDepartmentIds: ['parent'], appointedUserIds: [] },
  ]) {
    for (const response of [payload, { item1: true, item2: payload }]) {
      const special = instantiate({ projectId: 'project', ...options });
      invoke(special, 'componentDidMount');
      firstRequest().resolve(response);
      await tick();
      const actual = array(read(read(special, 'state'), 'list'));
      assert.equal(read(actual[0], 'departmentId'), 'parent');
      invoke(special, 'componentWillUnmount');
    }
  }
  const cancelledEvents: unknown[] = [];
  const cancelledCountDialog = instantiate({
    projectId: 'project',
    selectedDepartment: selected,
    fetchCount: true,
    selectFn: data => cancelledEvents.push(data),
    onClose: value => cancelledEvents.push(value),
  });
  invoke(cancelledCountDialog, 'componentDidMount');
  firstRequest().resolve({ item1: false, item2: payload });
  await tick();
  const countAfterCancel = invoke(cancelledCountDialog, 'selectFn');
  const cancelledCountRequest = firstRequest();
  invoke(cancelledCountDialog, 'componentWillUnmount');
  assert.equal(cancelledCountRequest.aborted, 1);
  cancelledCountRequest.resolve({ hasMemberIds: ['parent'] });
  await countAfterCancel;
  assert.deepEqual(cancelledEvents, [], 'A count response after close cannot publish the cancelled selection');
  const quick = load('../quickSelectDept/index.tsx');
  const component = quick['DeptSelect'];
  if (typeof component !== 'function') throw new Error('Missing actual hook selector');
  const calls: unknown[][] = [],
    closes: unknown[] = [];
  const host = new Hooks(
    props => {
      const result: unknown = Reflect.apply(component, undefined, [props]);
      if (!tree(result)) throw new Error('Invalid tree');
      return result;
    },
    {
      projectId: 'project',
      unique: true,
      selectFn: (...args: unknown[]) => calls.push(args),
      onClose: (value?: boolean) => closes.push(value),
    },
  );
  host.render();
  debounced.at(-1)?.flush();
  firstRequest().resolve({ item1: false, item2: payload });
  await tick();
  host.flush();
  const option = walk(host.rendered).find(
    item => item.props['className'] === 'flex valignWrapper Hand quick-department_content overflow_ellipsis',
  );
  if (!option) throw new Error('Missing actual quick department row');
  invoke(option.props, 'onClick');
  host.flush();
  assert.equal(read(array(calls[0]?.[0])[0], 'departmentId'), 'parent');
  assert.equal(calls[0]?.[1], null);
  assert.deepEqual(closes, [true]);
  const selectedOption = walk(host.rendered).find(
    item => item.props['className'] === 'flex valignWrapper Hand quick-department_content overflow_ellipsis',
  );
  if (!selectedOption) throw new Error('Missing current selected row');
  invoke(selectedOption.props, 'onClick');
  host.flush();
  assert.equal(calls.at(-1)?.[1], true, 'Quick removal emits the actual true sentinel');
  const input = walk(host.rendered).find(item => item.type === 'input');
  if (!input) throw new Error('Missing source input');
  invoke(input.props, 'onChange', [{ target: { value: 'find' } }]);
  host.flush();
  debounced.at(-1)?.flush();
  firstRequest().reject(new Error('search offline'));
  await tick();
  host.flush();
  assert.ok(
    walk(host.rendered).some(item => item.props['role'] === 'alert'),
    'Failed quick search exits its spinner',
  );
  const quickRetry = walk(host.rendered).find(item => item.type === 'button');
  if (!quickRetry) throw new Error('Missing quick retry');
  invoke(quickRetry.props, 'onClick');
  firstRequest().resolve({ item1: false, item2: payload });
  await tick();
  host.flush();
  assert.ok(!walk(host.rendered).some(item => item.props['role'] === 'alert'));
  const currentInput = walk(host.rendered).find(item => item.type === 'input');
  if (!currentInput) throw new Error('Missing current input');
  invoke(currentInput.props, 'onChange', [{ target: { value: 'old' } }]);
  host.flush();
  debounced.at(-1)?.flush();
  const inFlightSearch = firstRequest();
  const newestInput = walk(host.rendered).find(item => item.type === 'input');
  if (!newestInput) throw new Error('Missing updated input');
  invoke(newestInput.props, 'onChange', [{ target: { value: 'new' } }]);
  host.flush();
  assert.equal(inFlightSearch.aborted, 1, 'Typing invalidates and aborts the prior request before the debounce delay');
  inFlightSearch.reject(new Error('stale search rejection'));
  await tick();
  host.flush();
  assert.ok(!walk(host.rendered).some(item => item.props['role'] === 'alert'));
  host.unmount();
  assert.equal(host.lateUpdates, 0);
  const entry = quick['default'];
  if (typeof entry !== 'function') throw new Error('Missing public quick entry');
  const geometry: string[] = [];
  const rectangle = {
    get height() {
      geometry.push('height');
      return 30;
    },
    get x() {
      geometry.push('x');
      return 20;
    },
    get y() {
      geometry.push('y');
      return 40;
    },
  };
  const target = {
    get getBoundingClientRect() {
      geometry.push('method');
      return function (this: unknown) {
        assert.equal(this, target);
        return rectangle;
      };
    },
  };
  const handle: unknown = Reflect.apply(entry, undefined, [target, { minHeight: 200 }]);
  assert.deepEqual(geometry, ['method', 'method', 'height', 'x', 'y']);
  invoke(handle, 'destory');
  assert.equal(roots.at(-1)?.unmounted, true);
  assert.equal(children.length, 0);
  debounced.forEach(fn => fn.cancel());
  console.log(
    'Actual department DTO/ref identity, endpoint modes, counts/close, retry/stale/unmount, quick removal/search and native geometry passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
