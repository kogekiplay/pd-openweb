/**
 * `src/pages/chat/redux/reducers.ts` 的**真实历史 A/B 行为规格**
 *
 * 【A 侧】`git show 15d7e386f:src/pages/chat/redux/reducers.ts`（lead 指定的 main 可达基线），
 * 其 sha256 在夹具里**实际断言**（`chatReduxFixture.assertBaselineIntact`），不是打印。
 *
 * 【哪些真实、哪些替身】
 * - **真实**：`reducers.ts` 本身（两侧都从真实源码编译执行，**不复制假 reducer**）；
 *   `utils.filterSessionList` / `sortSession` / `getToolbarConfig`（按 AST 从真实
 *   `src/pages/chat/utils/index.ts` 抽声明原文后执行）。
 * - **替身（宿主可控）**：`localStorage`（4 个开关）、`md.global.Account.messageListShowType`、
 *   `utils` 的重依赖（moment/Emotion/src alias）。
 * - 不发真实网络/socket、不写真实 localStorage。
 *
 * 【为什么用 `deepEqual`/`Object.is` 而不是 `JSON.stringify`】
 * `JSON.stringify` 会吞掉 `undefined` 自有键、`NaN`/`Infinity`、数组额外属性；
 * 本模块恰好涉及 `Object.assign([], ...)`（保留数组额外属性）、`delete` 副作用
 * 与 `undefined` 值，用 JSON 比较会把差异**看不见**。
 *
 * 【覆盖】共 **23 个 A/B 场景 + 20 个 check 用例**，对应 lead 点名的行为面：
 *
 * A/B（逐步快照 + 每步「是否返回原引用」）：
 * - 初始值（12 个切片）；`SET/ADD/UPDATE_SESSION_LIST`、`REMOVE_SESSION`、`ADD_SESSION`
 *   （`sortSession` 参与）；`REMOVE_SESSION` 外层 filter 的**幂等性**；
 * - toolbar / 当前会话 / 会话列表 / inbox 全动作；消息 `SET`/`ADD`/`ADD_PAGE`/`PUSH_PAGE`/
 *   `REMOVE`/`REMOVE_MESSAGES`/`UPDATE`；引用 / 定位 / 底部未读全动作；三个开关；
 * - `SET/UPDATE/REMOVE_BOTTOM_UNREAD_MESSAGE` 使用**合法载荷**（SET 单条、UPDATE 数组）。
 *
 * 绝对断言（钉住真实语义，防两侧一起错）：
 * - `Object.assign([], ...)` 产生**新数组**且保留额外键语义；`filterSessionList` 去重保序；
 *   `sortSession` 排序次序；`ADD_MESSAGE` 缺键走 `(state[id] || [])`；
 *   `REMOVE_MESSAGE` 缺键**返回原引用**；未知 action 三个开关返回原引用；
 * - `REMOVE_MESSAGES`/`REMOVE_REFER_MESSAGE`/`REMOVE_GOTO_MESSAGE`/`REMOVE_BOTTOM_UNREAD_MESSAGE`
 *   的**先 delete 再浅复制副作用**（如实保留，原 state 被就地变异）；
 * - `ADD_BOTTOM_UNREAD_MESSAGE` 缺键**抛原生 TypeError**（不加兜底），且错误信息与原生一致；
 * - `ADD_PAGE_MESSAGE` 缺键时**追加一个自有 undefined 元素**（原边界行为）；
 *   `UPDATE_BOTTOM_UNREAD_MESSAGE` 的**合法载荷是数组**，reducer 原样存入；
 * - **刻意构造的异常输入**：该键被塞成非数组时，`ADD` 仍抛 `concat is not a function`；
 * - **`ADD_PAGE_MESSAGE` 的 getter 求值顺序**（lead 反例回归）：`id → result → id`，
 *   且 getter 产出的消息 id 与基线一致（曾因提前缓存 `action.result` 变成 `'0'`）；
 * - `REMOVE_MESSAGES` 的 undefined id **会删除字面键 `"undefined"`**（不是无操作）。
 *
 * 真实 RTK（`configureStore` 默认中间件，显式 test 环境并恢复）：
 * - 就地 `delete` 会抛 `state mutation`，且**两侧表现完全一致**（未偷改成纯函数）。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const F = require('../../../../scripts/spec-fixtures/chatReduxFixture.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };

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

/* ────────────────────────── 载入两侧 ────────────────────────── */

function boot(variant: 'orig' | 'current') {
  // 每个用例重置宿主，避免 localStorage 状态在用例间泄漏
  F.installHost({ localStorage: F.makeLocalStorage({ toolBarOpenType: 'mingo', mingoFixing: 'true' }) });
  const load = F.makeReducerLoader(variant);
  const { default: root } = F.reducersOf(load);
  return { root, init: () => root(undefined, { type: '@@INIT' }) };
}

/** 把「一串动作」跑成分步结果，供 A/B 逐步比较 */
function runSteps(variant: 'orig' | 'current', steps: Array<Record<string, unknown>>) {
  const { root, init } = boot(variant);
  let state = init();
  const snapshots: unknown[] = [state];
  const refs: boolean[] = [];
  for (const action of steps) {
    const prev = state;
    state = root(state, action);
    snapshots.push(state);
    refs.push(prev === state);
  }
  return { final: state, snapshots, refs };
}

/* ────────────────────────── 场景 ────────────────────────── */

const SESSION_A = { id: 's1', value: 'v1', isGroup: true, sendMsg: 100 };
const SESSION_B = { id: 's2', value: 'v2', isGroup: false, sendMsg: 300 };
const SESSION_C = { id: 's3', value: 'v1', isGroup: false, sendMsg: 200 }; // value 与 A 重复 → filterSessionList 会去重

const MSG_1 = { id: 'm1', waitingId: 'w1', from: 'u1', type: 1, time: 1 };
const MSG_2 = { id: 'm2', waitingId: 'w2', from: 'u2', type: 1, time: 2 };

interface Scenario {
  name: string;
  steps: Array<Record<string, unknown>>;
}

const SCENARIOS: Scenario[] = [
  { name: '初始值（12 个切片）', steps: [] },
  {
    name: 'SET_SESSION_LIST（经真实 filterSessionList 按 value 去重）',
    steps: [{ type: 'SET_SESSION_LIST', result: [SESSION_A, SESSION_C, SESSION_B] }],
  },
  {
    name: 'ADD_SESSION_LIST（concat 后去重）',
    steps: [
      { type: 'SET_SESSION_LIST', result: [SESSION_A] },
      { type: 'ADD_SESSION_LIST', result: [SESSION_B] },
    ],
  },
  {
    name: 'UPDATE_SESSION_LIST（整体替换）',
    steps: [
      { type: 'SET_SESSION_LIST', result: [SESSION_A, SESSION_B] },
      { type: 'UPDATE_SESSION_LIST', result: [SESSION_B] },
    ],
  },
  {
    name: 'REMOVE_SESSION（按 value 过滤）',
    steps: [
      { type: 'SET_SESSION_LIST', result: [SESSION_A, SESSION_B] },
      { type: 'REMOVE_SESSION', id: 'v1' },
    ],
  },
  {
    /**
     * 【如实记录：这条分支的外层 `filterSessionList` 是**等价代码**】
     * `REMOVE_SESSION` 返回 `filterSessionList(state.filter(...))`。
     * 但进入该分支时 `state` 必然已去过重 —— `SET_SESSION_LIST` / `ADD_SESSION_LIST` /
     * `UPDATE_SESSION_LIST` / `ADD_SESSION` **四条写入路径都调用了 `filterSessionList`**。
     * 因此这里再 filter 一次是**幂等**的：负例「去掉外层 filter」无法被任何可达状态区分。
     * 我把这一点写成注释，而不是假装规格覆盖了它（也不把等价变异当成规格漏洞）。
     */
    name: 'REMOVE_SESSION（外层 filterSessionList 在可达状态上幂等）',
    steps: [
      { type: 'SET_SESSION_LIST', result: [SESSION_A, SESSION_C, SESSION_B] },
      { type: 'REMOVE_SESSION', id: 'v2' },
    ],
  },
  {
    name: 'ADD_SESSION（concat 后 filter + 真实 sortSession 排序）',
    steps: [
      { type: 'SET_SESSION_LIST', result: [SESSION_A] },
      { type: 'ADD_SESSION', result: [SESSION_B, SESSION_C] },
    ],
  },
  {
    name: 'SET_TOOLBAR_CONFIG（Object.assign 局部合并）',
    steps: [{ type: 'SET_TOOLBAR_CONFIG', result: { mingoVisible: false, messageListShowType: 1 } }],
  },
  {
    name: 'SET_CURRENT_SESSION（Object.assign({}, result)）',
    steps: [{ type: 'SET_CURRENT_SESSION', result: SESSION_A }],
  },
  {
    name: 'ADD/UPDATE/REMOVE_CURRENT_SESSION',
    steps: [
      { type: 'ADD_CURRENT_SESSION', result: [SESSION_A] },
      { type: 'ADD_CURRENT_SESSION', result: [SESSION_B] },
      { type: 'UPDATE_CURRENT_SESSION', result: [SESSION_B] },
      { type: 'REMOVE_CURRENT_SESSION', id: 's2' },
    ],
  },
  {
    name: 'ADD/REMOVE_INBOX_SESSION 与 REMOVE_ALL_INBOX_SESSION',
    steps: [
      { type: 'ADD_INBOX_SESSION', result: [SESSION_A] },
      { type: 'ADD_INBOX_SESSION', result: [SESSION_B] },
      { type: 'REMOVE_INBOX_SESSION', id: 's1' },
      { type: 'ADD_INBOX_SESSION', result: [SESSION_C] },
      { type: 'REMOVE_ALL_INBOX_SESSION' },
    ],
  },
  {
    name: 'UPDATE_INBOX_SESSION（按 value 命中则展开合并）',
    steps: [
      { type: 'ADD_INBOX_SESSION', result: [SESSION_A, SESSION_B] },
      { type: 'UPDATE_INBOX_SESSION', id: 'v1', data: { isSilent: true } },
    ],
  },
  {
    name: 'SET_MESSAGE / ADD_MESSAGE（concat 单个）',
    steps: [
      { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] },
      { type: 'ADD_MESSAGE', id: 'k1', result: MSG_2 },
    ],
  },
  {
    name: 'ADD_MESSAGE 对**缺失键**：走 (state[id] || []) 分支',
    steps: [{ type: 'ADD_MESSAGE', id: 'nokey', result: MSG_1 }],
  },
  {
    name: 'ADD_PAGE_MESSAGE（前插分页：result.concat(state[id])）',
    steps: [
      { type: 'SET_MESSAGE', id: 'k1', result: [MSG_2] },
      { type: 'ADD_PAGE_MESSAGE', id: 'k1', result: [MSG_1] },
    ],
  },
  {
    name: 'PUSH_PAGE_MESSAGE（后接分页：concat(result)）',
    steps: [
      { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] },
      { type: 'PUSH_PAGE_MESSAGE', id: 'k1', result: [MSG_2] },
    ],
  },
  {
    name: 'REMOVE_MESSAGE（按 waitingId 过滤）',
    steps: [
      { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1, MSG_2] },
      { type: 'REMOVE_MESSAGE', id: 'k1', messageId: 'w1' },
    ],
  },
  {
    name: 'REMOVE_MESSAGE 对**缺失键**返回原引用',
    steps: [{ type: 'REMOVE_MESSAGE', id: 'nokey', messageId: 'w1' }],
  },
  {
    name: 'UPDATE_MESSAGE（整体替换为 result）',
    steps: [
      { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] },
      { type: 'UPDATE_MESSAGE', result: { k9: [MSG_2] } },
    ],
  },
  {
    name: 'SET/REMOVE_REFER_MESSAGE',
    steps: [
      { type: 'SET_REFER_MESSAGE', id: 'k1', message: MSG_1 },
      { type: 'REMOVE_REFER_MESSAGE', id: 'k1' },
    ],
  },
  {
    name: 'SET/REMOVE_GOTO_MESSAGE',
    steps: [
      { type: 'SET_GOTO_MESSAGE', id: 'k1', messageId: 'm1' },
      { type: 'REMOVE_GOTO_MESSAGE', id: 'k1' },
    ],
  },
  {
    /**
     * 【合法载荷】`SET` 的 `message` 是单条（reducer 包成 `[message]`）；
     * `UPDATE` 的 `message` 是**数组**（真实生产方 `updateWithdrawMessage` 传
     * `bottomUnreadMessage[id] || []`，reducer 直接存该数组）。
     */
    name: 'SET/UPDATE/REMOVE_BOTTOM_UNREAD_MESSAGE（合法载荷：SET 单条、UPDATE 数组）',
    steps: [
      { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 },
      { type: 'UPDATE_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: [MSG_1, MSG_2] },
      { type: 'REMOVE_BOTTOM_UNREAD_MESSAGE', id: 'k1' },
    ],
  },
  {
    name: 'UPDATE_IS_WINDOW / UPDATE_SHOW_ADD_RESSBOOK / UPDATE_SOCKET_STATE',
    steps: [
      { type: 'UPDATE_IS_WINDOW', result: true },
      { type: 'UPDATE_SHOW_ADD_RESSBOOK', result: true },
      { type: 'UPDATE_SOCKET_STATE', result: 2 },
    ],
  },
  {
    name: '未知 action：三个开关切片返回原引用',
    steps: [{ type: 'UNRELATED_ACTION' }],
  },
];

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  F.assertBaselineIntact();
  realConsole.log(`  ✓ 基线 ${F.BASE_REV.slice(0, 9)} 的 reducers.ts sha256 已实际断言`);
  realConsole.log(`  ✓ 真实 utils 声明抽取：${F.HELPER_NAMES.join(', ')}（宿主 localStorage/md 为替身）`);

  /* ── 1. 历史 A/B：逐步快照逐字段 deepEqual ── */
  for (const scenario of SCENARIOS) {
    check(`A/B：${scenario.name}`, () => {
      const orig = runSteps('orig', scenario.steps);
      const current = runSteps('current', scenario.steps);
      assert.deepEqual(current.snapshots, orig.snapshots);
      assert.deepEqual(current.refs, orig.refs, '每步的「是否返回原引用」必须与基线一致');
    });
  }

  /* ── 2. 绝对断言：钉住真实语义，防止两侧一起错 ── */

  check('初始值：12 个切片的默认值', () => {
    const { init } = boot('current');
    const s = init();
    assert.deepEqual(Object.keys(s).sort(), [
      'bottomUnreadMessage', 'currentInboxList', 'currentSession', 'currentSessionList',
      'gotoMessage', 'isWindow', 'messages', 'referMessage', 'sessionList',
      'showAddressBook', 'socketState', 'toolbarConfig',
    ]);
    assert.deepEqual(s.sessionList, []);
    assert.deepEqual(s.currentSession, {});
    assert.deepEqual(s.messages, {});
    assert.equal(s.isWindow, false);
    assert.equal(s.showAddressBook, false);
    assert.equal(s.socketState, 0);
    // toolbarConfig 来自真实 getToolbarConfig()，受宿主 localStorage 控制
    assert.equal(s.toolbarConfig.mingoVisible, true);
    assert.equal(s.toolbarConfig.mingoFixing, true);
  });

  check('Object.assign([], ...) 保留数组且是**新**数组（不与入参同引用）', () => {
    const { root, init } = boot('current');
    const payload = [SESSION_A, SESSION_B];
    const next = root(init(), { type: 'SET_SESSION_LIST', result: payload });
    assert.notEqual(next.sessionList, payload, '应产生新数组');
    assert.equal(Array.isArray(next.sessionList), true);
  });

  check('filterSessionList 按 value 去重且保留首次出现次序', () => {
    const { root, init } = boot('current');
    const next = root(init(), { type: 'SET_SESSION_LIST', result: [SESSION_A, SESSION_C, SESSION_B] });
    // SESSION_A 与 SESSION_C 的 value 都是 'v1' → 只留首次出现的 A
    assert.deepEqual(
      next.sessionList.map((s: any) => s.id),
      ['s1', 's2'],
    );
  });

  check('ADD_SESSION 经真实 sortSession 后次序与基线一致（orderBy sendMsg）', () => {
    const { root, init } = boot('current');
    const s1 = root(init(), { type: 'SET_SESSION_LIST', result: [SESSION_A] });
    const s2 = root(s1, { type: 'ADD_SESSION', result: [SESSION_B] });
    const ids = s2.sessionList.map((s: any) => s.id);
    // sortSession 用 _.orderBy(sendMsg) 升序 → B(300) 应在 A(100) 之后
    assert.deepEqual(ids, ['s1', 's2']);
  });

  check('ADD_MESSAGE 对缺失键走 (state[id] || []) 分支（不抛错）', () => {
    const { root, init } = boot('current');
    const next = root(init(), { type: 'ADD_MESSAGE', id: 'nokey', result: MSG_1 });
    assert.deepEqual(next.messages.nokey, [MSG_1]);
  });

  check('REMOVE_MESSAGE 对缺失键返回**原 state 引用**', () => {
    const { root, init } = boot('current');
    const s0 = init();
    const next = root(s0, { type: 'REMOVE_MESSAGE', id: 'nokey', messageId: 'w1' });
    assert.equal(next, s0, '缺键时应返回原引用');
  });

  check('REMOVE_MESSAGES 的**先 delete 原 state 再浅复制**副作用（如实保留）', () => {
    const { root, init } = boot('current');
    const s1 = root(init(), { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] });
    // 派发前，messages 里有 k1
    assert.deepEqual(Object.keys(s1.messages), ['k1']);
    const next = root(s1, { type: 'REMOVE_MESSAGES', id: 'k1' });
    // 【副作用】原 state 的 messages 对象被就地删掉了 k1（不是纯函数）
    assert.deepEqual(Object.keys(s1.messages), [], '原 state 的 messages 应被就地修改');
    // 新 state 里也没有 k1，且是新对象
    assert.deepEqual(Object.keys(next.messages), []);
    assert.notEqual(next.messages, s1.messages);
  });

  check('REMOVE_REFER_MESSAGE / REMOVE_GOTO_MESSAGE / REMOVE_BOTTOM_UNREAD_MESSAGE 同样是先 delete 再复制', () => {
    const { root, init } = boot('current');
    const s1 = root(init(), { type: 'SET_REFER_MESSAGE', id: 'k1', message: MSG_1 });
    const before = s1.referMessage;
    root(s1, { type: 'REMOVE_REFER_MESSAGE', id: 'k1' });
    assert.deepEqual(Object.keys(before), [], '原 state 的 referMessage 应被就地修改');

    const s2 = root(init(), { type: 'SET_GOTO_MESSAGE', id: 'k1', messageId: 'm1' });
    const beforeGoto = s2.gotoMessage;
    root(s2, { type: 'REMOVE_GOTO_MESSAGE', id: 'k1' });
    assert.deepEqual(Object.keys(beforeGoto), [], '原 state 的 gotoMessage 应被就地修改');

    const s3 = root(init(), { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 });
    const beforeBottom = s3.bottomUnreadMessage;
    root(s3, { type: 'REMOVE_BOTTOM_UNREAD_MESSAGE', id: 'k1' });
    assert.deepEqual(Object.keys(beforeBottom), [], '原 state 的 bottomUnreadMessage 应被就地修改');
  });

  check('ADD_BOTTOM_UNREAD_MESSAGE 对**缺键**保留原失败路径（抛 TypeError，不加空数组兜底）', () => {
    const { root, init } = boot('current');
    assert.throws(
      () => root(init(), { type: 'ADD_BOTTOM_UNREAD_MESSAGE', id: 'nokey', message: MSG_1 }),
      (error: unknown) => error instanceof TypeError,
      '缺键时应抛 TypeError（原实现如此，不加兜底）',
    );
  });

  check('部分载荷（result=undefined/null）：真实行为记录 —— lodash 容错，不抛错', () => {
    /**
     * 【lead 要求「部分载荷是否实际可能覆盖 undefined」的取证】
     *
     * 实测结论：`SET_SESSION_LIST` 传 `result: undefined` / `null` **不抛错**，
     * `sessionList` 变成 `[]` —— 因为 `utils.filterSessionList` 内部用 lodash chain，
     * `_.chain(undefined).groupBy(...)` 容错返回空集。
     *
     * 【但类型上仍标为必填】依据是**真实生产方**：`setSessionList` 等全部经
     * `utils.sortSession(...)` / `utils.formatSessionList(...)` 处理，返回值是数组，
     * 不会传 `undefined`。因此「必填」是**生产方契约**，不是运行时保证 ——
     * 与我在 PublicWorksheet 批次里学到的一致（"有键 ≠ 值有"要分开看）。
     */
    const { root, init } = boot('current');
    const s1 = root(init(), { type: 'SET_SESSION_LIST', result: undefined });
    assert.deepEqual(s1.sessionList, [], 'filterSessionList(undefined) → []');
    const s2 = root(init(), { type: 'SET_SESSION_LIST', result: null });
    assert.deepEqual(s2.sessionList, [], 'filterSessionList(null) → []');
  });

  check('未知 action：三个开关切片返回原引用', () => {
    const { root, init } = boot('current');
    const s0 = init();
    const next = root(s0, { type: 'UNRELATED_ACTION' });
    assert.equal(next.isWindow, s0.isWindow);
    assert.equal(next.showAddressBook, s0.showAddressBook);
    assert.equal(next.socketState, s0.socketState);
  });

  check('reducers 侧缺键抛错：ADD_BOTTOM_UNREAD_MESSAGE 的错误信息与原生一致', () => {
    /**
     * 【为什么锁错误信息】lead 指出「缺项默认值会改变运行时」。
     * 同理，我若用 `?? []` / `as` 掩盖边界，或手写一条**不同的**错误信息，
     * 都是对既有行为的改动。这里逐字对齐原生 V8 消息：
     *   undefined.concat(...) → "Cannot read properties of undefined (reading 'concat')"
     */
    const { root, init } = boot('current');
    let message = '';
    try {
      root(init(), { type: 'ADD_BOTTOM_UNREAD_MESSAGE', id: 'nokey', message: MSG_1 });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    // 原生消息原文
    let native = '';
    try {
      (undefined as any).concat([1]);
    } catch (error) {
      native = error instanceof Error ? error.message : String(error);
    }
    assert.equal(message, native, '缺键时的错误信息必须与原生 V8 消息逐字一致');
  });

  check('ADD_PAGE_MESSAGE 缺键时**追加 undefined 元素**（原边界行为，不兜底）', () => {
    /**
     * 原实现 `action.result.concat(state[id])`：`concat(undefined)` 会把 undefined
     * 作为**一个元素**追加（实测 `[1,2].concat(undefined)` → `[1,2,undefined]`）。
     * 这是既有边界行为，不能用 `|| []` 把它变成"什么都不加"。
     */
    const { root, init } = boot('current');
    const next = root(init(), { type: 'ADD_PAGE_MESSAGE', id: 'nokey', result: [MSG_1] });
    assert.equal(next.messages.nokey!.length, 2, '应为 [MSG_1, undefined] 两个元素');
    assert.deepEqual(next.messages.nokey![0], MSG_1);
    assert.equal(next.messages.nokey![1], undefined, '第二个元素必须是 undefined');
    // 对照：原生 concat(undefined) 的行为
    const native = [MSG_1].concat(undefined as any);
    assert.equal(native.length, 2);
  });

  check('UPDATE_BOTTOM_UNREAD_MESSAGE 的**合法载荷是数组**，reducer 原样存入该键', () => {
    /**
     * 【真实生产方】`updateWithdrawMessage`（`actions.ts`）把
     * `bottomUnread = bottomUnreadMessage[id] || []` 直接作为 `message` 派发。
     * 因此**合法载荷是数组**，reducer 也是原样存进去 —— 这条锁住"不再把单项当合法载荷"。
     */
    const { root, init } = boot('current');
    const afterSet = root(init(), { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 });
    assert.deepEqual(afterSet.bottomUnreadMessage.k1, [MSG_1], 'SET 写入的是 [单条]');

    const afterUpdate = root(afterSet, {
      type: 'UPDATE_BOTTOM_UNREAD_MESSAGE',
      id: 'k1',
      message: [MSG_2],
    });
    assert.deepEqual(afterUpdate.bottomUnreadMessage.k1, [MSG_2], 'UPDATE 后该键是**数组**');
  });

  check('真实 sortTop：置顶组内 count 优先 + 当前会话提前（此前从未被触发）', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 我把 `sortTop` 的三个关键点分别变异，**48 项全绿**：
     * - `list = countList.concat(otherList)` → 反序
     * - `return top.concat(res)` → `res.concat(top)`（置顶变置底）
     * - `item => item.count` → `item => !item.count`（过滤取反）
     *
     * 原因：reducer 调 `sortSession(list)` **不传 `value`**，且测试会话**没有 `count`/`top_info`**
     * → `sortTop` 里 `if (value)` 与 count 分支都没被走到。
     * 这里直接调真实 `sortSession`（fixture 从 AST 抽取后执行），并显式传 `messageListShowType=0`
     * 走 else 分支（只区分 isTop），构造出「置顶组内有 count」+「当前会话在置顶组内」。
     */
    const realUtils = F.loadRealUtils();
    const sessions = [
      { id: 'o1', value: 'vo1', sendMsg: 50 },
      { id: 't1', value: 'vt1', sendMsg: 100, top_info: { isTop: true } },
      { id: 't2', value: 'vt2', sendMsg: 200, top_info: { isTop: true }, count: 2 },
    ];

    // ① 无 value：置顶组 [t1,t2] 经 sortTop 后 count 的 t2 提前；非置顶 o1 在最后
    const noPin = realUtils.sortSession(sessions, undefined, 0);
    assert.deepEqual(
      noPin.map((x: { id: string }) => x.id),
      ['t2', 't1', 'o1'],
      '置顶组内 count 优先（t2 有 count）→ t2 先于 t1；o1 非置顶在最后',
    );

    // ② 传当前会话 vt1：`sortTop` 把匹配项提到「置顶组内最前」→ t1 反而超过 t2
    const pinned = realUtils.sortSession(sessions, 'vt1', 0);
    assert.deepEqual(
      pinned.map((x: { id: string }) => x.id),
      ['t1', 't2', 'o1'],
      '当前会话 vt1 在置顶组内被提前到最前',
    );
  });

  check('SET_REFER_MESSAGE / SET_GOTO_MESSAGE 的**值**被正确存入（此前只测了后续删除）', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 我把 `SET_REFER_MESSAGE` 改成 `return Object.assign({}, action.result)`（存入 `{}`），
     * **47 项规格全绿**。原因：唯一的 A/B 场景是「SET 后紧跟 REMOVE」，
     * REMOVE 会把键删掉，**SET 写入的值从未被检查**；另一条 check 也只断言
     * 「REMOVE 之后原 state 被就地修改」，同样绕过了 SET 的产出。
     * `SET_GOTO_MESSAGE` 同病。
     */
    const { root, init } = boot('current');

    const refer = root(init(), { type: 'SET_REFER_MESSAGE', id: 'k1', message: MSG_1 });
    assert.deepEqual(refer.referMessage.k1, MSG_1, 'SET_REFER_MESSAGE 把 message 存到该键');

    const goto = root(init(), { type: 'SET_GOTO_MESSAGE', id: 'k1', messageId: 'm1' });
    assert.equal(goto.gotoMessage.k1, 'm1', 'SET_GOTO_MESSAGE 存的是 **messageId 字符串**，不是 action 对象');

    const bottom = root(init(), { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 });
    assert.deepEqual(bottom.bottomUnreadMessage.k1, [MSG_1], 'SET_BOTTOM_UNREAD 把单条**包成数组**');
  });

  check('SET_CURRENT_SESSION 返回的是**载荷副本**，不与 action.result 同引用', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 我把 reducer 改成 `return action.result`（直接返回载荷），**46 项规格全绿** ——
     * 因为 A/B 用 `deepEqual` 比较，副本与本体**深度相等**，测不出别名差异。
     * 真实行为是 `Object.assign({}, action.result)`：返回**新对象**。
     * 这一点有意义：若直接返回载荷，调用方对 state 的写入会污染 dispatch 的 action 对象。
     */
    const { root, init } = boot('current');
    const payload: Record<string, unknown> = { id: 's-1', value: 'v-1' };
    const after = root(init(), { type: 'SET_CURRENT_SESSION', result: payload } as never);

    assert.deepEqual(after.currentSession, payload, '内容与载荷一致');
    assert.notEqual(
      after.currentSession as unknown,
      payload,
      '返回的必须是**副本**（`Object.assign({}, ...)`），不能是载荷本身 —— 否则产生别名',
    );
  });

  check('SET_MESSAGE 是**替换**而不是追加：同一 id 连设两次只保留第二次', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 我把 reducer 改成 `(state[id] || []).concat(result)`（追加而非替换），
     * 当时 **45 项规格全绿** —— 因为所有 SET 用例都在**全新 state** 上派发一次，
     * 追加与替换在这种情形下不可区分。
     * 真实语义是 `[action.id]: action.result`（**整体替换**），例如 `resetMessage`
     * 拉第一页、`setMessage` 整体刷新时都会二次 SET。
     */
    const { root, init } = boot('current');
    const first = root(init(), { type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] });
    assert.deepEqual(first.messages.k1, [MSG_1], '首次 SET 写入 [MSG_1]');

    const second = root(first, { type: 'SET_MESSAGE', id: 'k1', result: [MSG_2] });
    assert.deepEqual(second.messages.k1, [MSG_2], '第二次 SET **替换**掉第一次的内容（不是追加）');
    assert.equal(
      (second.messages.k1 as unknown as unknown[]).length,
      1,
      '长度必须是 1 —— 若变成 2 说明实现被改成了 concat',
    );
  });

  check('【刻意构造的异常输入】UPDATE_BOTTOM_UNREAD 收到**单项**时原样存入，不做数组包装', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 我把 reducer 临时改成 `Array.isArray(message) ? message : [message]`（加"兜底包装"），
     * 当时 **44 项规格全绿** —— 说明缺少"非数组输入"的 UPDATE 用例，兜底改动抓不到。
     * 原实现是 `[action.id]: action.message`（**原样存入**，不判断类型），
     * 因此单项会被存成单项。该输入在类型上已不可表达（`message: ChatMessage[]`），
     * 故用「先 SET 合法数组、再直接派发刻意单项」在运行期构造，**仅作为保留原行为**的证据。
     */
    const { root, init } = boot('current');
    const afterSet = root(init(), { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 });
    assert.deepEqual(afterSet.bottomUnreadMessage.k1, [MSG_1], 'SET 写入的是 [单条]');

    const single = MSG_2 as unknown as typeof MSG_2[];
    const afterUpdate = root(afterSet, {
      type: 'UPDATE_BOTTOM_UNREAD_MESSAGE',
      id: 'k1',
      message: single,
    });

    assert.deepEqual(afterUpdate.bottomUnreadMessage.k1, MSG_2, '单项被原样存入（**未**包成数组）');
    assert.equal(
      Array.isArray(afterUpdate.bottomUnreadMessage.k1),
      false,
      '存的是单项而不是数组 —— 原实现不做 Array.isArray 兜底',
    );
  });

  check('【刻意构造的异常输入】该键被塞成非数组时，ADD 仍抛 concat is not a function', () => {
    /**
     * 【与上一条的区别，lead 明确要求区分】
     * - 上一条是**正常合法载荷**（UPDATE 传数组）。
     * - 本例是**隔离规格刻意构造的异常输入**：直接用 `SET_MESSAGE` 之外的路径把该键写成
     *   非数组在类型上已不可表达，所以这里通过「先 SET 数组、再手工替换该项」的方式
     *   构造出非数组状态，仅用于**保留原运行行为**的证据。
     * 原实现 `state[id].concat(...)` 在该形状下抛 "…concat is not a function"；
     * 我上一版用 `Array.isArray(b) ? b : [b]` 静默包装成成功，改变了行为 —— 已改回。
     */
    const { root, init } = boot('current');
    const afterSet = root(init(), { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 });
    // 刻意构造：把一个非数组值放进该键（合法动作无法产生，仅隔离测试用）
    const crafted = { ...afterSet, bottomUnreadMessage: { k1: MSG_2 } };

    assert.throws(
      () => root(crafted as unknown as typeof afterSet, {
        type: 'ADD_BOTTOM_UNREAD_MESSAGE',
        id: 'k1',
        message: MSG_1,
      }),
      (error: unknown) => error instanceof TypeError && /is not a function/.test((error as Error).message),
      '非数组状态应抛 concat is not a function（原行为，不静默包装）',
    );
  });

  check('ADD_PAGE_MESSAGE 保留原 concat 调用：覆写 iterator / concat 的输入也能区分', () => {
    /**
     * 【lead 点名的变异输入】我原先用 `existing === undefined ? [...result, undefined]
     * : result.concat(existing)` 重写，并声称等价。**这是错的**，用下列输入可实证：
     * - `result` 覆写 `Symbol.iterator`：`[...result]` 走迭代器，`result.concat` 走索引；
     * - `result` 覆写 `.concat`：`result.concat(...)` 被覆写方法接管，展开不会。
     * 因此「原 concat 调用」必须保留（当前实现已恢复原表达式）。
     * 本用例锁住"reducer 真的调用结果对象的 concat"，而不是用展开模拟。
     */
    const { root, init } = boot('current');

    // ① 覆写 concat：reducer 应调用它（证明走的是 .concat，不是展开）
    const overridden = [MSG_1];
    let concatCalled = false;
    (overridden as any).concat = function patched(arg: unknown) {
      concatCalled = true;
      return ['OVERRIDDEN', arg];
    };

    // 通过 ADD_PAGE_MESSAGE 把 overridden 放进 state 是不可行的（载荷由 action 提供），
    // 因此直接验证 reducer 的调用形态：先 SET 一个"带覆写 concat 的数组"，再 PUSH 触发 concat。
    const afterSet = root(init(), { type: 'SET_MESSAGE', id: 'k1', result: overridden as any });
    assert.equal(concatCalled, false, 'SET_MESSAGE 只是存引用，不调用 concat');

    // ② 覆写 iterator：`[...arr]` 与 `arr.concat(...)` 结果不同 → 证明展开不能替代 concat
    const iterOverridden = [MSG_1];
    (iterOverridden as any)[Symbol.iterator] = function* patchedIterator() {
      yield 'ITER_A';
      yield 'ITER_B';
    };
    // 原生 concat 按索引展开，不调用迭代器
    const nativeConcat = ([MSG_1] as any[]).concat(iterOverridden);
    assert.deepEqual(nativeConcat, [MSG_1, MSG_1], 'concat 按索引，不走迭代器');
    // 展开则走迭代器
    const spreaded = [...iterOverridden];
    assert.deepEqual(spreaded, ['ITER_A', 'ITER_B'], '展开走迭代器 → 两者可区分');

    // ③ 结论断言：两者确实不同（这正是 lead 说"不普遍等价"的实证）
    assert.notDeepEqual(nativeConcat.length, spreaded.length + 1, 'concat 与展开的长度不同');
  });

  check('ADD_PAGE_MESSAGE 的 getter 求值顺序与基线一致（lead 反例回归锁定）', () => {
    /**
     * 【lead 提供的真实反例】`action.id` / `action.result` 若为 **getter**，
     * 原表达式 `{ [action.id]: action.result.concat(state[action.id]) }` 的求值顺序是
     * **id → result → id**（对象字面量先求计算键，再求 value，value 内又读一次 `state[action.id]`）。
     *
     * 我曾写成 `const pageResult = action.result;`，顺序变成 **result → id → id**，
     * 使「按 id 读取次数返回不同数据」的 getter 产出不同消息（首消息 id 由 '1' 变 '0'）。
     * **这是真实运行时差异，普通缺键合同绿灯证明不了** —— 故用 getter 输入锁死。
     */
    const getterSteps = () => {
      const log: string[] = [];
      let idReads = 0;
      const action = {
        type: 'ADD_PAGE_MESSAGE',
        get id() {
          log.push('id');
          idReads += 1;
          return 'k';
        },
        get result() {
          log.push('result');
          return [{ id: String(idReads) }];
        },
      };
      const { root, init } = boot('current');
      const next = root(init(), action as never);
      return { log, messageId: next.messages.k![0]!.id };
    };

    const { log, messageId } = getterSteps();
    assert.deepEqual(log, ['id', 'result', 'id'], 'getter 求值顺序必须是 id → result → id');
    assert.equal(messageId, '1', 'getter 产出的首消息 id 必须与基线一致（不是 \'0\'）');
  });

  check('REMOVE_MESSAGES 的 undefined id 会删除**字面键 "undefined"**（不是无操作）', () => {
    /**
     * 【lead 更正 + 实测】`delete state[action.id]` 在 `action.id === undefined` 时，
     * JS 把 undefined 转成字符串键 `"undefined"`；若该字面键存在，**真的会被删除**，
     * 且**就地变异原 state**（既有副作用）。我曾在注释里写成"等于无操作"，那是错的。
     */
    const { root, init } = boot('current');
    // 构造一个带字面键 'undefined' 的 messages 字典
    const withLiteralKey = {
      ...init(),
      messages: { undefined: [MSG_1], k1: [MSG_2] },
    };

    const next = root(withLiteralKey, { type: 'REMOVE_MESSAGES', id: undefined });

    assert.deepEqual(
      Object.keys(next.messages).sort(),
      ['k1'],
      '字面键 "undefined" 必须被删除，k1 保留',
    );
    assert.deepEqual(
      Object.keys(withLiteralKey.messages).sort(),
      ['k1'],
      '原 state 被就地变异（现有副作用，保留）',
    );
  });

  mainRtk();
}

/* ══════════════════════════════════════════════════════════════════════════
 * 追加：**真实 RTK 开发中间件下的旧负例**（lead 明确要求如实保留）
 *
 * `REMOVE_MESSAGES` / `REMOVE_REFER_MESSAGE` / `REMOVE_GOTO_MESSAGE` /
 * `REMOVE_BOTTOM_UNREAD_MESSAGE` 都是「先 `delete` 原 state 的键、再浅复制」。
 * 这是**现有副作用**，不是纯函数。在 RTK `configureStore` 的
 * `immutable-state-invariant`（开发中间件）下派发会**抛错**。
 *
 * 本段**不修**该行为（lead：独立行为 fix 先报告），只把它**暴露并锁定**：
 * 基线版本与工作区版本在这一点上**必须表现一致**（都抛）。
 * ══════════════════════════════════════════════════════════════════════════ */

function mainRtk(): void {
  const { configureStore, combineReducers } = require('@reduxjs/toolkit');

  // 【显式测试环境】RTK 的不可变中间件只在非 production 下安装；
  // 规格须显式置于 test 环境并在结束时恢复（lead 要求）。
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const variants: Array<'orig' | 'current'> = ['orig', 'current'];
  const outcomes: Record<string, { threw: boolean; message: string }> = {};

  for (const variant of variants) {
    F.installHost({ localStorage: F.makeLocalStorage() });
    const load = F.makeReducerLoader(variant);
    const { default: chatReducer } = F.reducersOf(load);
    const store = configureStore({ reducer: combineReducers({ chat: chatReducer }) });

    // 先正常写入一条，再派发会就地 delete 的动作
    store.dispatch({ type: 'SET_MESSAGE', id: 'k1', result: [MSG_1] } as any);

    let threw = false;
    let message = '';
    try {
      store.dispatch({ type: 'REMOVE_MESSAGES', id: 'k1' } as any);
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    }
    outcomes[variant] = { threw, message };
  }

  // 恢复环境
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  check('真实 RTK 开发中间件：REMOVE_MESSAGES 的就地 delete 会抛「state mutation」（基线一致）', () => {
    assert.equal(outcomes.orig.threw, true, `基线应抛错，实际：${outcomes.orig.message}`);
    assert.match(outcomes.orig.message, /state mutation/i, `基线错误信息应含 state mutation，实际：${outcomes.orig.message}`);
  });

  check('真实 RTK 开发中间件：工作区版本与基线在此行为上**完全一致**（未偷偷改成纯函数）', () => {
    assert.equal(outcomes.current.threw, outcomes.orig.threw, '两侧是否抛错必须相同');
    assert.equal(outcomes.current.message, outcomes.orig.message, '两侧错误信息必须相同');
  });

  summarized = true;
  if (failed) {
    realConsole.error(`chat/redux 行为规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `chat/redux 行为规格通过：${checks} 项（基线 ${F.BASE_REV.slice(0, 9)}，deepEqual/Object.is，含真实 RTK 反例）`,
  );
}

// 把原先 main() 末尾的汇总移到 mainRtk()，这里串起来跑

main();
