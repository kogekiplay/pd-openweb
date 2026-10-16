import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const cheerio: typeof import('cheerio') = require('cheerio');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/kc/shareMobile/shareMobile.ts';
const saverTarget = 'src/components/kc/saveToKnowledge/saveToKnowledge.ts';
const beforeRev = process.env['MOBILE_SHARE_BEFORE_REV'];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!record(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}

function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing method ' + key);
  return Reflect.apply(fn, value, args);
}

function readSource(relative: string, before = false) {
  return before && beforeRev
    ? cp.execFileSync('git', ['show', beforeRev + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');
}

const globalSource = readSource('src/common/global.ts');
const windowGlobals: Record<string, unknown> = {};
const begin = globalSource.indexOf('window._l =');
const end = globalSource.indexOf('\n};', begin);
assert.ok(begin >= 0 && end > begin);
new Function('window', harness.transformSync(globalSource.slice(begin, end + 3), { filename: target }).code)(
  windowGlobals,
);
function load(text: string, imports: Record<string, unknown> = {}, env: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const globals = { _l: windowGlobals['_l'], ...env };
  const code = harness.transformSync(text, {
    filename: target,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['lodash', 'moment', 'query-string', 'dot'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(globals),
  );
  return module.exports;
}

function declarations(relative: string, names: string[]) {
  const source = readSource(relative);
  const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const statement = tree.program.body.find(s => {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        return d?.type === 'FunctionDeclaration'
          ? d.id?.name === name && !!d.body
          : d?.type === 'VariableDeclaration' &&
              d.declarations.some(v => v.id.type === 'Identifier' && v.id.name === name);
      });
      assert.ok(statement?.start != null && statement.end != null, name);
      const code = source.slice(statement.start, statement.end);
      return code.startsWith('export ') ? code : 'export ' + code;
    })
    .join('\n');
}

const methods = load(readSource('src/utils/defineMethods.ts'));
const expression = load(readSource('src/utils/expression.ts'));
const common = load(
  'import _ from "lodash";\n' +
    declarations('src/utils/common.ts', ['getIconNameByExt', 'getClassNameByExt', 'formatFileSize']),
  {},
  { RegExpValidator: expression['default'] },
);
const enumModule = load(readSource('src/components/shareAttachment/enum.ts'));
const model = load(readSource('src/pages/kc/shareMobile/shareModel.ts'));
const time = Date.UTC(2026, 9, 16, 3, 0, 0);
class FixedDate extends Date {
  constructor(value?: string | number) {
    super(value === undefined ? time : value);
  }
  static now() {
    return time;
  }
}
interface Scenario {
  node?: unknown;
  query?: string;
  pathname?: string;
  ios?: boolean;
  weixin?: boolean;
  login?: boolean;
  previewReply?: unknown;
  rejectPreview?: boolean;
  shareReply?: unknown;
  rejectShare?: boolean;
  copyReply?: unknown;
  rejectSave?: boolean;
  commonReply?: unknown;
  folder?: string;
}
function stable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, v: unknown) => (typeof v === 'function' ? '[function]' : v)));
}

function engine(before = false, s: Scenario = {}) {
  const dom = cheerio.load('<html><body><div id="app"></div><div id="previewCon"></div></body></html>');
  const requests: unknown[][] = [],
    nav: unknown[][] = [],
    shares: unknown[][] = [];
  const handlers = new Map<AnyNode, Map<string, unknown>>();
  const timers = new Map<number, { fn: () => void; delay: number }>();
  let timerId = 0;
  class JQ {
    nodes: Cheerio<AnyNode>;
    constructor(nodes: Cheerio<AnyNode>) {
      this.nodes = nodes;
    }
    get 0() {
      return this.nodes[0];
    }
    empty() {
      this.nodes.empty();
      return this;
    }
    append(value: unknown) {
      if (value instanceof JQ) this.nodes.append(value.nodes);
      else this.nodes.append(String(value));
      return this;
    }
    find(selector: string) {
      return new JQ(this.nodes.find(selector));
    }
    width() {
      return this.nodes.length ? 320 : undefined;
    }
    height() {
      return this.nodes.length ? 640 : undefined;
    }
    on(name: string, handler: unknown) {
      for (const node of this.nodes.toArray()) {
        if (!handlers.has(node)) handlers.set(node, new Map());
        handlers.get(node)?.set(name, handler);
      }

      return this;
    }
    attr(name: string, value?: unknown) {
      if (arguments.length === 1) return this.nodes.attr(name);
      this.nodes.attr(name, String(value));
      return this;
    }
    addClass(name: string) {
      this.nodes.addClass(name);
      return this;
    }
    remove() {
      this.nodes.remove();
      return this;
    }
  }
  function jquery(value: unknown) {
    if (value instanceof JQ) return value;
    if (typeof value === 'string') return new JQ(dom(value));
    return new JQ(dom([]));
  }

  const $ = Object.assign(jquery, { extend: Object.assign });
  let href = 'https://app.test' + (s.pathname || '/kcshare.html') + (s.query || '');
  const location = {
    get href() {
      return href;
    },
    set href(value: string) {
      href = String(value);
      nav.push(['navigate', href]);
    },
    search: s.query || '',
    pathname: s.pathname || '/kcshare.html',
  };
  const win = {
    isWeiXin: !!s.weixin,
    nativeAlert: (text: string) => nav.push(['nativeAlert', text]),
    open: (url: unknown) => nav.push(['open', url]),
  };
  Object.defineProperty(win, 'location', {
    get: () => location,
    set: (value: string) => {
      location.href = value;
    },
  });
  const md = {
    global: { Account: s.login === false ? null : { accountId: 'self', avatar: 'avatar.png' }, Config: {} },
  };
  Object.assign(globalThis, { md, _l: windowGlobals['_l'] });
  const env = {
    $,
    window: win,
    location,
    navigator: { userAgent: s.ios ? 'iPhone' : 'Android' },
    md,
    Date: FixedDate,
    document: {
      title: 'fixture',
      createElement: () => {
        const attributes: Record<string, string> = {};
        return {
          setAttribute: (name: string, value: string) => {
            attributes[name] = value;
          },
          href: '',
          click() {
            nav.push(['download', read(this, 'href'), attributes]);
          },
        };
      },
    },
    setTimeout: (fn: () => void, delay: number) => {
      const id = ++timerId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    unescape,
    console: { log: () => {} },
    Math: { random: () => 0.5 },
    wx: {
      config: (value: unknown) => shares.push(['config', value]),
      onMenuShareAppMessage: (value: unknown) => shares.push(['app', value]),
      onMenuShareTimeline: (value: unknown) => shares.push(['timeline', value]),
    },
  };
  const attachment = {
    getPreviewLink: (args: unknown) => {
      requests.push(['preview-common', args]);
      return s.rejectPreview
        ? Promise.reject(new Error('preview failed'))
        : Promise.resolve(s.previewReply ?? 'https://preview.test/file?old=1');
    },
    saveToKnowledge: (args: unknown) => {
      requests.push(['save-common', args]);
      return s.rejectSave ? Promise.reject(new Error('save failed')) : Promise.resolve(true);
    },
  };
  const kc = {
    copyNode: (args: unknown) => {
      requests.push(['copy-kc', args]);
      return s.rejectSave ? Promise.reject(new Error('save failed')) : Promise.resolve(s.copyReply ?? [[], ['ok']]);
    },
    addNode: (args: unknown) => {
      requests.push(['add-qiniu', args]);
      return s.rejectSave ? Promise.reject(new Error('save failed')) : Promise.resolve(true);
    },
  };
  const kcUtil = load(readSource('src/pages/kc/util.ts'), {}, env);
  const link = (url: string) => 'https://app.test' + url;
  const saver = load(
    readSource(saverTarget, before),
    {
      'src/api/attachment': attachment,
      'src/api/kc': kc,
      'src/components/createShare/createShare': (...args: unknown[]) => shares.push(['create', ...args]),
      'src/pages/kc/util': kcUtil,
      'src/utils/common': { pathCompletion: link },
      'src/utils/defineMethods': methods,
    },
    env,
  );
  const defaults = { ...env };
  const share = load(
    readSource(target, before),
    {
      'src/api/attachment': attachment,
      'src/api/chat': {
        getPreviewLink: (args: unknown) => {
          requests.push(['preview-qiniu', args]);
          return s.rejectPreview
            ? Promise.reject(new Error('preview failed'))
            : Promise.resolve(s.previewReply ?? { viewUrl: 'https://preview.test/file?old=1' });
        },
      },
      'src/api/share': {
        getShareNode: (args: unknown) => {
          requests.push(['load-node', args]);
          return s.rejectShare
            ? Promise.reject(new Error('share failed'))
            : Promise.resolve(s.shareReply ?? { node: s.node });
        },
        getShareLocalAttachment: (args: unknown) => {
          requests.push(['load-common', args]);
          return s.rejectShare
            ? Promise.reject(new Error('share failed'))
            : Promise.resolve(s.commonReply ?? { attachment: s.node, isValid: true });
        },
      },
      'src/api/weixin': {
        getWeiXinConfig: (args: unknown) => {
          requests.push(['weixin-config', args]);
          return Promise.resolve({ code: 1, data: { timestamp: 123, nonceStr: 'nonce', signature: 'sig' } });
        },
      },
      'src/components/kc/saveToKnowledge/saveToKnowledge': saver,
      'src/components/shareAttachment/enum': enumModule,
      'src/utils/common': { ...common, downloadFile: (url: string) => 'download:' + url, pathCompletion: link },
      'src/utils/defineMethods': methods,
      'src/utils/expression': expression,
      './shareModel': model,
      './tpl/mobileShare.htm': readSource('src/pages/kc/shareMobile/tpl/mobileShare.htm'),
      './css/mobileShare.less': {},
    },
    defaults,
  );
  const Constructor = share['default'];
  if (typeof Constructor !== 'function') throw new Error('Missing constructor');
  const instance: unknown = Reflect.construct(Constructor, [
    { node: s.pathname ? undefined : s.node, container: '#app', shareFolderId: s.folder },
  ]);

  async function flush() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }

  async function event(selector: string) {
    const node = dom(selector)[0];
    if (!node) return false;
    const handler = handlers.get(node)?.get('click');
    if (typeof handler !== 'function') return false;
    Reflect.apply(handler, node, []);
    await flush();
    return true;
  }

  function snapshot() {
    return stable({
      html: dom.html(),
      title: env.document.title,
      requests,
      nav,
      shares,
      file: read(instance, 'file'),
      deadline: read(instance, 'deadLine'),
      attachment: read(instance, 'attachmentType'),
      preview: read(instance, 'preview'),
      timers: [...timers.entries()].map(([id, t]) => [id, t.delay]),
    });
  }

  return { instance, saver, requests, nav, shares, timers, event, flush, snapshot, html: () => dom.html(), location };
}

let cases = 0;

async function compare(s: Scenario, action?: string) {
  const current = engine(false, s);
  await current.flush();
  if (action === 'preview') {
    await invoke(current.instance, 'previewFile');
    await current.flush();
  } else if (action) await current.event(action);
  if (beforeRev) {
    const before = engine(true, s);
    await before.flush();
    if (action === 'preview') {
      await invoke(before.instance, 'previewFile');
      await before.flush();
    } else if (action) await before.event(action);
    assert.deepEqual(current.snapshot(), before.snapshot(), 'historical scenario ' + cases + ' ' + action);
  }

  cases++;
  return current;
}

const commonNode = {
  fileID: 'file',
  originalFilename: '附件',
  ext: '.pdf',
  filesize: 1024,
  allowDown: true,
  downloadUrl: 'https://download.test/raw?old=1',
  isValid: true,
  deadLine: '2026-10-18T00:00:00Z',
  attachmentType: 1,
  thumbnailPath: 'https://images.test/',
  thumbnailName: 'image.png?size=320',
};
const kcNode = {
  id: 'node',
  name: '知识文件',
  ext: 'pdf',
  size: '2048',
  canDownload: true,
  downloadUrl: 'https://download.test/raw?old=1',
  viewUrl: 'https://preview.test/view?old=1',
  metadata: 'preserve',
};
const qiniu =
  '?qiniuPath=https%3A%2F%2Fqiniu.test%2Fasset.pdf&name=文件&ext=pdf&size=1024&e=expiry&qiniutoken=signature&genTime=' +
  time;

async function run() {
  for (const base of [commonNode, kcNode])
    for (const ext of ['pdf', 'docx', 'txt', 'jpg', 'zip', 'PDF'])
      for (const ios of [false, true])
        for (const weixin of [false, true])
          for (const canDownload of [false, true]) {
            const node = { ...base, ext: 'fileID' in base ? '.' + ext : ext, canDownload, allowDown: canDownload };

            for (const folder of [undefined, 'shared-folder']) {
              await compare({ node, ios, weixin, folder });
              await compare({ node, ios, weixin, folder }, 'preview');
            }
          }

  for (const ext of ['pdf', 'txt', 'jpg', 'zip'])
    for (const ios of [false, true])
      for (const weixin of [false, true]) {
        const query = qiniu.replace(/ext=pdf/, 'ext=' + ext);
        await compare({ query, ios, weixin }, 'preview');
      }

  for (const node of [commonNode, kcNode])
    for (const ios of [false, true])
      for (const weixin of [false, true])
        for (const login of [false, true])
          for (const canDownload of [false, true]) {
            const value = { ...node, canDownload, allowDown: canDownload };
            await compare({ node: value, ios, weixin, login }, '.saveToMingDao');
            await compare({ node: value, ios, weixin, login }, ios ? '.openIniOS' : '.downloadBtn');
          }

  await compare({ node: { ...commonNode, isValid: false } });
  await compare({ node: { name: 'wrapped', ext: 'pdf', data: kcNode } }, 'preview');
  await compare({ node: { ...kcNode, data: null } }, 'preview');
  await compare({ query: qiniu.replace(String(time), String(time - 49 * 3600000)) });
  await compare({ node: commonNode, pathname: '/apps/kcshare/share-id', shareReply: { node: commonNode } }, 'preview');
  await compare({ node: commonNode, pathname: '/apps/kcshare/share-id', shareReply: { actionResult: 2 } });
  await compare({ node: commonNode, pathname: '/apps/kcshare/share-id', shareReply: { actionResult: 0 } });
  await compare(
    {
      node: commonNode,
      pathname: '/kcshare.html',
      query: '?fileID=local',
      commonReply: { attachment: commonNode, isValid: true, deadLine: '2026-10-20T00:00:00Z' },
    },
    'preview',
  );
  for (const reply of ['https://preview.test/raw?token=signed&old=1', 'https://preview.test/raw?old=1'])
    await compare({ node: commonNode, folder: 'shared-folder', previewReply: reply }, 'preview');
  await compare({ query: qiniu, previewReply: { viewUrl: 'https://qiniu.test/asset.pdf' } }, 'preview');
  const alert = await compare({ node: kcNode });
  invoke(alert.instance, 'alert', ['first']);
  invoke(alert.instance, 'alert', ['second']);
  assert.equal(alert.timers.size, 1);
  [...alert.timers.values()][0]?.fn();
  assert.ok(!alert.html().includes('second'));
  for (const sourceType of [0, 1, 2, undefined])
    for (const destination of [
      { type: 1, node: { id: null } },
      { type: 2, node: { id: 'root' } },
      { type: 3, node: { id: 'child', rootId: 'root', position: '/root/child' } },
    ])
      for (const createShare of [false, true]) {
        const s = { node: kcNode };
        const current = engine(false, s);
        const source = {
          fileID: 'file',
          nodeId: 'node',
          name: 'asset.pdf',
          filePath: 'https://qiniu.test/asset.pdf?token=signed',
          des: 'description',
        };
        const saver = invoke(current.saver, 'default', [sourceType, source, { createShare }]);
        const result = await invoke(saver, 'save', [destination]);
        await current.flush();
        if (beforeRev) {
          const before = engine(true, s);
          const old = invoke(before.saver, 'default', [sourceType, source, { createShare }]);
          const oldResult = await invoke(old, 'save', [destination]);
          await before.flush();
          assert.deepEqual(result, oldResult);
          assert.deepEqual(stable(current.requests), stable(before.requests));
          assert.deepEqual(stable(current.shares), stable(before.shares));
        }

        cases++;
      }

  for (const scenario of [
    { node: commonNode, rejectPreview: true },
    { query: qiniu, rejectPreview: true },
    { query: qiniu, previewReply: { viewUrl: { bad: true } } },
  ]) {
    const value = engine(false, scenario);
    await value.flush();
    await invoke(value.instance, 'previewFile');
    await value.flush();
    assert.ok(value.html().includes('获取预览链接失败'));
  }

  const failedLoad = engine(false, { pathname: '/apps/kcshare/id', rejectShare: true });
  await failedLoad.flush();
  assert.ok(JSON.stringify(failedLoad.nav).includes('获取预览链接失败'));
  const ignored = engine(false, { query: qiniu.replace('ext=pdf', 'ext=zip'), rejectPreview: true });
  await invoke(ignored.instance, 'previewFile');
  await ignored.flush();
  assert.ok(ignored.location.href.includes('token=signature'));
  const helper = engine();
  const save = invoke(helper.saver, 'default', [1, { fileID: 'file' }, { createShare: false }]);
  await assert.rejects(Promise.resolve(invoke(save, 'save', [null])), TypeError);
  const invalid = engine(false, { node: kcNode, rejectSave: true });
  await invalid.flush();
  await invalid.event('.saveToMingDao');
  assert.ok(invalid.html().includes('保存失败'));
  for (const malformed of [
    null,
    [],
    { data: { data: null }, ext: 4 },
    { data: null, size: [] },
    { data: null, deadLine: { bad: true } },
  ])
    assert.throws(() => invoke(model, 'shareNode', [malformed]), TypeError);
  assert.throws(() => invoke(model, 'queryText', [['pdf', 'jpg']]), TypeError);
  assert.throws(() => invoke(model, 'weixinSdk', [{}]), TypeError);
  assert.throws(() => invoke(model, 'weixinSignature', [{ timestamp: {}, nonceStr: 'n', signature: 's' }]), TypeError);
  console.log(
    `Mobile share and save-to-knowledge passed (${cases} cases${beforeRev ? ' with historical comparison' : ''}); real doT/HTML, signed URLs, platform/permission branches, payloads, lifecycle and failed boundaries verified`,
  );
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
