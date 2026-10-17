/**
 * 甘特文件夹工具栏 —— **真模块集成** A/B（真实 connect / store / react 渲染）
 *
 * 【为什么要单独一份】`folderToolbar.spec.ts` 为了直接驱动方法，绕过 `connect`
 * 直接实例化内部类。那留下了本批最大的未验证面：**`connect` 的 props 推导与
 * mapStateToProps 接线**没被任何规格碰到。本文件补上这一段：
 *
 *   - 真实 `react` + 真实 `react-redux`（不替身 connect）+ 真实 `redux` store
 *   - 真实 `react-dom/server` 的 `renderToStaticMarkup` 渲染（**不需要 DOM**）
 *   - 只替身 UI 组件（Tooltip / ClickAway / 甘特弹窗）与 createTask 入口
 *
 * 把输出 HTML 在"A 侧（类型改造前）"与"B 侧（当前）"之间逐字段比对，并附若干
 * 绝对断言（active 类必须跟随 store 里的 stateConfig、showStaticGantt 控制入口显隐）。
 *
 * A 侧：`git show 8b67c779b:...folderToolbar.tsx`。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };

/* ────────────────────────── A 侧基线 ────────────────────────── */

const DIR = __dirname;
const REL_FILE = 'src/pages/task/containers/taskGantt/containers/folderToolbar/folderToolbar.tsx';
/**
 * A 侧基线：`b84c1c28a`（lead 指定，**在 origin/main 上可达**）。
 *
 * 早先这里用的是协作分支上的 `8b67c779b`（未推送），会让规格依赖只存在于协作分支的
 * 历史。lead 已核验 `folderToolbar.tsx` 在 `b84c1c28a` 与 `8b67c779b` 两处内容完全相同
 * （sha256 `2d14765c…`），切换基线不改变 A 侧，下面的冻结 SHA 保持不变。
 */
const BASE_REV = 'b84c1c28a763e2ab56b2a6d9b39f2f4294717be6';

let cachedOrig: string | undefined;
function origSource(): string {
  if (cachedOrig === undefined) {
    cachedOrig = execFileSync('git', ['show', `${BASE_REV}:${REL_FILE}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return cachedOrig;
}
const ORIG_SHA = crypto.createHash('sha256').update(origSource()).digest('hex');

/* ────────────────────────── 全局替身（只补浏览器缺的） ────────────────────────── */

/**
 * `_l`：真实的 `_l(key, ...args)` 只在**传了参数**时才替换占位符；
 * `'周%05034'` 里的 `%NNNNN` 是翻译消息 ID，无参数时必须原样保留。
 * 本规格直接断言最终 HTML，因此这里必须与真实语义一致，否则测的是替身而不是产品。
 */
(globalThis as Record<string, unknown>)['_l'] = (s: string, ...args: unknown[]) =>
  args.length === 0 ? String(s) : String(s).replace(/%(\d+)/g, (_m, i) => String(args[Number(i)] ?? ''));

/* ────────────────────────── 真实依赖 ────────────────────────── */

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Provider } = require('react-redux');
const { createStore } = require('redux');
const realLodash = require('lodash');
const realClassnames = require('classnames');
const realConfig = (() => {
  const m = require('../../config/config.ts');
  return m.default || m;
})();
realConfig.folderId = 'connect-folder';

/** UI 组件替身：只需要能渲染出可断言的标记 */
const TooltipStub = (props: { title?: unknown; children?: unknown }) =>
  React.createElement('span', { className: 'stubTooltip', title: String(props.title ?? '') }, props.children as never);
const ClickAwayStub = (props: Record<string, unknown>) =>
  React.createElement(
    (props['component'] as string) || 'div',
    { className: props['className'] as string, style: props['style'] as never },
    props['children'] as never,
  );
const GanttDialogStub = (props: Record<string, unknown>) =>
  React.createElement('span', { className: 'stubGanttDialog', 'data-folder': String(props['folderID'] ?? '') });

function buildStubs() {
  return {
    react: React,
    // 真实 jsx-runtime：让 JSX 与真实 react 元素体系一致
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-redux': require('react-redux'),
    classnames: realClassnames,
    lodash: realLodash,
    moment: require('moment'),
    'ming-ui/antd-components': { Tooltip: TooltipStub },
    'ming-ui/components/ClickAway': { __esModule: true, default: ClickAwayStub },
    'src/components/createTask/load': { __esModule: true, default: () => {} },
    'src/redux/types': {},
    '../../component/ganttDialog': { __esModule: true, default: GanttDialogStub },
    '../../config/config': { __esModule: true, default: realConfig },
    '../../redux/actions': require('../../redux/actions.ts'),
  };
}

/* ────────────────────────── 载入连接后的组件 ────────────────────────── */

function loadConnected(variant: 'orig' | 'current') {
  const stubs = buildStubs();
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const req = (r: string) => {
    if (r in stubs) return stubs[r];
    if (r.endsWith('.less') || r.endsWith('.html')) return {};
    throw new Error(`spec 没给 ${r} 打桩（${variant}）`);
  };
  const filename = path.join(DIR, 'folderToolbar.tsx');
  const babelOpts = {
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  const code =
    variant === 'orig'
      ? (transformSync(origSource(), { ...babelOpts, filename }) as { code: string }).code
      : (transformFileSync(filename, babelOpts) as { code: string }).code;
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
  const mod = moduleLike.exports as { default: unknown };
  assert.ok(mod.default, '模块必须有 default 导出');
  return mod.default as React.ComponentType<Record<string, unknown>>;
}

/* ────────────────────────── 真实 store ────────────────────────── */

function makeStateConfig(overrides: Record<string, unknown> = {}) {
  return {
    currentStatus: -1,
    currentView: 1,
    filterWeekend: true,
    currentLevel: 0,
    dragTaskId: '',
    dragHoverIndex: -1,
    ...overrides,
  };
}

/** 真实 redux store；state.task 用真实字段名，任务配置用一个普通对象 */
function makeStore(stateConfig: Record<string, unknown>) {
  const initial = {
    task: {
      stateConfig,
      taskConfig: { projectId: 'p1', folderId: 'f1' },
    },
  };
  // 静态 reducer：本规格验证的是 connect 接线，不需要业务 action 语义
  return createStore((state: unknown = initial) => state as never, initial as never);
}

/** 渲染连接后的组件；返回 HTML */
function renderConnected(Connected: React.ComponentType<Record<string, unknown>>, stateConfig: Record<string, unknown>, ownProps: Record<string, unknown> = {}) {
  const store = makeStore(stateConfig);
  const element = React.createElement(
    Provider,
    { store },
    React.createElement(Connected, { ...ownProps }),
  );
  return renderToStaticMarkup(element);
}

/** 从 HTML 里抽出可断言的要点（避免整串 HTML 因替换实现细节而抖动） */
function summarize(html: string) {
  const activeItems = (html.match(/<li class="active"/g) || []).length;
  const activeLabels = Array.from(html.matchAll(/<li class="active">([^<]*)<\/li>/g)).map(m => m[1]);
  /** 取某个 <ul> 容器内的 active 标签：视图组与周末组的 class 前缀相同，必须分开取 */
  const activeIn = (ulClass: string) => {
    const escaped = ulClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = html.match(new RegExp(`<ul class="${escaped}"[^>]*>([\\s\\S]*?)</ul>`));
    if (!block) return [];
    return Array.from(block[1].matchAll(/<li class="active">([^<]*)<\/li>/g)).map(m => m[1]);
  };
  const statusLabel = (html.match(/<span class="taskStatus pointer"[^>]*><span>([^<]*)<\/span>/)?.[1] ?? '').trim();
  return {
    activeItems,
    activeLabels,
    viewActive: activeIn('folderGanttBtn'),
    weekendActive: activeIn('folderGanttBtn folderGanttWeekBtn'),
    statusLabel,
    hasGanttEntry: html.includes('folderStaticGantt'),
    hasGanttDialog: html.includes('stubGanttDialog'),
    viewLabels: Array.from(html.matchAll(/<li[^>]*>(天|周[^<]*|月[^<]*)<\/li>/g)).map(m => m[1]),
    hasStatusList: html.includes('taskStatusList'),
    hasLevelPop: html.includes('taskLevel'),
    classes: (html.match(/class="([^"]+)"/g) || []).map(c => c.slice(7, -1)).sort(),
  };
}

/* ────────────────────────── 场景 ────────────────────────── */

interface Scenario {
  name: string;
  stateConfig: Record<string, unknown>;
  ownProps: Record<string, unknown>;
}

const SCENARIOS: Scenario[] = [
  { name: '默认状态（全部 / 天视图 / 仅工作日）', stateConfig: makeStateConfig(), ownProps: { showStaticGantt: true } },
  {
    name: '进行中 + 周视图 + 显示周末',
    stateConfig: makeStateConfig({ currentStatus: 0, currentView: 2, filterWeekend: false }),
    ownProps: { showStaticGantt: true },
  },
  {
    name: '已完成 + 月视图',
    stateConfig: makeStateConfig({ currentStatus: 1, currentView: 3, filterWeekend: true }),
    ownProps: { showStaticGantt: true },
  },
  { name: 'showStaticGantt=false 时不渲染甘特入口', stateConfig: makeStateConfig(), ownProps: { showStaticGantt: false } },
  { name: 'showStaticGantt 省略（undefined）', stateConfig: makeStateConfig(), ownProps: {} },
];

/* ────────────────────────── 执行 ────────────────────────── */

/* ────────────────────────── 防假绿：必须跑到汇总行才算通过 ────────────────────────── */

/**
 * 【为什么需要这三行】任何"异常被吞掉、进程却以 0 退出"的情形都会被门禁读成通过。
 * 我在旧甘特导出规格里就踩过这个坑（异步 IIFE 里的异常只被记进 unhandledRejection，
 * 结果一个用例没跑也 exit 0）。这里做三层兜底：
 *   1. `unhandledRejection` / `uncaughtException` 一律打印并置非 0；
 *   2. `beforeExit` 检查是否真的打印过汇总行 —— 没跑到就是失败；
 *   3. 汇总行由 `summarized = true` 标记（见 main 末尾）。
 */
let summarized = false;
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

function firstDiff(a: unknown, b: unknown, at = '$'): string {
  if (a === b) return '';
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${at}: 一侧非数组`;
    if (a.length !== b.length) return `${at}: 长度 ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${at}[${i}]`);
      if (d) return d;
    }
    return '';
  }
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.join(',') !== kb.join(',')) return `${at}: 字段 [${ka}] vs [${kb}]`;
    for (const k of ka) {
      const d = firstDiff((a as any)[k], (b as any)[k], `${at}.${k}`);
      if (d) return d;
    }
    return '';
  }
  return `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

function main(): void {
  realConsole.log(`  · A 侧基线 ${BASE_REV.slice(0, 9)} / folderToolbar.tsx sha256=${ORIG_SHA.slice(0, 16)}…`);

  const OrigConnected = loadConnected('orig');
  const CurrentConnected = loadConnected('current');

  for (const scenario of SCENARIOS) {
    check(`真模块 A/B（real connect + real store）：${scenario.name}`, () => {
      const origHtml = renderConnected(OrigConnected, scenario.stateConfig, scenario.ownProps);
      const currentHtml = renderConnected(CurrentConnected, scenario.stateConfig, scenario.ownProps);
      const origValue = summarize(origHtml);
      const currentValue = summarize(currentHtml);
      assert.equal(
        JSON.stringify(currentValue),
        JSON.stringify(origValue),
        `A/B 不一致 → ${firstDiff(origValue, currentValue)}`,
      );
      // 防假等价：HTML 必须真的有内容
      assert.ok(origHtml.length > 100, '渲染结果过短，可能是空渲染');
      assert.ok(origValue.classes.includes('folderToolbar'), '渲染结果里必须有 folderToolbar 根节点');
    });
  }

  /* 绝对断言：证明 connect 真的把 store 里的 stateConfig 接进了组件 */

  check('connect 接线：active 类跟随 store 的 currentView', () => {
    const day = summarize(renderConnected(CurrentConnected, makeStateConfig({ currentView: 1 })));
    const week = summarize(renderConnected(CurrentConnected, makeStateConfig({ currentView: 2 })));
    const month = summarize(renderConnected(CurrentConnected, makeStateConfig({ currentView: 3 })));
    assert.deepEqual(day.viewActive, ['天'], 'currentView=1 时应激活「天」');
    assert.deepEqual(week.viewActive, ['周%05034'], 'currentView=2 时应激活「周」');
    assert.deepEqual(month.viewActive, ['月%06010'], 'currentView=3 时应激活「月」');
  });

  check('connect 接线：active 类跟随 store 的 filterWeekend', () => {
    const workday = summarize(renderConnected(CurrentConnected, makeStateConfig({ filterWeekend: true })));
    const weekend = summarize(renderConnected(CurrentConnected, makeStateConfig({ filterWeekend: false })));
    assert.deepEqual(workday.weekendActive, ['仅工作日']);
    assert.deepEqual(weekend.weekendActive, ['显示周末']);
  });

  check('connect 接线：收起态状态名跟随 store 的 currentStatus', () => {
    assert.equal(summarize(renderConnected(CurrentConnected, makeStateConfig({ currentStatus: 0 }))).statusLabel, '进行中');
    assert.equal(summarize(renderConnected(CurrentConnected, makeStateConfig({ currentStatus: 1 }))).statusLabel, '已完成');
    assert.equal(summarize(renderConnected(CurrentConnected, makeStateConfig({ currentStatus: -1 }))).statusLabel, '全部');
  });

  check('ownProps 透传：showStaticGantt=false 时没有甘特入口', () => {
    const hidden = summarize(renderConnected(CurrentConnected, makeStateConfig(), { showStaticGantt: false }));
    const shown = summarize(renderConnected(CurrentConnected, makeStateConfig(), { showStaticGantt: true }));
    assert.equal(hidden.hasGanttEntry, false);
    assert.equal(shown.hasGanttEntry, true);
  });

  check('默认关闭态：未点击时不应渲染下拉浮层', () => {
    const value = summarize(renderConnected(CurrentConnected, makeStateConfig(), { showStaticGantt: true }));
    assert.equal(value.hasStatusList, false, '默认不应渲染状态浮层');
    assert.equal(value.hasLevelPop, false, '默认不应渲染层级浮层');
    assert.equal(value.hasGanttDialog, false, '默认不应渲染甘特弹窗');
  });

  if (failed) {
    realConsole.error(`folderToolbar 真模块集成规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  summarized = true;
  realConsole.log(
    `folderToolbar 真模块集成规格通过：${checks} 项（${SCENARIOS.length} 个真 connect 渲染 A/B + 5 条接线断言）`,
  );
}

main();
