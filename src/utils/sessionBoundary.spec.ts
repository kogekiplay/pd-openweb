const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const CryptoJS = require('crypto-js');
const repo = path.resolve(__dirname, '../..');
function load(
  file: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown>,
): Record<string, unknown> {
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  const code = transformFileSync(file, {
    plugins: ['@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    loaded,
    loaded.exports,
    (name: string) => {
      if (!(name in imports)) throw new Error('Unstubbed ' + name);
      return imports[name];
    },
    ...Object.values(globals),
  );
  return loaded.exports;
}
const types = load(path.join(__dirname, 'ssoTypes.ts'), {}, {});
const bootstrap = load(path.join(repo, 'src/common/bootstrapMetadata.ts'), {}, {});
function sessionFixture() {
  const cookies = new Map<string, string>(),
    stored = new Map<string, string>(),
    writes: unknown[] = [];
  const frame = {};
  const window = {
    top: frame,
    self: frame,
    isDingTalk: false,
    isMiniProgram: false,
    isFeiShu: false,
    md: { global: { Config: { HttpOnly: false, IsLocal: true } } },
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      removeItem: (key: string) => stored.delete(key),
    },
    setCookie: (key: string, value: string) => {
      cookies.set(key, value);
      writes.push({ cookie: key, value });
    },
    getCookie: (key: string) => cookies.get(key) ?? null,
    delCookie: (key: string) => cookies.delete(key),
  };
  const location = { href: 'https://private.example.test/portal' };
  const exports = load(
    path.join(__dirname, 'pssId.ts'),
    {
      lodash,
      'src/utils/platform/storage/safe': {
        setLocalStorageItemSafely: (key: string, value: string) => {
          stored.set(key, value);
          writes.push({ storage: key, value });
        },
      },
    },
    { window, location, process: { env: { NODE_ENV: 'production' } } },
  );
  return {
    window,
    location,
    cookies,
    stored,
    writes,
    api: exports as {
      setPssId(id: string | undefined | null, verification?: boolean): void;
      getPssId(): string | null;
      removePssId(): void;
    },
  };
}
const pss = sessionFixture();
pss.api.setPssId('normal');
assert.equal(pss.writes.length, 0, 'private deployment normal call preserves server-cookie behavior');
pss.api.setPssId('portal', true);
assert.equal(pss.cookies.get('md_pss_id'), 'portal', 'portal verification forces cookie write');
pss.window.md.global.Config.HttpOnly = true;
pss.api.setPssId('http-only');
assert.equal(pss.stored.get('md_pss_id'), 'http-only');
assert.equal(pss.api.getPssId(), 'portal', 'cookie wins over fallback storage');
pss.cookies.clear();
assert.equal(pss.api.getPssId(), 'http-only');
pss.api.removePssId();
assert.equal(pss.cookies.size + pss.stored.size, 0);
pss.window.md.global.Config.HttpOnly = false;
pss.window.top = {};
pss.api.setPssId('iframe');
assert.equal(pss.stored.get('md_pss_id'), 'iframe');
pss.location.href = 'https://private.example.test/?open_in_browser=true';
pss.api.setPssId('browser');
assert.equal(pss.cookies.get('md_pss_id'), 'browser');
pss.api.setPssId(undefined, true);
pss.api.setPssId(null, true);
pss.api.setPssId('', true);
assert.equal(pss.cookies.get('md_pss_id'), 'browser', 'empty session never overwrites identity');

// Read the same native storage property once per operation, including its throwing getter behavior.
const getterFixture = sessionFixture();
const nativeStorage = getterFixture.window.localStorage;
let storageReads = 0;
Object.defineProperty(getterFixture.window, 'localStorage', {
  configurable: true,
  get() {
    storageReads++;
    return nativeStorage;
  },
});
getterFixture.api.setPssId('forced', true);
assert.equal(storageReads, 1);
getterFixture.api.getPssId();
assert.equal(storageReads, 2);
getterFixture.api.removePssId();
assert.equal(storageReads, 3);
Object.defineProperty(getterFixture.window, 'localStorage', {
  configurable: true,
  get() {
    throw new Error('storage getter denied');
  },
});
assert.throws(() => getterFixture.api.getPssId(), /storage getter denied/);
assert.throws(() => getterFixture.api.setPssId('session'), /storage getter denied/);
assert.throws(() => getterFixture.api.removePssId(), /storage getter denied/);
for (const metadata of [
  undefined,
  null,
  {},
  { global: undefined },
  { global: {} },
  { global: { Config: undefined } },
  { global: { Config: {} } },
  { global: { Config: { HttpOnly: 'false', IsLocal: 'false' } } },
]) {
  const incomplete = sessionFixture();
  Object.defineProperty(incomplete.window, 'md', { value: metadata, configurable: true });
  incomplete.api.setPssId('private-session');
  assert.equal(incomplete.stored.size, 0, 'missing or string HttpOnly flags do not enable storage');
  assert.equal(incomplete.cookies.size, 0, 'private deployment needs a real cookie trigger');
  incomplete.api.setPssId('portal-session', true);
  assert.equal(
    incomplete.cookies.get('md_pss_id'),
    'portal-session',
    'portal force works before bootstrap flags exist',
  );
}
const stringFlags = sessionFixture();
Object.defineProperty(stringFlags.window, 'md', {
  value: { global: { Config: { HttpOnly: 'false', IsLocal: 'false' } } },
  configurable: true,
});
stringFlags.location.href = 'https://a.mingdaoyun.cn';
stringFlags.api.setPssId('cloud-session');
assert.equal(
  stringFlags.cookies.get('md_pss_id'),
  'cloud-session',
  'string IsLocal is treated as absent, matching the missing-flag cloud branch',
);
assert.equal(stringFlags.stored.size, 0);

const requests: FakeXhr[] = [];
let response: unknown = { state: 1, data: true },
  status = 200;
class FakeXhr {
  readyState = 0;
  status = 0;
  responseText = '';
  withCredentials = false;
  headers: Record<string, string> = {};
  openArgs: unknown[] = [];
  sent: unknown;
  onreadystatechange?: (this: FakeXhr) => void;
  onerror?: (error: unknown) => void;
  constructor() {
    requests.push(this);
  }
  open(...args: unknown[]) {
    this.openArgs = args;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(value?: unknown) {
    this.sent = value;
    this.status = status;
    this.readyState = 4;
    this.responseText = typeof response === 'string' ? response : JSON.stringify(response);
    this.onreadystatechange?.call(this);
  }
}
type TransportResult = { state?: number | boolean; data: unknown };
type Request = {
  url: string;
  async: boolean;
  data?: unknown;
  withCredentials?: boolean;
  decodeData?: (value: unknown) => unknown;
  success: (this: unknown, result: TransportResult) => void;
  error?: (this: unknown, failure: unknown) => void;
};
const alerts: unknown[] = [],
  headItems: unknown[] = [];
const location = {
  href: 'https://private.example.test/?code=first&code=second&url=%2Fapp%23tab',
  origin: 'https://private.example.test',
};
const md: { global: Record<string, unknown> } = { global: { Account: { accountId: 'account' } } };
const window = { md, config: undefined, alert: (value: unknown) => alerts.push(value) };
const document = {
  domain: 'private.example.test',
  cookie: '',
  createElement: () => ({ async: false, src: '', onload: undefined }),
  getElementsByTagName: () => [{ appendChild: (value: unknown) => headItems.push(value) }],
};
const api = load(
  path.join(__dirname, 'sso.ts'),
  {
    'src/utils/common': { pathCompletion: (url: string) => '/portal' + url },
    'src/utils/enum': { PUBLIC_KEY: 'a'.repeat(80) },
    'src/utils/pssId': { getPssId: () => 'session' },
    'src/common/bootstrapMetadata': bootstrap,
    './ssoTypes': types,
    'crypto-js': CryptoJS,
  },
  {
    window,
    md,
    location,
    document,
    navigator: { userAgent: 'iPhone OS' },
    XMLHttpRequest: FakeXhr,
    __api_server__: { main: '/api/' },
  },
) as {
  ajax: { post(params: Request): void; get(url: string, cb: (this: FakeXhr, text: string) => void): void };
  getGlobalMeta(): Promise<void>;
  checkLogin(): boolean;
  getRequest(): Record<string, string | undefined>;
  checkOriginUrl(url: string): string;
  replenishRet(url: string, pcSlide: string): string;
  getScript(src: string, cb: () => void): void;
};
assert.deepEqual(api.getRequest(), { code: 'second', url: '/app#tab' });
assert.equal(api.checkOriginUrl('https://private.example.test/app'), 'https://private.example.test/app');
assert.equal(api.checkOriginUrl('https://sub.mingdao.com/app'), 'https://sub.mingdao.com/app');
assert.equal(api.checkOriginUrl('https://mingdao.com.attacker.test/app'), '');
assert.equal(api.checkOriginUrl('javascript:alert(1)'), '');
assert.equal(api.replenishRet(encodeURIComponent('/app#tab'), 'true'), '/app?pc_slide=true#tab');
assert.equal(api.checkLogin(), true);
let delivered: unknown, receiver: unknown, failed: unknown;
response = {
  state: 1,
  data: { accountResult: 1, sessionId: 'native-session', metadata: 'kept' },
  metadata: 'envelope',
};
api.ajax.post({
  url: '/api/Login/Test',
  async: true,
  data: { code: 'code' },
  decodeData: types.decodeSsoAccountResult as (value: unknown) => unknown,
  success: function (value) {
    delivered = value;
    receiver = this;
  },
  error: error => {
    failed = error;
  },
});
assert.deepEqual(delivered, response);
assert.equal(receiver, requests[requests.length - 1]);
assert.equal(requests[requests.length - 1].headers.Authorization, 'md_pss_id session');
assert.equal(requests[requests.length - 1].headers.AccountId, 'account');
assert.equal(requests[requests.length - 1].withCredentials, true);
assert.equal(requests[requests.length - 1].sent, '{"code":"code"}');
response = { state: 1, data: { accountResult: 'wrong' } };
api.ajax.post({
  url: '/api/Login/Test',
  async: true,
  decodeData: types.decodeSsoAccountResult as (value: unknown) => unknown,
  success: () => assert.fail('Malformed account response accepted'),
  error: error => {
    failed = error;
  },
});
assert.match(String(failed), /Invalid SSO login response/);
response = '{bad json';
api.ajax.post({
  url: '/api/Login/Test',
  async: true,
  success: () => assert.fail('Malformed JSON accepted'),
  error: error => {
    failed = error;
  },
});
assert.ok(failed instanceof Error);
response = { state: 0, exception: 'denied' };
api.ajax.post({
  url: '/api/Login/Test',
  async: true,
  success: () => assert.fail('Failed response accepted'),
  error: error => {
    failed = error;
  },
});
assert.deepEqual(failed, response);
assert.equal(alerts[alerts.length - 1], 'denied');
api.getScript('/sdk.js', () => {});
assert.equal(headItems.length, 1);
(async () => {
  const key = '1234567890123456',
    data = { accountResult: 1, sessionId: 'encrypted-session' };
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse('a'.repeat(16)),
  }).toString();
  response = { state: 1, encrypted: true, key, data: encrypted };
  api.ajax.post({
    url: '/api/Login/Test',
    async: true,
    decodeData: types.decodeSsoAccountResult as (value: unknown) => unknown,
    success: result => {
      delivered = result;
    },
    error: error => {
      failed = error;
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(delivered, { data });
  response = { state: 1, data: { config: { FilePath: '/files' }, 'md.global': { Account: { accountId: 'native' } } } };
  await api.getGlobalMeta();
  assert.deepEqual(window.config, { FilePath: '/files' });
  assert.deepEqual(md.global, { Account: { accountId: 'native' } });
  response = '{bad json';
  await assert.rejects(api.getGlobalMeta());
  status = 500;
  response = { state: 1, data: {} };
  await assert.rejects(api.getGlobalMeta(), /SSO HTTP 500/);
  const redirects: string[] = [],
    sessionIds: unknown[] = [];
  let fallbackLogins = 0,
    rejectMetadata = false;
  const entryGlobals = {
    location: {
      href: 'https://private.example.test/auth/dingding',
      host: 'private.example.test',
      replace: (target: string) => redirects.push(target),
    },
    __api_server__: { main: '/api/' },
  };
  const entryImports = {
    'src/utils/common': { pathCompletion: (value: string) => '/portal' + value },
    'src/utils/pssId': { setPssId: (value: unknown) => sessionIds.push(value) },
    'src/utils/ssoTypes': types,
    'src/utils/sso': {
      ...api,
      browserIsMobile: () => false,
      getRequest: () => ({ code: 'code', state: 'state', url: 'https://private.example.test/app' }),
      checkLogin: () => false,
      login: () => {
        fallbackLogins++;
      },
      getGlobalMeta: () => (rejectMetadata ? Promise.reject(new Error('metadata failure')) : Promise.resolve()),
    },
  };
  status = 200;
  response = { state: 1, data: { accountResult: 1, sessionId: 'provider-session' } };
  load(path.join(repo, 'src/pages/AuthService/authLogin/authDingDing/index.ts'), entryImports, entryGlobals);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sessionIds, ['provider-session']);
  assert.deepEqual(redirects, ['https://private.example.test/app']);
  rejectMetadata = true;
  load(path.join(repo, 'src/pages/AuthService/authLogin/authDingDing/index.ts'), entryImports, entryGlobals);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fallbackLogins, 1, 'provider metadata rejection returns to login instead of hanging');
  response = { state: 1, data: { accountResult: 1, sessionId: { invalid: true } } };
  load(path.join(repo, 'src/pages/AuthService/authLogin/authDingDing/index.ts'), entryImports, entryGlobals);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fallbackLogins, 2, 'invalid provider session reaches the existing error path');
  assert.equal(sessionIds.length, 1, 'invalid sessions never reach setPssId');
  let jwtValue = '',
    submitted = 0;
  class JwtInput {
    set value(value: string) {
      jwtValue = value;
    }
  }
  response = { state: 1, data: 'signed-jwt' };
  load(
    path.join(repo, 'src/pages/AuthService/sso/zendesk.ts'),
    {
      'src/utils/ssoTypes': types,
      'src/utils/sso': { ...api, getRequest: () => ({ code: 'zendesk-code' }), login() {} },
    },
    {
      __api_server__: { main: '/api/' },
      HTMLInputElement: JwtInput,
      document: {
        getElementById: () => new JwtInput(),
        forms: {
          namedItem: () => ({
            submit: () => {
              submitted++;
            },
          }),
        },
      },
    },
  );
  assert.equal(jwtValue, 'signed-jwt');
  assert.equal(submitted, 1, 'Zendesk success callback uses the transport success property');
  console.log('session identity branches and SSO transport boundary tests passed');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
