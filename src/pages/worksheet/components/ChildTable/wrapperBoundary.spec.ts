const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const React = require('react');
const root = path.resolve(__dirname, '../../../../..');
global._l = (text: string) => text;
const reportedFailures: unknown[] = [];
function load(file: string, imports: Record<string, unknown>) {
  const target: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', 'console', transformFileSync(file).code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed wrapper import: ' + name);
    },
    { error: (error: unknown) => reportedFailures.push(error) },
  );
  return target.exports;
}
const storeTypes = load(path.join(root, 'src/utils/subListStoreTypes.ts'), {});
const objectBoundary = load(path.join(root, 'src/utils/recordValueBoundary.ts'), {});
const publicTypes = load(path.join(__dirname, 'publicTypes.ts'), {});
interface FixtureElement {
  type: unknown;
  props: Record<string, unknown>;
}
function fixtureObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function fixtureElement(value: unknown): FixtureElement {
  if (!fixtureObject(value) || !fixtureObject(value['props'])) throw new Error('Expected a rendered element');
  return { type: value['type'], props: value['props'] };
}
function retryButton(element: FixtureElement) {
  const children = element.props['children'];
  if (!Array.isArray(children)) throw new Error('Expected error content');
  for (const child of children) {
    if (!fixtureObject(child) || child['type'] !== 'button') continue;
    const button = fixtureElement(child);
    const callback = button.props['onClick'];
    if (typeof callback !== 'function') throw new Error('Missing retry handler');
    return { disabled: button.props['disabled'] === true, click: () => callback() };
  }
  throw new Error('Missing retry button');
}
interface Row {
  rowid?: string;
  [fieldId: string]: unknown;
}
interface ChildState {
  rows: Row[];
  originRows: Row[];
  lastAction: { type: string };
  baseLoading: boolean;
  dataLoading: boolean;
  base: Record<string, unknown>;
}
function childStore() {
  const listeners = new Set<() => void>();
  const state: ChildState = {
    rows: [{ rowid: 'current', cell: 0 }],
    originRows: [{ rowid: 'original' }],
    lastAction: { type: 'INIT' },
    baseLoading: false,
    dataLoading: false,
    base: {},
  };
  const store = {
    name: 34,
    state,
    getState: () => state,
    listeners,
    waitListForLoadRows: [] as Array<() => void>,
    initCount: 0,
    init() {
      store.initCount++;
      return Promise.resolve();
    },
    initAndLoadRows: (_options?: { worksheetId?: string; recordId?: string; controlId?: string }) => Promise.resolve(),
    ref: undefined as unknown,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(type: string) {
      state.lastAction = { type };
      [...listeners].forEach(listener => listener());
    },
  };
  return store;
}
interface Wrapper {
  props: {
    control: { store: ReturnType<typeof childStore>; value?: unknown };
    flag?: unknown;
    from?: number;
    recordId?: string;
    masterData?: { worksheetId?: string };
  };
  store: ReturnType<typeof childStore>;
  state: { retrying: boolean };
  setState(next: Partial<Wrapper['state']>): void;
  componentDidUpdate(previous: Wrapper['props']): void;
  componentWillUnmount(): void;
  render(): {
    props: {
      children: { type: (props: unknown) => unknown; props: { registerCell(ref: unknown): void } };
    };
  };
}
const failureChecks: Array<() => void> = [];
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);
process.on('unhandledRejection', onUnhandled);
for (const mobile of [false, true]) {
  const updates: unknown[][] = [],
    registrations: unknown[] = [],
    loading: unknown[][] = [],
    selectors: Array<(state: ChildState) => unknown> = [];
  const initial = childStore();
  const fixtureValue = { updated: ['before'] };
  const props = {
    control: {
      controlId: 'sub-control',
      store: initial,
      value: fixtureValue,
      setLoadingInfo: (...args: unknown[]) => loading.push(args),
    },
    onChange: (...args: unknown[]) => updates.push(args),
    registerCell: (ref: unknown) => registrations.push(ref),
    from: 21,
    flag: 'first',
  };
  const file = mobile
    ? 'src/components/Form/MobileForm/components/ChildTable/index.tsx'
    : 'src/pages/worksheet/components/ChildTable/index.tsx';
  const Component = load(path.join(root, file), {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-redux': {
      shallowEqual: require('react-redux').shallowEqual,
      Provider: () => null,
      connect: (select: (state: ChildState) => unknown) => {
        selectors.push(select);
        return (component: unknown) => component;
      },
    },
    lodash,
    'src/components/Form/core/DataFormat': class {},
    'src/utils/subListStoreTypes': storeTypes,
    './ChildTable': () => null,
    './redux/store': () => initial,
    'src/pages/worksheet/components/ChildTable/redux/store': () => initial,
    './style.less': {},
    './publicTypes': publicTypes,
    'src/pages/worksheet/components/ChildTable/publicTypes': publicTypes,
  }).default as new (value: unknown) => Wrapper;
  const wrapper = new Component(props);
  wrapper.setState = next => {
    wrapper.state = { ...wrapper.state, ...next };
  };
  assert.equal(wrapper.store, initial);
  assert.equal(initial.initCount, 1);
  assert.deepEqual(selectors[0]?.(initial.state), {
    baseLoading: false,
    base: initial.state.base,
    rows: initial.state.rows,
    lastAction: initial.state.lastAction,
  });
  let drained = 0;
  initial.waitListForLoadRows.push(
    () => drained++,
    () => drained++,
  );
  initial.emit('LOAD_ROWS_COMPLETE');
  assert.equal(drained, 2);
  assert.deepEqual(initial.waitListForLoadRows, []);
  initial.emit('SET_REAL_COUNT');
  assert.equal(updates.length, 0, 'load completion and internal count never mark the form dirty');
  initial.emit('UPDATE_ROW');
  const ordinary = updates.pop();
  assert.deepEqual(ordinary?.[0], {
    rows: initial.state.rows,
    lastAction: initial.state.lastAction,
    originRows: initial.state.originRows,
  });
  assert.equal(ordinary?.length, mobile ? 2 : 1);
  if (mobile) assert.equal(ordinary?.[1], fixtureValue);
  const cell = { props: { store: initial }, handleAddRowByLine() {} };
  wrapper.render().props.children.props.registerCell(cell);
  assert.equal(registrations.pop(), cell);
  assert.equal(initial.ref, cell);
  const next = childStore();
  const previous = wrapper.props;
  wrapper.props = { ...previous, control: { ...previous.control, store: next } };
  wrapper.componentDidUpdate(previous);
  assert.equal(next.initCount, 1);
  assert.equal(initial.listeners.size, 0, 'store replacement removes the previous subscription');
  assert.equal(next.listeners.size, 1);
  initial.emit('UPDATE_ROW');
  assert.equal(updates.length, 0);
  next.emit('UPDATE_ROW');
  assert.equal(updates.length, 1);
  if (mobile) {
    const beforeFlag = wrapper.props;
    wrapper.props = { ...beforeFlag, flag: 'second' };
    wrapper.componentDidUpdate(beforeFlag);
    assert.equal(updates.length, 2, 'mobile draft flag still reports existing child rows');
  }
  wrapper.componentWillUnmount();
  assert.equal(next.listeners.size, 0);
  assert.deepEqual(loading, mobile ? [] : [['loadRows_sub-control', false]]);
  const afterUnmount = updates.length;
  next.emit('UPDATE_ROW');
  assert.equal(updates.length, afterUnmount);
  assert.throws(
    () => new Component({ ...props, control: { store: { version: 'relation-store' } } }),
    /child table store/,
  );
  const failingStore = childStore();
  const failure = new Error((mobile ? 'Mobile' : 'Desktop') + ' child initialization failed');
  failingStore.init = () => Promise.reject(failure);
  const failureUpdates: unknown[] = [];
  const failedWrapper = new Component({
    ...props,
    control: { ...props.control, store: failingStore },
    onChange: (...args: unknown[]) => failureUpdates.push(args),
  });
  failureChecks.push(() => {
    assert.equal(reportedFailures.includes(failure), true, 'background initialization failure is reported');
    assert.equal(failureUpdates.length, 0, 'failed initialization never fabricates form changes');
    failedWrapper.componentWillUnmount();
    assert.equal(failingStore.listeners.size, 0);
  });
  const retryStore = childStore();
  retryStore.state.base['rowLoadError'] = 'failed rows';
  const retryWrapper = new Component({
    ...props,
    control: { ...props.control, store: retryStore },
    recordId: 'master-record',
    masterData: { worksheetId: 'master-sheet' },
  });
  retryWrapper.setState = next => {
    retryWrapper.state = { ...retryWrapper.state, ...next };
  };
  const renderContent = () => {
    const child = retryWrapper.render().props.children;
    const mapped = selectors[0]?.(retryStore.state);
    if (!fixtureObject(mapped)) throw new Error('Missing selected state');
    return fixtureElement(child.type({ ...child.props, ...mapped }));
  };
  const errorContent = renderContent();
  assert.equal(errorContent.props['role'], 'alert');
  assert.equal(retryButton(errorContent).disabled, false);
  const retryRequests: unknown[] = [];
  let released = 0;
  retryStore.waitListForLoadRows.push(() => released++);
  retryStore.initAndLoadRows = options => {
    retryRequests.push(options);
    retryStore.state.base['rowLoadError'] = undefined;
    retryStore.state.dataLoading = true;
    retryStore.emit('UPDATE_DATA_LOADING');
    return Promise.resolve();
  };
  retryButton(errorContent).click();
  assert.deepEqual(retryRequests, [
    { worksheetId: 'master-sheet', recordId: 'master-record', controlId: 'sub-control' },
  ]);
  assert.equal(retryWrapper.state.retrying, true);
  assert.equal(renderContent().type, 'div', 'retry waits in placeholder instead of mounting an unloaded table');
  assert.equal(released, 0, 'promise start is not load completion');
  retryStore.state.base['rowLoadError'] = 'still failed';
  retryStore.state.dataLoading = false;
  retryStore.emit('UPDATE_BASE');
  assert.equal(retryWrapper.state.retrying, false);
  assert.equal(renderContent().props['role'], 'alert');
  assert.equal(released, 0, 'failed rows retain the waiting queue');
  retryButton(renderContent()).click();
  failureChecks.push(() => {
    assert.equal(retryWrapper.state.retrying, true, 'resolved start promise still waits for real row completion');
    assert.equal(released, 0);
    retryStore.state.dataLoading = false;
    retryStore.emit('LOAD_ROWS_COMPLETE');
    assert.equal(released, 1);
    assert.equal(retryWrapper.state.retrying, false);
    assert.notEqual(renderContent().type, 'div', 'successful retry restores the actual table');
    retryWrapper.componentWillUnmount();
  });
}

const countUpdates: unknown[][] = [];
const relationListeners = new Set<() => void>();
const initialChanges = { addedRecordIds: [], deletedRecordIds: [], addedRecords: [] };
const relationState = {
  initialized: true,
  loading: false,
  lastAction: { type: 'INIT' },
  base: { saveSync: false, isTab: false },
  tableState: {
    keywords: '',
    count: 3,
    countForShow: undefined as number | undefined,
    error: undefined as string | undefined,
  },
  changes: { ...initialChanges },
};
const relationStore = {
  version: 'relation-store',
  getState: () => relationState,
  subscribe: (listener: () => void) => {
    relationListeners.add(listener);
    return () => {
      relationListeners.delete(listener);
    };
  },
  init: () => Promise.resolve(),
  dispatch() {},
};
const effects: Array<() => (() => void) | void> = [];
let relationContent: ((props: unknown) => unknown) | undefined;
const Component = load(path.join(root, 'src/pages/worksheet/components/RelateRecordTable/index.tsx'), {
  react: {
    useContext: () => ({ recordbase: { instanceId: 'instance', workId: 'work' } }),
    useEffect: (effect: () => (() => void) | void) => effects.push(effect),
    useMemo: (create: () => unknown) => create(),
    useRef: (current: unknown) => ({ current }),
    useState: (value: unknown) => [value, () => {}],
  },
  'react/jsx-runtime': require('react/jsx-runtime'),
  'react-redux': {
    Provider: () => null,
    connect: () => (component: (props: unknown) => unknown) => {
      relationContent = component;
      return component;
    },
  },
  classnames: require('classnames'),
  lodash,
  'prop-types': require('prop-types'),
  'styled-components': { div: () => () => null },
  'worksheet/common/recordInfo/RecordForm': { RecordFormContext: {} },
  'src/pages/worksheet/common/WorkSheetFilter/util': { getFilter: () => [] },
  'src/utils/recordValueBoundary': objectBoundary,
  'src/utils/subListStoreTypes': storeTypes,
  './redux/action': { updateFilter() {}, updateTableConfigByControl() {} },
  './redux/reducer': { initialChanges },
  './redux/store': () => relationStore,
  './RelateRecordTable': () => null,
}).default as (props: unknown) => unknown;
Component({
  control: { controlId: 'relate-control', type: 29, store: relationStore },
  recordId: 'existing-row',
  onCountChange: (...args: unknown[]) => countUpdates.push(args),
});
const cleanup = effects[0]?.();
assert.equal(relationListeners.size, 1);
const emit = () => [...relationListeners].forEach(listener => listener());
emit();
assert.deepEqual(countUpdates.pop(), [3, false]);
relationState.lastAction = { type: 'UPDATE_BASE' };
relationState.tableState.count = 4;
emit();
assert.equal(countUpdates.length, 0);
relationState.lastAction = { type: 'DELETE_RECORDS' };
relationState.tableState.countForShow = 2;
emit();
assert.deepEqual(countUpdates.pop(), [2, true]);
relationState.tableState.keywords = 'filtered';
relationState.tableState.count = 1;
emit();
assert.equal(countUpdates.length, 0, 'filtered count never overwrites the relation field total');
relationState.tableState.keywords = '';
relationState.tableState.error = 'metadata request failed';
relationState.initialized = false;
emit();
assert.equal(countUpdates.length, 0, 'failed relation loading never reports an empty successful count');
if (!relationContent) throw new Error('Missing relation renderer');
const failedRelation = fixtureElement(
  relationContent({
    store: relationStore,
    tableProps: { control: { controlId: 'relate-control', store: relationStore } },
    loading: false,
    error: relationState.tableState.error,
  }),
);
assert.equal(failedRelation.props['role'], 'alert');
let relationRetries = 0;
relationStore.init = () => {
  relationRetries++;
  return Promise.resolve();
};
retryButton(failedRelation).click();
assert.equal(relationRetries, 1, 'relation retry invokes the real initial-page loading method');
relationState.tableState.error = undefined;
relationState.initialized = false;
emit();
assert.equal(countUpdates.length, 0, 'uninitialized relation data remains unavailable');
assert.equal(typeof cleanup, 'function');
if (typeof cleanup !== 'function') throw new Error('Relation effect must return subscription cleanup');
cleanup();
assert.equal(relationListeners.size, 0, 'unmount cleans up the relation subscription');
emit();
assert.equal(countUpdates.length, 0);
const relationFailure = new Error('Relation initialization failed');
relationStore.init = () => Promise.reject(relationFailure);
assert.equal(effects.at(-1)?.(), undefined, 'background initialization does not return a promise to React');
(async () => {
  const retry = publicTypes.retryChildTableStore as (
    props: { control: { controlId?: string }; recordId?: string; masterData?: { worksheetId?: string } },
    store: unknown,
  ) => Promise<void>;
  const newRecordStore = childStore();
  let rowRequests = 0;
  newRecordStore.initAndLoadRows = () => {
    rowRequests++;
    return Promise.resolve();
  };
  await retry({ control: { controlId: 'child' } }, newRecordStore);
  assert.equal(newRecordStore.initCount, 1);
  assert.equal(rowRequests, 0, 'new-record metadata retries never request rows with a missing record ID');
  await assert.rejects(retry({ control: {}, recordId: 'existing' }, newRecordStore), /request identifiers/);
  assert.equal(rowRequests, 0);
  await new Promise<void>(resolve => setImmediate(resolve));
  process.off('unhandledRejection', onUnhandled);
  failureChecks.forEach(check => check());
  assert.equal(reportedFailures.includes(relationFailure), true);
  assert.deepEqual(unhandled, [], 'lifecycle initialization rejects through a handled failure path');
  console.log('Child/relation wrapper store, ref, loading-drain, count and subscription cleanup tests passed');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
