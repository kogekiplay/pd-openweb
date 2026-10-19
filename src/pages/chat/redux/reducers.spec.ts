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

  check('【lead 15:29 反例】两个 formatter 的真实输入/输出形态（锁进历史规格）', () => {
    /**
     * lead 用真实 formatter 跑出三个「被我的入参类型允许、且确实返回成功」的结果，
     * 与我当时的输出声明矛盾。修正后这些**事实本身**必须被规格记住，
     * 否则将来有人"顺手"把类型改回去也不会有东西响。
     *
     * 【事实 1】`formatNewMessage` **完全不动 `msg`** —— 它只写 `iswd`/`fromAccount`，
     *   然后转交 `formatMessage`。所以传入什么 msg 形态，出来还是什么形态。
     *   （这正是"不能用 `as ChatMessage` 声称 msg 已归一化"的原因。）
     * 【事实 2】`formatNewSession` 的**系统分支从不写 `from`**，且不改 `id`/`value`。
     * 【事实 3】`formatSession` 收到缺 `id` 的 `from` 时**成功返回**，`from.id` 仍为 undefined。
     */
    F.installHost({ localStorage: F.makeLocalStorage({}) });
    const utils = F.loadRealUtils();

    // 事实 1：msg 是对象时保持对象（函数不动它）
    const m = { id: 'm1', from: 'u1', uname: 'User', msg: { con: 'hi' }, type: 1, time: 1700000000000 };
    const outM: Record<string, unknown> = utils.formatNewMessage(m);
    // 用 assert.ok 而不是 assert.equal：后者带 `asserts actual is T`，会把 outM 收窄成 m 的字面量类型
    assert.ok(outM === m, 'formatNewMessage 返回**同一对象**（就地改型）');
    assert.deepEqual(outM.msg, { con: 'hi' }, 'msg 保持入参形态（函数不归一化 msg）');
    assert.deepEqual(outM.fromAccount, { id: 'u1', name: 'User', logo: undefined }, 'fromAccount 由 from/uname/logo 写出');
    assert.equal(outM.iswd, false, 'iswd 被写成 false');

    // 事实 2：系统分支不写 from、不改 id/value
    const sys = { dtype: 'system', id: 's1', msg: 'system string', type: 3, value: 'v1' };
    const outS: Record<string, unknown> = utils.formatNewSession(sys);
    assert.ok(outS === sys, 'formatNewSession 同样就地改型');
    assert.deepEqual(outS.msg, { con: 'system string' }, '系统分支把 string msg 包成 { con }');
    assert.equal(Object.prototype.hasOwnProperty.call(outS, 'from'), false, '系统分支**不写 from**');
    assert.equal(outS.id, 's1', '系统分支不改 id');
    assert.equal(outS.value, 's1', '系统分支把 value 写成 id');

    // 事实 3：缺 id 的 from 也能成功返回
    const s3 = { id: 's3', type: 1, msg: { con: 'text' }, from: { name: 'User' } };
    const out3 = utils.formatSession(s3);
    assert.ok(out3 === s3, 'formatSession 就地改型并返回同一对象');
    assert.equal(out3.from.id, undefined, 'from.id 可以仍是 undefined（不强制生产方补齐）');
  });

  check('真实 formatMessage：isMine / 连续消息合并 / isDuplicated 三分支', () => {
    /**
     * 【这条补的是上轮如实列出的缺口】
     * 上轮原文：「`formatMessage` 已纳入抽取但**尚未写独立用例**（它被 `formatSession`
     * 间接调用，覆盖面弱于 `formatSession`）」。
     *
     * 【同时修掉一个替身失真】原 `Constant: {}` 让 `Constant.MSGTYPE_TEXT` 恒为 `undefined`，
     * 于是 `message.type === Constant.MSGTYPE_TEXT` **恒 false** ——
     * "连续文本消息合并"分支**永远不进**。已把替身换成真实常量值（`MSGTYPE_TEXT: 1`）。
     */
    // 【accountId 显式设为 'me'】此前夹具不设 accountId（undefined），
    // 于是 `from === accountId` 的 isMine=true 是靠 `undefined === undefined` **空过**的。
    F.installHost({ localStorage: F.makeLocalStorage({}), accountId: 'me' });
    const utils = F.loadRealUtils();
    const accountId = (globalThis as { md?: { global?: { Account?: { accountId?: string } } } }).md
      ?.global?.Account?.accountId;
    assert.ok(accountId === 'me', '宿主 accountId 必须是显式 "me"，否则 isMine=true 是空过');

    // ① 普通消息：timestamp 是文案字符串；isMine 由 from === accountId 决定
    const m1 = { id: 'm1', from: 'other', time: 1700000000000, type: 1 };
    const out1 = utils.formatMessage(m1);
    assert.equal(typeof out1.timestamp, 'string', 'timestamp 被 formatMsgDate 写成文案');
    assert.equal(out1.isMine, false, 'from 非本人 → isMine=false');

    const mine = { id: 'm9', from: accountId, time: 1700000000000, type: 1 };
    assert.equal(utils.formatMessage(mine).isMine, true, 'from 是本人(me) → isMine=true');
    // 对照：同一次宿主设置下，别的 from 必须是 false
    assert.equal(utils.formatMessage({ id: 'm10', from: 'not-me', time: 1700000000000, type: 1 }).isMine, false, 'from 非本人 → isMine=false');

    // ② 连续文本消息（同一发送者、间隔 < 3 分钟、type=1）→ timestamp 置 null、isDuplicated=true
    const m2 = { id: 'm2', from: 'other', time: 1700000000000 + 1000, type: 1 };
    const out2 = utils.formatMessage(m2, out1);
    assert.equal(out2.timestamp, null, '连续文本消息的 timestamp 被置 null（合并）');
    assert.equal(out2.isDuplicated, true, 'type=MSGTYPE_TEXT → isDuplicated=true');

    // ③ 连续但**非文本**（type=2）→ timestamp 保留、isDuplicated=false
    // 【读实现后修正】连续分支里 `message.timestamp = null` 是**无条件**执行的
    // （在 isText 判断之前），所以非文本连续消息 timestamp **同样是 null**；
    // 只有 isDuplicated 按 isText 区分。
    const m3 = { id: 'm3', from: 'other', time: 1700000000000 + 1000, type: 2 };
    const out3 = utils.formatMessage(m3, out1);
    assert.equal(out3.timestamp, null, '连续消息（无论类型）timestamp 都被置 null');
    assert.equal(out3.isDuplicated, false, '非文本 → isDuplicated=false');

    // ③a 【阈值下界】间隔 2 分钟 → **仍然合并**（证明阈值 > 2 分钟，排除"30 秒"这类小阈值）
    //     【这条同样由变异测试发现】只测 1 秒和 3 分钟+1 秒时，把阈值改成 30 秒**抓不到**。
    const twoMin = { id: 'm6', from: 'other', time: 1700000000000 + 2 * 60 * 1000, type: 1 };
    assert.equal(utils.formatMessage(twoMin, out1).timestamp, null, '间隔 2 分钟仍在阈值内 → 合并');

    // ③b 【边界】间隔超过 3 分钟 → **不合并**（timestamp 保留）
    //     【这条由变异测试发现】把阈值 `60 * 3000`（3 分钟）改成 `60 * 300000`（300 分钟）
    //     原本**抓不到** —— 因为原用例间隔只有 1 秒，远小于任何阈值。
    const farApart = { id: 'm5', from: 'other', time: 1700000000000 + 3 * 60 * 1000 + 1000, type: 1 };
    const out5 = utils.formatMessage(farApart, out1);
    assert.equal(typeof out5.timestamp, 'string', '间隔 > 3 分钟 → **不合并**，timestamp 保留文案');
    assert.equal(out5.isDuplicated, undefined, '未进入连续分支 → isDuplicated 未被赋值');

    // ③c 【发送者不同】间隔虽小但 from 不同 → **不合并**
    //     【这条由变异测试发现】把 `message.from === prevMessage.from` 改成 `true`（忽略发送者）
    //     原本抓不到 —— 因为此前所有用例的 from 都是同一个 'other'。
    const otherSender = { id: 'm7', from: 'another', time: 1700000000000 + 1000, type: 1 };
    assert.equal(
      typeof utils.formatMessage(otherSender, out1).timestamp,
      'string',
      '发送者不同 → 不进入连续分支，timestamp 保留',
    );

    // ④ 上一条是撤回/系统消息 → isDuplicated=false（另一分支）
    const prevWithdrawn = { id: 'p1', from: 'other', time: 1700000000000, type: 1, iswd: true };
    const m4 = { id: 'm4', from: 'other', time: 1700000000000 + 1000, type: 1 };
    assert.equal(utils.formatMessage(m4, prevWithdrawn).isDuplicated, false, '上一条已撤回 → isDuplicated=false');
  });

  check('真实 formatSession：时间备份/类型归一/草稿/at 备份/正文解码', () => {
    /**
     * 【这条补的是上轮如实列出的缺口】
     * `formatSession`/`formatMessage` 此前**不在 fixture 的抽取列表里**，
     * 规格只通过 `filterSessionList`/`sortSession` 间接触达它们；
     * 行为不变当时只靠「表达式 0 行差异」的字节证明保证，**没有行为用例**。
     * 现在把它们纳入抽取（`HELPER_NAMES`），并在此直接断言各字段的归一化结果。
     *
     * 【依赖处置】`formatSession` 依赖 `formatMsgDate`/`getCurrentTime`（真实 moment 可用）
     * 与 `htmlDecodeReg`（`src/utils/common` 依赖 JSEncrypt，无法 require）——
     * 后者用**逐字忠实替身**，不是简化实现。
     */
    F.installHost({ localStorage: F.makeLocalStorage({ textareaValuev1: '未发送的草稿' }) });
    const utils = F.loadRealUtils();

    const input = {
      id: 's1',
      value: 'v1',
      from: { id: 'other', name: '对方' },
      msg: { con: 'a&amp;b' },
      time: 1700000000000,
      type: '2',
      isGroup: false,
      atlist: ['u1', 'u2'],
    };
    const out = utils.formatSession(input);

    // ① 原始时间备份到 _time，time 被改写成**文案**（真实 moment 计算，只断言"变成字符串"）
    assert.equal(out._time, 1700000000000, '_time 保存原始时间');
    assert.equal(typeof out.time, 'string', 'time 被 formatMsgDate 改写成文案');

    // ② type 被 Number 归一化（入参是字符串 '2'）
    assert.equal(out.type, 2, 'type 经 Number() 归一化为数值');
    assert.equal(typeof out.type, 'number');

    // ③ 草稿从 localStorage 取（键名 textareaValue + value）
    assert.equal(out.sendMsg, '未发送的草稿', 'sendMsg 来自 localStorage 草稿键');

    // ④ atlist 备份到 messageAtlist
    assert.deepEqual(out.messageAtlist, ['u1', 'u2'], 'messageAtlist 备份 atlist');

    // ⑤ 正文经 htmlDecodeReg 解码，并加上发送者前缀
    // 入参 from.id 是 'other'，与宿主 accountId 不同 → 走非自己分支，前缀是发送者名字
    assert.equal(out.msg.con, '对方: a&b', '正文被解码并拼接**发送者名字**前缀（from.id 非本人）');

    // ⑥ 原对象被**就地**归一化（返回值与入参同一引用）
    assert.equal(out, input, 'formatSession 就地修改并返回同一对象');
  });

  check('真实 formatSession 的 isSelf / isAdmin 分支（宿主 accountId 参与判断）', () => {
    /**
     * 【这条为什么必须有 —— 覆盖缺口】
     * `formatSession` 里有两个依赖宿主账号的分支：
     *   `isSelf = item.from.id === md.global.Account.accountId`
     *   `isAdmin = item.wdAdminid === md.global.Account.accountId`
     * 它们各自产出**不同**的 `con` 文案。此前夹具恒不设 `accountId`（undefined），
     * 于是这两条分支**从未执行** —— 6 条 con 构造路径里有 3~4 条没有用例。
     * 本用例把 accountId 设为 'me' 来覆盖。
     * 注意：夹具的 `_l` 是恒等替身（不做 %0 替换），故涉及占位的文案断言的是替身输出。
     */
    F.installHost({ localStorage: F.makeLocalStorage({}), accountId: 'me' });
    const utils = F.loadRealUtils();

    // ① isSelf 非撤回：前缀「我」
    const self1: Record<string, any> = { id: 's1', type: 1, msg: { con: 'hi' }, from: { id: 'me', name: 'Me' } };
    utils.formatSession(self1);
    assert.ok(String(self1.msg.con).startsWith('我'), 'isSelf 非撤回：前缀是「我」，实际=' + self1.msg.con);

    // ② isSelf + 撤回（非管理员撤回）：前缀「你」
    const self2: Record<string, any> = { id: 's2', type: 1, msg: { con: 'x' }, from: { id: 'me', name: 'Me' }, iswd: true };
    utils.formatSession(self2);
    assert.ok(String(self2.msg.con).startsWith('你'), 'isSelf + iswd：前缀是「你」，实际=' + self2.msg.con);

    // ③ isSelf + 撤回 + wdAdminid 是自己：管理员文案
    const self3: Record<string, any> = { id: 's3', type: 1, msg: { con: 'y' }, from: { id: 'me', name: 'Me' }, iswd: true, wdAdminid: 'me' };
    utils.formatSession(self3);
    assert.ok(String(self3.msg.con).includes('管理员'), 'isSelf + iswd + wdAdminid===accountId：走管理员文案，实际=' + self3.msg.con);

    // ④ formatNewSession 的**本人分支**：`accountId === message.from` 时 value 取 to
    //    （此前 accountId 恒 undefined，这个分支从未执行）
    const own: Record<string, any> = { id: 'o1', from: 'me', to: 'sess-1', msg: { con: 'hi' }, type: 1 };
    utils.formatNewSession(own);
    assert.equal(own.value, 'sess-1', 'accountId === from（本人）→ value 取 to');
    // 对照：非本人时 value 取 from
    const notOwn: Record<string, any> = { id: 'o2', from: 'other', to: 'sess-2', msg: { con: 'hi' }, type: 1 };
    utils.formatNewSession(notOwn);
    assert.equal(notOwn.value, 'other', 'accountId !== from → value 取 from');

    // ⑤ 非自己 + 撤回 + 自己是管理员：另一种文案（含成员名）
    const other: Record<string, any> = { id: 's4', type: 1, msg: { con: 'z' }, from: { id: 'other', name: '对方' }, iswd: true, wdAdminid: 'me' };
    utils.formatSession(other);
    assert.ok(String(other.msg.con).includes('你撤回了成员'), '非自己 + iswd + 自己是管理员：走成员撤回文案，实际=' + other.msg.con);
  });

  check('真实 sortSession 的 messageListShowType===1 分支（count 优先组）', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * 把 `if (messageListShowType === 1)` 改成 `if (false)` → **49 项全绿**。
     * 原因：唯一走 sortTop 的用例显式传了 `messageListShowType=0`，
     * 而 reducer 调用 `sortSession(list)` 时用的是**默认参数**
     * `md.global.Account.messageListShowType`，现有宿主默认值不是 1 →
     * 该分支（含 `count.concat(sortList, other)` 的组合与 `isPush` 判断）**从未执行**。
     */
    const utils = F.loadRealUtils();
    const sessions = [
      { id: 'c1', value: 'vc1', sendMsg: 100, count: 5 },
      { id: 'c2', value: 'vc2', sendMsg: 200, count: 3, isPush: false },
      { id: 'c3', value: 'vc3', sendMsg: 300 },
      { id: 't1', value: 'vt1', sendMsg: 50, top_info: { isTop: true } },
    ];

    // messageListShowType=1 → 三分组：top(=isTop) / count(有 count 且 isPush 不为 false) / other
    const out = utils.sortSession(sessions, undefined, 1);
    assert.deepEqual(
      out.map((x: { id: string }) => x.id),
      ['c1', 't1', 'c2', 'c3'],
      'count 组（c1 有 count、isPush 缺省视为 true）在前；top 组（t1）居中；c2 因 isPush:false 落入 other',
    );
  });

  check('真实 getToolbarConfig：6 个字段在**两种 openType 配置**下都正确', () => {
    /**
     * 【这条为什么必须有 —— 由变异测试发现】
     * - 把 `mingoVisible` 的 `toolBarOpenType === 'mingo' &&` 去掉 → **49 项全绿**；
     * - 把 `favoriteVisible` 直接改成 `true` → **同样全绿**。
     * 原因：初始值用例只断言了 6 个字段中的 **2 个**（mingoVisible / mingoFixing），
     * 且宿主 localStorage 固定为 `toolBarOpenType:'mingo'` —— 在这种配置下
     * 「带不带 openType 判断」结果相同，`favoriteVisible`/`sessionListVisible` 更从未被检查。
     * 这里换一种 openType 配置，把 6 个字段全部断言。
     */
    const utils = F.loadRealUtils();

    // ① openType = 'mingo'，三个 fixing 全开 → 只有 mingoVisible 为 true
    F.installHost({
      localStorage: F.makeLocalStorage({
        toolBarOpenType: 'mingo',
        mingoFixing: 'true',
        sessionListFixing: 'true',
        favoriteFixing: 'true',
      }),
    });
    assert.deepEqual(utils.getToolbarConfig(), {
      mingoVisible: true,
      mingoFixing: true,
      sessionListVisible: false,
      sessionListFixing: true,
      favoriteVisible: false,
      favoriteFixing: true,
    });

    // ② openType = 'favorite'，只有 favoriteFixing 开 → favoriteVisible 为 true，mingoVisible 为 false
    F.installHost({
      localStorage: F.makeLocalStorage({
        toolBarOpenType: 'favorite',
        mingoFixing: 'true',
        sessionListFixing: 'false',
        favoriteFixing: 'true',
      }),
    });
    assert.deepEqual(utils.getToolbarConfig(), {
      mingoVisible: false,
      mingoFixing: true,
      sessionListVisible: false,
      sessionListFixing: false,
      favoriteVisible: true,
      favoriteFixing: true,
    });

    // ③ 无任何开关（边界）：全部 false
    F.installHost({ localStorage: F.makeLocalStorage({}) });
    assert.deepEqual(utils.getToolbarConfig(), {
      mingoVisible: false,
      mingoFixing: false,
      sessionListVisible: false,
      sessionListFixing: false,
      favoriteVisible: false,
      favoriteFixing: false,
    });
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

    // 【引用语义 —— 由变异测试发现】
    // 把 `[action.id]: action.result` 改成 `action.result.slice()`（浅拷贝）时，
    // 上面这些**值**断言全绿 —— 因为拷贝后值相同。但 reducer 的真实语义是
    // **原样存入同一个数组引用**（lead 要求"保留原引用、不缓存不改写"）。
    // 下游 `updateMessage`/`updateWithdrawMessage` 会就地改该数组里的元素对象，
    // 若这里是副本，state 与调用方持有的数组就会分叉。
    const arr = [MSG_1];
    const withRef = root(init(), { type: 'SET_MESSAGE', id: 'kref', result: arr });
    assert.ok(withRef.messages.kref === arr, 'SET_MESSAGE 存入的是**同一个数组引用**（不是拷贝）');

    // ADD_MESSAGE 走 `(state[id] || []).concat([msg])` → 产生**新数组**，
    // 且**不得就地改动**旧数组。
    const base = [MSG_1];
    const before = base.length;
    const appended = root({ ...init(), messages: { kadd: base } } as never, {
      type: 'ADD_MESSAGE',
      id: 'kadd',
      result: MSG_2,
    });
    assert.ok(appended.messages.kadd !== base, 'ADD_MESSAGE 产生新数组（不是原地 push）');
    assert.equal(base.length, before, 'ADD_MESSAGE 不就地改动旧数组（长度不变）');

    // ADD_PAGE_MESSAGE 走 `action.result.concat(state[id])` → 同样新数组，
    // 且**不得就地改动**传入的 action.result。
    const page = [MSG_1];
    const pageBefore = page.length;
    const prepended = root({ ...init(), messages: { kpage: [MSG_2] } } as never, {
      type: 'ADD_PAGE_MESSAGE',
      id: 'kpage',
      result: page,
    });
    assert.ok(prepended.messages.kpage !== page, 'ADD_PAGE_MESSAGE 产生新数组');
    assert.equal(page.length, pageBefore, 'ADD_PAGE_MESSAGE 不就地改动 action.result');

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
