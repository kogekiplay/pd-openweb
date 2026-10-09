const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
globalThis.window = { shareState: {} };

type Action = { type: string; [key: string]: unknown };
type Thunk = (dispatch: (action: Action | Thunk) => unknown, getState: () => Record<string, unknown>) => unknown;
interface Actions {
  fetchRows: (options?: { updateWorksheetControls?: boolean }) => Thunk;
  updateControlOfRow: (
    args: {
      cell?: { controlId: string; value: unknown };
      cells?: { controlId: string; value: unknown }[];
      recordId: string;
    },
    options?: { callback: (row: unknown) => void },
  ) => Thunk;
  addRecord: (rows: Record<string, unknown>) => Thunk;
  getWorksheetSheetViewSummary: () => Thunk;
  refresh: () => Thunk;
  updateRows: (rowIds: string[], row: Record<string, unknown>) => Thunk;
}
let fetchResponse: unknown = { resultCode: 1, data: [], count: 0 };
let updateResponse: unknown = { resultCode: 1, data: { rowid: 'r1', title: 'new' } };
let summaryResponse: unknown = [];
let groupControlId = '';
const alerts: unknown[] = [];
const failures: unknown[] = [];
const calls: { kind: string; args: unknown }[] = [];
const api = {
  getFilterRowsTotalNum: () => Promise.resolve('1'),
  getFilterRows: (args: unknown) => {
    calls.push({ kind: 'rows', args });
    return Promise.resolve(fetchResponse);
  },
  getFilterRowsReport: (args: unknown) => {
    calls.push({ kind: 'summary', args });
    return Promise.resolve(summaryResponse);
  },
  updateWorksheetRow: (args: unknown) => {
    calls.push({ kind: 'update', args });
    return Promise.resolve(updateResponse);
  },
};
const stubs: Record<string, unknown> = {
  'src/api/worksheet': { __esModule: true, default: api },
  'worksheet/api': {},
  'worksheet/common/TreeTableHelper': {},
  'worksheet/common/TreeTableHelper/index.js': {},
  'src/components/Form/core/formUtils': { getRuleErrorInfo: () => [] },
  'src/pages/widgetConfig/config/widget': {
    SYSTEM_CONTROL_WITH_UAID: [],
    WORKFLOW_SYSTEM_CONTROL: [],
    WIDGETS_TO_API_TYPE_ENUM: { MULTI_SELECT: 10, DROP_DOWN: 11 },
  },
  'src/utils/common': {
    getFilledRequestParams: (args: unknown) => args,
    getLRUWorksheetConfig: () => '{}',
    saveLRUWorksheetConfig: () => {},
    clearLRUWorksheetConfig: () => {},
  },
  'src/utils/filter': { formatQuickFilter: (value: unknown) => value },
  'src/utils/record': { handleRecordError: (...args: unknown[]) => failures.push(args) },
  'src/utils/translate': {
    replaceControlsTranslateInfo: (_app: unknown, _worksheet: unknown, controls: unknown) => controls,
  },
  'src/utils/worksheet': {
    getGroupControlId: () => groupControlId,
    getFiltersForGroupedView: () => ({}),
    getListStyle: () => ({ time: 1, styles: [] }),
  },
  './navFilter.js': { updateNavGroup: () => ({ type: 'TEST_NAV_REFRESH' }) },
  './util.js': { sortDataByGroupItems: (groups: unknown) => groups },
};
const source = process.env.SHEETVIEW_BOUNDARY_SOURCE || path.join(__dirname, 'sheetview.ts');
const { code } = transformFileSync(source, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
const moduleLike: { exports: Partial<Actions> } = { exports: {} };
new Function('module', 'exports', 'require', 'safeParse', '_l', 'alert', code)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (Object.hasOwn(stubs, name)) return stubs[name];
    throw new Error(`Unexpected boundary dependency ${name}`);
  },
  (value: unknown) => (typeof value === 'string' ? JSON.parse(value || '{}') : value),
  (value: unknown) => value,
  (...args: unknown[]) => alerts.push(args),
);
const actions = moduleLike.exports as Actions;

function state(view = true): Record<string, unknown> {
  return {
    sheet: {
      base: { appId: 'app', worksheetId: 'worksheet', viewId: 'view', chartId: 'chart' },
      filters: { filterControls: [], keyWords: '', searchType: 1 },
      views: view ? [{ viewId: 'view', viewType: 0, advancedSetting: {} }] : [],
      controls: [{ controlId: 'title', type: 2 }],
      quickFilter: [],
      navGroupFilters: [],
      sheetview: {
        abortController: new AbortController(),
        sheetFetchParams: { pageIndex: 1, sortControls: [] },
        sheetViewConfig: { columnStyles: {}, allWorksheetIsSelected: false, sheetSelectedRows: [] },
        sheetViewData: {
          rows: [{ rowid: 'old', title: 'old' }],
          count: 1,
          rowsSummary: { types: { title: 1 }, values: { title: 99 } },
          groupRowsSummary: {},
        },
        treeTableViewData: { treeMap: {}, maxLevel: 0 },
        groupFetchParams: {},
      },
    },
  };
}
function runThunk(thunk: Thunk, value: Record<string, unknown>): Action[] {
  const result: Action[] = [];
  const dispatch = (action: Action | Thunk): unknown =>
    typeof action === 'function' ? action(dispatch, () => value) : result.push(action);
  thunk(dispatch, () => value);
  return result;
}
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function run(): Promise<void> {
  updateResponse = { resultCode: 1, data: { rowid: 'r1', title: 'new' } };
  let callbacks = 0;
  const cellActions = runThunk(
    actions.updateControlOfRow(
      { cells: [{ controlId: 'title', value: 'new' }], recordId: 'r1' },
      {
        callback: () => {
          callbacks += 1;
        },
      },
    ),
    state(),
  );
  await settle();
  assert.equal(callbacks, 1);
  assert.equal(alerts.length, 0, 'Batch editing without a primary cell must not falsely report failure after success');
  assert.ok(cellActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_UPDATE_ROWS_BY_ROWIDS'));

  updateResponse = { resultCode: 1 };
  const beforeCallback = callbacks;
  const missingUpdateActions = runThunk(
    actions.updateControlOfRow(
      { cell: { controlId: 'title', value: 'new' }, recordId: 'r1' },
      {
        callback: () => {
          callbacks += 1;
        },
      },
    ),
    state(),
  );
  await settle();
  assert.equal(callbacks, beforeCallback, 'A success code without row data must not invoke the success callback');
  assert.ok(!missingUpdateActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_UPDATE_ROWS_BY_ROWIDS'));
  assert.ok(alerts.length > 0);

  fetchResponse = { resultCode: 1, count: 5 };
  const missingFetchActions = runThunk(actions.fetchRows(), state());
  await settle();
  const restoration = missingFetchActions.find(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_ROWS');
  assert.deepEqual(
    restoration?.rows,
    [{ rowid: 'old', title: 'old' }],
    'Missing API rows must preserve displayed rows',
  );
  assert.ok(
    missingFetchActions.some(action => action.type === 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING' && action.value === false),
  );
  assert.ok(!missingFetchActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_UPDATE_COUNT'));

  fetchResponse = { resultCode: 1, data: [{ rowid: 'new' }], count: 1 };
  const validFetchActions = runThunk(actions.fetchRows(), state());
  await settle();
  assert.deepEqual(validFetchActions.find(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_ROWS')?.rows, [
    { rowid: 'new' },
  ]);

  const cancelled = state();
  const sheet = cancelled['sheet'] as { sheetview: { abortController: AbortController } };
  sheet.sheetview.abortController.abort();
  fetchResponse = { resultCode: 1 };
  const cancelledActions = runThunk(actions.fetchRows(), cancelled);
  await settle();
  assert.ok(
    !cancelledActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_ROWS'),
    'Cancelled stale requests must not restore rows over a newer request',
  );

  assert.doesNotThrow(
    () => runThunk(actions.addRecord({ rowid: 'r1' }), state(false)),
    'Adding a non-tree record before a view arrives must not throw',
  );
  groupControlId = '';
  const plainView = state();
  const plainSheet = plainView['sheet'] as { base: { chartId?: string }; views: unknown[] };
  delete plainSheet.base.chartId;
  plainSheet.views = [{ viewId: 'view', viewType: 0, advancedSetting: { showallitem: '1' } }];
  assert.doesNotThrow(() => runThunk(actions.refresh(), plainView), 'A view without navGroup must not throw');
  await settle();

  summaryResponse = { invalid: true };
  const invalidSummaryActions = runThunk(actions.getWorksheetSheetViewSummary(), state());
  await settle();
  assert.ok(
    !invalidSummaryActions.some(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS'),
    'Invalid summary payload must not replace existing values with an empty success',
  );
  const rawValue = { customStatistic: 'unverified' };
  summaryResponse = [{ controlId: 'title', value: rawValue }];
  const summaryActions = runThunk(actions.getWorksheetSheetViewSummary(), state());
  await settle();
  const summary = summaryActions.find(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS');
  assert.equal(
    (summary?.values as Record<string, unknown>)['title'],
    rawValue,
    'Raw statistics stay unknown and unchanged',
  );
  // Group moves tolerate a record removed by a concurrent refresh, retaining valid header totals.
  const grouped = state();
  const groupedSheet = grouped['sheet'] as { sheetview: { sheetViewData: { rows: Record<string, unknown>[] } } };
  groupedSheet.sheetview.sheetViewData.rows = [
    { rowid: 'groupTitle', key: 'new-group', count: 1 },
    { rowid: 'r2', groupKey: 'new-group' },
  ];
  assert.doesNotThrow(() =>
    runThunk(actions.updateRows(['missing'], { rowid: 'missing', group: { key: 'new-group' } }), grouped),
  );

  // Valid custom options still keep the server key and the submitted label/extra settings.
  const optionState = state();
  const optionSheet = optionState['sheet'] as { controls: Record<string, unknown>[] };
  optionSheet.controls = [{ controlId: 'choice', type: 10, options: [{ key: 'existing', value: 'Existing' }] }];
  updateResponse = { resultCode: 1, data: { rowid: 'r1', choice: '["server-key"]' } };
  const optionActions = runThunk(
    actions.updateControlOfRow({
      cell: { controlId: 'choice', value: JSON.stringify([JSON.stringify({ value: 'New', color: '#123456' })]) },
      recordId: 'r1',
    }),
    optionState,
  );
  await settle();
  const updatedControl = optionActions.find(action => action.type === 'WORKSHEET_UPDATE_CONTROL')?.control as
    { options: unknown[] } | undefined;
  assert.deepEqual(updatedControl?.options.at(-1), {
    index: 2,
    isDeleted: false,
    key: 'server-key',
    value: 'New',
    color: '#123456',
  });

  assert.ok(calls.length > 0);
  assert.equal(failures.length, 0);
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
