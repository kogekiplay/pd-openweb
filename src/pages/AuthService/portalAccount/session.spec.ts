const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');

let cookie = 'existing-main-session';
const storage = new Map<string, string>();
const location = {
  href: 'https://oa.tlytelec.com:8880/portal/network',
  replace: (url: string) => {
    location.href = url;
  },
};
const md = { global: { Config: { HttpOnly: false, IsLocal: true }, Account: { isPortal: false } } };
const window: Record<string, unknown> = {
  md,
  location,
  localStorage: {
    getItem: (key: string) => storage.get(key) || null,
    removeItem: (key: string) => storage.delete(key),
  },
  setCookie: (key: string, value: string) => {
    assert.equal(key, 'md_pss_id');
    cookie = value;
  },
  getCookie: () => cookie,
};
window['top'] = window;
window['self'] = window;

function load(file: string, requireTarget: (request: string) => unknown): Record<string, Function> {
  const moduleLike = { exports: {} };
  const { code } = transformFileSync(file);
  new Function('module', 'exports', 'require', 'window', 'location', 'md', '_l', code)(
    moduleLike,
    moduleLike.exports,
    requireTarget,
    window,
    location,
    md,
    (text: string) => text,
  );
  return moduleLike.exports;
}
const pss = load(path.resolve(__dirname, '../../../utils/pssId.ts'), request => {
  if (request === 'lodash') return lodash;
  if (request === 'src/utils/platform/storage/safe')
    return { setLocalStorageItemSafely: (key: string, value: string) => storage.set(key, value) };
  throw new Error(`Unexpected session dependency ${request}`);
});
const util = load(process.env.PORTAL_SESSION_SOURCE || path.join(__dirname, 'util.ts'), request => {
  if (request === 'lodash') return lodash;
  if (request === 'src/api/externalPortal') return {};
  if (request === 'src/utils/pssId') return pss;
  if (request === 'src/utils/common')
    return {
      browserIsMobile: () => false,
      getRequest: () => ({ ReturnUrl: 'https://oa.tlytelec.com:8880/portal/app/app-id' }),
      pathCompletion: (value: string) => value,
    };
  throw new Error(`Unexpected portal dependency ${request}`);
});
util['goApp']!('verified-portal-session', 'app-id');
assert.equal(
  pss['getPssId']!(),
  'verified-portal-session',
  'A successful email login must replace the old main-site identity before navigating',
);
assert.equal(location.href, 'https://oa.tlytelec.com:8880/portal/app/app-id');
assert.equal(storage.size, 0, 'Ordinary cookie mode does not need a new local-storage credential');
console.log('Actual portal goApp + session helper persist the verified session on a private-deployment domain.');
