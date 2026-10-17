/**
 * 甘特弹窗（ganttDialog）行为规格 —— 历史 A/B 对照版
 *
 * 对应 DSH 协作批次类型化的 6 个文件：
 *   GanttHeader.tsx / GanttSideBar.tsx / GraphBg.tsx / GraphContent.tsx
 *   GanttContent.tsx / index.tsx
 *
 * 【本规格的证明方式】lead 要求"正常有效输入必须与原实现等价"。做法是把**同一份探针**
 * 分别喂给两个版本，再逐字段比对结果：
 *   A = 类型批次之前的原实现（git revision 031b7ddb2，即 f80562ba5 的父提交）
 *   B = 当前工作区实现
 * 原实现从 git 读取并**校验 sha256**（与冻结值不符即失败），因此这条对照不会随工作区
 * 改动而漂移。只要 A 与 B 在所有探针上产出相同结果，就说明类型化没有改变行为。
 *
 * 【为什么不直接 import】与仓内既有 spec 一致：这些是浏览器代码（react / jQuery / DOM），
 * 用 spec-harness 动态编译，并只对真正用到的模块打桩。
 *
 * 【已知行为变化】原实现的下列行为与当前实现不同。它们**不参与 A/B 等价性断言**，而是
 * 单独分组断言"两侧确实不同"并记录双方取值，供 lead 决定拆成独立修复提交还是恢复原行为。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { jsxRuntimeFrom, transformFileSync, transformSync, ROOT } = require('../../../../../../../scripts/spec-harness.ts');

/* ────────────────────────── DOM 替身 ────────────────────────── */

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
    return this.calls.includes('drawImage') ? 'data:image/png;base64,AAAA' : 'data:,';
  }
}
Object.assign(globalThis, { HTMLElement: FakeHTMLElement, HTMLCanvasElement: FakeCanvas });
global._l = (s: string, ...args: unknown[]) => String(s).replace(/%(\d)/g, (_m, i) => String(args[Number(i)]));

const element = (_tag: string, className = '') => {
  const el = new FakeHTMLElement();
  el.className = className;
  return el;
};

let domMap: Record<string, unknown> = {};
Object.assign(globalThis, {
  document: {
    querySelector: (selector: string) => domMap[selector] ?? null,
    querySelectorAll: (selector: string) => domMap[selector] ?? [],
    getElementById: (id: string) => domMap[`#${id}`] ?? null,
  },
  // 导出流程（putb64）的异步回调会用到这些浏览器全局；探针⑧只比对同步可观测的
  // canvas 结果，但这些替身必须存在，否则回调抛错会变成未处理拒绝并杀掉进程。
  window: { open: () => {} },
  alert: () => {},
  btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  md: { global: { FileStoreConfig: { uploadHost: 'https://upload.test', pubHost: 'https://pub.test' } } },
});

/* ────────────────────────── react / 依赖替身 ────────────────────────── */

class FakeComponent {
  props: Record<string, any>;
  state: Record<string, any> = {};
  constructor(props: Record<string, any>) {
    // 真实 React 会在构造前把 defaultProps 合并进来（defaults 在下、传入值在上）。
    // 替身必须照做：否则"未传可选 prop"的场景会得到与生产不同的 props，
    // 把"类型上必须写 ?."误测成"行为变化"。
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
// 固定"今天"，否则周末底色/今日线/scrollToToday 的期望值会随运行日期漂移
moment.now = () => new Date('2026-10-12T12:00:00+08:00').valueOf();

const esm = <T>(value: T) => ({ __esModule: true, default: value });
const configModule = require('./config.ts');
const config = configModule.default || configModule;

/* ────────────────────────── 双版本加载 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/task/containers/taskGantt/component/ganttDialog';
/** 类型批次之前的最后一个 revision（f80562ba5 的父提交） */
const BASE_REV = '031b7ddb23d97dbd90d792be8afb2ed69b30176b';

/** 原实现 6 文件的 sha256 冻结值；任何一项不符即中止 A/B 对照 */
const ORIG_SHA: Record<string, string> = {
  'GanttContent.tsx': 'ba81892f98806145edba5ee235b55e332a52d71fbc4b45e5de9117d5c0960584',
  'GanttSideBar.tsx': 'a7e7874cfd1257beeceb1fa03ebd53e707057b629c13b03d90dc14373c7a5a28',
  'GraphBg.tsx': 'f86e983a76e40eec83508c77b85d712358cac5d815e584b00b25f0878334a24f',
  'GraphContent.tsx': 'd32f3bf4c1b40a9885b77fd49abb491e60a784c9b31fb9edbd928c0060cf12bd',
  'GanttHeader.tsx': 'ba9729a30c15618bd8cdc2e13d5852ed63c8aa5ee7d5734d804178a1ff4c27f2',
  'index.tsx': 'aa9c33cac03f5eb65292fddcdbec74ed6540330442a6a49239e0fbcbe5925738',
};

/** 从 git revision 取原实现源码，避免在工作区新增文件 */
const origSourceCache: Record<string, string> = {};
function origSource(file: string): string {
  if (origSourceCache[file] === undefined) {
    origSourceCache[file] = execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return origSourceCache[file];
}

function assertOriginalIntact() {
  for (const [name, sha] of Object.entries(ORIG_SHA)) {
    const actual = crypto.createHash('sha256').update(origSource(name)).digest('hex');
    assert.equal(actual, sha, `原实现 ${name}（${BASE_REV}）的 sha256 与冻结值不符，A/B 对照失效`);
  }
}

/**
 * 加载某个版本的源文件。
 * @param variant 'orig'（git 基线）或 'current'（工作区）
 */
function load(
  variant: 'orig' | 'current',
  file: string,
  stubs: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const m: { exports: Record<string, any> } = { exports: {} };
  const req = (r: string) => {
    if (r in stubs) return stubs[r];
    if (r.endsWith('.less') || r.endsWith('.html')) return {};
    throw new Error(`spec 没给 ${r} 打桩（${variant}/${file}）`);
  };
  const filename = path.join(DIR, file);
  const babelOpts = {
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  // 原实现来自 git 内容 → 用 transformSync 并显式给 filename（决定 TS/TSX 解析）
  const code =
    variant === 'orig'
      ? transformSync(origSource(file), { ...babelOpts, filename }).code
      : transformFileSync(filename, babelOpts).code;
  const names = ['module', 'exports', 'require', ...Object.keys(extra)];
  // 原实现的 index.tsx 直接用 $，作为额外形参注入（两版一致）
  new Function(...names, code)(m, m.exports, req, ...Object.values(extra));
  return m.exports;
}

/* ────────────────────────── 结构指纹 ────────────────────────── */

/**
 * 把渲染树压成与实现细节无关的指纹：只保留标签/类名/关键 props/文本。
 * 事件回调只记存在性（`[fn]`），因为两侧的回调是不同函数实例。
 */
function fingerprint(node: unknown, depth = 0): unknown {
  if (node === null || node === undefined) return null;
  if (typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(child => fingerprint(child, depth));
  if (typeof node !== 'object') return String(node);

  const n = node as any;
  const tag = typeof n.type === 'string' ? n.type : `[fn:${n.type?.name || 'anon'}]`;
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(n.props || {}).sort()) {
    if (key === 'children') continue;
    // onCancel 属于已记录的行为变化（见文件末尾"行为变化"分组），
    // 从这里剔除，否则它会掩盖其余结构是否等价。
    if (key === 'onCancel') continue;
    const value = n.props[key];
    if (key === 'style' && value && typeof value === 'object') {
      props['style'] = Object.fromEntries(Object.entries(value).sort());
    } else if (typeof value === 'function') {
      props[key] = '[fn]';
    } else if (
      key === 'className' ||
      key === 'width' ||
      key === 'height' ||
      key === 'left' ||
      key === 'paddingLeft' ||
      key === 'state' ||
      key === 'status' ||
      key === 'visible' ||
      key === 'text'
    ) {
      props[key] = value;
    }
  }
  const kids = n.props?.children !== undefined ? n.props.children : n.children;
  return { tag, props, children: kids === undefined ? [] : fingerprint(kids, depth + 1) };
}

function walk(node: unknown, visit: (n: any) => void) {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) return node.forEach(child => walk(child, visit));
  if (typeof node !== 'object') return;
  const n = node as any;
  visit(n);
  const kids = n.props?.children !== undefined ? n.props.children : n.children;
  if (kids !== undefined) walk(kids, visit);
}

const findAll = (root: unknown, predicate: (n: any) => boolean) => {
  const out: any[] = [];
  walk(root, n => {
    if (predicate(n)) out.push(n);
  });
  return out;
};
const byClass = (root: unknown, token: string) =>
  findAll(
    root,
    n => typeof n.props?.className === 'string' && n.props.className.split(/\s+/).filter(Boolean).includes(token),
  );
const byType = (root: unknown, type: unknown) => findAll(root, n => n.type === type);

/**
 * 找出两个 JSON 化结果的第一处差异路径，用于把 A/B 失败定位到具体字段，
 * 而不是只丢出两段被截断的 JSON。
 */
function firstDiff(a: unknown, b: unknown, at = '$'): string {
  if (a === b) return '';
  if (typeof a !== typeof b) return `${at}: 类型不同 ${typeof a} vs ${typeof b}`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${at}: 一侧不是数组`;
    if (a.length !== b.length) return `${at}: 长度不同 ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${at}[${i}]`);
      if (d) return d;
    }
    return '';
  }
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a as Record<string, unknown>).sort();
    const kb = Object.keys(b as Record<string, unknown>).sort();
    if (ka.join(',') !== kb.join(',')) return `${at}: 字段集合不同 [${ka.join(',')}] vs [${kb.join(',')}]`;
    for (const k of ka) {
      const d = firstDiff(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${at}.${k}`,
      );
      if (d) return d;
    }
    return '';
  }
  return `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

/* ────────────────────────── 断言脚手架 ────────────────────────── */

const failures: string[] = [];
let checks = 0;
function check(name: string, fn: () => void) {
  checks += 1;
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* ────────────────────────── 场景数据 ────────────────────────── */

const TIME_ENTRIES = [
  { pub: '2026.10', sub: ['1', '2'] },
  { pub: '2026.11', sub: ['3'] },
];
const TASK_TREE = [
  { taskID: 'a', taskName: 'A', child: [{ taskID: 'a1', taskName: 'A1' }], childrenVisible: true },
  { taskID: 'b', taskName: 'B' },
];
const CONTENT_PROPS = {
  width: 44,
  beginTime: moment('2026-10-01'),
  handleTaskItemHover: () => {},
  showDetail: () => {},
};
const FULL_TASK = {
  taskID: 't1',
  taskName: '任务一',
  startTime: '2026-10-02 00:00:00',
  deadline: '2026-10-04 00:00:00',
  actualStartTime: '2026-10-03 00:00:00',
  completeTime: '2026-10-03 00:00:00',
};

interface Deps {
  ProcessBar: unknown;
  TimeHeader: unknown;
  GraphContentStub: unknown;
  GraphBgStub: unknown;
  GanttHeaderStub: unknown;
  GanttSideBarStub: unknown;
  DialogBase: unknown;
  Dialog: unknown;
  ErrorState: unknown;
  LoadDiv: unknown;
  TaskDetail: unknown;
}

/**
 * 把 API 替身做成"同步 thenable"：产品代码用 `.then(...)` 取结果，
 * 同步 thenable 让这条异步路径在规格里可确定性驱动（不依赖真实事件循环）。
 */
const syncApi = (payload: unknown) => ({
  __esModule: true,
  default: {
    getTaskStaticGanttChart: () => ({
      then: (onFulfilled: (value: unknown) => unknown) => {
        onFulfilled(payload);
        return { catch: () => {} };
      },
    }),
  },
});

/** jQuery 替身：链式返回自身，附带可控的 width/height/find/clone/css */
const jqueryStub = (_selector: string) => {
  const chain: any = {
    width: () => 800,
    height: () => 600,
    find: () => chain,
    clone: () => chain,
    css: () => chain,
    append: () => chain,
    remove: () => chain,
    0: element('div', 'ganttContentBox'),
  };
  return chain;
};

function buildStubs(deps: Deps) {
  return {
    react: fakeReact,
    'react/jsx-runtime': jsxRuntimeFrom(createElement),
    lodash: require('lodash'),
    moment,
    classnames: require('classnames'),
    'ming-ui/components/Icon': esm((props: unknown) => createElement('Icon', props as never)),
    './config': config,
    './config.ts': config,
    './ProcessBar': esm(deps.ProcessBar),
    './ProcessBar.tsx': esm(deps.ProcessBar),
    './TimeHeader': esm(deps.TimeHeader),
    './TimeHeader.tsx': esm(deps.TimeHeader),
    './GanttContent': esm(deps.GraphContentStub),
    './GanttContent.tsx': esm(deps.GraphContentStub),
    './GraphContent': esm(deps.GraphContentStub),
    './GraphContent.tsx': esm(deps.GraphContentStub),
    './GraphBg': esm(deps.GraphBgStub),
    './GraphBg.tsx': esm(deps.GraphBgStub),
    './GanttHeader': esm(deps.GanttHeaderStub),
    './GanttHeader.tsx': esm(deps.GanttHeaderStub),
    './GanttSideBar': esm(deps.GanttSideBarStub),
    './GanttSideBar.tsx': esm(deps.GanttSideBarStub),
    'ming-ui/components/Dialog': esm(deps.Dialog),
    'ming-ui/components/Dialog/DialogBase': esm(deps.DialogBase),
    'ming-ui/components/LoadDiv': esm(deps.LoadDiv),
    'src/components/errorPage/errorState': esm(deps.ErrorState),
    '../../../taskDetail/taskDetail': esm(deps.TaskDetail),
    // getData 的数据源：本规格不驱动真实请求，只提供可加载的替身
    'src/api/taskCenter': esm({ getTaskStaticGanttChart: () => Promise.resolve({ status: false }) }),
    'prop-types': { string: {}, func: {} },
    'src/utils/common': {
      downloadFile: (url: string) => `https://dl.test/?u=${encodeURIComponent(url)}`,
      getToken: () => Promise.resolve([{ bucket: 2, ext: '.png', key: 'kk', uptoken: 'up' }]),
    },
    'src/utils/commonRequestBoundary': { requireBase64FileToken: () => ({ key: 'kk', uptoken: 'up' }) },
    axios: { post: () => Promise.resolve({ data: { key: 'k1' } }) },
    html2canvas: () => Promise.resolve({ fake: 'canvas' }),
    './time': require('./time.ts'),
    './time.ts': require('./time.ts'),
  };
}

/** 载入某个版本的 6 个组件；每个探针重新载入，避免实例状态互相污染 */
function loadAll(variant: 'orig' | 'current', deps: Deps, overrides: Record<string, unknown> = {}) {
  const stubs = { ...buildStubs(deps), ...overrides };
  return {
    GanttHeader: load(variant, 'GanttHeader.tsx', stubs).default,
    GanttSideBar: load(variant, 'GanttSideBar.tsx', stubs).default,
    GraphBg: load(variant, 'GraphBg.tsx', stubs).default,
    GraphContent: load(variant, 'GraphContent.tsx', stubs).default,
    GanttContent: load(variant, 'GanttContent.tsx', stubs, {}).default,
    GanttDialog: load(variant, 'index.tsx', stubs, { $: jqueryStub }).default,
  };
}

type Probe = { name: string; run: (mods: any, deps: Deps) => unknown; overrides?: Record<string, unknown> };

/** lead 点名的场景；A/B 两侧共用同一份探针 */
function probes(): Probe[] {
  return [
    {
      name: '① 正常加载（头部/侧栏/内容区/背景的完整结构）',
      run: m => {
        const header = new m.GanttHeader({
          type: 'week',
          data: TASK_TREE,
          name: '项目甲',
          switchDisplayType: () => {},
          refresh: () => {},
          exportData: () => {},
          closeLayer: () => {},
          scrollToToday: () => {},
        }).render();
        const sidebar = new m.GanttSideBar({
          data: TASK_TREE,
          handleTaskItemHover: () => {},
          toggleTask: () => {},
          showDetail: () => {},
        }).render();
        const bg = new m.GraphBg({ time: TIME_ENTRIES, type: 'week', durFromBeginToToday: 2 }).render();
        const content = new m.GraphContent({ ...CONTENT_PROPS, data: [FULL_TASK] }).render();
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        dialog.state = { ...dialog.state, loading: false, data: TASK_TREE, name: '项目甲' };
        return {
          header: fingerprint(header),
          sidebar: fingerprint(sidebar),
          bg: fingerprint(bg),
          content: fingerprint(content),
          dialog: fingerprint(dialog.render()),
        };
      },
    },

    {
      name: '② 空数据（头部空态/空列表/空背景/空状态页）',
      run: m => {
        const header = new m.GanttHeader({
          type: 'day',
          data: [],
          name: '空项目',
          switchDisplayType: () => {},
          refresh: () => {},
          exportData: () => {},
          closeLayer: () => {},
          scrollToToday: () => {},
        }).render();
        const sidebar = new m.GanttSideBar({
          data: [],
          handleTaskItemHover: () => {},
          toggleTask: () => {},
          showDetail: () => {},
        }).render();
        const bg = new m.GraphBg({ time: [], type: 'day', durFromBeginToToday: 0 }).render();
        const content = new m.GraphContent({ ...CONTENT_PROPS, data: [] }).render();
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        dialog.state = { ...dialog.state, loading: false, data: [] };
        return {
          header: fingerprint(header),
          sidebar: fingerprint(sidebar),
          bg: fingerprint(bg),
          content: fingerprint(content),
          emptyState: fingerprint(dialog.render()),
        };
      },
    },

    {
      name: '③ 横向滚动（getPosList 采集 / getIndex 命中 / handleScroll 写 padding）',
      run: m => {
        const content = new m.GanttContent({
          type: 'day',
          beginTime: moment('2026-10-01'),
          endTime: moment('2026-10-03'),
          data: [],
          handleTaskItemHover: () => {},
          showDetail: () => {},
        });
        const boxes = [0, 100, 250].map(left => {
          const el = element('div', 'pubTime');
          el.offsetLeft = left;
          return el;
        });
        content.getPosList(boxes);
        const indexes = [0, 50, 100, 175, 250, 9999].map(v => content.getIndex(v));
        const scroller = element('div');
        scroller.scrollLeft = 130;
        content.handleScroll(scroller);
        const paddingLeft = boxes.map(b => b.style.paddingLeft ?? null);

        const single = new m.GanttContent({
          type: 'day',
          beginTime: moment('2026-10-01'),
          endTime: moment('2026-10-03'),
          data: [],
          handleTaskItemHover: () => {},
          showDetail: () => {},
        });
        single.getPosList([element('div', 'pubTime')]);

        return { posList: content.posList, indexes, paddingLeft, singleGetIndex: single.getIndex(50) };
      },
    },

    {
      name: '④ 纵向滚动（两侧互相同步 + mouseover 记录滚动元素）',
      run: m => {
        const graphWrap = element('div', 'graphWrap');
        const taskListWrap = element('div', 'taskListWrap');
        const out: unknown[] = [];

        taskListWrap.scrollTop = 42;
        // computeBgHeight 会读这两个节点；两版都要能跑通，避免把"探针缺桩"误判成产品差异
        const graphContent = element('div', 'graphContent');
        const graphBg = element('div', 'graphBg');
        graphContent.getBoundingClientRect = () => ({ top: 0, width: 0, height: 100 });
        graphWrap.getBoundingClientRect = () => ({ top: 0, width: 0, height: 200 });
        domMap = {
          '.graphWrap': graphWrap,
          '.taskListWrap': taskListWrap,
          '.graphContent': graphContent,
          '.graphBg': graphBg,
        };
        const sidebar = new m.GanttSideBar({
          data: [],
          handleTaskItemHover: () => {},
          toggleTask: () => {},
          showDetail: () => {},
        });
        sidebar.taskList = taskListWrap;
        sidebar.componentDidMount();
        out.push({ sidebarHandlers: taskListWrap.listeners['scroll']?.length ?? 0 });

        config.scrollingEle = 'other';
        taskListWrap.listeners['scroll'][0]();
        out.push({ afterMismatch: graphWrap.scrollTop });
        config.scrollingEle = 'taskListWrap';
        taskListWrap.listeners['scroll'][0]();
        out.push({ afterMatch: graphWrap.scrollTop });
        taskListWrap.listeners['mouseover'][0]();
        out.push({ scrollingEle: config.scrollingEle });

        const content = new m.GanttContent({
          type: 'day',
          beginTime: moment('2026-10-01'),
          endTime: moment('2026-10-03'),
          data: [],
          handleTaskItemHover: () => {},
          showDetail: () => {},
        });
        content.graphWrap = graphWrap;
        content.componentDidMount();
        out.push({ contentHandlers: graphWrap.listeners['scroll']?.length ?? 0 });
        graphWrap.className = 'graphWrap';
        config.scrollingEle = 'graphWrap';
        graphWrap.scrollTop = 88;
        const handlers = graphWrap.listeners['scroll'];
        handlers[handlers.length - 1]();
        out.push({ taskListTop: taskListWrap.scrollTop });
        return out;
      },
    },

    {
      name: '⑤ 日期背景高度与各粒度宽度',
      run: m => {
        const graphContent = element('div', 'graphContent');
        const graphWrap = element('div', 'graphWrap');
        const graphBg = element('div', 'graphBg');
        const taskListWrap = element('div', 'taskListWrap');
        graphContent.getBoundingClientRect = () => ({ top: 0, width: 0, height: 120 });
        graphWrap.getBoundingClientRect = () => ({ top: 0, width: 0, height: 300 });
        domMap = {
          '.graphContent': graphContent,
          '.graphWrap': graphWrap,
          '.graphBg': graphBg,
          '.taskListWrap': taskListWrap,
        };
        const content = new m.GanttContent({
          type: 'day',
          beginTime: moment('2026-10-01'),
          endTime: moment('2026-10-03'),
          data: [],
          handleTaskItemHover: () => {},
          showDetail: () => {},
        });
        content.computeBgHeight();

        const widths: Record<string, unknown> = {};
        const todayStyles: Record<string, unknown> = {};
        for (const type of ['day', 'week', 'month'] as const) {
          const tree = new m.GraphBg({ time: TIME_ENTRIES, type, durFromBeginToToday: 3 }).render();
          widths[type] = byClass(tree, 'subBg').map(n => n.props.style.width);
          todayStyles[type] = byClass(tree, 'isToday').map(n => n.props.style);
        }
        return {
          bgHeight: graphBg.style.height ?? null,
          taskListHeight: taskListWrap.style.height ?? null,
          widths,
          todayStyles,
        };
      },
    },

    {
      name: '⑥ 任务展开/收起（序号、缩进、图标、toggleTask 路径、内容区递归）',
      run: m => {
        const toggled: number[][] = [];
        const sidebar = new m.GanttSideBar({
          data: TASK_TREE,
          handleTaskItemHover: () => {},
          toggleTask: (args: number[]) => toggled.push(args),
          showDetail: () => {},
        });
        const tree = sidebar.render();
        byClass(tree, 'toggleTask').forEach(n => n.props.onClick());

        const details: string[] = [];
        const detailSidebar = new m.GanttSideBar({
          data: TASK_TREE,
          handleTaskItemHover: () => {},
          toggleTask: () => {},
          showDetail: (id: string) => details.push(id),
        });
        const detailTree = detailSidebar.render();
        byClass(detailTree, 'name').forEach(n => n.props.onClick());

        const child = {
          taskID: 'c1',
          taskName: 'C1',
          startTime: '2026-10-02 00:00:00',
          deadline: '2026-10-02 00:00:00',
        };
        const expanded = new m.GraphContent({
          ...CONTENT_PROPS,
          data: [{ taskID: 'p', taskName: 'P', child: [child], childrenVisible: true }],
        }).render();
        const collapsed = new m.GraphContent({
          ...CONTENT_PROPS,
          data: [{ taskID: 'p', taskName: 'P', child: [child], childrenVisible: false }],
        }).render();
        return {
          taskItems: byClass(tree, 'taskItem').length,
          paddingLeft: byClass(tree, 'taskInfo').map(n => n.props.style.paddingLeft),
          seq: byClass(tree, 'seq').map(n => (Array.isArray(n.children) ? n.children[0] : n.children)),
          toggleClasses: byClass(tree, 'toggleTask').map(n => n.props.className),
          toggled,
          details,
          expandedWrap: byClass(expanded, 'processWrap').length,
          collapsedWrap: byClass(collapsed, 'processWrap').length,
          expandedNames: byClass(expanded, 'taskName').map(n => n.children),
        };
      },
    },

    {
      name: '⑦ hover 层（activeLayer 的显示/隐藏与 top 计算）',
      run: m => {
        const activeLayer = element('div', 'activeLayer');
        domMap = { '.activeLayer': activeLayer };
        const dialog = new m.GanttDialog({ folderID: 'f1' });

        const low = element('div');
        low.getBoundingClientRect = () => ({ top: 100, width: 0, height: 0 }); // top-51 = 49 < 50
        dialog.handleTaskItemHover(true, { currentTarget: low });
        const afterLow = { display: activeLayer.style.display ?? null, top: activeLayer.style.top ?? null };

        const high = element('div');
        high.getBoundingClientRect = () => ({ top: 200, width: 0, height: 0 });
        dialog.handleTaskItemHover(true, { currentTarget: high });
        const afterHigh = { display: activeLayer.style.display ?? null, top: activeLayer.style.top ?? null };

        dialog.handleTaskItemHover(false);
        const afterHide = { display: activeLayer.style.display ?? null, top: activeLayer.style.top ?? null };
        return { afterLow, afterHigh, afterHide };
      },
    },

    {
      name: '⑧ 导出与清理（canvas 尺寸、绘制指令）',
      run: m => {
        const canvas = new FakeCanvas();
        const box = element('div', 'ganttContentBox');
        domMap = { '#ganttCanvas': canvas, '.ganttContentBox': box };
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        dialog.state = { ...dialog.state, name: '项目甲' };
        dialog.exportData();
        // 上传/关闭在 Promise 回调里异步发生，这里比对同步可观测的 canvas 结果
        return { canvasWidth: canvas.width, canvasHeight: canvas.height, calls: canvas.calls };
      },
    },

    {
      name: '⑧b getData 错误分支（status:false → loading/refreshLoading 关闭并记录 errorMsg）',
      overrides: {
        'src/api/taskCenter': syncApi({ status: false, error: { msg: '拉取失败' } }),
      },
      run: m => {
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        dialog.getData();
        return {
          loading: dialog.state.loading,
          refreshLoading: dialog.state.refreshLoading,
          errorMsg: dialog.state.errorMsg,
          data: dialog.state.data,
          rendered: (() => {
            try {
              return fingerprint(dialog.render()) === null ? 'null' : 'ok';
            } catch {
              return '抛错';
            }
          })(),
        };
      },
    },

    {
      name: '⑧c getData 正常分支（数组任务 → childrenVisible 置位、时间范围外扩、名称写入）',
      overrides: {
        'src/api/taskCenter': syncApi({
          status: true,
          data: {
            taskData: [
              { taskID: 'a', taskName: 'A', child: [{ taskID: 'a1', taskName: 'A1' }] },
              { taskID: 'b', taskName: 'B' },
            ],
            minStartTime: '2026-10-10 00:00:00',
            maxCompleteTime: '2026-10-20 00:00:00',
            folderName: '项目甲',
          },
        }),
      },
      run: m => {
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        dialog.getData();
        return {
          loading: dialog.state.loading,
          name: dialog.state.name,
          dataShape: (dialog.state.data || []).map((t: any) => ({
            taskID: t.taskID,
            childrenVisible: t.childrenVisible ?? null,
            childCount: (t.child || []).length,
            childVisible: t.child && t.child[0] ? (t.child[0].childrenVisible ?? null) : null,
          })),
          beginTime: String(dialog.state.beginTime?.format?.('YYYY-MM-DD') ?? dialog.state.beginTime),
          endTime: String(dialog.state.endTime?.format?.('YYYY-MM-DD') ?? dialog.state.endTime),
        };
      },
    },

    {
      name: '⑧d 弹窗级任务展开/收起（toggleTask 深拷贝后写回 state）',
      run: m => {
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        const original = [{ taskID: 'a', taskName: 'A', childrenVisible: true, child: [{ taskID: 'a1', taskName: 'A1', childrenVisible: false }] }];
        dialog.state = { ...dialog.state, data: original };
        dialog.toggleTask([0]);
        const afterTop = { state: dialog.state.data[0].childrenVisible, original: original[0].childrenVisible };
        dialog.toggleTask([0, 0]);
        const afterChild = {
          state: dialog.state.data[0].child[0].childrenVisible,
          original: original[0].child[0].childrenVisible,
        };
        return { afterTop, afterChild, stateIsSameObjectAsOriginal: dialog.state.data === original };
      },
    },

    {
      name: '⑧e 切换粒度（switchDisplayType 重算时间范围）',
      run: m => {
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        // switchDisplayType 从共享 config 读取未调整的起止时间，先按原实现的方式写入
        config.beginTime = moment('2026-10-10 00:00:00');
        config.endTime = moment('2026-10-20 00:00:00');
        const out: Record<string, unknown> = {};
        for (const type of ['day', 'week', 'month']) {
          dialog.switchDisplayType(type as never);
          out[type] = {
            stateType: dialog.state.type,
            begin: String(dialog.state.beginTime?.format?.('YYYY-MM-DD') ?? dialog.state.beginTime),
            end: String(dialog.state.endTime?.format?.('YYYY-MM-DD') ?? dialog.state.endTime),
          };
        }
        return out;
      },
    },

    {
      name: '⑧f 显示详情（showDetail 写入 taskID 并打开详情）',
      run: m => {
        const dialog = new m.GanttDialog({ folderID: 'f1' });
        const before = { taskID: dialog.state.taskID, visible: dialog.state.taskDetailVisible };
        dialog.showDetail('task-42');
        return { before, after: { taskID: dialog.state.taskID, visible: dialog.state.taskDetailVisible } };
      },
    },

    {
      name: '⑨ 关闭弹窗（closeLayer 收到 false）',
      run: m => {
        const calls: boolean[] = [];
        const dialog = new m.GanttDialog({ folderID: 'f1', closeLayer: (v: boolean) => calls.push(v) });
        dialog.closeLayer();
        return { calls };
      },
    },
  ];
}

/* ────────────────────────── 执行 A/B 对照 ────────────────────────── */

const deps: Deps = {
  ProcessBar: (props: unknown) => createElement('ProcessBar', props as never),
  TimeHeader: (props: unknown) => createElement('TimeHeader', props as never),
  GraphContentStub: (props: unknown) => createElement('GraphContent', props as never),
  GraphBgStub: (props: unknown) => createElement('GraphBg', props as never),
  GanttHeaderStub: (props: unknown) => createElement('GanttHeader', props as never),
  GanttSideBarStub: (props: unknown) => createElement('GanttSideBar', props as never),
  DialogBase: (props: unknown) => createElement('DialogBase', props as never),
  Dialog: (props: unknown) => createElement('Dialog', props as never),
  ErrorState: (props: unknown) => createElement('ErrorState', props as never),
  LoadDiv: (props: unknown) => createElement('LoadDiv', props as never),
  TaskDetail: (props: unknown) => createElement('TaskDetail', props as never),
};

check('原实现快照完整（A/B 对照前提）', () => assertOriginalIntact());

const abResults: { name: string; same: boolean; orig: unknown; current: unknown }[] = [];

for (const probe of probes()) {
  check(probe.name, () => {
    // globals（config.scrollingEle 等）在两侧各重置一次，保证起点一致
    const overrides = probe.overrides || {};
    config.scrollingEle = '';
    const origValue = probe.run(loadAll('orig', deps, overrides), deps);
    config.scrollingEle = '';
    const currentValue = probe.run(loadAll('current', deps, overrides), deps);

    const same = JSON.stringify(origValue) === JSON.stringify(currentValue);
    abResults.push({ name: probe.name, same, orig: origValue, current: currentValue });
    assert.equal(
      same,
      true,
      `A/B 不一致，第一处差异 → ${firstDiff(origValue, currentValue)}\n      原实现: ${JSON.stringify(origValue).slice(0, 600)}\n      当前:   ${JSON.stringify(currentValue).slice(0, 600)}`,
    );
  });
}

/* ────────────────────────── 行为变化（与类型等价性分离） ────────────────────────── */

/**
 * 这 3 项是已知的、有意与"纯类型改造"分离的行为差异。它们**不参与 A/B 等价性断言**，
 * 而是断言两侧确实不同并记录双方取值，供 lead 决定：拆成独立修复提交，或恢复原行为。
 */
const BEHAVIOUR_CHANGES: { name: string; run: (m: any) => unknown; loadOverrides?: Record<string, unknown> }[] = [
  {
    name: 'state.beginTime/endTime 初始值',
    run: m => {
      const dialog = new m.GanttDialog({ folderID: 'f1' });
      const b = dialog.state.beginTime;
      const isMoment = typeof b === 'object' && b !== null && typeof b.isValid === 'function';
      return { type: typeof b, isMoment, asString: String(b) };
    },
  },
  {
    name: 'getData 对非数组 taskData 的兜底（调用点 ?? []）',
    // 用同步 thenable 驱动 getData 的赋值路径，使异步调用点在规格里可控
    loadOverrides: {
      'src/api/taskCenter': {
        __esModule: true,
        default: {
          getTaskStaticGanttChart: () => ({
            then: (onFulfilled: (value: unknown) => unknown) => {
              onFulfilled({
                status: true,
                data: {
                  taskData: 'not-an-array',
                  minStartTime: '2026-10-01 00:00:00',
                  maxCompleteTime: '2026-10-05 00:00:00',
                  folderName: 'F',
                },
              });
              return { catch: () => {} };
            },
          }),
        },
      },
    },
    run: m => {
      const dialog = new m.GanttDialog({ folderID: 'f1' });
      dialog.getData();
      const dataIsUndefined = dialog.state.data === undefined;
      let renderThrew = false;
      try {
        dialog.render();
      } catch {
        renderThrew = true;
      }
      return { dataIsUndefined, renderThrew, dataKind: Array.isArray(dialog.state.data) ? 'array' : typeof dialog.state.data };
    },
  },
];

/**
 * 已恢复原行为、因此**不再**属于行为变化的项：显式断言两版一致，
 * 防止后续改动又把 onCancel 接上（那是独立的行为修复，应单独提交）。
 */
const RESTORED_BEHAVIOUR: { name: string; run: (m: any) => unknown }[] = [
  {
    name: 'closeLayer 缺失时不抛错（defaultProps 会补上，两版一致）',
    run: m => {
      const bare = new m.GanttDialog({ folderID: 'f1' });
      let threw = false;
      try {
        bare.closeLayer();
      } catch {
        threw = true;
      }
      return { threw };
    },
  },
  {
    name: 'DialogBase 的 onCancel 对 DialogBase 可观测值一致（原实现传的是显式 undefined）',
    // 原实现写 onCancel={this.handleClose}，而 handleClose 不存在 → 传给 createElement 的
    // 是 { onCancel: undefined }（键在、值为 undefined）。当前实现改为完全不传该 prop。
    // 两者对 DialogBase 的可观测结果相同：读 this.props.onCancel 都是 undefined，
    // 因此不会因此改变关闭行为。这里比对"可观测值"而不是"键是否存在"。
    run: m => {
      const calls: boolean[] = [];
      const dialog = new m.GanttDialog({ folderID: 'f1', closeLayer: (v: boolean) => calls.push(v) });
      const base = byType(dialog.render(), deps.DialogBase)[0];
      const cancel = base?.props?.onCancel;
      return { typeofOnCancel: typeof cancel, isUndefined: cancel === undefined, calls };
    },
  },
];

const changes: { name: string; orig: unknown; current: unknown; differs: boolean }[] = [];
for (const item of BEHAVIOUR_CHANGES) {
  check(`行为变化识别：${item.name}`, () => {
    const overrides = item.loadOverrides || {};
    config.scrollingEle = '';
    const origValue = item.run(loadAll('orig', deps, overrides));
    config.scrollingEle = '';
    const currentValue = item.run(loadAll('current', deps, overrides));
    const differs = JSON.stringify(origValue) !== JSON.stringify(currentValue);
    changes.push({ name: item.name, orig: origValue, current: currentValue, differs });
    // 必须确实不同；若相同说明该"变化"已不存在，报告需要更新
    assert.equal(
      differs,
      true,
      `该行为变化已不存在（两侧相同：${JSON.stringify(currentValue)}），报告需更正`,
    );
  });
}

/* ────────────────────────── 已确认等价（曾被误判为行为变化） ────────────────────────── */

const restored: { name: string; orig: unknown; current: unknown }[] = [];
for (const item of RESTORED_BEHAVIOUR) {
  check(`已确认等价：${item.name}`, () => {
    config.scrollingEle = '';
    const origValue = item.run(loadAll('orig', deps));
    config.scrollingEle = '';
    const currentValue = item.run(loadAll('current', deps));
    restored.push({ name: item.name, orig: origValue, current: currentValue });
    assert.equal(
      JSON.stringify(origValue),
      JSON.stringify(currentValue),
      `两版应一致（原 ${JSON.stringify(origValue)} / 当前 ${JSON.stringify(currentValue)}）`,
    );
  });
}

/* ────────────────────────── 汇总 ────────────────────────── */

if (process.env['GANTT_AB_REPORT']) {
  fs.writeFileSync(
    String(process.env['GANTT_AB_REPORT']),
    JSON.stringify(
      {
        baseRevision: BASE_REV,
        ab: abResults.map(r => ({ name: r.name, same: r.same })),
        changes: changes.map(c => ({ name: c.name, differs: c.differs, orig: c.orig, current: c.current })),
        restoredEquivalent: restored.map(r => ({ name: r.name, orig: r.orig, current: r.current })),
      },
      null,
      2,
    ),
  );
}

if (failures.length) {
  console.error(failures.map(f => `  ✗ ${f}`).join('\n'));
  throw new Error(`ganttDialog 行为规格失败 ${failures.length}/${checks} 项`);
}

console.log(
  `ganttDialog 行为规格通过：${checks} 项；历史 A/B 对照 ${abResults.filter(r => r.same).length}/${abResults.length} 个场景与类型批次前实现完全一致；` +
    `另标记行为变化 ${changes.filter(c => c.differs).length}/${changes.length} 项（与类型等价性分离）；` +
    `已确认等价（曾误判为变化）${restored.length} 项`,
);
for (const c of changes) {
  console.log(`  · 行为变化：${c.name} → 原实现 ${JSON.stringify(c.orig)} / 当前 ${JSON.stringify(c.current)}`);
}
