const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const { getPortalIdentityRedirect } = require('./portalIdentityRedirect.ts');
const lodash = require('lodash');

const wanted = new Set([
  'parseShareId',
  'isPublicMingoPlan',
  'isMingoCreateAppRoute',
  'clearLocalStorage',
  'normalizeUrls',
  'getGlobalMeta',
]);
const ast = parser.parse(
  transformFileSync(process.env.PORTAL_BOOTSTRAP_SOURCE || path.join(__dirname, 'preall.tsx'), { plugins: [] }).code,
  {
    sourceType: 'module',
  },
);
const selected = ast.program.body.filter(
  node => node.type === 'VariableDeclaration' && node.declarations.some(d => wanted.has(d.id.name)),
);
assert.equal(selected.length, wanted.size);
const source = selected.map(node => generate(node).code).join('\n');

async function bootPortal(
  href: string,
  isPortal: boolean,
  appId?: string,
): Promise<{ href: string; waiting: boolean }> {
  let current = new URL(href);
  const location = {
    get href() {
      return current.href;
    },
    set href(value: string) {
      current = new URL(value, current.href);
    },
    get pathname() {
      return current.pathname;
    },
    get origin() {
      return current.origin;
    },
    get search() {
      return current.search;
    },
    reload: () => {
      throw new Error('Unexpected reload');
    },
  };
  const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
  const md = {
    global: {
      Account: { accountId: 'fixture-user', isPortal, appId, lang: 'zh-Hans', langModified: true, projects: [] },
      Config: { ProductCode: 'server', WebUrl: 'https://oa.tlytelec.com:8880/' },
      SysSettings: {},
      FileStoreConfig: {},
    },
  };
  const window = {
    md,
    isWaiting: false,
    isWeiXin: false,
    __customSubPath__: '',
    platformENV: {},
    shareState: {},
    top: {},
    self: {},
  };
  const noop = () => {};
  // This namespace-preserving completion recreates the old /portal/dashboard loop.
  const pathCompletion = (value: string) => `/portal${value}`;
  const names = [
    'window',
    'location',
    'localStorage',
    'md',
    '_',
    'getCurrentLangCode',
    'getCurrentLang',
    'global',
    'getPathWithoutSubPath',
    'browserIsMobile',
    'pathCompletion',
    'initThemeMode',
    'getPortalIdentityRedirect',
    'moment',
    'dayjs',
    '$',
    'setCookie',
    'navigateToLogin',
    'navigateToLogout',
    'navigateTo',
    'accountSetting',
    'setPssId',
    'getPssId',
    'resetPortalUrl',
    'redirect',
    'prefetchMyPermissions',
    'prefetchContactInfo',
  ];
  const values = [
    window,
    location,
    storage,
    md,
    lodash,
    () => 0,
    () => 'zh-Hans',
    { getGlobalMeta: () => Promise.resolve({ 'md.global': md.global }) },
    (value: string) => value,
    () => false,
    pathCompletion,
    noop,
    getPortalIdentityRedirect,
    { locale: noop },
    { locale: noop },
    () => ({ attr: noop }),
    noop,
    () => {
      throw new Error('Unexpected login');
    },
    () => {
      throw new Error('Unexpected logout');
    },
    noop,
    {},
    noop,
    () => 'fixture-session',
    noop,
    noop,
    () => Promise.resolve(),
    () => Promise.resolve(),
  ];
  const bootstrap = new Function(...names, `${source}\nreturn getGlobalMeta;`)(...values);
  await bootstrap();
  return { href: current.href, waiting: window.isWaiting };
}

async function run() {
  const portal = 'https://oa.tlytelec.com:8880/portal/app/2d4a8749-6a83-4497-b3d5-93a96c4073dc';
  const redirected = await bootPortal(portal, false);
  assert.deepEqual(redirected, { href: 'https://oa.tlytelec.com:8880/dashboard', waiting: true });
  assert.deepEqual(
    await bootPortal(redirected.href, false),
    { href: redirected.href, waiting: false },
    'The next actual bootstrap must settle instead of redirecting again',
  );
  assert.deepEqual(
    await bootPortal(portal, true, '2d4a8749-6a83-4497-b3d5-93a96c4073dc'),
    { href: portal, waiting: false },
    'A valid portal identity must keep its intended application',
  );
  assert.equal(
    getPortalIdentityRedirect({
      href: 'https://example.com/tenant/portal/app/app',
      account: { isPortal: false },
      mainSiteUrl: 'https://example.com/tenant/',
      customSubPath: '/tenant',
    }),
    'https://example.com/tenant/dashboard',
  );
  assert.equal(
    getPortalIdentityRedirect({ href: 'https://example.com/dashboard', account: { isPortal: true, appId: 'app' } }),
    'https://example.com/portal/app/app',
  );
  assert.equal(
    getPortalIdentityRedirect({ href: 'https://example.com/dashboard', account: { isPortal: true } }),
    'https://example.com/portal/network?ReturnUrl=https%3A%2F%2Fexample.com%2Fdashboard',
  );
  console.log('Real bootstrap exits the wrong identity namespace once; valid portal sessions keep their application.');
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
