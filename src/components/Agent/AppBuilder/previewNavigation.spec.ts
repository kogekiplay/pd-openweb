const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const harness: import('../../../../scripts/spec-harness').SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const before = process.env['BUILDER_PANELS_BEFORE_REV'];
interface ObservedPreviewWindow {
  location: { pathname: string; search: string };
  reactRouterHistory?: unknown;
  updateAppGroups?: unknown;
}
interface NavigationApi {
  buildPreviewUrl(key: string, options: unknown): string;
  withPreviewMode(path: string): string;
  navigateInFrame(win: ObservedPreviewWindow | null, path: string, first?: boolean, current?: () => boolean): boolean;
}
function load(file: string, override?: string): Record<string, unknown> {
  const filename = path.join(root, file);
  const module: { exports: unknown } = { exports: {} };
  const code = harness.transformSync(override || fs.readFileSync(filename, 'utf8'), { filename });
  assert.ok(code?.code);
  new Function('module', 'exports', 'require', '__dirname', code.code)(
    module,
    module.exports,
    (name: string) => {
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
      return require(name);
    },
    path.dirname(filename),
  );
  assert.ok(module.exports && typeof module.exports === 'object');
  return Object.fromEntries(Object.entries(module.exports));
}
function navigationApi(module: Record<string, unknown>): NavigationApi {
  const invoke = (name: string, args: unknown[]): unknown => {
    const fn = module[name];
    if (typeof fn !== 'function') throw new TypeError('Missing actual navigation function');
    return Reflect.apply(fn, undefined, args);
  };
  const text = (name: string, args: unknown[]): string => {
    const result = invoke(name, args);
    if (typeof result !== 'string') throw new TypeError('Expected actual route string');
    return result;
  };
  return {
    buildPreviewUrl: (key, options) => text('buildPreviewUrl', [key, options]),
    withPreviewMode: value => text('withPreviewMode', [value]),
    navigateInFrame: (win, route, first, current) => {
      const result = invoke('navigateInFrame', [win, route, first, current]);
      if (typeof result !== 'boolean') throw new TypeError('Expected navigation result');
      return result;
    },
  };
}
const navigation = navigationApi(load('src/components/Agent/AppBuilder/previewNavigation.ts'));
const state = load('src/components/Agent/AppBuilder/builderState.ts');
function call(name: string, ...args: unknown[]): unknown {
  const fn = state[name];
  if (typeof fn !== 'function') throw new TypeError('Missing builder state function');
  return Reflect.apply(fn, undefined, args);
}
function deferred() {
  let finish: ((value?: unknown) => void) | undefined;
  const promise = new Promise<unknown>(resolve => {
    finish = resolve;
  });
  if (!finish) throw new Error('Missing synchronous Promise executor');
  return { promise, resolve: finish };
}
const meta = {
  name: '应用',
  versionLabel: 'v1',
  appId: 'old',
  sectionIdByName: { A: 'section' },
  sessionId: 's',
  artifactId: 'a',
  versionId: 'v',
};
assert.deepEqual(call('mergeAppMeta', meta, { name: '新名称' }), { ...meta, name: '新名称' });
assert.deepEqual(call('mergeAppMeta', meta, { built: false }), { ...meta, appId: '', sectionIdByName: {} });
assert.deepEqual(call('mergeAppMeta', meta, { appId: 'next-app' }), {
  ...meta,
  appId: 'next-app',
  sectionIdByName: {},
});
assert.deepEqual(call('mergeAppMeta', meta, { built: true, appId: 'new', sectionIdByName: {} }), {
  ...meta,
  appId: 'new',
  sectionIdByName: {},
});
assert.deepEqual(call('mergeAppMeta', meta, { name: {}, appId: [], sectionIdByName: { good: 's2', bad: {} } }), {
  ...meta,
  sectionIdByName: { good: 's2' },
});
assert.deepEqual(call('mergeAppMeta', meta, null), meta);
assert.equal(call('buildPhase', 'future'), undefined);
assert.equal(call('buildPhase', 'failed'), 'failed');
assert.deepEqual(call('pendingBuilderEdits', [null, { module: '角色', card: '员工', text: '增加权限' }]), [
  { module: '角色', card: '员工', text: '增加权限' },
]);
assert.deepEqual(call('createdCustomPages', [null, { name: '仪表盘', pageId: 'p2' }]), [
  { name: '', pageId: '' },
  { name: '仪表盘', pageId: 'p2' },
]);
for (const index of [-1, 1.5, NaN, Infinity, '2', undefined]) assert.equal(call('customPageIndex', index), 0);
assert.equal(call('customPageIndex', 2), 2);

const options = { appId: 'app', appLanguage: 'zh Hans', previewNonce: 2, sectionIdByName: { A: 'section' } };
const routes: Array<[string, object, string]> = [
  ['overview', options, '/app/app?rp=no&sys_lang=zh%20Hans&_r=2'],
  ['roles', options, '/app/app/role?rp=no&sys_lang=zh%20Hans'],
  ['workflows', options, '/app/app/workflow?rp=no&sys_lang=zh%20Hans'],
  ['worksheets', options, '/app/app/section?rp=no&sys_lang=zh%20Hans'],
  [
    'worksheets',
    { ...options, latestWorksheet: { worksheetId: 'w', sectionId: 's' } },
    '/app/app/s/w?rp=no&sys_lang=zh%20Hans',
  ],
  [
    'customPages',
    { ...options, latestCustomPage: { pageId: 'p', sectionId: 's' } },
    '/app/app/s/p?rp=no&sys_lang=zh%20Hans&_r=2',
  ],
  ['worksheets', { appId: 'app' }, '/app/app?rp=no'],
  ['customPages', { appId: 'app' }, '/app/app?rp=no'],
  ['future', {}, ''],
];
let oldNavigation: NavigationApi | undefined;
if (before) {
  const oldIndex = cp.execFileSync('git', ['show', before + ':src/components/Agent/AppBuilder/index.tsx'], {
    cwd: root,
    encoding: 'utf8',
  });
  const oldFrame = cp.execFileSync('git', ['show', before + ':src/components/Agent/AppBuilder/PreviewFrame.tsx'], {
    cwd: root,
    encoding: 'utf8',
  });
  const url = oldIndex.slice(oldIndex.indexOf('function buildPreviewUrl('), oldIndex.indexOf('const DebugBar ='));
  const frame = oldFrame.slice(
    oldFrame.indexOf('function withPreviewMode('),
    oldFrame.indexOf('export interface PreviewFrameProps'),
  );
  oldNavigation = navigationApi(
    load(
      'src/components/Agent/AppBuilder/previewNavigation.ts',
      url + frame + '\nmodule.exports={buildPreviewUrl,withPreviewMode,navigateInFrame};',
    ),
  );
}
for (const [key, args, expected] of routes) {
  assert.equal(navigation.buildPreviewUrl(key, args), expected);
  if (oldNavigation) assert.equal(oldNavigation.buildPreviewUrl(key, args), expected);
}
assert.equal(navigation.withPreviewMode('/app?a=1'), '/app?a=1&previewMode=ai');
assert.equal(navigation.withPreviewMode('/app?previewMode=ai'), '/app?previewMode=ai');
assert.equal(navigation.navigateInFrame(null, '/app'), false);
assert.equal(navigation.navigateInFrame({ location: { pathname: '/app', search: '' } }, '/app'), false);
const blocked = { location: { pathname: '/app', search: '' } };
Object.defineProperty(blocked, 'reactRouterHistory', {
  get() {
    throw new Error('Cross origin');
  },
});
assert.equal(navigation.navigateInFrame(blocked, '/other'), false);
async function run() {
  const calls: string[] = [];
  const win = {
    location: { pathname: '/app', search: '?x=1' },
    reactRouterHistory: {
      push(value: string) {
        calls.push('push:' + value);
      },
    },
    updateAppGroups() {
      calls.push('refresh');
    },
  };
  assert.equal(navigation.navigateInFrame(win, '/app?x=1'), true);
  assert.deepEqual(calls, ['refresh'], 'Same target avoids duplicate SPA routing');
  calls.length = 0;
  assert.equal(navigation.navigateInFrame(win, '/next'), true);
  assert.deepEqual(calls, ['push:/next', 'refresh']);
  calls.length = 0;
  const wait = deferred();
  let current = true;
  const asynchronous = { ...win, updateAppGroups: () => wait.promise };
  assert.equal(
    navigation.navigateInFrame(asynchronous, '/stale', true, () => current),
    true,
  );
  current = false;
  wait.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, [], 'A cancelled or replaced preview cannot route after refresh resolves');
  if (oldNavigation) {
    const previous = deferred();
    oldNavigation.navigateInFrame({ ...win, updateAppGroups: () => previous.promise }, '/stale', true, () => false);
    previous.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(calls, ['push:/stale'], 'Historical implementation reproduced the stale navigation');
  }
  calls.length = 0;
  assert.equal(
    navigation.navigateInFrame(
      { ...win, updateAppGroups: () => Promise.reject(new Error('refresh failed')) },
      '/fallback',
      true,
    ),
    true,
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['push:/fallback']);
  calls.length = 0;
  assert.equal(
    navigation.navigateInFrame(
      {
        ...win,
        updateAppGroups: () => ({
          then(resolve: (value: void) => void) {
            resolve();
          },
        }),
      },
      '/thenable',
      true,
    ),
    true,
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['push:/thenable'], 'Refresh thenables do not need a catch method');
  assert.equal(
    navigation.navigateInFrame(
      {
        ...win,
        reactRouterHistory: {
          push() {
            throw new Error('route failed');
          },
        },
      },
      '/failure',
    ),
    false,
  );
  publicContracts();
  console.log(
    JSON.stringify({
      historicalRoutes: routes.length,
      historicalAB: !!before,
      staleRefreshCancelled: true,
      rejectedRefreshFallback: true,
      crossOriginFallback: true,
      metadataAndPageSlots: true,
      publicTypes: true,
    }),
  );
}
function publicContracts() {
  const directory = fs.mkdtempSync(path.join(root, 'node_modules/.cache/builder-panel-types-'));
  const input = path.join(directory, 'public-contract.ts');
  const config = path.join(directory, 'tsconfig.json');
  try {
    const builder = path.join(root, 'src/components/Agent/AppBuilder');
    fs.writeFileSync(
      input,
      `import type{SidebarProps,BuildPhase}from '${builder}/builderState';import type{PreviewUrlOptions}from '${builder}/previewNavigation';import{roleCardItems,planCardItems}from '${builder}/panels/panelModels';
const options:PreviewUrlOptions={appId:'a',latestWorksheet:{worksheetId:'w',sectionId:'s'}};void options;
const sidebar:SidebarProps={appName:'应用',items:[],activeKey:'roles',onSelect:key=>{const valid:string=key;void valid;},buildStatus:'building'};void sidebar;
const roles=roleCardItems([]);if(roles[0]){const name:string=roles[0].name;const permissions:string[]=roles[0].permissions;void name;void permissions;
// @ts-expect-error Decoded names are strings.
const invalid:number=roles[0].name;void invalid;}
const item=planCardItems([])[0];if(item){const type:string=item.type;void type;}
// @ts-expect-error Build state is finite.
const phase:BuildPhase='complete';void phase;
// @ts-expect-error Sidebar selection uses a known key.
const invalidKey:SidebarProps['activeKey']='unknown';void invalidKey;
// @ts-expect-error Preview route identifiers are strings.
const invalidRoute:PreviewUrlOptions={appId:3};void invalidRoute;
`,
    );
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [input, path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    cp.execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
