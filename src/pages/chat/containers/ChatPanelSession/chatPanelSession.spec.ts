/**
 * `src/pages/chat/containers/ChatPanelSession/index.tsx` 的行为规格（持续目标·会话输入切片）。
 *
 * 【为什么这样测】`ChatPanelSession` 是 React class 组件，本仓没有 render 测试设施；但它的
 * `jointMessageText` 是表情插入光标的**纯逻辑**（只读写 `window.currentCursortPosition` 与传入字符串），
 * 决定表情插入位置与新的光标位置。本 spec 用 `spec-harness` 从**真实源码**抽出该方法体后执行
 * （不复制、不改产品源码）。组件渲染/发送链路不在本 spec 覆盖范围（见固定报告的未覆盖面）。
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

const TARGET = 'src/pages/chat/containers/ChatPanelSession/index.tsx';

interface WindowStub {
  currentCursortPosition: number;
}

interface JointResult {
  length: number;
  msg: string;
}

function extractJointMessageText(): (this: unknown, value: string, emotionText: string) => JointResult {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let method: { start: number; end: number } | null = null;
  for (const statement of ast.program.body) {
    if (statement.type !== 'ClassDeclaration' || !statement.body || !statement.body.body) continue;
    for (const member of statement.body.body) {
      if (member.type !== 'ClassMethod' || !member.key || member.key.name !== 'jointMessageText') continue;
      if (typeof member.start !== 'number' || typeof member.end !== 'number') continue;
      method = { start: member.start, end: member.end };
    }
  }
  if (!method) throw new Error(`真实源码里没有找到 jointMessageText：${TARGET}`);

  const methodSource = source.slice(method.start, method.end);
  // 方法体是 TypeScript，先经 spec-harness 的 babel 管线剥类型；`window` 由参数注入。
  const wrapped = `var __cls = class { ${methodSource}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'chatPanelSession-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function('window', `${code}\nreturn (value, emotionText) => new __cls().jointMessageText(value, emotionText);`) as (
    w: WindowStub,
  ) => (value: string, emotionText: string) => JointResult;
  return create as unknown as (this: unknown, value: string, emotionText: string) => JointResult;
}

function makeJoiner(position: number): { join: (value: string, emotionText: string) => JointResult; window: WindowStub } {
  const factory = extractJointMessageText() as unknown as (
    w: WindowStub,
  ) => (value: string, emotionText: string) => JointResult;
  const window: WindowStub = { currentCursortPosition: position };
  return { join: factory(window), window };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('jointMessageText：在开头插入表情 → 结果与新的光标位置', () => {
  const { join, window } = makeJoiner(0);
  const result = join('hello', '[em]');
  assert.deepEqual(result, { msg: '[em]hello', length: 4 }, '开头插入：msg 前置、length = 0 + 表情长度');
  assert.equal(window.currentCursortPosition, 4, '光标推进到插入后的位置（原地写回 window）');
});

check('jointMessageText：在中间插入表情 → 前后两段保持原样', () => {
  const { join, window } = makeJoiner(3);
  const result = join('abcdef', 'XY');
  assert.deepEqual(result, { msg: 'abcXYdef', length: 5 }, '中间插入：abc + XY + def');
  assert.equal(window.currentCursortPosition, 5);
});

check('jointMessageText：在末尾插入 → 等价于追加', () => {
  const { join, window } = makeJoiner(6);
  const result = join('abcdef', 'XY');
  assert.deepEqual(result, { msg: 'abcdefXY', length: 8 });
  assert.equal(window.currentCursortPosition, 8);
});

check('jointMessageText：光标位置超过文本长度时 slice 语义不变（整段作为 start）', () => {
  const { join } = makeJoiner(9);
  const result = join('abc', 'Z');
  assert.deepEqual(result, { msg: 'abcZ', length: 4 }, 'start 为整段、end 为空');
});

check('jointMessageText：空文本 / 空表情的边界', () => {
  const empty = makeJoiner(0);
  assert.deepEqual(empty.join('', 'X'), { msg: 'X', length: 1 });
  const none = makeJoiner(2);
  assert.deepEqual(none.join('abcd', ''), { msg: 'abcd', length: 2 }, '空表情：msg 不变、length 仍是 start 长度');
});

check('jointMessageText：返回**新对象**，且只含 msg/length 两个键', () => {
  const { join } = makeJoiner(1);
  const first = join('ab', '_');
  const second = join('ab', '_');
  assert.notEqual(first, second, '每次调用返回新对象');
  assert.deepEqual(Object.keys(first).sort(), ['length', 'msg'], '只含约定的两个键');
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
  console.log(`chat/ChatPanelSession 行为规格通过：${passed} 项`);
}

main();
