/**
 * `PublicWorksheetConfig/redux` 的**真实历史 A/B 行为规格**
 *
 * 【A 侧】`git show 3f768fdd2603727b9ba11c0c579a6d58c4d8283a:…`（lead 指定、main 可达），
 * 两个文件的 sha256 在开头**实际断言**（不是打印）。
 *
 * 【为什么用 `deepEqual` / `Object.is` 而不是 `JSON.stringify`】
 * `JSON.stringify` 会吞掉 `undefined` 键、`NaN`/`Infinity`、数组负索引属性 ——
 * 本模块恰好涉及 `_.assign` 的 own 键语义与 `|| ''` 的空串规则，
 * 用 JSON 比较会把"`undefined` 键被写进结果"这类差异**看不见**。
 * 因此：结构比较用 `node:assert/strict` 的 `deepEqual`；引用/NaN 比较用 `Object.is`。
 *
 * 【覆盖范围】按 lead 点名的行为面：
 * - 初始值 / `LOAD_SUCCESS` / `CLEAR`
 * - URL 的原有 `|| ''` 规则（空串、undefined）
 * - `_.assign` 局部合并与 own 键语义
 * - 控件追加 / 整体替换 / 隐藏 / 显示
 * - `_.uniqBy` 的次序与引用
 * - 初始化空数组 / 缺省值
 * - 未知 action 返回**原引用**
 *
 * 【不做什么】不复制 lead 的产品源码；A 侧源码从 git 读取后按原样执行。
 * `actions.ts` 里的 thunk 依赖网络/alert/window，本文件先覆盖 **reducer 层**（纯函数），
 * thunk 的异步面在后续规格里用可控替身覆盖。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

/* ────────────────────────── A 侧基线（实际断言） ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/FormExtend/PublicWorksheetConfig/redux';
/** lead 指定、main 可达 */
const BASE_REV = '3f768fdd2603727b9ba11c0c579a6d58c4d8283a';

const FROZEN: Record<string, string> = {
  'reducers.ts': 'b8dc740dea5d74c1383c1ffec1416d196e17ad95b86faf5f857f6ed2315d55aa',
  'actions.ts': '29808ec9ca864c6a4439e7ca50473ee49d2e87795fc3d842a997122e47e9d943',
};

const origCache: Record<string, string> = {};
function origSource(file: string): string {
  if (origCache[file] === undefined) {
    origCache[file] = execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return origCache[file];
}

function assertBaselineIntact(): void {
  for (const [file, expected] of Object.entries(FROZEN)) {
    const actual = crypto.createHash('sha256').update(origSource(file)).digest('hex');
    assert.equal(actual, expected, `A 侧 ${file} 在 ${BASE_REV} 的 sha256 与冻结值不符，A/B 对照失效`);
  }
}

/* ────────────────────────── 加载器 ────────────────────────── */

const realLodash = require('lodash');

/**
 * 加载一份 reducer 模块（A 侧取基线源码，B 侧取工作区文件）。
 * `reducers.ts` 只依赖 `redux` + `lodash` + 一个 **type-only** 导入，
 * 因此 `src/redux/types` 返回空对象即可（运行时不会被读）。
 */
function makeLoader(variant: 'orig' | 'current') {
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
      variant === 'orig'
        ? (transformSync(origSource(rel), { ...babelOpts, filename }) as { code: string }).code
        : (transformFileSync(filename, babelOpts) as { code: string }).code;

    const req = (r: string) => {
      if (r === 'redux') return require('redux');
      if (r === 'lodash') return realLodash;
      if (r === 'src/redux/types') return {};
      if (r === 'src/utils/controlTypes') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };
  return load;
}

/** 取某个具名子 reducer */
function reduceOf(load: (rel: string) => any, name: string) {
  return load('reducers.ts')[name];
}

/* ────────────────────────── 断言脚手架 + 防假绿 ────────────────────────── */

let summarized = false;
let checks = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  checks += 1;
  try {
    fn();
    realConsole.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    realConsole.error(`  ✗ ${name}`);
    realConsole.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
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

/* ────────────────────────── 场景 —— A/B 逐项对照 ────────────────────────── */

/** 每对 (名称, 动作序列)；两侧各自从 `undefined` 起跑，逐步比较 */
interface Scenario {
  name: string;
  /** 每个 reducer 名各自的动作序列 */
  steps: Record<string, Array<Record<string, unknown>>>;
}

const LOAD_ACTION = {
  type: 'PUBLICWORKSHEET_LOAD_SUCCESS',
  url: 'https://example.com/p/abc?x=1',
  worksheetSettings: { extendDatas: { shareConfig: '{"title":"t"}' }, ipControlId: 'c1' },
  worksheetInfo: { worksheetId: 'w1', projectId: 'p1', themeIndex: 3 },
  originalControls: [{ controlId: 'c1', type: 1, advancedSetting: { a: '1' } }, { controlId: 'c2', type: 2 }],
  controls: [{ controlId: 'c1', type: 1, col: 0, row: 0 }],
  hidedControlIds: ['c2'],
  shareId: 's1',
};

const SCENARIOS: Scenario[] = [
  {
    name: '初始值（undefined 起跑的默认 state）',
    steps: { loading: [], shareUrl: [], worksheetSettings: [], worksheetInfo: [], originalControls: [], controls: [], hidedControlIds: [] },
  },
  {
    name: 'LOAD_SUCCESS 全量载荷',
    steps: {
      loading: [LOAD_ACTION],
      shareUrl: [LOAD_ACTION],
      worksheetSettings: [LOAD_ACTION],
      worksheetInfo: [LOAD_ACTION],
      originalControls: [LOAD_ACTION],
      controls: [LOAD_ACTION],
      hidedControlIds: [LOAD_ACTION],
    },
  },
  {
    name: 'URL 的原有 || 空串规则：undefined / 空串 / 正常值',
    steps: {
      shareUrl: [
        { type: 'PUBLICWORKSHEET_UPDATE_URL', url: undefined },
        { type: 'PUBLICWORKSHEET_UPDATE_URL', url: '' },
        { type: 'PUBLICWORKSHEET_UPDATE_URL', url: 'https://a/b' },
        { type: 'PUBLICWORKSHEET_LOAD_SUCCESS', url: undefined },
      ],
    },
  },
  {
    name: 'CLEAR：各字段回到初始值',
    steps: {
      loading: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      shareUrl: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      worksheetSettings: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      worksheetInfo: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      originalControls: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      controls: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
      hidedControlIds: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_CLEAR' }],
    },
  },
  {
    name: '_.assign 局部合并（UPDATE_SETTINGS / UPDATE_INFO）',
    steps: {
      worksheetSettings: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_SETTINGS', value: { ipControlId: 'c9', extra: 'x' } },
      ],
      worksheetInfo: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_INFO', value: { worksheetName: '改名' } },
      ],
    },
  },
  {
    name: '_.assign 的 own 键语义：value 含显式 undefined 时覆盖为 undefined',
    steps: {
      worksheetInfo: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_INFO', value: { worksheetId: undefined } },
      ],
      worksheetSettings: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_SETTINGS', value: { ipControlId: undefined } },
      ],
    },
  },
  {
    /**
     * 【own `__proto__` 语义】`JSON.parse('{"__proto__":{…}}')` 会创建一个名为
     * `__proto__` 的**自有属性**。`_.assign` 用 `baseAssignValue` 走
     * `Object.defineProperty`，因此把它当普通 own 键复制、**不污染原型**；
     * 而 `Object.assign` 走 `[[Set]]`，会触发 `__proto__` setter → **污染原型**。
     * 这条用例用于锁死"必须保持 `_.assign`"。
     */
    name: '_.assign 的 own __proto__ 语义：复制为自有键且不污染原型',
    steps: {
      worksheetInfo: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_INFO', value: JSON.parse('{"__proto__":{"polluted":true}}') },
      ],
      worksheetSettings: [
        LOAD_ACTION,
        { type: 'PUBLICWORKSHEET_UPDATE_SETTINGS', value: JSON.parse('{"__proto__":{"polluted":true}}') },
      ],
    },
  },
  {
    name: '控件追加（ADD_CONTROL）',
    steps: {
      originalControls: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_ADD_CONTROL', control: { controlId: 'c3', type: 3 } }],
    },
  },
  {
    name: '控件整体替换（UPDATE_CONTROLS）',
    steps: {
      controls: [LOAD_ACTION, { type: 'PUBLICWORKSHEET_UPDATE_CONTROLS', controls: [{ controlId: 'x', type: 9 }] }],
    },
  },
  {
    name: '控件显示（SHOW_CONTROL）：追加 + 从隐藏列表移除',
    steps: {
      controls: [
        LOAD_ACTION,
        { type: 'WORKSHEET_SHOW_CONTROL', controls: [{ controlId: 'c2', col: 0, row: 5 }], controlIds: ['c2'] },
      ],
      hidedControlIds: [
        LOAD_ACTION,
        { type: 'WORKSHEET_SHOW_CONTROL', controls: [], controlIds: ['c2'] },
      ],
    },
  },
  {
    name: '控件隐藏（HIDE_CONTROL）：uniqBy 追加',
    steps: {
      hidedControlIds: [LOAD_ACTION, { type: 'WORKSHEET_HIDE_CONTROL', controlId: 'c3' }],
    },
  },
  {
    name: 'uniqBy：重复隐藏同一 id 只保留一个，且保持首次出现次序',
    steps: {
      hidedControlIds: [
        LOAD_ACTION,
        { type: 'WORKSHEET_HIDE_CONTROL', controlId: 'c1' },
        { type: 'WORKSHEET_HIDE_CONTROL', controlId: 'c1' },
        { type: 'WORKSHEET_HIDE_CONTROL', controlId: 'c3' },
      ],
    },
  },
  {
    name: '未知 action 返回原引用',
    steps: {
      loading: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      shareUrl: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      worksheetInfo: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      worksheetSettings: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      originalControls: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      controls: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
      hidedControlIds: [LOAD_ACTION, { type: 'SOMETHING_ELSE' }],
    },
  },
  {
    name: '初始化空数组 / 缺省值（LOAD_SUCCESS 给空集合）',
    steps: {
      originalControls: [{ type: 'PUBLICWORKSHEET_LOAD_SUCCESS', originalControls: [] }],
      controls: [{ type: 'PUBLICWORKSHEET_LOAD_SUCCESS', controls: [] }],
      hidedControlIds: [{ type: 'PUBLICWORKSHEET_LOAD_SUCCESS', hidedControlIds: [] }],
    },
  },
];

/** 跑一侧的场景，返回可 deepEqual 的结果 + 引用观察 */
function runScenario(load: (rel: string) => any, scenario: Scenario) {
  const result: Record<string, unknown> = {};

  for (const [reducerName, actions] of Object.entries(scenario.steps)) {
    const reducer = reduceOf(load, reducerName);
    assert.equal(typeof reducer, 'function', `${reducerName} 应是函数`);

    let state: unknown = undefined;
    const refs: Array<{ same: boolean }> = [];

    for (const action of actions) {
      const previous = state;
      state = reducer(state, action);
      refs.push({ same: previous === state });
    }

    result[reducerName] = {
      final: state,
      /** 已知会返回原引用的是"未知 action"场景，这里只记录不比较语义 */
      refs,
    };
  }

  return result;
}

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV.slice(0, 9)} 的 reducers/actions sha256 已实际断言`);

  const loadOrig = makeLoader('orig');
  const loadCurrent = makeLoader('current');

  for (const scenario of SCENARIOS) {
    check(scenario.name, () => {
      const origResult = runScenario(loadOrig, scenario);
      const currentResult = runScenario(loadCurrent, scenario);

      // 1) 结构逐项 deepEqual（能保留 undefined 键、NaN、数组额外属性）
      assert.deepEqual(currentResult, origResult);

      // 2) 逐字段再用 Object.is 比较 NaN / -0 / 引用等价
      for (const reducerName of Object.keys(origResult)) {
        const a = origResult[reducerName] as { final: unknown };
        const b = currentResult[reducerName] as { final: unknown };

        if (typeof a.final === 'number' || typeof b.final === 'number') {
          assert.ok(
            Object.is(a.final, b.final),
            `${reducerName} 的最终值不是 Object.is 相同：${String(b.final)} vs ${String(a.final)}`,
          );
        }
      }

      // 3) "未知 action 返回原引用" 必须两侧都成立
      if (scenario.name === '未知 action 返回原引用') {
        for (const reducerName of Object.keys(scenario.steps)) {
          const refs = (currentResult[reducerName] as { refs: Array<{ same: boolean }> }).refs;
          assert.equal(refs[refs.length - 1].same, true, `${reducerName} 未知 action 应返回原引用`);
        }
      }
    });
  }

  summarized = true;
  if (failed) {
    realConsole.error(`PublicWorksheetConfig reducer A/B 规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PublicWorksheetConfig reducer A/B 规格通过：${checks} 项（基线 ${BASE_REV.slice(0, 9)}，deepEqual + Object.is）`,
  );
}

main();
