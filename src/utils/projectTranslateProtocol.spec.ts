const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
const projectId = '12345678-1234-1234-1234-123456789012';

type TestFunction = (...args: unknown[]) => unknown;
function load(
  file: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): Record<string, TestFunction> {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const code = transformFileSync(path.join(__dirname, file), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (name: string) => {
      if (!(name in imports)) throw new Error('Unstubbed import ' + name);
      return imports[name];
    },
    ...Object.values(globals),
  );
  const result: Record<string, TestFunction> = {};
  for (const [name, value] of Object.entries(module.exports)) {
    if (typeof value === 'function') result[name] = value as TestFunction;
  }
  return result;
}
const projectTypes = load('./projectTypes.ts', {});
const translateTypes = load('./translateTypes.ts', {});
function storage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}
function projectFixture() {
  const local = storage(),
    session = storage(),
    logs: unknown[] = [],
    requests: unknown[] = [];
  const license = {
    projectId,
    companyName: 'Organization',
    licenseType: 1,
    version: { versionIdV2: '2' },
    arbitraryMetadata: { retain: true },
  };
  const md = {
    global: {
      Account: {
        accountId: 'account',
        projects: [license],
        externalProjects: [],
        email: 'u***@example.com',
        mobilePhone: '138****5678',
        timeZone: 480,
      },
      Config: { DefaultTimeZone: 0 },
      Versions: [
        {
          VersionIdV2: '2',
          Products: [
            { ProductType: 1, Type: '1' },
            { ProductType: 2, Type: 2 },
          ],
        },
      ],
      PorjectColor: [
        {
          projectId,
          chartColor: {
            system: [{ id: '0', enable: true }],
            custom: [{ id: 'custom', colors: ['custom-color'], name: 'Custom' }],
          },
          themeColor: { system: [{ color: 'system-color' }], custom: [{ color: 'custom-theme', enable: false }] },
        },
      ] as Array<Record<string, unknown>>,
    },
  };
  const window = {
    shareState: { shareId: '' },
    isPublicApp: false,
    isMacOs: false,
    isMingDaoApp: false,
    MD_APP_RESPONSE: undefined as undefined | ((base64: string) => void),
    btoa: (text: string) => Buffer.from(text, 'binary').toString('base64'),
    atob: (text: string) => Buffer.from(text, 'base64').toString('binary'),
    Android: { MD_APP_REQUEST: (request: string) => requests.push(request) },
    MDJS: {
      last: undefined as unknown,
      chooseImage(params: unknown) {
        this.last = params;
      },
    },
    localStorage: local,
  };
  let network: unknown = { companyName: 'External', licenseType: 2, version: { versionIdV2: '1' } };
  let contact: unknown = { accountId: 'account', mobilePhone: '13812345678', email: 'user@example.com' };
  let contactRequests = 0;
  const imports: Record<string, unknown> = {
    lodash,
    moment,
    './projectTypes': projectTypes,
    'src/api/account': {
      getMyContactInfo: () => {
        contactRequests++;
        return Promise.resolve(contact);
      },
    },
    'src/api/project': {
      getProjectLicenseInfo: (request: unknown) => {
        requests.push(request);
        return network;
      },
    },
    'src/api/actionLog': {
      addLog: (data: unknown) => {
        logs.push(data);
        return Promise.resolve(true);
      },
    },
    'src/pages/Admin/settings/config': {
      SYS_COLOR: [{ color: 'built-in-theme' }],
      SYS_CHART_COLORS: [{ id: '0', name: 'System', colors: ['built-in-chart'], themeColors: ['built-in-theme'] }],
    },
    'src/utils/platform/storage/safe': { setSessionStorageItemSafely: session.setItem },
  };
  const api = load('./project.ts', imports, {
    md,
    window,
    localStorage: local,
    sessionStorage: session,
    safeParse: (value: string, fallback: unknown = {}) => {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    safeLocalStorageSetItem: local.setItem,
  });
  return {
    api,
    md,
    window,
    local,
    session,
    logs,
    requests,
    license,
    setNetwork: (value: unknown) => {
      network = value;
    },
    setContact: (value: unknown) => {
      contact = value;
    },
    contactCount: () => contactRequests,
  };
}
function promise(value: unknown): Promise<unknown> {
  assert.ok(value instanceof Promise);
  return value as Promise<unknown>;
}
async function run() {
  const f = projectFixture(),
    a = f.api;
  assert.strictEqual(a.getCurrentProject(projectId), f.license, 'bootstrap metadata and object identity are retained');
  assert.deepStrictEqual(a.getCurrentProject(undefined), {});
  assert.strictEqual(a.getFeatureStatus(projectId, 1), '1');
  assert.strictEqual(a.getFeatureStatus(projectId, 2), 2, 'numeric deployment status retains its wire type');
  f.window.shareState.shareId = 'shared';
  assert.strictEqual(a.getFeatureStatus(projectId, 1), undefined);
  f.window.shareState.shareId = '';
  assert.deepStrictEqual(a.getSyncLicenseInfo([projectId]), {}, 'query arrays are not organization IDs');
  assert.strictEqual(f.requests.length, 0);
  const external = 'abcdefgh-abcd-abcd-abcd-abcdefghijkl';
  assert.deepStrictEqual(a.getSyncLicenseInfo(external), {
    companyName: 'External',
    licenseType: 2,
    version: { versionIdV2: '1' },
    projectId: external,
  });
  const g = projectFixture();
  g.setNetwork({ licenseType: 'admin' });
  assert.throws(() => g.api.getSyncLicenseInfo(external), /Invalid project/);
  assert.deepStrictEqual(g.md.global.Account.externalProjects, [], 'bad license information is not cached');
  assert.deepStrictEqual(a.getThemeColors(projectId), ['system-color']);
  assert.deepStrictEqual(a.getProjectChartColors(projectId), [
    { id: '0', name: 'System', colors: ['built-in-chart'], themeColors: ['built-in-theme'], enable: true },
    { id: 'custom', colors: ['custom-color'], name: 'Custom' },
  ]);
  const colorFixture = projectFixture();
  colorFixture.md.global.PorjectColor = [{ projectId }];
  const colors = colorFixture.api.getProjectColor(projectId);
  assert.deepStrictEqual(colors, {
    projectId,
    chartColor: { system: [{ id: '0', name: 'System', colors: ['built-in-chart'], themeColors: ['built-in-theme'] }] },
    themeColor: { system: [{ color: 'built-in-theme' }] },
  });
  assert.throws(
    () => projectTypes.decodeProjectColors([{ chartColor: { custom: [{ colors: [123] }] }, themeColor: {} }]),
    /Invalid project color/,
  );
  const input = '2025-01-01 10:00:00';
  assert.strictEqual(a.dateConvertToUserZone(input), '2025-01-01 18:00:00');
  assert.strictEqual(a.dateConvertToServerZone(input), '2025-01-01 02:00:00');
  assert.strictEqual(a.dateAppZoneToServerZone(input, 0), input, 'zero-zone legacy behavior is preserved');
  assert.strictEqual(a.dateServerZoneToAppZone(input, 60), '2025-01-01 11:00:00');
  const first = a.prefetchContactInfo(),
    second = a.prefetchContactInfo();
  assert.strictEqual(first, second, 'concurrent contact lookups share one request');
  await promise(first);
  assert.strictEqual(f.contactCount(), 1);
  assert.strictEqual(a.getContactInfo('mobilePhone'), '13812345678');
  assert.strictEqual(f.contactCount(), 1, 'masked account cache remains fresh');
  f.local.setItem('contactInfo', JSON.stringify({ accountId: 'other', email: 'previous@example.com' }));
  assert.strictEqual(
    a.getContactInfo('email'),
    'previous@example.com',
    'stale cache keeps the existing synchronous return while refreshing',
  );
  await promise(a.prefetchContactInfo());
  f.local.setItem('contactInfo', '{bad json');
  assert.strictEqual(a.getContactInfo('email'), '');
  await promise(a.prefetchContactInfo());
  f.local.removeItem('contactInfo');
  f.setContact({ accountId: 'account', email: { invalid: true } });
  assert.deepStrictEqual(await promise(a.prefetchContactInfo()), {});
  assert.strictEqual(f.local.getItem('contactInfo'), null, 'invalid contact payload is not cached');
  let native = 0,
    h5 = 0;
  f.window.isMingDaoApp = true;
  a.compatibleMDJS(
    'chooseImage',
    { size: 2 },
    () => h5++,
    () => native++,
  );
  assert.deepStrictEqual(f.window.MDJS.last, { size: 2 }, 'native method retains its SDK receiver');
  assert.deepStrictEqual([native, h5], [1, 0]);
  a.compatibleMDJS('missing', {}, () => h5++);
  assert.deepStrictEqual([native, h5], [1, 1]);
  const scan = promise(a.mdAppResponse({ type: 'scan' }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ value: 'decoded', metadata: 'kept' })));
  assert.deepStrictEqual(await scan, { value: 'decoded', metadata: 'kept' });
  for (const action of ['row', 'addRow', 'selectUsers', 'selectDepartments', 'selectOrgRole', 'selectRecord']) {
    const request = {
      type: 'native',
      sessionId: 'interactive',
      settings: {
        action,
        projectId,
        appId: 'app',
        worksheetId: 'sheet',
        viewId: 'view',
        rowId: 'row',
        unique: true,
        multiple: false,
      },
    };
    const response = promise(a.mdAppResponse(request));
    f.window.MD_APP_RESPONSE!(
      f.window.btoa(JSON.stringify({ action, value: '[{"rowid":"row"}]', metadata: 'retained' })),
    );
    assert.deepStrictEqual(await response, { action, value: '[{"rowid":"row"}]', metadata: 'retained' });
    assert.deepStrictEqual(
      JSON.parse(f.window.atob(String(f.requests[f.requests.length - 1]))),
      request,
      'native wire parameters are not normalized or dropped',
    );
  }
  const notificationRequest = {
    type: 'native',
    sessionId: 'register',
    settings: { action: 'enterpriseRegister.addSuccess', account: 'account', password: 'password' },
  };
  const notification = promise(a.mdAppResponse(notificationRequest));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ registration: { arbitrary: true } })));
  assert.deepStrictEqual(
    await notification,
    { registration: { arbitrary: true } },
    'notification payload stays unknown',
  );
  const logParams = promise(a.mdAppResponse({ type: 'getLogParams', sessionId: 'log' }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ value: ['change'], metadata: 'retained' })));
  assert.deepStrictEqual(await logParams, { value: ['change'], metadata: 'retained' });
  const mapResponse = promise(a.mdAppResponse({ type: 'map', settings: { action: 'map', range: 10 } }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ action: 'map', value: '{"lat":1,"lng":2}' })));
  assert.deepStrictEqual(await mapResponse, { action: 'map', value: '{"lat":1,"lng":2}' });
  const badNative = promise(a.mdAppResponse({ type: 'native', settings: { action: 'addRow' } }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ action: 'addRow', value: [] })));
  await assert.rejects(badNative, /Invalid native app response/);
  const badFilters = promise(a.mdAppResponse({ type: 'getFilters', sessionId: 'filters' }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ value: 'not an array' })));
  await assert.rejects(badFilters, /Invalid native app response/);
  const invalid = promise(a.mdAppResponse({ type: 'scan' }));
  f.window.MD_APP_RESPONSE!(f.window.btoa(JSON.stringify({ value: { invalid: true } })));
  await assert.rejects(invalid, /Invalid native app response/);
  f.session.setItem('addBehaviorLogInfo', '{bad json');
  a.addBehaviorLog('worksheet', 'sheet', {}, true);
  a.addBehaviorLog('worksheet', 'sheet', {}, true);
  assert.strictEqual(f.logs.length, 1, 'duplicate link visit is suppressed');
  a.addBehaviorLog('worksheetDecode', 'sheet', { rowId: 'row' });
  assert.strictEqual(f.logs.length, 1, 'decode logs require both row and control IDs');

  let schemes: Array<Record<string, unknown>> = [];
  const chart = load(
    '../pages/Statistics/Charts/common.ts',
    {
      lodash,
      'src/utils/control': { formatNumberThousand: String, toFixed: (value: number) => value },
      'src/utils/project': { getProjectChartColors: () => schemes },
      './reportTypes': { reportTypes: {} },
    },
    { _l: (text: string) => text },
  );
  assert.deepStrictEqual(
    chart.getChartColors({}, 'theme', projectId),
    [],
    'all disabled schemes have no default palette',
  );
  assert.deepStrictEqual(
    chart.getChartColors({ colorType: 2, customColors: ['custom'] }, 'theme', projectId),
    ['custom'],
    'explicit palettes survive an empty organization palette',
  );
  assert.deepStrictEqual(
    chart.getChartColors(
      { colorType: 1, colorGroupId: 'personColor', personColor: { colors: ['personal'] } },
      'theme',
      projectId,
    ),
    ['personal'],
  );
  schemes = [{ id: 'custom', name: 'Custom', colors: ['color'], themeColors: ['theme'] }];
  assert.deepStrictEqual(chart.getChartColors({ colorType: 1, colorGroupId: 'adaptThemeColor' }, 'theme', projectId), [
    'color',
  ]);

  const t = load(
    './translate.ts',
    {
      lodash,
      './translateTypes': translateTypes,
      'src/utils/app': {
        getTranslateInfo: () => ({
          name: 'Translated',
          key: 'Translated option',
          prefix: 'Prefix',
          suffix: 'Suffix',
          defaultTabName: 'Tab',
          message: 'Message',
          confirmMsg: 'Confirm',
        }),
      },
    },
    {
      window: { 'langData-app': [] },
      safeParse: (value: string, fallback: unknown) => {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      },
    },
  );
  assert.doesNotThrow(() =>
    t.replaceControlsTranslateInfo('app', 'sheet', [
      { type: 9, controlId: 'control', options: [{ key: 'key', value: 'Original' }] },
    ]),
  );
  assert.deepStrictEqual(
    t.replaceControlsTranslateInfo('app', 'sheet', [
      { type: 6, controlId: 'control', advancedSetting: { prefix: 'Old', suffix: 'Old' } },
    ]),
    [
      {
        type: 6,
        controlId: 'control',
        controlName: 'Translated',
        hint: '',
        desc: '',
        advancedSetting: { prefix: 'Prefix', suffix: 'Suffix' },
      },
    ],
  );
  assert.strictEqual(translateTypes.isTranslationItems([{ key: 'key', value: { invalid: true } }]), false);
  assert.strictEqual(translateTypes.isTranslationConfirmation({ confirmMsg: 7 }), false);
  assert.deepStrictEqual(
    t.replaceAdvancedSettingTranslateInfo('app', 'sheet', {
      deftabname: 'Old',
      doubleconfirm: JSON.stringify({ confirmMsg: 'Old' }),
    }),
    {
      deftabname: 'Tab',
      doubleconfirm: JSON.stringify({ confirmMsg: 'Confirm', confirmContent: '', sureName: '', cancelName: '' }),
      title: '',
      sub: '',
      continue: '',
      btnname: '',
    },
  );
  console.log('project/translate finite protocol tests passed');
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
