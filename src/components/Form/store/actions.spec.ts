const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync, transformSync } = require('../../../../scripts/spec-harness.ts');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const lodash = require('lodash');
interface Control {
  controlId?: string;
  controlName?: string;
  type?: number;
  value?: unknown;
  row?: number;
  fieldPermission?: string;
  controlPermissions?: string;
  sectionId?: string;
  required?: boolean;
}
interface ErrorItem {
  controlId?: string;
  errorType?: string;
  errorMessage?: string;
  errorText?: string;
  showError?: boolean;
  ruleId?: string;
}
interface Rule {
  type?: number;
  ruleId?: string;
  ruleItems?: { message?: string; type?: number }[];
}
interface State {
  renderData: Control[];
  errorItems: ErrorItem[];
  uniqueErrorItems: ErrorItem[];
  rules?: Rule[];
  searchConfig?: { eventType?: number }[];
  loadingItems: Record<string, boolean>;
  rulesLoading: boolean;
  verifyCode: string;
  activeTabControlId?: string;
  configLock: boolean;
  emSizeNum: number | string | undefined;
}
interface Action {
  type: string;
  payload?: unknown;
}
interface Data {
  data: Control[];
  errorItems: ErrorItem[];
  controlIds: string[];
  ruleControlIds: string[];
  currentRuleControlIds: string[];
  getDataSource: () => Control[];
  getErrorControls: () => ErrorItem[];
  getUpdateControlIds: () => string[];
  getUpdateRuleControlIds: () => string[];
  getCurrentRuleControlIds: () => string[];
  resetCurrentRuleControlIds: () => void;
  setErrorControl: (controlId?: string, type?: string, message?: string, rule?: Rule, isInit?: boolean) => void;
  updateDataSource: (args: { controlId?: string; value?: unknown; removeUniqueItem?: (id?: string) => void }) => void;
  callStore: (...args: unknown[]) => void;
}
interface SaveResult {
  data: Control[];
  updateControlIds: string[];
  handleRuleError: (rows: string[]) => void;
  handleServiceError: (rows: string[]) => void;
}
interface Props {
  worksheetId?: string;
  appId?: string;
  recordId?: string;
  from?: number;
  systemControlData?: Control[];
  onRulesLoad?: (rules: Rule[]) => void;
  onError?: () => void;
  onSave?: (error: boolean | undefined, result: SaveResult) => void;
}
interface Context {
  props: Props;
  getState: () => State;
  dataFormat: Data;
  options?: Record<string, boolean>;
  getSubmitBegin?: () => boolean;
  getControlRefs?: () => Record<string, unknown>;
  newErrorDialog?: (...args: unknown[]) => void;
}
interface Actions {
  getFilterDataByRuleAction: (
    dispatch: (action: Action) => void,
    ctx: Context & { onChangeEnhance?: (...args: unknown[]) => void; updateChangeStatus?: (value: boolean) => void },
  ) => void;
  getConfigAction: (
    dispatch: (action: Action) => void,
    ctx: { props: Props; getRules?: boolean; getSearchConfig?: boolean },
  ) => Promise<void>;
  handleChangeAction: (
    dispatch: (action: Action) => void,
    ctx: Context & { value: unknown; cid: string; item: Control },
  ) => void;
  getSubmitDataAction: (
    dispatch: (action: Action) => void,
    ctx: Context,
  ) => { error?: boolean; hasError: boolean; hasRuleError: number; data: Control[] };
  submitFormDataAction: (
    dispatch: (action: Action) => void,
    ctx: Context & { updateSubmitBegin: (begin: boolean) => void },
  ) => void;
  checkControlUniqueAction: (
    dispatch: (action: Action) => void,
    ctx: { props: Props; getState: () => State; controlId?: string; controlType?: number; controlValue: string },
  ) => void;
  triggerCustomEventAction: (
    dispatch: (action: Action) => void,
    ctx: Context & { params: unknown; updateRenderData: () => void; handleChange: (...args: unknown[]) => void },
  ) => void;
}
let rulesFailure = false;
let rulesResponse: unknown = [{ type: 0, ruleItems: [] }];
let queryResponse: unknown = { queries: [], templates: {} };
let uniqueReply: unknown = { isSuccess: true };
let uniqueFailure = false;
let callbacks = 0;
const calls: Array<{ kind: string; args: unknown }> = [];
const alerts: unknown[] = [];
const scheduled: Array<() => void> = [];
let dynamic = false;
const ruleMessages: { errorMessage: string; ignoreErrorMessage: boolean }[] = [];
const api = {
  getControlRules: (args: unknown) => {
    calls.push({ kind: 'rules', args });
    return rulesFailure ? Promise.reject(new Error('network')) : Promise.resolve(rulesResponse);
  },
  getQueryBySheetId: (args: unknown) => {
    calls.push({ kind: 'query', args });
    return Promise.resolve(queryResponse);
  },
  checkFieldUnique: (args: unknown) => {
    calls.push({ kind: 'unique', args });
    return uniqueFailure ? Promise.reject(new Error('network')) : Promise.resolve(uniqueReply);
  },
};
const constants = { REQUIRED: 'REQUIRED', RULE_REQUIRED: 'RULE_REQUIRED', RULE_ERROR: 'RULE_ERROR', UNIQUE: 'UNIQUE' };
const stubs: Record<string, unknown> = {
  'antd-mobile': { Dialog: { alert: () => {} } },
  'ming-ui': { Dialog: { confirm: () => {} } },
  'src/api/worksheet': { __esModule: true, default: api },
  'src/pages/widgetConfig/util': {
    formatSearchConfigs: (value: unknown) =>
      typeof value === 'object' && value !== null && 'queries' in value ? value.queries : [],
  },
  'src/pages/widgetConfig/widgetSetting/components/SplitLineConfig/config': { getExpandWidgetIdsMap: () => ({}) },
  'src/pages/worksheet/components/ChildTable/utils': { getSubListErrorOfStore: () => ({}) },
  'src/utils/common': { browserIsMobile: () => false },
  'src/utils/control': {
    controlState: (control?: Control) => ({
      visible: control?.fieldPermission?.[0] !== '0',
      editable: control?.fieldPermission?.[1] !== '0',
    }),
  },
  'src/utils/translate': { replaceRulesTranslateInfo: (_app: string, _sheet: string, rules: Rule[]) => rules },
  '../core/config': { FORM_ERROR_TYPE: constants, FROM: { PUBLIC_ADD: 2, PUBLIC_EDIT: 3 } },
  '../core/customEvent': {
    dealCustomEvent: (props: { checkEventComplete: (loading: Record<string, boolean>) => void }) => {
      props.checkEventComplete({ event: true });
      props.checkEventComplete({ event: false });
    },
  },
  '../core/formUtils': {
    checkAllValueAvailable: () => ruleMessages,
    checkRequired: (control: Control) => (control.required && !control.value ? 'REQUIRED' : ''),
    getRuleErrorInfo: (_rules: unknown, rows: string[]) =>
      rows.length
        ? [{ errorInfo: [{ controlId: 'field', errorType: 'RULE_ERROR', errorMessage: 'backend', showError: true }] }]
        : [],
  },
  '../core/formUtils/helper': {
    mergeFormDataWidthSystem: (controls: Control[], system: Control[] = []) => [...controls, ...system],
    replaceStr: (value: string, index: number, replacement: string) =>
      value.slice(0, index) + replacement + value.slice(index + 1),
  },
  '../core/formUtils/updateRulesData': {
    updateRulesData: (props: {
      data: Control[];
      disabledRuleSet?: boolean;
      handleChange?: (...args: unknown[]) => void;
    }) => {
      if (dynamic && !props.disabledRuleSet) {
        props.handleChange?.('new', 'field', props.data[0], false);
        props.handleChange?.(undefined, undefined, undefined, false, true);
      }
      return props.data;
    },
  },
  '../core/utils': {
    formatControlValue: (value: string) => value,
    getServiceError: (rows: string[]) => ({
      serviceError: rows.map(controlId => ({ controlId, errorType: 'REQUIRED', showError: true })),
      hideControlErrors: [],
    }),
  },
  'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}) },
};
const source = process.env.FORM_STORE_ACTION_SOURCE || path.join(__dirname, 'actions.tsx');
const { code } = transformFileSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
const moduleLike: { exports: Partial<Actions> } = { exports: {} };
new Function('module', 'exports', 'require', '_l', 'alert', 'setTimeout', '$', code)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (name === 'lodash') return lodash;
    if (Object.hasOwn(stubs, name)) return stubs[name];
    throw new Error(`Unexpected form action dependency ${name}`);
  },
  (text: string) => text,
  (...args: unknown[]) => alerts.push(args),
  (fn: () => void) => {
    scheduled.push(fn);
    return 1;
  },
  () => ({ find: () => ({ length: 0 }) }),
);
const actions = moduleLike.exports as Actions;
const reducerModule: { exports: { initialState?: State; reducer?: (state: State, action: Action) => State } } = {
  exports: {},
};
const reducerCode = transformFileSync(path.join(__dirname, 'reducers.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function('module', 'exports', reducerCode)(reducerModule, reducerModule.exports);
const reducer = reducerModule.exports.reducer as NonNullable<typeof reducerModule.exports.reducer>;
let state = { ...reducerModule.exports.initialState, rules: [], searchConfig: [] } as State;
const dispatch = (action: Action) => {
  state = reducer(state, action);
};

// Compile actual DataFormat public member source, with only its constructor excluded from this unit scope.
const dataCode = transformFileSync(path.join(__dirname, '../core/DataFormat.ts'), { plugins: [] }).code;
const ast = parser.parse(dataCode, { sourceType: 'module' });
const declaration = ast.program.body.find(
  (node: { type: string; declaration?: { type: string } }) =>
    node.type === 'ExportDefaultDeclaration' && node.declaration?.type === 'ClassDeclaration',
).declaration;
const methods = new Set([
  'getDataSource',
  'getUpdateControlIds',
  'getUpdateRuleControlIds',
  'getCurrentRuleControlIds',
  'resetCurrentRuleControlIds',
  'getErrorControls',
  'setErrorControl',
]);
const memberText = declaration.body.body
  .filter((node: { key?: { name?: string } }) => methods.has(node.key?.name))
  .map((node: unknown) => generate(node).code)
  .join('\n');
const DataClass = new Function('_', 'FORM_ERROR_TYPE', `return class { isInitSearch(){return true} ${memberText} }`)(
  lodash,
  constants,
) as { new (): Data };
const dataFormat = new DataClass();
dataFormat.data = [
  { controlId: 'field', type: 2, row: 0, value: 'old', fieldPermission: '111', controlPermissions: '111' },
];
dataFormat.errorItems = [];
dataFormat.controlIds = [];
dataFormat.ruleControlIds = [];
dataFormat.currentRuleControlIds = [];
dataFormat.updateDataSource = ({ controlId, value, removeUniqueItem }) => {
  const control = dataFormat.data.find(item => item.controlId === controlId);
  if (control) {
    control.value = value;
    dataFormat.controlIds = [controlId || ''];
  }
  removeUniqueItem?.(controlId);
};
dataFormat.callStore = () => {};
const context = (): Context => ({
  props: { worksheetId: 'sheet', appId: 'app', systemControlData: [] },
  getState: () => state,
  dataFormat,
  getSubmitBegin: () => true,
  getControlRefs: () => ({}),
  newErrorDialog: () => {},
});
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function run(): Promise<void> {
  await actions.getConfigAction(dispatch, { props: context().props, getRules: true, getSearchConfig: true });
  assert.equal(state.configLock, true);
  assert.deepEqual(
    calls.map(call => call.kind),
    ['rules', 'query'],
  );
  assert.equal(state.rules?.length, 1);
  assert.equal(state.searchConfig?.length, 0);
  if (process.env.FORM_STORE_NORMAL_ONLY !== '1') {
    const configsBefore = calls.length;
    await actions.getConfigAction(dispatch, { props: {}, getRules: true });
    assert.equal(calls.length, configsBefore, 'Missing worksheet ID must not call the configuration API');
    assert.equal(state.configLock, false);
    assert.ok(alerts.length > 0);
    rulesFailure = true;
    await actions.getConfigAction(dispatch, { props: context().props, getRules: true });
    assert.equal(state.configLock, false, 'A config network failure cannot signal successful initialization');
    assert.equal(state.rulesLoading, false);
    rulesFailure = false;
  }
  actions.handleChangeAction(dispatch, { ...context(), cid: 'field', value: 'new', item: dataFormat.data[0] });
  assert.equal(dataFormat.getDataSource()[0].value, 'new');
  assert.equal(state.renderData[0].value, 'new');
  dynamic = true;
  dataFormat.data[0].value = 'old';
  dataFormat.currentRuleControlIds = ['field'];
  actions.getFilterDataByRuleAction(dispatch, {
    ...context(),
    onChangeEnhance: () => {
      callbacks++;
    },
  });
  scheduled.splice(0).forEach(fn => fn());
  assert.equal(callbacks, 1);
  assert.deepEqual(dataFormat.getCurrentRuleControlIds(), []);
  dynamic = false;
  let saved: SaveResult | undefined;
  const submitFlags: boolean[] = [];
  const submitContext = {
    ...context(),
    props: {
      ...context().props,
      onSave: (error: boolean | undefined, result: SaveResult) => {
        assert.equal(error, undefined);
        saved = result;
      },
    },
    updateSubmitBegin: (value: boolean) => submitFlags.push(value),
  };
  actions.submitFormDataAction(dispatch, submitContext);
  assert.ok(saved);
  assert.equal(saved?.data[0].value, 'new');
  assert.deepEqual(submitFlags, [true, false]);
  saved?.handleRuleError(['row:rule:field']);
  assert.equal(state.errorItems[0].errorMessage, 'backend');
  state.errorItems = [];
  state.loadingItems = { pending: true };
  saved = undefined;
  actions.submitFormDataAction(dispatch, submitContext);
  assert.equal(saved, undefined);
  assert.equal(submitFlags.at(-1), true, 'A pending async value retains the submit-begin flag for retry');
  state.loadingItems = {};
  uniqueReply = { isSuccess: false, data: { rowId: 'other' } };
  actions.checkControlUniqueAction(dispatch, {
    props: { worksheetId: 'sheet', onError: () => callbacks++ },
    getState: () => state,
    controlId: 'field',
    controlType: 2,
    controlValue: 'new',
  });
  assert.equal(state.loadingItems.field, true);
  await settle();
  assert.equal(state.loadingItems.field, false);
  assert.equal(state.uniqueErrorItems[0].errorType, 'UNIQUE');
  if (process.env.FORM_STORE_NORMAL_ONLY !== '1') {
    uniqueFailure = true;
    const errorsBefore = state.uniqueErrorItems.length;
    actions.checkControlUniqueAction(dispatch, {
      props: { worksheetId: 'sheet', onError: () => callbacks++ },
      getState: () => state,
      controlId: 'field',
      controlType: 2,
      controlValue: 'new',
    });
    await settle();
    assert.equal(state.loadingItems.field, false, 'A network failure must release the real loading flag');
    assert.equal(
      state.uniqueErrorItems.length,
      errorsBefore,
      'A failed request must not publish a successful unique result',
    );
    const uniqueBefore = calls.length;
    actions.checkControlUniqueAction(dispatch, { props: {}, getState: () => state, controlValue: 'missing' });
    assert.equal(calls.length, uniqueBefore, 'Missing control ID cannot issue a uniqueness request');
  }
  actions.triggerCustomEventAction(dispatch, {
    ...context(),
    params: { triggerType: '1' },
    updateRenderData: () => {},
    handleChange: () => {},
  });
  assert.equal(state.loadingItems.event, false);
  console.log('real form store reducer/actions/DataFormat member contracts passed');
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

// Validate the actual custom-event entry against stored string trigger IDs and malformed wire config.
const customProtocol = require('../core/customEventTypes.ts');
const eventAst = parser.parse(
  transformFileSync(path.join(__dirname, '../core/customEvent.tsx'), { plugins: [] }).code,
  { sourceType: 'module' },
);
const eventDeclaration = eventAst.program.body.find(
  (node: { type: string; declaration?: { type: string; declarations?: { id?: { name?: string } }[] } }) =>
    node.type === 'ExportNamedDeclaration' &&
    node.declaration?.type === 'VariableDeclaration' &&
    node.declaration.declarations?.[0]?.id?.name === 'dealCustomEvent',
).declaration;
const eventModule: { exports: { dealCustomEvent?: (props: Record<string, unknown>) => void } } = { exports: {} };
new Function(
  'module',
  'exports',
  '_',
  'window',
  'safeParse',
  'decodeCustomEventEntries',
  'ADD_EVENT_ENUM',
  'checkFiltersAvailable',
  'triggerCustomActions',
  'setTimeout',
  'clearTimeout',
  generate(eventDeclaration).code + '\nexports.dealCustomEvent=dealCustomEvent;',
)(
  eventModule,
  eventModule.exports,
  lodash,
  { shareState: {} },
  (value: string) => JSON.parse(value || '[]'),
  customProtocol.decodeCustomEventEntries,
  { HIDE: '3', BLUR: '5', CHANGE: '1' },
  async () => true,
  async () => 1,
  (fn: () => void) => {
    queueMicrotask(fn);
    return 1;
  },
  () => {},
);
async function checkEventEntry(): Promise<void> {
  const loading: Record<string, boolean>[] = [];
  eventModule.exports.dealCustomEvent?.({
    triggerType: '1',
    advancedSetting: { custom_event: '[{"eventType":"1","eventId":"event","eventActions":[{"actions":[{}]}]}]' },
    checkEventComplete: (value: Record<string, boolean>) => loading.push(value),
  });
  await settle();
  assert.deepEqual(loading, [{ event: true }, { event: false }]);
  loading.length = 0;
  eventModule.exports.dealCustomEvent?.({
    triggerType: '1',
    advancedSetting: { custom_event: '[null,{"eventType":1},{"eventType":"1","eventActions":{}}]' },
    checkEventComplete: (value: Record<string, boolean>) => loading.push(value),
  });
  await settle();
  assert.deepEqual(loading, [], 'Malformed event groups cannot publish a falsely completed event');
  console.log('actual custom-event wire protocol passed');
}
void checkEventEntry().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
