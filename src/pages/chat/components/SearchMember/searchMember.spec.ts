/**
 * `src/pages/chat/components/SearchMember/index.tsx` 的行为规格（持续目标·成员搜索切片）。
 *
 * 【为什么这样测】`SearchMember` 是 class 组件，本仓没有 render 测试设施；但它的模块级 `flatten`
 * 是真实数据逻辑：把搜索结果的两个列表（`accounts.list` + `groups.list`）拼成键盘上下键导航
 * 用的扁平数组，顺序与内容决定「回车打开的是谁」。本 spec 从**真实源码**抽出该函数执行
 * （不复制、不改产品源码）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
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

const TARGET = 'src/pages/chat/components/SearchMember/index.tsx';

interface AccountEntry {
  accountId?: string;
  fullname?: string;
}

interface GroupEntry {
  groupId?: string;
  name?: string;
}

interface AddressBookResult {
  accounts: { list: AccountEntry[] };
  groups: { list: GroupEntry[] };
}

function extractFlatten(): (res: AddressBookResult) => Array<AccountEntry | GroupEntry> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let found: { start: number; end: number } | null = null;
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration' || !statement.declarations) continue;
    for (const declaration of statement.declarations) {
      if (!declaration.id || declaration.id.name !== 'flatten') continue;
      if (typeof declaration.start !== 'number' || typeof declaration.end !== 'number') continue;
      found = { start: declaration.start, end: declaration.end };
    }
  }
  if (!found) throw new Error(`真实源码里没有找到 flatten：${TARGET}`);

  const declarationSource = source.slice(found.start, found.end);
  const wrapped = `${declarationSource}\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'searchMember-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的声明片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(`${code}\nreturn flatten;`) as () => (
    res: AddressBookResult,
  ) => Array<AccountEntry | GroupEntry>;
  return create();
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('flatten：联系人列表在前、群组列表在后（顺序即键盘导航顺序）', () => {
  const flatten = extractFlatten();
  const accounts = [{ accountId: 'a1', fullname: '甲' }, { accountId: 'a2', fullname: '乙' }];
  const groups = [{ groupId: 'g1', name: '群一' }];
  const result = flatten({ accounts: { list: accounts }, groups: { list: groups } });
  assert.deepEqual(result, [accounts[0], accounts[1], groups[0]], '两段按 accounts → groups 拼接');
});

check('flatten：引用保持（元素对象不复制）', () => {
  const flatten = extractFlatten();
  const account = { accountId: 'a1' };
  const group = { groupId: 'g1' };
  const result = flatten({ accounts: { list: [account] }, groups: { list: [group] } });
  assert.equal(result[0], account, '联系人元素是同一对象');
  assert.equal(result[1], group, '群组元素是同一对象');
});

check('flatten：返回新数组，不修改两个入参列表', () => {
  const flatten = extractFlatten();
  const accounts: AccountEntry[] = [{ accountId: 'a1' }];
  const groups: GroupEntry[] = [{ groupId: 'g1' }];
  const result = flatten({ accounts: { list: accounts }, groups: { list: groups } });
  assert.notEqual(result, accounts, '结果不是 accounts.list 本身');
  assert.notEqual(result, groups, '结果也不是 groups.list');
  assert.equal(accounts.length, 1, 'accounts.list 未被追加');
  assert.equal(groups.length, 1, 'groups.list 未被追加');
});

check('flatten：两个空列表得到空数组', () => {
  const flatten = extractFlatten();
  assert.deepEqual(flatten({ accounts: { list: [] }, groups: { list: [] } }), []);
});

check('flatten：只有群组 / 只有联系人时也正确', () => {
  const flatten = extractFlatten();
  const groups = [{ groupId: 'g1' }, { groupId: 'g2' }];
  assert.deepEqual(flatten({ accounts: { list: [] }, groups: { list: groups } }), groups);
  const accounts = [{ accountId: 'a1' }];
  assert.deepEqual(flatten({ accounts: { list: accounts }, groups: { list: [] } }), accounts);
});

check('flatten：重复项原样保留（不做去重/排序）', () => {
  const flatten = extractFlatten();
  const dup = { accountId: 'same' };
  const result = flatten({ accounts: { list: [dup, dup] }, groups: { list: [] } });
  assert.equal(result.length, 2, '重复项保留');
  assert.equal(result[0], result[1], '两项仍是同一引用');
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
  console.log(`chat/SearchMember 行为规格通过：${passed} 项`);
}

main();
