/**
 * `src/pages/chat/utils/socket.ts` 的行为规格（2026-10-20 持续总目标 socket 批次）。
 *
 * 【为什么单独写】socket 层的每个方法与宿主 `IM` 的 `emit`/ack 直接交互，类型收紧要靠
 * **真实运行语义**背出来，不能只看编译：本 spec 用**独立宿主**（只捕获本地 emit 调用与
 * ack 回调，不连真实 socket、不发真实消息），逐项锁住 lead 点名的既有语义：
 *   · `Message.send` 在创建 Promise **之前** `delete param.atParam`（同一对象被原地删）；
 *   · 未知会话 type **没有 emit**，Promise 可以一直 pending；
 *   · `sendWithdrawMessgae` 失败 `reject(data)`，其余相关方法失败 `reject(err)`，不统一；
 *   · `clearUnread` 原地把 3..10 改成通知类型字符串，再执行原有 `<= 2` 比较与 emit 分支，
 *     保留原对象引用/读取与原生错误；
 *   · `clearAllUnread` 的 ack 是**单参数** `data => resolve(data)`（无 err 通道）；
 *   · 同步 emit 抛错时由 Promise 原语把异常转成 reject（不是代码里 catch 的）；
 *   · 重复回调仍遵循 Promise 原语（只结算一次）。
 *
 * 类型正负编译另有独立探针（见报告证据目录），本文件只做**运行期**行为。
 */

import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');

interface EmitCall {
  event: string;
  payload: unknown;
  ack: ((...args: unknown[]) => void) | undefined;
}

/** 独立宿主：只记录本地 emit；可切换为"同步抛错"以验证 Promise 原语 */
const calls: EmitCall[] = [];
let emitError: Error | null = null;

const socketStub = {
  emit(event: string, payload: unknown, ack?: (...args: unknown[]) => void): void {
    calls.push({ event, payload, ack });
    if (emitError) throw emitError;
  },
};

/** 宿主翻译函数：`constant.ts` 在模块顶层就调用 `_l(...)`，必须在 require 之前就位 */
Reflect.set(globalThis, '_l', (key: string, ...args: (string | number)[]) =>
  String(key).replace(/%([0-9]+)/g, (_match: string, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? `%${index}` : String(value);
  }),
);

Reflect.set(globalThis, 'IM', { socket: socketStub });

/**
 * 【为什么用本地接口 + 动态 require】`tsconfig.tools.json` 规定 spec 是**自包含的 Node 脚本**：
 * 它从不静态 import 被测模块（那些模块要 DOM lib / webpack alias，且会拖入产品的全局声明）。
 * 所以这里只声明本 spec 实际用到的方法形状，运行时用 spec-harness 的 require 钩子动态载入。
 */
interface SocketMessageApi {
  send(type: number, param: Record<string, unknown>): Promise<unknown>;
  sendShake(type: number, param: Record<string, unknown>): Promise<unknown>;
  markAudioAsRead(param: { messageId: number | string }): void;
  sendWithdrawMessgae(type: number, param: Record<string, unknown>): Promise<unknown>;
}
interface SocketContactApi {
  clearUnread(param: { type?: number | string; value?: string }): Promise<unknown>;
  clearAllUnread(): Promise<unknown>;
  remove(param: { id?: string; type?: number }): Promise<unknown>;
  setCurrentChat(contact: { value?: string; [key: string]: unknown } | undefined): void;
  recordAction(contact: { id: string | Record<string, unknown>; type?: number }): Promise<unknown>;
  setTop(param: { type: number; value: string; isTop: boolean }): Promise<unknown>;
  setSlience(param: { type: number; AccountID: string; isSilent: boolean }): Promise<unknown>;
}
interface SocketModule {
  Message: SocketMessageApi;
  Contact: SocketContactApi;
  fetchUploadToken(param: unknown): Promise<unknown>;
}
interface ConstantModule {
  default: { SESSIONTYPE_USER: number; SESSIONTYPE_GROUP: number };
}

const socket = require('./socket.ts') as SocketModule;
const Constant = require('./constant.ts') as ConstantModule;

const SESSIONTYPE_USER = Constant.default.SESSIONTYPE_USER;
const SESSIONTYPE_GROUP = Constant.default.SESSIONTYPE_GROUP;

function reset(): void {
  calls.length = 0;
  emitError = null;
}

/** 取上一条 emit 调用（并断言存在） */
function lastCall(): EmitCall {
  const call = calls[calls.length - 1];
  if (!call) throw new Error('没有捕获到 emit 调用');
  return call;
}

function ackOf(call: EmitCall): (...args: unknown[]) => void {
  if (typeof call.ack !== 'function') throw new Error(`事件 ${call.event} 的 ack 不是函数`);
  return call.ack;
}

/** Promise 是否仍未结算（用于"未知 type 不 emit 且可以一直 pending"） */
async function isPending(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const raced = await Promise.race([promise.then(() => 'settled', () => 'settled'), Promise.resolve(marker)]);
  return raced === marker;
}

const checks: { name: string; run: () => void | Promise<void> }[] = [];
function check(name: string, run: () => void | Promise<void>): void {
  checks.push({ name, run });
}

/* ────────────────────────────── Message.send ────────────────────────────── */

check('Message.send：创建 Promise 之前就 delete param.atParam（同一对象、emit 载荷即该对象）', async () => {
  reset();
  const param = { msg: 'hi', atParam: { gid: 'g1', toUser: ['u1'] } };
  const promise = socket.Message.send(SESSIONTYPE_USER, param);
  assert.equal(calls.length, 1, '应恰好 emit 一次');
  assert.equal(lastCall().event, 'send message', '单聊事件名');
  assert.equal(lastCall().payload, param, 'emit 的载荷必须是**同一个对象**（引用不变）');
  assert.equal('atParam' in param, false, 'atParam 必须已在 emit 前被 delete');
  ackOf(lastCall())(null, { id: 11 });
  assert.deepEqual(await promise, { id: 11 }, 'ack 成功 → resolve(data)');
});

check('Message.send：群聊事件名 + ack 失败 → reject(err)', async () => {
  reset();
  const promise = socket.Message.send(SESSIONTYPE_GROUP, { msg: 'g' });
  assert.equal(lastCall().event, 'send group message');
  ackOf(lastCall())({ message: 'boom' }, null);
  await assert.rejects(promise, (err: unknown) => JSON.stringify(err) === JSON.stringify({ message: 'boom' }), '失败 ack 的 err 被原样 reject');
});

check('Message.send：未知会话 type 不 emit，Promise 可以一直 pending', async () => {
  reset();
  const promise = socket.Message.send(999, { msg: 'x' });
  assert.equal(calls.length, 0, '未知 type 不应 emit');
  assert.equal(await isPending(promise), true, 'Promise 保持 pending（不是立即 resolve 或 reject）');
});

check('Message.send：ack 重复回调仍只结算一次（Promise 原语）', async () => {
  reset();
  const promise = socket.Message.send(SESSIONTYPE_USER, { msg: 'x' });
  const ack = ackOf(lastCall());
  ack(null, { id: 1 });
  ack(null, { id: 2 });
  assert.deepEqual(await promise, { id: 1 }, '第二次回调被忽略');
});

check('Message.send：同步 emit 抛错 → Promise 原语把异常转成 reject（代码里没有 catch）', async () => {
  reset();
  emitError = new Error('emit boom');
  const promise = socket.Message.send(SESSIONTYPE_USER, { msg: 'x' });
  await assert.rejects(promise, /emit boom/, '同步抛错应成为 reject 原因（new Promise executor 的原语行为）');
});

/* ── Message.send 的**原始成功 ack 合同**（lead 13:09 复核反例的闭合证据） ──
 * 公开类型是 `ChatSendRawAck`（to 可缺省），不是交 Redux 的 `ChatMessageReceiptWire`（to 必填）。
 * 下面的用例直接执行真实实现，锁住：同一对象引用、无自有 to、无条件读 to 抛原生 TypeError、
 * 以及消费方 `{to: 会话id, ...ack}` 的原有展开覆盖顺序。 */

check('Message.send：成功 ack 无 to → 原样返回同一对象、无自有 to，无条件读 to 抛原生 TypeError', async () => {
  reset();
  const promise = socket.Message.send(SESSIONTYPE_USER, { msg: 'hello', type: 1 });
  const ack: { id: string; to?: string } = { id: 'm' };
  ackOf(lastCall())(null, ack);
  const result = (await promise) as { id?: string; to?: string };
  assert.equal(result, ack, '成功时 resolve 的就是服务器 ack 对象本身（引用不变）');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'to'), false, '无自有 to');
  assert.equal('to' in result, false, '`to` 不在对象上');
  assert.equal(result.to, undefined, 'result.to === undefined');
  assert.throws(() => (result.to as unknown as string).toUpperCase(), TypeError, '无条件把 to 当 string 用会抛原生 TypeError（与 lead 反例一致）');
});

check('Message.send：成功 ack 带 to → 原样返回且 to 可读（真实 ack 也带 to 的正例）', async () => {
  reset();
  const promise = socket.Message.send(SESSIONTYPE_GROUP, { msg: 'g' });
  const ack = { id: 'm2', to: 'session-9' };
  ackOf(lastCall())(null, ack);
  const result = (await promise) as { to?: string };
  assert.equal(result, ack, '同一对象');
  assert.equal(result.to, 'session-9');
});

check('Message.send：消费方桥接 `{to: 会话id, ...ack}` 保留原覆盖顺序（无 to 注入生效 / 带 to 覆盖）', async () => {
  reset();
  const sessionId = 'session-1';

  const noTo = socket.Message.send(SESSIONTYPE_USER, { msg: 'a' });
  ackOf(lastCall())(null, { waitingid: 'w1' });
  const rawNoTo = (await noTo) as Record<string, unknown>;
  const bridgedNoTo: Record<string, unknown> = { to: sessionId, waitingid: undefined, ...rawNoTo };
  assert.equal(bridgedNoTo.to, sessionId, 'ack 无 to → 展开不覆盖，保留注入的会话 id');
  assert.equal(bridgedNoTo.waitingid, 'w1', 'ack 的其它字段照常带入');

  const withTo = socket.Message.send(SESSIONTYPE_USER, { msg: 'b' });
  ackOf(lastCall())(null, { to: 'server-session' });
  const rawWithTo = (await withTo) as Record<string, unknown>;
  const bridgedWithTo: Record<string, unknown> = { to: sessionId, ...rawWithTo };
  assert.equal(bridgedWithTo.to, 'server-session', 'ack 带 to → 按展开顺序覆盖注入值');
});

check('Message.send：失败 ack 的 error 边界 → reject 同一对象，消费点读 { error } 得到服务端错误码', async () => {
  reset();
  const promise = socket.Message.send(SESSIONTYPE_USER, { msg: 'x' });
  const failAck = { error: 'not my contract' };
  ackOf(lastCall())(failAck, null);
  const reason = (await promise.then(
    () => {
      throw new Error('不应 resolve');
    },
    (err: unknown) => err,
  )) as { error?: string };
  assert.equal(reason, failAck, '失败时 reject 的也是服务器 ack 对象本身');
  const { error } = reason;
  assert.equal(error, 'not my contract', '消费点按 error 值分支（ChatPanelSession）');
});

/* ────────────────────────────── Message.sendShake ────────────────────────────── */

check('Message.sendShake：单聊/群聊事件名与 ack 结算', async () => {
  reset();
  const p1 = socket.Message.sendShake(SESSIONTYPE_USER, { aid: 's1' });
  assert.equal(lastCall().event, 'shake shake');
  assert.deepEqual(lastCall().payload, { aid: 's1' }, '载荷原样透传');
  ackOf(lastCall())(null, 'ok');
  assert.equal(await p1, 'ok');

  reset();
  const p2 = socket.Message.sendShake(SESSIONTYPE_GROUP, { gid: 'g1', messageId: 5 });
  assert.equal(lastCall().event, 'group shake');
  ackOf(lastCall())({ err: 1 }, null);
  await assert.rejects(p2, '群聊失败同样 reject(err)');
});

/* ────────────────────────────── Message.markAudioAsRead ────────────────────────────── */

check('Message.markAudioAsRead：emit voice as read 且 ack 为无参空函数（无返回值）', () => {
  reset();
  const result = socket.Message.markAudioAsRead({ messageId: 7 });
  assert.equal(result, undefined, '该方法没有返回值');
  assert.equal(lastCall().event, 'voice as read');
  assert.deepEqual(lastCall().payload, { messageId: 7 });
  assert.equal(ackOf(lastCall()).length, 0, 'ack 声明为无参');
});

/* ────────────────────────────── Message.sendWithdrawMessgae ────────────────────────────── */

check('Message.sendWithdrawMessgae：失败 reject(data)（不是 err），成功 resolve(data)', async () => {
  reset();
  const payload = { messageId: 'm1', time: 1700000000000, touser: 'u1' };
  const p1 = socket.Message.sendWithdrawMessgae(SESSIONTYPE_USER, payload);
  assert.equal(lastCall().event, 'withdraw user message');
  const errObj = { code: 1 };
  const dataObj = { socket: { id: 'm1', msg: { con: 'x' } } };
  ackOf(lastCall())(errObj, dataObj);
  await assert.rejects(p1, (err: unknown) => err === dataObj, '失败时 reject 的是 **data**');

  reset();
  const p2 = socket.Message.sendWithdrawMessgae(SESSIONTYPE_GROUP, payload);
  assert.equal(lastCall().event, 'withdraw group message');
  ackOf(lastCall())(null, dataObj);
  assert.equal(await p2, dataObj, '成功 resolve(data)');
});

/* ────────────────────────────── Contact.clearUnread ────────────────────────────── */

check('Contact.clearUnread：type 1/2 保留数字并走 clear unread；原地不改 type', async () => {
  reset();
  const param = { type: 1, value: 's1' };
  const promise = socket.Contact.clearUnread(param);
  assert.equal(lastCall().event, 'clear unread');
  assert.deepEqual(lastCall().payload, { type: 1, id: 's1' }, '载荷 { type, id: value }');
  assert.equal(param.type, 1, '1/2 分支不改写 type');
  ackOf(lastCall())(null, 'done');
  assert.equal(await promise, 'done');
});

check('Contact.clearUnread：type 3..10 **原地**改写成通知类型字符串并走 clear notification', async () => {
  const cases: [number, string][] = [
    [3, 'system'],
    [4, 'post'],
    [5, 'calendar'],
    [6, 'task'],
    [7, 'knowledge'],
    [8, 'hr'],
    [9, 'worksheet'],
    [10, 'workflow'],
  ];
  for (const [input, expected] of cases) {
    reset();
    const param: { type: number | string; value: string } = { type: input, value: 'v' };
    const promise = socket.Contact.clearUnread(param);
    assert.equal(lastCall().event, 'clear notification', `type=${input} 走通知分支`);
    assert.equal(param.type, expected, `**同一对象**被原地改写为 ${expected}`);
    assert.deepEqual(lastCall().payload, { type: expected, value: 0, clear: true }, '载荷 { type, value: 0, clear: true }');
    ackOf(lastCall())(null, 'ok');
    assert.equal(await promise, 'ok');
  }
});

check('Contact.clearUnread：type 缺省 → 无匹配分支，仍走通知分支（原比较语义）', async () => {
  reset();
  const param = { value: 'v' } as { type?: number; value?: string };
  const promise = socket.Contact.clearUnread(param);
  assert.equal(lastCall().event, 'clear notification', 'undefined <= 2 为 false → 通知分支');
  assert.deepEqual(lastCall().payload, { type: undefined, value: 0, clear: true });
  ackOf(lastCall())(null, 1);
  assert.equal(await promise, 1);
});

check('Contact.clearUnread：getter 读取次数与顺序（逐次求值，不缓存）', async () => {
  reset();
  const reads: string[] = [];
  const param = {
    value: 'v',
    get type(): number {
      reads.push('type');
      return 3;
    },
    set type(_: number | string) {
      reads.push('write');
    },
  };
  const promise = socket.Contact.clearUnread(param as never);
  // 观察到的顺序：switch 读一次 → case3 写入一次 → `<= 2` 比较读一次 → emit 载荷构造读一次
  assert.deepEqual(reads, ['type', 'write', 'type', 'type'], '读取/写入次数与顺序被锁死（不缓存 getter）');
  ackOf(lastCall())(null, true);
  assert.equal(await promise, true);
});

check('Contact.clearUnread：ack 失败 → reject(err)', async () => {
  reset();
  const promise = socket.Contact.clearUnread({ type: 1, value: 'v' });
  ackOf(lastCall())({ message: 'nope' }, null);
  await assert.rejects(promise, (err: unknown) => JSON.stringify(err) === JSON.stringify({ message: 'nope' }));
});

/* ────────────────────── 其余 Contact 方法 / fetchUploadToken ────────────────────── */

check('Contact.clearAllUnread：单参数 ack（无 err 通道），emit 载荷为空对象', async () => {
  reset();
  const promise = socket.Contact.clearAllUnread();
  assert.equal(lastCall().event, 'clear all unread');
  assert.deepEqual(lastCall().payload, {}, '载荷为 {}');
  assert.equal(ackOf(lastCall()).length, 1, 'ack 声明为单参数 data');
  ackOf(lastCall())({ ok: 1 });
  assert.deepEqual(await promise, { ok: 1 }, '第一参数即 data');
});

check('Contact.remove：载荷原样透传 + 单参数 ack', async () => {
  reset();
  const param = { id: 's1', type: 1 };
  const promise = socket.Contact.remove(param);
  assert.equal(lastCall().event, 'remove session');
  assert.equal(lastCall().payload, param, '载荷是**同一对象**');
  ackOf(lastCall())('removed');
  assert.equal(await promise, 'removed');
});

check('Contact.setCurrentChat：有 value → current chat 带 id=value；否则 clear chat {}', () => {
  reset();
  const contact = { value: 's1', name: 'S' };
  socket.Contact.setCurrentChat(contact as never);
  assert.equal(lastCall().event, 'current chat');
  const payload = lastCall().payload as Record<string, unknown>;
  assert.equal(payload.id, 's1', 'id = contact.value');
  assert.equal(contact.value, 's1', '**不往入参上写 id**（原实现曾原地改 store）');
  assert.equal('id' in contact, false, '入参对象不应被写入 id');

  reset();
  socket.Contact.setCurrentChat(undefined);
  assert.equal(lastCall().event, 'clear chat');
  assert.deepEqual(lastCall().payload, {});

  reset();
  socket.Contact.setCurrentChat({} as never);
  assert.equal(lastCall().event, 'clear chat', '空对象（无 value）走 clear chat');
});

check('Contact.recordAction：isclose/isopen 由 contact.id 真值决定，contact 原样嵌入载荷', async () => {
  reset();
  const contact = { id: 'g1', type: 2 };
  const promise = socket.Contact.recordAction(contact);
  assert.equal(lastCall().event, 'operate');
  assert.deepEqual(lastCall().payload, { contact: contact, isclose: false, isopen: true }, 'contact 有 id → 打开');
  assert.equal((lastCall().payload as { contact: unknown }).contact, contact, 'contact 是同一对象');
  ackOf(lastCall())('ack');
  assert.equal(await promise, 'ack');

  reset();
  void socket.Contact.recordAction({ id: '' });
  assert.deepEqual(lastCall().payload, { contact: { id: '' }, isclose: true, isopen: false }, 'id 为空 → 关闭');
});

check('Contact.setTop / setSlience：载荷原样透传 + 单参数 ack', async () => {
  reset();
  const top = { type: 1, value: 's1', isTop: true };
  const p1 = socket.Contact.setTop(top);
  assert.equal(lastCall().event, 'sticky on top');
  assert.equal(lastCall().payload, top);
  ackOf(lastCall())('t');
  assert.equal(await p1, 't');

  reset();
  const silence = { type: 1, AccountID: 'a1', isSilent: true };
  const p2 = socket.Contact.setSlience(silence);
  assert.equal(lastCall().event, 'silence message');
  assert.equal(lastCall().payload, silence);
  ackOf(lastCall())('s');
  assert.equal(await p2, 's');
});

check('fetchUploadToken：token+key 齐全 → resolve(data)；否则 reject(data)', async () => {
  reset();
  const p1 = socket.fetchUploadToken({ any: 'payload' });
  assert.equal(lastCall().event, 'upload token');
  ackOf(lastCall())(null, { token: 't', key: 'k' });
  assert.deepEqual(await p1, { token: 't', key: 'k' }, '齐全时 resolve');

  reset();
  const p2 = socket.fetchUploadToken({});
  const data = { token: 't' };
  ackOf(lastCall())(null, data);
  await assert.rejects(p2, (err: unknown) => err === data, '缺 key 时 reject(data)');
});

/* ────────────────────────────── 执行 ────────────────────────────── */

async function main(): Promise<void> {
  let passed = 0;
  for (const item of checks) {
    try {
      await item.run();
      passed += 1;
      console.log(`  ✓ ${item.name}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}`);
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`chat/socket 行为规格通过：${passed} 项`);
}

void main();
