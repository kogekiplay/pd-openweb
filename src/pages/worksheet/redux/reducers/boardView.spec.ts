const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

interface TestRecord {
  rowid: string;
  title?: string;
  category?: string;
  secondary?: string;
  allowedit?: boolean;
}
interface TestGroup {
  key: string;
  rows: string[];
  totalNum: number;
  type?: number;
  name?: string;
}
interface TestBoardState {
  boardData: TestGroup[];
  loading: boolean;
  boardViewLoading?: boolean;
  boardViewState: { kanbanIndex: number; hasMoreData: boolean };
  boardViewRecordCount?: Record<string, number>;
  boardViewCard: { height: number; needUpdate: boolean };
  sortedOptionKeys: string[];
}
interface TestAction {
  type: string;
  data?: unknown;
  payload?: unknown;
  loading?: boolean;
}
interface BoardModule {
  default(state: TestBoardState | undefined, action: TestAction): TestBoardState;
  getIndex(state: TestGroup[], data: { key: string; rowId: string }): [number, number] | null;
}
function loadTarget(file: string, stubs: Record<string, unknown> = {}): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.isAbsolute(file) ? file : path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (request: string) =>
    Object.hasOwn(stubs, request) ? stubs[request] : require(request),
  );
  return moduleLike.exports;
}
const source = process.env.BOARD_REDUCER_SOURCE || './boardView.ts';
const board = loadTarget(source, {
  'src/components/Form/core/config': { WIDGET_VALUE_ID: { 26: 'accountId', 27: 'departmentId', 48: 'organizeId' } },
}) as BoardModule;
const reducer = board.default;
const row = (value: TestRecord): string => JSON.stringify(value);
const firstRow = { rowid: 'r1', title: 'First', category: '["first"]', allowedit: true };
const secondRow = { rowid: 'r2', title: 'Second' };
const groups: TestGroup[] = [
  { key: 'first', type: 9, rows: [row(firstRow), row(secondRow)], totalNum: 2 },
  { key: 'second', type: 9, rows: [], totalNum: 0 },
];
const initial = reducer(undefined, { type: 'UNRELATED' });
assert.deepEqual(initial, {
  boardData: [],
  loading: false,
  boardViewState: { hasMoreData: true, kanbanIndex: 1 },
  boardViewCard: { needUpdate: true, height: 0 },
  sortedOptionKeys: [],
});
const state = reducer(initial, { type: 'CHANGE_BOARD_VIEW_DATA', data: groups });
assert.deepEqual(board.getIndex(groups, { key: 'first', rowId: 'r2' }), [0, 1]);
assert.equal(board.getIndex(groups, { key: 'absent', rowId: 'r2' }), null);
assert.equal(board.getIndex(groups, { key: 'first', rowId: 'absent' }), null);
assert.equal(
  reducer(state, { type: 'DEL_BOARD_VIEW_RECORD_COUNT', data: { key: 'absent', rowId: 'r1' } }).boardData,
  groups,
);
const deleted = reducer(state, { type: 'DEL_BOARD_VIEW_RECORD_COUNT', data: { key: 'first', rowId: 'r2' } });
assert.equal(deleted.boardData[0]?.totalNum, 1);
assert.deepEqual(
  deleted.boardData[0]?.rows.map(value => JSON.parse(value).rowid),
  ['r1'],
);
assert.equal(groups[0]?.rows.length, 2, 'Reducers must not mutate the prior group array');
const edited = reducer(state, {
  type: 'UPDATE_BOARD_VIEW_RECORD',
  data: { key: 'first', rowId: 'r1', item: { rowid: 'r1', title: 'Updated' }, info: { type: 9 } },
});
assert.deepEqual(JSON.parse(edited.boardData[0]?.rows[0] || '{}'), { ...firstRow, title: 'Updated' });
const sorted = reducer(state, {
  type: 'SORT_BOARD_VIEW_RECORD',
  data: {
    key: 'first',
    rowId: 'r1',
    targetKey: 'second',
    value: '["second"]',
    firstGroupChange: true,
    firstGroupControlId: 'category',
    secondGroupChange: true,
    secondGroupControlId: 'secondary',
    secondGroupValue: '["child"]',
  },
});
assert.deepEqual(
  sorted.boardData[0]?.rows.map(value => JSON.parse(value).rowid),
  ['r2'],
);
assert.deepEqual(JSON.parse(sorted.boardData[1]?.rows[0] || '{}'), {
  ...firstRow,
  category: '["second"]',
  secondary: '["child"]',
});
const titleEdited = reducer(state, {
  type: 'UPDATE_BOARD_TITLE_DATA',
  data: { key: 'first', index: 1, data: { title: 'New title' } },
});
assert.deepEqual(JSON.parse(titleEdited.boardData[0]?.rows[1] || '{}'), { ...secondRow, title: 'New title' });
const moved = reducer(state, {
  type: 'UPDATE_BOARD_VIEW_RECORD',
  data: {
    key: 'first',
    rowId: 'r1',
    item: firstRow,
    info: { type: 9 },
    target: '["new-option"]',
    targetName: 'New option',
  },
});
assert.equal(moved.boardData[2]?.key, 'new-option');
const counted = reducer(moved, { type: 'UPDATE_BOARD_VIEW_RECORD_COUNT', data: ['new-option', 1] });
assert.equal(
  counted.boardViewRecordCount?.['new-option'],
  1,
  'A newly created group must start counting at zero, not NaN',
);
assert.equal(
  reducer(counted, { type: 'UPDATE_BOARD_VIEW_RECORD_COUNT', data: ['new-option', -3] }).boardViewRecordCount?.[
    'new-option'
  ],
  0,
);

const multiState = reducer(initial, {
  type: 'CHANGE_BOARD_VIEW_DATA',
  data: [
    { key: 'first', type: 10, rows: [row(firstRow), row(secondRow)], totalNum: 2 },
    { key: '-1', type: 10, rows: [], totalNum: 0 },
  ],
});
const multiPayload = {
  key: 'first',
  rowId: 'r1',
  item: { ...firstRow, category: '["new-option"]' },
  prevValue: '["first"]',
  currentValue: '["new-option"]',
  info: { type: 10 },
  selectControl: { options: [{ key: 'new-option', value: 'New option' }] },
};
const selected = reducer(multiState, { type: 'UPDATE_MULTI_SELECT_BOARD', data: multiPayload });
assert.deepEqual(
  selected.boardData.map(group => group.key),
  ['first', '-1', 'new-option'],
);
assert.equal(selected.boardData[0]?.totalNum, 1, 'Removing a selection must update a group at index zero');
assert.deepEqual(
  selected.boardData[0]?.rows.map(value => JSON.parse(value).rowid),
  ['r2'],
);
assert.deepEqual(
  selected.boardData[2]?.rows.map(value => JSON.parse(value).rowid),
  ['r1'],
);
const cleared = reducer(multiState, {
  type: 'UPDATE_MULTI_SELECT_BOARD',
  data: { ...multiPayload, currentValue: '[]' },
});
assert.deepEqual(
  cleared.boardData[1]?.rows.map(value => JSON.parse(value).rowid),
  ['r1'],
);
const noMatchingRecord = reducer(multiState, {
  type: 'UPDATE_MULTI_SELECT_BOARD',
  data: { ...multiPayload, rowId: 'not-loaded', prevValue: '["first"]', currentValue: '["first"]' },
});
assert.deepEqual(
  noMatchingRecord.boardData[0]?.rows,
  multiState.boardData[0]?.rows,
  'An absent record must not replace the final row via splice(-1)',
);
assert.equal(groups[0]?.rows[0], row(firstRow));
assert.equal(reducer(state, { type: 'UNRELATED_ACTION' }), state);

const boundary = loadTarget('./boardViewApi.ts') as { readBoardGroups(value: unknown): TestGroup[] };
assert.equal(boundary.readBoardGroups(groups), groups, 'Valid API groups retain their exact object identities');
assert.deepEqual(boundary.readBoardGroups(undefined), []);
assert.deepEqual(boundary.readBoardGroups(null), []);
assert.throws(
  () => boundary.readBoardGroups([{ key: 'first', rows: [firstRow], totalNum: 1 }]),
  /Invalid GetFilterRows/,
);
assert.throws(() => boundary.readBoardGroups([{ key: 'first', rows: [], totalNum: '1' }]), /Invalid GetFilterRows/);
console.log('Board reducer serialized records, counts, first-group multi-select and API boundary passed');
