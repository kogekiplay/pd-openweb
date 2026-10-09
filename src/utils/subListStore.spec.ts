const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../..');
interface Row {
  rowid?: string;
  pid?: string;
  childrenids?: string;
  [key: string]: unknown;
}
interface Action {
  type: string;
  [key: string]: unknown;
}
interface State {
  base: { loaded?: boolean; isTreeTableView?: boolean; [key: string]: unknown };
  baseLoading?: boolean;
  dataLoading?: boolean;
  initialized?: boolean;
  loading?: boolean;
  rows?: Row[];
  originRows?: Row[];
  records?: Row[];
  changes: { addedRecordIds?: string[]; deletedRecordIds?: string[]; addedRecords?: Row[]; isDirty?: boolean };
  lastAction: Action;
  tableState?: { count?: number; pageIndex: number; [key: string]: unknown };
  treeTableViewData: { treeMap: Record<string, unknown>; maxLevel: number };
}
interface Store {
  initialized?: boolean;
  init(options?: { noMountInit?: boolean }): Promise<void>;
  initAndLoadRows(options?: { worksheetId?: string; recordId?: string; controlId?: string }): Promise<void>;
  getState(): State;
  dispatch(action: Action | ((dispatch: Store['dispatch'], getState: Store['getState']) => unknown)): unknown;
  subscribe(callback: () => void): () => void;
  setLoadingInfo?: (key: string, value: boolean) => void;
  waitList: (() => void)[];
  waitListForLoadRows: (() => void)[];
  reset(): void;
  cancelChange(): void;
  setEmpty(options?: { ignoreControlId?: string[] }): void;
}
interface ModuleExports {
  default?: unknown;
  [key: string]: unknown;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
let worksheetResponse: () => Promise<unknown>;
let rowResponse: () => Promise<unknown>;
let worksheetCalls = 0;
let rowCalls = 0;
const worksheet = {
  resultCode: 1,
  worksheetId: 'related',
  appId: 'app',
  projectId: 'project',
  allowAdd: true,
  template: { controls: [{ controlId: 'title', type: 2, attribute: 1 }] },
  rules: [],
  advancedSetting: {},
};
const api = {
  getWorksheetInfo: () => {
    worksheetCalls++;
    return worksheetResponse();
  },
  getWorksheetInfoByWorkItem: () => {
    worksheetCalls++;
    return worksheetResponse();
  },
  getQueryBySheetId: () => Promise.resolve([]),
  getSwitchPermit: () => Promise.resolve([]),
  getRowRelationRows: () => {
    rowCalls++;
    return rowResponse();
  },
};
const loaded = new Map<string, ModuleExports>();
function load(relative: string): ModuleExports {
  const file =
    relative === 'src/pages/worksheet/components/ChildTable/redux/actions.ts' && process.env.CHILD_STORE_ACTION_SOURCE
      ? process.env.CHILD_STORE_ACTION_SOURCE
      : path.resolve(root, relative.replace(/\.js$/, '.ts'));
  const cached = loaded.get(file);
  if (cached) return cached;
  const moduleLike: { exports: ModuleExports } = { exports: {} };
  loaded.set(file, moduleLike.exports);
  const sourceFile =
    relative === 'src/pages/worksheet/components/RelateRecordTable/redux/action.ts' &&
    process.env.RELATE_STORE_ACTION_SOURCE
      ? process.env.RELATE_STORE_ACTION_SOURCE
      : file;
  const { code } = transformFileSync(sourceFile, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const dependency = (name: string): unknown => {
    if (name === 'lodash' || name === 'redux' || name === '@reduxjs/toolkit' || name === 'uuid') return require(name);
    if (name === 'src/api/worksheet' || name === 'src/api/publicWorksheet') return api;
    if (name === 'file-saver') return { saveAs() {} };
    if (name === 'src/utils/subListStoreTypes') return load('src/utils/subListStoreTypes.ts');
    if (name === 'src/utils/fieldStoreBoundary') return load('src/utils/fieldStoreBoundary.ts');
    if (name === 'worksheet/common/TreeTableHelper' || name === 'worksheet/common/TreeTableHelper/index.js')
      return load('src/pages/worksheet/common/TreeTableHelper/index.ts');
    if (name === 'src/utils/control')
      return {
        parseAdvancedSetting: (settings: Record<string, string> = {}) => ({
          uniqueControlIds: [],
          max: settings.max ? Number(settings.max) : undefined,
          treeLayerControlId: settings.layercontrolid,
        }),
        isRelateRecordTableControl: () => false,
        controlState: () => ({ visible: true, editable: true }),
        replaceByIndex: (value: string) => value,
      };
    if (name === 'src/utils/common')
      return { browserIsMobile: () => false, getFilledRequestParams: (value: unknown) => value };
    if (name === 'src/utils/record')
      return {
        filterEmptyChildTableRows: (rows: Row[] = []) => rows.filter(row => !row.rowid?.startsWith('empty')),
        handleUpdateDefsourceOfControl: ({ controls }: { controls: unknown[] }) => controls,
        getSubListUniqueError: () => ({}),
      };
    if (name === 'src/pages/widgetConfig/util') return { formatSearchConfigs: (value: unknown) => value };
    if (name === 'src/pages/widgetConfig/util/setting') return { canAsUniqueWidget: () => false };
    if (name === 'src/pages/widgetConfig/config/widget') return { SYSTEM_CONTROL: [], WIDGETS_TO_API_TYPE_ENUM: {} };
    if (name === 'src/utils/app') return { getTranslateInfo: () => ({}) };
    if (name === 'src/utils/translate')
      return {
        replaceAdvancedSettingTranslateInfo: (_app: unknown, _sheet: unknown, value: unknown) => value,
        replaceControlsTranslateInfo: (_app: unknown, _sheet: unknown, value: unknown) => value,
      };
    if (name === 'worksheet/constants/enum')
      return { RECORD_INFO_FROM: { DRAFT: 21 }, RELATE_RECORD_SHOW_TYPE: { LIST: 2, TABLE: 3, TAB_TABLE: 5 } };
    if (name === 'src/components/Form/core/formUtils/valueBoundary')
      return {
        runtimeValue: (value: unknown) => value,
        parsedRecords: (value: unknown) => {
          const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
          return Array.isArray(parsed) ? parsed : [];
        },
      };
    if (name === 'worksheet/components/ChildTable/redux/actions')
      return load('src/pages/worksheet/components/ChildTable/redux/actions.ts');
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      return load(path.relative(root, target.endsWith('.ts') ? target : target + '.ts'));
    }
    // These UI operations are not used by initialization/reducer/payload tests.
    if (
      [
        'worksheet/api/standard',
        'worksheet/common/BatchEditRecord',
        'worksheet/common/newRecord/addRecord',
        'src/components/Form/core/DataFormat',
        'src/pages/worksheet/common/recordInfo/crtl',
        'src/pages/worksheet/common/WorkSheetFilter/util',
      ].includes(name)
    )
      return {};
    throw new Error(`Unexpected store dependency ${name}`);
  };
  new Function('module', 'exports', 'require', 'window', 'localStorage', 'safeParse', '_l', 'alert', code)(
    moduleLike,
    moduleLike.exports,
    dependency,
    { shareState: {}, getCurrentLangCode: () => 'zh' },
    { getItem: () => null },
    (value: unknown, mode?: string) => {
      if (typeof value !== 'string') return mode === 'array' ? [] : value;
      try {
        return JSON.parse(value);
      } catch {
        return mode === 'array' ? [] : {};
      }
    },
    (value: string) => value,
    () => {},
  );
  return moduleLike.exports;
}
async function run() {
  const child = load('src/pages/worksheet/components/ChildTable/redux/store.ts').default as (
    control: unknown,
    options?: unknown,
  ) => Store;
  const relation = load('src/pages/worksheet/components/RelateRecordTable/redux/store.ts').default as (
    control: unknown,
    options?: unknown,
  ) => Store;
  const kinds = load('src/utils/subListStoreTypes.ts') as {
    isChildTableStore(store: unknown): boolean;
    isRelateRecordTableStore(store: unknown): boolean;
  };
  const parseRows = load('src/utils/fieldStoreBoundary.ts')['storeRows'] as (rows: unknown) => Row[];
  const payload = load('src/pages/worksheet/components/RelateRecordTable/redux/action.ts')[
    'getDefaultRelatedSheetValue'
  ] as (controls: unknown[], id: string) => { name?: unknown; sid: string; sourcevalue: string };
  assert.throws(() => parseRows([{ rowid: 'r', allowedit: 'yes' }]), TypeError);
  assert.throws(() => parseRows([{ rowid: 'r', updatedControlIds: [1] }]), TypeError);
  assert.throws(() => parseRows([{ rowid: 'r', addTime: Infinity }]), TypeError);
  const metadataRow = { rowid: 'r', allowedit: true, json: { rowid: 5 }, attachment: [{ name: 'a' }], extra: 23 };
  assert.equal(parseRows([metadataRow])[0], metadataRow, 'Cells and unknown metadata retain their original identity');
  worksheetResponse = () => Promise.reject(new Error('first failure'));
  const control = { controlId: 'child', dataSource: 'related', type: 34, advancedSetting: {}, value: '0' };
  const failed = child(control);
  const markers: Record<string, boolean> = {};
  failed.setLoadingInfo = (key, value) => {
    markers[key] = value;
  };
  await assert.rejects(failed.init(), /first failure/);
  assert.equal(failed.initialized, false, 'Rejected first initialization remains retryable');
  assert.equal(markers.store_child, false);
  assert.equal(failed.getState().baseLoading, false);
  assert.equal(failed.getState().dataLoading, false);
  assert.equal(failed.getState().base['initializationError'], 'first failure');
  assert.equal(markers.loadRows_child, false);
  worksheetResponse = () => Promise.resolve({ ...worksheet, resultCode: 0 });
  await assert.rejects(failed.init(), /worksheet request failed/);
  assert.equal(failed.initialized, false, 'Failed API result does not become a loaded store');
  const waiting = deferred<unknown>();
  worksheetResponse = () => waiting.promise;
  let initCalls = 0;
  failed.waitList.push(() => {
    initCalls++;
  });
  const first = failed.init();
  const second = failed.init();
  assert.equal(first, second, 'Concurrent callers share the initialization promise');
  assert.equal(markers.store_child, true);
  waiting.resolve(worksheet);
  await first;
  assert.equal(failed.initialized, true);
  assert.equal(failed.getState().base['initializationError'], undefined);
  assert.equal(initCalls, 1);
  assert.deepEqual(failed.waitList, []);
  assert.equal(kinds.isChildTableStore(failed), true);
  assert.equal(kinds.isRelateRecordTableStore(failed), false);
  const rowsPending = deferred<unknown>();
  rowResponse = () => rowsPending.promise;
  let rowComplete = 0;
  failed.waitListForLoadRows.push(() => {
    rowComplete++;
  });
  // The concrete wrapper's subscription drains this public queue on the actual completion event.
  const stop = failed.subscribe(() => {
    if (failed.getState().lastAction.type !== 'LOAD_ROWS_COMPLETE') return;
    failed.waitListForLoadRows.forEach(callback => callback());
    failed.waitListForLoadRows = [];
  });
  await failed.initAndLoadRows({ worksheetId: 'parent', recordId: 'master', controlId: 'child' });
  assert.equal(rowComplete, 0, 'initAndLoadRows resolves after starting the request, before row completion');
  assert.equal(markers.loadRows_child, true);
  assert.equal(failed.getState().base.loaded, false);
  rowsPending.resolve({ resultCode: 1, data: [metadataRow], count: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rowComplete, 1);
  assert.equal(markers.loadRows_child, false);
  assert.equal(failed.getState().base.loaded, true);
  assert.equal(failed.getState().lastAction.type, 'LOAD_ROWS_COMPLETE');
  assert.equal(failed.getState().rows?.[0]?.json, metadataRow.json);
  failed.dispatch({ type: 'UPDATE_FILTER_CONTROLS', filterControls: [{ controlId: 'field', filterType: 2 }] });
  failed.dispatch({ type: 'SET_REAL_COUNT', value: 7 });
  failed.reset();
  assert.equal(failed.getState()['realCount'], 7, 'Reset preserves known unfiltered row count in filtered mode');
  const eventAction = load('src/pages/worksheet/components/ChildTable/redux/actions.ts')['clearAndSetRows'] as (
    rows: Row[],
    options: unknown,
  ) => (dispatch: Store['dispatch'], getState: Store['getState']) => unknown;
  const eventColumn = '123456789012345678901234';
  const originalEventRow = { rowid: 'event-row', updatedControlIds: ['already'], [eventColumn]: 'old' };
  failed.dispatch({ type: 'LOAD_ROWS', rows: [originalEventRow] });
  failed.dispatch({ type: 'INIT_ROWS', rows: [originalEventRow] });
  assert.doesNotThrow(
    () =>
      failed.dispatch(
        eventAction([{ rowid: 'event-row', [eventColumn]: 'new' }], {
          isSetValueFromEvent: true,
          controls: [{ controlId: eventColumn, type: 2 }],
        }),
      ),
    'Event assignment must not mutate RTK rows while collecting changed columns',
  );
  assert.deepEqual(originalEventRow.updatedControlIds, ['already']);
  assert.deepEqual(failed.getState().originRows?.[0]?.['updatedControlIds'], ['already']);
  assert.deepEqual(failed.getState().rows?.[0]?.['updatedControlIds'], ['already', eventColumn]);
  failed.cancelChange();
  assert.equal(
    failed.getState().rows?.[0]?.[eventColumn],
    'old',
    'Cancel restores the original event row without leaked mutation',
  );
  stop();
  rowResponse = () => Promise.reject(new Error('row network failure'));
  await failed.initAndLoadRows({ worksheetId: 'parent', recordId: 'master', controlId: 'child' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(markers.loadRows_child, false, 'Row failure cannot hang the form loading marker');
  assert.equal(failed.getState().dataLoading, false);
  assert.equal(failed.getState().base['rowLoadError'], 'row network failure');
  assert.notEqual(
    failed.getState().lastAction.type,
    'LOAD_ROWS_COMPLETE',
    'Failure cannot drain row-completion writes',
  );
  const pageAction = load('src/pages/worksheet/components/ChildTable/redux/actions.ts')['loadPageRows'] as (
    options: unknown,
  ) => (dispatch: Store['dispatch'], getState: Store['getState']) => unknown;
  const existingAfterCancel = failed.getState().rows;
  let pageCallback: unknown = 'pending';
  failed.dispatch(
    pageAction({
      worksheetId: 'parent',
      recordId: 'master',
      controlId: 'child',
      callback: (value: unknown) => {
        pageCallback = value;
      },
    }),
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pageCallback, null);
  assert.equal(failed.getState().dataLoading, false);
  assert.equal(failed.getState().rows, existingAfterCancel, 'Failed pagination must preserve the prior rows');
  worksheetResponse = () => Promise.resolve(worksheet);
  const relationPending = deferred<unknown>();
  rowResponse = () => relationPending.promise;
  const relateControl = {
    controlId: 'relation',
    dataSource: 'related',
    type: 29,
    advancedSetting: { showtype: '3' },
    relationControls: [],
  };
  const relate = relation(relateControl, { recordId: 'master', worksheetId: 'parent' });
  assert.equal(kinds.isRelateRecordTableStore(relate), true);
  assert.equal(kinds.isChildTableStore(relate), false);
  const beforeCalls = rowCalls;
  const initialRelation = relate.init();
  assert.equal(initialRelation, relate.init());
  assert.equal(rowCalls, beforeCalls + 1, 'Relation concurrent initialization makes one API request');
  const original = { rowid: 'saved', pid: '', childrenids: '[]', allowdelete: true };
  relationPending.resolve({ resultCode: 1, data: [original], count: 1, worksheet });
  await initialRelation;
  assert.equal(relate.getState().initialized, true);
  assert.equal(relate.getState().loading, false);
  relate.dispatch({ type: 'APPEND_RECORDS', records: [{ rowid: 'draft' }], recordId: 'master', saveSync: false });
  assert.deepEqual(relate.getState().changes.addedRecordIds, ['draft']);
  assert.deepEqual(relate.getState().records, [original]);
  relate.dispatch({
    type: 'UPDATE_TREE_TABLE_VIEW_DATA',
    value: { treeMap: { stale: { key: 'stale', childrenIds: ['draft'] } }, maxLevel: 2 },
  });
  relate.cancelChange();
  assert.deepEqual(relate.getState().records, [original]);
  assert.deepEqual(relate.getState().changes.addedRecordIds, []);
  relate.setEmpty({ ignoreControlId: ['relation'] });
  assert.deepEqual(relate.getState().records, [original]);
  relate.setEmpty();
  assert.deepEqual(relate.getState().records, []);
  rowResponse = () => Promise.reject(new Error('relation failure'));
  const retryable = relation(relateControl, { recordId: 'master', worksheetId: 'parent' });
  await retryable.init();
  assert.equal(retryable.getState().initialized, false);
  assert.equal(retryable.getState().loading, false);
  rowResponse = () => Promise.resolve({ resultCode: 1, data: [original], count: 1, worksheet });
  await retryable.init();
  assert.equal(retryable.getState().initialized, true, 'Relation failed first fetch can be retried');
  const relationRows = retryable.getState().records;
  const refreshRows = load('src/pages/worksheet/components/RelateRecordTable/redux/action.ts')['loadRecords'] as () => (
    dispatch: Store['dispatch'],
    getState: Store['getState'],
  ) => Promise<void>;
  retryable.dispatch({
    type: 'APPEND_RECORDS',
    records: [{ rowid: 'network-draft', other: 'keep' }],
    recordId: 'master',
    saveSync: false,
  });
  const networkChanges = retryable.getState().changes;
  rowResponse = () => Promise.reject(new Error('relation page failure'));
  await retryable.dispatch(refreshRows());
  assert.equal(retryable.getState().tableState?.['tableLoading'], false);
  assert.equal(retryable.getState().tableState?.['error'], 'relation page failure');
  assert.equal(retryable.getState().records, relationRows, 'Relation refresh failure keeps its prior records');
  assert.equal(retryable.getState().changes, networkChanges, 'Network failure keeps pending added/deleted records');
  retryable.dispatch({
    type: 'APPEND_RECORDS',
    records: [{ rowid: 'pending-draft', other: 'untouched' }],
    recordId: 'master',
    saveSync: false,
  });
  retryable.dispatch({
    type: 'UPDATE_TABLE_STATE',
    value: {
      pageIndex: 3,
      keywords: 'keep-query',
      filterControls: [{ controlId: 'title', filterType: 2, value: 'keep' }],
      sortControl: { controlId: 'title', isAsc: false },
    },
  });
  const beforeMalformed = retryable.getState();
  const malformedResponse = deferred<unknown>();
  rowResponse = () => malformedResponse.promise;
  const malformedRequest = Promise.resolve(retryable.dispatch(refreshRows()));
  assert.equal(retryable.getState().tableState?.['tableLoading'], true);
  malformedResponse.resolve({ resultCode: 1, count: 1, data: [{ rowid: 42 }] });
  await assert.doesNotReject(
    () => malformedRequest,
    'Malformed successful row responses must reach the terminal error handler',
  );
  const malformedState = retryable.getState();
  assert.equal(malformedState.tableState?.['tableLoading'], false);
  assert.equal(malformedState.tableState?.['error'], 'Invalid field store rows');
  assert.equal(
    malformedState.records,
    beforeMalformed.records,
    'Decoding failure keeps the last successfully loaded records',
  );
  assert.equal(malformedState.changes, beforeMalformed.changes, 'Decoding failure keeps pending added/deleted records');
  assert.equal(malformedState.tableState?.pageIndex, 3);
  assert.equal(malformedState.tableState?.['keywords'], 'keep-query');
  assert.equal(malformedState.tableState?.['filterControls'], beforeMalformed.tableState?.['filterControls']);
  assert.equal(malformedState.tableState?.['sortControl'], beforeMalformed.tableState?.['sortControl']);
  const recoveredRow = { rowid: 'retry-saved', pid: '', childrenids: '[]', allowedit: true, extra: { field: 0 } };
  rowResponse = () => Promise.resolve({ resultCode: 1, count: 1, data: [recoveredRow] });
  await assert.doesNotReject(() => Promise.resolve(retryable.dispatch(refreshRows())));
  const recoveredState = retryable.getState();
  assert.equal(recoveredState.tableState?.['tableLoading'], false);
  assert.equal(recoveredState.tableState?.['error'], undefined);
  assert.deepEqual(recoveredState.records, [recoveredRow]);
  assert.equal(recoveredState.changes, beforeMalformed.changes, 'Successful retry keeps local pending edits');
  assert.equal(recoveredState.tableState?.pageIndex, 3);
  assert.equal(recoveredState.tableState?.['keywords'], 'keep-query');

  const unknownCountStore = relation(relateControl, { recordId: 'master', worksheetId: 'parent' });
  unknownCountStore.cancelChange();
  assert.equal(
    unknownCountStore.getState().tableState?.count,
    undefined,
    'An uninitialized origin result has no known row count',
  );
  unknownCountStore.dispatch({ type: 'APPEND_RECORDS', records: [{ rowid: 'unknown-count-local' }], saveSync: false });
  assert.equal(
    Number.isNaN(unknownCountStore.getState().tableState?.['countForShow']),
    true,
    'Appending to an unknown count preserves NaN rather than inventing zero',
  );
  unknownCountStore.dispatch({ type: 'RESET' });
  unknownCountStore.dispatch({ type: 'DELETE_RECORDS', recordIds: ['one'], saveSync: false });
  assert.equal(
    unknownCountStore.getState().tableState?.['countForShow'],
    -1,
    'RESET has a real numeric zero count and local deletion preserves its arithmetic',
  );
  unknownCountStore.dispatch({ type: 'RESET' });
  unknownCountStore.dispatch({ type: 'UPDATE_TABLE_STATE', value: { count: undefined } });
  unknownCountStore.dispatch({ type: 'APPEND_RECORDS', records: [{ rowid: 'unknown-count-saved' }], saveSync: true });
  assert.equal(
    Number.isNaN(unknownCountStore.getState().tableState?.count),
    true,
    'Synchronous append also preserves an explicitly missing count',
  );
  unknownCountStore.dispatch({ type: 'RESET' });
  unknownCountStore.dispatch({ type: 'UPDATE_TABLE_STATE', value: { count: undefined } });
  unknownCountStore.dispatch({ type: 'DELETE_RECORDS', recordIds: ['unknown-count-saved'], saveSync: true });
  assert.equal(
    Number.isNaN(unknownCountStore.getState().tableState?.count),
    true,
    'Synchronous deletion also preserves an explicitly missing count',
  );
  unknownCountStore.dispatch({ type: 'RESET' });
  unknownCountStore.dispatch({ type: 'UPDATE_TABLE_STATE', value: { count: 5 } });
  unknownCountStore.dispatch({ type: 'APPEND_RECORDS', records: [{ rowid: 'known-count-saved' }], saveSync: true });
  assert.equal(unknownCountStore.getState().tableState?.count, 6);
  unknownCountStore.dispatch({ type: 'DELETE_RECORDS', recordIds: ['known-count-saved'], saveSync: true });
  assert.equal(unknownCountStore.getState().tableState?.count, 5, 'Known count arithmetic is unchanged');

  const title = { controlId: 'title', attribute: 1, type: 2, value: 'Actual title' };
  const result = payload(
    [
      title,
      { controlId: 'other', type: 6, value: 12 },
      { controlId: 'rel', type: 29, value: { records: [{ rowid: 'linked', cells: { extra: 1 } }] } },
    ],
    'master',
  );
  assert.equal(result.name, 'Actual title');
  assert.equal(result.sid, 'master');
  const source = JSON.parse(result.sourcevalue);
  assert.equal(source.title, 'Actual title');
  assert.equal(source.other, 12);
  assert.equal(source.rowid, 'master');
  assert.deepEqual(JSON.parse(source.rel), [
    { sid: 'linked', sourcevalue: JSON.stringify({ rowid: 'linked', cells: { extra: 1 } }) },
  ]);
  assert.deepEqual(JSON.parse(payload([{ controlId: 'other', type: 6, value: 0 }], 'master').sourcevalue), {
    other: 0,
    rowid: 'master',
  });
  assert.ok(worksheetCalls >= 3);
  console.log(
    'Concrete child/relation RTK store protocols, initialization retry, queues, reset and default relation payload passed',
  );
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
