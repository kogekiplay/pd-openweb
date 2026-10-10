import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');

interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}
function invoke(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture callback');
  return Reflect.apply(fn, value, args);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid fixture array');
  return value;
}
function walk(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  const item: Tree = { type: value['type'], props: value['props'] };
  return [item, ...walk(item.props['children'])];
}
const requests: Array<{
  method: string;
  args: Record<string, unknown>;
  aborted: number;
  request: Promise<unknown> & { abort(): void };
  resolve(value: unknown): void;
  reject(value: unknown): void;
}> = [];
function api(method: string, args: Record<string, unknown>) {
  let resolve: (value: unknown) => void = () => {},
    reject: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const item = {
    method,
    args,
    aborted: 0,
    request: Object.assign(promise, {
      abort() {
        item.aborted++;
        reject(new Error('cancelled'));
      },
    }),
    resolve,
    reject,
  };
  requests.push(item);
  return item.request;
}
function request(method: string) {
  const item = [...requests].reverse().find(item => item.method === method);
  assert.ok(item, method);
  return item;
}
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  updates = 0;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(value: unknown, callback?: () => void) {
    const patch = typeof value === 'function' ? Reflect.apply(value, this, [this.state, this.props]) : value;
    if (!object(patch)) throw new TypeError('Invalid fixture state');
    Object.assign(this.state, patch);
    this.updates++;
    callback?.();
  }
}
interface HookEffect {
  deps: unknown[];
  cleanup?: (() => void) | undefined;
}
class Hooks {
  values: unknown[] = [];
  cursor = 0;
  effects = new Map<number, HookEffect>();
  pending: Array<() => void> = [];
  dirty = false;
  tree: unknown;
  lateUpdates = 0;
  alive = true;
  readonly component: (props: Record<string, unknown>) => unknown;
  readonly props: Record<string, unknown>;
  constructor(component: (props: Record<string, unknown>) => unknown, props: Record<string, unknown> = {}) {
    this.component = component;
    this.props = props;
  }
  render() {
    current = this;
    this.cursor = 0;
    this.dirty = false;
    this.tree = this.component(this.props);
    this.pending.splice(0).forEach(fn => fn());
    return this.tree;
  }
  flush() {
    for (let i = 0; this.dirty; i++) {
      assert.ok(i < 20);
      this.render();
    }
    return this.tree;
  }
  unmount() {
    this.effects.forEach(item => item.cleanup?.());
    this.alive = false;
  }
  remount() {
    this.effects.clear();
    this.alive = true;
    return this.render();
  }
}
let current: Hooks;
const jsx = (type: unknown, props: Record<string, unknown>): Tree => ({ type, props });
const react = {
  Component,
  Fragment: 'Fragment',
  createRef: () => ({ current: null }),
  memo: (value: unknown) => value,
  useCallback: (value: unknown, deps: unknown[]) => {
    const host = current,
      index = host.cursor++,
      old = host.values[index];
    const oldDeps = object(old) ? old['deps'] : undefined;
    if (object(old) && Array.isArray(oldDeps) && deps.every((value, i) => value === oldDeps[i])) return old['value'];
    host.values[index] = { value, deps };
    return value;
  },
  useMemo: (fn: () => unknown) => fn(),
  useRef: (value: unknown) => {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = { current: value };
    return host.values[index];
  },
  useState: (initial: unknown) => {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = initial;
    return [
      host.values[index],
      (value: unknown) => {
        if (!host.alive) {
          host.lateUpdates++;
          return;
        }
        host.values[index] = value;
        host.dirty = true;
      },
    ];
  },
  useEffect: (fn: () => unknown, deps: unknown[]) => {
    const host = current,
      index = host.cursor++,
      old = host.effects.get(index);
    if (old && deps.every((value, i) => value === old.deps[i])) return;
    host.pending.push(() => {
      old?.cleanup?.();
      const cleanup = fn();
      host.effects.set(index, {
        deps,
        cleanup: typeof cleanup === 'function' ? () => Reflect.apply(cleanup, undefined, []) : undefined,
      });
    });
  },
};
const sessions = new Map<string, string>();
const alerts: unknown[][] = [];
const preallCalls: unknown[][] = [];
const copyCalls: unknown[][] = [];
const faviconCalls: unknown[][] = [];
const globals = {
  window: {
    location: { pathname: '/worksheetapi/app', reload() {} },
    platformENV: { isOverseas: false, isLocal: false },
    getCurrentLang: () => 'zh-Hans',
    clientId: undefined,
  },
  location: { pathname: '/worksheetapi/app' },
  md: {
    global: {
      Config: { DisableModules: [], EnableDataPipeline: true, OpenApiDocUrl: 'url', MCPUrl: 'https://mcp' },
      SysSettings: {},
      Account: {},
    },
  },
  document: { getElementById: () => ({}), documentElement: { getAttribute: () => null }, title: '' },
  sessionStorage: {
    getItem: (key: string) => sessions.get(key) ?? null,
    setItem: (key: string, value: string) => sessions.set(key, value),
  },
  _l: (value: string) => value,
  __api_server__: { main: 'api/' },
  getCurrentLangCode: () => 'zh-Hans',
  alert: (...args: unknown[]) => alerts.push(args),
  $: (value: unknown) => ({ 0: undefined, map: () => {}, attr: () => undefined, height: () => undefined }),
};
Object.assign(globalThis, globals);
const cache = new Map<string, unknown>();
function load(relative: string): unknown {
  const file = path.resolve(__dirname, relative);
  if (cache.has(file)) return cache.get(file);
  const module: { exports: unknown } = { exports: {} };
  const result = harness.transformFileSync(file);
  assert.ok(result && typeof result.code === 'string');
  new Function('module', 'exports', 'require', result.code)(module, module.exports, (name: string): unknown => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-dom/client') return { createRoot: () => ({ render() {} }) };
    if (['lodash', 'classnames', '@ant-design/colors'].includes(name)) return require(name);
    if (name === 'antd')
      return {
        Empty: Object.assign('Empty', { PRESENTED_IMAGE_SIMPLE: 'simple' }),
        Select: Object.assign(() => null, { Option: 'SelectOption' }),
      };
    if (name === '@mingdaocom/json-view') return { __esModule: true, default: 'JsonView' };
    if (name === 'styled-components')
      return { __esModule: true, default: { header: () => 'HeaderWrap', div: () => 'Wrapper' } };
    if (name === 'worksheet/common/WorkSheetFilter/common/FilterConfig')
      return { __esModule: true, default: 'FilterConfig' };
    if (name === 'ming-ui')
      return Object.fromEntries(
        ['Avatar', 'Dialog', 'Icon', 'LoadDiv', 'ScrollView', 'Textarea', 'Support', 'SvgIcon'].map(key => [key, key]),
      );
    if (name === 'ming-ui/antd-components') return { Tooltip: 'Tooltip' };
    if (name === 'src/pages/FormSet/components/AliasDialog') return { __esModule: true, default: name };
    if (
      [
        'src/api/appManagement',
        'src/api/homeApp',
        'src/api/worksheet',
        'src/pages/integration/api/syncTask',
        'src/pages/workflow/api/process',
      ].includes(name)
    )
      return {
        __esModule: true,
        default: new Proxy(
          {},
          {
            get:
              (_target, key) =>
              (args: Record<string, unknown> = {}) =>
                api(String(key), args),
          },
        ),
      };
    if (name === 'worksheet/components/ShareState')
      return {
        SHARE_STATE: { 18: 'password', 19: 'wrong' },
        ShareState: 'ShareState',
        VerificationPass: 'VerificationPass',
      };
    if (name === 'src/common/preall')
      return { __esModule: true, default: (...args: unknown[]) => preallCalls.push(args) };
    if (name === 'src/utils/common') return { browserIsMobile: () => false };
    if (name === 'src/utils/app')
      return {
        getTranslateInfo: () => ({}),
        setFavicon: (...args: unknown[]) => faviconCalls.push(args),
        shareGetAppLangDetail: () => Promise.resolve(),
      };
    if (name === 'src/utils/copyToClipboard')
      return { __esModule: true, default: (...args: unknown[]) => copyCalls.push(args) };
    if (name === 'src/pages/workflow/WorkflowSettings/enum') return { FIELD_TYPE_LIST: [{ value: 2, text: 'Text' }] };
    if (name === 'src/pages/worksheet/constants/enum')
      return { VIEW_DISPLAY_TYPE: { sheet: 0, 0: 'sheet' }, VIEW_TYPE_ICON: [{ id: 0, text: 'Grid' }] };
    if (name === 'src/router/navigateTo') return { navigateTo: () => {} };
    if (
      name.startsWith('ming-ui/components/') ||
      name === 'worksheet/components/Share' ||
      name.startsWith('src/components/')
    )
      return { __esModule: true, default: name };
    if (
      name.startsWith('./core/') ||
      name === '../../core/enum' ||
      name === '../../core/utils' ||
      name === './apiV2Config' ||
      name === './applicationConfig' ||
      name === './enum'
    )
      return load(path.relative(__dirname, path.resolve(path.dirname(file), name + '.ts')));
    if (name === './boundary') return load('boundary.ts');
    if (name.endsWith('.less')) return {};
    if (name.startsWith('./components/') || name.startsWith('../')) return { __esModule: true, default: name };
    throw new Error('Unexpected worksheetApi dependency ' + name);
  });
  cache.set(file, module.exports);
  return module.exports;
}
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const apiModule = load('index.tsx');
const boundary = load('boundary.ts');
function create(props: Record<string, unknown> = {}) {
  const constructor = read(apiModule, 'WorksheetApi');
  if (typeof constructor !== 'function') throw new TypeError('Invalid source class');
  const instance: unknown = Reflect.construct(constructor, [props]);
  return instance;
}
function classState(instance: unknown) {
  return read(instance, 'state');
}
const options = { requestParams: [{ name: 'optionSetId', isRequired: true, dataType: 'string', description: 'ID' }] };
const worksheetRows = [{ workSheetId: 'sheet', workSheetName: 'Sheet', opaque: { retained: true } }];
const documents = [
  {
    worksheetId: 'sheet',
    name: 'Sheet',
    apiUrl: 'api/',
    appKey: 'key',
    sign: 'sign',
    controls: [{ controlId: 'ownerid', controlName: 'Owner', type: '成员', isSupport: true, value: 'account' }],
    views: [{ viewId: 'view', name: 'View', type: 0 }],
  },
];
const appInfo = {
  apiUrl: 'api/',
  apiRequest: { appKey: 'key', sign: 'sign' },
  apiResponse: { appId: 'app', projectId: 'project', sections: [{ name: 'Main', sectionId: 'section', items: [] }] },
};
const app = { id: 'app', name: 'App', projectId: 'project', iconColor: '#123456', iconUrl: 'icon', navColor: '#fff' };
const authorizes = [{ appKey: 'key', sign: 'sign', name: 'Key', opaque: { same: true } }];
function resolveApp(overrides: Record<string, unknown> = {}) {
  for (const [method, value] of Object.entries({
    getWorksheetsByAppId: worksheetRows,
    getApiInfo: appInfo,
    addOrUpdateOptionSetApiInfo: options,
    optionSetListApiInfo: options,
    getProcessListApi: [],
    getApp: app,
    getAuthorizes: authorizes,
    ...overrides,
  }))
    request(method).resolve(value);
}
async function run() {
  const enums = load('core/enum.ts');
  const menus = read(enums, 'MENU_LIST_MAP');
  assert.ok(object(menus));
  for (const source of Object.values(menus)) assert.equal(invoke(boundary, 'apiMenuItems', [source]), source);
  const sidebars = read(enums, 'SIDEBAR_LIST_MAP');
  assert.ok(object(sidebars));
  for (const source of Object.values(sidebars)) assert.equal(invoke(boundary, 'apiSidebarItems', [source]), source);
  for (const [method, value] of Object.entries({
    apiSideItems: worksheetRows,
    apiAppInfo: app,
    apiAuthorizes: authorizes,
    apiDocuments: documents,
    apiOptions: options,
    apiWorkflow: { inputs: [], outputs: [] },
  }))
    assert.equal(invoke(boundary, method, [value]), value);
  const filterComponent = read(load('components/FiltersGenerate/index.tsx'), 'default');
  if (typeof filterComponent !== 'function') throw new TypeError('Missing real filter component');
  const filterColumns = [{ controlId: 'score', type: 28, dot: 2 }];
  const filterPermits = [{ type: 2, state: true, viewIds: [] }];
  const filterHost = new Hooks(props => Reflect.apply(filterComponent, undefined, [props]), {
    controls: filterColumns,
    sheetSwitchPermit: filterPermits,
    projectId: 'project',
    appId: 'app',
  });
  filterHost.render();
  const filterButton = walk(filterHost.tree).find(item => item.props['className'] === 'filterBtn Hand textSecondary');
  assert.ok(filterButton);
  invoke(filterButton.props, 'onClick');
  filterHost.flush();
  const filterConfig = walk(filterHost.tree).find(item => item.type === 'FilterConfig');
  assert.ok(filterConfig);
  assert.equal(filterConfig.props['columns'], filterColumns);
  assert.equal(filterConfig.props['sheetSwitchPermit'], filterPermits);
  assert.equal(filterConfig.props['projectId'], 'project');
  assert.equal(filterConfig.props['appId'], 'app');
  filterHost.unmount();
  const empty: unknown[] = [];
  assert.equal(invoke(boundary, 'apiOptions', [empty]), empty);
  const templateControls = [
    {
      controlId: 'c',
      type: 30,
      sourceControlType: 9,
      enumDefault: 1,
      dot: 2,
      row: 0,
      col: 0,
      controlPermissions: '111',
      advancedSetting: { showtype: '3' },
      showControls: ['title'],
      sourceControl: { options: [{ key: 'one', value: 'One', score: 1 }] },
      opaque: { retain: true },
    },
  ];
  const metadata = {
    alias: 'sheet_alias',
    template: { controls: templateControls },
    switches: [{ type: 2, state: true, viewIds: [] }],
  };
  assert.equal(invoke(boundary, 'apiWorksheetMetadata', [metadata]), metadata);
  assert.equal(
    read(read(invoke(boundary, 'apiWorksheetMetadata', [metadata]), 'template'), 'controls'),
    templateControls,
  );
  for (const bad of [
    null,
    { controlId: 3 },
    { type: '9' },
    { sourceControlType: '9' },
    { dot: '2' },
    { options: [{ key: 'one', score: '1' }] },
    { advancedSetting: { showtype: 3 } },
    { sourceControl: { type: '9' } },
    { row: false },
    { showControls: [3] },
  ]) {
    assert.throws(() => invoke(boundary, 'apiTemplateControls', [[bad]]), TypeError);
  }
  assert.throws(() => invoke(boundary, 'apiWorksheetMetadata', [{ template: { controls: Array(1) } }]), TypeError);
  assert.throws(
    () => invoke(boundary, 'apiWorksheetMetadata', [{ switches: [{ type: 2, state: 'true' }] }]),
    TypeError,
  );
  const menu = [
    {
      id: 'empty-class',
      title: 'Title',
      fields: [{ key: 'name', text: '', className: '' }],
      data: [{ name: 'field', desc: 'description', type: 'string' }],
    },
  ];
  assert.equal(invoke(boundary, 'apiMenuItems', [menu]), menu);
  for (const [method, bad] of [
    ['apiFields', [{ controlId: 2 }]],
    ['apiFields', Array(1)],
    ['apiFields', [{ isRequired: 'true' }]],
    ['apiFields', [{ desc: [{ name: 3 }] }]],
    ['apiMenuItems', [{ title: 'missing id' }]],
    ['apiMenuItems', [{ id: 'a', title: 'A', fields: [{ key: 'name', text: 3, className: '' }] }]],
    ['apiAppInfo', { apiRequest: { sign: 3 } }],
    ['apiAppInfo', { apiResponse: { sections: [{ items: {} }] } }],
    ['apiAuthorizes', [{ appKey: 'key', sign: 3 }]],
    ['apiWorkflow', { inputs: [{ type: {} }] }],
    ['apiShare', { resultCode: 1, data: { projectId: 'project' } }],
    ['apiShare', { resultCode: 18, data: { clientId: 3 } }],
  ])
    assert.throws(() => invoke(boundary, String(method), [bad]), TypeError);
  const cycle: { name: string; items: unknown[] } = { name: 'cycle', items: [] };
  cycle.items.push(cycle);
  assert.throws(() => invoke(boundary, 'apiDocuments', [[cycle]]), TypeError);
  assert.deepEqual(invoke(boundary, 'viewDescriptions', [[{ viewId: 'none' }]]), [{ undefined: 'none' }]);
  assert.deepEqual(invoke(boundary, 'cachedPosition', ['{bad']), {});
  assert.deepEqual(invoke(boundary, 'cachedPosition', ['{"expandIds":[null,"id"]}']), { expandIds: [null, 'id'] });

  const instance = create();
  const initial = JSON.parse(JSON.stringify(classState(instance)));
  assert.deepEqual(read(initial, 'dataApp'), {});
  assert.deepEqual(read(initial, 'appInfo'), {});
  assert.deepEqual(read(initial, 'workflowInfo'), {});
  assert.deepEqual(read(initial, 'addOptionsParams'), []);
  const loading = invoke(instance, 'getAppInfo');
  resolveApp();
  await tick();
  request('getWorksheetApiInfo').resolve(documents);
  request('getWorksheetInfo').resolve({ template: { controls: [] }, switches: [] });
  await loading;
  assert.equal(read(classState(instance), 'worksheetList'), worksheetRows);
  assert.equal(read(classState(instance), 'data'), documents);
  assert.equal(read(classState(instance), 'dataApp'), app);
  assert.equal(read(classState(instance), 'authorizes'), authorizes);
  assert.equal(read(classState(instance), 'addOptionsParams'), options);
  assert.equal(read(classState(instance), 'loading'), false);
  assert.equal(read(options.requestParams[0], 'type'), 'string');
  assert.equal(read(options.requestParams[0], 'required'), '是');
  const dataBefore = read(classState(instance), 'data');
  const badLoad = invoke(instance, 'getWorksheetApiInfo', ['sheet']);
  request('getWorksheetApiInfo').resolve([{}]);
  request('getWorksheetInfo').resolve({});
  await badLoad;
  assert.equal(read(classState(instance), 'data'), dataBefore, 'A malformed document cannot become empty success');
  assert.equal(read(classState(instance), 'loading'), false);
  assert.equal(typeof read(classState(instance), 'loadError'), 'string');
  const retry = walk(invoke(instance, 'render')).find(item => item.type === 'button');
  assert.ok(retry);
  invoke(retry.props, 'onClick');
  request('getWorksheetApiInfo').resolve(documents);
  request('getWorksheetInfo').resolve({});
  await tick();
  assert.equal(read(classState(instance), 'loadError'), undefined);
  const authorizationFailure = invoke(instance, 'getAuthorizes');
  request('getAuthorizes').reject(new Error('authorization offline'));
  await authorizationFailure;
  assert.equal(typeof read(classState(instance), 'loadError'), 'string');
  const authorizationRetry = walk(invoke(instance, 'render')).find(item => item.type === 'button');
  assert.ok(authorizationRetry);
  invoke(authorizationRetry.props, 'onClick');
  request('getAuthorizes').resolve(authorizes);
  await tick();
  assert.equal(read(classState(instance), 'loadError'), undefined);
  assert.equal(read(classState(instance), 'authorizes'), authorizes);
  const old = invoke(instance, 'getWorksheetApiInfo', ['old']);
  const oldDoc = request('getWorksheetApiInfo'),
    oldInfo = request('getWorksheetInfo');
  const recent = invoke(instance, 'getWorksheetApiInfo', ['recent']);
  request('getWorksheetApiInfo').resolve([{ ...documents[0], worksheetId: 'recent' }]);
  request('getWorksheetInfo').resolve({});
  await recent;
  oldDoc.resolve(documents);
  oldInfo.resolve({});
  await old;
  assert.equal(read(array(read(classState(instance), 'data'))[0], 'worksheetId'), 'recent');
  const pipeline = invoke(instance, 'getDataPipelineWorksheet');
  request('list').reject(new Error('pipeline offline'));
  await pipeline;
  assert.equal(read(classState(instance), 'dataPipelineLoading'), false);
  const workflow = invoke(instance, 'getWorkflowApiInfo', ['process']);
  request('getProcessApiInfo').reject(new Error('workflow offline'));
  await workflow;
  assert.equal(read(classState(instance), 'loading'), false);
  const beforeMalformed = read(classState(instance), 'data');
  const malformed = invoke(instance, 'getWorksheetApiInfo', ['sheet']);
  request('getWorksheetApiInfo').resolve(documents);
  request('getWorksheetInfo').resolve({ template: { controls: [{ type: 'fake-number' }] } });
  await malformed;
  assert.equal(read(classState(instance), 'data'), beforeMalformed);
  assert.equal(typeof read(classState(instance), 'loadError'), 'string');
  const authOld = invoke(instance, 'getAuthorizes');
  const authOldRequest = request('getAuthorizes');
  const authNew = invoke(instance, 'getAuthorizes');
  const latestAuthorize = [{ appKey: 'latest', sign: 'latest' }];
  request('getAuthorizes').resolve(latestAuthorize);
  await authNew;
  authOldRequest.resolve(authorizes);
  await authOld;
  assert.equal(read(classState(instance), 'authorizes'), latestAuthorize);
  const authRejectOld = invoke(instance, 'getAuthorizes');
  const staleReject = request('getAuthorizes');
  const authCurrent = invoke(instance, 'getAuthorizes');
  request('getAuthorizes').resolve(authorizes);
  await authCurrent;
  invoke(instance, 'setState', [{ loadError: undefined }]);
  staleReject.reject(new Error('old authorize error'));
  await authRejectOld;
  assert.equal(read(classState(instance), 'loadError'), undefined);
  const pipelineOld = invoke(instance, 'getDataPipelineWorksheet');
  const pipelineOldRequest = request('list');
  const pipelineNew = invoke(instance, 'getDataPipelineWorksheet');
  const pipelineLatest = [{ worksheetId: 'new-pipeline' }];
  request('list').resolve({ content: pipelineLatest });
  await pipelineNew;
  pipelineOldRequest.resolve({ content: [{ worksheetId: 'old-pipeline' }] });
  await pipelineOld;
  assert.equal(read(classState(instance), 'dataPipelineList'), pipelineLatest);
  const pipelineReject = invoke(instance, 'getDataPipelineWorksheet');
  const pipelineRejectRequest = request('list');
  const pipelineCurrent = invoke(instance, 'getDataPipelineWorksheet');
  request('list').resolve({ content: pipelineLatest });
  await pipelineCurrent;
  pipelineRejectRequest.reject(new Error('old pipeline error'));
  await pipelineReject;
  assert.equal(read(classState(instance), 'loadError'), undefined);
  const beforeUnmount = read(instance, 'updates');
  const late = invoke(instance, 'getWorkflowApiInfo', ['later']);
  const pending = request('getProcessApiInfo');
  invoke(instance, 'componentWillUnmount');
  await late;
  assert.equal(pending.aborted, 1);
  assert.equal(read(instance, 'updates'), beforeUnmount);

  const remount = create();
  const staleAuth = invoke(remount, 'getAuthorizes');
  const authBeforeRemount = request('getAuthorizes');
  const stalePipeline = invoke(remount, 'getDataPipelineWorksheet');
  const pipelineBeforeRemount = request('list');
  invoke(remount, 'componentWillUnmount');
  invoke(remount, 'componentDidMount');
  resolveApp({ getWorksheetsByAppId: [] });
  await tick();
  await staleAuth;
  await stalePipeline;
  assert.equal(authBeforeRemount.aborted, 1);
  assert.equal(pipelineBeforeRemount.aborted, 1);
  assert.equal(
    read(classState(remount), 'loadError'),
    undefined,
    'Pre-remount rejections cannot overwrite the new initialization',
  );
  invoke(remount, 'componentWillUnmount');

  const queued = create();
  assert.ok(object(queued));
  const originalSetter = read(queued, 'setState');
  assert.equal(typeof originalSetter, 'function');
  const stateCallbacks: Array<() => void> = [];
  Reflect.set(queued, 'setState', (patch: unknown, callback?: () => void) => {
    if (typeof originalSetter !== 'function') throw new TypeError('Missing fixture setter');
    Reflect.apply(originalSetter, queued, [patch]);
    if (callback) stateCallbacks.push(callback);
  });
  const queuedOld = invoke(queued, 'getAppInfo');
  resolveApp();
  await tick();
  const queuedNew = invoke(queued, 'getAppInfo');
  resolveApp();
  await tick();
  assert.equal(stateCallbacks.length, 2);
  const beforeOldCallback = requests.filter(item => item.method === 'getWorksheetApiInfo').length;
  stateCallbacks.shift()?.();
  await queuedOld;
  assert.equal(
    requests.filter(item => item.method === 'getWorksheetApiInfo').length,
    beforeOldCallback,
    'An old committed callback must finish without issuing its old worksheet request',
  );
  stateCallbacks.shift()?.();
  request('getWorksheetApiInfo').resolve(documents);
  request('getWorksheetInfo').resolve({});
  await tick();
  stateCallbacks.splice(0).forEach(callback => callback());
  await queuedNew;
  invoke(queued, 'componentWillUnmount');

  const attach = { controlId: 'attachment', value: 'url' };
  invoke(instance, 'setState', [{ templateControls: [{ controlId: 'attachment', type: 14 }] }]);
  const example = invoke(instance, 'renderMapItem', [attach]);
  assert.equal(read(example, 'controlId'), 'attachment');
  assert.equal(read(example, 'editType'), '数据更新类型，0=覆盖，1=新增（默认0:覆盖，新建记录可不传该参数）');
  const relation = invoke(instance, 'renderMapItem', [
    { controlId: 'relate', relationValue: { rowIds: [], isAdd: false } },
  ]);
  assert.deepEqual(read(relation, 'relationValue'), { rowIds: [], isAdd: false });

  const cancelled = create();
  const all = invoke(cancelled, 'getAppInfo');
  const pendingApp = request('getApp');
  invoke(cancelled, 'componentWillUnmount');
  await all;
  assert.equal(pendingApp.aborted, 1);
  assert.equal(read(classState(cancelled), 'dataApp') && read(read(classState(cancelled), 'dataApp'), 'id'), undefined);
  const languageCancelled = create();
  const languageLoad = invoke(languageCancelled, 'getAppInfo');
  resolveApp({ getApp: { ...app, langInfo: { appLangId: 'language', version: 0 } } });
  await tick();
  const languageRequest = request('getAppLangDetail');
  invoke(languageCancelled, 'componentWillUnmount');
  await languageLoad;
  assert.equal(languageRequest.aborted, 1);
  assert.equal(
    read(classState(languageCancelled), 'dataApp') && read(read(classState(languageCancelled), 'dataApp'), 'id'),
    undefined,
  );
  const entry = read(apiModule, 'Entry');
  if (typeof entry !== 'function') throw new TypeError('Missing real entry');
  globals.location.pathname = '/public/worksheetapi/share';
  const host = new Hooks(props => Reflect.apply(entry, undefined, [props]));
  host.render();
  request('getEntityShareById').resolve({
    resultCode: 18,
    data: { projectId: 'project', appIconColor: '#123456', clientId: 'client' },
  });
  await tick();
  host.flush();
  assert.equal(sessions.get('share'), 'client');
  const verify = walk(host.tree).find(item => item.type === 'VerificationPass');
  assert.ok(verify);
  const rejected = invoke(verify.props, 'validatorPassPromise', ['password', { ticket: 'ticket' }]);
  const rejectAssert = assert.rejects(Promise.resolve(rejected));
  request('getEntityShareById').reject(new Error('offline'));
  await rejectAssert;
  assert.equal(host.lateUpdates, 0);
  const success = invoke(verify.props, 'validatorPassPromise', ['password', { ticket: 'ticket' }]);
  const share = { resultCode: 1, data: { appId: 'app', projectId: 'project', clientId: 'new-client' } };
  request('getEntityShareById').resolve(share);
  assert.equal(await success, share);
  host.flush();
  assert.ok(walk(host.tree).some(item => item.type === read(apiModule, 'WorksheetApi')));
  host.unmount();
  const failed = new Hooks(props => Reflect.apply(entry, undefined, [props]));
  failed.render();
  request('getEntityShareById').reject(new Error('share network'));
  await tick();
  failed.flush();
  assert.ok(walk(failed.tree).some(item => item.props['role'] === 'alert'));
  failed.unmount();
  const closed = new Hooks(props => Reflect.apply(entry, undefined, [props]));
  closed.render();
  const sharePending = request('getEntityShareById');
  closed.unmount();
  await tick();
  assert.equal(sharePending.aborted, 1);
  assert.equal(closed.lateUpdates, 0);
  for (const oldResult of ['success', 'reject']) {
    const remounted = new Hooks(props => Reflect.apply(entry, undefined, [props]));
    remounted.render();
    const oldRequest = request('getEntityShareById');
    oldRequest.request.abort = () => {
      oldRequest.aborted++;
    };
    remounted.unmount();
    remounted.remount();
    const latestRequest = request('getEntityShareById');
    assert.notEqual(latestRequest, oldRequest);
    latestRequest.resolve({ resultCode: 1, data: { appId: 'app', clientId: 'latest-' + oldResult } });
    await tick();
    remounted.flush();
    if (oldResult === 'success')
      oldRequest.resolve({ resultCode: 1, data: { appId: 'old-app', clientId: 'old-client' } });
    else oldRequest.reject(new Error('old failure'));
    await tick();
    remounted.flush();
    assert.equal(read(globals.window, 'clientId'), 'latest-' + oldResult);
    assert.equal(sessions.get('share'), 'latest-' + oldResult);
    assert.ok(walk(remounted.tree).some(item => item.type === read(apiModule, 'WorksheetApi')));
    assert.equal(
      walk(remounted.tree).some(item => item.props['role'] === 'alert'),
      false,
    );
    remounted.unmount();
  }
  const passwordHost = new Hooks(props => Reflect.apply(entry, undefined, [props]));
  passwordHost.render();
  request('getEntityShareById').resolve({ resultCode: 18, data: { clientId: 'password-initial' } });
  await tick();
  passwordHost.flush();
  const passwordVerify = walk(passwordHost.tree).find(item => item.type === 'VerificationPass');
  assert.ok(passwordVerify);
  const oldPassword = invoke(passwordVerify.props, 'validatorPassPromise', ['old-password', {}]);
  const oldPasswordRejected = assert.rejects(Promise.resolve(oldPassword), /cancelled/);
  const oldPasswordRequest = request('getEntityShareById');
  const latestPassword = invoke(passwordVerify.props, 'validatorPassPromise', ['latest-password', {}]);
  request('getEntityShareById').resolve({ resultCode: 1, data: { appId: 'app', clientId: 'latest-password' } });
  await latestPassword;
  oldPasswordRequest.resolve({ resultCode: 1, data: { appId: 'old-app', clientId: 'old-password' } });
  await oldPasswordRejected;
  passwordHost.flush();
  assert.equal(read(globals.window, 'clientId'), 'latest-password');
  assert.equal(sessions.get('share'), 'latest-password');
  passwordHost.unmount();
  console.log(
    'Actual worksheetApi boundaries, identity, request order, error/retry/cancel, callbacks and share Promise completion passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
