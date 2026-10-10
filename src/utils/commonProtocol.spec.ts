const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const dayjs = require('dayjs');
const moment = require('moment');
const lodash = require('lodash');
const queryString = require('query-string').default;
const requests: unknown[] = [];
class FakeEncrypt {
  setPublicKey(_value: string) {}
  encrypt(value: string) {
    requests.push(JSON.parse(value));
    return 'encrypted';
  }
}
const window = {
  subPath: '/tenant',
  __customSubPath__: '',
  isDingTalk: false,
  isPublicApp: false,
  getCookie: () => 'session',
  localStorage: { getItem: () => 'session' },
  md: { global: { Account: { isPortal: false }, Config: { WebUrl: 'https://example.test/tenant/' } } },
};
const location = { origin: 'https://example.test', search: '', href: 'https://example.test/tenant/app' };
const navigator = { userAgent: '' };
const sessionStorage = { getItem: (_key: string) => '' };
type RoutePath = string | RoutePath[];
interface Route {
  path: RoutePath;
  title?: string;
  registry?: Record<string, Route>;
}
interface Helpers {
  browserIsMobile(): boolean;
  getRequest(query?: string): Record<string, string | string[] | null>;
  addSubPathOfRoute(route: string | string[]): string | string[];
  addSubPathOfRoutes(routes: Record<string, Route>): Record<string, Route>;
  getPathWithoutSubPath(route: string): string;
  pathCompletion(url: string | null | undefined, options?: { hasDomain?: boolean }): string | null | undefined;
  htmlEncodeReg(value: unknown): string;
  htmlDecodeReg(value: unknown): string;
  getStringBytes(value: string): number;
  cutStringWithHtml(value: string, length: number, rows: number): string;
  calcDate(date: unknown, expression: string): { result?: { valueOf(): number }; error?: unknown };
  formatFileSize(size?: string | number | null, precision?: number, space?: string, units?: string[]): string;
  encrypt(text: unknown): string;
  downloadFile(url: string): string;
  countChar(value: string, expression: string): number;
}
const imports: Record<string, unknown> = {
  dayjs,
  moment,
  lodash,
  events: require('events'),
  jsencrypt: { __esModule: true, default: FakeEncrypt },
  'query-string': { __esModule: true, default: queryString },
  'src/api/appManagement': {},
  'src/api/qiniu': {},
  'src/api/webCache': {},
  './enum': { PUBLIC_KEY: 'key' },
  './expression': {},
  './pssId': { getPssId: () => 'session' },
  './tempRecordCache': {},
  './worksheetConfigCache': {},
};
const moduleLike: { exports: unknown } = { exports: {} };
const source = process.env.COMMON_PROTOCOL_SOURCE || path.join(__dirname, 'common.ts');
new Function(
  'module',
  'exports',
  'require',
  'window',
  'location',
  'navigator',
  'sessionStorage',
  'md',
  transformFileSync(source).code,
)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unstubbed common helper dependency ' + name);
  },
  window,
  location,
  navigator,
  sessionStorage,
  window.md,
);
const helpers = moduleLike.exports as Helpers;
const shared: Route = { path: '/app', title: 'Title' };
const routes = { first: shared, second: shared, nested: { path: ['/app', ['/tenant/app', '/login']] } };
shared.registry = routes;
const prefixed = helpers.addSubPathOfRoutes(routes);
assert.deepEqual(prefixed.first.path, '/tenant/app');
assert.equal(prefixed.first, prefixed.second, 'Aliased route definitions retain their shared identity after cloning');
assert.equal(prefixed.first.registry, prefixed, 'A cloned route dictionary retains cycles back to itself');
assert.notEqual(prefixed.first, shared);
assert.equal(shared.path, '/app', 'Prefixing does not mutate the source route configuration');
assert.deepEqual(prefixed.nested.path, ['/tenant/app', ['/tenant/app', '/tenant/login']]);
assert.equal(helpers.getPathWithoutSubPath('/tenant/app?x=1#tab'), '/app?x=1#tab');
assert.equal(helpers.pathCompletion('/app', { hasDomain: false }), '/tenant/app');
assert.equal(helpers.pathCompletion(null), null);
assert.equal(helpers.pathCompletion(undefined), undefined);
window.subPath = '';
assert.equal(helpers.addSubPathOfRoutes(routes), routes, 'No configured prefix preserves the original dictionary');
window.subPath = '/tenant';
for (const agent of [
  'iPhone OS',
  'Android',
  'miniprogram',
  'Mingdao Application',
  'mobile HuaweiBrowser',
  'penharmony',
]) {
  navigator.userAgent = agent;
  assert.equal(helpers.browserIsMobile(), true);
}
navigator.userAgent = 'Mozilla Desktop';
assert.equal(helpers.browserIsMobile(), false);
navigator.userAgent = 'rv:1a2b3c4';
assert.equal(helpers.browserIsMobile(), false, 'A wildcard regex match still must equal its old literal token');
navigator.userAgent = 'wxwork Desktop';
location.search = '?pc_slide=true';
assert.equal(helpers.browserIsMobile(), true);
location.search = '?pc_slide=true&pc_slide=false';
assert.equal(helpers.browserIsMobile(), true);
location.search = '?pc_slide=trueExtra&pc_slide=false';
assert.equal(helpers.browserIsMobile(), false);
location.search = '';
const query = helpers.getRequest('?a=first&a=second&flag#ignored');
assert.equal(Object.getPrototypeOf(query), null);
assert.deepEqual({ ...query }, { a: ['first', 'second'], flag: null });
assert.equal(helpers.htmlEncodeReg('& < > " \' / &amp;'), '&#38; &lt; &gt; &#34; &#39; &#47; &amp;');
assert.equal(helpers.htmlDecodeReg('&#38; &amp; &#60; &#62; &#34; &#39; &#47;'), '& & < > " \' /');
const textLike = { toString: () => '<actual>', [Symbol.toPrimitive]: () => '<different>' };
assert.equal(
  helpers.htmlEncodeReg(textLike),
  '&lt;actual&gt;',
  'Encoding keeps the original toString receiver protocol',
);
assert.equal(helpers.htmlEncodeReg(0), '');
assert.equal(helpers.getStringBytes('a中'), 3);
assert.equal(
  helpers.cutStringWithHtml('<a>x中</a>abc', 2, 4),
  '<a>x中',
  'The existing truncator counts text after an opening anchor',
);
assert.equal(helpers.countChar('hello', 'z'), 0);
assert.equal(helpers.countChar('hello', 'l'), 2);
assert.equal(helpers.formatFileSize(1536, 1), '1.5 KB');
assert.equal(helpers.formatFileSize('1536', 1), '1.5 KB');
assert.equal(helpers.formatFileSize(0), '0 B');
assert.equal(helpers.formatFileSize('0'), 'NaN undefined', 'String zero preserves its original truthy numeric branch');
const date = moment('2026-01-02T03:04:05');
assert.equal(
  helpers.calcDate(date, '2d-1h').result?.valueOf(),
  dayjs(date.toDate()).add(2, 'd').subtract(1, 'h').valueOf(),
);
assert.equal(helpers.calcDate('2026-01-02', '+1Q').result?.valueOf(), dayjs('2026-01-02').add(1, 'Q').valueOf());
assert.deepEqual(helpers.calcDate(null, '+1d'), { error: true });
helpers.encrypt({ [Symbol.toPrimitive]: (hint: string) => hint + '&value' });
assert.equal((requests.at(-1) as { data: string }).data, 'string%26value');
assert.throws(() => helpers.encrypt(Symbol('not text')), /Symbol/);
window.isDingTalk = true;
assert.equal(
  helpers.downloadFile('https://example.test/file'),
  'https://example.test/file?md_pss_id=session',
  'A URL without query parameters remains downloadable in DingTalk',
);
assert.equal(
  helpers.downloadFile('https://example.test/file?validation=yes'),
  'https://example.test/file?validation=yes',
);
console.log('Actual common routing, HTML, user-agent, dates, URI encryption and download protocols passed');
