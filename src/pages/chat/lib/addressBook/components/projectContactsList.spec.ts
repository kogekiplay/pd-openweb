/**
 * `src/pages/chat/lib/addressBook/components/ProjectContactsList.tsx` 的行为规格（持续目标·部门树切片）。
 *
 * 【为什么这样测】`ProjectContactList` 是 class 组件，本仓没有 render 测试设施；但它的
 * `updateTreeData` 是部门树的**真实递归逻辑**：展开某个部门拿到新子节点后，把 `subs` 写回
 * 树里对应节点——命中则替换（新对象），未命中的兄弟节点保持**原引用**不动。它决定树刷新时
 * 哪些节点被重建、哪些被复用。本 spec 从**真实源码**抽出该方法执行（不复制、不改产品源码）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  value?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/components/ProjectContactsList.tsx';

interface Node {
  departmentId?: string;
  departmentName?: string;
  subs?: Node[];
  [key: string]: unknown;
}

type UpdateTreeData = (list: Node[], key: string | undefined, subs: Node[]) => Node[];

function extractUpdateTreeData(): UpdateTreeData {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassProperty' &&
      node.key &&
      node.key.name === 'updateTreeData' &&
      node.value &&
      node.value.type === 'ArrowFunctionExpression' &&
      typeof node.value.start === 'number' &&
      typeof node.value.end === 'number'
    ) {
      found = { start: node.value.start as number, end: node.value.end as number };
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
  if (!location) throw new Error(`真实源码里没有找到 updateTreeData：${TARGET}`);

  const wrapped = `var __cls = class {\n  constructor() {\n    this.updateTreeData = ${source.slice(location.start, location.end)};\n  }\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'projectContactsList-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(`${code}\nreturn new __cls().updateTreeData;`) as () => UpdateTreeData;
  return create();
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('顶层命中详情：subs 被写入新对象，源对象不变，兄弟引用不变', () => {
  const update = extractUpdateTreeData();
  const sibling: Node = { departmentId: 'd1' };
  const target: Node = { departmentId: 'd2', departmentName: '研发' };
  const children: Node[] = [{ departmentId: 'c1' }];
  const list = [sibling, target];
  const result = update(list, 'd2', children);
  assert.equal(result.length, 2, '长度不变');
  assert.equal(result[0], sibling, '未命中节点原样返回同一引用');
  assert.notEqual(result[1], target, '命中节点是展开的新对象');
  assert.deepEqual(result[1], { departmentId: 'd2', departmentName: '研发', subs: children }, '写入 subs');
  assert.equal(target.subs, undefined, '源对象未被修改');
});

check('深层递归：嵌套 subs 中命中时，外层节点也被复制（新引用）', () => {
  const update = extractUpdateTreeData();
  const leaf: Node = { departmentId: 'leaf' };
  const mid: Node = { departmentId: 'mid', subs: [leaf] };
  const root: Node = { departmentId: 'root', subs: [mid] };
  const children: Node[] = [{ departmentId: 'new-child' }];
  const result = update([root], 'leaf', children);
  assert.notEqual(result[0], root, '根节点被复制（路径上的节点都要重建）');
  const newMid = result[0]!.subs![0]!;
  assert.notEqual(newMid, mid, '中间节点被复制');
  assert.deepEqual(newMid.subs![0], { departmentId: 'leaf', subs: children }, '叶子节点写入新 subs');
  assert.equal(root.subs![0], mid, '原树结构未被修改');
});

check('未命中：叶子节点保持原引用，但有 subs 的节点会被复制（既有实现总是重算 subs）', () => {
  const update = extractUpdateTreeData();
  const leaf: Node = { departmentId: 'a' };
  const childLeaf: Node = { departmentId: 'b1' };
  const parent: Node = { departmentId: 'b', subs: [childLeaf] };
  const list = [leaf, parent];
  const result = update(list, 'zzz', []);
  assert.notEqual(result, list, 'map 产生新数组');
  assert.equal(result.length, 2);
  assert.equal(result[0], leaf, '无 subs 的叶子节点原样返回同一引用');
  assert.notEqual(result[1], parent, '有 subs 的节点即使未命中也会被复制（subs 递归重建）');
  assert.notEqual(result[1]!.subs, parent.subs, 'subs 数组也是新的');
  assert.equal(result[1]!.subs![0], childLeaf, 'subs 里的叶子保持原引用');
});

check('命中已有 subs 的节点：subs 被新值覆盖（旧 subs 不保留）', () => {
  const update = extractUpdateTreeData();
  const node: Node = { departmentId: 'd1', subs: [{ departmentId: 'old' }] };
  const fresh: Node[] = [{ departmentId: 'fresh' }];
  const result = update([node], 'd1', fresh);
  assert.deepEqual(result[0]!.subs, fresh, '覆盖为新 subs');
  assert.equal(node.subs![0]!.departmentId, 'old', '源对象 subs 未被改写');
});

check('空列表返回空数组', () => {
  const update = extractUpdateTreeData();
  assert.deepEqual(update([], 'd1', []), []);
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
  console.log(`chat/ProjectContactsList 行为规格通过：${passed} 项`);
}

main();
