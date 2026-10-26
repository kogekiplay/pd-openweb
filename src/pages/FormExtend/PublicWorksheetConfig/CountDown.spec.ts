/**
 * CountDown（FormExtend/PublicWorksheetConfig）行为规格 + 行为保持 A/B。
 *
 * 为什么是 A/B：本切片把 `Component<any, any>` 换成有限 props/state 合同，运行时行为
 * 一处也不改（含 clearInterval(timer) 的原调用形态与 null 实参）。所以同一份断言对两边的
 * 源码各跑一遍，逐场景 deepStrictEqual：
 *   - BASE   = git show 4d9691d38ea27e1b131d5e7a2e09c8ef8e0cb2e2:<本文件>
 *   - CURRENT= 工作树里的本文件
 * 逐场景 deepStrictEqual 场景轨迹，另外对每个场景写死期望值，避免「两边一样地错」。
 *
 * 隔离方式与仓里其它 spec 一致：真实的 moment（时间算法）与 react-redux.shallowEqual，
 * 只有 React 与 setInterval/clearInterval 是替身（记录渲染树与定时器读写），不 mount、
 * 不碰真实定时器、不发网络请求。_l 也照 types/global.d.ts:24 的合同做 %N 替换。
 *
 * 未覆盖（本机无法证明的）：浏览器里 clearInterval(null) 的实参转换（本条只在 Node 运行时
 * 实测了 null/undefined/数字/字符串/句柄都是空操作），以及首次挂载之外定时器的真实节拍。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const crypto: typeof import('node:crypto') = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { jsxRuntimeFrom, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');
const moment = require('moment');
const { shallowEqual } = require('react-redux');

const BASE = '4d9691d38ea27e1b131d5e7a2e09c8ef8e0cb2e2';
const REL = 'src/pages/FormExtend/PublicWorksheetConfig/CountDown.tsx';
// BASE 里这份源码的 sha256：输入一变就报错，避免拿错基线跑 A/B
const BASE_SHA256 = 'f810b0b99db0dab9955f87f707faaef534a43b6f7369f4b708c610814774e5b3';
const FRAGMENT = 'fragment';
// 冻结 moment() 的「现在」：moment hools.now 读 Date.now，钉住之后 diff 才是确定的
const NOW = Date.UTC(2026, 9, 26, 1, 0, 0);
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const requireRE = /\bany\b/;

/* ── 假 React：只为了拿到渲染树，不实现调度 ───────────────────────────── */
interface RenderNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}
function createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): RenderNode {
  return { type, props: props || {}, children };
}
class FakeComponent {
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
    this.state = {};
  }
  // React 的 partial setState 语义：逐键覆盖到已有 state 上（键序＝已有键在前），然后回调
  setState(nextState: Record<string, unknown>, callback?: () => void): void {
    this.state = { ...this.state, ...nextState };
    if (callback) {
      callback();
    }
  }
}

/* ── 假定时器：记录 setInterval/clearInterval 的每次调用 ──────────────── */
interface Timers {
  delays: (number | undefined)[];
  cleared: unknown[];
  callbacks: (() => void)[];
  nextId: number;
  throwOnStart: string | null;
}
function newTimers(): Timers {
  return { delays: [], cleared: [], callbacks: [], nextId: 1, throwOnStart: null };
}
let activeTimers: Timers | null = null;
const timerHost = globalThis as unknown as {
  setInterval: (callback: () => void, delay?: number) => number;
  clearInterval: (handle: unknown) => void;
};
const realSetInterval = timerHost.setInterval;
const realClearInterval = timerHost.clearInterval;
timerHost.setInterval = (callback: () => void, delay?: number): number => {
  const timers = activeTimers;
  assert.ok(timers, 'setInterval 只在场景里被调用');
  if (timers.throwOnStart !== null) {
    throw new TypeError(timers.throwOnStart);
  }
  timers.delays.push(delay);
  timers.callbacks.push(callback);
  const id = timers.nextId;
  timers.nextId += 1;
  return id;
};
timerHost.clearInterval = (handle: unknown): void => {
  const timers = activeTimers;
  assert.ok(timers, 'clearInterval 只在场景里被调用');
  timers.cleared.push(handle);
};

/* ── 模块装载：同一份 loader 吃两段源码 ───────────────────────────────── */
interface CountDownInstance {
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  componentDidMount(): void;
  componentDidUpdate(prevProps: Record<string, unknown>): void;
  func(): void;
  formatTime(d: number, h: number, m: number, s: number): string;
  render(): RenderNode;
}
type CountDownCtor = new (props: Record<string, unknown>) => CountDownInstance;

// 与 types/global.d.ts:24 的 _l 合同一致：key 里 %0..%n 按实参替换。
// 用间接层是为了让「_l 抛错」这一条场景能换掉实现，同时装载器传的仍是同一个函数引用。
const translateImpl: { current: (key: string, ...args: (string | number | undefined)[]) => string } = {
  current: (key, ...args) => args.reduce<string>((text, value, index) => text.replace(`%${index}`, String(value)), key),
};
const translate = (key: string, ...args: (string | number | undefined)[]): string => translateImpl.current(key, ...args);

function load(source: string): CountDownCtor {
  const compiled = transformSync(source, {
    filename: path.join(ROOT, REL),
    comments: false,
    compact: true,
  });
  assert.ok(compiled && typeof compiled.code === 'string', 'transformSync 必须产出代码');
  const fakeReact = {
    __esModule: true,
    default: { Fragment: FRAGMENT, createElement },
    Component: FakeComponent,
    Fragment: FRAGMENT,
    createElement,
  };
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const localRequire = (request: string): unknown => {
    if (request === 'react') return fakeReact;
    if (request === 'react/jsx-runtime') return jsxRuntimeFrom(createElement, FRAGMENT);
    if (request === 'react-redux') return { shallowEqual };
    if (request === 'moment') return moment;
    throw new Error(`CountDown spec: uncontrolled dependency ${request}`);
  };
  new Function('module', 'exports', 'require', '_l', compiled.code)(
    moduleLike,
    moduleLike.exports,
    localRequire,
    translate,
  );
  const exported = moduleLike.exports['default'];
  assert.equal(typeof exported, 'function', '默认导出必须是 CountDown 类');
  return exported as CountDownCtor;
}

const baseSource: string = execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
const currentSource: string = fs.readFileSync(path.join(ROOT, REL), 'utf8');
assert.equal(
  crypto.createHash('sha256').update(baseSource).digest('hex'),
  BASE_SHA256,
  'BASE 源码指纹变了：A/B 的基线不是 4d9691d3 的那一份',
);

/* ── 场景运行器 ──────────────────────────────────────────────────────── */
function scenario<S>(source: string, body: (CountDown: CountDownCtor, timers: Timers) => S): S {
  const timers = newTimers();
  const realDateNow = Date.now;
  activeTimers = timers;
  Date.now = () => NOW;
  try {
    return body(load(source), timers);
  } finally {
    activeTimers = null;
    Date.now = realDateNow;
  }
}

let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks += 1;
  console.log(`  PASS ${name}`);
}

/** 两段源码跑同一场景；返回当前树的轨迹，并断言两边一致。 */
function ab<S>(name: string, body: (CountDown: CountDownCtor, timers: Timers) => S): S {
  const base = scenario(baseSource, body);
  const current = scenario(currentSource, body);
  check(name, () => assert.deepStrictEqual(current, base));
  return current;
}

function capture(fn: () => unknown): Record<string, unknown> {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (error instanceof Error) return { ok: false, name: error.name, message: error.message };
    return { ok: false, thrown: String(error) };
  }
}

/** 带读数日志的 props：用来钉住 getter 的读取次数与顺序。 */
function tracedProps(values: Record<string, unknown>, log: string[]): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        log.push(key);
        return values[key];
      },
    });
  }
  return target;
}

console.log('CountDown behaviour spec (A/B against ' + BASE + ')');

/* 1. 构造函数：真实调用点的五键 props 原样进 state，键序 endTime → isArrive */
check('constructor 保留 props 引用与 endTime 引用，state 键序不变', () => {
  const endTime = at(0);
  const props: Record<string, unknown> = {
    className: 'textPrimary',
    endTime,
    beforeText: '链接将于',
    afterText: '后截止',
    arriveText: '链接已截止;',
  };
  const trace = ab('constructor 轨迹', (CountDown: CountDownCtor) => {
    const instance = new (CountDown as CountDownCtor)(props);
    return {
      sameProps: instance.props === props,
      stateKeys: Object.keys(instance.state),
      endTimeIsSameString: instance.state['endTime'] === endTime,
      isArrive: instance.state['isArrive'],
    };
  });
  assert.deepStrictEqual(trace, {
    sameProps: true,
    stateKeys: ['endTime', 'isArrive'],
    endTimeIsSameString: true,
    isArrive: false,
  });
});

/* 2. 缺项与显式 undefined/null/空串：都落成 new Date()（|| 的真实语义） */
check('endTime 缺项 / undefined / null / 空串都落成 Date 实例', () => {
  const trace = ab('endTime 缺省轨迹', (CountDown: CountDownCtor) => {
    const cases: Record<string, unknown>[] = [
      {},
      { endTime: undefined },
      // 类型合同不收 null（见类型负例探针）；这一条只记录运行时的真实行为
      { endTime: null },
      { endTime: '' },
    ];
    return cases.map(props => {
      const instance = new CountDown(props);
      const state = instance.state['endTime'];
      return { isDate: state instanceof Date, stateKeys: Object.keys(instance.state) };
    });
  });
  assert.deepStrictEqual(trace, [
    { isDate: true, stateKeys: ['endTime', 'isArrive'] },
    { isDate: true, stateKeys: ['endTime', 'isArrive'] },
    { isDate: true, stateKeys: ['endTime', 'isArrive'] },
    { isDate: true, stateKeys: ['endTime', 'isArrive'] },
  ]);
});

/* 3. 挂载：先 func() 再注册 1000ms interval；timeStr 追加到 state 末尾 */
check('componentDidMount：先算一次再起 1000ms 定时器，timeStr 追加在 state 末尾', () => {
  const trace = ab('挂载轨迹', (CountDown: CountDownCtor, timers: Timers) => {
    const instance = new CountDown({
      className: 'textPrimary',
      endTime: at(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000),
      beforeText: '链接将于',
      afterText: '后截止',
      arriveText: '链接已截止;',
    });
    instance.componentDidMount();
    return {
      delays: timers.delays,
      timeStr: instance.state['timeStr'],
      isArrive: instance.state['isArrive'],
      stateKeys: Object.keys(instance.state),
      callbacks: timers.callbacks.length,
    };
  });
  assert.deepStrictEqual(trace, {
    delays: [1000],
    timeStr: '2天3时4分5秒',
    isArrive: false,
    stateKeys: ['endTime', 'isArrive', 'timeStr'],
    callbacks: 1,
  });
});

/* 4. formatTime 四个分支与边界 */
check('formatTime 天/时/分/秒四分支按 %N 合同出文本', () => {
  const trace = ab('formatTime 轨迹', (CountDown: CountDownCtor) => {
    const instance = new CountDown({ endTime: at(0) });
    const cases: [number, number, number, number][] = [
      [2, 3, 4, 5],
      [1, 0, 0, 0],
      [0, 3, 4, 5],
      [0, 0, 4, 5],
      [0, 0, 0, 5],
      [0, 0, 0, 0],
      [-1, 0, 0, 5],
    ];
    return cases.map(args => instance.formatTime(args[0], args[1], args[2], args[3]));
  });
  assert.deepStrictEqual(trace, ['2天3时4分5秒', '1天0时0分0秒', '3时4分5秒', '4分5秒', '5秒', '0秒', '5秒']);
});

/* 5. 已过期：isArrive=true 并清掉定时器；clearInterval 的实参仍是模块变量本身 */
check('已过期时 isArrive=true，clearInterval 只在这一处被调用', () => {
  const body = (CountDown: CountDownCtor, timers: Timers) => {
    const instance = new CountDown({ endTime: at(-5000), arriveText: '链接已截止;' });
    instance.componentDidMount();
    return {
      cleared: timers.cleared,
      delays: timers.delays,
      isArrive: instance.state['isArrive'],
      timeStr: instance.state['timeStr'],
      stateKeys: Object.keys(instance.state),
    };
  };
  const trace = ab('已过期轨迹', body);
  // 首次 func() 早于 setInterval，模块变量这时还是初始的 null —— 原调用形态原样保留
  assert.deepStrictEqual(trace['cleared'], [null]);
  assert.deepStrictEqual(trace['delays'], [1000]);
  assert.equal(trace['isArrive'], true);
  assert.deepStrictEqual(trace['stateKeys'], ['endTime', 'isArrive', 'timeStr']);
  // 两条路径在原生里都只是空操作（下一组用真实 clearInterval 证明）
  check('原生 clearInterval：null / undefined / 数字 / 字符串 / 句柄都是空操作', () => {
    for (const arg of [null, undefined, 0, 1, '1']) {
      assert.equal(realClearInterval(arg), undefined);
    }
    const handle = realSetInterval(() => undefined, 1000);
    assert.equal(typeof handle, 'object', 'Node 里 setInterval 返回 Timeout 句柄');
    assert.equal(realClearInterval(handle), undefined);
  });
});

/* 6. 渲染：已到达且有 arriveText 只出一个 span；否则 before/text/after 三段 */
check('render 两个分支的树形状与 className 拼接', () => {
  const trace = ab('render 轨迹', (CountDown: CountDownCtor) => {
    const arrived = new CountDown({ endTime: at(-5000), arriveText: '链接已截止;' });
    arrived.componentDidMount();
    const arrivedTree = arrived.render();

    const running = new CountDown({
      className: 'textPrimary',
      endTime: at(5 * 1000),
      beforeText: '链接将于',
      afterText: '后截止',
      arriveText: '链接已截止;',
    });
    running.componentDidMount();
    const runningTree = running.render();

    const bare = new CountDown({ endTime: at(5 * 1000) });
    bare.componentDidMount();

    return {
      arrived: { type: arrivedTree.type, children: arrivedTree.children, className: arrivedTree.props['className'] },
      running: {
        type: runningTree.type,
        className: runningTree.props['className'],
        children: runningTree.children,
      },
      bareChildren: bare.render().children,
    };
  });
  assert.deepStrictEqual(trace['arrived'], { type: 'span', children: ['链接已截止;'], className: undefined });
  assert.deepStrictEqual(trace['running'], {
    type: 'fragment',
    className: undefined,
    children: [
      { type: 'span', props: {}, children: ['链接将于'] },
      { type: 'span', props: { className: 'mLeft5 mRight5 textPrimary' }, children: ['5秒'] },
      { type: 'span', props: {}, children: ['后截止'] },
    ],
  });
  // 缺 className / beforeText / afterText 时仍是三段，只是文本为空、类名尾部留一个空格
  const bareChildren = trace['bareChildren'] as RenderNode[];
  assert.equal(bareChildren.length, 3);
  assert.deepStrictEqual(bareChildren[0], { type: 'span', props: {}, children: [''] });
  assert.deepStrictEqual(bareChildren[1]!.props, { className: 'mLeft5 mRight5 ' });
  assert.deepStrictEqual(bareChildren[2], { type: 'span', props: {}, children: [''] });
});

/* 7. getter 次数与顺序：构造函数只读一次 endTime；render 按 className→beforeText→afterText→arriveText */
check('getter 读取次数与顺序（构造 / render）', () => {
  const trace = ab('getter 轨迹', (CountDown: CountDownCtor) => {
    const constructLog: string[] = [];
    const props = tracedProps(
      {
        className: 'textPrimary',
        endTime: at(5 * 1000),
        beforeText: '链接将于',
        afterText: '后截止',
        arriveText: '链接已截止;',
      },
      constructLog,
    );
    const instance = new CountDown(props);
    const afterConstructor = [...constructLog];
    constructLog.length = 0;
    const renderLog: string[] = [];
    const renderProps = tracedProps(
      {
        className: 'textPrimary',
        endTime: at(5 * 1000),
        beforeText: '链接将于',
        afterText: '后截止',
        arriveText: '链接已截止;',
      },
      renderLog,
    );
    instance.props = renderProps;
    instance.render();
    return { afterConstructor, renderLog: renderLog, renderTreeReads: constructLog };
  });
  assert.deepStrictEqual(trace['afterConstructor'], ['endTime']);
  assert.deepStrictEqual(trace['renderLog'], ['className', 'beforeText', 'afterText', 'arriveText']);
});

/* 8. componentDidUpdate：endTime 没变什么都不做；变了就写回 + 重算 + 再起定时器 */
check('componentDidUpdate：同 endTime 无副作用，变化时写回并重算', () => {
  const trace = ab('更新轨迹', (CountDown: CountDownCtor, timers: Timers) => {
    const first = at(5 * 1000);
    const props: Record<string, unknown> = { className: 'textPrimary', endTime: first, beforeText: '链接将于' };
    const instance = new CountDown(props);
    instance.componentDidMount();
    const afterMount = { delays: [...timers.delays], cleared: [...timers.cleared], timeStr: instance.state['timeStr'] };

    // 同一 endTime：shallowEqual 认为没变，一条 setState / 定时器操作都不该发生
    instance.componentDidUpdate({ ...props });
    const sameEndTime = { delays: [...timers.delays], cleared: [...timers.cleared], timeStr: instance.state['timeStr'] };

    // 新 endTime
    const second = at(9 * 1000);
    instance.props = { ...props, endTime: second };
    instance.componentDidUpdate({ ...props });
    const changedEndTime = {
      delays: [...timers.delays],
      cleared: [...timers.cleared],
      timeStr: instance.state['timeStr'],
      endTimeIsNew: instance.state['endTime'] === second,
    };

    return { afterMount, sameEndTime, changedEndTime, stateKeys: Object.keys(instance.state) };
  });
  assert.deepStrictEqual(trace['afterMount'], { delays: [1000], cleared: [], timeStr: '5秒' });
  assert.deepStrictEqual(trace['sameEndTime'], { delays: [1000], cleared: [], timeStr: '5秒' });
  const changed = trace['changedEndTime'] as Record<string, unknown>;
  assert.equal(changed['timeStr'], '9秒');
  assert.equal(changed['endTimeIsNew'], true);
  assert.deepStrictEqual(changed['cleared'], []);
  assert.deepStrictEqual(trace['stateKeys'], ['endTime', 'isArrive', 'timeStr']);
});

/* 9. receiver：func/formatTime 是箭头字段（解构后仍绑实例）；render 是原型方法（解构后按 JS 语义丢 this） */
check('receiver：func/formatTime 解构后仍绑实例，render 保持原型方法', () => {
  const trace = ab('receiver 轨迹', (CountDown: CountDownCtor) => {
    const instance = new CountDown({
      className: 'textPrimary',
      endTime: at(5 * 1000),
      beforeText: '链接将于',
      afterText: '后截止',
      arriveText: '链接已截止;',
    });
    instance.componentDidMount();
    const func = instance.func;
    const formatTime = instance.formatTime;
    const render = instance.render;
    const before = instance.state['timeStr'];
    func();
    const afterStr = instance.state['timeStr'];
    const tree = instance.render();
    return {
      ownFields: ['func', 'formatTime', 'render'].map(name => Object.prototype.hasOwnProperty.call(instance, name)),
      before,
      afterStr,
      format: formatTime(0, 0, 7, 8),
      secondChild: (tree.children as RenderNode[])[1]!,
      detachedRender: capture(() => render()),
    };
  });
  assert.deepStrictEqual(trace['ownFields'], [true, true, false]);
  assert.equal(trace['before'], '5秒');
  assert.equal(trace['afterStr'], '5秒');
  assert.equal(trace['format'], '7分8秒');
  assert.deepStrictEqual((trace['secondChild'] as RenderNode).props, { className: 'mLeft5 mRight5 textPrimary' });
  // 解构 render 后 this 不再指向实例：这是 JS/React 既有语义，本切片没有改动它
  const detached = trace['detachedRender'] as Record<string, unknown>;
  assert.equal(detached['ok'], false);
  assert.equal(detached['name'], 'TypeError');
});

/* 10. 合法输入之外的运行期行为：非法日期串不抛也不吞；同步异常（抛错的 getter / _l）原样传播 */
check('非法 endTime 落成 NaN 文本；抛错的 getter 与 _l 都原样传播', () => {
  const body = (CountDown: CountDownCtor) => {
    // 非法日期串：moment 判无效（走它的 RFC2822 回退告警），diff 是 NaN，四个分支都不成立 → 落到 %0秒
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    let badOutcome: Record<string, unknown>;
    try {
      const bad = new CountDown({ endTime: 'not-a-date', arriveText: '链接已截止;' });
      // moment 的 RFC2822 回退告警是模块级「只喊一次」的，A/B 两次跑到的次数不同，
      // 所以只把它从输出里收走（不让日志淹没结论），不把条数写进轨迹。
      badOutcome = capture(() => {
        bad.componentDidMount();
        return { timeStr: bad.state['timeStr'], isArrive: bad.state['isArrive'] };
      });
    } finally {
      console.warn = realWarn;
    }

    // props 上的 getter 抛错：构造函数读 endTime 时原样抛出去，不被吞
    const throwingProps: Record<string, unknown> = {};
    Object.defineProperty(throwingProps, 'endTime', {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('getter-endTime');
      },
    });
    const getterOutcome = capture(() => new CountDown(throwingProps));

    // _l 抛错（i18n 全局缺失/失败）：func() → formatTime() 里原样抛出去
    const previousTranslate = translateImpl.current;
    translateImpl.current = () => {
      throw new Error('translate-failed');
    };
    try {
      const instance = new CountDown({ endTime: at(5 * 1000) });
      const translateOutcome = capture(() => instance.componentDidMount());
      return { badOutcome, getterOutcome, translateOutcome };
    } finally {
      translateImpl.current = previousTranslate;
    }
  };
  const trace = ab('同步异常轨迹', body);
  assert.deepStrictEqual(trace['badOutcome'], { ok: true, value: { timeStr: 'NaN秒', isArrive: false } });
  assert.deepStrictEqual(trace['getterOutcome'], { ok: false, name: 'Error', message: 'getter-endTime' });
  assert.deepStrictEqual(trace['translateOutcome'], { ok: false, name: 'Error', message: 'translate-failed' });
});

/* 11. 原生失败：setInterval 抛错时 componentDidMount 原样传播，不吞 */
check('setInterval 抛错时 componentDidMount 原样传播', () => {
  const body = (CountDown: CountDownCtor, timers: Timers) => {
    timers.throwOnStart = 'setInterval failed';
    const instance = new CountDown({ endTime: at(5 * 1000) });
    return {
      outcome: capture(() => instance.componentDidMount()),
      timeStr: instance.state['timeStr'],
      delays: timers.delays,
      callbacks: timers.callbacks.length,
    };
  };
  const trace = ab('原生失败轨迹', body);
  assert.deepStrictEqual(trace['outcome'], { ok: false, name: 'TypeError', message: 'setInterval failed' });
  assert.equal(trace['timeStr'], '5秒');
  assert.deepStrictEqual(trace['delays'], []);
  assert.equal(trace['callbacks'], 0);
});

/* 12. 静态：这轮合同里不许出现 any（擦除正是被退回的那四笔的做法） */
check('源码里不出现 any，且默认导出仍是类', () => {
  assert.equal(requireRE.test(currentSource), false, 'CountDown.tsx 不允许出现 any');
  assert.equal(/Component<any/.test(currentSource), false, '不允许把 props/state 退回 any');
  const CountDown = load(currentSource);
  const proto = CountDown.prototype as unknown as Record<string, unknown>;
  assert.equal(typeof proto['render'], 'function', 'render 仍是原型方法');
  assert.equal(typeof proto['componentDidMount'], 'function', 'componentDidMount 仍是原型方法');
  assert.equal(proto['func'], undefined, 'func 是类字段（箭头），不在原型上');
});

/* 恢复真实定时器 */
timerHost.setInterval = realSetInterval;
timerHost.clearInterval = realClearInterval;

console.log(`CountDown tests passed (${checks} checks, A/B base ${BASE})`);
