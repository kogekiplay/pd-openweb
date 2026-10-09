const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
interface TestNode {
  rowId: string;
  path: number[];
  pathId: string[];
  visible: boolean;
  display: boolean;
  children: Array<string | TestNode>;
}
interface TestRecord {
  rowid: string;
  pid?: string;
  childrenids?: string;
}
interface TestAction {
  type: string;
  data?: unknown;
  payload?: unknown;
  count?: number;
}
interface HierarchyModule {
  hierarchyViewState(state: TestNode[] | undefined, action: TestAction): TestNode[];
  hierarchyViewData(state: Record<string, TestRecord> | undefined, action: TestAction): Record<string, TestRecord>;
  hierarchyDataStatus(state: unknown, action: TestAction): Record<string, unknown>;
  hierarchyRelateSheetControls(state: unknown, action: TestAction): Record<string, unknown>;
  searchRecordId(state: string | null | undefined, action: TestAction): string | null;
}
function loadTarget(file: string, stubs: Record<string, unknown> = {}): unknown {
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
const util = loadTarget('./util.ts') as { dealPath(path: number[]): Array<number | string> };
const reducers = loadTarget('./hierarchyView.ts', { './util': util }) as HierarchyModule;
const rootRecord = { rowid: 'root', childrenids: '["child"]' };
const leafRecord = { rowid: 'child', pid: 'root', childrenids: '[]' };
const initial = reducers.hierarchyViewState(undefined, { type: 'INIT_HIERARCHY_VIEW_STATE', data: [rootRecord] });
assert.deepStrictEqual(initial, [
  { rowId: 'root', visible: false, display: true, path: [0], pathId: ['root'], children: ['child'] },
]);
assert.deepStrictEqual(util.dealPath([0, 1, 2]), [0, 'children', 1, 'children', 2]);
const expanded = reducers.hierarchyViewState(initial, {
  type: 'EXPAND_CHILDREN_STATE',
  data: { data: [leafRecord], path: [0], pathId: ['root'] },
});
assert.strictEqual(expanded[0]?.visible, true);
assert.deepStrictEqual(expanded[0]?.children, [
  { rowId: 'child', visible: false, display: true, path: [0, 0], pathId: ['root', 'child'], children: [] },
]);
assert.strictEqual(initial[0]?.visible, false);
assert.deepStrictEqual(initial[0]?.children, ['child']);
const tree = reducers.hierarchyViewState(undefined, {
  type: 'EXPAND_HIERARCHY_VIEW_STATE',
  data: { data: [rootRecord, leafRecord], treeData: { root: rootRecord, child: leafRecord }, level: '2' },
});
assert.strictEqual(tree[0]?.visible, true);
assert.strictEqual((tree[0]?.children[0] as TestNode).visible, false);
const withTemp = reducers.hierarchyViewState(expanded, {
  type: 'ADD_TEXT_TITLE_RECORD',
  data: { rowId: 'draft', path: [0], pathId: ['root', 'draft'] },
});
assert.deepStrictEqual(withTemp[0]?.children.slice(-1), ['draft']);
const removed = reducers.hierarchyViewState(withTemp, {
  type: 'REMOVE_HIERARCHY_TEMP_ITEM',
  data: { rowId: 'draft', path: [0] },
});
assert.strictEqual(removed[0]?.children.length, 1);
assert.strictEqual(typeof removed[0]?.children[0], 'object');
const records = reducers.hierarchyViewData(undefined, { type: 'ADD_TOP_LEVEL_STATE', data: [rootRecord, leafRecord] });
assert.deepStrictEqual(records, { root: rootRecord, child: leafRecord });
assert.deepStrictEqual(reducers.hierarchyViewData(undefined, { type: 'INIT_HIERARCHY_VIEW_DATA', data: [] }), []);
const controlGroup = [{ controlId: 'title', type: 2 }];
assert.deepStrictEqual(
  reducers.hierarchyRelateSheetControls(undefined, {
    type: 'INIT_HIERARCHY_RELATE_SHEET_CONTROLS',
    payload: { ids: ['sheet'], controls: [controlGroup] },
  }),
  { sheet: controlGroup },
);
assert.strictEqual(
  reducers.hierarchyDataStatus(undefined, { type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { pageIndex: 2 } })[
    'pageIndex'
  ],
  2,
);
assert.strictEqual(
  reducers.searchRecordId(undefined, { type: 'CHANGE_HIERARCHY_SEARCH_RECORD_ID', data: 'child' }),
  'child',
);
assert.strictEqual(reducers.hierarchyViewState(initial, { type: 'UNRELATED_ACTION' }), initial);
console.log('Hierarchy reducer ids, nested expansion, temp nodes, reset and controls passed');
