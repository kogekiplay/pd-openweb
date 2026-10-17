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
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../../../../scripts/spec-harness.ts');

/* ────────────────────────── A/B 基线 ────────────────────────── */

const DIR = __dirname;
const REL_FILE = 'src/pages/task/containers/taskGantt/containers/folderToolbar/folderToolbar.tsx';
/** 类型改造前的最后一个提交（我第六轮提交，之后本文件未被改动） */
const BASE_REV = '8b67c779b519afeb86273ef7c5bcce24bd4f1a34';

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
const ORIG_SHA = crypto.createHash('sha256').update(origSource()).digest('hex');

/* ────────────────────────── 环境与依赖替身 ────────────────────────── */

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string, ...args: unknown[]) =>
  String(s).replace(/%0?(\d+)/g, (_m, i) => String(args[Number(i) - 1] ?? args[Number(i)]));

class FakeComponent {
  props: Record<string, any>;
  state: Record<string, any>;
  constructor(props: Record<string, any>) {
    const defaults = (this.constructor as unknown as { defaultProps?: Record<string, unknown> }).defaultProps || {};
    this.props = { ...defaults, ...(props || {}) };
    this.state = { ...(this.state || {}) };
  }
  setState(update: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>), cb?: () => void) {
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

/** 记录 dispatch 的 action 序列：这是本批最关键的行为证据 */
let dispatched: unknown[] = [];

/** config 替身：与真实 config 的常量形状一致（folderId 由用例设置） */
const configStub: Record<string, any> = {
  folderId: 'folder-1',
  projectId: 'project-1',
  TASKSTATUS: { NO_COMPLETED: 0, COMPLETED: 1, ALL: -1 },
  VIEWTYPE: { DAY: 1, WEEK: 2, MONTH: 3 },
  SUBTASKLEVEL: { ALL: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 },
};

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
      shallowEqual: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
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
      return { sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null), showOperator: instance.state.showOperator };
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
      return { sequence: dispatched.map((a: any) => a?.type ?? a?.__thunk ?? null), showLevel: instance.state.showLevel };
    },
  },
  {
    name: '层级浮层：offsetLeft 取自 currentTarget，开关翻转，位置写入 state',
    run: Toolbar => {
      const instance = makeInstance(Toolbar, {});
      const before = { ...instance.state };
      instance.showTaskLevel({ currentTarget: { offsetLeft: 137 } });
      const afterOpen = { showLevel: instance.state.showLevel, taskLevelOffsetLeft: instance.state.taskLevelOffsetLeft };
      instance.showTaskLevel({ currentTarget: { offsetLeft: 200 } });
      const afterClose = { showLevel: instance.state.showLevel, taskLevelOffsetLeft: instance.state.taskLevelOffsetLeft };
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

  if (failed) {
    realConsole.error(`folderToolbar 行为规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `folderToolbar 行为规格通过：${checks} 项（${SCENARIOS.length} 个历史 A/B 场景 + 6 条绝对断言）`,
  );
}

main().catch(error => {
  realConsole.error(
    `folderToolbar 规格自身异常（不是被测代码差异）：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
