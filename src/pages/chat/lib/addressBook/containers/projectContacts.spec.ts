/**
 * `src/pages/chat/lib/addressBook/containers/ProjectContacts.tsx` 的行为规格（持续目标·通讯录容器切片）。
 *
 * 【为什么这样测】`ProjectContacts` 是 class 组件，本仓没有 render 测试设施；但它依赖的模块级
 * `formatDepartmentData` 是真实数据归一化逻辑：把部门列表转成「departmentId → 折叠面板模型」的
 * 字典，并**追加一个 '未分配部门的联系人' 条目**（departmentId 为 ''）。本 spec 从**真实源码**
 * 抽出该函数执行（不复制、不改产品源码），`_l` 由参数注入。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  id?: { name?: string } | null;
  declarations?: BabelNode[];
  start?: number | null;
  end?: number | null;
  init?: BabelNode | null;
}

const TARGET = 'src/pages/chat/lib/addressBook/containers/ProjectContacts.tsx';

interface DepartmentNode {
  departmentId?: string | undefined;
  departmentName?: string | undefined;
  [key: string]: unknown;
}

interface DepartmentBucket {
  departmentName?: string | undefined;
  departmentId?: string | undefined;
  isOpen: boolean;
  isLoading: boolean;
  list: unknown[];
}

function extractFormatDepartmentData(): (list: DepartmentNode[] | undefined) => Record<string, DepartmentBucket> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let found: { start: number; end: number } | null = null;
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration' || !statement.declarations) continue;
    for (const declaration of statement.declarations) {
      if (!declaration.id || declaration.id.name !== 'formatDepartmentData') continue;
      if (typeof declaration.start !== 'number' || typeof declaration.end !== 'number') continue;
      found = { start: declaration.start, end: declaration.end };
    }
  }
  if (!found) throw new Error(`真实源码里没有找到 formatDepartmentData：${TARGET}`);

  const declarationSource = source.slice(found.start, found.end);
  const wrapped = `${declarationSource}\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'projectContacts-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的声明片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  // 依赖注入：`_`（lodash 的 forEach）+ `_l`（翻译桩，用来标识"未分配部门"那条文案）
  const create = new Function('_', '_l', `${code}\nreturn formatDepartmentData;`) as (
    lodash: { forEach: (collection: unknown, iteratee: (item: DepartmentNode) => void) => void },
    translate: (key: string) => string,
  ) => (list: DepartmentNode[] | undefined) => Record<string, DepartmentBucket>;
  return create(require('lodash'), (key: string) => `[${key}]`);
}

const UNASSIGNED_KEY = '';

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('每个部门生成一个折叠面板模型（默认收起、未加载、空列表）', () => {
  const format = extractFormatDepartmentData();
  const map = format([{ departmentId: 'd1', departmentName: '研发' }]);
  assert.deepEqual(map.d1, {
    departmentName: '研发',
    departmentId: 'd1',
    isOpen: false,
    isLoading: false,
    list: [],
  });
});

check('总会追加「未分配部门的联系人」条目（departmentId 为空串）', () => {
  const format = extractFormatDepartmentData();
  const map = format([{ departmentId: 'd1', departmentName: '研发' }]);
  assert.deepEqual(map[UNASSIGNED_KEY], {
    departmentName: '[未分配部门的联系人]',
    departmentId: '',
    isOpen: false,
    isLoading: false,
    list: [],
  }, '文案来自 _l(...) 且 id 为空串');
});

check('输入为 undefined / 空数组时只有"未分配部门"一条', () => {
  const format = extractFormatDepartmentData();
  const fromUndefined = format(undefined);
  assert.deepEqual(Object.keys(fromUndefined), [UNASSIGNED_KEY], 'undefined 也只有追加项');
  const fromEmpty = format([]);
  assert.deepEqual(Object.keys(fromEmpty), [UNASSIGNED_KEY], '空数组同样');
});

check('重复 departmentId 时后者覆盖前者（既有 forEach 赋值语义）', () => {
  const format = extractFormatDepartmentData();
  const map = format([
    { departmentId: 'dup', departmentName: '旧名' },
    { departmentId: 'dup', departmentName: '新名' },
  ]);
  assert.equal(map.dup!.departmentName, '新名', '后写覆盖');
  assert.equal(Object.keys(map).length, 2, '只有 dup 与未分配两条键');
});

check('缺 departmentId 的输入项落到 "undefined" 键（既有索引行为）', () => {
  const format = extractFormatDepartmentData();
  const map = format([{ departmentName: '孤儿部门' }]);
  assert.deepEqual(Object.keys(map).sort(), [UNASSIGNED_KEY, 'undefined'], '键来自索引强转（空串排在前）');
  assert.equal(map['undefined']!.departmentName, '孤儿部门');
});

check('返回新字典且不修改输入数组/元素', () => {
  const format = extractFormatDepartmentData();
  const input: DepartmentNode[] = [{ departmentId: 'd1', departmentName: '研发' }];
  const map = format(input);
  assert.equal(input.length, 1, '输入数组长度不变');
  assert.deepEqual(input[0], { departmentId: 'd1', departmentName: '研发' }, '输入元素未被改写');
  assert.notEqual(map.d1, input[0], '输出 bucket 是新建对象');
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
  console.log(`chat/ProjectContacts 行为规格通过：${passed} 项`);
}

main();
