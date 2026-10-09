const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
interface WidgetUser {
  accountId?: string;
  avatar?: string;
  fullname?: string;
}
interface WidgetDepartment {
  departmentId?: string;
  departmentName?: string;
}
interface WidgetOrgRole {
  organizeId?: string;
  organizeName?: string;
}
interface WidgetLocation {
  address?: string;
  lat?: string | number;
  lng?: string | number;
  name?: string;
}
interface ValueBoundary {
  embedUrlSegment(value: unknown): string;
  isApiMethod(value: unknown): boolean;
  nativeUsers(value: unknown): WidgetUser[];
  nativeDepartments(value: unknown): WidgetDepartment[];
  nativeOrgRoles(value: unknown): WidgetOrgRole[];
  nativeLocation(value: unknown): WidgetLocation | undefined;
  firstNativeRecord(value: unknown): Record<string, unknown> | undefined;
}
interface WidgetUtils {
  openRecordInfo(args: { appId: string; worksheetId: string; recordId: string }): Promise<unknown>;
  openNewRecord(args: { appId: string; worksheetId: string }): Promise<unknown>;
  selectUsers(args?: { projectId?: string; unique?: boolean }): Promise<unknown>;
  selectDepartments(args?: { projectId?: string; unique?: boolean }): Promise<unknown>;
  selectOrgRole(args?: { projectId?: string; unique?: boolean }): Promise<unknown>;
  selectRecord(args?: { projectId?: string; relateSheetId?: string; multiple?: boolean }): Promise<unknown>;
  selectLocation(args?: { distance?: number }): Promise<unknown>;
}
interface NativeRequest {
  type: string;
  sessionId?: string;
  settings: {
    action: string;
    projectId?: string;
    appId?: string;
    worksheetId?: string;
    rowId?: string;
    range?: number;
  };
}
const safeParse = (value: unknown, defaultValue: unknown = {}): unknown => {
  if (typeof value !== 'string') return defaultValue === 'array' ? [] : defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue === 'array' ? [] : defaultValue;
  }
};
function load(file: string, stubs: Record<string, unknown> = {}): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'safeParse', code)(
    moduleLike,
    moduleLike.exports,
    (request: string) => (Object.hasOwn(stubs, request) ? stubs[request] : require(request)),
    safeParse,
  );
  return moduleLike.exports;
}
const boundary = load('./valueBoundary.ts') as ValueBoundary;
for (const value of ['中文 &/?', 0, 1720000000000, true, false])
  assert.equal(boundary.embedUrlSegment(value), String(value));
for (const value of [undefined, null, {}, ['wrong'], () => undefined])
  assert.equal(boundary.embedUrlSegment(value), '');
assert.deepEqual(
  boundary.nativeUsers(
    '[{"account_id":"a1","avatar":"a.png","full_name":"张三"},{"account_id":"a2","fullname":"李四"}]',
  ),
  [
    { accountId: 'a1', avatar: 'a.png', fullname: '张三' },
    { accountId: 'a2', avatar: undefined, fullname: '李四' },
  ],
);
assert.deepEqual(boundary.nativeDepartments('[{"department_id":"d1","department_name":"开发部"}]'), [
  { departmentId: 'd1', departmentName: '开发部' },
]);
assert.deepEqual(boundary.nativeOrgRoles('[{"organizeId":"o1","organizeName":"经理"}]'), [
  { organizeId: 'o1', organizeName: '经理' },
]);
assert.deepEqual(boundary.nativeLocation('{"address":"道路","lat":31.5,"lon":117.5,"title":"门店"}'), {
  address: '道路',
  lat: 31.5,
  lng: 117.5,
  name: '门店',
});
assert.equal(boundary.nativeLocation('[]'), undefined);
assert.equal(boundary.nativeLocation('null'), undefined);
assert.deepEqual(boundary.nativeUsers('[null,1,[],{"account_id":4,"full_name":false}]'), [
  { accountId: undefined, avatar: undefined, fullname: undefined },
]);
assert.deepEqual(boundary.firstNativeRecord('[{"rowid":"r1","complex":{"children":[1]}}]'), {
  rowid: 'r1',
  complex: { children: [1] },
});
assert.equal(boundary.firstNativeRecord('bad-json'), undefined);
const requests: NativeRequest[] = [];
const messages: { action: string; value: unknown }[] = [];
let response: { action?: string; value?: string } = {};
global.window = { isMingDaoApp: true, alert: () => undefined };
const noOpApi = { __esModule: true, default: {} };
const stubs: Record<string, unknown> = {
  './valueBoundary': boundary,
  'ming-ui/functions': {},
  'src/utils/common': {
    browserIsMobile: () => false,
    getDefaultThemeMode: () => 'light',
    emitter: { emit: (_event: string, message: { action: string; value: unknown }) => messages.push(message) },
  },
  'src/utils/control': {},
  'src/utils/project': {
    mdAppResponse: (request: NativeRequest) => {
      requests.push(request);
      return Promise.resolve(response);
    },
    addBehaviorLog: () => undefined,
  },
  './selectLocation': {},
  'mobile/components/RecordCardListDialog': {},
  'mobile/components/SelectOrgRole': {},
  'mobile/components/SelectUser': {},
  'mobile/Record/addRecord': {},
  'worksheet/common/ExportSheet': {},
  'worksheet/common/newRecord/addRecord': {},
  'worksheet/common/recordInfo': {},
  'worksheet/common/WorksheetBody/ImportDataFromExcel': {},
  'src/components/previewAttachments/previewAttachments': {},
  'src/components/SelectRecords': {},
  'src/pages/Mobile/Record': {},
};
for (const name of [
  'actionLog',
  'appManagement',
  'attachment',
  'fixedData',
  'homeApp',
  'plugin',
  'qiniu',
  'user',
  'worksheet',
])
  stubs['src/api/' + name] = noOpApi;
for (const name of ['delegation', 'instance', 'instanceVersion', 'process', 'processVersion'])
  stubs['src/pages/workflow/api/' + name] = noOpApi;
const { utils } = load('./widgetFunctions.ts', stubs) as { utils: WidgetUtils };
interface BridgeEvent {
  data: {
    from: string;
    action: string;
    containerId: string;
    args: { controller: string; action: string; data?: unknown };
  };
  ports: { postMessage(value: unknown): void }[];
}
const posted: unknown[] = [];
const apiRequests: Array<Record<string, unknown> | undefined> = [];
const { default: WidgetBridge } = load('./bridge.ts', {
  './valueBoundary': boundary,
  './widgetFunctions': {
    api: {},
    utils: {},
    mainWebApi: {
      worksheet: {
        getRows: (args: Record<string, unknown> | undefined) => {
          apiRequests.push(args);
          return Promise.resolve({ data: ['result'] });
        },
        notCallable: {},
      },
    },
  },
}) as {
  default: new (options: { cache: object; containerId: string }) => {
    handleWidgetContainerMessage(event: BridgeEvent): Promise<void>;
  };
};
const bridge = new WidgetBridge({ cache: { current: {} }, containerId: 'widget-1' });
function bridgeEvent(data: unknown, action = 'GetRows', containerId = 'widget-1'): BridgeEvent {
  return {
    data: {
      from: 'customwidget',
      action: 'call-main-web',
      containerId,
      args: { controller: 'Worksheet', action, data },
    },
    ports: [{ postMessage: value => posted.push(value) }],
  };
}
assert.equal(
  boundary.isApiMethod(() => undefined),
  true,
);
assert.equal(boundary.isApiMethod({}), false);
async function run(): Promise<void> {
  const requestBag = { worksheetId: 'sheet', pageIndex: 2 };
  await bridge.handleWidgetContainerMessage(bridgeEvent(requestBag));
  assert.equal(apiRequests[0], requestBag);
  assert.deepEqual(posted[0], { result: { data: ['result'] } });
  await bridge.handleWidgetContainerMessage(bridgeEvent('invalid-scalar'));
  assert.equal(apiRequests.length, 1);
  assert.ok((posted[1] as { error: unknown }).error instanceof TypeError);
  await bridge.handleWidgetContainerMessage(bridgeEvent(requestBag, 'GetRows', 'other-widget'));
  await bridge.handleWidgetContainerMessage(bridgeEvent(requestBag, 'NotCallable'));
  assert.equal(apiRequests.length, 1);

  response = { action: 'row', value: '[{"rowid":"r1"}]' };
  assert.deepEqual(await utils.openRecordInfo({ appId: 'app', worksheetId: 'sheet', recordId: 'r1' }), {
    action: 'update',
    value: { rowid: 'r1' },
  });
  assert.equal(requests.at(-1)?.settings.rowId, 'r1');
  response = { action: 'addRow', value: '[{"rowid":"r2"}]' };
  assert.deepEqual(await utils.openNewRecord({ appId: 'app', worksheetId: 'sheet' }), { rowid: 'r2' });
  response = { action: 'selectUsers', value: '[{"account_id":"a1","full_name":"用户"}]' };
  assert.deepEqual(await utils.selectUsers({ projectId: 'project', unique: true }), [
    { accountId: 'a1', avatar: undefined, fullname: '用户' },
  ]);
  assert.equal(messages.at(-1)?.action, 'select-users');
  response = { action: 'selectDepartments', value: '[{"department_id":"d1","department_name":"部门"}]' };
  assert.deepEqual(await utils.selectDepartments(), [{ departmentId: 'd1', departmentName: '部门' }]);
  response = { action: 'selectOrgRole', value: '[{"organizeId":"o1","organizeName":"角色"}]' };
  assert.deepEqual(await utils.selectOrgRole(), [{ organizeId: 'o1', organizeName: '角色' }]);
  response = { action: 'selectRecord', value: '[{"rowid":"r3"}]' };
  assert.deepEqual(await utils.selectRecord({ relateSheetId: 'sheet', multiple: true }), [{ rowid: 'r3' }]);
  response = { action: 'map', value: '{"address":"道路","lat":1,"lon":2,"title":"门店"}' };
  assert.deepEqual(await utils.selectLocation({ distance: 100 }), { address: '道路', lat: 1, lng: 2, name: '门店' });
  assert.equal(requests.at(-1)?.type, 'map');
  assert.equal(requests.at(-1)?.settings.range, 100);
  response = { action: 'close' };
  assert.deepEqual(await utils.selectUsers(), []);
  assert.equal(await utils.selectRecord(), undefined);
  assert.equal(await utils.selectLocation(), undefined);
  response = { action: 'unrelated', value: 'bad' };
  assert.equal(await utils.openNewRecord({ appId: 'app', worksheetId: 'sheet' }), undefined);
  console.log(
    'Widget actual native requests, finite payload decoding, emit values, closes and URL scalar segments passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
