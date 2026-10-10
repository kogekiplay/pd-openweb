const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
interface User {
  accountId: string;
  fullname?: string;
  avatar?: string;
  job?: string;
  [metadata: string]: unknown;
}
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
  children: Tree[];
}
interface Options {
  projectId?: string;
  appId?: string;
  tabType?: number;
  staticAccounts?: User[];
  prefixAccounts?: User[];
  SelectUserSettings?: { projectId?: string };
  selectRangeOptions?: unknown;
  includeUndefinedAndMySelf?: boolean;
  includeSystemField?: boolean;
  filterAccountIds?: string[];
  prefixAccountIds?: string[];
  onSelect?: (users: User[]) => void;
  selectCb?: (users: User[]) => void;
  onClose?: (force?: boolean) => void;
  [key: string]: unknown;
}
interface ModuleAbi {
  UserSelector: (props: Options) => Tree;
  default: (target: unknown, props?: Options) => { destory(): void };
}
interface Request {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  aborted: number;
  args: Record<string, unknown>;
  kind: string;
}
const requests: Request[] = [];
function request(kind: string, args: Record<string, unknown>) {
  let resolve: (value: unknown) => void = () => {},
    reject: (reason: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const item = { promise, resolve, reject, aborted: 0, args, kind };
  requests.push(item);
  return Object.assign(promise, {
    abort: () => {
      item.aborted++;
    },
  });
}
interface Effect {
  dependencies: unknown[];
  cleanup?: () => void;
}
let current: Hooks;
class Hooks {
  values: unknown[] = [];
  effects = new Map<number, Effect>();
  pending: Array<() => void> = [];
  index = 0;
  dirty = false;
  mounted = true;
  result!: Tree;
  component: (props: Options) => Tree;
  props: Options;
  lateUpdates = 0;
  constructor(component: (props: Options) => Tree, props: Options) {
    this.component = component;
    this.props = props;
  }
  draw() {
    current = this;
    this.index = 0;
    this.dirty = false;
    this.result = this.component(this.props);
    this.pending.splice(0).forEach(effect => effect());
    return this.result;
  }
  flush() {
    for (let i = 0; this.dirty && i < 10; i++) this.draw();
    return this.result;
  }
  unmount() {
    this.effects.forEach(effect => effect.cleanup?.());
    this.effects.clear();
    this.mounted = false;
  }
}
function depsEqual(old: unknown[] | undefined, next: unknown[]) {
  return !!old && old.length === next.length && old.every((value, i) => Object.is(value, next[i]));
}
const react = {
  Fragment: 'Fragment',
  useState(initial: unknown) {
    const runner = current,
      index = runner.index++;
    if (!(index in runner.values)) runner.values[index] = initial;
    return [
      runner.values[index],
      (value: unknown) => {
        if (!runner.mounted) {
          runner.lateUpdates++;
          return;
        }
        const next = typeof value === 'function' ? value(runner.values[index]) : value;
        if (!Object.is(next, runner.values[index])) {
          runner.values[index] = next;
          runner.dirty = true;
        }
      },
    ];
  },
  useRef(value: unknown) {
    const runner = current,
      index = runner.index++;
    if (!(index in runner.values)) runner.values[index] = { current: value };
    return runner.values[index];
  },
  useCallback(callback: unknown, dependencies: unknown[]) {
    const runner = current,
      index = runner.index++;
    const old = runner.values[index] as { callback: unknown; dependencies: unknown[] } | undefined;
    if (!old || !depsEqual(old.dependencies, dependencies)) runner.values[index] = { callback, dependencies };
    return (runner.values[index] as { callback: unknown }).callback;
  },
  useEffect(setup: () => void | (() => void), dependencies: unknown[]) {
    const runner = current,
      index = runner.index++;
    const old = runner.effects.get(index);
    if (depsEqual(old?.dependencies, dependencies)) return;
    runner.pending.push(() => {
      old?.cleanup?.();
      const cleanup = setup();
      runner.effects.set(index, { dependencies, ...(typeof cleanup === 'function' ? { cleanup } : {}) });
    });
  },
};
const debounceTasks: Array<{ run: () => void; cancelled: boolean }> = [];
const runtimeLodash = {
  ...lodash,
  debounce: (callback: (...args: unknown[]) => void) => {
    let task: { run: () => void; cancelled: boolean } | undefined;
    const fn = (...args: unknown[]) => {
      if (task) task.cancelled = true;
      task = { run: () => callback(...args), cancelled: false };
      debounceTasks.push(task);
    };
    return Object.assign(fn, {
      cancel: () => {
        if (task) task.cancelled = true;
      },
    });
  },
};
const flushDebounce = () =>
  debounceTasks.splice(0).forEach(task => {
    if (!task.cancelled) task.run();
  });
let clickAway: ((event: unknown) => void) | undefined;
const dialogCalls: unknown[] = [];
const roots: Array<{ rendered?: Tree; unmounts: number }> = [];
const nodes: Array<{ style: Record<string, string>; parentNode: unknown; removed: boolean }> = [];
const body = {
  appendChild(node: (typeof nodes)[number]) {
    node.parentNode = body;
  },
  contains(node: (typeof nodes)[number]) {
    return !node.removed;
  },
  removeChild(node: (typeof nodes)[number]) {
    node.removed = true;
    node.parentNode = null;
  },
};
const timers = new Map<number, () => void>();
let timerId = 0;
const cache = new Map<string, Record<string, unknown>>();
function jsx(type: unknown, props: Record<string, unknown>): Tree {
  const children = props?.['children'];
  return {
    type,
    props: props || {},
    children: (Array.isArray(children) ? children : [children])
      .flat(2)
      .filter((child): child is Tree => !!child && typeof child === 'object' && 'type' in child),
  };
}
function load(file: string): Record<string, unknown> {
  const cached = cache.get(file);
  if (cached) return cached;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const code = transformFileSync(file).code;
  new Function(
    'require',
    'module',
    'exports',
    'md',
    '_l',
    'window',
    'document',
    'Element',
    'setTimeout',
    'clearTimeout',
    code,
  )(
    name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react-dom/client')
        return {
          createRoot: () => {
            const root = { unmounts: 0, rendered: undefined as Tree | undefined };
            roots.push(root);
            return {
              render: (tree: Tree) => {
                root.rendered = tree;
              },
              unmount: () => {
                root.unmounts++;
              },
            };
          },
        };
      if (name === 'react-use')
        return {
          useClickAway: (_ref: unknown, callback: (event: unknown) => void) => {
            clickAway = callback;
          },
        };
      if (name === 'lodash') return runtimeLodash;
      if (name === 'classnames') return require('classnames');
      if (name === '@rc-component/trigger') return { __esModule: true, default: 'Trigger' };
      if (name === 'prop-types') return new Proxy({}, { get: () => () => undefined });
      if (name === 'ming-ui') return { LoadDiv: 'LoadDiv', Icon: 'Icon', UserHead: 'UserHead' };
      if (name === 'ming-ui/antd-components') return { Tooltip: 'Tooltip' };
      if (name === 'styled-components')
        return { __esModule: true, default: new Proxy({}, { get: (_target, tag) => () => tag }) };
      if (name === 'src/pages/chat/components/MyStatus/PersonalStatus')
        return { __esModule: true, default: 'PersonalStatus' };
      if (name === '../dialogSelectUser')
        return { __esModule: true, default: (props: unknown) => dialogCalls.push(props) };
      if (name === '../dialogSelectUser/GeneralSelect/ManageOftenUserDialog')
        return { openManageOftenUserDialog: (props: unknown) => dialogCalls.push(props) };
      if (name === './Comps')
        return { Con: 'Con', Content: 'Content', Search: 'Search', Tabs: 'Tabs', UserList: 'UserList' };
      if (name === 'src/router/OptionalRouter') return { __esModule: true, default: 'OptionalRouter' };
      if (name === 'src/api/addressBook')
        return { getUserAddressbookByKeywords: (args: Record<string, unknown>) => request('search', args) };
      if (name === 'src/api/externalPortal')
        return { getUsersByApp: (args: Record<string, unknown>) => request('external', args) };
      if (name === 'src/api/user')
        return {
          getProjectContactUserListByApp: (args: Record<string, unknown>) => request('range', args),
          getOftenMetionedUser: (args: Record<string, unknown>) => request('mentioned', args),
        };
      if (name === 'worksheet/redux/actions/util')
        return {
          wrapAjax: (fn: (args: unknown) => { abort(): void }) => {
            let old: { abort(): void } | undefined;
            return (args: unknown) => {
              old?.abort();
              old = fn(args);
              return old;
            };
          },
        };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      throw Error('Unexpected quick-select dependency ' + name);
    },
    module,
    module.exports,
    { global: { Account: { accountId: 'self', isPortal: false }, FileStoreConfig: { pictureHost: 'https://files' } } },
    (value: string) => value,
    { innerWidth: 1024, innerHeight: 768 },
    {
      body,
      createElement: () => {
        const node = { style: {}, parentNode: null, removed: false };
        nodes.push(node);
        return node;
      },
    },
    class Element {},
    (callback: () => void) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    (id: number) => timers.delete(id),
  );
  return module.exports;
}
const api = load(path.join(__dirname, 'index.tsx')) as unknown as ModuleAbi;
function find(tree: Tree, type: string): Tree | undefined {
  if (tree.type === type) return tree;
  for (const child of tree.children) {
    const found = find(child, type);
    if (found) return found;
  }
  return undefined;
}
function lists(tree: Tree): Tree[] {
  return [...(tree.type === 'UserList' ? [tree] : []), ...tree.children.flatMap(lists)];
}
function callback<T extends Function>(tree: Tree, key: string): T {
  const value = tree.props[key];
  if (typeof value !== 'function') throw Error('Missing ' + key);
  return value as T;
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
async function run() {
  const boundaries = load(path.join(__dirname, 'boundary.ts')) as { decodeUsers(value: unknown): User[] };
  assert.throws(() => boundaries.decodeUsers(new Array(1)), /Invalid user selection response/);
  const opaque = {
    accountId: 'member',
    fullname: 'Known',
    statusMetadata: { arbitrary: true },
    onStatusOption: { icon: 'emoji', durationOption: 1 },
  };
  assert.equal(boundaries.decodeUsers([opaque])[0], opaque);
  assert.throws(
    () => boundaries.decodeUsers([{ accountId: 'member', onStatusOption: { icon: {} } }]),
    /Invalid user selection response/,
  );
  const events: unknown[][] = [];
  const options: Options = {
    projectId: 'project',
    onSelect: users => events.push(['select', users]),
    selectCb: users => events.push(['legacy', users]),
    onClose: force => events.push(['close', force]),
  };
  const host = new Hooks(api.UserSelector, options);
  host.draw();
  host.flush();
  assert.equal(requests[0]?.kind, 'mentioned');
  const member = { accountId: 'member', fullname: 'Member', avatar: 'head', job: 'Engineer', metadata: { rowid: 7 } };
  requests[0]?.resolve([member]);
  await settle();
  host.flush();
  assert.equal(find(host.result, 'LoadDiv'), undefined);
  const list = lists(host.result).at(-1);
  assert.ok(list);
  callback<(user: User) => void>(list, 'onSelect')(member);
  assert.deepEqual(
    events.map(event => event[0]),
    ['select', 'legacy', 'close'],
  );
  assert.deepEqual(events[0]?.[1], [{ accountId: 'member', avatar: 'head', fullname: 'Member', job: 'Engineer' }]);
  const search = find(host.result, 'Search');
  assert.ok(search);
  callback<(value: string) => void>(search, 'setKeywords')('old');
  host.flush();
  flushDebounce();
  const old = requests.at(-1);
  assert.equal(old?.kind, 'search');
  callback<(value: string) => void>(find(host.result, 'Search')!, 'setKeywords')('new');
  host.flush();
  assert.ok(old && old.aborted > 0);
  flushDebounce();
  const newer = requests.at(-1);
  assert.equal(newer?.args['keywords'], 'new');
  newer?.resolve({ list: [{ accountId: 'new', fullname: 'New' }] });
  await settle();
  host.flush();
  old?.resolve({ list: [{ accountId: 'stale', fullname: 'Stale' }] });
  await settle();
  host.flush();
  assert.deepEqual(
    lists(host.result).at(-1)?.props['list'],
    [{ accountId: 'new', fullname: 'New' }],
    'A stale result cannot append to the current query',
  );
  callback<(value: string) => void>(find(host.result, 'Search')!, 'setKeywords')('bad');
  host.flush();
  flushDebounce();
  requests.at(-1)?.reject(new Error('request failed'));
  await settle();
  host.flush();
  assert.ok(find(host.result, 'div') || host.result);
  const errorNode = walk(host.result).find(node => node.props['role'] === 'alert');
  assert.ok(errorNode);
  assert.equal(find(host.result, 'LoadDiv'), undefined, 'Failed search terminates loading');
  const retry = errorNode.children.find(child => child.type === 'button');
  assert.ok(retry);
  callback<() => void>(retry, 'onClick')();
  requests.at(-1)?.resolve({ list: [{ accountId: 'recovered', fullname: 'Recovered' }] });
  await settle();
  host.flush();
  assert.equal(
    walk(host.result).some(node => node.props['role'] === 'alert'),
    false,
  );
  callback<(value: string) => void>(find(host.result, 'Search')!, 'setKeywords')('malformed');
  host.flush();
  flushDebounce();
  requests.at(-1)?.resolve({ list: [{ accountId: 17, fullname: 'Bad' }] });
  await settle();
  host.flush();
  assert.ok(walk(host.result).some(node => node.props['role'] === 'alert'));
  callback<(value: string) => void>(find(host.result, 'Search')!, 'setKeywords')('pending');
  host.flush();
  flushDebounce();
  const pending = requests.at(-1);
  host.unmount();
  assert.ok(pending && pending.aborted > 0);
  pending?.resolve({ list: [member] });
  await settle();
  assert.equal(host.lateUpdates, 0, 'An unmounted selector cannot publish stale state');
  const staticHost = new Hooks(api.UserSelector, { staticAccounts: [member] });
  const callsBefore = requests.length;
  staticHost.draw();
  staticHost.flush();
  assert.equal(requests.length, callsBefore);
  callback<(value: string) => void>(find(staticHost.result, 'Search')!, 'setKeywords')('mem');
  staticHost.flush();
  staticHost.unmount();
  flushDebounce();
  assert.equal(requests.length, callsBefore, 'Unmount cancels scheduled searches');
  const portal = new Hooks(api.UserSelector, {
    tabType: 2,
    projectId: 'project',
    appId: 'app',
    includeUndefinedAndMySelf: true,
  });
  portal.draw();
  portal.flush();
  assert.equal(requests.at(-1)?.kind, 'external');
  assert.deepEqual(requests.at(-1)?.args, {
    projectId: 'project',
    appId: 'app',
    pageIndex: 1,
    pageSize: 25,
    keywords: '',
    filterAccountIds: [],
  });
  requests.at(-1)?.resolve([{ accountId: 'external', name: 'External', mobilePhone: '123', avatar: 'e' }]);
  await settle();
  portal.flush();
  assert.deepEqual(lists(portal.result).at(-1)?.props['list'], [
    {
      accountId: 'user-self',
      avatar: 'https://files/UserAvatar/user-self.png?imageView2/1/w/100/h/100/q/90',
      fullname: '当前用户',
    },
    { accountId: 'external', avatar: 'e', fullname: 'External', phone: '123' },
  ]);
  portal.unmount();
  const range = new Hooks(api.UserSelector, {
    selectRangeOptions: { appointedAccountIds: ['allowed'] },
    projectId: 'project',
  });
  range.draw();
  range.flush();
  assert.equal(requests.at(-1)?.kind, 'range');
  assert.deepEqual(requests.at(-1)?.args['appointedAccountIds'], ['allowed']);
  requests.at(-1)?.resolve({ users: { list: [member] } });
  await settle();
  range.flush();
  assert.equal(lists(range.result).at(-1)?.props['list'] instanceof Array, true);
  range.unmount();
  const brokenRange = new Hooks(api.UserSelector, { selectRangeOptions: { appointedAccountIds: ['allowed'] } });
  brokenRange.draw();
  requests.at(-1)?.resolve({ users: { list: false } });
  await settle();
  brokenRange.flush();
  assert.equal(find(brokenRange.result, 'LoadDiv'), undefined);
  assert.ok(
    walk(brokenRange.result).some(node => node.props['role'] === 'alert'),
    'Malformed restricted list cannot become a successful empty result',
  );
  brokenRange.unmount();
  assert.throws(
    () => api.default({ getBoundingClientRect: () => ({ x: 'bad', y: 0, height: 20 }) }),
    /Invalid user selector anchor rectangle/,
  );
  const target = { getBoundingClientRect: () => ({ x: 100, y: 80, height: 20 }) };
  const panel = api.default(target, { isDynamic: true, onClose: () => events.push(['panelClose']) });
  const last = roots.at(-1);
  assert.ok(last?.rendered);
  const selector = last.rendered.children[0];
  assert.ok(selector);
  callback<(force?: boolean) => void>(selector, 'onClose')();
  assert.equal(timers.size, 1);
  panel.destory();
  panel.destory();
  assert.equal(last.unmounts, 1);
  assert.equal(timers.size, 0);
  assert.equal(nodes.at(-1)?.removed, true);
  const comps = load(path.join(__dirname, 'Comps.tsx')) as {
    Search: (props: Options) => Tree;
    UserList: (props: Options) => Tree;
  };
  const searchChanges: unknown[] = [];
  const settings = { projectId: 'project', callback: options.onSelect };
  const compHost = new Hooks(comps.Search, {
    type: 'normal',
    keywords: '',
    parentProps: { includeSystemField: true, SelectUserSettings: settings },
    setKeywords: (value: string) => searchChanges.push(value),
    onSelect: options.onSelect,
    onClose: (force?: boolean) => searchChanges.push(force),
  });
  // Supply a real consumed focus ref, then run the component's actual mount effect.
  current = compHost;
  compHost.index = 0;
  compHost.result = comps.Search(compHost.props);
  let focuses = 0;
  const input = find(compHost.result, 'input');
  assert.ok(input);
  const ref = input.props['ref'] as { current: unknown };
  ref.current = {
    focus: () => {
      focuses++;
    },
  };
  compHost.pending.splice(0).forEach(effect => effect());
  assert.equal(focuses, 1);
  assert.equal(input.props['className'], 'searchInput');
  callback<(event: { target: { value: string } }) => void>(input, 'onChange')({ target: { value: 'text' } });
  assert.deepEqual(searchChanges, ['text']);
  const address = walk(compHost.result).find(
    node => node.props['className'] === 'icon icon-topbar-addressList openAddress',
  );
  assert.ok(address);
  callback<(event: { stopPropagation: () => void }) => void>(address, 'onClick')({ stopPropagation() {} });
  assert.equal(dialogCalls.length, 1);
  assert.equal((dialogCalls[0] as { SelectUserSettings: unknown }).SelectUserSettings, settings);
  assert.equal(searchChanges.at(-1), true);
  compHost.unmount();
  console.log(
    'Actual quick selector/util search, callback order, portal/range protocol, malformed/failure retry, stale/abort/unmount and destroy lifecycle passed',
  );
}
function walk(tree: Tree): Tree[] {
  return [tree, ...tree.children.flatMap(walk)];
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
