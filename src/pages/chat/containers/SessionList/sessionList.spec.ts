/**
 * `src/pages/chat/containers/SessionList/index.tsx` 的行为规格（2026-10-20 持续目标·会话消费切片）。
 *
 * 【为什么这样测】`SessionList` 是 React class 组件，本仓没有 render 测试设施；但它的
 * `getOffsetData` 是右键菜单定位的**纯函数**，决定菜单往哪一侧弹出。本 spec 用
 * `spec-harness` 从**真实源码**里抽出该函数体后执行（不复制、不改产品源码），把边界与
 * 两侧/上下分支锁死。组件渲染/副作用不在本 spec 覆盖范围（见固定报告的未覆盖面）。
 *
 * 【自包含】`tsconfig.tools.json` 要求 spec 为自包含 Node 脚本：这里不静态 import 产品模块，
 * 由 spec-harness 读源码 + babel parser 抽函数，符合该口径。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  id?: { name?: string } | null;
  declarations?: BabelNode[];
  start?: number | null;
  end?: number | null;
  init?: BabelNode | null;
}

const TARGET = 'src/pages/chat/containers/SessionList/index.tsx';

function extractFactory(name: string): (window: { innerWidth: number; innerHeight: number }) => unknown {
  const source = harness.readSource(TARGET);
  // 产品源码里有 JSX（组件 render），解析必须带 jsx 插件（harness.parser 已强制 typescript）
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as { program: { body: BabelNode[] } };
  let found: { start: number; end: number } | null = null;

  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration' || !statement.declarations) continue;
    for (const declaration of statement.declarations) {
      const id = declaration.id;
      if (!id || id.name !== name) continue;
      if (typeof declaration.start !== 'number' || typeof declaration.end !== 'number') continue;
      // 取 `id = <init>` 中 init 的源码片段（初始化表达式就是函数表达式本身）
      const init = declaration.init;
      if (!init || typeof init.start !== 'number' || typeof init.end !== 'number') continue;
      found = { start: init.start, end: init.end };
    }
  }

  if (!found) throw new Error(`真实源码里没有找到 ${name} 的初始化表达式：${TARGET}`);
  const initSource = source.slice(found.start, found.end);
  // 真实函数体是 TypeScript（带类型注解），先经 spec-harness 的 babel 管线剥离类型，
  // 再交给 Function 执行；`window` 由参数注入（函数只读 innerWidth/innerHeight）。
  const wrapped = `var __payloadFn = ${initSource};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'sessionList-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function('window', `${code}\nreturn __payloadFn;`) as (w: unknown) => unknown;
  return (windowStub) => create(windowStub);
}

interface Offset {
  x?: number;
  y?: number;
  [key: string]: unknown;
}

function makeOffsetter(width: number, height: number) {
  const factory = extractFactory('getOffsetData');
  const fn = factory({ innerWidth: width, innerHeight: height }) as (
    rootW: number,
    rootH: number,
    nativeEvent: { clientX: number; clientY: number },
  ) => Offset;
  assert.equal(typeof fn, 'function', 'getOffsetData 必须被抽成可调用函数');
  return fn;
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('getOffsetData：左上方点击 → 菜单向右下偏移 5px', () => {
  const offset = makeOffsetter(1000, 800)(190, 110, { clientX: 10, clientY: 10 });
  assert.deepEqual(offset, { x: 15, y: 15 }, '右/下分支：clientX+5 / clientY+5');
});

check('getOffsetData：右下方点击 → 菜单向左上偏移（含 rootW/rootH 与 5px）', () => {
  const offset = makeOffsetter(1000, 800)(190, 110, { clientX: 950, clientY: 790 });
  assert.deepEqual(offset, { x: 950 - 190 - 5, y: 790 - 110 - 5 }, '左/上分支：clientX-rootW-5 / clientY-rootH-5');
});

check('getOffsetData：边界值 screenX-clientX === rootW 视为"放不下"，走左侧', () => {
  // right = screenW - clientX > rootW；相等时 right=false → left=true
  const offset = makeOffsetter(1000, 800)(190, 110, { clientX: 810, clientY: 800 - 110 });
  assert.equal(offset.x, 810 - 190 - 5, '相等边界走左分支');
  assert.equal(offset.y, 800 - 110 - 110 - 5, '纵向相等边界走上分支');
});

check('getOffsetData：返回值总含 x/y 两个键（即使某一侧判定为 false 也会被另一侧赋值）', () => {
  const offset = makeOffsetter(1000, 800)(190, 110, { clientX: 500, clientY: 400 });
  assert.deepEqual(Object.keys(offset).sort(), ['x', 'y'], '两个键都存在');
  assert.equal(typeof offset.x, 'number');
  assert.equal(typeof offset.y, 'number');
});

check('getOffsetData：每次调用返回**新对象**（不共享引用）', () => {
  const fn = makeOffsetter(1000, 800);
  const a = fn(190, 110, { clientX: 10, clientY: 10 });
  const b = fn(190, 110, { clientX: 10, clientY: 10 });
  assert.notEqual(a, b, '两次调用不是同一对象');
  assert.deepEqual(a, b, '同样输入得到同样偏移');
});

check('getOffsetData：直接读取传入的 clientX/clientY（不缓存、不改入参）', () => {
  const fn = makeOffsetter(1000, 800);
  const event = { clientX: 100, clientY: 200 };
  const offset = fn(190, 110, event);
  assert.deepEqual(event, { clientX: 100, clientY: 200 }, '入参对象未被修改');
  assert.deepEqual(offset, { x: 105, y: 205 });
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
  console.log(`chat/SessionList 行为规格通过：${passed} 项`);
}

main();
