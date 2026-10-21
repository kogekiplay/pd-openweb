/**
 * `src/pages/chat/lib/addressBook/containers/Groups.tsx` 的行为规格（持续目标·群列表容器切片）。
 *
 * 【为什么这样测】`formatGroupsData` 与 `getGroupModel` 是群列表的真实数据逻辑：
 * - `formatGroupsData(store, list)`：无关键词搜索时把群按**首字母**分组（非 A-Z 归到 `#`），
 *   并在已有分组结果上增量追加（分页 load more）；
 * - `getGroupModel(groupId)`：在两种列表形态下找出当前选中的群（带关键词时是平铺数组，
 *   否则是「字母分组」字典），供右侧详情使用。
 * 本 spec 从**真实源码**抽出这两个函数执行（不复制、不改产品源码）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const _lodash: typeof import('lodash') = require('lodash');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/containers/Groups.tsx';

interface Group {
  groupId: string;
  firstCode?: string;
  isDelete?: boolean;
}

function extractInitializers(names: string[]): Record<string, string> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const found: Record<string, string> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration' && node.declarations) {
      for (const declaration of node.declarations) {
        const name = declaration.id && declaration.id.name;
        if (!name || !names.includes(name)) continue;
        const init = declaration.init;
        if (init && typeof init.start === 'number' && typeof init.end === 'number') {
          found[name] = source.slice(init.start, init.end);
        }
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
  for (const name of names) {
    if (!found[name]) throw new Error(`真实源码里没有找到 ${name}：${TARGET}`);
  }
  return found;
}

const formatGroupsDataCode = extractInitializers(['formatGroupsData']).formatGroupsData;
const transformed = harness.transformSync(`var formatGroupsData = ${formatGroupsDataCode};`, {
  filename: 'groups-snippet.tsx',
});
if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换 formatGroupsData');
const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
const formatGroupsData = new Function('_', `${code}\nreturn formatGroupsData;`)(_lodash) as (
  store: Record<string, Group[]> | null,
  list: Group[],
) => Record<string, Group[]>;

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('formatGroupsData：按首字母分组（小写归一化），非字母归到 #', () => {
  const list: Group[] = [
    { groupId: 'g1', firstCode: 'b' },
    { groupId: 'g2', firstCode: 'a' },
    { groupId: 'g3', firstCode: '#' },
    { groupId: 'g4', firstCode: 'Z' },
  ];
  const result = formatGroupsData(null, list);
  assert.deepEqual(Object.keys(result).sort(), ['#', 'A', 'B', 'Z']);
  assert.deepEqual(
    result['A']!.map((group) => group.groupId),
    ['g2'],
  );
  assert.deepEqual(
    result['B']!.map((group) => group.groupId),
    ['g1'],
  );
  assert.deepEqual(
    result['#']!.map((group) => group.groupId),
    ['g3'],
  );
});

check('formatGroupsData：在已有分组上增量追加（分页 load more）', () => {
  const store: Record<string, Group[]> = { A: [{ groupId: 'g1', firstCode: 'A' }] };
  const result = formatGroupsData(store, [{ groupId: 'g2', firstCode: 'A' }]);
  assert.equal(result, store, '返回同一个 store 对象（就地累加）');
  assert.deepEqual(
    result['A']!.map((group) => group.groupId),
    ['g1', 'g2'],
  );
});

check('formatGroupsData：空列表不改动 store', () => {
  const store: Record<string, Group[]> = {};
  assert.deepEqual(formatGroupsData(store, []), {});
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
  console.log(`chat/Groups 行为规格通过：${passed} 项`);
}

main();
