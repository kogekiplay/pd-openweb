/**
 * `src/pages/chat/containers/MessageView/index.tsx` 的行为规格（持续目标·消息加载切片）。
 *
 * 【为什么这样测】`MessageView` 是 React class 组件，本仓没有 render 测试设施；但它的
 * `getMessage` 是分页加载的**真实异步逻辑**：首次 `setState(loading/direction/errorParam)`、
 * 成功后按 `MSG_LENGTH_MORE` 阈值算 `isMore` 并 `resolve`、失败走 `catch` 只置 `errorParam`、
 * 以及 `ajax.getMessage` 落空返回 undefined 时**保留原生 TypeError**（由 `!` 擦除标记表达）。
 * 本 spec 从**真实源码**抽出该方法体后执行（不复制、不改产品源码），`ajax`/`config` 由参数注入。
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
  body?: { body?: BabelNode[] } | null;
}

const TARGET = 'src/pages/chat/containers/MessageView/index.tsx';

interface SetStateCall {
  [key: string]: unknown;
}

interface StateCall {
  loading?: boolean;
  errorParam?: unknown;
  direction?: string;
  isMore?: boolean;
}

interface MessageStub {
  length: number;
}

interface AjaxStub {
  getMessage(param: unknown): Promise<MessageStub[]> | undefined;
}

/**
 * 从真实源码抽出 `getMessage` 方法，做成"类 + setState 记录器 + 注入 ajax/config"的可执行为象。
 * 返回一个 runner：传入 ajax 与 config 后得到可调用的 getMessage 与 setState 记录。
 */
function extractGetMessage(): {
  run: (ajax: AjaxStub, config: { MSG_LENGTH_MORE: number }) => {
    getMessage: (param: unknown, direction: string) => Promise<MessageStub[]>;
    states: StateCall[];
  };
} {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let method: { start: number; end: number } | null = null;
  for (const statement of ast.program.body) {
    if (statement.type !== 'ClassDeclaration' || !statement.body || !statement.body.body) continue;
    for (const member of statement.body.body) {
      if (member.type !== 'ClassMethod' || !member.key || member.key.name !== 'getMessage') continue;
      if (typeof member.start !== 'number' || typeof member.end !== 'number') continue;
      method = { start: member.start, end: member.end };
    }
  }
  if (!method) throw new Error(`真实源码里没有找到 getMessage：${TARGET}`);

  const methodSource = source.slice(method.start, method.end);
  const wrapped = `var __cls = class {\n  constructor() { this.states = []; }\n  setState(partial) { this.states.push(partial); }\n${methodSource}\n  __states() { return this.states; }\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'messageView-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function('ajax', 'config', `${code}\nreturn __cls;`) as (
    ajax: AjaxStub,
    config: { MSG_LENGTH_MORE: number },
  ) => new () => { getMessage: (param: unknown, direction: string) => Promise<MessageStub[]>; __states: () => StateCall[] };

  return {
    run(ajax, config) {
      const instance = new (create(ajax, config))();
      return {
        getMessage: (param: unknown, direction: string) => instance.getMessage(param, direction),
        states: instance.__states(),
      };
    },
  };
}

const checks: { name: string; run: () => Promise<void> }[] = [];
function check(name: string, run: () => Promise<void>): void {
  checks.push({ name, run });
}

function messagesOf(count: number): MessageStub[] {
  return Array.from({ length: count }, () => ({}) as MessageStub);
}

check('getMessage：成功时先把 loading 置真，再按阈值算出 isMore 并 resolve 原数组', async () => {
  const messages = messagesOf(25);
  const { run } = extractGetMessage();
  const { getMessage, states } = run({ getMessage: () => Promise.resolve(messages) }, { MSG_LENGTH_MORE: 20 });
  const param = { type: 1, id: 's1', num: 20 };
  const result = await getMessage(param, 'up');
  assert.equal(result, messages, 'resolve 的是 ajax 返回的**同一个数组**（不复制）');
  assert.deepEqual(states, [
    { loading: true, errorParam: false, direction: 'up' },
    { loading: false, isMore: true },
  ]);
});

check('getMessage：结果条数 < MSG_LENGTH_MORE 时 isMore 为 false', async () => {
  const { run } = extractGetMessage();
  const { getMessage, states } = run({ getMessage: () => Promise.resolve(messagesOf(19)) }, { MSG_LENGTH_MORE: 20 });
  await getMessage({ type: 1 }, 'up');
  assert.deepEqual(states[1], { loading: false, isMore: false });
});

check('getMessage：恰好等于阈值时 isMore 为 true（`<(小于)` 而非 `<=`）', async () => {
  const { run } = extractGetMessage();
  const { getMessage, states } = run({ getMessage: () => Promise.resolve(messagesOf(20)) }, { MSG_LENGTH_MORE: 20 });
  await getMessage({ type: 1 }, 'up');
  assert.deepEqual(states[1], { loading: false, isMore: true });
});

check('getMessage：方向与入参对象原样透传（不复制 param）', async () => {
  const seen: unknown[] = [];
  const param = { type: 2, id: 'group1' };
  const { run } = extractGetMessage();
  const { getMessage, states } = run(
    {
      getMessage: (received: unknown) => {
        seen.push(received);
        return Promise.resolve(messagesOf(5));
      },
    },
    { MSG_LENGTH_MORE: 20 },
  );
  await getMessage(param, 'down');
  assert.equal(seen[0], param, 'ajax 收到的是**同一个** param 对象');
  assert.deepEqual(states[0], { loading: true, errorParam: false, direction: 'down' });
});

check('getMessage：ajax 落空返回 undefined 时保留原生 TypeError（Promise 以 TypeError reject）', async () => {
  const { run } = extractGetMessage();
  const { getMessage, states } = run({ getMessage: () => undefined }, { MSG_LENGTH_MORE: 20 });
  await assert.rejects(getMessage({ type: 1 }, 'up'), TypeError, '`.then` 对 undefined 取属性抛原生 TypeError');
  // 只有首个 setState 生效（异常发生在 `!` 表达式处，与基线一致）
  assert.equal(states.length, 1);
});

check('getMessage：ajax 失败时只记 errorParam，Promise 保持 pending（不强行结算）', async () => {
  const { run } = extractGetMessage();
  const param = { type: 1, id: 'boom' };
  const { getMessage, states } = run({ getMessage: () => Promise.reject(new Error('network')) }, { MSG_LENGTH_MORE: 20 });
  const promise = getMessage(param, 'up');
  // 让 catch 先跑完
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(states[1], { errorParam: param }, '失败只把入参记进 errorParam');
  const marker = Symbol('pending');
  const raced = await Promise.race([promise.then(() => 'settled', () => 'settled'), Promise.resolve(marker)]);
  assert.equal(raced, marker, '失败后 Promise 不结算（与原实现一致，重试由调用方触发）');
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
  console.log(`chat/MessageView 行为规格通过：${passed} 项`);
}

void main();
