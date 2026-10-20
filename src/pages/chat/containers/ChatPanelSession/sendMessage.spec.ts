/**
 * `src/pages/chat/containers/ChatPanelSession/index.tsx` 的**发送链路**行为规格
 * （持续目标·raw send ack → Redux 输入的真实消费端，lead 13:21 复核反例的闭合证据）。
 *
 * 【为什么这样测】lead 在固定提交里抽取并执行了真实 `ChatPanelSession.sendMessage`，用本地 IM
 * 记录桩发现：一份**合法**的原始 ack 只要自有 `to: undefined`（或 `to` getter 返回 undefined），
 * `{to: 会话id, ...ack}` 就会把收件人覆盖成 undefined；旧的 `Omit` 桥接却声明必为 string。
 *
 * 本 spec 同样从**真实源码**抽出 `sendMessage` 方法体执行，并载入**真实 `socket.Message.send`**
 * （只把宿主 `IM.socket.emit` 换成记录桩，绝不连接网络/发消息）；Redux actions 用记录桩捕获
 * 它收到的**最终输入对象**。覆盖：
 *   · ack 无 to → 注入的会话 id 保留；
 *   · ack 自有 `to: undefined` → 如实覆盖成 undefined（不补默认值、不删除键）；
 *   · ack 的 `to` 是返回 undefined 的 getter → 覆盖成 undefined；
 *   · 失败 ack `{error:'not my contract'}` → 真实失败分支派发的 updateMessage / updateSessionList；
 *   · dispatch 顺序与 `{to, referMessage, ...ack}` 的原展开顺序不变。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/containers/ChatPanelSession/index.tsx';

interface EmitCall {
  event: string;
  payload: unknown;
  ack: ((...args: unknown[]) => void) | undefined;
}

/** 独立宿主：只记录本地 emit，不连接真实 socket、不发送任何消息 */
const emitCalls: EmitCall[] = [];
Reflect.set(globalThis, 'IM', {
  socket: {
    emit(event: string, payload: unknown, ack?: (...args: unknown[]) => void): void {
      emitCalls.push({ event, payload, ack });
    },
  },
});
// `constant.ts` 在模块顶层调用 `_l(...)`，require 之前就位
Reflect.set(globalThis, '_l', (key: string, ...args: (string | number)[]) => {
  let out = String(key);
  args.forEach((arg, index) => {
    out = out.replace(`%${index}`, String(arg));
  });
  return out;
});

interface SocketLike {
  Message: {
    send: (type: number, param: Record<string, unknown>) => Promise<Record<string, unknown>>;
    sendShake: (type: number, param: Record<string, unknown>) => void;
  };
}

interface Instance {
  props: Record<string, unknown>;
}

interface ActionRecord {
  name: string;
  payload: Record<string, unknown> | undefined;
}

/** 从真实源码抽出 sendMessage（按同名模块级绑定注入 socket/actions/Constant/utils） */
function extractSendMessage(): (
  socketMod: SocketLike,
  actions: Record<string, (...args: unknown[]) => unknown>,
  constant: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
  utils: { getUUID: () => string },
  requireStub: (name: string) => unknown,
) => (instance: Instance) => void {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      node.key.name === 'sendMessage' &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found = { start: node.start, end: node.end };
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) visit(child as BabelNode);
      } else if (value && typeof value === 'object' && typeof (value as BabelNode).type === 'string') {
        visit(value as BabelNode);
      }
    }
  };
  visit(ast.program as unknown as BabelNode);
  if (!found) throw new Error(`真实源码里没有找到 sendMessage：${TARGET}`);
  const method = source.slice((found as { start: number }).start, (found as { end: number }).end);

  const wrapped = `var __cls = class {\n  constructor(props, setState, getAtParam) {\n    this.props = props;\n    this.setState = setState;\n    this.getAtParam = getAtParam;\n  }\n${method}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'chatPanelSession-send-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'socket',
    'actions',
    'Constant',
    'utils',
    'require',
    `${code}\nreturn (instance) => new __cls(instance.props, instance.props.setState, () => false).sendMessage({ msg: 'hi' });`,
  ) as (
    socketMod: SocketLike,
    actions: Record<string, (...args: unknown[]) => unknown>,
    constant: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
    utils: { getUUID: () => string },
    requireStub: (name: string) => unknown,
  ) => (instance: Instance) => void;
}

// 真实 socket 模块在 utils/ 下：用相对本文件的路径动态载入（spec 自包含要求）
const realSocket = require('../../utils/socket.ts') as SocketLike;
const createSend = extractSendMessage();

interface Harness {
  records: ActionRecord[];
  renders: Record<string, unknown>[];
  invoke: () => void;
  /** 调用这条 sendMessage 发出的 ack 回调（成功/失败由调用方决定） */
  ackOfLastEmit: () => (...args: unknown[]) => void;
}

function makeHarness(): Harness {
  emitCalls.length = 0;
  const records: ActionRecord[] = [];
  const renders: Record<string, unknown>[] = [];
  const actionStub: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of ['addMessage', 'updateMessage', 'updateSessionList', 'setReferMessage', 'removeMessage']) {
    // 只构造 action，记录交给 dispatch 桩（与真实链路一致：dispatch 才执行）
    actionStub[name] = (...args: unknown[]) => ({ type: name, args });
  }
  const invoke = createSend(
    realSocket,
    actionStub,
    { SESSIONTYPE_GROUP: 1, SESSIONTYPE_USER: 2 },
    { getUUID: () => 'uuid-1' },
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  const instance: Instance = {
    props: {
      session: { id: 'session-1', isGroup: false },
      messages: {},
      referMessage: {},
      dispatch: (action: unknown) => {
        const typed = action as { type?: string; args?: unknown[] } | undefined;
        records.push({ name: typed?.type ?? 'unknown', payload: typed?.args?.[0] as Record<string, unknown> });
      },
    },
  };
  const setState = (patch: Record<string, unknown>): void => {
    renders.push(patch);
  };
  // 真实方法通过 this.props / this.setState 使用；setState 由 wrapper 注入，这里补进 props 记录旁路
  (instance.props as Record<string, unknown>).setState = setState;
  void renders;
  return {
    records,
    renders,
    invoke: () => invoke(instance),
    ackOfLastEmit: () => {
      const call = emitCalls[emitCalls.length - 1];
      if (!call || typeof call.ack !== 'function') throw new Error('没有捕获到 send message 的 ack 回调');
      return call.ack;
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const checks: { name: string; run: () => Promise<void> }[] = [];
function check(name: string, run: () => Promise<void>): void {
  checks.push({ name, run });
}

function lastRecord(records: ActionRecord[], name: string): Record<string, unknown> | undefined {
  const matched = records.filter((item) => item.name === name);
  return matched[matched.length - 1]?.payload;
}

check('sendMessage：ack 无 to → 最终 Redux 输入保留注入会话 id，dispatch 顺序不变', async () => {
  const h = makeHarness();
  h.invoke();
  h.ackOfLastEmit()(null, { id: 'm' });
  await flush();
  assert.deepEqual(
    h.records.map((item) => item.name),
    ['addMessage', 'updateSessionList', 'updateMessage'],
    '先本地消息/会话摘要，再回执更新',
  );
  const payload = lastRecord(h.records, 'updateMessage')!;
  assert.equal(payload.to, 'session-1', 'ack 缺 to → 展开不覆盖注入值');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'to'), true, '注入的 to 是自有键');
});

check('sendMessage：ack 自有 to: undefined → 最终 Redux 输入如实为 undefined（不补默认值）', async () => {
  const h = makeHarness();
  h.invoke();
  h.ackOfLastEmit()(null, { id: 'm', to: undefined });
  await flush();
  const payload = lastRecord(h.records, 'updateMessage')!;
  assert.equal(payload.to, undefined, '自有 to:undefined 覆盖注入值');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'to'), true, '仍是自有键（被覆盖，不是删除）');
});

check('sendMessage：ack 的 to 是返回 undefined 的 getter → 最终 to 为 undefined', async () => {
  const h = makeHarness();
  h.invoke();
  const ackObject: Record<string, unknown> = { id: 'm' };
  let getterReads = 0;
  Object.defineProperty(ackObject, 'to', {
    enumerable: true,
    get() {
      getterReads += 1;
      return undefined;
    },
  });
  h.ackOfLastEmit()(null, ackObject);
  await flush();
  const payload = lastRecord(h.records, 'updateMessage')!;
  assert.equal(payload.to, undefined, 'getter 返回 undefined → 覆盖成 undefined');
  assert.equal(getterReads, 1, '展开时只读一次 getter');
});

check('sendMessage：失败 ack {error:"not my contract"} → 真实失败分支派发两条更新', async () => {
  const h = makeHarness();
  h.invoke();
  h.ackOfLastEmit()({ error: 'not my contract' }, null);
  await flush();
  const names = h.records.map((item) => item.name);
  assert.ok(names.includes('updateMessage'), '派发 updateMessage');
  assert.ok(names.includes('updateSessionList'), '派发 updateSessionList');
  const updatePayload = lastRecord(h.records, 'updateMessage')!;
  assert.equal(updatePayload.isContact, false, 'updateMessage 带 isContact:false');
  assert.equal(updatePayload.to, 'session-1');
});

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
  console.log(`chat/ChatPanelSession sendMessage 链路规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
