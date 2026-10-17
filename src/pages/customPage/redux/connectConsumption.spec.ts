/**
 * 真实组件对 `customPage` 切片的 **connect 消费**规格
 *
 * 【为什么要这一份】reducer 规格只证明"状态产出正确"，不证明"真实消费方能正确读它"。
 * 本批给 `customPage` 加了有限类型，最该验证的就是**真实组件的 `mapStateToProps`
 * 在拿到真实 state 时行为不变**。
 *
 * 【做法】加载**真实的** `ViewDisplay.tsx`：
 *   - 只替身它的 UI 依赖（`ming-ui` 的 LoadDiv、`../editWidget/view/Preview` 的 View）；
 *   - **不替身 `connect`** —— 而是把真实模块调用的 `connect(selector)` 的 selector **捕获下来**；
 *   - state 由**真实 reducer** 通过真实 `configureStore` 派发动作产生（不是手写的假 state）。
 * 然后直接调用捕获到的 selector，断言它在 desktop / mobile 两种 `ownProps.layoutType` 下
 * 的输出与历史实现一致。
 *
 * 【为什么不整棵渲染】`ViewDisplay` 的可见性由 `useEffect` + DOM 驱动，
 * `react-dom/server` 不执行 effect，整树渲染会停在 loading 分支，观测不到 selector 的真实产出。
 * 因此这里聚焦 selector —— 它正是"消费 customPage 切片"的那一层。
 *
 * 【A 侧】`git show fc6676e67:` 下的 `ViewDisplay.tsx` + `reducers.ts` + `action.ts`，
 * 三份 sha256 都冻结并**实际断言**。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

const { configureStore, combineReducers } = require('@reduxjs/toolkit');

/* ────────────────────────── A 侧基线（冻结 + 实际断言） ────────────────────────── */

const DIR = __dirname;
/** 组件在上一级目录的 components/WidgetContent 下 */
const COMPONENT_DIR = path.join(DIR, '..', 'components', 'WidgetContent');
const BASE_REV = 'fc6676e67';

const FROZEN: { file: string; relPath: string; sha: string }[] = [
  {
    file: 'reducers.ts',
    relPath: 'src/pages/customPage/redux/reducers.ts',
    sha: '51e8f494a24e546e06addd5d225c46a8d8a11ec300f917e6a92664d220104d1a',
  },
  {
    file: 'action.ts',
    relPath: 'src/pages/customPage/redux/action.ts',
    sha: 'b31930a8fe8144144e826e6c38b4a4f8f498588e79daa0dfe95f4a248e76f288',
  },
  {
    // ViewDisplay 本身未被本批修改，A 侧用于对照 selector 行为
    file: 'ViewDisplay.tsx',
    relPath: 'src/pages/customPage/components/WidgetContent/ViewDisplay.tsx',
    sha: 'FETCH_AT_RUNTIME',
  },
];

function gitShow(relPath: string): string {
  return execFileSync('git', ['show', `${BASE_REV}:${relPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

const origCache: Record<string, string> = {};
function orig(relPath: string): string {
  if (origCache[relPath] === undefined) origCache[relPath] = gitShow(relPath);
  return origCache[relPath];
}

/** 冻结 sha 的实际断言（ViewDisplay 的 A 侧 sha 在运行时算出并锁定到当前工作区版本，
 *  因为该文件本批未改，两侧应当完全一致） */
function assertBaselineIntact(): void {
  for (const item of FROZEN) {
    if (item.sha === 'FETCH_AT_RUNTIME') continue;
    const actual = crypto.createHash('sha256').update(orig(item.relPath)).digest('hex');
    assert.equal(actual, item.sha, `A 侧 ${item.file} 在 ${BASE_REV} 的 sha256 与冻结值不符`);
  }
  // ViewDisplay：A 侧与当前工作区必须一致（本批没改它），否则说明对照基准被动过
  const origSha = crypto.createHash('sha256').update(orig(FROZEN[2].relPath)).digest('hex');
  const currentSha = crypto
    .createHash('sha256')
    .update(require('node:fs').readFileSync(path.join(COMPONENT_DIR, 'ViewDisplay.tsx')))
    .digest('hex');
  assert.equal(
    origSha,
    currentSha,
    'ViewDisplay.tsx 在基线与本工作区不一致 —— 本批不应修改它，A/B 基准失效',
  );
}

/* ────────────────────────── 环境替身 ────────────────────────── */

const realLodash = require('lodash');
const realMaxBy = require('lodash/maxBy');
const realUpdate = require('immutability-helper').default || require('immutability-helper');

(globalThis as Record<string, unknown>)['sessionStorage'] = {
  length: 0,
  key: () => null,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
(globalThis as Record<string, unknown>)['document'] = { querySelector: () => null };

/** `../util` 的最小替身（reducer 只用这三个导出；逐字复制自 util.ts） */
function makeUtilStub() {
  const enumWidgetType = {
    analysis: 1, richText: 2, embedUrl: 3, button: 4, view: 5, filter: 6,
    carousel: 7, ai: 8, tabs: 9, card: 10, image: 11, subsection: 12,
  };
  const getIndexById = ({ component, components }: any) => {
    const id = component.id || component.uuid;
    return realLodash.findIndex(components, (item: any) => item.id === id || item.uuid === id);
  };
  const getDefaultLayout = ({ components = [], layoutType = 'web', titleVisible }: any) => {
    if (layoutType === 'web') return { x: (components.length * 24) % 48, y: Infinity, w: 24, h: 12, minW: 2, minH: 4 };
    const last = realMaxBy(components, (item: any) => realLodash.get(item, ['mobile', 'layout', 'y'])) || {};
    const y = (last as any).y ?? 0;
    const h = (last as any).h ?? 6;
    return { x: 0, y: y + h, w: 4, h: titleVisible ? 7 : 6, minW: 1, minH: 2 };
  };
  return { enumWidgetType, getIndexById, getDefaultLayout };
}

/** `filter/util` 的 formatFiltersGroup：逐字复制自
 *  `components/editWidget/filter/util.ts:5-…`（只用到 lodash 的 flatten/find/map/filter） */
function makeFormatFiltersGroupStub() {
  const formatFiltersGroup = (id: unknown, filtersGroup: Record<string, any[]>) => {
    const targets = realLodash
      .flatten(Object.keys(filtersGroup || {}).map(key => filtersGroup[key]))
      .filter((c: any) => realLodash.find(c.objectControls, { objectId: id }));
    return targets.map((f: any) => {
      const hit = realLodash.find(f.objectControls, { objectId: id });
      return { ...f, controlId: hit ? hit.controlId : undefined };
    });
  };
  return { formatFiltersGroup };
}

/** 捕获真实 `connect(selector)` 里的 selector */
const capturedSelectors: ((state: any, ownProps: any) => any)[] = [];

function makeLoader(variant: 'orig' | 'current', sourceRoot: string) {
  const cache = new Map<string, any>();
  const load = (relPath: string): any => {
    if (cache.has(relPath)) {
      const hit = cache.get(relPath);
      return hit.exports ?? hit;
    }
    const moduleLike: any = { exports: {} };
    cache.set(relPath, moduleLike);

    // relPath 有两种形态：仓库相对路径（含 '/'，如 `src/pages/.../ViewDisplay.tsx`）
    // 和同目录文件（如 `reducers.ts`）。`git show` 只接受仓库相对路径，
    // 而 `transformFileSync` 需要磁盘上的绝对路径。
    const isRepoRelative = relPath.startsWith('src/');
    const filename = isRepoRelative ? path.join(ROOT, relPath) : path.join(sourceRoot, relPath);
    // 记录本模块所在目录：它的相对 import 应相对**它自己**解析，而不是相对组件目录
    const moduleDir = path.dirname(filename);
    const moduleRelDir = isRepoRelative
      ? path.relative(ROOT, moduleDir).split(path.sep).join('/')
      : null;
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const code =
      variant === 'orig' && isRepoRelative
        ? (transformSync(orig(relPath), { ...babelOpts, filename }) as { code: string }).code
        : transformFileSync(filename, babelOpts).code;

    const req = (r: string) => {
      if (r === 'immutability-helper') return realUpdate;
      if (r === 'lodash') return realLodash;
      if (r === 'lodash/maxBy') return realMaxBy;
      if (r === 'uuid') return { v4: () => 'uuid-1' };
      if (r === '../util' || r === '../util.ts') return makeUtilStub();
      if (r === 'src/redux/types') return {};
      if (r === 'react') return require('react');
      if (r === 'react/jsx-runtime') {
        // 组件用自动 JSX runtime 编译；用真实 runtime 即可（不需要替身）
        return require('react/jsx-runtime');
      }
      if (r === 'react-redux') {
        // 【关键】不替身 connect 本身，而是捕获它收到的 selector
        return {
          connect: (selector: any) => (Component: any) => {
            capturedSelectors.push(selector);
            return Component;
          },
        };
      }
      if (r === 'ming-ui') return { LoadDiv: () => null };
      if (r === 'src/pages/customPage/components/editWidget/filter/util') return makeFormatFiltersGroupStub();
      if (r === '../editWidget/view/Preview') return { View: () => null };
      if (r.startsWith('./')) {
        // 同目录模块（reducers.ts / action.ts / actionType.ts）：
        // 若当前模块在仓库内，用「它自己的仓库相对目录 + 文件名」；
        // 否则退回组件目录。
        const file = `${r.slice(2)}.ts`;
        return load(moduleRelDir ? `${moduleRelDir}/${file}` : file);
      }
      if (r.endsWith('.less') || r.endsWith('.html')) return {};
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${relPath}）`);
    };

    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };
  return load;
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
  realConsole.error(`未处理的 Promise 拒绝，判为失败：${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
  process.exitCode = 1;
});
process.on('uncaughtException', error => {
  realConsole.error(`未捕获异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    realConsole.error('规格没有跑到汇总行（可能有异常被吞掉），判为失败');
    process.exitCode = 1;
  }
});

/* ────────────────────────── 构造真实 state ────────────────────────── */

const VIEW_REL = 'src/pages/customPage/components/WidgetContent/ViewDisplay.tsx';

/** 用真实 reducer + 真实 configureStore 造出 state，并取出 ViewDisplay 的 selector */
function build(variant: 'orig' | 'current') {
  capturedSelectors.length = 0;
  const load = makeLoader(variant, COMPONENT_DIR);

  // 1) 加载组件模块 → 捕获真实 selector
  load(VIEW_REL);
  assert.equal(capturedSelectors.length, 1, '应当捕获到 1 个 connect selector');
  const selector = capturedSelectors[0];

  // 2) 用真实 reducer 建 store（统一用仓库相对路径，`load` 内部会转成绝对路径）
  const REDUX_REL = 'src/pages/customPage/redux';
  const reducers = load(`${REDUX_REL}/reducers.ts`);
  const actions = load(`${REDUX_REL}/action.ts`);

  return { selector, reducer: reducers.default, actions };
}

const MOBILE_VISIBLE_FALSE = { value: 'f1', advancedSetting: {}, filters: [], mobileVisible: false };
const MOBILE_VISIBLE_TRUE = { value: 'f2', advancedSetting: {}, filters: [], mobileVisible: true };
const NO_MOBILE_FLAG = { value: 'f3', advancedSetting: {}, filters: [] };

function run(variant: 'orig' | 'current') {
  const { selector, reducer, actions } = build(variant);
  const store = configureStore({ reducer: combineReducers({ customPage: reducer }) });

  store.dispatch(
    actions.updatePageInfo({
      filtersGroup: { v1: [{ objectControls: [{ objectId: 'o1', controlId: 'c1' }] }] },
      filterComponents: [MOBILE_VISIBLE_FALSE, MOBILE_VISIBLE_TRUE, NO_MOBILE_FLAG],
      loadFilterComponentCount: 3,
    }),
  );

  const state = store.getState();
  const desktop = selector(state, { layoutType: 'desktop' });
  const mobile = selector(state, { layoutType: 'mobile' });

  return {
    desktop: {
      filterComponentValues: desktop.filterComponents.map((n: any) => n.value),
      filtersGroupKeys: Object.keys(desktop.filtersGroup || {}),
      loadFilterComponentCount: desktop.loadFilterComponentCount,
    },
    mobile: {
      filterComponentValues: mobile.filterComponents.map((n: any) => n.value),
    },
  };
}

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV}：reducers/action/ViewDisplay 的 sha256 已实际断言（ViewDisplay 两侧一致）`);

  const origResult = run('orig');
  const currentResult = run('current');

  check('真实 connect selector：desktop / mobile 输出与历史实现逐字段一致', () => {
    assert.equal(
      JSON.stringify(currentResult),
      JSON.stringify(origResult),
      `A/B 不一致：\n      A: ${JSON.stringify(origResult)}\n      B: ${JSON.stringify(currentResult)}`,
    );
  });

  check('desktop：不过滤 filterComponents（三条全在）', () => {
    assert.deepEqual(currentResult.desktop.filterComponentValues, ['f1', 'f2', 'f3']);
  });

  check('mobile：直接用 mobileVisible 作为 filter 返回值（false 与 undefined 都被剔除）', () => {
    // 【既有语义，不是我设想的"保留缺失项"】原实现是：
    //     filter(n => ownProps.layoutType === 'mobile' ? n.mobileVisible : true)
    // 即 mobile 时**直接返回 `n.mobileVisible`**，而 `undefined` 在 filter 里是 falsy
    // → 缺该字段的项同样被剔除。故只剩 mobileVisible === true 的 f2。
    // （我最初把期望写成 ['f2','f3'] 是错的，据此更正。）
    assert.deepEqual(
      currentResult.mobile.filterComponentValues,
      ['f2'],
      'mobile 下只有 mobileVisible 恰为 true 的项会保留',
    );
  });

  check('selector 透传 filtersGroup 与 loadFilterComponentCount', () => {
    assert.deepEqual(currentResult.desktop.filtersGroupKeys, ['v1']);
    assert.equal(currentResult.desktop.loadFilterComponentCount, 3);
  });

  summarized = true;
  if (failed) {
    realConsole.error(`customPage connect 消费规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `customPage connect 消费规格通过：${checks} 项（真实 ViewDisplay selector + 真实 reducer/store）`,
  );
}

main();
