const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

interface TestRow {
  rowid: string;
  key?: string;
  count?: number;
  groupKey?: string;
  isLoading?: boolean;
}
interface TestState {
  sheet: {
    base: { appId: string; viewId: string; worksheetId: string; maxCount?: number };
    filters: { requestParams: Record<string, unknown> };
    sheetview: {
      abortController: object;
      sheetFetchParams: { sortControls: { controlId: string; isAsc: boolean }[] };
      sheetViewData: { rows: TestRow[] };
      groupFetchParams: Record<string, { pageIndex?: number | undefined }>;
    };
    quickFilter: unknown[];
    navGroupFilters: unknown[];
  };
}
interface RequestArgs {
  appId: string;
  worksheetId: string;
  viewId: string;
  kanbanKey: string;
  pageSize: number;
  pageIndex: number;
}
interface TestAction {
  type: string;
  rows?: TestRow[];
  groupKey?: string;
  changes?: { pageIndex: number };
}
interface SheetViewActions {
  loadGroupMore: (groupKey: string) => (dispatch: (action: TestAction) => void, getState: () => TestState) => void;
}

const requests: { args: RequestArgs; options: { abortController: object } }[] = [];
let apiResponse: { data: { key: string; rows: string[] }[] } = { data: [] };
const worksheetApi = {
  getFilterRows: (args: RequestArgs, options: { abortController: object }) => {
    requests.push({ args, options });
    return Promise.resolve(apiResponse);
  },
};
const moduleLike: { exports: Partial<SheetViewActions> } = { exports: {} };
const stubs: Record<string, unknown> = {
  'src/api/worksheet': { __esModule: true, default: worksheetApi },
  'worksheet/api': {},
  'worksheet/common/TreeTableHelper': {},
  'worksheet/common/TreeTableHelper/index.js': {},
  'src/components/Form/core/formUtils': {},
  'src/pages/widgetConfig/config/widget': {},
  'src/utils/common': { getFilledRequestParams: (args: RequestArgs) => args },
  'src/utils/filter': { formatQuickFilter: (filters: unknown[]) => filters },
  'src/utils/record': {},
  'src/utils/translate': {},
  'src/utils/worksheet': {},
  './navFilter.js': {},
  './util.js': {},
};
const source = process.env.SHEETVIEW_PAGING_SOURCE || path.join(__dirname, 'sheetview.ts');
const { code } = transformFileSync(source, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
new Function('module', 'exports', 'require', 'safeParse', code)(
  moduleLike,
  moduleLike.exports,
  (request: string): unknown => {
    if (request === 'lodash') return require('lodash');
    if (Object.hasOwn(stubs, request)) return stubs[request];
    throw new Error(`Unexpected sheetview action dependency: ${request}`);
  },
  (value: string): unknown => JSON.parse(value),
);
const loadGroupMore = moduleLike.exports.loadGroupMore;
if (!loadGroupMore) throw new Error('The actual loadGroupMore action was not loaded');

async function checkGroupPaging(
  groupKey: string,
  groupFetchParams: TestState['sheet']['sheetview']['groupFetchParams'],
  expectedPageIndex: number,
): Promise<void> {
  const rows: TestRow[] = [
    { rowid: 'groupTitle', key: groupKey, count: 2 },
    { rowid: 'existing-record', groupKey },
    { rowid: 'loadGroupMore', groupKey },
  ];
  const state: TestState = {
    sheet: {
      base: { appId: 'app-1', viewId: 'view-1', worksheetId: 'sheet-1' },
      filters: { requestParams: {} },
      sheetview: {
        abortController: { id: 'request-controller' },
        sheetFetchParams: { sortControls: [{ controlId: 'title', isAsc: true }] },
        sheetViewData: { rows },
        groupFetchParams,
      },
      quickFilter: [],
      navGroupFilters: [],
    },
  };
  const actions: TestAction[] = [];
  apiResponse = { data: [{ key: groupKey, rows: [JSON.stringify({ rowid: 'new-record' })] }] };
  const previousRequestCount = requests.length;
  loadGroupMore(groupKey)(
    action => actions.push(action),
    () => state,
  );

  assert.equal(requests.length, previousRequestCount + 1, 'The real thunk must issue its row request');
  const request = requests[previousRequestCount];
  assert.ok(request);
  assert.equal(request.args.kanbanKey, groupKey, 'The exact group key must reach the API');
  assert.equal(request.args.pageIndex, expectedPageIndex, `Incorrect page requested for group ${groupKey}`);
  assert.equal(request.args.pageSize, 20);
  assert.equal(request.args.worksheetId, 'sheet-1');
  assert.equal(request.options.abortController, state.sheet.sheetview.abortController);
  assert.equal(actions[0]?.rows?.find(row => row.rowid === 'loadGroupMore')?.isLoading, true);

  // loadGroupMore returns void; allow its actual resolved-API .then callback to dispatch.
  await Promise.resolve();
  await Promise.resolve();

  const success = actions.find(action => action.type === 'WORKSHEET_SHEETVIEW_CHANGE_GROUP_FETCH_PARAMS');
  assert.deepEqual(success, {
    type: 'WORKSHEET_SHEETVIEW_CHANGE_GROUP_FETCH_PARAMS',
    groupKey,
    changes: { pageIndex: expectedPageIndex },
  });
  const updatedRows = actions.filter(action => action.type === 'WORKSHEET_SHEETVIEW_FETCH_ROWS').at(-1)?.rows;
  assert.deepEqual(
    updatedRows?.map(row => row.rowid),
    ['groupTitle', 'existing-record', 'new-record'],
  );
  assert.equal(updatedRows?.find(row => row.rowid === 'new-record')?.groupKey, groupKey);
  assert.equal(rows[2]?.isLoading, undefined, 'Request loading state must not mutate the source row');
}

async function run(): Promise<void> {
  await checkGroupPaging('g.child', { 'g.child': { pageIndex: 4 } }, 5);
  await checkGroupPaging('g', { g: { pageIndex: 2 }, 'g.pageIndex': { pageIndex: 8 } }, 3);
  await checkGroupPaging('g.pageIndex', { g: { pageIndex: 2 }, 'g.pageIndex': { pageIndex: 8 } }, 9);
  await checkGroupPaging('missing.group', { 'missing.group.pageIndex': { pageIndex: 8 } }, 2);
  await checkGroupPaging('g', { g: { pageIndex: undefined } }, 2);
  await checkGroupPaging('g', { g: { pageIndex: 0 } }, 1);
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
