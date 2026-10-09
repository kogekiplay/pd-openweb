const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
interface Row {
  rowid: string;
  [column: string]: unknown;
}
interface Action {
  type: string;
  [payload: string]: unknown;
}
interface TableState {
  pageIndex: number;
  pageSize: number;
  keywords?: string;
  error?: string;
  tableLoading?: boolean;
  filterControls?: unknown[];
  sortControl?: { controlId: string; isAsc: boolean };
}
interface State {
  initialized: boolean;
  loading: boolean;
  records: Row[];
  tableState: TableState;
  changes: { addedRecordIds: string[]; deletedRecordIds: string[]; addedRecords: Row[] };
}
interface Store {
  init(): Promise<void>;
  getState(): State;
  dispatch(action: Action | ((dispatch: Store['dispatch'], getState: Store['getState']) => unknown)): unknown;
}
interface ModuleExports {
  default?: unknown;
  [exported: string]: unknown;
}
const worksheet = {
  worksheetId: 'related-sheet',
  resultCode: 1,
  template: { controls: [] },
  advancedSetting: {},
};
const original = { rowid: 'original', payload: { rowid: 5 } };
let rowResponse: () => Promise<unknown> = () =>
  Promise.resolve({ resultCode: 1, data: [original], count: 1, worksheet });
const requests: Record<string, unknown>[] = [];
const api = {
  getWorksheetInfo: () => Promise.resolve(worksheet),
  getQueryBySheetId: () => Promise.resolve([]),
  getSwitchPermit: () => Promise.resolve([]),
  getRowRelationRows: (request: Record<string, unknown>) => {
    requests.push(request);
    return rowResponse();
  },
};
const modules = new Map<string, ModuleExports>();
let renderer: ((props: unknown) => unknown) | undefined;
const effects: Array<() => (() => void) | void> = [];
function load(relative: string): ModuleExports {
  const file = path.resolve(root, relative);
  const existing = modules.get(file);
  if (existing) return existing;
  const target: { exports: ModuleExports } = { exports: {} };
  modules.set(file, target.exports);
  const dependency = (name: string): unknown => {
    if (['lodash', 'redux', '@reduxjs/toolkit', 'uuid', 'classnames', 'prop-types', 'react/jsx-runtime'].includes(name))
      return require(name);
    if (name === 'react')
      return {
        useContext: () => ({}),
        useEffect: (effect: () => (() => void) | void) => effects.push(effect),
        useMemo: (create: () => unknown) => create(),
        useRef: (current: unknown) => ({ current }),
        useState: (value: unknown) => [value, () => {}],
      };
    if (name === 'react-redux')
      return {
        Provider: () => null,
        connect: () => (component: (props: unknown) => unknown) => {
          renderer = component;
          return component;
        },
      };
    if (name === 'styled-components') return { div: () => () => null };
    if (name === 'worksheet/common/recordInfo/RecordForm') return { RecordFormContext: {} };
    if (name === 'src/api/worksheet') return api;
    if (name === 'src/utils/subListStoreTypes') return load('src/utils/subListStoreTypes.ts');
    if (name === 'src/utils/fieldStoreBoundary') return load('src/utils/fieldStoreBoundary.ts');
    if (name === 'src/utils/recordValueBoundary') return load('src/utils/recordValueBoundary.ts');
    if (name === 'worksheet/common/TreeTableHelper' || name === 'worksheet/common/TreeTableHelper/index.js')
      return load('src/pages/worksheet/common/TreeTableHelper/index.ts');
    if (name === 'src/utils/control')
      return {
        isRelateRecordTableControl: () => false,
        controlState: () => ({ visible: true, editable: true }),
        replaceByIndex: (value: string) => value,
      };
    if (name === 'src/utils/common')
      return { browserIsMobile: () => false, getFilledRequestParams: (value: unknown) => value };
    if (name === 'src/utils/app') return { getTranslateInfo: () => ({}) };
    if (name === 'src/utils/translate')
      return {
        replaceAdvancedSettingTranslateInfo: (_app: unknown, _sheet: unknown, value: unknown) => value,
        replaceControlsTranslateInfo: (_app: unknown, _sheet: unknown, value: unknown) => value,
      };
    if (name === 'src/pages/widgetConfig/util') return { formatSearchConfigs: (value: unknown) => value };
    if (name === 'src/pages/widgetConfig/config/widget') return { SYSTEM_CONTROL: [], WIDGETS_TO_API_TYPE_ENUM: {} };
    if (name === 'worksheet/constants/enum')
      return { RECORD_INFO_FROM: { DRAFT: 21 }, RELATE_RECORD_SHOW_TYPE: { LIST: 2, TABLE: 5, TAB_TABLE: 6 } };
    if (name === 'src/components/Form/core/formUtils/valueBoundary')
      return {
        runtimeValue: (value: unknown) => value,
        parsedRecords: (value: unknown) => (Array.isArray(value) ? value : []),
      };
    if (name === './RelateRecordTable') return () => null;
    if (name.startsWith('.')) {
      const candidate = path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts'));
      return load(path.relative(root, candidate.endsWith('.ts') ? candidate : candidate + '.ts'));
    }
    if (
      [
        'worksheet/api/standard',
        'worksheet/common/BatchEditRecord',
        'worksheet/common/newRecord/addRecord',
        'src/pages/worksheet/common/recordInfo/crtl',
        'src/pages/worksheet/common/WorkSheetFilter/util',
        'src/components/Form/core/DataFormat',
        'src/utils/record',
      ].includes(name)
    )
      return {};
    throw new Error('Unstubbed relation dependency: ' + name);
  };
  new Function(
    'module',
    'exports',
    'require',
    'window',
    'localStorage',
    'safeParse',
    '_l',
    'alert',
    transformFileSync(file).code,
  )(
    target,
    target.exports,
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
    (text: string) => text,
    () => {},
  );
  return target.exports;
}
function button(value: unknown): { disabled: boolean; click(): void } {
  if (!value || typeof value !== 'object' || !('props' in value)) throw new Error('Expected relation error');
  const props: unknown = value.props;
  if (!props || typeof props !== 'object' || !('children' in props) || !Array.isArray(props.children))
    throw new Error('Expected error content');
  for (const child of props.children) {
    if (!child || typeof child !== 'object' || !('type' in child) || child.type !== 'button' || !('props' in child))
      continue;
    const childProps: unknown = child.props;
    if (
      !childProps ||
      typeof childProps !== 'object' ||
      !('onClick' in childProps) ||
      typeof childProps.onClick !== 'function'
    )
      throw new Error('Missing retry callback');
    const callback = childProps.onClick;
    return { disabled: 'disabled' in childProps && childProps.disabled === true, click: () => callback() };
  }
  throw new Error('Missing retry button');
}
async function run() {
  const factory = load('src/pages/worksheet/components/RelateRecordTable/redux/store.ts').default as (
    control: unknown,
    options: unknown,
  ) => Store;
  const wrapper = load('src/pages/worksheet/components/RelateRecordTable/index.tsx').default as (
    props: unknown,
  ) => unknown;
  const loadRecords = load('src/pages/worksheet/components/RelateRecordTable/redux/action.ts')['loadRecords'] as () => (
    dispatch: Store['dispatch'],
    getState: Store['getState'],
  ) => Promise<void>;
  const control = { controlId: 'relation', dataSource: 'related-sheet', type: 29, advancedSetting: { showtype: '6' } };
  const store = factory(control, { worksheetId: 'master-sheet', recordId: 'master-record', pageSize: 20 });
  await store.init();
  assert.equal(store.getState().initialized, true);
  store.dispatch({
    type: 'APPEND_RECORDS',
    records: [{ rowid: 'pending-add' }],
    recordId: 'master-record',
    saveSync: false,
  });
  store.dispatch({
    type: 'UPDATE_TABLE_STATE',
    value: {
      pageIndex: 3,
      pageSize: 20,
      keywords: 'search words',
      filterControls: [{ controlId: 'field', filterType: 2 }],
      sortControl: { controlId: 'sort-field', isAsc: false },
    },
  });
  const before = store.getState();
  rowResponse = () => Promise.reject(new Error('refresh failed'));
  await store.dispatch(loadRecords());
  assert.equal(store.getState().tableState.error, 'refresh failed');
  assert.equal(store.getState().records, before.records);
  assert.equal(store.getState().changes, before.changes);
  wrapper({ control: { ...control, store }, recordId: 'master-record', worksheetId: 'master-sheet' });
  if (!renderer) throw new Error('Missing actual wrapper renderer');
  const errorUi = () => {
    const state = store.getState();
    return renderer?.({
      store,
      tableProps: { control },
      loading: state.loading || !!state.tableState.tableLoading,
      error: state.tableState.error,
    });
  };
  let release!: (value: unknown) => void;
  rowResponse = () =>
    new Promise(resolve => {
      release = resolve;
    });
  const beforeRetryCount = requests.length;
  const retryButton = button(errorUi());
  assert.equal(retryButton.disabled, false);
  retryButton.click();
  assert.equal(requests.length, beforeRetryCount + 1, 'initialized-table retry issues a real row API request');
  assert.equal(store.getState().tableState.tableLoading, true);
  assert.equal(store.getState().records, before.records, 'pending retry retains previously loaded rows');
  assert.equal(store.getState().changes, before.changes);
  const request = requests.at(-1);
  assert.equal(request?.['worksheetId'], 'master-sheet');
  assert.equal(request?.['rowId'], 'master-record');
  assert.equal(request?.['controlId'], 'relation');
  assert.equal(request?.['pageIndex'], 3);
  assert.equal(request?.['pageSize'], 20);
  assert.equal(request?.['keywords'], 'search words');
  assert.deepEqual(request?.['filterControls'], before.tableState.filterControls);
  assert.equal(request?.['sortId'], 'sort-field');
  assert.equal(request?.['isAsc'], false);
  release({ resultCode: 1, data: [original], count: 1 });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(store.getState().tableState.error, undefined);
  assert.equal(store.getState().tableState.tableLoading, false);
  assert.deepEqual(store.getState().records, before.records);
  assert.equal(store.getState().changes, before.changes, 'successful retry does not reset unsaved changes');
  assert.equal(store.getState().tableState.pageIndex, 3);
  assert.equal(store.getState().tableState.keywords, 'search words');
  rowResponse = () => Promise.reject(new Error('first page failed'));
  const initialFailure = factory(control, { worksheetId: 'master-sheet', recordId: 'master-record' });
  await initialFailure.init();
  assert.equal(initialFailure.getState().initialized, false);
  const failedInitialContent = renderer({
    store: initialFailure,
    tableProps: { control },
    loading: initialFailure.getState().loading,
    error: initialFailure.getState().tableState.error,
  });
  const initialRetryCount = requests.length;
  rowResponse = () => Promise.resolve({ resultCode: 1, data: [original], count: 1, worksheet });
  button(failedInitialContent).click();
  await initialFailure.init();
  assert.equal(requests.length, initialRetryCount + 1, 'uninitialized-table retry still shares the real init request');
  assert.equal(initialFailure.getState().initialized, true);
  assert.equal(initialFailure.getState().tableState.error, undefined);
  console.log('Actual relation wrapper/factory failed refresh retries current query and preserves records and changes');
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
