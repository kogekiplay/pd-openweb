/**
 * `src/pages/chat/lib/addressBook/components/GroupDetail.tsx` 的行为规格
 * （持续目标·群详情切片）。
 *
 * 【为什么这样测】`openSettingDialog` 是真实**设置回写映射逻辑**：群设置弹层保存后按操作类型
 * （改头像/改名/加人/移人/关闭/删除/退出…）算出要写回父级的局部补丁 —— 哪些字段变、成员数
 * 加减、关闭时是否同时标记删除。它决定侧栏群信息与列表的即时更新。
 * 本 spec 从**真实源码**抽出该方法执行（不复制、不改产品源码），`settingGroup` 与父级
 * `updateGroupModel` 用记录桩（保存成功后立刻回传）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/components/GroupDetail.tsx';

interface GroupInfo {
  groupId?: string;
  groupMemberCount?: number;
}

interface SettingGroupResult {
  groupAvatar?: string;
  groupName?: string;
  accounts?: unknown[];
}

interface Instance {
  props: {
    group: GroupInfo;
    groupStatus?: number;
    updateGroupModel: (groupId: string, patch: Record<string, unknown>) => void;
  };
  openSettingDialog: () => void;
}

function extract(): (
  settingGroupStub: (config: {
    groupID?: string;
    success: (type: string, groupInfo: SettingGroupResult) => void;
  }) => void,
) => (props: Instance['props']) => Instance {
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
      node.key.name === 'openSettingDialog' &&
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
  const location = found as { start: number; end: number } | null;
  if (!location) throw new Error(`真实源码里没有找到 openSettingDialog：${TARGET}`);

  const wrapped = `var __cls = class {\n  constructor(props) {\n    this.props = props;\n  }\n  ${source.slice(location.start, location.end)}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'groupDetail-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    'settingGroup',
    `${code}\nreturn (props) => new __cls(props);`,
  ) as (
    settingGroupStub: (config: {
      groupID?: string;
      success: (type: string, groupInfo: SettingGroupResult) => void;
    }) => void,
  ) => (props: Instance['props']) => Instance;
  return create;
}

const makeFactory = extract();

interface Run {
  updates: { groupId: string; patch: Record<string, unknown> }[];
  groupIds: (string | undefined)[];
}

function runCase(
  type: string,
  groupInfo: SettingGroupResult = {},
  group: GroupInfo = { groupId: 'g1', groupMemberCount: 3 },
  groupStatus?: number,
): Run {
  const updates: { groupId: string; patch: Record<string, unknown> }[] = [];
  const groupIds: (string | undefined)[] = [];
  const props: Instance['props'] = {
    group,
    groupStatus,
    updateGroupModel: (groupId: string, patch: Record<string, unknown>) => updates.push({ groupId, patch }),
  };
  const instance = makeFactory((config) => {
    groupIds.push(config.groupID);
    config.success(type, groupInfo);
  })(props);
  instance.openSettingDialog();
  return { updates, groupIds };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('openSettingDialog：忽略未登记的操作类型（不写回）', () => {
  const { updates } = runCase('SOMETHING_ELSE');
  assert.deepEqual(updates, []);
});

check('openSettingDialog：改头像 → 只写 avatar', () => {
  const { updates } = runCase('UPDATE_AVATAR', { groupAvatar: 'new.png' });
  assert.deepEqual(updates, [{ groupId: 'g1', patch: { avatar: 'new.png' } }]);
});

check('openSettingDialog：改名 → 只写 name', () => {
  const { updates } = runCase('RENAME', { groupName: '新群名' });
  assert.deepEqual(updates, [{ groupId: 'g1', patch: { name: '新群名' } }]);
});

check('openSettingDialog：加人 → 成员数按 accounts 数量增加', () => {
  const { updates } = runCase('ADD_MEMBERS', { accounts: [{}, {}] }, { groupId: 'g1', groupMemberCount: 3 });
  assert.deepEqual(updates, [{ groupId: 'g1', patch: { groupMemberCount: 5 } }]);
});

check('openSettingDialog：移人 → 成员数减 1（不小于 0）', () => {
  const one = runCase('REMOVE_USER', {}, { groupId: 'g1', groupMemberCount: 3 });
  assert.deepEqual(one.updates, [{ groupId: 'g1', patch: { groupMemberCount: 2 } }]);
  const zero = runCase('REMOVE_USER', {}, { groupId: 'g1', groupMemberCount: 0 });
  assert.deepEqual(zero.updates, [{ groupId: 'g1', patch: { groupMemberCount: 0 } }], '不会出现负数');
});

check('openSettingDialog：关闭群 → isOpen:false，并按 groupStatus 决定 isDelete', () => {
  const alive = runCase('CLOSE_GROUP', {}, { groupId: 'g1' }, 0);
  assert.deepEqual(alive.updates, [{ groupId: 'g1', patch: { isOpen: false, isDelete: false } }]);
  const deleted = runCase('CLOSE_GROUP', {}, { groupId: 'g1' }, 1);
  assert.deepEqual(deleted.updates, [{ groupId: 'g1', patch: { isOpen: false, isDelete: true } }]);
});

check('openSettingDialog：删除/退出群 → isDelete:true', () => {
  assert.deepEqual(runCase('DELETE').updates, [{ groupId: 'g1', patch: { isDelete: true } }]);
  assert.deepEqual(runCase('EXIT_GROUP').updates, [{ groupId: 'g1', patch: { isDelete: true } }]);
});

check('openSettingDialog：其它已登记类型（如 APPROVE）→ 整体写回回传群信息', () => {
  const { updates } = runCase('APPROVE', { groupAvatar: 'a.png', groupName: 'n' });
  assert.deepEqual(updates, [{ groupId: 'g1', patch: { groupAvatar: 'a.png', groupName: 'n' } }]);
});

check('openSettingDialog：把群 id 透传给设置弹层', () => {
  const { groupIds } = runCase('RENAME', { groupName: 'x' });
  assert.deepEqual(groupIds, ['g1']);
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
  console.log(`chat/GroupDetail 行为规格通过：${passed} 项`);
}

main();
