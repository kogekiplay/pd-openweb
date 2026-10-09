const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
type Row = { rowid: string; pid?: string; childrenids?: string; title?: string };
type Action = { type: string; data?: unknown; count?: number };
type Response = { resultCode: number; count: number; data?: unknown };
interface TestSheet {
  base: { appId: string; worksheetId: string; viewId: string };
  views: Array<{ viewId: string; viewType: number; childType: number; viewControl: string }>;
  filters: { searchType: number; keyWords: string; filterControls: unknown[] };
  quickFilter: unknown[];
  navGroupFilters: unknown[];
  hierarchyView: {
    hierarchyDataStatus: { pageSize: number };
    hierarchyTopLevelDataCount: number;
    hierarchyViewData: Record<string, Row>;
    hierarchyViewState: unknown[];
  };
}
type Thunk = (dispatch: (action: Action | Thunk) => void, getState: () => { sheet: TestSheet }) => void;
interface ActionsModule {
  expandedMultiLevelHierarchyData(args: { layer: string | number }): Thunk;
  getAssignChildren(args: { path: number[]; pathId: string[]; kanbanKey: string }): Thunk;
  updateTitleData(args: { rowId: string; data: { title: string } }): Thunk;
  addMultiRelateHierarchyControls(ids: string[]): Thunk;
}
interface Utilities {
  dealData(rows: Row[]): Record<string, Row>;
  getCurrentView(sheet: TestSheet): TestSheet['views'][number];
  getParaIds(sheet: TestSheet): TestSheet['base'];
  wrapAjax(
    fn: (...args: number[]) => { abort(): void; value: number },
  ): (...args: number[]) => { abort(): void; value: number };
  sortDataByCustomItems(
    rows: Array<{ key: string; sort: number }>,
    view: object,
    controls: object[],
    firstNotSpecified?: boolean,
  ): Array<{ key: string; sort: number }>;
  getUserRole(
    role: number | string,
    locked?: boolean,
  ): { isOwner?: boolean; isAdmin?: boolean; isDeveloper?: boolean; isRunner?: boolean };
}
function load(file: string, stubs: Record<string, unknown>): unknown {
  const target: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', code)(
    target,
    target.exports,
    (name: string) => stubs[name] || require(name),
  );
  return target.exports;
}
global.safeParse = (value: unknown, fallback: unknown = {}) => {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback === 'array' ? [] : fallback;
  }
};
global.window = { shareState: {} };
const roles = {
  POSSESS_ROLE: 200,
  MAP_OWNER: 300,
  ADMIN_ROLE: 100,
  DEVELOPERS_ROLE: 1,
  RUNNER_ROLE: 2,
  RUNNER_DEVELOPERS_ROLE: 3,
};
const utilities = load('./util.ts', { 'src/pages/worksheet/constants/enum': { APP_ROLE_TYPE: roles } }) as Utilities;
let aborts = 0;
const wrapped = utilities.wrapAjax((value: number) => ({ value, abort: () => aborts++ }));
assert.strictEqual(wrapped(1).value, 1);
assert.strictEqual(wrapped(2).value, 2);
assert.strictEqual(aborts, 1);
assert.deepStrictEqual(utilities.getUserRole(200, true), { isOwner: false });
assert.deepStrictEqual(utilities.getUserRole('200'), {});
const sorted = utilities.sortDataByCustomItems(
  [
    { key: '-1', sort: -1 },
    { key: 'a', sort: 3 },
    { key: 'b', sort: 2 },
  ],
  { viewControl: 'option', advancedSetting: { customitems: '["a","b"]' } },
  [{ controlId: 'option', type: 9 }],
  false,
);
assert.deepStrictEqual(
  sorted.map(row => row.key),
  ['a', 'b', '-1'],
);
assert.throws(
  () => utilities.sortDataByCustomItems([], { advancedSetting: { customitems: '{}' } }, []),
  /Invalid worksheet custom sort items/,
);
assert.throws(
  () =>
    utilities.sortDataByCustomItems(
      [],
      { viewControl: 'user', advancedSetting: { customitems: '["{\\\"id\\\":true}"]' } },
      [{ controlId: 'user', type: 26 }],
    ),
  /Invalid worksheet custom sort id/,
);
const row = { rowid: 'root', childrenids: '["child"]', title: 'Root' };
const sheet: TestSheet = {
  base: { appId: 'app', worksheetId: 'sheet', viewId: 'view' },
  views: [{ viewId: 'view', viewType: 2, childType: 1, viewControl: 'parent' }],
  filters: { searchType: 1, keyWords: '', filterControls: [] },
  quickFilter: [],
  navGroupFilters: [],
  hierarchyView: {
    hierarchyDataStatus: { pageSize: 25 },
    hierarchyTopLevelDataCount: 1,
    hierarchyViewData: { root: row },
    hierarchyViewState: [],
  },
};
let response: Response = { resultCode: 1, count: 2, data: [row, { rowid: 'child', pid: 'root', title: 'Child' }] };
const requests: Record<string, unknown>[] = [];
const api = {
  getFilterRows(args: Record<string, unknown>) {
    requests.push(args);
    return {
      abort() {},
      then(callback: (result: Response) => unknown) {
        callback(response);
        return this;
      },
    };
  },
  getWorksheetsControls() {
    return {
      then(callback: (value: unknown) => void) {
        callback(controlsResponse);
      },
    };
  },
};
let controlsResponse: unknown = { code: 1, data: [{ controls: [{ controlId: 'title', type: 2 }] }] };
const actions = load('./hierarchy.ts', {
  'src/api/worksheet': api,
  'src/utils/common': { getFilledRequestParams: (args: unknown) => args },
  'src/utils/filter': { formatQuickFilter: (args: unknown) => args },
  './util': utilities,
  './navFilter.js': {},
}) as ActionsModule;
const dispatched: Action[] = [];
const dispatch = (action: Action | Thunk): void => {
  if (typeof action === 'function') action(dispatch, () => ({ sheet }));
  else dispatched.push(action);
};
dispatch(actions.expandedMultiLevelHierarchyData({ layer: '2' }));
assert.strictEqual(requests[0]?.['pageSize'], 25);
assert.deepStrictEqual(dispatched.find(action => action.type === 'INIT_HIERARCHY_VIEW_DATA')?.data, {
  root: row,
  child: { rowid: 'child', pid: 'root', title: 'Child' },
});
assert.strictEqual(
  (dispatched.find(action => action.type === 'EXPAND_HIERARCHY_VIEW_STATE')?.data as { level: number }).level,
  2,
);
dispatched.length = 0;
dispatch(actions.getAssignChildren({ path: [0], pathId: ['root'], kanbanKey: 'root' }));
assert.strictEqual(dispatched[1]?.type, 'EXPAND_CHILDREN_STATE');
assert.strictEqual(requests[1]?.['kanbanKey'], 'root');
dispatched.length = 0;
response = { resultCode: 4, count: 0 };
assert.doesNotThrow(() => dispatch(actions.getAssignChildren({ path: [0], pathId: ['root'], kanbanKey: 'root' })));
assert.strictEqual(dispatched.length, 0);
response = { resultCode: 1, count: 1, data: [{ rowid: 42 }] };
assert.throws(
  () => dispatch(actions.getAssignChildren({ path: [0], pathId: ['root'], kanbanKey: 'root' })),
  /Invalid hierarchy worksheet rows/,
);
response = { resultCode: 1, count: 1, data: [{ rowid: 'bad', childrenids: [42] }] };
assert.throws(
  () => dispatch(actions.getAssignChildren({ path: [0], pathId: ['root'], kanbanKey: 'root' })),
  /Invalid hierarchy worksheet rows/,
);
dispatched.length = 0;
dispatch(actions.updateTitleData({ rowId: 'root', data: { title: 'Updated' } }));
assert.deepStrictEqual(dispatched[0]?.data, { root: { ...row, title: 'Updated' } });
assert.strictEqual(row.title, 'Root');
assert.throws(
  () => dispatch(actions.updateTitleData({ rowId: 'missing', data: { title: 'Lost' } })),
  /Hierarchy record is missing/,
);
dispatched.length = 0;
dispatch(actions.addMultiRelateHierarchyControls(['related-sheet']));
assert.deepStrictEqual((dispatched[0] as Action & { payload: unknown }).payload, {
  ids: ['related-sheet'],
  controls: [[{ controlId: 'title', type: 2 }]],
});
controlsResponse = { code: 1, data: [{}] };
assert.throws(
  () => dispatch(actions.addMultiRelateHierarchyControls(['related-sheet'])),
  /Hierarchy control fields are missing/,
);
console.log('Hierarchy requests, API row validation, cancellation, sorting and title updates passed');
