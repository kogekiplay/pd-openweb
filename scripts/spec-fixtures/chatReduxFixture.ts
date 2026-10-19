/**
 * `src/pages/chat/redux` 行为规格的**共享夹具**（Node 侧）
 *
 * 说明（供 lead 快速判断"哪些真实、哪些替身"）：
 *
 * **真实**
 * - `reducers.ts` 本身：从工作区 / 基线（`15d7e386f`）读取源码后编译执行，**不是**复制一份假 reducer。
 * - `utils.filterSessionList` / `utils.sortSession` / `utils.getToolbarConfig`：
 *   按 AST 从**真实** `src/pages/chat/utils/index.ts` **抽取声明原文**后编译执行，
 *   不手抄实现。
 *
 * **替身（宿主可控）**
 * - `localStorage`：`getToolbarConfig()` 读它（4 个开关）。
 * - `md.global.Account.messageListShowType`：`sortSession` 的默认参数。
 * - `moment` / `Emotion` / `src/...` 等 `utils` 的重依赖：只做**最小可控替身**，
 *   让抽取出来的真实函数能跑起来；这些不参与被验证的行为。
 *
 * **不做的事**：不发真实网络/socket 请求、不写真实 localStorage、不动生产数据。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const parser = require('@babel/parser');
const { transformFileSync, transformSync, ROOT } = require('../spec-harness.ts');

/** 冻结的真实基线（lead 指定、已确认 git 对象可达） */
const BASE_REV = '15d7e386fe01fb9b9b9755a2e272d146d93522fe';
/** 基线 `reducers.ts` 的 sha256 —— 规格里**实际断言**，不是打印 */
const BASE_REDUCERS_SHA = '93ce0ee0408de8298efeae5c6b71debe58519c6058883f014f7a2981aca1d1fa';

const UTILS_REL = 'src/pages/chat/utils/index.ts';
const REDUX_REL = 'src/pages/chat/redux';

const realLodash = require('lodash');
// `formatMsgDate`/`getCurrentTime` 用到 moment 的 diff/format/isSame/subtract，
// 手写替身会变成"断言我自己的替身语义"，因此这里用**真实 moment**。
const realMoment = require('moment');
const crypto = require('node:crypto');

function gitShow(relPath: string): string {
  return execFileSync('git', ['show', `${BASE_REV}:${relPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function assertBaselineIntact(): void {
  const actual = crypto.createHash('sha256').update(gitShow(`${REDUX_REL}/reducers.ts`)).digest('hex');
  if (actual !== BASE_REDUCERS_SHA) {
    throw new Error(`基线 reducers.ts 的 sha256 与冻结值不符，A/B 对照失效：${actual}`);
  }
}

/* ────────────────────────── 宿主替身 ────────────────────────── */

/** 可控 localStorage（不写真实存储） */
function makeLocalStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    _dump: () => ({ ...store }),
  };
}

/** 安装宿主替身（每个用例前调用可重置） */
/**
 * 【accountId 为何可配】`formatSession` 里有 `isSelf`（`from.id === accountId`）与
 * `isAdmin`（`wdAdminid === accountId`）两个分支。此前夹具恒不设 `accountId`，
 * 于是这两条分支**从未被执行**；加上这个覆盖才能测到。
 */
function installHost(
  overrides: {
    localStorage?: ReturnType<typeof makeLocalStorage>;
    messageListShowType?: number;
    accountId?: string;
  } = {},
) {
  const ls = overrides.localStorage || makeLocalStorage();
  (globalThis as any)['localStorage'] = ls;
  (globalThis as any)['md'] = {
    global: {
      Account: {
        messageListShowType: overrides.messageListShowType === undefined ? undefined : overrides.messageListShowType,
        accountId: overrides.accountId,
      },
    },
  };
  // 【保真替身】真实 `_l(key, ...args)` 会做 `%0`/`%1` 占位替换；
  // 只做恒等会让涉及占位的文案断言只能写"前缀/关键词"。这里实现与真实一致的
  // 顺序替换（不做语言切换 —— 规格环境为中文单语）。
  (globalThis as any)['_l'] = (s: string, ...args: unknown[]) => {
    let out = String(s);
    args.forEach((v, i) => {
      out = out.split(`%${i}`).join(String(v));
    });
    return out;
  };
  return ls;
}

/* ────────────────────────── 真实 utils 声明抽取 ────────────────────────── */

/**
 * 需要抽取的真实声明。
 * `sortTop` 是 `sortSession` 依赖的**模块级函数**（`utils/index.ts` 内 `export` 前的 `const sortTop`），
 * 不抽它 `sortSession` 会 `ReferenceError` —— 抽不到会明确失败，不静默降级。
 */
const HELPER_NAMES = [
  'filterSessionList',
  'sortSession',
  'getToolbarConfig',
  'sortTop',
  // 本批新增：格式化合同（`formatSession` 依赖 `formatMsgDate` / `getCurrentTime`）
  'formatMessage',
  'formatSession',
  'formatNewMessage',
  'formatNewSession',
  'formatMsgDate',
  'getCurrentTime',
];

const utilsCache = new Map<string, Record<string, any>>();

/** 从真实 `src/pages/chat/utils/index.ts` 抽取三个 helper 并执行 */
function loadRealUtils(): Record<string, any> {
  const filename = path.join(ROOT, UTILS_REL);
  const source = fs.readFileSync(filename, 'utf8');
  const cached = utilsCache.get(source);
  if (cached) return cached;

  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });

  const declarations = HELPER_NAMES.map(name => {
    const statement = tree.program.body.find((item: any) => {
      const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
      if (!value) return false;
      if (value.type === 'VariableDeclaration') {
        return value.declarations.some((entry: any) => entry.id && entry.id.name === name);
      }
      if (value.type === 'FunctionDeclaration') {
        return Boolean(value.id && value.id.name === name && value.body);
      }
      return false;
    });
    if (!statement || statement.start == null || statement.end == null) {
      // 抽不到就明确失败，绝不静默降级成空实现（那会让规格假绿）
      throw new Error(`real-chat-utils: 在 ${UTILS_REL} 中找不到 helper "${name}"`);
    }
    return source.slice(statement.start, statement.end).replace(/^export /, '');
  }).join('\n');

  const babelOpts = {
    comments: false,
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  const code = transformSync(
    `${declarations}\nmodule.exports = { filterSessionList, sortSession, getToolbarConfig, formatMessage, formatSession, formatNewMessage, formatNewSession, formatMsgDate, getCurrentTime };`,
    { ...babelOpts, filename },
  ).code;

  const target: { exports: Record<string, any> } = { exports: {} };
  // 这些是抽取出的真实 helper 用到的依赖；全部为**受控替身**
  const stubs = {
    _: realLodash,
    // sortSession 只用到 _.orderBy / 数组操作；moment 等其余依赖在此不可达
    // `sortSession` 只用数组操作；`formatMsgDate`/`getCurrentTime` 需要真实 moment
    moment: realMoment,
    Emotion: {},
    /**
     * `src/utils/common` 的 `htmlDecodeReg` **逐字忠实替身**（该模块依赖 JSEncrypt 等，
     * 在本隔离环境无法 require）。实现与真实源码一一对应，不做简化：
     * 只替换源码里列出的那 **10** 个实体（`&#38;`/`&amp;`/`&#60;`/`&#62;`/`&#34;`/`&#39;`/`&#47;`/`&lt;`/`&gt;`/`&quot;`），其余原样返回；非真值返回 `''`。
     */
    htmlDecodeReg: (str: unknown): string => {
      const rules: Record<string, string> = {
        '&#38;': '&',
        '&amp;': '&',
        '&#60;': '<',
        '&#62;': '>',
        '&#34;': '"',
        '&#39;': "'",
        '&#47;': '/',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
      };
      const matchHTML = /&#(38|60|62|34|39|47);|&(amp|lt|gt|quot);/g;
      return str ? String(str).replace(matchHTML, m => rules[m] || m) : '';
    },
    pathCompletion: () => '',
    /**
     * 【为什么是恒等替身】真实实现按用户时区换算时刻，会让规格**依赖运行环境的时区**；
     * 本规格刻意保持时区无关（已验证 UTC / Kiritimati / Etc/GMT+12 结果一致）。
     * 代价：**时区换算本身不被测**（两侧都走同一替身，故对被测逻辑仍是公平对照）。
     */
    dateConvertToUserZone: (v: unknown) => v,
    /**
     * `src/pages/chat/utils/constant.ts` 的**关键常量真实值**（不是空对象）。
     * 空 `{}` 会让 `Constant.MSGTYPE_TEXT` 恒为 `undefined` →
     * `formatMessage` 里 `message.type === Constant.MSGTYPE_TEXT` 恒 false，
     * "连续文本消息合并"分支**永远不进**（替身失真，会掩盖真实行为）。
     * 取值与真实 `constant.ts` 一致。
     */
    Constant: {
      SESSIONTYPE_USER: 1,
      SESSIONTYPE_GROUP: 2,
      SESSIONTYPE_SYSTEM: 3,
      SESSIONTYPE_POST: 4,
      SESSIONTYPE_CALENDAR: 5,
      SESSIONTYPE_TASK: 6,
      SESSIONTYPE_KNOWLEDGE: 7,
      SESSIONTYPE_HR: 8,
      SESSIONTYPE_WORKSHEET: 9,
      SESSIONTYPE_WORKFLOW: 10,
      INPUT_MODE_ENTER: 1,
      INPUT_MODE_CTRLENTER: 2,
      MSGTYPE_TEXT: 1,
      MSGTYPE_PIC: 2,
      MSGTYPE_EMOTION: 2,
      MSGTYPE_AUDIO: 3,
      MSGTYPE_FILE: 4,
      MSGTYPE_CARD: 5,
      MSGTYPE_MAP: 6,
      MSGTYPE_APP_VIDEO: 7,
      MSGTYPE_SYSTEM_SUCCESS: 1,
      MSGTYPE_SYSTEM_ERROR: 2,
    },
    INBOXTYPES: {},
    md: (globalThis as any)['md'],
  };
  new Function(
    'module',
    'exports',
    '_',
    'moment',
    'Emotion',
    'htmlDecodeReg',
    'pathCompletion',
    'dateConvertToUserZone',
    'Constant',
    'INBOXTYPES',
    code,
  )(target, target.exports, stubs._, stubs.moment, stubs.Emotion, stubs.htmlDecodeReg, stubs.pathCompletion, stubs.dateConvertToUserZone, stubs.Constant, stubs.INBOXTYPES);

  utilsCache.set(source, target.exports);
  return target.exports;
}

/* ────────────────────────── 加载被测 reducers ────────────────────────── */

/**
 * 加载一份 `reducers.ts`（`orig` = 基线源码，`current` = 工作区文件）。
 * 两边共用**同一套**真实 utils 与宿主替身，因此 A/B 只对照 reducer 自身差异。
 */
function makeReducerLoader(variant: 'orig' | 'current') {
  const realUtils = loadRealUtils();
  const cache = new Map<string, any>();

  const load = (rel: string): any => {
    if (cache.has(rel)) {
      const hit = cache.get(rel);
      return hit.exports ?? hit;
    }
    const moduleLike: any = { exports: {} };
    cache.set(rel, moduleLike);

    const filename = path.join(ROOT, REDUX_REL, rel);
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const code =
      variant === 'orig'
        ? (transformSync(gitShow(`${REDUX_REL}/${rel}`), { ...babelOpts, filename }) as { code: string }).code
        : (transformFileSync(filename, babelOpts) as { code: string }).code;

    const req = (r: string) => {
      if (r === 'redux') return require('redux');
      if (r === 'lodash') return realLodash;
      if (r === '../utils/' || r === '../utils') return realUtils;
      if (r === 'src/redux/types') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      throw new Error(`chat-fixture 没给 ${r} 打桩（${variant}/${rel}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };

  return load;
}

/**
 * 取 reducer 模块。
 *
 * 【注意】`reducers.ts` 里各子 reducer 都是**非导出**的 `const`（基线与工作区一致），
 * 唯一导出是 `default = combineReducers({...})`。因此规格只能通过 `default` 驱动，
 * 用 `state.chat.<切片名>` 读取结果 —— 这也更接近真实使用方式。
 */
function reducersOf(load: (rel: string) => any) {
  const mod = load('reducers.ts');
  if (typeof mod.default !== 'function') {
    throw new Error('reducers.ts 的 default 导出应为 combineReducers 函数');
  }
  return { default: mod.default as (state: any, action: any) => any };
}

module.exports = {
  ROOT,
  BASE_REV,
  BASE_REDUCERS_SHA,
  UTILS_REL,
  REDUX_REL,
  HELPER_NAMES,
  assertBaselineIntact,
  gitShow,
  makeLocalStorage,
  installHost,
  loadRealUtils,
  makeReducerLoader,
  reducersOf,
};
