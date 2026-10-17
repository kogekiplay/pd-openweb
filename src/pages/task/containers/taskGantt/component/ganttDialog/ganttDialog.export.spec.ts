/**
 * 甘特弹窗导出与上传（ganttDialog export/upload）行为规格 —— 历史 A/B 对照版
 *
 * 覆盖 lead 点名"仍有价值"的直接证据：
 *   导出上传成功 / 上传失败 / 清理  三组路径，全部与类型批次前实现（A 侧）逐字段比对。
 *
 * A 侧来源：`git show a3bd34da1`（main可达、源码与协作基线相同）的 `ganttDialog/index.tsx`，
 * 在规格开头按 sha256 冻结校验，因此对照不会随工作区改动而漂移。
 *
 * 【为什么要单开一份】`ganttDialog.spec.ts` 是同步探针集合，只覆盖到导出前段
 * （canvas 尺寸与绘制指令）。上传是 `.then/.catch` 链，需要真实驱动 Promise，
 * 因此单独放这里，用 `process.exitCode` 汇总异步结果。
 *
 * 【为什么不用 import】与仓内既有 spec（如 `src/utils/createUploader.spec.ts`）一致：
 * 该文件依赖 react / jQuery / 浏览器全局，用 spec-harness 动态编译并替身依赖。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const {
  jsxRuntimeFrom,
  transformFileSync,
  transformSync,
  ROOT,
} = require('../../../../../../../scripts/spec-harness.ts');

/* ────────────────────────── DOM / 浏览器全局替身 ────────────────────────── */

class FakeHTMLElement {
  className = '';
  scrollTop = 0;
  scrollLeft = 0;
  offsetLeft = 0;
  style: Record<string, string> = {};
  listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  getBoundingClientRect() {
    return { top: 100, width: 800, height: 600 };
  }
}
class FakeCanvas extends FakeHTMLElement {
  width = 0;
  height = 0;
  fillStyle = '';
  font = '';
  textAlign = '';
  textBaseline = '';
  strokeStyle = '';
  calls: string[] = [];
  /** 由用例注入：控制 toDataURL 的返回值，用来区分"图片过长"与正常路径 */
  dataUrl = 'data:image/png;base64,AAAA';
  getContext() {
    const self = this;
    return {
      fillRect: () => self.calls.push('fillRect'),
      fillText: (text: string) => self.calls.push(`fillText:${text}`),
      moveTo: () => self.calls.push('moveTo'),
      lineTo: () => self.calls.push('lineTo'),
      stroke: () => self.calls.push('stroke'),
      drawImage: () => self.calls.push('drawImage'),
    };
  }
  toDataURL() {
    return this.dataUrl;
  }
}
Object.assign(globalThis, { HTMLElement: FakeHTMLElement, HTMLCanvasElement: FakeCanvas });
global._l = (s: string, ...args: unknown[]) => String(s).replace(/%(\d)/g, (m, i) => String(args[Number(i)]));

const element = (_tag: string, className = '') => {
  const el = new FakeHTMLElement();
  el.className = className;
  return el;
};

/** 记录所有 alert 调用，用于断言失败提示 */
let alertCalls: unknown[][] = [];
/**
 * html2canvas 拒绝时原实现没有 .catch —— 这会变成未处理拒绝。
 * 这里挂一个临时监听把它记下来，既不让规格进程被杀，也能把
 * "原实现与当前实现在该路径上的差异/一致性"作为可断言的数据。
 */
/** 规格自身输出用真实 console；产品代码的 console 调用另记进 productConsole */
const realConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
};
let productConsole: string[] = [];

let unhandled: string[] = [];
process.on('unhandledRejection', reason => {
  unhandled.push(reason instanceof Error ? reason.message : String(reason));
});
let removedSelectors: string[] = [];
let appendedCount = 0;
let domMap: Record<string, unknown> = {};
Object.assign(globalThis, {
  document: {
    querySelector: (selector: string) => domMap[selector] ?? null,
    querySelectorAll: (selector: string) => domMap[selector] ?? [],
    getElementById: (id: string) => domMap[`#${id}`] ?? null,
  },
  window: { open: () => {} },
  alert: (...args: unknown[]) => alertCalls.push(args),
  btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  // 产品的 putb64 会在失败分支 console.log/error；记下来而不要污染规格输出
  console: {
    log: (...args: unknown[]) => productConsole.push(`log:${String(args[0])}`),
    error: (...args: unknown[]) => productConsole.push(`error:${String(args[0])}`),
    warn: (...args: unknown[]) => productConsole.push(`warn:${String(args[0])}`),
  },
  md: { global: { FileStoreConfig: { uploadHost: 'https://upload.test', pubHost: 'https://pub.test' } } },
});

/* ────────────────────────── react / 依赖替身 ────────────────────────── */

class FakeComponent {
  props: Record<string, any>;
  state: Record<string, any> = {};
  constructor(props: Record<string, any>) {
    // 与真实 React 一致：先合并 defaultProps（见 ganttDialog.spec.ts 的同类注释）
    const defaults = (this.constructor as unknown as { defaultProps?: Record<string, unknown> }).defaultProps || {};
    this.props = { ...defaults, ...(props || {}) };
  }
  setState(update: Record<string, any>, cb?: () => void) {
    this.state = { ...this.state, ...update };
    if (cb) cb();
  }
}
const createElement = (type: unknown, props: Record<string, any> | null, ...children: unknown[]) => ({
  type,
  props: props || {},
  children,
});
const fakeReact = { Component: FakeComponent, Fragment: 'Fragment', createElement };

const moment = require('moment');
moment.suppressDeprecationWarnings = true;
moment.now = () => new Date('2026-10-12T12:00:00+08:00').valueOf();

const esm = <T>(value: T) => ({ __esModule: true, default: value });
const configModule = require('./config.ts');
const config = configModule.default || configModule;

/* ────────────────────────── A/B 双版本加载 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/task/containers/taskGantt/component/ganttDialog';
/** main可达的类型批次前 revision；冻结SHA与原协作基线相同 */
const BASE_REV = 'a3bd34da1e6ca32c7fd452bc15bf49ded33cfd01';
/** 原实现 index.tsx 的 sha256 冻结值 */
const ORIG_SHA = 'aa9c33cac03f5eb65292fddcdbec74ed6540330442a6a49239e0fbcbe5925738';

let cachedOrig: string | undefined;

function origSource(): string {
  if (cachedOrig === undefined) {
    cachedOrig = execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/index.tsx`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  return cachedOrig;
}

function assertOriginalIntact() {
  const actual = crypto.createHash('sha256').update(origSource()).digest('hex');
  assert.equal(actual, ORIG_SHA, `原实现 index.tsx（${BASE_REV}）的 sha256 与冻结值不符，A/B 对照失效`);
}

/* ────────────────────────── 可切换的依赖状态 ────────────────────────── */

/**
 * 每个用例通过这个可变对象控制替身行为；
 * A/B 两侧各自跑一遍时，重设为同一份初始状态，保证起点一致。
 */
const stub = {
  /** getToken 的返回：数组（正常） / 非数组（异常） / 拒绝（抛错） */
  token: 'ok' as 'ok' | 'not-array' | 'reject',
  /** axios.post 的返回：resolve（成功） / reject（失败） */
  post: 'ok' as 'ok' | 'reject',
  /** html2canvas 的返回 */
  canvas: 'ok' as 'ok' | 'reject',
  /** toDataURL 是否返回空 data URL（图片过长分支） */
  oversize: false,
};
const trace: string[] = [];

function resetStub() {
  stub.token = 'ok';
  stub.post = 'ok';
  stub.canvas = 'ok';
  stub.oversize = false;
  alertCalls = [];
  removedSelectors = [];
  appendedCount = 0;
  unhandled = [];
  productConsole = [];
  trace.length = 0;
}

function buildStubs(deps: Record<string, unknown>) {
  return {
    react: fakeReact,
    'react/jsx-runtime': jsxRuntimeFrom(createElement),
    lodash: require('lodash'),
    moment,
    classnames: require('classnames'),
    'ming-ui/components/Icon': esm((p: unknown) => createElement('Icon', p as never)),
    './config': config,
    './config.ts': config,
    './dataBoundary': require('./dataBoundary.ts'),
    'prop-types': { string: {}, func: {} },
    'ming-ui/components/Dialog': esm(deps['Dialog'] as never),
    'ming-ui/components/Dialog/DialogBase': esm(deps['DialogBase'] as never),
    'ming-ui/components/LoadDiv': esm(deps['LoadDiv'] as never),
    'src/components/errorPage/errorState': esm(deps['ErrorState'] as never),
    '../../../taskDetail/taskDetail': esm(deps['TaskDetail'] as never),
    'src/api/taskCenter': esm({ getTaskStaticGanttChart: () => Promise.resolve({ status: false }) }),
    './GanttContent': esm(deps['GanttContent'] as never),
    './GanttContent.tsx': esm(deps['GanttContent'] as never),
    './GanttHeader': esm(deps['GanttHeader'] as never),
    './GanttHeader.tsx': esm(deps['GanttHeader'] as never),
    './GanttSideBar': esm(deps['GanttSideBar'] as never),
    './GanttSideBar.tsx': esm(deps['GanttSideBar'] as never),
    './time': require('./time.ts'),
    './time.ts': require('./time.ts'),
    // ── 被测的导出/上传路径依赖 ──
    html2canvas: () => {
      trace.push('html2canvas');
      return stub.canvas === 'ok' ? Promise.resolve({ fake: 'canvas' }) : Promise.reject(new Error('canvas-fail'));
    },
    'src/utils/common': {
      downloadFile: (url: string) => `https://dl.test/?u=${encodeURIComponent(url)}`,
      getToken: () => {
        trace.push('getToken');
        if (stub.token === 'reject') return Promise.reject(new Error('token-fail'));
        if (stub.token === 'not-array') return Promise.resolve({ error: 'TOKEN_ERROR' });
        return Promise.resolve([{ bucket: 2, ext: '.png', key: 'KK/kk', uptoken: 'UPTOKEN' }]);
      },
    },
    'src/utils/commonRequestBoundary': {
      requireBase64FileToken: (res: unknown) => {
        trace.push('requireBase64FileToken');
        const first = Array.isArray(res) ? (res[0] as Record<string, unknown>) : {};
        return { key: first['key'], uptoken: first['uptoken'] };
      },
    },
    axios: {
      post: (url: string, body: string, options: unknown) => {
        trace.push(`post:${url}`);
        trace.push(`postBody:${body}`);
        trace.push(`postAuth:${JSON.stringify((options as any)?.headers?.Authorization ?? null)}`);
        if (stub.post === 'reject') return Promise.reject(new Error('post-fail'));
        return Promise.resolve({ data: { key: 'uploaded/key.png' } });
      },
    },
  };
}

/** jQuery 替身；记录 append/remove 以断言"临时容器被清理" */
const jqueryStub = (selector: string) => {
  const chain: any = {
    width: () => 800,
    height: () => 600,
    find: () => chain,
    clone: () => {
      trace.push('cloneBox');
      return chain;
    },
    css: () => chain,
    append: () => {
      appendedCount += 1;
      return chain;
    },
    remove: () => {
      removedSelectors.push(selector);
      return chain;
    },
    0: element('div', 'ganttContentBox'),
  };
  return chain;
};

/** 加载某个版本的 index.tsx */
function loadDialog(variant: 'orig' | 'current', deps: Record<string, unknown>) {
  const m: { exports: Record<string, any> } = { exports: {} };
  const stubs = buildStubs(deps);

  const req = (r: string) => {
    if (r in stubs) return stubs[r];
    if (r.endsWith('.less') || r.endsWith('.html')) return {};
    throw new Error(`spec 没给 ${r} 打桩（${variant}/index.tsx）`);
  };

  const filename = path.join(DIR, 'index.tsx');
  const babelOpts = {
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  const code =
    variant === 'orig'
      ? transformSync(origSource(), { ...babelOpts, filename }).code
      : transformFileSync(filename, babelOpts).code;
  new Function('module', 'exports', 'require', '$', code)(m, m.exports, req, jqueryStub);
  return m.exports.default;
}

const deps: Record<string, unknown> = {
  Dialog: (p: unknown) => createElement('Dialog', p as never),
  DialogBase: (p: unknown) => createElement('DialogBase', p as never),
  LoadDiv: (p: unknown) => createElement('LoadDiv', p as never),
  ErrorState: (p: unknown) => createElement('ErrorState', p as never),
  TaskDetail: (p: unknown) => createElement('TaskDetail', p as never),
  GanttContent: (p: unknown) => createElement('GanttContent', p as never),
  GanttHeader: (p: unknown) => createElement('GanttHeader', p as never),
  GanttSideBar: (p: unknown) => createElement('GanttSideBar', p as never),
};

/* ────────────────────────── 探针 ────────────────────────── */

/** 装好 canvas / 临时容器，然后跑 exportData 并等待上传链落定 */
async function runExport(variant: 'orig' | 'current', options: { oversize?: boolean } = {}) {
  const canvas = new FakeCanvas();
  canvas.dataUrl = options.oversize ? 'data:,' : 'data:image/png;base64,AAAA';
  const contentBox = element('div', 'ganttContentBox');
  domMap = { '#ganttCanvas': canvas, '.ganttContentBox': contentBox };

  const Dialog = loadDialog(variant, deps);
  const dialog = new Dialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, name: '项目甲' };

  let syncThrew: string | null = null;

  try {
    dialog.exportData();
  } catch (error) {
    syncThrew = error instanceof Error ? error.message : String(error);
  }

  await new Promise<void>(resolve => setImmediate(resolve));
  await new Promise<void>(resolve => setImmediate(resolve));

  return {
    syncThrew,
    unhandled: [...unhandled],
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    drawCalls: canvas.calls,
    appendedTempBox: appendedCount,
    removedSelectors,
    alerts: alertCalls.map(args => String(args[0])),
    productConsole: [...productConsole],
    state: {
      showExportDialog: dialog.state.showExportDialog ?? null,
      buildImgSuccess: dialog.state.buildImgSuccess ?? null,
      url: dialog.state.url ?? null,
    },
    trace: [...trace],
  };
}

/* ────────────────────────── 用例 ────────────────────────── */

const cases: { name: string; setup: () => void; run: (variant: 'orig' | 'current') => ReturnType<typeof runExport> }[] =
  [
    {
      name: '导出→上传成功：canvas 尺寸、绘制指令、上传 URL/载荷/鉴权、url 写回、临时容器被清理',
      setup: () => {
        stub.post = 'ok';
      },
      run: variant => runExport(variant),
    },
    {
      name: '图片过长（toDataURL 为空）：提示且不上传，临时容器仍被清理',
      setup: () => {
        stub.post = 'ok';
      },
      run: variant => runExport(variant, { oversize: true }),
    },
    {
      name: 'getToken 返回非数组：提示 token 错误且不上传',
      setup: () => {
        stub.token = 'not-array';
      },
      run: variant => runExport(variant),
    },
    {
      name: 'getToken 拒绝：走失败提示，不上传，临时容器已清理',
      setup: () => {
        stub.token = 'reject';
      },
      run: variant => runExport(variant),
    },
    {
      name: 'axios 上传拒绝：走失败提示，buildImgSuccess 保持 false、无 url',
      setup: () => {
        stub.post = 'reject';
      },
      run: variant => runExport(variant),
    },
    {
      name: 'html2canvas 拒绝：修复旧版残留容器与未处理拒绝',
      setup: () => {
        stub.canvas = 'reject';
      },
      run: variant => runExport(variant),
    },
  ];

/* ────────────────────────── 执行 A/B ────────────────────────── */

function stable(value: unknown): string {
  return JSON.stringify(value);
}

let activeCase = 'snapshot';

async function main(): Promise<void> {
  let failed = 0;

  try {
    assertOriginalIntact();
    realConsole.log('  ✓ 原实现快照完整（A/B 对照前提）');
  } catch (error) {
    failed += 1;
    realConsole.error(`  ✗ 原实现快照校验失败：${error instanceof Error ? error.message : String(error)}`);
  }

  for (const item of cases) {
    activeCase = item.name;
    // 两侧各自从同一初始状态出发
    resetStub();
    item.setup();
    const origState = { token: stub.token, post: stub.post, canvas: stub.canvas, oversize: stub.oversize };
    const origValue = await item.run('orig');

    resetStub();
    Object.assign(stub, origState);
    item.setup();
    const currentValue = await item.run('current');

    // A scoped clone and the old global selector own the same one temporary
    // container. Compare cleanup counts, while checking each intentional
    // failure-state change explicitly before comparing all other observations.
    const comparable = (value: Awaited<ReturnType<typeof runExport>>) => ({
      ...value,
      removedSelectors: value.removedSelectors.map(() => 'owned-clone'),
      productConsole: value.productConsole.map(line => line.replace(/^(log|error):/, 'failure:')),
    });
    const expected = comparable(origValue);
    const actual = comparable(currentValue);

    if (origState.canvas === 'reject') {
      assert.deepEqual(origValue.unhandled, ['canvas-fail']);
      assert.deepEqual(origValue.removedSelectors, []);
      assert.deepEqual(currentValue.unhandled, []);
      assert.equal(currentValue.removedSelectors.length, 1);
      assert.deepEqual(currentValue.alerts, ['保存失败!']);
      assert.equal(currentValue.state.showExportDialog, false);
      assert.ok(currentValue.productConsole.includes('error:Error: canvas-fail'));
      expected.unhandled = [];
      expected.removedSelectors = ['owned-clone'];
      expected.alerts = ['保存失败!'];
      expected.productConsole = ['failure:Error: canvas-fail'];
    } else if (origState.token !== 'ok' || origState.post === 'reject') {
      assert.equal(origValue.state.showExportDialog, true);
      assert.equal(currentValue.state.showExportDialog, false, 'failed upload closes its pending dialog for retry');
      expected.state = { ...expected.state, showExportDialog: false };
    }

    const same = stable(expected) === stable(actual);

    if (same) {
      realConsole.log(`  ✓ ${item.name}`);
    } else {
      failed += 1;
      realConsole.error(`  ✗ ${item.name}`);
      realConsole.error(`      原实现: ${stable(origValue).slice(0, 500)}`);
      realConsole.error(`      当前:   ${stable(currentValue).slice(0, 500)}`);
    }
  }

  if (failed) {
    realConsole.error(`ganttDialog 导出/上传规格失败 ${failed}/${cases.length} 项`);
    process.exitCode = 1;
    return;
  }

  realConsole.log(
    `ganttDialog 导出/上传规格通过：${cases.length} 项；正常路径与历史一致；错误路径显式验证关闭待处理弹窗、清理容器及处理拒绝`,
  );
}

// The unhandledRejection observer above records the legacy implementation's
// defect. Assertion/setup failures belong to the spec and must fail its process.
main().catch((error: unknown) => {
  realConsole.error(`Gantt export spec failed in ${activeCase}:`, error);
  process.exitCode = 1;
});
