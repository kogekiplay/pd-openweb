const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
interface Row {
  rowid?: string;
  key?: string;
  pid?: string;
  childrenids?: string;
}
interface Node {
  index: number;
  key: string;
  rowid: string;
  childrenIds: string[];
  parentKeys: string[];
  levelList: number[];
  folded: boolean;
  loaded: boolean;
}
interface Options {
  treeMap?: Record<string, Node>;
  rows?: Row[];
  maxLevel?: number;
  getNewRows?: () => Promise<Row[] | undefined>;
}
interface Action {
  type: string;
  key?: string;
  loading?: boolean;
  rows?: Row[];
  [key: string]: unknown;
}
interface TreeApi {
  getSheetViewRows: (state: { rows: Row[] }, tree: { treeMap?: Record<string, Node> }) => Row[];
  handleUpdateTreeNodeExpansion: (row: Row, options: Options) => (dispatch: (action: Action) => void) => Promise<void>;
}
const moduleLike: { exports: Partial<TreeApi> } = { exports: {} };
const source = process.env.TREE_EXPANSION_SOURCE || path.join(__dirname, 'index.ts');
const { code } = transformFileSync(source, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
const alerts: unknown[] = [];
new Function('module', 'exports', 'require', 'safeParse', '_l', 'alert', code)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (name === 'src/utils/control') return { parseAdvancedSetting: () => ({}) };
    throw new Error(`Unexpected expansion dependency ${name}`);
  },
  (value: unknown) => (typeof value === 'string' ? JSON.parse(value || '[]') : []),
  (text: string) => text,
  (...args: unknown[]) => alerts.push(args),
);
const expand = moduleLike.exports.handleUpdateTreeNodeExpansion;
if (!expand) throw new Error('The actual tree expansion thunk was not loaded');
const node: Node = {
  index: 1,
  key: 'root',
  rowid: 'r1',
  childrenIds: [],
  parentKeys: [],
  levelList: [1],
  folded: true,
  loaded: false,
};
async function run(): Promise<void> {
  const row: Row = { rowid: 'r1', key: 'root', childrenids: '[]' };
  const getRows = moduleLike.exports.getSheetViewRows;
  if (!getRows) throw new Error('The real getSheetViewRows helper was not loaded');
  const dotNode: Node = { ...node, key: 'root.child', rowid: 'dot-row' };
  const collisionNode: Node = { ...node, key: 'root.child.rowid', rowid: 'collision-row' };
  assert.deepEqual(
    getRows(
      { rows: [{ rowid: 'dot-row' }, { rowid: 'collision-row' }] },
      { treeMap: { 'root.child': dotNode, 'root.child.rowid': collisionNode } },
    ).map(row => row.rowid),
    ['dot-row', 'collision-row'],
    'Tree keys containing dots must resolve their own node metadata',
  );
  assert.deepEqual(getRows({ rows: [{ rowid: 'plain' }] }, {}), [{ rowid: 'plain' }]);
  const invalidActions: Action[] = [];
  await expand(row, { treeMap: { root: node }, rows: [row], getNewRows: () => Promise.resolve(undefined) })(action =>
    invalidActions.push(action),
  );
  assert.equal(invalidActions[0]?.loading, true);
  assert.equal(
    invalidActions.at(-1)?.loading,
    false,
    'A missing row response must release the actual node loading flag',
  );
  assert.ok(
    !invalidActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_APPEND_ROWS'),
    'Missing rows are not a successful empty subtree',
  );
  assert.ok(alerts.length > 0);

  const rejectedActions: Action[] = [];
  const rejection = { errorCode: 403 };
  await assert.rejects(
    expand(row, { treeMap: { root: node }, rows: [row], getNewRows: () => Promise.reject(rejection) })(action =>
      rejectedActions.push(action),
    ),
    error => error === rejection,
  );
  assert.equal(rejectedActions.at(-1)?.loading, false);

  const validActions: Action[] = [];
  await expand(row, {
    treeMap: { root: node },
    rows: [row],
    maxLevel: 1,
    getNewRows: () => Promise.resolve([{ rowid: 'r2', pid: 'r1' }]),
  })(action => validActions.push(action));
  assert.deepEqual(validActions.find(action => action.type === 'WORKSHEET_SHEETVIEW_APPEND_ROWS')?.rows, [
    { rowid: 'r2', pid: 'r1' },
  ]);
  assert.equal(validActions.at(-1)?.loading, false);
  const loadedActions: Action[] = [];
  await expand(row, { treeMap: { root: { ...node, loaded: true } }, rows: [row] })(action =>
    loadedActions.push(action),
  );
  assert.deepEqual(
    loadedActions,
    [{ type: 'UPDATED_TREE_NODE_EXPANSION', key: 'root', folded: false }],
    'Already loaded nodes must still toggle without a request callback',
  );
  const uninitializedActions: Action[] = [];
  await expand({}, {})(action => uninitializedActions.push(action));
  assert.equal(uninitializedActions.length, 0);
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
