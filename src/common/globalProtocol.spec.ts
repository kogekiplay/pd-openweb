const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const { transformSync, transformFileSync } = require('../../scripts/spec-harness.ts');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const req = (n: string) => require(root + '/node_modules/' + n);
const CryptoJS = req('crypto-js');
const publicKey = 'a'.repeat(80);
function compile(source: string) {
  return transformSync(source, {
    filename: root + '/src/common/global.ts',
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
}
function boot(source: string) {
  const requests: Array<Record<string, unknown>> = [],
    alerts: unknown[] = [],
    storage = new Map<string, string>(),
    cache = new Map<string, unknown>();
  let nextReply: unknown = { state: 1, data: { ok: true } },
    nextFailure: unknown = null;
  const axios = (config: {
    method: string;
    url: string;
    headers: unknown;
    data: unknown;
    params: unknown;
    signal: AbortSignal;
  }) => {
    requests.push({
      kind: 'axios',
      method: config.method,
      url: config.url,
      headers: config.headers,
      data: config.data,
      params: config.params,
    });
    return new Promise((resolve, reject) => {
      if (config.url.endsWith('/Pending')) {
        config.signal.addEventListener('abort', () => reject({ __CANCEL__: true }));
        return;
      }
      if (nextFailure) {
        reject(nextFailure);
        nextFailure = null;
      } else resolve({ data: nextReply });
    });
  };
  axios.interceptors = { request: { use: () => {} } };
  const types: { exports: unknown } = { exports: {} };
  new Function(
    'module',
    'exports',
    transformFileSync(root + '/src/common/globalRequestTypes.ts', {
      babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code,
  )(types, types.exports);
  const imports: Record<string, unknown> = {
    axios: { create: () => axios, isCancel: (e: { __CANCEL__?: boolean }) => e?.__CANCEL__ === true },
    'crypto-js': CryptoJS,
    localforage: {
      getItem: (key: string) => Promise.resolve(cache.get(key) ?? null),
      setItem: (key: string, value: unknown) => {
        cache.set(key, value);
        return Promise.resolve(value);
      },
      removeItem: (key: string) => {
        cache.delete(key);
        return Promise.resolve();
      },
    },
    lodash: req('lodash'),
    moment: req('moment'),
    'query-string': req('query-string'),
    uuid: { v4: () => 'fixed-uuid' },
    'ming-ui/functions/alert': { antAlert: (...args: unknown[]) => alerts.push(args), destroyAlert() {} },
    'src/api/login': { checkLogin: () => Promise.resolve(true) },
    'src/api/version': { getVersion: () => Promise.resolve({ version: '1' }) },
    'src/utils/common': { browserIsMobile: () => false, getPathWithoutSubPath: (s: string) => s },
    'src/utils/enum': { PUBLIC_KEY: publicKey },
    'src/utils/pssId': { getPssId: () => 'session' },
    './langConfig': [],
    'src/common/langConfig': [],
    './globalRequestTypes': types.exports,
    './globalClientTypes': require('./globalClientTypes.ts'),
  };
  class Element {}
  class Document {}
  class DocumentFragment {}
  const context = {
    module: { exports: {} },
    exports: {},
    require: (name: string) => {
      if (!(name in imports)) throw new Error('Unstubbed ' + name);
      return imports[name];
    },
    console: { log() {}, error() {} },
    Promise,
    AbortController,
    Response,
    Node: class Node {},
    Element,
    Document,
    DocumentFragment,
    URL,
    navigator: { userAgent: '', language: 'en' },
    location: {
      origin: 'https://example.com',
      href: 'https://example.com/auth/workwx',
      pathname: '/auth/workwx',
      host: 'example.com',
      hash: '',
    },
    document: {
      readyState: 'loading',
      head: { appendChild() {} },
      write() {},
      addEventListener() {},
      createDocumentFragment: () => ({ appendChild() {} }),
      createTextNode: (s: string) => ({ text: s }),
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    sessionStorage: { getItem: () => null },
    setTimeout,
    clearTimeout,
    addEventListener() {},
    alert() {},
    getCookie: () => null,
    __api_server__: { main: '/api/' },
    process: { env: { NODE_ENV: 'production' } },
    XMLHttpRequest: class XHR {
      request: Record<string, unknown> = {};
      status: number;
      responseText: string;
      constructor() {
        this.status = 200;
        this.responseText = JSON.stringify(nextReply);
      }
      open(method: string, url: string, sync: boolean) {
        requests.push({ kind: 'sync', method, url, sync, headers: {} });
        this.request = requests.at(-1)!;
      }
      setRequestHeader(key: string, value: unknown) {
        (this.request['headers'] as Record<string, string>)[key] = String(value);
      }
      send(body: unknown) {
        this.request.data = body;
      }
    },
    fetch: (url: string, config: { method: string; body?: unknown; headers: Record<string, string> }) => {
      requests.push({
        kind: 'stream',
        url,
        method: config.method,
        body: config.body,
        headers: Object.fromEntries(new Headers(config.headers)),
      });
      return Promise.resolve(new Response('{}', { status: 200 }));
    },
  };
  Object.assign(context, { window: context });
  Object.assign(context, { top: context, self: context });
  vm.runInNewContext(compile(source), context);
  const appGlobal = (context as { md?: { global: { Config: object; Account: object } } }).md!;
  appGlobal.global.Config = { HttpOnly: false, DefaultTimeZone: 8 };
  appGlobal.global.Account = { accountId: 'account', lang: 'en', projects: [] };
  return {
    context: context as typeof context & {
      mdyAPI(
        controller: string,
        action: string,
        data: unknown,
        options?: unknown,
      ): Promise<Record<string, unknown>> & { abort(): void };
    },
    requests,
    alerts,
    cache,
    setReply: (value: unknown) => {
      nextReply = value;
    },
    setFailure: (value: unknown) => {
      nextFailure = value;
    },
  };
}
async function scenarios(source: string) {
  const b = boot(source),
    c = b.context,
    outputs = [];
  outputs.push(await c.mdyAPI('Other', 'Get', { nested: { a: 1 } }, { ajaxOptions: { type: 'GET' } }));
  b.setReply({ state: 1, data: { value: 'sync' } });
  outputs.push(c.mdyAPI('Other', 'Sync', {}, { ajaxOptions: { sync: true } }));
  b.setReply('raw');
  outputs.push(await c.mdyAPI('Other', 'Raw', {}, { customParseResponse: true }));
  b.setReply({ state: 2, exception: 'bad' });
  try {
    await c.mdyAPI('Other', 'Failure', {});
  } catch (e) {
    outputs.push(e);
  }
  const pending = c.mdyAPI('Other', 'Pending', {});
  pending.abort();
  try {
    await pending;
  } catch (e) {
    outputs.push(e);
  }
  await c.mdyAPI('Other', 'Stream', {}, { isReadableStream: true });
  const key = '0123456789abcdef';
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify({ title: 'AES', items: [1, 2] }),
    CryptoJS.enc.Utf8.parse(key),
    { iv: CryptoJS.enc.Utf8.parse(publicKey.slice(26, 42)) },
  ).toString();
  b.setReply({ state: 1, encrypted: true, key, data: encrypted });
  outputs.push(await c.mdyAPI('Other', 'Encrypted', {}));
  b.cache.set('AppManagement_GetAppLangDetail_app_en', {
    version: '1',
    data: { cached: true },
    time: req('moment')().format('YYYY-MM-DD HH:mm:ss'),
  });
  outputs.push(await c.mdyAPI('AppManagement', 'GetAppLangDetail', { appId: 'app', appLangId: 'en' }));
  assert.equal(typeof pending.abort, 'function');
  return JSON.parse(JSON.stringify({ outputs, requests: b.requests, alerts: b.alerts }));
}
(async () => {
  const source = fs.readFileSync(root + '/src/common/global.ts', 'utf8');
  const actual = await scenarios(source);
  assert.equal(actual.outputs[0].ok, true);
  assert.equal(actual.outputs[1].value, 'sync');
  assert.equal(actual.outputs[2], 'raw');
  assert.equal(actual.outputs[3].errorCode, 2);
  assert.equal(actual.outputs[4].errorCode, 1);
  assert.deepStrictEqual(actual.outputs[5], { title: 'AES', items: [1, 2] });
  assert.equal(actual.outputs[6].cached, true);
  assert(!actual.requests.some((r: { url?: string }) => r.url?.includes('GetAppLangDetail')));
  const invalid = boot(source);
  invalid.cache.set('AppManagement_GetAppLangDetail_app_en', { version: '1', data: { badCache: true }, time: 42 });
  const refreshed = await invalid.context.mdyAPI('AppManagement', 'GetAppLangDetail', {
    appId: 'app',
    appLangId: 'en',
  });
  assert.equal(refreshed.ok, true);
  Object.assign(invalid.context, {
    apireply_forbid: true,
    apireply_hex_key: '11'.repeat(32),
    apireply_hex_iv: '22'.repeat(16),
  });
  await invalid.context.mdyAPI('Other', 'Nonce', {});
  const nonce = (invalid.requests.at(-1)?.['headers'] as Record<string, string>)['x-nonce'];
  const nonceText = CryptoJS.AES.decrypt(nonce, CryptoJS.enc.Hex.parse('11'.repeat(32)), {
    iv: CryptoJS.enc.Hex.parse('22'.repeat(16)),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
  assert.match(nonceText, /^fixed-uuid_\d+$/);
  invalid.setReply({ state: 1, encrypted: true, key: 42, data: 'cipher' });
  await assert.rejects(invalid.context.mdyAPI('Other', 'MalformedEncrypted', {}), /Invalid API response envelope/);
  console.log('Global GET, sync, API errors, abort, SSE, AES and cache protocol passed');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
