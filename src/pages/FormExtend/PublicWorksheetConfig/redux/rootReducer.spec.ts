/**
 * **真实根 reducer 装配**下的 `publicWorksheet` 行为规格
 *
 * 【这一层补什么】`storeIntegration.spec.ts` 只挂了 `combineReducers({ publicWorksheet })`，
 * 属"单切片"；本文件改用**真实的 `src/redux/reducers.ts`（`makeRootReducer`）**，
 * 验证 `publicWorksheet` 在**真实根装配**下：
 *   1. 根 state 的键名就是 `publicWorksheet`（与 `RootState` 一致）；
 *   2. 初次 `combineReducers` 传 `undefined` 时，切片拿到自己的默认值；
 *   3. 无关键（未知 action）到达该切片时**返回原引用**（根层不会把它换掉）；
 *   4. 一个动作只改本切片，**不扰动兄弟切片**。
 *
 * 【忠实度与边界，写清楚】
 * - `src/redux/reducers.ts` 是**真实文件**，`makeRootReducer` 是**真实执行**的，
 *   因此根上的键名与组合顺序都是真实的；
 * - 它 import 的 17 个兄弟切片模块（`statistics` / `chat` / `worksheet` / `task` / `workflow`
 *   …）依赖很重，本规格**只把兄弟切片替身为平凡 reducer**（`(s = {}) => s`），
 *   因为它们不是本范围的验证对象；**`publicWorksheet` 用的是真实 reducer**；
 * - 因此本规格**不能**用来证明兄弟切片的行为，只用来证明"本切片在真实根装配下的行为"。
 *
 * 【防假绿】未处理的 Promise 拒绝、未捕获异常、未跑到汇总行 → 非零退出。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser = require('@babel/parser');
const { transformFileSync, transformSync, ROOT } = require('../../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
const { configureStore } = require('@reduxjs/toolkit');

/* ────────────────────────── 基线 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/FormExtend/PublicWorksheetConfig/redux';
const UTILS_REL = 'src/pages/FormExtend/utils.tsx';
const ROOT_REDUCERS_REL = 'src/redux/reducers.ts';
const BASE_REV = '3f768fdd2603727b9ba11c0c579a6d58c4d8283a';

const FROZEN: Record<string, string> = {
  'reducers.ts': 'b8dc740dea5d74c1383c1ffec1416d196e17ad95b86faf5f857f6ed2315d55aa',
  'actions.ts': '29808ec9ca864c6a4439e7ca50473ee49d2e87795fc3d842a997122e47e9d943',
};

const origCache: Record<string, string> = {};
function gitShow(relPath: string): string {
  if (origCache[relPath] === undefined) {
    origCache[relPath] = execFileSync('git', ['show', `${BASE_REV}:${relPath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return origCache[relPath];
}

function assertBaselineIntact(): void {
  for (const [file, expected] of Object.entries(FROZEN)) {
    const actual = crypto.createHash('sha256').update(gitShow(`${REL_DIR}/${file}`)).digest('hex');
    assert.equal(actual, expected, `A 侧 ${file} 在 ${BASE_REV} 的 sha256 与冻结值不符`);
  }
}

/* ────────────────────────── 宿主替身 ────────────────────────── */

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const alerts: Array<{ message: string; type?: number }> = [];
function installGlobals() {
  (globalThis as any)['_l'] = (s: string) => String(s);
  (globalThis as any)['alert'] = (message: string, type?: number) => alerts.push({ message, type });
  (globalThis as any)['safeParse'] = (value: unknown, defaultValue: unknown = {}) => {
    if (typeof value !== 'string') return value ?? defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  };
  (globalThis as any)['window'] = { scrollToFormEnd: undefined };
}

const flush = (): Promise<void> => new Promise<void>(resolve => setImmediate(resolve));

/* ────────────────────────── 真实 utils 声明抽取 ────────────────────────── */

function loadRealUtils(): Record<string, any> {
  const filename = path.join(ROOT, UTILS_REL);
  const source = fs.readFileSync(filename, 'utf8');
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const realLodash = require('lodash');

  const grab = (name: string, kind: 'fn' | 'const'): string => {
    const statement = tree.program.body.find((item: any) => {
      const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
      if (!value) return false;
      if (kind === 'fn') {
        return value.type === 'FunctionDeclaration' && value.id && value.id.name === name && value.body;
      }
      return (
        value.type === 'VariableDeclaration' &&
        value.declarations.some((entry: any) => entry.id && entry.id.name === name)
      );
    });
    if (!statement || statement.start == null || statement.end == null) {
      throw new Error(`在 ${UTILS_REL} 中找不到真实声明 ${name}（不允许静默降级）`);
    }
    return source.slice(statement.start, statement.end).replace(/^export /, '');
  };

  const names = ['getDisabledControls', 'getNewControlColRow'];
  const parts = [grab('defaultHidedControlTypes', 'const')];
  if (/export function getNotSupportControlIds/.test(source)) {
    parts.push(grab('getNotSupportControlIds', 'fn'));
  }
  for (const name of names) parts.push(grab(name, 'fn'));

  const code = transformSync(
    `${parts.join('\n')}\nmodule.exports = { ${names.join(', ')} };`,
    { filename },
  ).code;

  const target: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', '_', code)(target, target.exports, realLodash);
  return target.exports;
}

/* ────────────────────────── 加载真实根 reducer ────────────────────────── */

/** 兄弟切片替身：**平凡 reducer**，只用来让真实根装配跑起来 */
const trivialReducer = (state: unknown = {}) => state;
/** namespace 形式的切片（`combineReducers(ns)` 要求每个值都是函数） */
const trivialNamespace = { stub: trivialReducer };

function makeApiSpy(methods: string[]) {
  const calls: Array<{ method: string; args: any }> = [];
  const pending: Array<{ method: string; def: ReturnType<typeof deferred<any>> }> = [];
  const spy: Record<string, any> = { calls, pending };
  for (const method of methods) {
    spy[method] = (args: any) => {
      calls.push({ method, args });
      const def = deferred();
      pending.push({ method, def });
      return def.promise;
    };
  }
  return spy;
}

/**
 * 加载**真实** `src/redux/reducers.ts` 并调用真实 `makeRootReducer()`。
 * 兄弟切片全部用平凡替身，`publicWorksheet` 用真实 reducer。
 */
function loadRealRootReducer(variant: 'orig' | 'current', api: { form: any; publicWorksheet: any }) {
  const realLodash = require('lodash');
  const realUtils = loadRealUtils();

  const cache = new Map<string, any>();
  const load = (relPath: string): any => {
    if (cache.has(relPath)) {
      const hit = cache.get(relPath);
      return hit.exports ?? hit;
    }
    const moduleLike: any = { exports: {} };
    cache.set(relPath, moduleLike);

    const filename = path.join(ROOT, relPath);
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const code =
      variant === 'orig' && relPath === `${REL_DIR}/reducers.ts`
        ? (transformSync(gitShow(relPath), { ...babelOpts, filename }) as { code: string }).code
        : transformFileSync(filename, babelOpts).code;

    const req = (r: string) => {
      // ── 本范围：真实模块 ──
      if (r === `${REL_DIR}/reducers.ts` || r === './reducers') return load(r);
      if (r === 'src/pages/FormExtend/PublicWorksheetConfig/redux/reducers') return load(r);

      if (r === 'redux') return require('redux');
      if (r === 'lodash') return realLodash;
      if (r === 'src/redux/types') return {};
      if (r === 'src/api/form') return api.form;
      if (r === 'src/api/publicWorksheet') return api.publicWorksheet;
      if (r === '../../utils') return realUtils;
      if (r === 'src/utils/controlTypes') return {};

      // ── 兄弟切片：平凡替身（本规格的明确边界）──
      if (
        r === 'statistics/redux/reducers' ||
        r === 'src/pages/Admin/redux' ||
        r === 'src/pages/chat/redux/reducers' ||
        r === 'src/pages/FormSet/components/columnRules/redux/reducer/columnRules' ||
        r === 'src/pages/kc/redux/reducers' ||
        r === 'src/pages/Mobile/redux/reducers' ||
        r === 'src/pages/PageHeader/redux/reducers' ||
        r === 'src/pages/Role/AppRoleCon/redux/reduces' ||
        r === 'src/pages/Role/PortalCon/redux/reduces' ||
        r === 'src/pages/task/redux/reducers' ||
        r === 'src/pages/workflow/redux/reducers' ||
        r === 'src/pages/worksheet/redux/reducers' ||
        r === 'src/pages/worksheet/redux/reducers/sheetList' ||
        r === 'src/pages/customPage/redux/reducers'
      ) {
        return trivialReducer;
      }
      if (
        r === 'src/pages/feed/detail/redux/postDetailReducers' ||
        r === 'src/pages/feed/redux/postReducers'
      ) {
        return trivialNamespace;
      }

      throw new Error(`spec 没给 ${r} 打桩（${relPath}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };

  const rootModule = load(ROOT_REDUCERS_REL);
  const makeRootReducer = rootModule.makeRootReducer;
  assert.equal(typeof makeRootReducer, 'function', '真实 reducers.ts 应导出 makeRootReducer');

  const rootReducer = makeRootReducer();

  // 真实 actions.ts（用于派发真实 thunk）
  const actions = load(`${REL_DIR}/actions.ts`);

  return { rootReducer, actions };
}

/* ────────────────────────── 断言脚手架 + 防假绿 ────────────────────────── */

let summarized = false;
let checks = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  checks += 1;
  return Promise.resolve()
    .then(fn)
    .then(() => realConsole.log(`  ✓ ${name}`))
    .catch(error => {
      failed += 1;
      realConsole.error(`  ✗ ${name}`);
      realConsole.error(`      ${error instanceof Error ? error.message : String(error)}`);
    });
}

process.on('unhandledRejection', reason => {
  realConsole.error(
    `未处理的 Promise 拒绝，判为失败：${reason instanceof Error ? reason.stack || reason.message : String(reason)}`,
  );
  process.exitCode = 1;
});
process.on('uncaughtException', error => {
  realConsole.error(
    `未捕获异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    realConsole.error('规格没有跑到汇总行（可能有异常被吞掉），判为失败');
    process.exitCode = 1;
  }
});

/* ────────────────────────── 造真实根 store ────────────────────────── */

function makeRootStore(variant: 'orig' | 'current') {
  installGlobals();
  alerts.length = 0;

  const formApi = makeApiSpy(['addTextControl']);
  const pwApi = makeApiSpy([
    'saveSetting',
    'saveWorksheet',
    'refreshPublicWorksheetUrl',
    'reset',
    'getPublicWorksheetInfo',
  ]);

  const { rootReducer, actions } = loadRealRootReducer(variant, {
    form: formApi,
    publicWorksheet: pwApi,
  });

  // 与仓内一致：RTK configureStore 默认中间件（含 thunk），不替换不关闭
  const store = configureStore({ reducer: rootReducer as any });

  return { store, actions, formApi, pwApi };
}

function makeDto() {
  return {
    projectId: 'p1',
    worksheetId: 'w1',
    shareId: 's1',
    name: 'name1',
    themeColor: 3,
    themeBgColor: '#fff',
    visibleType: 2,
    worksheetName: 'ws',
    controls: [{ controlId: 'c1', type: 1, col: 0, row: 0 }],
    hidedControlIds: ['c9'],
    ipControlId: 'c1',
    browserControlId: 'c2',
    deviceControlId: 'c3',
    systemControlId: 'c4',
    originalControls: [{ controlId: 'c1', type: 1, advancedSetting: { a: '1' } }],
    needCaptcha: false,
    smsVerification: false,
    writeScope: 1,
    url: 'https://example.com/p/abc',
  };
}

/* ────────────────────────── 执行 ────────────────────────── */

async function main(): Promise<void> {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV.slice(0, 9)} 的 reducers/actions sha256 已实际断言`);

  const probe = makeRootStore('current');
  const rootKeys = Object.keys(probe.store.getState()).sort();
  realConsole.log(
    `  ✓ 真实 makeRootReducer() 装配成功，根 state 键含 publicWorksheet（共 ${rootKeys.length} 个键）`,
  );

  await check('根 state 的键名就是 publicWorksheet（与 RootState 声明一致）', () => {
    assert.ok(rootKeys.includes('publicWorksheet'), `根 state 应含 publicWorksheet，实际键：${rootKeys.join(',')}`);
  });

  await check('初次装配：combineReducers 传 undefined 时该切片拿到自己的默认值', () => {
    const slice = probe.store.getState().publicWorksheet;
    assert.equal(slice.loading, true);
    assert.equal(slice.shareUrl, '');
    assert.deepEqual(slice.worksheetInfo, {});
    assert.deepEqual(slice.worksheetSettings, {});
    assert.deepEqual(slice.originalControls, []);
    assert.deepEqual(slice.controls, []);
    assert.deepEqual(slice.hidedControlIds, []);
  });

  await check('未知 action 到达该切片时返回原引用（根层不会替换它）', () => {
    const before = probe.store.getState().publicWorksheet;
    probe.store.dispatch({ type: 'TOTALLY_UNRELATED_ACTION' } as any);
    const after = probe.store.getState().publicWorksheet;
    assert.equal(after, before, '未知 action 后切片引用必须不变');
  });

  await check('真实根装配下：真实 thunk 的动作被真实 reducer 消费（state 变化）', async () => {
    const { store, actions, pwApi } = makeRootStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    assert.equal(pwApi.calls.length, 1);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const slice = store.getState().publicWorksheet;
    assert.equal(slice.loading, false);
    assert.equal(slice.shareUrl, 'https://example.com/p/abc');
    assert.equal(slice.worksheetInfo.worksheetId, 'w1');
    assert.equal(slice.controls.length, 1);
    assert.deepEqual(slice.hidedControlIds, ['c9']);
  });

  await check('兄弟切片不受影响：仅本切片引用变化，兄弟键引用保持不变', async () => {
    const { store, actions, pwApi } = makeRootStore('current');

    const beforeState = store.getState();
    const siblingRefsBefore = Object.entries(beforeState)
      .filter(([key]) => key !== 'publicWorksheet')
      .map(([key, value]) => [key, value] as const);

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const afterState = store.getState();
    assert.notEqual(
      afterState.publicWorksheet,
      beforeState.publicWorksheet,
      '本切片应产生新引用',
    );

    for (const [key, value] of siblingRefsBefore) {
      assert.equal(
        (afterState as any)[key],
        value,
        `兄弟切片 ${key} 的引用不应被本切片的动作改变`,
      );
    }
  });

  await check('CLEAR 在真实根装配下把该切片复位，兄弟切片仍不变', async () => {
    const { store, actions, pwApi } = makeRootStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();
    assert.equal(store.getState().publicWorksheet.loading, false);

    const siblingBefore = Object.fromEntries(
      Object.entries(store.getState()).filter(([key]) => key !== 'publicWorksheet'),
    );

    store.dispatch(actions.clear());

    const slice = store.getState().publicWorksheet;
    assert.equal(slice.loading, true);
    assert.equal(slice.shareUrl, '');
    assert.deepEqual(slice.controls, []);
    assert.deepEqual(slice.hidedControlIds, []);

    const siblingAfter = Object.fromEntries(
      Object.entries(store.getState()).filter(([key]) => key !== 'publicWorksheet'),
    );
    assert.deepEqual(siblingAfter, siblingBefore, 'CLEAR 不应影响兄弟切片');
  });

  await check('A/B：真实根 reducer 下基线与工作区版本的最终切片 state 一致', async () => {
    async function run(variant: 'orig' | 'current') {
      const { store, actions, pwApi } = makeRootStore(variant);

      store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
      pwApi.pending[0].def.resolve(makeDto());
      await pwApi.pending[0].def.promise;
      await flush();

      store.dispatch(actions.hideControl('c1') as any);
      await flush();
      store.dispatch(actions.clear());

      return {
        slice: store.getState().publicWorksheet,
        rootKeys: Object.keys(store.getState()).sort(),
      };
    }

    const origResult = await run('orig');
    const currentResult = await run('current');
    assert.deepEqual(currentResult, origResult);
  });

  summarized = true;
  if (failed) {
    realConsole.error(`PublicWorksheetConfig 真实根 reducer 规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PublicWorksheetConfig 真实根 reducer 规格通过：${checks} 项（真实 makeRootReducer + 真实切片 reducer + 真实 thunk）`,
  );
}

main().catch(error => {
  realConsole.error(
    `主流程异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
