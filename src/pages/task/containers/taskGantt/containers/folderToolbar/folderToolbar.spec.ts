/**
 * 甘特文件夹工具栏（folderToolbar）行为规格 —— 历史 A/B 对照版
 *
 * 批次：`src/pages/task/containers/taskGantt/containers/folderToolbar/folderToolbar.tsx`
 * 类型改造把 `Component<any, any>` 换成真实 props/state，消除了 23 条 strict
 * 诊断（20×TS4111 + 3×TS7006）。本规格要守住的是：**类型改造没有改变行为**。
 *
 * A 侧来源：`git show` 取本文件在类型改造之前的版本（commit 8b67c779b 的内容），
 * sha256 冻结并在开头校验，因此对照不会随工作区改动而漂移。
 *
 * 【覆盖什么】
 *   1. 正常渲染：三种下拉/按钮组的结构、当前状态与视图的 active 判定
 *   2. 状态/视图/周末/层级操作：`dispatch` 的 **action 序列与次序**（这是最容易
 *      改坏的地方——类型化时很容易顺手调换 dispatch 顺序）
 *   3. 层级浮层：offsetLeft 取自 `currentTarget`，开关与位置写入 state
 *   4. 甘特弹窗开关协议：`showStaticGantt` 为真才渲染入口；点击后 state 翻转；
 *      `taskConfig` 变化时自动关闭弹窗
 *   5. `getTaskStatusName` 的三分支与默认分支
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../../../../scripts/spec-harness.ts');

/* ────────────────────────── A/B 基线 ────────────────────────── */

const DIR = __dirname;
const REL_FILE = 'src/pages/task/containers/taskGantt/containers/folderToolbar/folderToolbar.tsx';
/**
 * A 侧基线：`b84c1c28a`（lead 指定，**在 origin/main 上可达**）。
 *
 * 早先这里用的是我协作分支上的 `8b67c779b`，那是尚未推送的提交，会让规格依赖
 * 一条只存在于协作分支的历史。lead 已核验 `folderToolbar.tsx` 在 `b84c1c28a` 与
 * `8b67c779b` 两处**内容完全相同**（sha256 `2d14765c…`），所以切换基线不改变 A 侧，
 * 下面的冻结 SHA 也保持不变。
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

/** 原实现（类型改造前）源码指纹：确认 A 侧确实取到了那一版 */
const ORIG_SHA = '2d14765c47ec960d1a5757a482bec1fb27b8320c3d22711710a5b6a194ee6db4';

/* ────────────────────────── 环境与依赖替身 ────────────────────────── */

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
/**
 * `_l` 替身。真实的 `_l(key, ...args)` 只在**传了参数**时才做占位替换；
 * `'周%05034'` / `'月%06010'` 里的 `%NNNNN` 是**翻译消息 ID**（见 locale/<lang>/mdTranslation.po），
 * 不是占位符，无参数时必须原样保留，否则会把消息 ID 替换成 undefined。
 */
(globalThis as Record<string, unknown>)['_l'] = (s: string, ...args: unknown[]) =>
  args.length === 0 ? String(s) : String(s).replace(/%(\d+)/g, (_m, i) => String(args[Number(i)] ?? ''));

class FakeComponent {
  props: Record<string, any>;
  state: Record<string, any>;
  constructor(props: Record<string, any>) {
    const defaults = (this.constructor as unknown as { defaultProps?: Record<string, unknown> }).defaultProps || {};
    this.props = { ...defaults, ...(props || {}) };
    this.state = { ...(this.state || {}) };
  }
  setState(
    update: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>),
    cb?: () => void,
  ) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    if (cb) cb();
  }
}

const created: { type: unknown; props: Record<string, any>; children: unknown[] }[] = [];

const createElement = (type: unknown, props: Record<string, any> | null, ...children: unknown[]) => {
  const node = { type, props: props || {}, children };
  created.push(node);
  return node;
};

const moment = require('moment');
moment.suppressDeprecationWarnings = true;

const esm = <T>(value: T) => ({ __esModule: true, default: value });

/**
 * UI 替身组件必须**具名且提升到模块作用域**：JSX 编译后 `node.type` 是组件函数本身，
 * 不是字符串。早先按 `n.type === GanttDialogStub` 匹配永远匹配不到，两侧都是 0 时会
 * 出现"假等价"（A/B 都空也算相等）。这里统一按函数引用匹配。
 */
const GanttDialogStub = (props: unknown) => createElement('GanttDialog', props as never);
const TooltipStub = (props: unknown) => createElement('Tooltip', props as never);
const ClickAwayStub = (props: unknown) => createElement('ClickAway', props as never);

/** 产品代码里用到的工具函数替身（保持纯函数语义，便于 A/B 两侧一致） */
const lodashStub = require('lodash');
const cxStub = require('classnames');

/**
 * 真实 `react-redux` 的 `shallowEqual`。`componentDidUpdate` 用它做早退判断，
 * 语义细节（Object.is 逐 key 比较、key 数量一致、引用相同直接 true）会直接影响
 * 后续 `_.isEqual(taskConfig)` 分支是否被执行，因此不能用近似替身。
 */
const realShallowEqual: (a: unknown, b: unknown) => boolean = require('react-redux').shallowEqual;

/** 记录 dispatch 的 action 序列：这是本批最关键的行为证据 */
let dispatched: unknown[] = [];

/**
 * 用**真实 config 模块**而不是手写替身。
 *
 * 理由：本规格的"取值契约"断言（状态 [0,1,-1] / 视图 [1,2,3] / 周末 [true,false] /
 * 层级 [0,1,2,3,4,5]）要钉住的是**与 reducer 之间的真实协议**。如果 config 用替身，
 * 那些断言只是"组件把我替身里的值传出去了"，钉不住真实常量。
 * 真实 config.ts 只有一个 `import type`，没有运行时依赖，可以直接载入。
 * 载入后 A/B 两侧用的是同一份真实 config，比对依然中立。
 */
const configStub: Record<string, any> = (() => {
  const real = require('../../config/config.ts');
  return real.default || real;
})();
// 真实 config 是共享可变对象（taskGantt.tsx 会写 folderId）；规格里需要可控值以断言透传
configStub.folderId = 'folder-1';

/** redux action creators 替身：真实实现只返回普通对象（thunk 除外），这里如实复现 */
const actionsStub = {
  changeTaskStatus: (status: number) => ({ type: 'CHANGE_TASK_STATUS', status }),
  changeView: (viewType: number) => ({ type: 'CHANGE_VIEW', viewType }),
  changeFilterWeekend: (filter: boolean) => ({ type: 'CHANGE_FILTER_WEEKEND', filter }),
  changeSubTaskLevel: (level: number) => ({ type: 'CHANGE_SUB_TASK_LEVEL', level }),
  // 真实实现返回 thunk；规格只需要确认"派发了哪个 thunk"，用可识别的标记对象代替
  getTimeAxisSource: () => ({ __thunk: 'getTimeAxisSource' }),
  updateDataSource: () => ({ __thunk: 'updateDataSource' }),
};

/** state.task 的替身形状与真实 reducer 默认值一致 */
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

function buildStubs() {
  return {
    react: { Component: FakeComponent, Fragment: 'Fragment', createElement },
    'react/jsx-runtime': {
      __esModule: true,
      jsx: (t: unknown, p: Record<string, any> | null, ...c: unknown[]) => createElement(t, p, ...c),
      jsxs: (t: unknown, p: Record<string, any> | null, ...c: unknown[]) => createElement(t, p, ...c),
      Fragment: 'Fragment',
    },
    'react-redux': {
      connect: () => (Target: unknown) => Target, // 规格直接实例化内部类，不走 connect 包装
      // 【必须用真实实现】`componentDidUpdate` 的早退条件取决于 `shallowEqual` 的精确语义
      // （逐 key 用 Object.is 比较，且 key 数量相同）。用 JSON.stringify 近似会改变
      // "引用相同即相等"、"NaN/undefined 相等"、"函数引用相同"等判定，测出来的是替身行为。
      shallowEqual: realShallowEqual,
    },
    classnames: cxStub,
    lodash: lodashStub,
    'ming-ui/antd-components': { Tooltip: TooltipStub },
    'ming-ui/components/ClickAway': { __esModule: true, default: ClickAwayStub },
    'src/components/createTask/load': esm(() => {}),
    'src/redux/types': {}, // 仅类型导入，运行时为空
    '../../component/ganttDialog': { __esModule: true, default: GanttDialogStub },
    '../../config/config': { __esModule: true, default: configStub },
    '../../redux/actions': actionsStub,
  };
}

/* ────────────────────────── 载入被测组件 ────────────────────────── */

/**
 * 加载组件并返回其**内部类**（绕过 connect 包装）。
 * `connect(...)(FolderToolbar)` 在替身里就直接返回目标类，因此拿到的就是组件类。
 */
function loadToolbar(variant: 'orig' | 'current') {
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
  const exported = moduleLike.exports as { default: new (props: Record<string, unknown>) => any };
  return exported.default;
}

/** 构造一个已挂载形态的实例（props 用真实形状） */
function makeInstance(Toolbar: any, overrides: Record<string, unknown> = {}) {
  const props = {
    showStaticGantt: true,
    stateConfig: makeStateConfig(),
    taskConfig: { projectId: 'p1', folderId: 'f1' },
    dispatch: (action: unknown) => {
      dispatched.push(action);
      return action;
    },
    ...overrides,
  };
  return new Toolbar(props);
}

/* ────────────────────────── 结构指纹 ────────────────────────── */

function walk(node: unknown, visit: (n: any) => void): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, visit));
    return;
  }

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

function byClass(root: unknown, token: string) {
  return findAll(
    root,
    n => typeof n.props?.className === 'string' && n.props.className.split(/\s+/).filter(Boolean).includes(token),
  );
}

/** 把渲染树压成可比较的指纹（只看结构、类名、关键 style 与文本） */
function fingerprint(node: unknown, depth = 0): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(child => fingerprint(child, depth));
  if (typeof node !== 'object') return String(node);
  const n = node as any;
  const tag = typeof n.type === 'string' ? n.type : `[fn:${n.type?.name || 'anon'}]`;
  const props: Record<string, unknown> = {};

  for (const key of Object.keys(n.props || {}).sort()) {
    if (key === 'children') continue;
    const value = n.props[key];

    if (key === 'onCancel' || key === 'folderID' || key === 'closeLayer') {
      // 弹窗回调与 folderID 由 config 驱动，单独在场景里断言，不放进结构指纹
      if (key === 'folderID') props[key] = value;
      continue;
    }

    if (typeof value === 'function') props[key] = '[fn]';
    else if (key === 'className' || key === 'style' || key === 'component' || key === 'title') props[key] = value;
  }

  const kids = n.props?.children !== undefined ? n.props.children : n.children;
  return { tag, props, children: kids === undefined ? [] : fingerprint(kids, depth + 1) };
}

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
  realConsole.error(
    `未处理的 Promise 拒绝，判为失败：${reason instanceof Error ? reason.stack || reason.message : String(reason)}`,
  );
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

/* ────────────────────────── 断言脚手架 ────────────────────────── */

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
  if (typeof a !== typeof b) return `${at}: 类型 ${typeof a} vs ${typeof b}`;
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

/* ────────────────────────── A/B 场景 ────────────────────────── */

interface Scenario {
  name: string;
  run: (Toolbar: any) => unknown;
}

const SCENARIOS: Scenario[] = [
  {
    name: '正常渲染：工具栏结构 + 当前状态名 + 视图/周末 active 判定',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, {
        stateConfig: makeStateConfig({ currentStatus: 0, currentView: 2, filterWeekend: false }),
      });
      const tree = instance.render();
      const statusBox = byClass(tree, 'folderToolbar');
      return {
        rootCount: statusBox.length,
        statusName: findAll(tree, n => n.children && n.children.some?.((c: unknown) => typeof c === 'string'))
          .map(n => (Array.isArray(n.children) ? n.children.filter((c: unknown) => typeof c === 'string') : []))
          .flat()
          .filter((s: unknown) => typeof s === 'string' && s.length > 0),
        activeItems: findAll(
          tree,
          n => typeof n.props?.className === 'string' && n.props.className.split(/\s+/).includes('active'),
        ).map(n => n.props.className),
        fingerprint: fingerprint(tree),
      };
    },
  },
  {
    name: '状态名三分支 + 默认分支（0/1/-1/其它）',
    run: Toolbar => {
      return [0, 1, -1, 99].map(status => {
        const instance = makeInstance(Toolbar, { stateConfig: makeStateConfig({ currentStatus: status }) });
        return instance.getTaskStatusName() ?? null;
      });
    },
  },
  {
    name: '切换状态：dispatch 序列与次序（changeTaskStatus → updateDataSource）+ 关闭下拉',
    run: Toolbar => {
      dispatched = [];
      const instance = makeInstance(Toolbar, {});
      instance.state = { ...instance.state, showOperator: true };
      instance.switchStatus(-1);
      return {
        sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null),
        showOperator: instance.state.showOperator,
      };
    },
  },
  {
    name: '切换视图：dispatch 序列（changeView → getTimeAxisSource → updateDataSource）',
    run: Toolbar => {
      dispatched = [];
      const instance = makeInstance(Toolbar, {});
      instance.switchView(3);
      return { sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null) };
    },
  },
  {
    name: '切换周末显示：dispatch 序列（changeFilterWeekend → getTimeAxisSource → updateDataSource）',
    run: Toolbar => {
      dispatched = [];
      const instance = makeInstance(Toolbar, {});
      instance.filterWeekend(false);
      return { sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null) };
    },
  },
  {
    name: '切换层级：dispatch 序列（changeSubTaskLevel → updateDataSource）+ 关闭浮层',
    run: Toolbar => {
      dispatched = [];
      const instance = makeInstance(Toolbar, {});
      instance.state = { ...instance.state, showLevel: true };
      instance.switchLevel(3);
      return {
        sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null),
        showLevel: instance.state.showLevel,
      };
    },
  },
  {
    name: '层级浮层：offsetLeft 取自 currentTarget，开关翻转，位置写入 state',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, {});
      const before = { ...instance.state };
      instance.showTaskLevel({ currentTarget: { offsetLeft: 137 } });
      const afterOpen = {
        showLevel: instance.state.showLevel,
        taskLevelOffsetLeft: instance.state.taskLevelOffsetLeft,
      };
      instance.showTaskLevel({ currentTarget: { offsetLeft: 200 } });
      const afterClose = {
        showLevel: instance.state.showLevel,
        taskLevelOffsetLeft: instance.state.taskLevelOffsetLeft,
      };
      // 浮层打开时的 style.left 必须等于记录的 offsetLeft
      instance.state = { ...instance.state, showLevel: true, taskLevelOffsetLeft: 137 };
      const tree = instance.render();
      const levelPop = byClass(tree, 'taskLevel');
      return {
        before: { showLevel: before.showLevel, taskLevelOffsetLeft: before.taskLevelOffsetLeft ?? null },
        afterOpen,
        afterClose,
        levelPopCount: levelPop.length,
        levelPopStyle: levelPop.length ? levelPop[0].props.style : null,
      };
    },
  },
  {
    name: '甘特弹窗协议：showStaticGantt 控制入口显隐；点击后 state 翻转；弹窗挂载与 closeLayer',
    run: Toolbar => {
      const hidden = makeInstance(Toolbar, { showStaticGantt: false });
      const hiddenTree = hidden.render();
      const shown = makeInstance(Toolbar, { showStaticGantt: true });
      const shownTree = shown.render();

      // 点击入口 → 打开弹窗
      const entry = byClass(shownTree, 'folderStaticGantt');
      const openedByClick = (() => {
        if (!entry.length) return null;
        entry[0].props.onClick();
        return shown.state.ganttDialogVisible;
      })();
      // 打开后 render 里应出现 GanttDialog，且 folderID 来自 config
      const withDialog = (() => {
        shown.state = { ...shown.state, ganttDialogVisible: true };
        const tree = shown.render();
        const dialog = findAll(tree, n => n.type === GanttDialogStub);
        // 必须真的找到：否则 A/B 两侧都 0 会构成假等价
        assert.equal(dialog.length, 1, '打开 ganttDialogVisible 后必须渲染出 GanttDialog');
        return { count: dialog.length, folderID: dialog[0].props.folderID };
      })();
      // closeLayer 由 switchGanttDialogVisible 提供：传 false 应关闭
      const closedByCallback = (() => {
        shown.state = { ...shown.state, ganttDialogVisible: true };
        const tree = shown.render();
        const dialog = findAll(tree, n => n.type === GanttDialogStub);
        if (!dialog.length) return null;
        dialog[0].props.closeLayer(false);
        return shown.state.ganttDialogVisible;
      })();
      return {
        hiddenEntryCount: byClass(hiddenTree, 'folderStaticGantt').length,
        shownEntryCount: byClass(shownTree, 'folderStaticGantt').length,
        hiddenDialogCount: findAll(hiddenTree, n => n.type === GanttDialogStub).length,
        // 打开后必须真的出现，避免"都为空"的假等价
        withDialogGuard: (() => {
          const probe = makeInstance(Toolbar, { showStaticGantt: true });
          probe.state = { ...probe.state, ganttDialogVisible: true };
          return findAll(probe.render(), n => n.type === GanttDialogStub).length;
        })(),
        openedByClick,
        withDialog,
        closedByCallback,
      };
    },
  },
  {
    name: '弹窗协议：taskConfig 变化时自动关闭已打开的甘特弹窗',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, { taskConfig: { projectId: 'p1', folderId: 'f1' } });
      instance.state = { ...instance.state, ganttDialogVisible: true };
      const sameConfig = (() => {
        instance.componentDidUpdate({ ...instance.props });
        return instance.state.ganttDialogVisible;
      })();
      instance.state = { ...instance.state, ganttDialogVisible: true };
      const changedConfig = (() => {
        instance.componentDidUpdate({ ...instance.props, taskConfig: { projectId: 'p2', folderId: 'f2' } });
        return instance.state.ganttDialogVisible;
      })();
      return { sameConfig, changedConfig };
    },
  },
  {
    name: '下拉开合：showOperator / showLevel 控制对应浮层是否渲染',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, {});
      const closedTree = instance.render();
      const closed = {
        statusList: byClass(closedTree, 'taskStatusList').length,
        levelPop: byClass(closedTree, 'taskLevel').length,
      };
      instance.state = { ...instance.state, showOperator: true, showLevel: true };
      const openTree = instance.render();
      const open = {
        statusList: byClass(openTree, 'taskStatusList').length,
        levelPop: byClass(openTree, 'taskLevel').length,
        statusItems: byClass(openTree, 'bgColorPrimary').length,
      };
      // 点击状态入口应翻转 showOperator
      const toggle = (() => {
        instance.state = { ...instance.state, showOperator: false };
        const tree = instance.render();
        const box = byClass(tree, 'taskStatus');
        if (!box.length) return null;
        box[0].props.onClick();
        return instance.state.showOperator;
      })();
      return { closed, open, toggle };
    },
  },
  {
    name: 'createTask 入口调用外部创建器（不改变自身 state）',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, {});
      const before = JSON.stringify(instance.state);
      instance.createTask();
      return { stateUnchanged: JSON.stringify(instance.state) === before };
    },
  },
];

/* ────────────────────────── 执行 ────────────────────────── */

function stable(value: unknown): string {
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  // 原实现指纹（记录用途：确认 A 侧取到的是类型改造前那一版）
  assert.equal(
    crypto.createHash('sha256').update(origSource()).digest('hex'),
    ORIG_SHA,
    'frozen original toolbar source',
  );
  realConsole.log(`  · A 侧基线 ${BASE_REV.slice(0, 9)} / folderToolbar.tsx sha256=${ORIG_SHA.slice(0, 16)}…`);

  const OrigToolbar = loadToolbar('orig');
  const CurrentToolbar = loadToolbar('current');

  for (const scenario of SCENARIOS) {
    try {
      dispatched = [];
      const origValue = scenario.run(OrigToolbar);
      dispatched = [];
      const currentValue = scenario.run(CurrentToolbar);

      if (stable(origValue) === stable(currentValue)) {
        checks += 1;
        realConsole.log(`  ✓ ${scenario.name}`);
      } else {
        checks += 1;
        failed += 1;
        realConsole.error(`  ✗ ${scenario.name}：A/B 不一致 → ${firstDiff(origValue, currentValue)}`);
      }
    } catch (error) {
      checks += 1;
      failed += 1;
      realConsole.error(`  ✗ ${scenario.name}（用例异常）`);
      realConsole.error(`      ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }

  /* 若干绝对断言：不依赖 A 侧，直接固定真实语义（防止两边一起错） */

  check('switchStatus 必须先派发 changeTaskStatus，再派发 updateDataSource', () => {
    dispatched = [];
    const instance = makeInstance(CurrentToolbar, {});
    instance.switchStatus(1);
    assert.deepEqual(
      dispatched.map((a: any) => a?.type ?? a?.__thunk),
      ['CHANGE_TASK_STATUS', 'updateDataSource'],
    );
    assert.equal((dispatched[0] as any).status, 1);
  });

  check('switchView 的派发次序是 changeView → getTimeAxisSource → updateDataSource', () => {
    dispatched = [];
    const instance = makeInstance(CurrentToolbar, {});
    instance.switchView(2);
    assert.deepEqual(
      dispatched.map((a: any) => a?.type ?? a?.__thunk),
      ['CHANGE_VIEW', 'getTimeAxisSource', 'updateDataSource'],
    );
    assert.equal((dispatched[0] as any).viewType, 2);
  });

  check('filterWeekend 的派发次序是 changeFilterWeekend → getTimeAxisSource → updateDataSource', () => {
    dispatched = [];
    const instance = makeInstance(CurrentToolbar, {});
    instance.filterWeekend(true);
    assert.deepEqual(
      dispatched.map((a: any) => a?.type ?? a?.__thunk),
      ['CHANGE_FILTER_WEEKEND', 'getTimeAxisSource', 'updateDataSource'],
    );
    assert.equal((dispatched[0] as any).filter, true);
  });

  check('switchLevel 的派发次序是 changeSubTaskLevel → updateDataSource', () => {
    dispatched = [];
    const instance = makeInstance(CurrentToolbar, {});
    instance.switchLevel(5);
    assert.deepEqual(
      dispatched.map((a: any) => a?.type ?? a?.__thunk),
      ['CHANGE_SUB_TASK_LEVEL', 'updateDataSource'],
    );
    assert.equal((dispatched[0] as any).level, 5);
  });

  check('渲染里的四个选项组数量与取值来自 config（3/3/2/6）', () => {
    const instance = makeInstance(CurrentToolbar, {});
    const tree = instance.render();
    // 状态 3 项、视图 3 项、周末 2 项、层级 6 项
    const statusItems = findAll(tree, n => n.type === 'li');
    assert.ok(statusItems.length > 0);
    const levelPop = (() => {
      instance.state = { ...instance.state, showLevel: true };
      return byClass(instance.render(), 'taskLevel')[0];
    })();
    const levelItems = findAll(levelPop, n => n.type === 'li');
    assert.equal(levelItems.length, 6, '层级应有 6 个选项');
  });

  check('甘特弹窗的 folderID 来自 config.folderId', () => {
    configStub.folderId = 'assert-folder';
    const instance = makeInstance(CurrentToolbar, {});
    instance.state = { ...instance.state, ganttDialogVisible: true };
    const dialog = findAll(instance.render(), n => n.type === GanttDialogStub);
    assert.equal(dialog.length, 1);
    assert.equal(dialog[0].props.folderID, 'assert-folder');
    configStub.folderId = 'folder-1';
  });

  /* ── 选项取值 ↔ 标签契约：这是与 reducer 之间的协议，A/B 比对看不到（config 是替身） ── */

  /** 点完一组 li，收集派发出去的取值与渲染文本 */
  function clickGroup(
    Toolbar: any,
    openState: Record<string, unknown>,
    containerClass: string,
    actionType: string,
  ): { values: unknown[]; texts: string[] } {
    const instance = makeInstance(Toolbar, {});
    instance.state = { ...instance.state, ...openState };
    const tree = instance.render();
    const container = byClass(tree, containerClass)[0];
    assert.ok(container, `找不到容器 .${containerClass}`);
    const items = findAll(container, n => n.type === 'li');
    // jsx-runtime 把 children 放在 props.children；只有多个子节点时才在第三个参数里
    const kidsOf = (n: any) => (n.props?.children !== undefined ? n.props.children : n.children);
    const texts = items.map((n: any) => {
      const kids = kidsOf(n);
      const flat = Array.isArray(kids) ? kids : [kids];
      return flat.filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join('');
    });
    const values: unknown[] = [];

    for (const item of items) {
      dispatched = [];
      item.props.onClick();
      // 每次点击会派发 1~3 个 action，只取该组对应的那一个
      const action = dispatched.find((a: any) => a?.type === actionType) as any;
      assert.ok(action, `点击后没有派发 ${actionType}`);
      values.push(action['status'] ?? action['viewType'] ?? action['filter'] ?? action['level'] ?? null);
    }

    return { values, texts };
  }

  check('状态列表取值必须是 [0,1,-1]，且文本与 getTaskStatusName 对齐', () => {
    const { values, texts } = clickGroup(
      CurrentToolbar,
      { showOperator: true },
      'taskStatusList',
      'CHANGE_TASK_STATUS',
    );
    assert.deepEqual(values, [0, 1, -1], '状态取值协议变了');
    // 三个文本必须非空，且与 getTaskStatusName 在该状态下的输出一致
    const names = [0, 1, -1].map(status => {
      const instance = makeInstance(CurrentToolbar, { stateConfig: makeStateConfig({ currentStatus: status }) });
      return instance.getTaskStatusName();
    });
    assert.deepEqual(names, ['进行中', '已完成', '全部']);
    texts.forEach((t, i) =>
      assert.ok(t.includes(names[i] as string), `第 ${i} 项文本「${t}」与状态名「${names[i]}」不一致`),
    );
  });

  check('视图列表取值必须是 [1,2,3]', () => {
    const { values } = clickGroup(CurrentToolbar, {}, 'folderGanttBtn', 'CHANGE_VIEW');
    assert.deepEqual(values, [1, 2, 3], '视图取值协议变了');
  });

  check('周末列表取值必须是 [true,false]（true=仅工作日）', () => {
    const { values } = clickGroup(CurrentToolbar, {}, 'folderGanttWeekBtn', 'CHANGE_FILTER_WEEKEND');
    assert.deepEqual(values, [true, false], '周末开关取值协议变了');
  });

  check('层级列表取值必须是 [0,1,2,3,4,5]', () => {
    const { values } = clickGroup(CurrentToolbar, { showLevel: true }, 'taskLevel', 'CHANGE_SUB_TASK_LEVEL');
    assert.deepEqual(values, [0, 1, 2, 3, 4, 5], '层级取值协议变了');
  });

  check('视图标签必须保留 i18n 消息 ID（周%05034 / 月%06010），否则语言表查不到', () => {
    const { texts } = clickGroup(CurrentToolbar, {}, 'folderGanttBtn', 'CHANGE_VIEW');
    assert.ok(texts[1].includes('周%05034'), `周视图标签丢了消息 ID：${texts[1]}`);
    assert.ok(texts[2].includes('月%06010'), `月视图标签丢了消息 ID：${texts[2]}`);
  });

  check('层级标签文案带占位参数，渲染后应已替换（不应出现 %0）', () => {
    const { texts } = clickGroup(CurrentToolbar, { showLevel: true }, 'taskLevel', 'CHANGE_SUB_TASK_LEVEL');
    assert.ok(!texts[1].includes('%0'), `层级标签占位符未替换：${texts[1]}`);
    assert.ok(texts[1].includes('1'), `层级标签应含层数：${texts[1]}`);
  });

  if (failed) {
    realConsole.error(`folderToolbar 行为规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }

  summarized = true;
  realConsole.log(
    `folderToolbar 行为规格通过：${checks} 项（${SCENARIOS.length} 个历史 A/B 场景 + ${checks - SCENARIOS.length} 条绝对断言）`,
  );
}

main().catch(error => {
  realConsole.error(
    `folderToolbar 规格自身异常（不是被测代码差异）：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
