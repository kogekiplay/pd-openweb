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
function installHost(overrides: { localStorage?: ReturnType<typeof makeLocalStorage>; messageListShowType?: number } = {}) {
  const ls = overrides.localStorage || makeLocalStorage();
  (globalThis as any)['localStorage'] = ls;
  (globalThis as any)['md'] = {
    global: {
      Account: {
        messageListShowType: overrides.messageListShowType === undefined ? undefined : overrides.messageListShowType,
      },
    },
  };
  (globalThis as any)['_l'] = (s: string) => String(s);
  return ls;
}

/* ────────────────────────── 真实 utils 声明抽取 ────────────────────────── */

/**
 * 需要抽取的真实声明。
 * `sortTop` 是 `sortSession` 依赖的**模块级函数**（utils.ts:39），
 * 不抽它 `sortSession` 会 `ReferenceError` —— 抽不到会明确失败，不静默降级。
 */
const HELPER_NAMES = ['filterSessionList', 'sortSession', 'getToolbarConfig', 'sortTop'];

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
    `${declarations}\nmodule.exports = { filterSessionList, sortSession, getToolbarConfig };`,
    { ...babelOpts, filename },
  ).code;

  const target: { exports: Record<string, any> } = { exports: {} };
  // 这些是抽取出的真实 helper 用到的依赖；全部为**受控替身**
  const stubs = {
    _: realLodash,
    // sortSession 只用到 _.orderBy / 数组操作；moment 等其余依赖在此不可达
    moment: () => ({ format: () => '' }),
    Emotion: {},
    htmlDecodeReg: /^$/,
    pathCompletion: () => '',
    dateConvertToUserZone: (v: unknown) => v,
    Constant: {},
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
