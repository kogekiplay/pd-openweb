import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const moment: typeof import('moment') = require('moment');
const root = path.resolve(__dirname, '../../../../../');
function record(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!record(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}
function call(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture callback');
  return Reflect.apply(fn, value, args);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid fixture array');
  return value;
}
const requests: Array<{
  method: string;
  args: Record<string, unknown>;
  request: Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}> = [];
function request(method: string, args: Record<string, unknown>) {
  let resolve: (value: unknown) => void = () => {},
    reject: (error: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const pending = { method, args, request: promise, resolve, reject };
  requests.push(pending);
  return promise;
}
function latest(method: string) {
  const pending = [...requests].reverse().find(item => item.method === method);
  assert.ok(pending);
  return pending;
}
const alerts: unknown[][] = [],
  clicks: unknown[] = [];
class Element {
  click() {
    clicks.push(this);
  }
}
const timers: Array<() => void> = [];
Object.assign(globalThis, {
  _l: (text: string, ...values: unknown[]) =>
    values.reduce<string>((result, value, index) => result.replace('%' + index, String(value)), text),
  md: { global: { Account: { isPortal: false } } },
  window: {},
  HTMLElement: Element,
  document: { querySelector: () => new Element() },
  alert: (...args: unknown[]) => alerts.push(args),
});
const globalParse = (value: unknown): unknown => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
};
const constants = {
  TEXT: 2,
  TELEPHONE: 3,
  MOBILE_PHONE: 4,
  EMAIL: 5,
  CRED: 7,
  NUMBER: 6,
  MONEY: 8,
  FORMULA_NUMBER: 31,
  SWITCH: 36,
  RELATE_SHEET: 29,
  CASCADER: 35,
  FLAT_MENU: 9,
  MULTI_SELECT: 10,
  DROP_DOWN: 11,
  USER_PICKER: 26,
  DEPARTMENT: 27,
  ORG_ROLE: 48,
  AREA_PROVINCE: 19,
  AREA_CITY: 23,
  AREA_COUNTY: 24,
  DATE: 15,
  DATE_TIME: 16,
  TIME: 46,
  SHEET_FIELD: 30,
  SUBTOTAL: 37,
  SEARCH: 50,
  FORMULA_FUNC: 53,
  RICH_TEXT: 41,
  CONCATENATE: 32,
  AUTO_ID: 33,
};
const cache = new Map<string, unknown>();
function load(relative: string): unknown {
  const filename = harness.resolveSpecTarget(path.resolve(root, relative));
  if (cache.has(filename)) return cache.get(filename);
  const output = harness.transformFileSync(filename);
  if (!output?.code) throw new TypeError('Missing source');
  const module: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', 'safeParse', 'setTimeout', output.code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (['lodash', 'moment', 'immutability-helper'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      if (name === 'src/api/worksheet')
        return {
          __esModule: true,
          default: new Proxy(
            {},
            { get: (_target, key) => (args: Record<string, unknown>) => request(String(key), args) },
          ),
        };
      if (name === 'src/pages/widgetConfig/config/widget')
        return {
          ROW_ID_CONTROL: [{ controlId: 'rowid', type: 2 }],
          SYSTEM_DATE_CONTROL: [{ controlId: 'ctime', type: 16 }],
          WIDGETS_TO_API_TYPE_ENUM: constants,
        };
      if (name === 'src/pages/widgetConfig/util/setting.js')
        return {
          getDatePickerConfigs: (control: { type?: number; advancedSetting?: { showtype?: string } }) => ({
            formatMode: control.type === 15 ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss',
          }),
        };
      if (name === 'src/utils/common') return { browserIsMobile: () => false };
      if (name === 'src/utils/control')
        return {
          renderText: (control: { value: unknown }) => control.value,
          isRelateRecordTableControl: () => false,
          checkCellIsEmpty: (value: unknown) => value === undefined || value === null || value === '',
          getSelectedOptions: (options: unknown[] = [], value: unknown) => {
            const keys = Array.isArray(value) ? value : globalParse(value);
            return options.filter(item => Array.isArray(keys) && keys.includes(read(item, 'key')));
          },
        };
      if (name === 'src/utils/project') return { dateServerZoneToAppZone: (value: unknown) => value };
      if (name === 'src/utils/subListStoreTypes') return { isRelateRecordTableStore: () => false };
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)));
      throw new Error('Unexpected worksheet filter dependency ' + name);
    },
    globalParse,
    (fn: () => void) => {
      timers.push(fn);
      return timers.length;
    },
  );
  cache.set(filename, module.exports);
  return module.exports;
}
const base = 'src/pages/worksheet/common/WorkSheetFilter/';
const util = load(base + 'util.ts'),
  model = load(base + 'model.ts'),
  boundary = load(base + 'filterModelBoundary.ts');
const tick = async () => {
  for (let index = 0; index < 10; index++) await Promise.resolve();
};
async function run() {
  const body = {
    items: [
      {
        controlId: 'member',
        dataType: 26,
        filterType: 2,
        spliceType: 2,
        values: ['{"id":"one","name":"First"}'],
        opaque: { identity: true },
      },
    ],
  };
  const origin = call(util, 'formatOriginFilterValue', [body]);
  assert.equal(read(origin, 'relationType'), 2);
  assert.deepEqual(read(array(read(origin, 'conditions'))[0], 'values'), ['one']);
  assert.equal(read(array(read(origin, 'conditions'))[0], 'fullValues'), body.items[0]?.values);
  const group = call(util, 'formatOriginFilterGroupValue', [JSON.stringify({ ...body, filterId: 'saved' })]);
  assert.equal(read(group, 'id'), 'saved');
  assert.equal(array(read(group, 'conditionsGroups')).length, 1);
  const jsonConditions = { controlId: 'field', type: 2, controlType: 2, conditionGroupType: 1, values: ['v'] };
  const editing = {
    isGroup: true,
    conditionsGroups: [{ spliceType: 2, conditionSpliceType: 1, conditions: [jsonConditions, {}] }],
  };
  const saved = call(model, 'formatForSave', [editing]);
  assert.equal(array(read(array(saved)[0], 'groupFilters')).length, 1);
  assert.equal(read(array(saved)[0], 'isGroup'), true);
  const unfinished = call(model, 'formatForSave', [editing, { noCheck: true }]);
  assert.equal(array(read(array(unfinished)[0], 'groupFilters')).length, 2);
  const patch = { values: ['value'], dateRangeType: '3', minValue: null, opaque: { identity: true } };
  assert.equal(call(boundary, 'filterConditionPatch', [patch]), patch);
  for (const malformed of [
    { controlId: 3 },
    { type: '2' },
    { value: {} },
    { values: {} },
    { dynamicSource: [{ cid: 3 }] },
    { control: { type: 2 } },
    { folded: 'true' },
  ])
    assert.throws(() => call(boundary, 'filterConditionPatch', [malformed]), TypeError);
  const cycle: { isGroup: boolean; groupFilters: unknown[] } = { isGroup: true, groupFilters: [] };
  cycle.groupFilters.push(cycle);
  assert.throws(() => call(boundary, 'filterWireItems', [[cycle]]), TypeError);
  const sparse: unknown[] = [];
  sparse.length = 1;
  assert.throws(() => call(boundary, 'filterWireItems', [sparse]), TypeError);
  assert.equal(
    call(util, 'checkConditionAvailable', [{ conditionGroupType: 2, type: 11, minValue: 0, maxValue: 2 }]),
    0,
  );
  assert.equal(call(util, 'checkConditionAvailable', [{ conditionGroupType: 1, values: ['a', 'b'] }]), 2);
  assert.equal(call(util, 'checkConditionAvailable', [{ type: 7 }]), true);
  assert.equal(
    call(util, 'checkConditionAvailable', [{ isDynamicsource: true, dynamicSource: [{ rcid: 'url', cid: '' }] }]),
    false,
  );
  assert.equal(
    call(util, 'checkConditionAvailable', [{ isDynamicsource: 1, dynamicSource: [{ rcid: 'url', cid: 'field' }] }]),
    true,
  );
  assert.equal(
    call(util, 'checkConditionAvailable', [{ isDynamicsource: 0, dynamicSource: [{ rcid: 'url', cid: 'field' }] }]),
    false,
  );
  const values = ['null', '{"id":"one"}'];
  assert.equal(
    call(util, 'formatValues', [26, 2, values]),
    values,
    'Parsed null retains the original catch fallback array',
  );
  const wrapped = { isGroup: true, conditions: [jsonConditions, { conditionGroupType: 1, values: [] }] };
  const oldConditions = wrapped.conditions;
  const filtered = call(util, 'filterUnavailableConditions', [[wrapped], 'conditions']);
  assert.equal(array(filtered)[0], wrapped);
  assert.notEqual(wrapped.conditions, oldConditions);
  assert.equal(wrapped.conditions.length, 1);
  const date = {
    controlType: 15,
    conditionGroupType: 4,
    dateRange: 18,
    dateRangeType: '3',
    value: '2020-01-02 12:34:56',
  };
  call(util, 'formatConditionForSave', [date, 1]);
  assert.equal(date.value, '2020-01-02', 'Saving mutates the same date condition value');
  const condition = { controlId: 'text', dataType: 2, filterType: 2, dynamicSource: [{ cid: 'source' }] };
  const result = call(util, 'fillConditionValue', [
    {
      condition,
      formData: [{ controlId: 'source', type: 2, value: 'Hello' }],
      relateControl: { relationControls: [{ controlId: 'text', type: 2 }] },
    },
  ]);
  assert.equal(result, condition);
  assert.deepEqual(read(condition, 'values'), ['Hello']);
  const missing = call(util, 'getFilter', [
    {
      control: {
        advancedSetting: {
          filters: JSON.stringify([
            {
              controlId: 'text',
              dataType: 2,
              filterType: 2,
              spliceType: 1,
              emptyRule: 3,
              dynamicSource: [{ cid: 'source' }],
            },
          ]),
        },
        relationControls: [{ controlId: 'text', type: 2 }],
      },
      formData: [],
    },
  ]);
  assert.equal(missing, false, 'Required empty dynamic filter aborts rather than empty success');
  const filteredNormal = call(util, 'getFilter', [
    { control: { advancedSetting: { filters: JSON.stringify(body.items) } } },
  ]);
  assert.deepEqual(read(array(filteredNormal)[0], 'values'), ['one']);
  assert.deepEqual(call(util, 'getFilter', [{ control: { advancedSetting: { filters: 'bad' } } }]), []);
  for (const json of ['null', '{}', 'true', '[{"dataType":"2"}]', '[{"value":{}}]'])
    assert.throws(() => call(util, 'getFilter', [{ control: { advancedSetting: { filters: json } } }]), TypeError);
  assert.deepEqual(read(call(util, 'formatOriginFilterValue', [{ items: null }]), 'conditions'), []);
  assert.equal(
    array(read(call(util, 'formatOriginFilterGroupValue', [{ items: null }]), 'conditionsGroups')).length,
    1,
  );
  const timeValue = call(util, 'fillConditionValue', [
    {
      condition: { controlId: 'time', dataType: 46, dynamicSource: [{ cid: 'currenttime' }] },
      formData: [],
      relateControl: { relationControls: [{ controlId: 'time', type: 46, unit: '9' }] },
      currentTimeForSecond: new Date('2020-01-02T12:34:56'),
    },
  ]);
  assert.equal(read(timeValue, 'value'), moment(new Date('2020-01-02T12:34:56')).format('HH:mm:ss'));
  let state: unknown = { filters: [], loading: true };
  const actions: unknown[] = [];
  const dispatch = (action: unknown) => {
    actions.push(action);
    state = call(model, 'createReducer', [state, action]);
  };
  const helper = call(model, 'createActions', [dispatch]);
  const loaded = call(helper, 'loadFilters', ['sheet', () => {}]);
  latest('getWorksheetFilters').resolve([body]);
  await loaded;
  assert.equal(read(state, 'loading'), false);
  const initialFilters = read(state, 'filters');
  const failed = call(helper, 'loadFilters', ['sheet']);
  latest('getWorksheetFilters').reject(new Error('offline'));
  await failed;
  assert.equal(read(state, 'filters'), initialFilters);
  assert.equal(read(state, 'loading'), false);
  assert.equal(read(state, 'error'), '加载失败，请重试');
  const retry = call(helper, 'loadFilters', ['sheet']);
  latest('getWorksheetFilters').resolve([body]);
  await retry;
  assert.equal(read(state, 'error'), undefined);
  const bad = call(helper, 'loadFilters', ['sheet']);
  latest('getWorksheetFilters').resolve([null]);
  await bad;
  assert.equal(read(state, 'loading'), false);
  assert.equal(read(state, 'error'), '加载失败，请重试');
  call(helper, 'addFilter', [{ defaultCondition: jsonConditions }]);
  const editingBefore = read(state, 'editingFilter');
  const submit = call(helper, 'saveFilter', [{ appId: 'app', worksheetId: 'sheet', filter: editingBefore }, () => {}]);
  assert.equal(latest('saveWorksheetFilter').args['filterId'], undefined);
  latest('saveWorksheetFilter').reject(new Error('offline'));
  await submit;
  assert.equal(read(state, 'editingFilter'), editingBefore);
  assert.equal(read(state, 'error'), '保存失败，请重试');
  let missingSavedIdCallback = 0;
  const beforeMissingIdFilters = read(state, 'filters');
  const missingSavedId = call(helper, 'saveFilter', [
    { appId: 'app', worksheetId: 'sheet', filter: editingBefore },
    () => {
      missingSavedIdCallback++;
    },
  ]);
  latest('saveWorksheetFilter').resolve({});
  await missingSavedId;
  assert.equal(missingSavedIdCallback, 0);
  assert.equal(read(state, 'editingFilter'), editingBefore);
  assert.equal(read(state, 'filters'), beforeMissingIdFilters);
  assert.equal(read(state, 'error'), '保存失败，请重试');
  const resaved = call(helper, 'saveFilter', [{ appId: 'app', worksheetId: 'sheet', filter: editingBefore }]);
  latest('saveWorksheetFilter').resolve({ ...body, filterId: 'new', name: 'Saved', type: 1 });
  await resaved;
  assert.equal(read(state, 'editingFilter'), undefined);
  assert.equal(read(state, 'needSave'), false);
  assert.equal(read(state, 'error'), undefined);
  timers.splice(0).forEach(fn => fn());
  assert.ok(clicks.length);
  const deletion = call(helper, 'deleteFilter', [{ appId: 'app', filter: { id: 'new' } }]);
  latest('deleteWorksheetFilter').resolve(false);
  await deletion;
  assert.ok(array(read(state, 'filters')).some(filter => read(filter, 'id') === 'new'));
  const badDeletion = call(helper, 'deleteFilter', [{ appId: 'app', filter: { id: 'new' } }]);
  latest('deleteWorksheetFilter').resolve({ success: false });
  await badDeletion;
  assert.equal(read(state, 'error'), '删除失败');
  assert.ok(array(read(state, 'filters')).some(filter => read(filter, 'id') === 'new'));
  const deleted = call(helper, 'deleteFilter', [{ appId: 'app', filter: { id: 'new' } }]);
  latest('deleteWorksheetFilter').resolve(true);
  await deleted;
  assert.equal(
    array(read(state, 'filters')).some(filter => read(filter, 'id') === 'new'),
    false,
  );
  call(helper, 'sortFilters', ['app', 'sheet', []]);
  latest('sortWorksheetFilters').reject(new Error('offline'));
  await tick();
  assert.equal(read(state, 'error'), '排序失败，请重试');
  for (const family of ['load', 'sort'])
    for (const fresh of [false, true]) {
      let retryState: unknown = { filters: [{ id: 'one' }], loading: true };
      const retryEvents: unknown[] = [];
      const retryDispatch = (action: unknown) => {
        retryEvents.push(action);
        retryState = call(model, 'createReducer', [retryState, action]);
      };
      const failedAction = call(model, 'createActions', [retryDispatch, retryState]);
      if (family === 'load') {
        const pending = call(failedAction, 'loadFilters', ['sheet']);
        latest('getWorksheetFilters').reject(new Error('offline'));
        await pending;
      } else {
        call(failedAction, 'sortFilters', ['app', 'sheet', ['one']]);
        latest('sortWorksheetFilters').reject(new Error('offline'));
        await tick();
      }
      assert.equal(typeof read(retryState, 'error'), 'string');
      const retryAction = fresh ? call(model, 'createActions', [retryDispatch, retryState]) : failedAction;
      if (family === 'load') {
        const pending = call(retryAction, 'loadFilters', ['sheet']);
        latest('getWorksheetFilters').resolve([body]);
        await pending;
      } else {
        call(retryAction, 'sortFilters', ['app', 'sheet', ['one']]);
        latest('sortWorksheetFilters').resolve(true);
        await tick();
      }
      assert.equal(
        read(retryState, 'error'),
        undefined,
        family + ' retry must recover ' + (fresh ? 'after rerender' : 'on same instance'),
      );
      assert.equal(read(retryState, 'loading'), false);
      const eventsBefore = retryEvents.length;
      call(retryAction, 'sortFilters', ['app', 'sheet', ['one']]);
      latest('sortWorksheetFilters').resolve(true);
      await tick();
      assert.equal(
        retryEvents.length,
        eventsBefore + 1,
        'Error-free sort success must keep only its original immediate SORT_FILTERS dispatch',
      );
    }
  for (const failAt of ['callback', 'dispatch']) {
    const editing = {
      id: 'new-original',
      isGroup: true,
      conditionsGroups: [{ conditions: [jsonConditions], conditionSpliceType: 1 }],
    };
    let completionState: unknown = { filters: [], editingFilter: editing, needSave: true };
    const completionError = new Error('downstream ' + failAt + ' error');
    const callbackOrder: unknown[] = [];
    const completionDispatch = (action: unknown) => {
      callbackOrder.push(read(action, 'type'));
      if (failAt === 'dispatch' && read(action, 'type') === 'ADD_FILTER') throw completionError;
      completionState = call(model, 'createReducer', [completionState, action]);
    };
    const completion = call(model, 'createActions', [completionDispatch, completionState]);
    const alertsBefore = alerts.length;
    const savedRequest = call(completion, 'saveFilter', [
      { filter: editing },
      () => {
        callbackOrder.push('callback');
        throw completionError;
      },
    ]);
    const rejected = assert.rejects(Promise.resolve(savedRequest), error => error === completionError);
    latest('saveWorksheetFilter').resolve({ ...body, filterId: 'committed' });
    await rejected;
    assert.equal(read(completionState, 'editingFilter'), undefined);
    assert.equal(read(completionState, 'needSave'), false);
    assert.equal(read(completionState, 'error'), undefined);
    assert.equal(
      alerts.length,
      alertsBefore,
      'Committed save must not report a request failure for callback/dispatch exceptions',
    );
    assert.equal(callbackOrder[callbackOrder.length - 1], 'UPDATE');
    if (failAt === 'callback') {
      const committed = array(read(completionState, 'filters')).find(filter => read(filter, 'id') === 'committed');
      assert.ok(committed);
      const freshAction = call(model, 'createActions', [completionDispatch, completionState]);
      const nextSave = call(freshAction, 'saveFilter', [{ filter: committed }]);
      assert.equal(
        latest('saveWorksheetFilter').args['filterId'],
        'committed',
        'Editing a committed filter must not create it again',
      );
      latest('saveWorksheetFilter').resolve({ ...body, filterId: 'committed' });
      await nextSave;
    }
  }
  const empty = { filters: [], editingFilter: { conditionsGroups: [{ conditions: [jsonConditions] }] } };
  const updated = call(model, 'createReducer', [
    empty,
    { type: 'UPDATE_CONDITION', groupIndex: 0, conditionIndex: 0, value: {} },
  ]);
  assert.notEqual(updated, empty);
  assert.equal(
    read(array(read(array(read(read(updated, 'editingFilter'), 'conditionsGroups'))[0], 'conditions'))[0], 'lastAction')
      ?.toString()
      .startsWith('UPDATE_CONDITION'),
    true,
  );
  assert.equal(call(model, 'createReducer', [empty, { type: 'unknown' }]), empty);
  assert.deepEqual(call(model, 'createReducer', [empty, { type: 'RESET' }]), {});
  console.log(
    'Actual worksheet filter core helpers/actions/reducer/API failure and retry, mutable date/conditions, refs and finite boundaries passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
