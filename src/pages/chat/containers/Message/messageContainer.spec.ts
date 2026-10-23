/**
 * `src/pages/chat/containers/Message/index.tsx` 的行为规格（持续目标·消息容器切片）。
 *
 * 【为什么这样测】消息容器把交互落到两个真实流程：
 * - `handleWithdrawMessage`：拼撤回参数（群 `groupid` / 单聊 `touser`、时间；管理员补 `adminid`），
 *   成功回执后**先更新撤回消息、再更新会话列表摘要**；
 * - `handleRetry`：用出站草稿重发，成功后派发 `updateMessage`（含引用/视频与回执展开），
 *   草稿带 `atParam` 时还要补发 `sendShake` 通知。
 * 本 spec 从**真实源码**抽出这两个方法执行（不复制、不改产品源码），socket/actions/md 全用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const { present } = require('../../utils/present.ts') as typeof import('../../utils/present');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/containers/Message/index.tsx';

interface Dispatched {
  action: string;
  args: unknown[];
}

interface WithdrawPayload {
  messageId?: string | number;
  groupid?: string;
  touser?: string;
  time?: string | number;
  adminid?: string;
}

interface SocketStub {
  withdrawCalls: { type: number; param: WithdrawPayload }[];
  sendCalls: { type: number; param: Record<string, unknown> }[];
  shakeCalls: { type: number; param: Record<string, unknown> }[];
}

function extract(): (
  socketStub: SocketStub,
  actionsStub: Record<string, (...args: unknown[]) => unknown>,
  mdStub: { global: { Account: { accountId: string } } },
  utilsStub: { highlightReferMessage: (id: string) => void },
  constantStub: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
  presence: typeof present,
) => (props: Record<string, unknown>, dispatch: (action: unknown) => void) => Record<string, (...args: unknown[]) => unknown> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['handleWithdrawMessage', 'handleRetry'];
  const found: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      typeof node.key.name === 'string' &&
      wanted.includes(node.key.name) &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found[node.key.name] = { start: node.start, end: node.end };
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
  const missing = wanted.filter((name) => !found[name]);
  if (missing.length) throw new Error(`真实源码里没有找到方法：${missing.join(', ')}`);
  const methods = wanted.map((name) => source.slice(found[name]!.start, found[name]!.end)).join('\n');
  const wrapped = `var __cls = class {\n  constructor(props, dispatch) {\n    this.props = Object.assign({}, props, { dispatch });\n    this.dispatch = dispatch;\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'messageContainer-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'socket',
    'actions',
    'md',
    'utils',
    'Constant',
    'present',
    `${code}\nreturn (props, dispatch) => new __cls(props, dispatch);`,
  ) as (
    socketStub: SocketStub,
    actionsStub: Record<string, (...args: unknown[]) => unknown>,
    mdStub: { global: { Account: { accountId: string } } },
    utilsStub: { highlightReferMessage: (id: string) => void },
    constantStub: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
    presence: typeof present,
  ) => (props: Record<string, unknown>, dispatch: (action: unknown) => void) => Record<string, (...args: unknown[]) => unknown>;
}

function makeEnv(): {
  socket: SocketStub;
  actions: Record<string, (...args: unknown[]) => unknown>;
  dispatched: Dispatched[];
  md: { global: { Account: { accountId: string } } };
  create: ReturnType<typeof extract>;
} {
  const dispatched: Dispatched[] = [];
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of ['updateWithdrawMessage', 'updateSessionList', 'setReferMessage', 'updateMessage', 'updateFileMessage']) {
    actions[name] = (...args: unknown[]) => ({ type: name, args });
  }
  const socket: SocketStub = {
    withdrawCalls: [],
    sendCalls: [],
    shakeCalls: [],
  };
  const md = { global: { Account: { accountId: 'me' } } };
  const create = extract();
  return { socket, actions, dispatched, md, create };
}

function buildInstance(
  env: ReturnType<typeof makeEnv>,
  props: Record<string, unknown>,
): Record<string, (...args: unknown[]) => unknown> {
  const socketStub = {
    Message: {
      sendWithdrawMessgae: (type: number, param: WithdrawPayload) => {
        env.socket.withdrawCalls.push({ type, param });
        return Promise.resolve({ socket: { id: 'm1', msg: { con: '撤回后的消息' } } });
      },
      send: (type: number, param: Record<string, unknown>) => {
        env.socket.sendCalls.push({ type, param });
        return Promise.resolve({ id: 'ack-1', socket: { id: 'ack-1', msg: { con: 'x' } } });
      },
      sendShake: (type: number, param: Record<string, unknown>) => {
        env.socket.shakeCalls.push({ type, param });
        return Promise.resolve(undefined);
      },
    },
  };
  const factory = env.create(socketStub as unknown as SocketStub, env.actions, env.md, { highlightReferMessage: () => {} }, { SESSIONTYPE_GROUP: 1, SESSIONTYPE_USER: 2 }, present);
  return factory(props, (action) => {
    const typed = action as { type: string; args?: unknown[] } | undefined;
    env.dispatched.push({ action: typed?.type ?? 'unknown', args: typed?.args ?? [] });
  });
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('handleWithdrawMessage：群聊非管理员 → groupid + 时间，成功后先更新消息再更新会话摘要', async () => {
  const env = makeEnv();
  const instance = buildInstance(env, {
    session: { id: 'g1', isGroup: true, isAdmin: false },
    message: { id: 'm1', to: 'g1', time: '2026-01-01 10:00:00' },
  });
  instance.handleWithdrawMessage();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(env.socket.withdrawCalls.length, 1);
  assert.deepEqual(env.socket.withdrawCalls[0]!.param, {
    messageId: 'm1',
    groupid: 'g1',
    time: '2026-01-01 10:00:00',
  });
  assert.deepEqual(
    env.dispatched.map((item) => item.action),
    ['updateWithdrawMessage', 'updateSessionList'],
    '先撤回消息再更新摘要',
  );
  assert.deepEqual(env.dispatched[1]!.args, [{ id: 'g1', addMsg: '撤回后的消息' }]);
});

check('handleWithdrawMessage：管理员补 adminid；单聊用 touser', async () => {
  const env = makeEnv();
  const instance = buildInstance(env, {
    session: { id: 'u1', isGroup: false, isAdmin: true },
    message: { id: 'm2', to: 'u1', time: 1 },
  });
  instance.handleWithdrawMessage();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(env.socket.withdrawCalls[0]!.param, {
    messageId: 'm2',
    touser: 'u1',
    time: 1,
    adminid: 'me',
  });
});

check('handleRetry：重发草稿并派发 updateMessage（含 to/引用/视频与回执展开）', async () => {
  const env = makeEnv();
  const sendMsg = { waitingid: 'w1', referMessage: { msg: '引用' }, video: { url: 'v' } };
  const instance = buildInstance(env, {
    session: { id: 'g1', isGroup: true },
    message: { id: 'm1', waitingId: 'w1', sendMsg },
  });
  instance.handleRetry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(env.socket.sendCalls.length, 1);
  assert.equal(env.socket.sendCalls[0]!.type, 1, '群聊 type');
  assert.notEqual(env.socket.sendCalls[0]!.param, sendMsg, '传输副本保护原草稿');
  assert.deepEqual(env.socket.sendCalls[0]!.param, sendMsg, '副本内容一致');
  assert.deepEqual(sendMsg, { waitingid: 'w1', referMessage: { msg: '引用' }, video: { url: 'v' } }, '原草稿保持不变');
  assert.equal(env.socket.sendCalls[0]!.param['referMessage'], sendMsg.referMessage, '嵌套引用保持');
  assert.equal(env.socket.sendCalls[0]!.param['video'], sendMsg.video, '视频引用保持');
  const actions = env.dispatched.map((item) => item.action);
  assert.deepEqual(actions, ['updateMessage']);
  const payload = env.dispatched[0]!.args[0] as Record<string, unknown>;
  assert.equal(payload.to, 'g1');
  assert.deepEqual(payload.referMessage, { msg: '引用' });
  assert.deepEqual(payload.video, { url: 'v' });
  assert.equal(payload.id, 'ack-1', '回执字段展开覆盖');
});

check('handleRetry：草稿带 atParam 时补发 sendShake（群聊 + messageId=回执 id）', async () => {
  const env = makeEnv();
  const instance = buildInstance(env, {
    session: { id: 'g1', isGroup: true },
    message: { id: 'm1', waitingId: 'w1', sendMsg: { waitingid: 'w1', atParam: { atlist: ['a'] } } },
  });
  instance.handleRetry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(env.socket.shakeCalls, [{ type: 1, param: { atlist: ['a'], messageId: 'ack-1' } }]);
});

check('handleRetry：没有 atParam 时不补发 sendShake', async () => {
  const env = makeEnv();
  const instance = buildInstance(env, {
    session: { id: 'u1', isGroup: false },
    message: { id: 'm1', sendMsg: { waitingid: 'w2', atParam: false } },
  });
  instance.handleRetry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(env.socket.shakeCalls, []);
});

check('handleRetry：单聊 type 与群聊不同', async () => {
  const env = makeEnv();
  const instance = buildInstance(env, {
    session: { id: 'u1', isGroup: false },
    message: { id: 'm1', sendMsg: { waitingid: 'w3' } },
  });
  instance.handleRetry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(env.socket.sendCalls[0]!.type, 2, '单聊 type');
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
  console.log(`chat/MessageContainer 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
