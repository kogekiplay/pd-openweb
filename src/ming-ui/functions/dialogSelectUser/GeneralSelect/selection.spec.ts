import type {
  DialogOptions,
  GeneralSelectProps,
  GeneralSelectState,
  SelectDepartment,
  SelectUser,
  UserRequest,
} from './types';

const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');

interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
interface Request {
  args: UserRequest;
  name: string;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(value: unknown): void;
  aborted: number;
}
const requests: Request[] = [];
function request(name: string, args: UserRequest) {
  let resolve: (value: unknown) => void = () => {};
  let reject: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const entry = { args, name, promise, resolve, reject, aborted: 0 };
  requests.push(entry);
  return Object.assign(promise, {
    abort() {
      entry.aborted++;
    },
  });
}
class Component<P, S extends object> {
  props: P;
  state: S = Object.create(null);
  updates = 0;
  constructor(props: P) {
    this.props = props;
  }
  setState(patch: Partial<S> | ((state: S) => Partial<S>), callback?: () => void) {
    this.updates++;
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
    callback?.();
  }
}
interface Selector {
  props: GeneralSelectProps;
  state: GeneralSelectState;
  updates: number;
  componentDidMount(): void;
  componentWillUnmount(): void;
  defaultAction(): void | Promise<void> | false;
  userAction(): void | Promise<void> | false;
  resignedAction(): void | Promise<void> | false;
  onChangeUserFilter(id: string): void;
  toogleUserSelect(user: SelectUser): void;
  toogleDepargmentSelect(department: SelectDepartment): void;
  toggleUserItem(id: string): void | Promise<void>;
  allSelectUserItem(id: string, checked: boolean): void | Promise<void>;
  toggleDepartmentList(id: string): void | false;
  selectedUsers: SelectUser[];
  selectedDepartment: SelectDepartment[];
  submit(): void;
  search(value: string): void;
  searchDefault: { cancel(): void; flush(): void };
  renderContent(): Tree | null;
}
interface SelectorModule {
  default: new (props: GeneralSelectProps) => Selector;
}
const events = new Map<string, unknown>();
Object.assign(globalThis, {
  window: {
    addEventListener(name: string, callback: unknown) {
      events.set(name, callback);
    },
    removeEventListener(name: string, callback: unknown) {
      if (events.get(name) === callback) events.delete(name);
    },
  },
  localStorage: {
    getItem() {
      return null;
    },
  },
  md: { global: { Account: { accountId: 'self', projects: [] } } },
  _l: (text: string) => text,
  safeParse: (text: string) => JSON.parse(text),
  safeLocalStorageSetItem() {},
  $: Object.assign(() => ({}), { extend: Object.assign }),
  alert() {},
});
const components = new Proxy(
  {},
  {
    get(_object, property) {
      return property;
    },
  },
);
const api = (name: string) =>
  new Proxy(
    {},
    {
      get(_object, method) {
        return (args: UserRequest) => request(`${name}.${String(method)}`, args);
      },
    },
  );
interface WrapperProps extends DialogOptions {
  SelectUserSettings: NonNullable<DialogOptions['SelectUserSettings']>;
  visible: boolean;
  onCancel(): void;
  dialogProps: Record<string, unknown>;
}
interface Wrapper {
  state: { projectId: string | null | undefined; list?: Array<{ value: string | number | undefined }> };
  initDropList(): Promise<void>;
  renderHeader(): Tree;
  renderContent(): { type: unknown; props: GeneralSelectProps };
}
let wrapped: { Component: new (props: WrapperProps) => Wrapper; options: WrapperProps } | undefined;
const styledTag = () => 'styled';
const styled = Object.assign(() => styledTag, { div: styledTag });
let hookIndex = 0;
const hookValues: unknown[] = [];
const effectDependencies = new Map<number, unknown[]>();
const effectQueue: Array<() => void> = [];
function useState(initial: unknown) {
  const index = hookIndex++;
  if (!(index in hookValues)) hookValues[index] = initial;
  return [
    hookValues[index],
    (value: unknown) => {
      hookValues[index] = value;
    },
  ];
}
function useRef(initial: unknown) {
  const index = hookIndex++;
  if (!(index in hookValues)) hookValues[index] = { current: initial };
  return hookValues[index];
}
function useEffect(effect: () => void, dependencies: unknown[]) {
  const index = hookIndex++;
  const previous = effectDependencies.get(index);
  if (!previous || previous.some((value, index) => value !== dependencies[index])) {
    effectDependencies.set(index, dependencies);
    effectQueue.push(effect);
  }
}
const cache = new Map<string, unknown>();
function load(file: string): unknown {
  const full = path.join(__dirname, file);
  if (cache.has(full)) return cache.get(full);
  const result = { exports: {} };
  const code = transformFileSync(full).code;
  new Function('require', 'module', 'exports', code)(
    (name: string) => {
      if (name === 'react')
        return { Component, Fragment: 'Fragment', useState, useRef, useEffect, createRef: () => ({ current: null }) };
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
          jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        };
      if (name === 'styled-components') return { __esModule: true, default: styled };
      if (name === 'src/utils/typedStyled') return load('../../../../utils/typedStyled.ts');
      if (name === 'react-redux') return { shallowEqual: () => false };
      if (name === 'lodash') return lodash;
      if (name === 'classnames') return () => '';
      if (name === 'ming-ui')
        return {
          ...components,
          FunctionWrap: (Component: new (props: WrapperProps) => Wrapper, options: WrapperProps) => {
            wrapped = { Component, options };
          },
        };
      if (name === 'ming-ui/antd-components') return components;
      if (name.startsWith('src/api/')) return { __esModule: true, default: api(name.slice(8)) };
      if (name === './GeneralSelect/boundary') return load('boundary.ts');
      if (name === './GeneralSelect') return load('index.tsx');
      if (name === 'src/utils/common') return { browserIsMobile: () => false };
      if (name === 'src/utils/project') return { getCurrentProject: () => ({}) };
      if (name === 'src/components/checkPermission') return { checkPermission: () => false };
      if (name === 'src/pages/Admin/enum') return { PERMISSION_ENUM: {} };
      if (name === './boundary') return load('boundary.ts');
      if (name === './constant') return load('constant.ts');
      if (name === '../../quickSelectUser/boundary') return load('../../quickSelectUser/boundary.ts');
      if (name.endsWith('.less')) return {};
      return name;
    },
    result,
    result.exports,
  );
  cache.set(full, result.exports);
  return result.exports;
}
const moduleAbi: SelectorModule = load('index.tsx') as SelectorModule;
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
const user = (accountId: string): SelectUser => ({
  accountId,
  fullname: accountId,
  avatar: 'avatar',
  opaque: { token: accountId },
});
const props = (overrides: Partial<GeneralSelectProps> = {}): GeneralSelectProps => ({
  commonSettings: { projectId: 'project' },
  userSettings: { filterSystemAccountId: [] },
  handleCancel() {},
  dialogSelectUser() {},
  ...overrides,
});

async function run() {
  const currentData = () => dialog.state.mainData;
  const selectedCalls: SelectUser[][] = [];
  const dialog = new moduleAbi.default(
    props({ userSettings: { filterSystemAccountId: ['system'], callback: users => selectedCalls.push(users) } }),
  );
  dialog.componentDidMount();
  const first = requests.at(-1);
  assert.equal(first?.name, 'user.getContactUserList');
  const one = user('one');
  const wire = { users: { list: [one] }, oftenUsers: { list: [user('system')] }, opaqueHeader: { cache: true } };
  const originalKeys = Object.keys(wire);
  first?.resolve(wire);
  await tick();
  assert.equal(dialog.state.loading, false);
  assert.equal(currentData()?.renderType, 1);
  const contact = currentData();
  if (contact?.renderType !== 1) throw new Error('Missing contact data');
  assert.equal(contact.data, wire, 'Validated normal header objects retain the real API identity');
  assert.equal(contact.data.users, wire.users);
  assert.deepEqual(Object.keys(contact.data), originalKeys);
  assert.equal(contact.data.users?.list[0], one);
  assert.deepEqual(contact.data.oftenUsers?.list, []);
  dialog.toogleUserSelect(one);
  dialog.submit();
  assert.equal(selectedCalls[0]?.[0], one);

  dialog.state.pageIndex = 2;
  const paging = dialog.userAction();
  assert.equal(requests.at(-1)?.args.pageIndex, 2);
  requests.at(-1)?.resolve({ users: { list: [user('two')] } });
  await paging;
  assert.deepEqual(
    dialog.selectedUsers.map(item => item.accountId),
    ['one'],
  );
  assert.deepEqual(
    contact.data.users?.list.map(item => item.accountId),
    ['one', 'two'],
  );
  assert.equal(dialog.state.haveMore, false);

  dialog.onChangeUserFilter('group');
  requests.at(-1)?.resolve({ list: [{ groupId: 'g', name: 'Group', groupMemberCount: 2 }] });
  await tick();
  const expand = dialog.toggleUserItem('g');
  requests.at(-1)?.resolve([one, user('two')]);
  await expand;
  assert.equal(currentData()?.renderType, 6);
  dialog.allSelectUserItem('g', false);
  assert.deepEqual(
    dialog.selectedUsers.map(item => item.accountId),
    ['one', 'two'],
  );
  dialog.allSelectUserItem('g', true);
  assert.deepEqual(dialog.selectedUsers, []);
  const groupData = currentData();
  if (groupData?.renderType !== 6 || !groupData.data.list[0]) throw new Error('Missing loaded group');
  dialog.toggleUserItem('g'); // Close the loaded group before fetching newly added members.
  groupData.data.list[0].groupMemberCount = 3;
  dialog.toggleUserItem('g');
  requests.at(-1)?.reject(new Error('Group members failed'));
  await tick();
  const groupError = dialog.renderContent();
  const groupErrorChildren = groupError?.props['children'];
  if (!Array.isArray(groupErrorChildren)) throw new Error('Missing member retry UI');
  const groupRetryTree: Tree = groupErrorChildren[1];
  const groupRetry = groupRetryTree.props['onClick'];
  if (typeof groupRetry !== 'function') throw new Error('Missing member retry callback');
  groupRetry();
  assert.equal(
    requests.at(-1)?.name,
    'group.getGroupEffectUsers',
    'The actual retry button repeats the failed members request',
  );
  assert.equal(requests.at(-1)?.args.groupId, 'g');
  requests.at(-1)?.resolve([one, user('two'), user('three')]);
  await tick();
  assert.equal(dialog.state.loadError, undefined);

  dialog.onChangeUserFilter('department');
  requests.at(-1)?.resolve([{ departmentId: 'd', departmentName: 'Department', haveSubDepartment: true }]);
  await tick();
  assert.equal(currentData()?.renderType, 2);
  dialog.state.chooseType = 'department';
  dialog.defaultAction();
  requests.at(-1)?.resolve([{ departmentId: 'd', departmentName: 'Department', haveSubDepartment: true }]);
  await tick();
  dialog.toggleDepartmentList('d');
  requests.at(-1)?.resolve([{ departmentId: 'sub', departmentName: 'Child' }]);
  await tick();
  assert.equal(currentData()?.renderType, 5);
  const departmentTree = currentData();
  if (departmentTree?.renderType !== 5) throw new Error('Missing department tree');
  assert.equal(departmentTree.data[0]?.subDepartments[0]?.departmentId, 'sub');
  const selectedDepartment = departmentTree.data[0];
  if (!selectedDepartment) throw new Error('Missing selected department');
  dialog.toogleDepargmentSelect(selectedDepartment);
  assert.equal(dialog.selectedDepartment[0]?.departmentId, 'd');

  dialog.state.chooseType = 'resigned';
  dialog.state.pageIndex = 1;
  const resigned = dialog.resignedAction();
  requests.at(-1)?.resolve({ list: [user('left')], allCount: 1 });
  await resigned;
  assert.equal(currentData()?.renderType, 7);
  // The historical !length < pageSize behavior is deliberately preserved.
  assert.equal(dialog.state.haveMore, true);

  dialog.onChangeUserFilter('conactUser');
  const failed = requests.at(-1);
  failed?.reject(new Error('offline'));
  await tick();
  assert.equal(dialog.state.loading, false);
  assert.equal(dialog.renderContent()?.props['role'], 'alert');
  dialog.defaultAction();
  requests.at(-1)?.resolve({ users: { list: [one] } });
  await tick();
  assert.equal(dialog.state.loadError, undefined);

  dialog.onChangeUserFilter('conactUser');
  requests.at(-1)?.resolve({ users: { list: Array(1) } });
  await tick();
  assert.ok(dialog.state.loadError, 'Sparse API members must fail instead of publishing success');
  dialog.defaultAction();
  const old = requests.at(-1);
  dialog.onChangeUserFilter('subordinateUser');
  assert.equal(old?.aborted, 1);
  const current = requests.at(-1);
  current?.resolve({ list: [user('current')] });
  await tick();
  old?.resolve({ users: { list: [one] } });
  await tick();
  assert.equal(currentData()?.renderType, 4);
  dialog.search('later');
  const requestCount = requests.length;
  dialog.componentWillUnmount();
  dialog.searchDefault.flush();
  assert.equal(requests.length, requestCount, 'Unmount cancels pending search');
  assert.equal(events.size, 0);

  const unmount = new moduleAbi.default(props());
  unmount.componentDidMount();
  const pending = requests.at(-1);
  const updates = unmount.updates;
  unmount.componentWillUnmount();
  assert.equal(pending?.aborted, 1);
  pending?.reject(new Error('after unmount'));
  await tick();
  assert.equal(unmount.updates, updates);
  // React 19 StrictMode replays mount/unmount/mount on the same class instance.
  unmount.componentDidMount();
  const replayRequest = requests.at(-1);
  assert.notEqual(replayRequest, pending);
  replayRequest?.resolve({ users: { list: [one] } });
  await tick();
  assert.equal(unmount.state.loading, false);
  assert.equal(unmount.state.loadError, undefined);
  assert.equal(unmount.state.mainData?.renderType, 1);
  unmount.componentWillUnmount();
  const wrapperModule: { default(options: DialogOptions): void } = load('../index.tsx') as {
    default(options: DialogOptions): void;
  };
  for (const chooseType of ['user', 'department', 'group', 'resigned'] as const) {
    let callbackCount = 0;
    let wrapperReceived: SelectUser[] | undefined;
    wrapperModule.default({
      chooseType,
      SelectUserSettings: {
        allowSelectNull: true,
        callback: users => {
          callbackCount++;
          wrapperReceived = users;
        },
      },
    });
    if (!wrapped) throw new Error('Wrapper did not create the dialog');
    const wrapper = new wrapped.Component({ ...wrapped.options, visible: true, onCancel() {} });
    const entry = wrapper.renderContent();
    const child = new moduleAbi.default(entry.props);
    child.submit();
    assert.equal(callbackCount, 0, `${chooseType} cannot bypass the wrapper empty-user contract`);
    const outgoing: [SelectUser] = [one];
    entry.props.userSettings?.callback?.(outgoing);
    assert.equal(wrapperReceived, outgoing, 'The real wrapper must preserve the selected array identity');
    child.toogleUserSelect(one);
    const selectedArray = child.selectedUsers;
    // selectedUsers is derived on submit; the callback must retain the exact submitted array.
    let received: SelectUser[] | undefined;
    if (!entry.props.userSettings) throw new Error('Missing wrapper user settings');
    // Set the producer before construction; $.extend creates the actual resolved settings object.
    const callbackChild = new moduleAbi.default({
      ...entry.props,
      userSettings: {
        ...entry.props.userSettings,
        callback: users => {
          received = users;
        },
      },
    });
    callbackChild.toogleUserSelect(one);
    callbackChild.submit();
    assert.equal(received?.[0], selectedArray[0]);
    callbackChild.componentWillUnmount();
    child.componentWillUnmount();
  }
  Object.assign(globalThis, {
    md: { global: { Account: { accountId: 'self', projects: [{ projectId: 'project', companyName: 'Org' }] } } },
  });
  wrapperModule.default({ SelectUserSettings: { projectId: null, filterOtherProject: true } });
  if (!wrapped) throw new Error('Missing invalid-project wrapper');
  const invalidProject = new wrapped.Component({ ...wrapped.options, visible: true, onCancel() {} });
  await assert.rejects(
    invalidProject.initDropList(),
    TypeError,
    'A missing restricted project must retain the old failure instead of filtering everything',
  );
  Object.assign(globalThis, {
    md: {
      global: {
        Account: { accountId: 'self', projects: [{ projectId: undefined, companyName: 'Legacy missing ID' }] },
      },
    },
  });
  wrapperModule.default({});
  if (!wrapped) throw new Error('Missing header wrapper');
  const headerWrapper = new wrapped.Component({ ...wrapped.options, visible: true, onCancel() {} });
  // Disable only the host's browser scheduling concern for the pure header contract.
  Object.assign(globalThis, {
    window: {
      cancelAnimationFrame() {},
      requestAnimationFrame() {
        return 1;
      },
    },
  });
  await headerWrapper.initDropList();
  assert.ok(
    headerWrapper.state.list?.some(row => row.value === undefined),
    'Do not silently remove the legacy undefined-valued option',
  );
  const header = headerWrapper.renderHeader();
  const headerChildren = header.props['children'];
  if (!Array.isArray(headerChildren)) throw new Error('Missing dropdown');
  const headerDropdown: Tree = headerChildren[1];
  const changeHeader = headerDropdown.props['onChange'];
  if (typeof changeHeader !== 'function') throw new Error('Missing dropdown callback');
  changeHeader(undefined);
  assert.equal(
    headerWrapper.state.projectId,
    undefined,
    'Undefined-valued project selection retains the original matching-field behavior',
  );
  interface MemberTree {
    state: {
      groupList: SelectUser[];
      loading: boolean;
      pageIndex: number;
      userError?: string;
      departmentLoading: boolean;
      departmentError?: string;
      department: Array<{ id: string; subs: unknown[] }>;
    };
    handleSelectGroup(id: string): void;
    handleLoadAll(id: string): void;
    getNextPageDepartmentTrees(id?: string): void;
    expandNext(id: string): void;
    renderDepartmentTree(): Tree;
    componentWillUnmount(): void;
    componentDidMount(): void;
  }
  interface MemberTreeProps {
    projectId: string;
    data: Array<{ departmentId: string; departmentName: string; id: string; name: string; subs: [] }>;
    userSettings: { filterAccountIds: string[] };
    selectedUsers: SelectUser[];
    selectedAccountIds: string[];
    onChange(user: SelectUser): void;
    removeSelectedData(ids: string[]): void;
    addSelectedData(items: unknown[]): void;
    userAction(): void;
    defaultCheckedDepId?: string;
  }
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {} } });
  const membersModule = load('DepartmentTree.tsx') as { default: new (props: MemberTreeProps) => MemberTree };
  const members = new membersModule.default({
    projectId: 'project',
    data: [{ departmentId: 'd', departmentName: 'Department', id: 'd', name: 'Department', subs: [] }],
    userSettings: { filterAccountIds: [] },
    selectedUsers: [],
    selectedAccountIds: [],
    onChange() {},
    removeSelectedData() {},
    addSelectedData() {},
    userAction() {},
  });
  members.handleSelectGroup('d');
  assert.equal(requests.at(-1)?.args.pageSize, 100);
  requests.at(-1)?.reject(new Error('members offline'));
  await tick();
  assert.equal(members.state.loading, false);
  assert.ok(members.state.userError);
  members.handleSelectGroup('d');
  requests.at(-1)?.resolve({ list: [one], allCount: 1 });
  await tick();
  assert.equal(members.state.groupList[0], one);
  assert.equal(members.state.userError, undefined);
  members.expandNext('d');
  requests.at(-1)?.resolve({ bad: 'tree' });
  await tick();
  assert.equal(members.state.departmentLoading, false);
  assert.ok(members.state.departmentError);
  const failureTree = members.renderDepartmentTree();
  const failureChildren = failureTree.props['children'];
  if (!Array.isArray(failureChildren)) throw new Error('Missing actual retry button');
  const retryButton: Tree = failureChildren[1];
  const retry = retryButton.props['onClick'];
  if (typeof retry !== 'function') throw new Error('Missing real retry handler');
  retry();
  assert.equal(members.state.departmentLoading, true);
  assert.equal(requests.at(-1)?.args.parentId, 'd');
  requests.at(-1)?.resolve([{ departmentId: 'sub', departmentName: 'Child' }]);
  await tick();
  assert.equal(members.state.department[0]?.subs.length, 1);
  members.expandNext('d');
  const staleDepartment = requests.at(-1);
  members.expandNext('d');
  const latestDepartment = requests.at(-1);
  latestDepartment?.resolve([{ departmentId: 'latest', departmentName: 'Latest' }]);
  await tick();
  staleDepartment?.reject(new Error('Old expansion failed'));
  await tick();
  assert.equal(
    members.state.departmentError,
    undefined,
    'A stale failure for the same department cannot replace a successful newer expansion',
  );
  members.componentWillUnmount();
  const replayMembers = new membersModule.default({
    projectId: 'project',
    defaultCheckedDepId: 'd',
    data: [],
    userSettings: { filterAccountIds: [] },
    selectedUsers: [],
    selectedAccountIds: [],
    onChange() {},
    removeSelectedData() {},
    addSelectedData() {},
    userAction() {},
  });
  replayMembers.componentDidMount();
  const abortedMemberRequest = requests.at(-1);
  replayMembers.componentWillUnmount();
  replayMembers.componentDidMount();
  const activeMemberRequest = requests.at(-1);
  assert.notEqual(activeMemberRequest, abortedMemberRequest);
  abortedMemberRequest?.resolve({ list: [user('stale')], allCount: 1 });
  activeMemberRequest?.resolve({ list: [one], allCount: 1 });
  await tick();
  assert.equal(replayMembers.state.groupList[0], one);
  assert.equal(replayMembers.state.loading, false);
  replayMembers.componentWillUnmount();
  const manageModule = load('ManageOftenUserDialog.tsx') as {
    default(props: {
      visible: boolean;
      userOptions: { projectId: string };
      dialogSelectUser: (options: DialogOptions) => void;
    }): Tree;
  };
  const drawManage = () => {
    hookIndex = 0;
    const tree = manageModule.default({
      visible: true,
      userOptions: { projectId: 'project' },
      dialogSelectUser: wrapperModule.default,
    });
    effectQueue.splice(0).forEach(effect => effect());
    return tree;
  };
  const findRole = (tree: Tree): Tree | undefined => {
    if (tree.props['role'] === 'alert') return tree;
    const children = tree.props['children'];
    for (const child of Array.isArray(children) ? children : [children]) {
      if (
        child &&
        typeof child === 'object' &&
        'type' in child &&
        'props' in child &&
        child.props &&
        typeof child.props === 'object'
      ) {
        const found = findRole(child);
        if (found) return found;
      }
    }
    return undefined;
  };
  drawManage();
  const manageUsers = requests.at(-2);
  const manageSettings = requests.at(-1);
  assert.equal(manageUsers?.name, 'user.getOftenMetionedUser');
  manageUsers?.reject(new Error('Often members offline'));
  manageSettings?.resolve({ addressBookOftenMetioned: 0 });
  await tick();
  const manageError = findRole(drawManage());
  assert.ok(manageError, 'The actual system-recommendation tab must expose loading failure and retry');
  const manageChildren = manageError?.props['children'];
  if (!Array.isArray(manageChildren)) throw new Error('Missing manage retry button');
  const manageRetryTree: Tree = manageChildren[1];
  const manageRetry = manageRetryTree.props['onClick'];
  if (typeof manageRetry !== 'function') throw new Error('Missing manage retry callback');
  manageRetry();
  requests.at(-2)?.resolve([one]);
  requests.at(-1)?.resolve({ addressBookOftenMetioned: 0 });
  await tick();
  assert.equal(findRole(drawManage()), undefined);
  console.log('GeneralSelect real lifecycle, selection, paging, branches, failures, abort and unmount passed');
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
