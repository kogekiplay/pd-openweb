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
 * 【覆盖】（对应 lead 点名的行为面）
 * - 初始值（12 个切片）
 * - `SET/ADD/UPDATE_SESSION_LIST`、`REMOVE_SESSION`、`ADD_SESSION`（`sortSession` 参与）
 * - `Object.assign([], ...)` 的**数组/额外键语义**
 * - `concat` 接**单个值**与**数组**两种载荷
 * - 原过滤/排序**次序**
 * - 消息**分页前后拼接**（`ADD_PAGE_MESSAGE` / `PUSH_PAGE_MESSAGE`）
 * - **缺失会话键**（`REMOVE_MESSAGE` 对不存在的键返回原引用）
 * - **引用返回**（未知 action / 缺键时原引用）
 * - `REMOVE_MESSAGES` / `REMOVE_REFER_MESSAGE` / `REMOVE_GOTO_MESSAGE` /
 *   `REMOVE_BOTTOM_UNREAD_MESSAGE` 的 **先 delete 再浅复制副作用**（如实保留）
 * - `ADD_BOTTOM_UNREAD_MESSAGE` 对**缺键的原失败路径**（不加空数组兜底）
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
    name: 'SET/UPDATE/REMOVE_BOTTOM_UNREAD_MESSAGE',
    steps: [
      { type: 'SET_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_1 },
      { type: 'UPDATE_BOTTOM_UNREAD_MESSAGE', id: 'k1', message: MSG_2 },
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

  check('未知 action：三个开关切片返回原引用', () => {
    const { root, init } = boot('current');
    const s0 = init();
    const next = root(s0, { type: 'UNRELATED_ACTION' });
    assert.equal(next.isWindow, s0.isWindow);
    assert.equal(next.showAddressBook, s0.showAddressBook);
    assert.equal(next.socketState, s0.socketState);
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
