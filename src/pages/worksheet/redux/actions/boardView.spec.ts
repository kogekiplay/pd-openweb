const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

interface TestGroup {
  key: string;
  rows: string[];
  totalNum: number;
  name?: string;
  type?: number;
  sort?: number;
}
interface TestRequest {
  type: string;
  worksheetId: string;
  viewId: string;
  pageIndex?: number;
  kanbanKey?: string;
  kanbanIndex?: number;
  pageSize?: number;
  kanbanSize?: number;
  fastFilters?: unknown[];
}
interface TestAction {
  type: string;
  data?: unknown;
  payload?: unknown;
  loading?: boolean;
  resultCode?: number;
}
interface TestView {
  worksheetId: string;
  viewId: string;
  viewControl: string;
  advancedSetting?: { clicksearch?: string };
  fastFilters?: unknown[];
}
interface TestState {
  sheet: {
    base: { appId: string; worksheetId: string; viewId: string; type: string };
    views: TestView[];
    controls: { controlId: string; type: number; options: { key: string; value: string }[] }[];
    quickFilter: unknown[];
    filters: { filterControls: unknown[] };
    navGroupFilters: unknown[];
    boardView: {
      boardData: TestGroup[];
      boardViewState: { hasMoreData: boolean; kanbanIndex: number };
      boardViewRecordCount?: Record<string, number>;
    };
  };
}
type Dispatch = (action: TestAction) => void;
interface BoardActions {
  getSingleBoardPageData(data: {
    kanbanKey: string;
    pageIndex: number;
    alwaysCallback: () => void;
    checkIsMore: (isMore: boolean) => void;
  }): (dispatch: Dispatch, getState: () => TestState) => void;
  getBoardViewPageData(data: { alwaysCallback: () => void }): (dispatch: Dispatch, getState: () => TestState) => void;
  initBoardViewData(view?: TestView): (dispatch: Dispatch, getState: () => TestState) => void;
}
function loadTarget(file: string, stubs: Record<string, unknown> = {}): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.isAbsolute(file) ? file : path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'safeParse', code)(
    moduleLike,
    moduleLike.exports,
    (request: string) => (Object.hasOwn(stubs, request) ? stubs[request] : require(request)),
    (value: string | undefined): unknown => {
      try {
        return JSON.parse(value || '[]');
      } catch {
        return [];
      }
    },
  );
  return moduleLike.exports;
}
const requests: TestRequest[] = [];
let aborts = 0;
let apiResponse: { data?: TestGroup[]; resultCode: number } = { data: [], resultCode: 1 };
const worksheetApi = {
  getFilterRows(args: TestRequest) {
    requests.push(args);
    return Object.assign(Promise.resolve(apiResponse), {
      abort: () => {
        aborts += 1;
      },
    });
  },
};
const view = { viewId: 'view-1', worksheetId: 'sheet-1', viewControl: 'category' };
const group = (key: string, rows: string[], totalNum = rows.length): TestGroup => ({
  key,
  rows,
  totalNum,
  type: 9,
  name: key,
});
const row = (rowid: string): string => JSON.stringify({ rowid });
const existingGroups = [group('constructor', [row('r1')], 3), group('first', [row('r2')])];
const state: TestState = {
  sheet: {
    base: { appId: 'app-1', worksheetId: 'sheet-1', viewId: 'view-1', type: 'single' },
    views: [view],
    controls: [{ controlId: 'category', type: 9, options: [{ key: 'first', value: 'First option' }] }],
    quickFilter: [],
    filters: { filterControls: [] },
    navGroupFilters: [],
    boardView: {
      boardData: existingGroups,
      boardViewState: { hasMoreData: true, kanbanIndex: 1 },
      boardViewRecordCount: { constructor: 3, first: 1 },
    },
  },
};
const actualUtil = loadTarget('./util.ts', { 'src/pages/worksheet/constants/enum': {} });
const reduxUtil = loadTarget('../util.ts');
const apiBoundary = loadTarget('../reducers/boardViewApi.ts');
const actions = loadTarget(process.env.BOARD_ACTION_SOURCE || './boardView.ts', {
  'src/api/worksheet': { __esModule: true, default: worksheetApi },
  'worksheet/common/Sheet/QuickFilter/utils': {
    handleConditionsDefault: (conditions: unknown[]) => conditions,
    validate: () => false,
    formatFilterValues: (_type: number, values: unknown[]) => values,
    formatFilterValuesToServer: (_type: number, values: unknown[]) => values,
  },
  'src/utils/app': { getTranslateInfo: () => ({}) },
  'src/utils/common': { getFilledRequestParams: (args: TestRequest) => args },
  'src/utils/filter': { formatQuickFilter: (filters: unknown[]) => filters },
  '../util': reduxUtil,
  '../reducers/boardViewApi': apiBoundary,
  './navFilter.js': {},
  './util': actualUtil,
}) as BoardActions;
global.window = { shareState: {} };
const waitForApi = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

async function run(): Promise<void> {
  const received: TestAction[] = [];
  let callbacks = 0;
  let isMore: boolean | undefined;
  apiResponse = { data: [group('constructor', [row('r1'), row('r3')], 3)], resultCode: 1 };
  actions.getSingleBoardPageData({
    kanbanKey: 'constructor',
    pageIndex: 2,
    alwaysCallback: () => {
      callbacks += 1;
    },
    checkIsMore: value => {
      isMore = value;
    },
  })(
    action => {
      received.push(action);
    },
    () => state,
  );
  assert.equal(requests.at(-1)?.kanbanKey, 'constructor');
  assert.equal(requests.at(-1)?.pageIndex, 2);
  assert.equal(requests.at(-1)?.pageSize, 20);
  await waitForApi();
  const updated = received.find(action => action.type === 'CHANGE_BOARD_VIEW_DATA')?.data as TestGroup[];
  assert.deepEqual(
    updated[0]?.rows.map(value => JSON.parse(value).rowid),
    ['r1', 'r3'],
    'Paging must retain prior rows and deduplicate by rowid',
  );
  assert.equal(updated[1], existingGroups[1], 'Paging only replaces the requested group');
  assert.equal(isMore, false);
  assert.equal(callbacks, 1);
  assert.deepEqual(existingGroups[0]?.rows, [row('r1')]);

  received.length = 0;
  apiResponse = { resultCode: 1 };
  actions.getSingleBoardPageData({
    kanbanKey: 'constructor',
    pageIndex: 3,
    alwaysCallback: () => {
      callbacks += 1;
    },
    checkIsMore: value => {
      isMore = value;
    },
  })(
    action => {
      received.push(action);
    },
    () => state,
  );
  await waitForApi();
  assert.deepEqual(
    (received.find(action => action.type === 'CHANGE_BOARD_VIEW_DATA')?.data as TestGroup[])[0]?.rows,
    existingGroups[0]?.rows,
    'An empty page must not append an undefined row',
  );
  assert.equal(callbacks, 2);

  received.length = 0;
  actions.getSingleBoardPageData({
    kanbanKey: 'removed-group',
    pageIndex: 2,
    alwaysCallback: () => {
      callbacks += 1;
    },
    checkIsMore: value => {
      isMore = value;
    },
  })(
    action => {
      received.push(action);
    },
    () => state,
  );
  await waitForApi();
  assert.equal(
    received.some(action => action.type === 'CHANGE_BOARD_VIEW_DATA'),
    false,
    'A removed group must not write to array index -1',
  );
  assert.equal(callbacks, 3);

  received.length = 0;
  apiResponse = { data: [group('constructor', [row('duplicate')]), group('second', [row('r4')])], resultCode: 1 };
  actions.getBoardViewPageData({
    alwaysCallback: () => {
      callbacks += 1;
    },
  })(
    action => {
      received.push(action);
    },
    () => state,
  );
  await waitForApi();
  assert.equal(requests.at(-1)?.kanbanIndex, 2);
  const groupPage = received.find(action => action.type === 'CHANGE_BOARD_VIEW_DATA')?.data as TestGroup[];
  assert.deepEqual(
    groupPage.map(value => value.key),
    ['constructor', 'first', 'second'],
  );
  assert.equal(groupPage[2]?.sort, 3);
  assert.deepEqual(received.find(action => action.type === 'CHANGE_BOARD_VIEW_STATE')?.payload, {
    kanbanIndex: 2,
    hasMoreData: false,
  });
  assert.equal(callbacks, 4);

  received.length = 0;
  apiResponse = { data: [group('first', [row('r5')])], resultCode: 1 };
  const abortsBefore = aborts;
  actions.initBoardViewData(view)(
    action => {
      received.push(action);
    },
    () => state,
  );
  actions.initBoardViewData(view)(
    action => {
      received.push(action);
    },
    () => state,
  );
  assert.equal(aborts, abortsBefore + 1, 'A superseded single-view request must be aborted');
  await waitForApi();
  const translated = received.find(action => action.type === 'CHANGE_BOARD_VIEW_DATA')?.data as TestGroup[];
  assert.equal(translated[0]?.name, 'First option');
  assert.deepEqual(
    received.filter(action => action.type === 'CHANGE_BOARD_VIEW_LOADING').map(action => action.loading),
    [true, true, false, false],
  );

  received.length = 0;
  apiResponse = { resultCode: 7 };
  actions.initBoardViewData(view)(
    action => {
      received.push(action);
    },
    () => state,
  );
  await waitForApi();
  assert.equal(received.find(action => action.type === 'WORKSHEET_UPDATE_ACTIVE_VIEW_STATUS')?.resultCode, 7);
  assert.deepEqual(received.find(action => action.type === 'CHANGE_BOARD_VIEW_DATA')?.data, []);
  console.log(
    'Board real action paging, deduplication, absent data/groups, request cancellation and option labels passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
