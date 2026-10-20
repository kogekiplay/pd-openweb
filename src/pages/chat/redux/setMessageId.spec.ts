/**
 * `src/pages/chat/redux/reducers.ts` 的 **SET_MESSAGE id 合同**行为规格
 * （持续目标·lead 13:44 复核反例的闭合证据）。
 *
 * 【为什么这样测】lead 在固定源码里用真实 `sendMessage → actions.updateMessage → 真实 reducer`
 * 复现：原始 ack 自有 `to: undefined`（或 getter 返回 undefined）时，`SET_MESSAGE` 动作的 `id`
 * **确有自有键且值为 undefined**，reducer 按原生属性键语义把它存成字符串键 `"undefined"`。
 * 本 spec 从**真实源码**抽出 `messages` 这个真实 slice 函数执行（不复制 reducer），锁住：
 *   · `id: undefined` → 存成键 `"undefined"`（不是丢弃、不是兜底成别的键）；
 *   · `id: 'k1'` → 正常键；
 *   · 存入的就是传入的数组**引用**；返回新对象、输入 state 不被就地改写。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/redux/reducers.ts';

interface Msg {
  id?: string;
}

type MessagesSlice = (
  state: Record<string, (Msg | undefined)[] | undefined> | undefined,
  action: { type: string; id?: string | undefined; result?: unknown; [key: string]: unknown },
) => Record<string, (Msg | undefined)[] | undefined>;

function extractMessagesSlice(): (
  lodash: unknown,
  utilsStub: unknown,
  constant: unknown,
  requireStub: (name: string) => unknown,
) => MessagesSlice {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'messages') {
      const init = node.init;
      if (init && typeof init.start === 'number' && typeof init.end === 'number') {
        found = { start: init.start, end: init.end };
      }
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
  const location = found as { start: number; end: number } | null;
  if (!location) throw new Error(`真实源码里没有找到 messages slice：${TARGET}`);

  const wrapped = `var messages = ${source.slice(location.start, location.end)};`;
  const transformed = harness.transformSync(wrapped, { filename: 'reducers-messages-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换 messages slice');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'utils',
    'Constant',
    'require',
    `${code}\nreturn messages;`,
  ) as (
    lodash: unknown,
    utilsStub: unknown,
    constant: unknown,
    requireStub: (name: string) => unknown,
  ) => MessagesSlice;
}

function makeSlice(): MessagesSlice {
  const create = extractMessagesSlice();
  return create(
    undefined,
    {},
    {},
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('SET_MESSAGE：id undefined → 按原生属性键语义存成键 "undefined"（自有键）', () => {
  const slice = makeSlice();
  const payload: (Msg | undefined)[] = [{ id: 'm1' }];
  const next = slice({}, { type: 'SET_MESSAGE', id: undefined, result: payload });
  assert.equal(Object.prototype.hasOwnProperty.call(next, 'undefined'), true, '键 "undefined" 存在');
  assert.equal(next['undefined'], payload, '存的就是传入数组的同一引用');
  assert.equal('' in next, false, '不会变成空串键');
});

check('SET_MESSAGE：id 为字符串 → 正常键；返回新对象、不就地改写输入', () => {
  const slice = makeSlice();
  const state = { k0: [{ id: 'old' }] };
  const payload: (Msg | undefined)[] = [{ id: 'm2' }];
  const next = slice(state, { type: 'SET_MESSAGE', id: 'k0', result: payload });
  assert.notEqual(next, state, '返回新对象');
  assert.equal(state['k0']![0]!.id, 'old', '输入 state 未被就地改写');
  assert.equal(next['k0'], payload, '引用语义一致');
});

check('SET_MESSAGE：id undefined 不覆盖已有字符串键，键集按原生语义扩展', () => {
  const slice = makeSlice();
  const first = slice({}, { type: 'SET_MESSAGE', id: 'k1', result: [{ id: 'a' }] });
  const second = slice(first, { type: 'SET_MESSAGE', id: undefined, result: [{ id: 'b' }] });
  assert.deepEqual(Object.keys(second).sort(), ['k1', 'undefined']);
  assert.equal(second['k1']![0]!.id, 'a');
  assert.equal(second['undefined']![0]!.id, 'b');
});

function main(): void {
  let passed = 0;
  for (const item of checks) {
    try {
      item.run();
      passed += 1;
      console.log(`  ✓ ${item.name}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}`);
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`chat/SET_MESSAGE 合同行为规格通过：${passed} 项`);
}

main();
