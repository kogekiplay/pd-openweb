const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync, jsxRuntimeFrom } = require('../../../../../scripts/spec-harness.ts');
interface RelationUser {
  accountId: string;
  fullname?: string;
  projectId?: string;
  subordinates?: string[];
}
interface RelationState {
  entities: { users: Record<string, RelationUser> };
}
interface RelationAction {
  type: string;
  payload?: { source?: RelationUser[]; id?: string };
}
type RelationThunk = (
  dispatch: RelationDispatch,
  getState: () => RelationState,
  extra: { projectId: string },
) => unknown;
type RelationDispatch = (action: RelationAction | RelationThunk) => unknown;
interface RelationStore {
  dispatch: RelationDispatch;
  getState: () => RelationState;
}
interface RelationActions {
  initRoot(): RelationThunk;
  fetchRootSubordinates(id: string): RelationThunk;
  fetchSubordinates(id: string): RelationThunk;
  fetchParent(id: string): RelationThunk;
  addSubordinates(args: { id: string; accounts: RelationUser[] }): RelationThunk;
  replaceStructure(args: { account: RelationUser; parentId: string; replacedAccountId: string }): RelationThunk;
  removeStructure(args: { parentId: string; accountId: string }): RelationThunk;
}
function loadTarget(file: string, stubs: Record<string, unknown> = {}): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', '$', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => (Object.hasOwn(stubs, name) ? stubs[name] : require(name)),
    { extend: Object.assign },
  );
  return moduleLike.exports;
}
const requests: { method: string; projectId: string; accountIds?: string[] }[] = [];
const request = (
  method: string,
  args: { projectId: string; accountIds?: string[] },
  response: unknown,
): Promise<unknown> => {
  requests.push({ method, ...args });
  return Promise.resolve(response);
};
const api = {
  pagedGetAccountList: (args: { projectId: string }) => request('list', args, { totalCount: 0, pagedDatas: [] }),
  getParentsByAccountId: (args: { projectId: string }) => request('parents', args, []),
  addStructure: (args: { projectId: string; accountIds: string[] }) => request('add', args, { success: false }),
  replaceUserStructure: (args: { projectId: string }) => request('replace', args, 10002),
  removeParentID: (args: { projectId: string }) => request('remove', args, 10002),
};
const actions = loadTarget('./actions.ts', {
  'src/api/structure': { __esModule: true, default: api },
  'src/utils/project': { getCurrentProject: (projectId: string) => ({ companyName: `Company ${projectId}` }) },
}) as RelationActions;
const { default: reducer } = loadTarget('./reducer.ts', { './actions': actions }) as { default: unknown };
const { default: createStore } = loadTarget('./store.ts', { './reducer': { __esModule: true, default: reducer } }) as {
  default: (projectId: string) => RelationStore;
};
global._l = (text: string) => text;
global.alert = () => undefined;
global._l = (text: string) => text;
const selectedDialogs: {
  SelectUserSettings: { projectId: string; extraTabs: { actions: { getUsers: (args: object) => Promise<unknown> } }[] };
}[] = [];
const helpers = loadTarget('./common.ts', {
  'ming-ui/functions': {
    dialogSelectUser: (options: (typeof selectedDialogs)[number]) => selectedDialogs.push(options),
  },
  'src/api/projectSetting': {
    default: {
      setStructureForAll: (args: { projectId: string }) => request('visible', args, true),
      setStructureSelfEdit: (args: { projectId: string }) => request('selfEdit', args, true),
    },
    __esModule: true,
  },
  'src/api/structure': {
    default: { getAllowChooseUsers: (args: { projectId: string }) => request('choose', args, []) },
    __esModule: true,
  },
}) as {
  setStructureForAll: (args: { projectId: string; forAll: boolean }) => Promise<unknown>;
  setStructureSelfEdit: (args: { projectId: string; isAllowStructureSelfEdit: boolean }) => Promise<unknown>;
};
class TestComponent {
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
}
function element(
  type: unknown,
  props: Record<string, unknown>,
  ...children: unknown[]
): { type: unknown; props: Record<string, unknown> } {
  return { type, props: { ...props, ...(children.length ? { children: children.flat() } : {}) } };
}
const { default: Node } = loadTarget('./components/node.tsx', {
  react: { Component: TestComponent, createElement: element },
  'react-redux': { connect: () => (component: unknown) => component },
  'react/jsx-runtime': jsxRuntimeFrom(element),
  'ming-ui': { Dialog: {}, Icon: 'Icon', LoadDiv: 'LoadDiv' },
  'styled-components': { __esModule: true, default: new Proxy({}, { get: (_object, tag) => () => tag }) },
  '../actions': actions,
  '../common': helpers,
  './item': { default: 'Item', __esModule: true },
  './noData': { default: 'NoData', __esModule: true },
}) as {
  default: new (props: Record<string, unknown>) => {
    renderChilds(): { props: { children: { props: Record<string, unknown> }[] } };
    add(): void;
  };
};
const node = new Node({
  id: 'parent',
  projectId: 'organization-a',
  subordinates: ['child'],
  collapsed: false,
  sourceData: [],
  dispatch: () => undefined,
});
const child = node.renderChilds().props.children[0];
assert.equal(child?.props.projectId, 'organization-a', 'Organization context must reach nested rendered nodes');
node.add();
assert.equal(
  selectedDialogs.at(-1)?.SelectUserSettings.projectId,
  'organization-a',
  'The actual user chooser receives the node organization',
);
const stores = [createStore('organization-a'), createStore('organization-b')];
assert.notEqual(stores[0], stores[1]);
for (const [index, store] of stores.entries()) {
  const expected = index ? 'organization-b' : 'organization-a';
  store.dispatch(actions.initRoot());
  assert.equal(store.getState().entities.users['']?.projectId, expected);
  assert.equal(store.getState().entities.users['']?.fullname, `Company ${expected}`);
}
async function run(): Promise<void> {
  for (const [index, store] of stores.entries()) {
    const expected = index ? 'organization-b' : 'organization-a';
    const start = requests.length;
    await store.dispatch(actions.fetchRootSubordinates(''));
    await store.dispatch(actions.fetchSubordinates('parent'));
    await store.dispatch(actions.fetchParent('account'));
    store.dispatch(actions.addSubordinates({ id: '', accounts: [{ accountId: 'employee' }] }));
    store.dispatch(
      actions.replaceStructure({ account: { accountId: 'employee' }, parentId: '', replacedAccountId: 'old' }),
    );
    store.dispatch(actions.removeStructure({ parentId: '', accountId: 'employee' }));
    await Promise.resolve();
    assert.deepEqual(
      requests.slice(start).map(item => item.method),
      ['list', 'list', 'parents', 'add', 'replace', 'remove'],
    );
    assert.ok(
      requests.slice(start).every(item => item.projectId === expected),
      'Each real thunk receives the current store organization',
    );
  }
  assert.equal(stores[0]?.getState().entities.users['']?.projectId, 'organization-a');
  assert.equal(stores[1]?.getState().entities.users['']?.projectId, 'organization-b');
  console.log('ReportRelation two real RTK stores isolate every structure API organization');
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
