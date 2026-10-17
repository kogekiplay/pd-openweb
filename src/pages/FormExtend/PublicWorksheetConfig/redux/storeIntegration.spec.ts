/**
 * `PublicWorksheetConfig` 的 **reducer + thunk 真实 store 联动规格**
 *
 * 【与 `actions.spec.ts` 的分工】
 * - `actions.spec.ts`：**直接调用** thunk，`dispatch` 只做记录，用于精确断言
 *   dispatch / 回调 / alert 的**顺序**与 API 调用形状；
 * - 本文件：把**真实的 reducers.ts** 与**真实的 actions.ts thunk**装进一个
 *   **真实 store**，验证"thunk 派发的动作确实被真实 reducer 消费、state 真的变化"。
 *   这是上一个文件明确没覆盖的一层（它不改写 state）。
 *
 * 【store 装配与仓内一致】仓内 `src/redux/configureStore.ts` 用的是 RTK
 * `configureStore` 的**默认中间件**（含 thunk），所以这里用同一个 `configureStore`
 * 加 `combineReducers({ publicWorksheet })`，**不替换、不关闭任何中间件**。
 * thunk 的写法完全按 `actions.ts` 原样传入（它是标准 `(dispatch, getState) => …`）。
 *
 * 【不做什么】不发真实网络请求（API 替身返回受控 Promise）、不渲染组件、不碰生产配置。
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

const { configureStore, combineReducers } = require('@reduxjs/toolkit');

/* ────────────────────────── 基线 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/FormExtend/PublicWorksheetConfig/redux';
const UTILS_REL = 'src/pages/FormExtend/utils.tsx';
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
  (globalThis as any)['alert'] = (message: string, type?: number) => {
    alerts.push({ message, type });
  };
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

/* ────────────────────────── 模块加载 ────────────────────────── */

interface ApiSpy {
  calls: Array<{ method: string; args: any }>;
  pending: Array<{ method: string; def: ReturnType<typeof deferred<any>> }>;
}

function makeApiSpy(methods: string[]): ApiSpy {
  const spy: ApiSpy = { calls: [], pending: [] };
  for (const method of methods) {
    (spy as any)[method] = (args: any) => {
      spy.calls.push({ method, args });
      const def = deferred();
      spy.pending.push({ method, def });
      return def.promise;
    };
  }
  return spy;
}

/**
 * 构造 `{ reducers, actions }` 模块对。
 * `variant === 'orig'` 时 reducers/actions 都取基线源码（A 侧）。
 */
/** 每个文件各自选版本，用于交叉组合（reducer 取 A、actions 取 B 等） */
type VariantSet = { reducers: 'orig' | 'current'; actions: 'orig' | 'current' };

function loadModules(variants: VariantSet, api: { form: any; publicWorksheet: any }) {
  const realLodash = require('lodash');
  const realUtils = loadRealUtils();

  const cache = new Map<string, any>();
  const load = (rel: string): any => {
    if (cache.has(rel)) {
      const hit = cache.get(rel);
      return hit.exports ?? hit;
    }
    const moduleLike: any = { exports: {} };
    cache.set(rel, moduleLike);

    const filename = path.join(DIR, rel);
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const variant = rel === 'reducers.ts' ? variants.reducers : variants.actions;
    const code =
      variant === 'orig'
        ? (transformSync(gitShow(`${REL_DIR}/${rel}`), { ...babelOpts, filename }) as { code: string }).code
        : transformFileSync(filename, babelOpts).code;

    const req = (r: string) => {
      if (r === 'redux') return require('redux');
      if (r === 'lodash') return realLodash;
      if (r === 'src/api/form') return api.form;
      if (r === 'src/api/publicWorksheet') return api.publicWorksheet;
      if (r === '../../utils') return realUtils;
      if (r === 'src/redux/types') return {};
      if (r === 'src/utils/controlTypes') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };

  return { reducers: load('reducers.ts'), actions: load('actions.ts') };
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

/* ────────────────────────── 造一个真实 store ────────────────────────── */

function makeStore(variants: VariantSet | 'orig' | 'current') {
  const set: VariantSet =
    typeof variants === 'string' ? { reducers: variants, actions: variants } : variants;
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

  const { reducers, actions } = loadModules(set, { form: formApi, publicWorksheet: pwApi });

  // 与仓内一致：RTK configureStore 默认中间件（含 thunk），不替换不关闭
  const store = configureStore({
    reducer: combineReducers({ publicWorksheet: reducers.default }),
  });

  return { store, actions, formApi, pwApi };
}

/** 模拟接口返回的公开表单 DTO */
function makeDto() {
  return {
    projectId: 'p1',
    projectName: 'proj',
    worksheetId: 'w1',
    shareId: 's1',
    name: 'name1',
    desc: 'desc1',
    submitBtnName: '提交',
    logo: 'https://cdn/logo.png?x=1',
    cover: 'https://cdn/cover.png?y=2',
    themeColor: 3,
    themeBgColor: '#fff',
    visibleType: 2,
    worksheetName: 'ws',
    controls: [{ controlId: 'c1', type: 1, col: 0, row: 0 }],
    hidedControlIds: ['c9'],
    extendSourceId: 'e1',
    ipControlId: 'c1',
    browserControlId: 'c2',
    deviceControlId: 'c3',
    systemControlId: 'c4',
    originalControls: [
      { controlId: 'c1', type: 1, advancedSetting: { a: '1' } },
      { controlId: 'c2', type: 29, advancedSetting: { showtype: '2' } },
    ],
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

  /* ── 1. loadPublicWorksheet：真实 thunk → 真实 reducer，state 真的变化 ── */

  await check('真实 store：loadPublicWorksheet 的 dispatch 被真实 reducer 消费，state 反映载荷', async () => {
    const { store, actions, pwApi } = makeStore('current');

    const before = store.getState().publicWorksheet;
    assert.equal(before.loading, true, '初始 loading 应为 true');
    assert.equal(before.shareUrl, '', '初始 shareUrl 应为空串');
    assert.deepEqual(before.controls, []);

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    assert.equal(pwApi.calls.length, 1);
    assert.equal(pwApi.calls[0].method, 'getPublicWorksheetInfo');

    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const after = store.getState().publicWorksheet;
    assert.equal(after.loading, false, 'LOAD_SUCCESS 后 loading 应为 false');
    assert.equal(after.shareUrl, 'https://example.com/p/abc');
    assert.equal(after.worksheetInfo.worksheetId, 'w1');
    assert.equal(after.worksheetInfo.themeIndex, 3);
    assert.deepEqual(after.hidedControlIds, ['c9']);
    assert.equal(after.controls.length, 1);
    assert.equal(after.originalControls.length, 2);
    // type=29 + showtype '2' → 改写 '5'，并经由真实 reducer 落到 state
    const rewritten = after.originalControls.find((c: any) => c.controlId === 'c2');
    assert.equal(rewritten.advancedSetting.showtype, '5');
  });

  /* ── 2. hideControl：真实 store 里 state 的 hidedControlIds / controls 真的变化 ── */

  await check('真实 store：hideControl 后 hidedControlIds 增长且该控件从 controls 移除', async () => {
    const { store, actions, pwApi } = makeStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const beforeControls = store.getState().publicWorksheet.controls;
    assert.equal(beforeControls.length, 1);

    store.dispatch(actions.hideControl('c1') as any);
    await flush();

    const after = store.getState().publicWorksheet;
    assert.ok(after.hidedControlIds.includes('c1'), 'hidden 列表应包含 c1');
    assert.equal(
      after.controls.some((c: any) => c.controlId === 'c1'),
      false,
      '被隐藏的控件应从 controls 移除',
    );
    // 同时会触发一次保存
    assert.equal(
      pwApi.calls.some(c => c.method === 'saveWorksheet'),
      true,
      'hideControl 应触发一次 saveWorksheet',
    );
  });

  /* ── 3. showControl：从隐藏列表移除，并把控件加回 controls ── */

  await check('真实 store：showControl 后该 id 从 hidedControlIds 移除、控件回到 controls', async () => {
    const { store, actions, pwApi } = makeStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    // 先隐藏，再显示，形成闭环
    store.dispatch(actions.hideControl('c1') as any);
    await flush();
    assert.ok(store.getState().publicWorksheet.hidedControlIds.includes('c1'));

    store.dispatch(actions.showControl([{ controlId: 'c1', type: 1, half: false }]) as any);
    await flush();

    const after = store.getState().publicWorksheet;
    assert.equal(
      after.hidedControlIds.includes('c1'),
      false,
      '显示后 c1 不应再在 hidden 列表里（reducer 的 !includes 语义）',
    );
    assert.equal(
      after.controls.some((c: any) => c.controlId === 'c1'),
      true,
      '显示后 c1 应回到 controls',
    );
  });

  /* ── 4. updateWorksheetInfo：局部合并经真实 reducer 生效 ── */

  await check('真实 store：updateWorksheetInfo 的 UPDATE_INFO 被真实 reducer 浅合并进 state', async () => {
    const { store, actions, pwApi } = makeStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const keyBefore = store.getState().publicWorksheet.worksheetInfo.worksheetId;
    store.dispatch(actions.updateWorksheetInfo({ worksheetName: '改名' }) as any);
    await flush();

    const after = store.getState().publicWorksheet.worksheetInfo;
    assert.equal(after.worksheetName, '改名');
    assert.equal(after.worksheetId, keyBefore, '未被 patch 的键应保留');
  });

  /* ── 5. clear：真实 reducer 回到初始值 ── */

  await check('真实 store：clear 后切片回到初始值', async () => {
    const { store, actions, pwApi } = makeStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    assert.equal(store.getState().publicWorksheet.loading, false);

    store.dispatch(actions.clear());
    const cleared = store.getState().publicWorksheet;
    assert.equal(cleared.loading, true);
    assert.equal(cleared.shareUrl, '');
    assert.deepEqual(cleared.controls, []);
    assert.deepEqual(cleared.originalControls, []);
    assert.deepEqual(cleared.hidedControlIds, []);
    assert.deepEqual(cleared.worksheetInfo, {});
    assert.deepEqual(cleared.worksheetSettings, {});
  });

  /* ── 6. 保存失败：state 不变（只有成功才 dispatch）── */

  await check('真实 store：updateSettings 失败时 state 不变（不 dispatch）', async () => {
    const { store, actions, pwApi } = makeStore('current');

    store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
    pwApi.pending[0].def.resolve(makeDto());
    await pwApi.pending[0].def.promise;
    await flush();

    const before = store.getState().publicWorksheet.worksheetSettings;

    store.dispatch(actions.updateSettings({ needCaptcha: true }) as any);
    pwApi.pending[1].def.reject(new Error('boom'));
    await pwApi.pending[1].def.promise.catch(() => undefined);
    await flush();

    assert.equal(
      store.getState().publicWorksheet.worksheetSettings,
      before,
      '失败时不应产生新的 settings 引用',
    );
  });

  /* ── 7. A/B：同一序列下基线与工作区版本的最终 state 一致 ── */

  await check('A/B（交叉组合）：reducer 与 actions 各自取基线/工作区，4 种组合最终 state 相同', async () => {
    async function run(variants: VariantSet) {
      const { store, actions, pwApi } = makeStore(variants);

      store.dispatch(actions.loadPublicWorksheet({ worksheetId: 'w1' }) as any);
      pwApi.pending[0].def.resolve(makeDto());
      await pwApi.pending[0].def.promise;
      await flush();

      store.dispatch(actions.hideControl('c1') as any);
      await flush();

      store.dispatch(actions.showControl([{ controlId: 'c1', type: 1, half: false }]) as any);
      await flush();

      store.dispatch(actions.updateWorksheetInfo({ worksheetName: 'x' }) as any);
      await flush();

      const state = store.getState().publicWorksheet;
      return {
        loading: state.loading,
        shareUrl: state.shareUrl,
        worksheetInfo: state.worksheetInfo,
        worksheetSettings: state.worksheetSettings,
        originalControls: state.originalControls,
        controls: state.controls,
        hidedControlIds: state.hidedControlIds,
        alerts: alerts.map(a => ({ message: a.message, type: a.type })),
      };
    }

    /**
     * 【为什么要交叉】只比 (A,A) 与 (B,B) 的话，"我的 actions 恰好只在配我的 reducer 时正确"
     * 这类隐藏耦合看不出来。四种组合全比一遍，才能说明两边的改动**互不依赖**：
     *   (A,A) 基线 → (A,B) 基线 reducer + 当前 actions
     *   (B,A) 当前 reducer + 基线 actions → (B,B) 当前
     */
    const combos: VariantSet[] = [
      { reducers: 'orig', actions: 'orig' },
      { reducers: 'orig', actions: 'current' },
      { reducers: 'current', actions: 'orig' },
      { reducers: 'current', actions: 'current' },
    ];

    const results: Array<{ combo: string; value: unknown }> = [];
    for (const combo of combos) {
      results.push({ combo: `${combo.reducers}/${combo.actions}`, value: await run(combo) });
    }

    const baseline = results[0];
    for (const result of results.slice(1)) {
      assert.deepEqual(
        result.value,
        baseline.value,
        `组合 ${result.combo} 的最终 state 与 ${baseline.combo} 不一致`,
      );
    }
  });

  summarized = true;
  if (failed) {
    realConsole.error(`PublicWorksheetConfig 真实 store 联动规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PublicWorksheetConfig 真实 store 联动规格通过：${checks} 项（真实 reducer + 真实 thunk + RTK 默认中间件）`,
  );
}

main().catch(error => {
  realConsole.error(
    `主流程异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
