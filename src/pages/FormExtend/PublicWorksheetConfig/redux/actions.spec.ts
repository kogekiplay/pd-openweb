/**
 * `PublicWorksheetConfig/redux/actions.ts` 的 **thunk 异步行为规格**
 *
 * 【覆盖层说明（据 lead 要求写清）】本文件**不渲染组件、不挂载 HOC**；
 * 它直接调用 `actions.ts` 导出的 thunk（`(dispatch, getState) => …`），
 * 用**可控的 Promise 替身**驱动成功/失败，观测 `dispatch` / 回调 / `alert` 的**真实顺序**。
 *
 * 【不做的事】
 * - 不发出真实网络请求：`src/api/*` 全部替身，返回**我们自己能 resolve/reject 的 Promise**；
 * - 不实现假的业务逻辑：`getDisabledControls` / `getNewControlColRow` 从真实
 *   `src/pages/FormExtend/utils.tsx` 按 AST **抽取声明原文**后执行（与 reducers 规格一致的做法）；
 * - 不碰生产配置、不真实保存/分享/写记录。
 *
 * 【为什么用"受控 Promise"而不是 mock 库】要断言的是**顺序**（dispatch 先/后于回调、
 * alert 在 catch 里等），必须能把 Promise 的 settle 时机精确掌控，否则顺序断言不可靠。
 *
 * 【防假绿】未处理的 Promise 拒绝、未捕获异常、未跑到汇总行 → 一律非零退出。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser = require('@babel/parser');
const { transformFileSync, transformSync, ROOT } = require('../../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };

/* ────────────────────────── 基线（A 侧）────────────────────────── */

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

/* ────────────────────────── 受控 Promise 与观测记录 ────────────────────────── */

/** 可手动 settle 的 Promise */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 全局事件序列：用于断言 dispatch / 回调 / alert 的**相对顺序** */
let events: string[] = [];
function record(event: string) {
  events.push(event);
}

/** `alert` / `_l` / `safeParse` / `window` 替身（真实宿主行为的替身，不参与业务） */
const alerts: Array<{ message: string; type?: number }> = [];
function installGlobals() {
  (globalThis as any)['_l'] = (s: string) => String(s);
  (globalThis as any)['alert'] = (message: string, type?: number) => {
    alerts.push({ message, type });
    record(`alert:${message}`);
  };
  (globalThis as any)['safeParse'] = (value: unknown, defaultValue: unknown = {}) => {
    if (typeof value !== 'string') return value ?? defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  };
  (globalThis as any)['window'] = {
    scrollToFormEnd: undefined as undefined | (() => void),
  };
}

/**
 * 排空 Promise 链：`await Promise.resolve()` 只前进一个微任务，
 * 而 `x.then(...).then(...)` 或 `await` 之后仍有回调排队时会漏观测 ——
 * 用 `setImmediate` 走到下一个**宏任务**边界，保证已 resolve 的链都跑完。
 */
const flush = (): Promise<void> => new Promise<void>(resolve => setImmediate(resolve));

/** 初始化观测 */
function resetObservations() {
  events = [];
  alerts.length = 0;
  (globalThis as any)['window'].scrollToFormEnd = undefined;
}

/* ────────────────────────── 真实 utils 声明抽取 ────────────────────────── */

/** 从真实 `utils.tsx` 抽取 `getDisabledControls` / `getNewControlColRow` 并执行 */
function loadRealUtils(): Record<string, any> {
  const filename = path.join(ROOT, UTILS_REL);
  const source = fs.readFileSync(filename, 'utf8');
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });

  const names = ['getDisabledControls', 'getNewControlColRow'];
  /**
   * 这两个函数还引用**模块级常量** `defaultHidedControlTypes`（utils.tsx:24）。
   * 抽不到就会 `ReferenceError`；这里把它一并抽出，仍然"跑真实声明"，不手抄数值。
   */
  const moduleConstants = [
    'defaultHidedControlTypes',
  ]
    .map(name => {
      const statement = tree.program.body.find((item: any) => {
        const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
        return Boolean(
          value &&
            value.type === 'VariableDeclaration' &&
            value.declarations.some((entry: any) => entry.id && entry.id.name === name),
        );
      });
      if (!statement || statement.start == null || statement.end == null) {
        throw new Error(`在 ${UTILS_REL} 中找不到模块级常量 ${name}`);
      }
      return source.slice(statement.start, statement.end).replace(/^export /, '');
    })
    .join('\n');
  const realLodash = require('lodash');

  const declarations = names
    .map(name => {
      const statement = tree.program.body.find((item: any) => {
        const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
        if (!value) return false;
        if (value.type === 'FunctionDeclaration') {
          return Boolean(value.id && value.id.name === name && value.body);
        }
        if (value.type === 'VariableDeclaration') {
          return value.declarations.some((entry: any) => entry.id && entry.id.name === name);
        }
        return false;
      });
      if (!statement || statement.start == null || statement.end == null) {
        throw new Error(`在 ${UTILS_REL} 中找不到真实声明 ${name}`);
      }
      return source.slice(statement.start, statement.end).replace(/^export /, '');
    })
    .join('\n');

  // `getDisabledControls` 内部依赖 `getNotSupportControlIds` 等；这里把它们也抽出来，
  // 抽不到就**明确失败**，绝不静默降级成空实现。
  const extraNames = (source.match(/export function getNotSupportControlIds/g) || []).length
    ? ['getNotSupportControlIds']
    : [];

  const extraDeclarations = extraNames
    .map(name => {
      const statement = tree.program.body.find((item: any) => {
        const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
        return Boolean(
          value && value.type === 'FunctionDeclaration' && value.id && value.id.name === name && value.body,
        );
      });
      return statement && statement.start != null && statement.end != null
        ? source.slice(statement.start, statement.end).replace(/^export /, '')
        : '';
    })
    .filter(Boolean)
    .join('\n');

  const code = transformSync(
    `${moduleConstants}\n${extraDeclarations}\n${declarations}\nmodule.exports = { ${names.join(', ')} };`,
    { filename },
  ).code;

  const target: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', '_', code)(target, target.exports, realLodash);
  return target.exports;
}

/* ────────────────────────── 加载被测 actions.ts ────────────────────────── */

interface Harness {
  actions: Record<string, any>;
  apiCalls: Array<{ api: string; method: string; args: any }>;
  /** 最近一次产生的可受控 Promise（按调用顺序） */
  pending: Array<{ api: string; method: string; def: ReturnType<typeof deferred<any>> }>;
  dispatch: (action: unknown) => void;
  getState: () => any;
  dispatched: unknown[];
}

/**
 * 构造一个被测模块实例。
 *
 * `$variant` 为 `orig` 时加载基线 `actions.ts`，否则加载工作区文件。
 * 两者都用**同一套替身**，因此对照的只是 actions.ts 自身的差异。
 */
function makeHarness(
  variant: 'orig' | 'current',
  initialState: Record<string, unknown>,
): Harness {
  installGlobals();
  resetObservations();

  const realLodash = require('lodash');
  const realUtils = loadRealUtils();

  const apiCalls: Harness['apiCalls'] = [];
  const pending: Harness['pending'] = [];

  /** 造一个"记录了调用、返回受控 Promise"的 API 替身 */
  const makeApi = (api: string, methods: string[]) => {
    const apiObj: Record<string, any> = {};
    for (const method of methods) {
      apiObj[method] = (args: any) => {
        apiCalls.push({ api, method, args });
        const def = deferred();
        pending.push({ api, method, def });
        return def.promise;
      };
    }
    return apiObj;
  };

  const formAjax = makeApi('form', ['addTextControl']);
  const publicWorksheetAjax = makeApi('publicWorksheet', [
    'saveSetting',
    'saveWorksheet',
    'refreshPublicWorksheetUrl',
    'reset',
    'getPublicWorksheetInfo',
  ]);

  const dispatched: unknown[] = [];
  const state = { publicWorksheet: initialState };

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
    const code =
      variant === 'orig' && rel === 'actions.ts'
        ? (transformSync(gitShow(`${REL_DIR}/${rel}`), { ...babelOpts, filename }) as { code: string }).code
        : transformFileSync(filename, babelOpts).code;

    const req = (r: string) => {
      if (r === 'lodash') return realLodash;
      if (r === 'src/api/form') return formAjax;
      if (r === 'src/api/publicWorksheet') return publicWorksheetAjax;
      if (r === '../../utils') return realUtils;
      if (r === 'src/redux/types') return {};
      if (r === 'src/utils/controlTypes') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };

  const actions = load('actions.ts');

  const harnessRef: { current?: Harness } = {};

  const harness: Harness = {
    actions,
    apiCalls,
    pending,
    dispatched,
    /**
     * 【dispatch 要执行嵌套 thunk】真实 redux-thunk 中间件在收到函数时会**调用**它。
     * `addWorksheetControl` / `hideControl` 都会 `dispatch(hideControl(...))` 这种嵌套 thunk；
     * 若只记录不执行，就会少的正是嵌套那一层（我第一版就是这样漏掉了 HIDE_CONTROL）。
     */
    dispatch: (action: unknown) => {
      if (typeof action === 'function') {
        record('dispatch:thunk');
        const current = harnessRef.current;

        // 注意是 harnessRef.current.getState —— 不是 harnessRef.getState
        return (action as (d: unknown, g: unknown) => unknown)(current!.dispatch, current!.getState);
      }
      dispatched.push(action);
      record(`dispatch:${(action as { type?: string })?.type ?? 'unknown'}`);
      return undefined;
    },
    getState: () => state,
  };

  harnessRef.current = harness;
  return harness;
}

/* ────────────────────────── 断言脚手架 + 防假绿 ────────────────────────── */

let summarized = false;
let checks = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  checks += 1;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      realConsole.log(`  ✓ ${name}`);
    })
    .catch(error => {
      failed += 1;
      realConsole.error(`  ✗ ${name}`);
      realConsole.error(`      ${error instanceof Error ? error.message : String(error)}`);
    });
}

/**
 * 【不再有任何"预期拒绝"白名单】`refreshShareUrl` 的失败路径已修好（见下方用例），
 * 本规格内**不应再出现**未处理拒绝；因此这里保持最严格的处理：
 * 任何未处理拒绝都直接判失败，**不全局吞掉**（lead 明确要求）。
 * 旧实现的"未处理拒绝 → 进程非零退出"由 `refreshFailureFixture.ts` 在**独立子进程**里证明，
 * 这样既不依赖白名单，也保住了旧基线证据。
 */
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

/* ────────────────────────── 场景 ────────────────────────── */

const BASE_STATE = {
  worksheetInfo: { worksheetId: 'w1', projectId: 'p1' },
  worksheetSettings: { ipControlId: 'c1' },
  originalControls: [{ controlId: 'c1', type: 1 }],
  controls: [{ controlId: 'c1', type: 1, col: 0, row: 0 }],
  hidedControlIds: [],
};

/** 真实载荷（模拟 getDispatchData 的输入 DTO） */
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
    controls: [{ controlId: 'c1', type: 1 }],
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

async function main(): Promise<void> {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV.slice(0, 9)} 的 reducers/actions sha256 已实际断言`);
  realConsole.log(`  ✓ 真实 utils 声明抽取：${Object.keys(loadRealUtils()).join(', ')}`);

  /* ── 1. loadPublicWorksheet：成功后 dispatch 的载荷（含 getDispatchData 的原地副作用）── */

  await check('loadPublicWorksheet：成功后 dispatch LOAD_SUCCESS，载荷字段与真实生产方一致', async () => {
    const h = makeHarness('current', BASE_STATE);
    const dto = makeDto();

    h.actions.loadPublicWorksheet({ worksheetId: 'w1' })(h.dispatch, h.getState);
    assert.equal(h.pending.length, 1, '应发起一次接口请求');

    const def = h.pending[0].def;
    def.resolve(dto);
    await def.promise;
    await flush();

    const loadAction = h.dispatched.find(
      (a: any) => a && a.type === 'PUBLICWORKSHEET_LOAD_SUCCESS',
    ) as any;
    assert.ok(loadAction, '应派发 PUBLICWORKSHEET_LOAD_SUCCESS');

    // 业务字段映射
    assert.equal(loadAction.url, 'https://example.com/p/abc');
    assert.equal(loadAction.worksheetInfo.worksheetId, 'w1');
    assert.equal(loadAction.worksheetInfo.themeIndex, 3, 'themeColor → themeIndex');
    assert.equal(loadAction.worksheetInfo.themeBgColor, '#fff');
    assert.equal(loadAction.worksheetInfo.logoUrl, 'https://cdn/logo.png?x=1', 'logo → logoUrl');
    assert.equal(loadAction.worksheetInfo.coverUrl, 'https://cdn/cover.png?y=2', 'cover → coverUrl');
    assert.deepEqual(loadAction.hidedControlIds, ['c9']);

    // showtype '2' 的 type=29 控件应被改写为 '5'（真实业务规则）
    const rewritten = loadAction.originalControls.find((c: any) => c.controlId === 'c2');
    assert.equal(rewritten.advancedSetting.showtype, '5', 'type=29 且 showtype∈{2,6} 时应改写为 5');
  });

  await check('loadPublicWorksheet：getDispatchData 会原地改写传入的 extendDatas.shareConfig（副作用如实记录）', async () => {
    const h = makeHarness('current', BASE_STATE);
    const dto = makeDto() as any;
    dto.extendDatas = { shareConfig: '{"title":"原值"}' };
    const extendDatasRef = dto.extendDatas;

    h.actions.loadPublicWorksheet({ worksheetId: 'w1' })(h.dispatch, h.getState);
    h.pending[0].def.resolve(dto);
    await h.pending[0].def.promise;
    await flush();

    // 【原地副作用】原实现直接写 dto.extendDatas.shareConfig，没有克隆
    assert.equal(
      extendDatasRef.shareConfig !== '{"title":"原值"}',
      true,
      '传入对象的 extendDatas.shareConfig 应被原地改写为 JSON 字符串',
    );
    assert.equal(typeof extendDatasRef.shareConfig, 'string');
    const parsed = JSON.parse(extendDatasRef.shareConfig);
    assert.equal(parsed.title, '原值', '已有 title 应保留');
    assert.ok(parsed.desc, 'desc 缺省时应补默认文案');
  });

  /* ── 2. 保存成功/失败的回调与 alert 顺序 ── */

  await check('updateSettings：成功时先 cb(true)、再 dispatch UPDATE_SETTINGS', async () => {
    const h = makeHarness('current', BASE_STATE);
    const order: string[] = [];

    h.actions.updateSettings({ needCaptcha: true }, (ok: boolean) => {
      order.push(`cb:${ok}`);
      record(`cb:${ok}`);
    })(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 1);
    assert.equal(h.apiCalls[0].method, 'saveSetting');
    assert.equal(h.apiCalls[0].args.worksheetId, 'w1');
    assert.equal(h.apiCalls[0].args.projectId, 'p1');

    h.pending[0].def.resolve(true);
    await h.pending[0].def.promise;
    await flush();

    const cbIndex = events.findIndex(e => e === 'cb:true');
    const dispatchIndex = events.findIndex(e => e.startsWith('dispatch:PUBLICWORKSHEET_UPDATE_SETTINGS'));
    assert.ok(cbIndex >= 0, '应调用 cb(true)');
    assert.ok(dispatchIndex >= 0, '应派发 UPDATE_SETTINGS');
    assert.ok(cbIndex < dispatchIndex, '原实现是 cb 先、dispatch 后');
    assert.deepEqual(order, ['cb:true']);
  });

  await check('updateSettings：接口失败时只 cb(false)，不 dispatch、不 alert', async () => {
    const h = makeHarness('current', BASE_STATE);
    let calledWith: boolean | undefined;

    h.actions.updateSettings({ needCaptcha: true }, (ok: boolean) => {
      calledWith = ok;
    })(h.dispatch, h.getState);

    h.pending[0].def.reject(new Error('boom'));
    await h.pending[0].def.promise.catch(() => undefined);
    await flush();

    assert.equal(calledWith, false, '失败应回调 cb(false)');
    assert.equal(
      h.dispatched.some((a: any) => a && a.type === 'PUBLICWORKSHEET_UPDATE_SETTINGS'),
      false,
      '失败不应派发 UPDATE_SETTINGS',
    );
    assert.equal(alerts.length, 0, 'updateSettings 失败原实现不 alert');
  });

  await check('updateBaseConfig（经 updateWorksheetInfo）：成功才回调，失败 alert「保存失败」且不回调', async () => {
    // 成功路径
    const ok = makeHarness('current', BASE_STATE);
    let cbCount = 0;
    ok.actions.updateWorksheetVisibleType(1, () => {
      cbCount += 1;
    })(ok.dispatch, ok.getState);

    assert.equal(ok.apiCalls.length, 1);
    assert.equal(ok.apiCalls[0].method, 'saveWorksheet');
    ok.pending[0].def.resolve(true);
    await ok.pending[0].def.promise;
    await flush();
    assert.equal(cbCount, 1, '保存成功应触发回调');

    // 失败路径
    const bad = makeHarness('current', BASE_STATE);
    let badCb = 0;
    bad.actions.updateWorksheetVisibleType(1, () => {
      badCb += 1;
    })(bad.dispatch, bad.getState);
    bad.pending[0].def.reject(new Error('boom'));
    await bad.pending[0].def.promise.catch(() => undefined);
    await flush();
    assert.equal(badCb, 0, '保存失败不应触发回调');
    assert.equal(alerts.length, 1, '失败应 alert 一次');
    assert.equal(alerts[0].message, '保存失败');
    assert.equal(alerts[0].type, 3);
  });

  /* ── 3. 200 字段上限 ── */

  await check('addWorksheetControl：originalControls 达 200 时拦截、不请求、alert 上限提示', async () => {
    const h = makeHarness('current', {
      ...BASE_STATE,
      originalControls: Array.from({ length: 200 }, (_, i) => ({ controlId: `c${i}`, type: 1 })),
    });

    h.actions.addWorksheetControl('新字段')(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 0, '达上限不应发起请求');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].message, /200/);
    assert.equal(alerts[0].type, 3);
  });

  await check('addWorksheetControl：未达上限时请求 → dispatch ADD_CONTROL → dispatch HIDE_CONTROL → cb', async () => {
    const h = makeHarness('current', BASE_STATE);
    let created: any = null;

    h.actions.addWorksheetControl('新字段', (data: any) => {
      created = data;
      record('cb:add');
    })(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 1);
    assert.equal(h.apiCalls[0].method, 'addTextControl');
    assert.equal(h.apiCalls[0].args.name, '新字段');

    h.pending[0].def.resolve({ controlId: 'new1', type: 1 });
    await h.pending[0].def.promise;
    await flush();

    const types = h.dispatched.map((a: any) => a && a.type).filter(Boolean);
    // `addWorksheetControl` 会 `dispatch(hideControl(data.controlId))`，
    // 而 `hideControl` 自身又派发 HIDE_CONTROL 与 UPDATE_CONTROLS —— 所以是 3 个动作。
    // （我最初只写了 2 个，是期望漏了，不是实现多派发。）
    assert.deepEqual(types, [
      'PUBLICWORKSHEET_ADD_CONTROL',
      'WORKSHEET_HIDE_CONTROL',
      'PUBLICWORKSHEET_UPDATE_CONTROLS',
    ]);
    assert.equal(created.controlId, 'new1');
    // 且新控件应被加入隐藏列表（hideControl 的效果）
    const updateAction = h.dispatched[2] as any;
    assert.equal(
      updateAction.controls.some((c: any) => c.controlId === 'new1'),
      false,
      '隐藏后该控件不应出现在可见控件里',
    );
  });

  /* ── 4. isSave=false 分支 ── */

  await check('changeControls：isSave=false 时只 dispatch，不调用保存接口', async () => {
    const h = makeHarness('current', BASE_STATE);
    h.actions.changeControls([{ controlId: 'c1', col: 1, row: 2 }], false)(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 0, 'isSave=false 不应调用 saveWorksheet');
    const types = h.dispatched.map((a: any) => a && a.type);
    assert.deepEqual(types, ['PUBLICWORKSHEET_UPDATE_CONTROLS']);
  });

  await check('changeControls：isSave=true 时 dispatch 后调用 saveWorksheet，且只上报布局字段', async () => {
    const h = makeHarness('current', BASE_STATE);
    h.actions.changeControls(
      [{ controlId: 'c1', col: 1, row: 2, size: 2, advancedSetting: { x: 1 } }],
      true,
    )(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 1);
    assert.equal(h.apiCalls[0].method, 'saveWorksheet');
    assert.deepEqual(h.apiCalls[0].args.controls, [{ controlId: 'c1', col: 1, row: 2, size: 2 }]);
    // 顺序：先 dispatch，再请求
    const dispatchIndex = events.findIndex(e => e.startsWith('dispatch:PUBLICWORKSHEET_UPDATE_CONTROLS'));
    assert.ok(dispatchIndex >= 0);
  });

  /* ── 5. 原地副作用：changeKeyToServer 会改传入 value 并删除字段 ── */

  await check('updateWorksheetInfo：changeKeyToServer 原地改写调用方 value 并删除 camel 键（副作用如实记录）', async () => {
    const h = makeHarness('current', BASE_STATE);
    const value: Record<string, unknown> = {
      coverUrl: 'https://cdn/cover.png?q=1',
      logoUrl: 'https://cdn/logo.png?q=2',
      themeIndex: 7,
      visibleType: 2,
    };
    const sameRef = value;

    h.actions.updateWorksheetInfo(value)(h.dispatch, h.getState);

    // 【原地副作用】原实现直接改同一个对象：新增接口键、删除前端键
    assert.equal(sameRef.cover, 'https://cdn/cover.png', 'coverUrl 去掉 query 后写入 cover');
    assert.equal(sameRef.logo, 'https://cdn/logo.png');
    assert.equal(sameRef.themeColor, 7);
    assert.equal('coverUrl' in sameRef, false, 'coverUrl 应被删除');
    assert.equal('logoUrl' in sameRef, false);
    assert.equal('themeIndex' in sameRef, false);
    assert.equal(sameRef.visibleType, 2, '无关字段保留');

    // 且该对象被送进 saveWorksheet
    assert.equal(h.apiCalls.length, 1);
    assert.equal(h.apiCalls[0].args.cover, 'https://cdn/cover.png');
  });

  /* ── 6. hideControl / showControl 的分发顺序与状态联动 ── */

  await check('hideControl：先保存、再 dispatch HIDE_CONTROL、再 dispatch UPDATE_CONTROLS', async () => {
    const h = makeHarness('current', BASE_STATE);
    h.actions.hideControl('c1')(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 1, '应发起一次保存');
    const types = h.dispatched.map((a: any) => a && a.type);
    assert.deepEqual(types, ['WORKSHEET_HIDE_CONTROL', 'PUBLICWORKSHEET_UPDATE_CONTROLS']);

    const hideAction = h.dispatched[0] as any;
    assert.equal(hideAction.controlId, 'c1');
  });

  await check('showControl：dispatch SHOW_CONTROL，并在 scrollToFormEnd 存在时调用它', async () => {
    const h = makeHarness('current', BASE_STATE);
    let scrolled = 0;
    (globalThis as any)['window'].scrollToFormEnd = () => {
      scrolled += 1;
    };

    h.actions.showControl([{ controlId: 'c9', type: 1, half: false }])(h.dispatch, h.getState);

    const showAction = h.dispatched.find((a: any) => a && a.type === 'WORKSHEET_SHOW_CONTROL') as any;
    assert.ok(showAction, '应派发 WORKSHEET_SHOW_CONTROL');
    assert.deepEqual(showAction.controlIds, ['c9']);
    assert.equal(scrolled, 1, 'window.scrollToFormEnd 存在时应调用一次');
  });

  /* ── 7. refreshShareUrl：alert 在 dispatch 之前、url 直接落值（无 || ''）── */

  await check('refreshShareUrl：先 alert「刷新成功」、再 dispatch UPDATE_URL，url 原样落值', async () => {
    const h = makeHarness('current', BASE_STATE);

    h.actions.refreshShareUrl()(h.dispatch, h.getState);

    assert.equal(h.apiCalls.length, 1);
    assert.equal(h.apiCalls[0].method, 'refreshPublicWorksheetUrl');
    assert.equal(h.apiCalls[0].args.worksheetId, 'w1', '应带上 state 里的 worksheetId');

    // 注意返回体里就是 url 字段（不是 data.url 之外的包装）
    h.pending[0].def.resolve({ url: 'https://new.example.com/p/xyz' });
    await h.pending[0].def.promise;
    await flush();

    const alertIndex = events.findIndex(e => e.startsWith('alert:刷新成功'));
    const dispatchIndex = events.findIndex(e => e.startsWith('dispatch:PUBLICWORKSHEET_UPDATE_URL'));
    assert.ok(alertIndex >= 0, '应 alert「刷新成功」');
    assert.ok(dispatchIndex >= 0, '应派发 UPDATE_URL');
    assert.ok(alertIndex < dispatchIndex, '原实现是先 alert 再 dispatch');

    const action = h.dispatched.find(
      (a: any) => a && a.type === 'PUBLICWORKSHEET_UPDATE_URL',
    ) as any;
    assert.equal(action.url, 'https://new.example.com/p/xyz', 'url 应原样落值（不经 || 归一）');
  });

  await check('refreshShareUrl：url 为空串时保持空串（与 reducer 的 || 规则配合，不在 thunk 里兜底）', async () => {
    const h = makeHarness('current', BASE_STATE);
    h.actions.refreshShareUrl()(h.dispatch, h.getState);
    h.pending[0].def.resolve({ url: '' });
    await h.pending[0].def.promise;
    await flush();

    const action = h.dispatched.find(
      (a: any) => a && a.type === 'PUBLICWORKSHEET_UPDATE_URL',
    ) as any;
    assert.equal(action.url, '', "thunk 不改变 url，归一交给 reducer 的 || 规则");
  });

  await check('refreshShareUrl（修复后）：失败时显示本地错误提示、不派发、不显示成功提示', async () => {
    /**
     * 【独立行为修复的验收】修复前该 thunk 只挂 `.then`、**没有 `.catch`**：
     * 接口失败会产生未处理拒绝、且用户得不到任何反馈（旧行为的**基线证据**仍由
     * `refreshFailureFixture.ts` 的子进程用例保留，见下方第 8 组）。
     *
     * 修复后本用例断言三件事：
     *   1. 显示**本地错误提示**（与同文件其他失败分支同风格：`刷新失败`, type 3）；
     *   2. **不派发** `PUBLICWORKSHEET_UPDATE_URL`；
     *   3. **不显示成功提示**（不出现「刷新成功」）。
     */
    const h = makeHarness('current', BASE_STATE);
    h.actions.refreshShareUrl()(h.dispatch, h.getState);

    h.pending[0].def.reject(new Error('refresh-boom'));
    await h.pending[0].def.promise.catch(() => undefined);
    await flush();

    assert.equal(
      h.dispatched.some((a: any) => a && a.type === 'PUBLICWORKSHEET_UPDATE_URL'),
      false,
      '失败时不应派发 UPDATE_URL',
    );
    assert.equal(
      alerts.some(a => a.message === '刷新成功'),
      false,
      '失败时不应显示成功提示',
    );
    assert.equal(alerts.length, 1, '失败时应显示一次本地错误提示');
    assert.equal(alerts[0].message, '刷新失败');
    assert.equal(alerts[0].type, 3);
  });

  await check('refreshShareUrl（修复后）：成功路径的 alert/dispatch 顺序与参数不变', async () => {
    // 修复只加 `.catch`，成功路径必须逐字未变
    const h = makeHarness('current', BASE_STATE);
    h.actions.refreshShareUrl()(h.dispatch, h.getState);

    const returned = h.pending[0].def;
    returned.resolve({ url: 'https://new.example.com/p/xyz' });
    await returned.promise;
    await flush();

    const alertIndex = events.findIndex(e => e.startsWith('alert:刷新成功'));
    const dispatchIndex = events.findIndex(e => e.startsWith('dispatch:PUBLICWORKSHEET_UPDATE_URL'));
    assert.ok(alertIndex >= 0, '应 alert「刷新成功」');
    assert.ok(dispatchIndex >= 0, '应派发 UPDATE_URL');
    assert.ok(alertIndex < dispatchIndex, '成功路径顺序保持：先 alert 再 dispatch');
    assert.equal(alerts.length, 1, '成功路径只应有一次提示');

    const action = h.dispatched.find(
      (a: any) => a && a.type === 'PUBLICWORKSHEET_UPDATE_URL',
    ) as any;
    assert.equal(action.url, 'https://new.example.com/p/xyz', 'url 仍原样落值');
  });

  /* ── 8a.【保留旧基线证据】子进程：旧路径未处理拒绝 → 非零退出；修复后 → 0 ── */

  await check('子进程证据：基线路径因未处理拒绝非零退出，修复后为 0（不全局吞掉拒绝）', async () => {
    /**
     * 【为什么必须用独立子进程】主规格装了 `unhandledRejection` 守卫；
     * 若在同一进程里观察旧行为，就无法区分"旧路径真的会炸"与"被守卫吃掉了"。
     * 因此夹具 `refreshFailureFixture.ts` **不装任何全局处理器**，由退出码说话。
     * 这也满足 lead 的"不要全局吞掉未处理拒绝"。
     */
    const { spawnSync } = require('node:child_process');
    const fixture = path.join(DIR, 'refreshFailureFixture.ts');

    const orig = spawnSync(process.execPath, [fixture, 'orig'], { encoding: 'utf8', cwd: ROOT });
    assert.notEqual(orig.status, 0, `基线路径应因未处理拒绝非零退出，实际 status=${orig.status}`);

    const current = spawnSync(process.execPath, [fixture, 'current'], { encoding: 'utf8', cwd: ROOT });
    assert.equal(current.status, 0, `修复后不应出现未处理拒绝，实际 status=${current.status}；stderr=${current.stderr}`);
    assert.match(current.stdout, /alerts=\["刷新失败"\]/, '修复后应输出本地错误提示');
    assert.match(current.stdout, /dispatched=\[\]/, '修复后不应派发成功 URL');
  });

  /* ── 8. 失败路径：reset 失败 alert ── */

  await check('resetControls：成功且 data.success 时 dispatch LOAD_SUCCESS；失败 alert「重置失败」type=2', async () => {
    const ok = makeHarness('current', BASE_STATE);
    ok.actions.resetControls()(ok.dispatch, ok.getState);
    assert.equal(ok.apiCalls[0].method, 'reset');
    ok.pending[0].def.resolve({ success: true, info: makeDto() });
    await ok.pending[0].def.promise;
    await flush();
    assert.ok(
      ok.dispatched.some((a: any) => a && a.type === 'PUBLICWORKSHEET_LOAD_SUCCESS'),
      '成功时应收敛为 LOAD_SUCCESS',
    );

    const bad = makeHarness('current', BASE_STATE);
    bad.actions.resetControls()(bad.dispatch, bad.getState);
    bad.pending[0].def.reject(new Error('boom'));
    await bad.pending[0].def.promise.catch(() => undefined);
    await flush();
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].message, '重置失败');
    assert.equal(alerts[0].type, 2);
  });

  /* ── 8. A/B：基线 actions.ts 与工作区版本在上述机制上一致 ── */

  await check('A/B：同一输入下基线 actions.ts 与工作区版本的 dispatch 序列与 API 调用一致', async () => {
    async function run(variant: 'orig' | 'current') {
      const h = makeHarness(variant, BASE_STATE);
      h.actions.loadPublicWorksheet({ worksheetId: 'w1' })(h.dispatch, h.getState);

      // 【刻意覆盖参数级路径】`isSave=false` 不调 API，抓不到"上报字段被改错"这类差异；
      // 因此序列里加入 isSave=true、updateWorksheetInfo（走 changeKeyToServer）与
      // updateSettings（走 saveSetting 参数拼装）。
      h.actions.changeControls([{ controlId: 'c1', col: 1, row: 2 }], false)(h.dispatch, h.getState);
      h.actions.changeControls(
        [{ controlId: 'c1', col: 1, row: 2, size: 2, advancedSetting: { x: 1 } }],
        true,
      )(h.dispatch, h.getState);
      h.actions.updateWorksheetInfo({
        coverUrl: 'https://cdn/cover.png?q=1',
        themeIndex: 7,
        visibleType: 2,
      })(h.dispatch, h.getState);
      h.actions.updateSettings({ needCaptcha: true, receipt: 'r1' })(h.dispatch, h.getState);
      h.actions.hideControl('c2')(h.dispatch, h.getState);

      // 结算第一个（load）与第二个（saveWorksheet）受控 Promise
      h.pending[0].def.resolve(makeDto());
      await h.pending[0].def.promise;
      await flush();

      return {
        /**
         * 【连参数一起深比较】先前只比 `{api, method}`，于是"参数被改错"这类差异看不见。
         * `args` 是普通对象（不含 Promise/函数），可以安全参与 `deepEqual`；
         * lodash 的 `deepEqual` 会保留 `undefined` 键，正是本模块 `|| ''` / `_.assign`
         * 语义所在的位置。
         */
        apiCalls: h.apiCalls.map(c => ({ api: c.api, method: c.method, args: c.args })),
        dispatchTypes: h.dispatched.map((a: any) => (a && a.type) || 'thunk'),
        /** dispatch 的动作载荷也一起比较（例如 controls 数组内容） */
        dispatchedPayloads: h.dispatched.map((a: any) =>
          a && a.type ? { type: a.type, payload: { ...a, type: undefined } } : null,
        ),
        alerts: alerts.map(a => ({ message: a.message, type: a.type })),
      };
    }

    const origResult = await run('orig');
    const currentResult = await run('current');
    assert.deepEqual(currentResult, origResult);
  });

  summarized = true;
  if (failed) {
    realConsole.error(`PublicWorksheetConfig thunk 异步规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PublicWorksheetConfig thunk 异步规格通过：${checks} 项（受控 Promise + 真实 utils 声明抽取）`,
  );
}

main().catch(error => {
  realConsole.error(
    `主流程异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
