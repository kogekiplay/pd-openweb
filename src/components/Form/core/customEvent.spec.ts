interface FormControl {
  controlId?: string | undefined;
  type?: number | undefined;
  value?: unknown;
  enumDefault?: number | undefined;
  options?: Array<{ key?: string; value?: string; score?: unknown }> | undefined;
  advancedSetting?: Record<string, string | undefined> | undefined;
  relationControls?: FormControl[] | undefined;
  keepShowRowIds?: string[] | undefined;
  eventPermissions?: string | undefined;
}
interface CustomEventAction {
  actionType?: string;
  actionItems?: Array<{ controlId?: string; type?: string; value?: string }>;
  advancedSetting?: Record<string, string>;
  message?: string;
  dataSource?: string;
}
interface CustomEventFilter {
  valueType?: string;
  spliceType?: string;
  advancedSetting?: Record<string, string>;
}
interface FormQueryConfig {
  id?: string;
  controlId?: string;
  sourceId?: string;
  items?: unknown[];
  configs?: Array<{ cid?: string; subCid?: string }>;
  templates?: Array<{ controls?: FormControl[] }>;
  queryCount?: string | number;
}
interface CustomEventProps {
  triggerType?: string;
  controlId?: string;
  formData?: FormControl[];
  renderData?: FormControl[];
  recordId?: string;
  worksheetId?: string;
  appId?: string;
  projectId?: string;
  searchConfig?: FormQueryConfig[];
  advancedSetting?: Record<string, string>;
  checkEventComplete: (loading: Record<string, boolean>) => void;
  checkRuleValidator: () => void;
  handleChange: (value: unknown, cid?: string) => void;
  handleActiveTab: (value: string) => void;
  setErrorItems: (errors?: Array<{ controlId?: string; errorMessage?: string }>) => void;
  setRenderData: () => void;
}
interface ApiRequestMapping {
  id?: string;
  pid?: string;
  type?: number;
  defsource?: string;
}
interface ApiUpdateProps {
  formData?: FormControl[];
  advancedSetting?: Record<string, string>;
  onChange: (value: unknown, cid?: string, trigger?: boolean) => void;
}
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { transformFileSync, transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
interface Engine {
  getSubListData: (props: { rowId?: string; worksheetId?: string; controlId?: string }) => Promise<unknown[]>;
  runActions: (props: CustomEventProps & { actions?: CustomEventAction[] }) => Promise<number>;
  dealCustomEvent: (props: CustomEventProps) => void;
  handleSetValueActions: (
    items: { controlId?: string; type?: string; value?: string }[],
    props: CustomEventProps,
  ) => Promise<unknown>;
}
interface SearchEngine {
  getParamsByConfigs: (
    id: string | undefined,
    map: ApiRequestMapping[],
    data: FormControl[],
  ) => Record<string, unknown>;
  handleUpdateApi: (props: ApiUpdateProps, data: unknown, isDefault?: boolean) => void;
  dealAuthAccount: (account: string, data: FormControl[]) => string;
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const loggedErrors: unknown[][] = [];
const trace: Array<{ kind: string; value: unknown }> = [];
let apiReply = () => Promise.resolve<unknown>({ apiQueryData: { field: 'assigned' } });
let queryReply = () => Promise.resolve<unknown>({ resultCode: 1, count: 1, data: [{ rowid: 'row', source: 'found' }] });
let relationReply = () => Promise.resolve<unknown>({ resultCode: 1, count: 0, data: [] });
let worksheetReply = () => Promise.resolve<unknown>({ template: { controls: [{ controlId: 'target', type: 2 }] } });
let createReply = () => Promise.resolve<unknown>({ resultCode: 1 });
let functionResult: unknown = 'true';
let dynamicResult: unknown;
const parse = (value: unknown, type?: string): unknown => {
  if (value !== null && typeof value === 'object') return value;
  try {
    return JSON.parse(typeof value === 'string' ? value : String(value));
  } catch {
    return type === 'array' ? [] : {};
  }
};
const win: { shareState?: Record<string, unknown>; open: (value: string) => void; customEventAudioPlayer?: unknown } = {
  shareState: {},
  open: value => trace.push({ kind: 'open', value }),
};
const cache = new Map<string, Record<string, unknown>>();
const root = path.resolve(__dirname, '../../../..');
const controlSource = fs.readFileSync(path.join(root, 'src/utils/control.ts'), 'utf8');
const countSource = controlSource.slice(
  controlSource.indexOf('export const getDefaultCount ='),
  controlSource.indexOf('export const isTimeStyle ='),
);
const countModule: { exports: { getDefaultCount?: (control: FormControl, count?: string | number) => number } } = {
  exports: {},
};
new Function('module', 'exports', '_', transformSync(countSource, { filename: 'control.ts' }).code)(
  countModule,
  countModule.exports,
  lodash,
);
const countDefault = countModule.exports.getDefaultCount;
if (!countDefault) throw new Error('Missing actual getDefaultCount export');
let filterReply: unknown = [];
function load(file: string): Record<string, unknown> {
  const cached = cache.get(file);
  if (cached) return cached;
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  cache.set(file, moduleLike.exports);
  const { code } = transformFileSync(file);
  const testCode = file.endsWith('/customEvent.tsx')
    ? code + '\nexports.runActions=triggerCustomActions;exports.getSubListData=getSubListData;'
    : code;
  const valueBoundary = () => load(path.join(root, 'src/components/Form/core/formUtils/valueBoundary.ts'));
  const stubs: Record<string, unknown> = {
    'ming-ui': { Dialog: { confirm: (value: unknown) => trace.push({ kind: 'dialog', value }) } },
    'src/api/file': { getChatFileUrl: async () => 'audio.mp3' },
    'src/api/worksheet': {
      excuteApiQuery: (value: unknown) => {
        trace.push({ kind: 'api', value });
        return apiReply();
      },
      getFilterRowsByQueryDefault: (value: unknown) => {
        trace.push({ kind: 'query', value });
        return queryReply();
      },
      getRowRelationRows: (value: unknown) => {
        trace.push({ kind: 'relation', value });
        return relationReply();
      },
      getWorksheetInfo: (value: unknown) => {
        trace.push({ kind: 'template', value });
        return worksheetReply();
      },
      addWorksheetRow: (value: unknown) => {
        trace.push({ kind: 'create', value });
        return createReply();
      },
      refreshSummary: (value: unknown) => {
        trace.push({ kind: 'refresh', value });
        return apiReply();
      },
    },
    'worksheet/common/WorkSheetFilter/util': { getFilter: () => filterReply },
    'src/components/upgradeVersion': {
      upgradeVersionDialog: (value: unknown) => trace.push({ kind: 'upgrade', value }),
    },
    'src/pages/widgetConfig/widgetSetting/components/CustomEvent/config.js': {
      ACTION_VALUE_ENUM: {
        SHOW: '1',
        HIDE: '2',
        EDIT: '3',
        READONLY: '4',
        SET_VALUE: '5',
        ERROR: '6',
        REFRESH_VALUE: '7',
        API: '8',
        MESSAGE: '9',
        VOICE: '10',
        LINK: '11',
        CREATE: '12',
        OPERATION_FLOW: '13',
        SEARCH_WORKSHEET: '14',
        ACTIVATE_TAB: '15',
      },
      ADD_EVENT_ENUM: { CHANGE: '1', SHOW: '2', HIDE: '3', FOCUS: '4', BLUR: '5', CLICK: '6' },
      FILTER_VALUE_ENUM: { CONTROL_VALUE: '1', SEARCH_WORKSHEET: '2', API: '3', CUSTOM_FUN: '4' },
      SPLICE_TYPE_ENUM: { AND: '1', OR: '2' },
      VOICE_FILE_LIST: [],
    },
    'src/utils/common': { browserIsMobile: () => false, pathCompletion: (value: string) => value },
    'src/utils/control': { getDefaultCount: countDefault },
    'src/utils/controlCommon': {
      isSheetDisplay: () => false,
      isEmptyValue: (value: unknown) => value === '' || value === undefined,
      getDatePickerConfigs: () => ({ formatMode: 'YYYY-MM-DD' }),
    },
    'src/utils/domain/control/value': {
      getRelateRecordRowIds: (value: unknown) => {
        const rows: unknown = parse(value, 'array');
        return Array.isArray(rows)
          ? rows.flatMap(row =>
              row && typeof row === 'object' && 'sid' in row && typeof row.sid === 'string' ? [row.sid] : [],
            )
          : [];
      },
    },
    './config.js': { FORM_ERROR_TYPE: { OTHER_ERROR: 'OTHER_ERROR' } },
    './utils': {
      formatControlToServer: (control: FormControl) => ({
        controlId: control.controlId,
        type: control.type,
        value: control.value,
      }),
    },
    './formUtils': {
      calcDefaultValueFunction: () => functionResult,
      checkValueAvailable: () => ({ isAvailable: true }),
      formatSearchResultValue: (props: { searchResult?: unknown }) => props.searchResult,
      getCurrentValue: (_control: unknown, value: unknown) => value,
      getDynamicValue: (_data: FormControl[], control: FormControl) => {
        if (dynamicResult !== undefined) return dynamicResult;
        const getSources = valueBoundary()['defaultSources'] as (value: unknown) => Array<{ staticValue?: unknown }>;
        return getSources(control.advancedSetting?.defsource)
          .map(source => source.staticValue ?? '')
          .join('');
      },
    },
    './formUtils/helper': {
      replaceStr: (value: string, index: number, replacement: string) =>
        value.slice(0, index) + replacement + value.slice(index + 1),
      getAttachmentData: () => [],
    },
    'src/pages/widgetConfig/config/widget': { SYSTEM_CONTROL: [], WORKFLOW_SYSTEM_CONTROL: [] },
    'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util': {
      transferValue: (value: string) => [{ staticValue: value }],
    },
  };
  const localRequire = (request: string): unknown => {
    if (Object.hasOwn(stubs, request)) return stubs[request];
    if (request === 'lodash') return lodash;
    if (request.startsWith('.')) return load(path.resolve(path.dirname(file), request.replace(/\.js$/, '') + '.ts'));
    return require(request);
  };
  new Function(
    'require',
    'module',
    'exports',
    'safeParse',
    'window',
    'md',
    'alert',
    '_l',
    'document',
    'console',
    testCode,
  )(
    localRequire,
    moduleLike,
    moduleLike.exports,
    parse,
    win,
    { global: { Config: { pushUniqueId: 'push' }, Account: { accountId: 'self', fullname: 'Self' } } },
    (value: unknown) => trace.push({ kind: 'alert', value }),
    (value: string) => value,
    { createElement: () => ({ src: '', play: async () => {} }) },
    { log: (...args: unknown[]) => loggedErrors.push(args) },
  );
  return moduleLike.exports;
}
const engine = load(path.join(__dirname, 'customEvent.tsx')) as unknown as Engine;
const search = load(path.join(__dirname, 'searchUtils.ts')) as unknown as SearchEngine;
const controls: FormControl[] = [{ controlId: 'field', type: 2, value: 'before' }];
function props(
  actions: CustomEventAction[],
  filters: CustomEventFilter[] = [],
  extra: Partial<CustomEventProps> = {},
): CustomEventProps {
  return {
    triggerType: '5',
    controlId: 'field',
    formData: controls,
    renderData: controls,
    recordId: 'record',
    worksheetId: 'sheet',
    appId: 'app',
    projectId: 'project',
    advancedSetting: {
      custom_event: JSON.stringify([{ eventType: '5', eventId: 'event', eventActions: [{ filters, actions }] }]),
    },
    checkEventComplete: value => trace.push({ kind: 'loading', value }),
    handleChange: (value, cid) => trace.push({ kind: 'change', value: { value, cid } }),
    checkRuleValidator: () => {},
    handleActiveTab: value => trace.push({ kind: 'tab', value }),
    setErrorItems: () => {},
    setRenderData: () => {},
    ...extra,
  };
}
const apiAction: CustomEventAction = {
  actionType: '8',
  dataSource: 'api-template',
  advancedSetting: {
    requestmap: '[{"id":"request","type":2,"defsource":"[{\\"cid\\":\\"field\\"}]"}]',
    responsemap: '[{"cid":"field","type":2}]',
  },
};
const message: CustomEventAction = { actionType: '9', message: '[{"staticValue":"after"}]' };
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 10));
}
function completed() {
  assert.deepEqual(
    trace.filter(item => item.kind === 'loading').map(item => item.value),
    [{ event: true }, { event: false }],
  );
}
async function run() {
  const pending = deferred<unknown>();
  apiReply = () => pending.promise;
  engine.dealCustomEvent(props([apiAction, message]));
  await settle();
  assert.deepEqual(
    trace.map(item => item.kind),
    ['loading', 'api'],
  );
  pending.resolve({ apiQueryData: { field: 'assigned' } });
  await settle();
  completed();
  assert.deepEqual(
    trace.map(item => item.kind),
    ['loading', 'api', 'change', 'alert', 'loading'],
  );
  assert.equal(
    (trace.find(item => item.kind === 'api')?.value as { data: { request: string } }).data.request,
    'before',
  );
  assert.deepEqual(trace.find(item => item.kind === 'change')?.value, { value: 'assigned', cid: 'field' });
  for (const failure of [new Error('network'), { statusText: 'abort' }]) {
    trace.length = 0;
    apiReply = () => Promise.reject(failure);
    engine.dealCustomEvent(props([apiAction, message]));
    await settle();
    completed();
    assert.equal(trace.filter(item => item.kind === 'change' || item.kind === 'alert').length, 0);
  }
  trace.length = 0;
  apiReply = () => Promise.resolve({ code: 20008 });
  engine.dealCustomEvent(props([apiAction]));
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'upgrade').length, 1);
  trace.length = 0;
  apiReply = () => Promise.resolve({ message: 'backend refused' });
  engine.dealCustomEvent(props([apiAction]));
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'change').length, 0);
  trace.length = 0;
  engine.dealCustomEvent(props([{ actionType: 'unsupported' }]));
  await settle();
  completed();
  trace.length = 0;
  functionResult = 'false';
  engine.dealCustomEvent(
    props([message], [{ valueType: '4', spliceType: '1', advancedSetting: { defaultfunc: '{"expression":"false"}' } }]),
  );
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'alert').length, 0);
  trace.length = 0;
  engine.dealCustomEvent(
    props([], [], {
      advancedSetting: {
        custom_event: JSON.stringify([
          {
            eventType: '5',
            eventId: 'bad',
            eventActions: [{ actions: [{ actionType: '8', actionItems: [{ controlId: 17 }] }] }],
          },
        ]),
      },
    }),
  );
  await settle();
  assert.equal(trace.length, 0, 'Malformed stored action targets cannot enter the engine or publish completion');
  trace.length = 0;
  win.shareState = { isPublicRecord: true };
  engine.dealCustomEvent(props([apiAction]));
  await settle();
  assert.equal(trace.length, 0);
  win.shareState = {};
  const query: FormQueryConfig = {
    id: 'query',
    controlId: 'field',
    sourceId: 'other',
    items: [],
    configs: [{ cid: 'field', subCid: 'source' }],
    templates: [{ controls: [{ controlId: 'source', type: 2 }] }],
    queryCount: 10,
  };
  trace.length = 0;
  queryReply = () => Promise.resolve({ resultCode: 1, count: 1, data: [{ rowid: 'row', source: 'found' }] });
  engine.dealCustomEvent(
    props([{ actionType: '14', advancedSetting: { dynamicsrc: '{"id":"query"}' } }], [], { searchConfig: [query] }),
  );
  await settle();
  completed();
  assert.deepEqual(trace.find(item => item.kind === 'change')?.value, { value: 'found', cid: 'field' });
  const queryArgs = trace.find(item => item.kind === 'query')?.value as {
    worksheetId: string;
    pageSize: number;
    filterControls: unknown[];
  };
  assert.equal(queryArgs.worksheetId, 'other');
  assert.deepEqual(queryArgs.filterControls, []);
  trace.length = 0;
  const card: FormControl = { controlId: 'card', type: 29, enumDefault: 2, advancedSetting: { showtype: '1' } };
  await engine.handleSetValueActions(
    [{ controlId: 'card', type: '2', value: '{"id":"query"}' }],
    props([], [], { formData: [card], searchConfig: [{ ...query, controlId: 'card', queryCount: '2000' }] }),
  );
  assert.equal(
    (trace.find(item => item.kind === 'query')?.value as { pageSize: number }).pageSize,
    200,
    'The actual card-count helper must preserve its page-size cap',
  );
  trace.length = 0;
  filterReply = false;
  engine.dealCustomEvent(
    props([{ actionType: '14', advancedSetting: { dynamicsrc: '{"id":"query"}' } }], [], { searchConfig: [query] }),
  );
  await settle();
  completed();
  assert.deepEqual(
    (trace.find(item => item.kind === 'query')?.value as { filterControls: unknown[] }).filterControls,
    [],
  );
  trace.length = 0;
  filterReply = { invalid: true };
  engine.dealCustomEvent(
    props([{ actionType: '14', advancedSetting: { dynamicsrc: '{"id":"query"}' } }], [], { searchConfig: [query] }),
  );
  await settle();
  completed();
  assert.equal(
    trace.filter(item => item.kind === 'query').length,
    0,
    'An invalid filter result cannot issue an unfiltered request',
  );
  filterReply = [];
  trace.length = 0;
  queryReply = () => Promise.resolve({ resultCode: 1, count: 1, data: { invalid: true } });
  engine.dealCustomEvent(
    props([{ actionType: '14', advancedSetting: { dynamicsrc: '{"id":"query"}' } }], [], { searchConfig: [query] }),
  );
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'change').length, 0, 'Invalid row data cannot clear a valid field');
  trace.length = 0;
  engine.dealCustomEvent(
    props([{ actionType: '14', advancedSetting: { dynamicsrc: '{}' } }], [], { searchConfig: [query] }),
  );
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'query').length, 0);
  trace.length = 0;
  engine.dealCustomEvent(props([{ actionType: '5', actionItems: [{ type: '0', value: '[]' }] }]));
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'change').length, 0);
  const relation: FormControl = { controlId: 'relation', type: 29, value: '[{"sid":"old"}]' };
  trace.length = 0;
  engine.dealCustomEvent(
    props([{ actionType: '5', actionItems: [{ controlId: 'relation', type: '0', value: '[]' }] }], [], {
      formData: [relation],
    }),
  );
  await settle();
  completed();
  assert.deepEqual(relation.keepShowRowIds, ['old']);
  assert.equal((trace.find(item => item.kind === 'change')?.value as { value: string }).value, 'deleteRowIds: all');
  trace.length = 0;
  dynamicResult = { rowid: 'not-a-link' };
  engine.dealCustomEvent(props([{ actionType: '11', message: '[{"staticValue":"url"}]' }]));
  await settle();
  completed();
  assert.equal(trace.filter(item => item.kind === 'open').length, 0);
  dynamicResult = undefined;
  trace.length = 0;
  engine.dealCustomEvent(props([{ actionType: '11', message: '[{"staticValue":"https://example.test"}]' }]));
  await settle();
  completed();
  assert.equal(trace.find(item => item.kind === 'open')?.value, 'https://example.test');
  trace.length = 0;
  const creating = deferred<unknown>();
  createReply = () => creating.promise;
  let creationComplete = false;
  const creationActions: CustomEventAction[] = [
    {
      actionType: '12',
      actionItems: [{ controlId: 'target', value: '[{"staticValue":"new"}]' }],
      advancedSetting: { sheetId: 'destination', appId: 'app' },
    },
    { actionType: '11', message: '[{"staticValue":"https://after-create.test"}]' },
  ];
  const creationTask = engine
    .runActions({ ...props([], [], { triggerType: '6' }), actions: creationActions })
    .then(() => {
      creationComplete = true;
    });
  await settle();
  assert.equal(trace.find(item => item.kind === 'open')?.value, 'https://after-create.test');
  assert.equal(
    creationComplete,
    false,
    'Later actions keep their original order, but the event waits for the started creation',
  );
  assert.ok(trace.findIndex(item => item.kind === 'open') < trace.findIndex(item => item.kind === 'create'));
  creating.resolve({ resultCode: 1 });
  await creationTask;
  assert.equal(creationComplete, true);
  assert.equal(trace.filter(item => item.kind === 'alert').length, 1);
  trace.length = 0;
  createReply = () => Promise.reject(new Error('create failed'));
  await engine.runActions({ ...props([], [], { triggerType: '6' }), actions: creationActions });
  assert.equal(trace.filter(item => item.kind === 'alert').length, 0, 'A failed creation cannot publish success');
  trace.length = 0;
  const placeholder: FormControl = { type: 2, value: 'placeholder' };
  engine.dealCustomEvent(
    props(
      [
        { actionType: '2', actionItems: [{}] },
        { actionType: '6', actionItems: [{}] },
        { actionType: '7', actionItems: [{}] },
      ],
      [],
      { formData: [placeholder], setErrorItems: errors => trace.push({ kind: 'errors', value: errors }) },
    ),
  );
  await settle();
  completed();
  assert.equal(placeholder.eventPermissions, undefined, 'Missing target ID cannot change a placeholder permission');
  assert.deepEqual(trace.find(item => item.kind === 'errors')?.value, []);
  assert.equal(trace.filter(item => item.kind === 'refresh').length, 0);
  trace.length = 0;
  engine.dealCustomEvent(
    props([message], [{ valueType: '2', spliceType: '1', advancedSetting: { dynamicsrc: '{}' } }], {
      searchConfig: [
        { controlId: 'field', sourceId: 'other', templates: [{ controls: [{ controlId: 'source', type: 2 }] }] },
      ],
    }),
  );
  await settle();
  completed();
  assert.equal(
    trace.filter(item => item.kind === 'query' || item.kind === 'alert').length,
    0,
    'Missing query ID cannot borrow a query config without an ID',
  );
  relationReply = () => Promise.resolve({ resultCode: 1, data: [{ rowid: 'child' }] });
  assert.deepEqual(await engine.getSubListData({ rowId: 'row', worksheetId: 'other', controlId: 'relation' }), [
    { rowid: 'child' },
  ]);
  relationReply = () => Promise.resolve({ resultCode: 1, count: 99, data: [] });
  assert.deepEqual(
    await engine.getSubListData({}),
    [],
    'Relation total count does not imply a nonempty requested page',
  );
  relationReply = () => Promise.resolve({ resultCode: 1 });
  await assert.rejects(
    engine.getSubListData({}),
    /Invalid related-row data/,
    'Absent relation rows keep the prior downstream failure rather than publishing a clear',
  );
  const scored = (scores: unknown[]) =>
    search.getParamsByConfigs(
      undefined,
      [{ id: 'score', type: 6, defsource: '[{"cid":"option"}]' }],
      [
        {
          controlId: 'option',
          type: 10,
          value: '["a","b"]',
          options: [
            { key: 'a', score: scores[0] },
            { key: 'b', score: scores[1] },
          ],
        },
      ],
    );
  assert.deepEqual(scored([2, 3]), { score: '5' });
  assert.deepEqual(scored(['2', '3']), { score: '023' }, 'Legacy string score payloads preserve old + concatenation');
  assert.deepEqual(scored([null, 3]), { score: '3' });
  assert.deepEqual(scored([undefined, 3]), { score: 'NaN' });
  const map: ApiRequestMapping[] = [
    { id: 'rows', type: 10000008, defsource: '[{"cid":"relation"}]' },
    { id: 'row-id', pid: 'rows', type: 2, defsource: '[{"cid":"rowid","rcid":"relation"}]' },
    { id: 'name', pid: 'rows', type: 2, defsource: '[{"cid":"child","rcid":"relation"}]' },
  ];
  const related: FormControl = {
    controlId: 'relation',
    type: 29,
    value: '[{"sid":"r","sourcevalue":"{\\"rowid\\":\\"r\\",\\"child\\":\\"value\\"}"}]',
    relationControls: [{ controlId: 'child', type: 2 }],
  };
  assert.deepEqual(search.getParamsByConfigs(undefined, map, [related]), { rows: [{ 'row-id': 'r', name: 'value' }] });
  assert.deepEqual(
    search.getParamsByConfigs(undefined, [{ type: 2, defsource: '[]' }], controls),
    {},
    'Missing API mapping ID cannot emit an undefined target',
  );
  const updates: unknown[][] = [];
  search.handleUpdateApi(
    {
      formData: [{ controlId: 'field', type: 2 }],
      advancedSetting: { responsemap: '[{"cid":"field","type":10000007}]' },
      onChange: (...args: unknown[]) => updates.push(args),
    },
    { field: '["a","b"]' },
  );
  assert.deepEqual(updates, [['a,b', 'field', false]]);
  search.handleUpdateApi(
    {
      formData: controls,
      advancedSetting: { responsemap: '[{"cid":"field","type":2}]' },
      onChange: (...args: unknown[]) => updates.push(args),
    },
    null,
  );
  assert.equal(updates.length, 1);
  console.log(
    'actual custom-event engine: async success/reject/cancel/skip/query/link/create and API field mapping passed',
  );
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
