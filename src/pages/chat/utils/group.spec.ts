/**
 * `src/pages/chat/utils/group.ts` 的行为规格（持续目标·群成员/讨论组创建辅助切片）。
 *
 * 【为什么这样测】这三个函数把「邀请弹层 → 实际加人/建群/建讨论组」串起来：
 * - `showInviteBox`：把 sourceId/fromType/projectId/filterList 组装进 `dialogSelectUser` 的
 *   `SelectUserSettings`，**未显式传 filterList 时默认过滤当前登录账号**；选择回调仅当
 *   `options.callback` 是函数时转发。
 * - `addGroupMembers`：群聊 → `ajax.addMembers({groupId, accountIds})` 并 `existAccountHint`；
 *   单聊 → `ajax.createGroup({groupname:'', accountIds})`；两者都按「排除自己」的**原判断**过滤。
 * - `createDiscussion`：无 accountid 且只选了自己 → 直接 `cb(accounts,false)` 且**不发请求**；
 *   否则过滤后补 accountid，发 `ajax.createDiscussion`，成功 `cb(data,true)`。
 * 本 spec 从**真实源码**抽出这些函数执行（不复制、不改产品源码），宿主/网络全部记录桩。
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

const TARGET = 'src/pages/chat/utils/group.ts';

interface SelectedUser {
  accountId?: string;
  fullname?: string;
  avatar?: string;
  job?: string;
  department?: string;
  egroup?: string;
}

interface Env {
  dialogSelectUser: (param: Record<string, unknown>) => void;
  ajax: {
    addMembers: (param: { groupId?: string; accountIds: string[] }) => Promise<unknown>;
    createGroup: (param: { groupname: string; accountIds: string[] }) => Promise<unknown>;
    createDiscussion: (param: { accountIds: string[] }) => Promise<unknown>;
  };
  existAccountHint: (data: unknown) => void;
  account: { accountId: string };
}

interface Script {
  showInviteBox: (options: Record<string, unknown>) => void;
  addGroupMembers: (session: { id?: string; type?: number; projectId?: string }) => void;
  createDiscussion: (
    accountid?: string,
    cb?: (accounts: SelectedUser[], isCreated: boolean) => void,
  ) => void;
}

function extract(): (
  dialogStub: Env['dialogSelectUser'],
  ajaxStub: Env['ajax'],
  hint: Env['existAccountHint'],
  mdStub: { global: { Account: { accountId: string } } },
  constant: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
  requireStub: (name: string) => unknown,
) => Script {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['showInviteBox', 'addGroupMembers', 'createDiscussion'];
  const found: Record<string, string> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name && wanted.includes(node.id.name)) {
      const init = node.init;
      if (init && typeof init.start === 'number' && typeof init.end === 'number') {
        found[node.id.name] = source.slice(init.start, init.end);
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
  const missing = wanted.filter((name) => !found[name]);
  if (missing.length) throw new Error(`真实源码里没有找到函数：${missing.join(', ')}`);
  const body = wanted.map((name) => `var ${name} = ${found[name]};`).join('\n');
  const transformed = harness.transformSync(body, { filename: 'group-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'dialogSelectUser',
    'ajax',
    'existAccountHint',
    'md',
    'Constant',
    'require',
    `${code}\nreturn { showInviteBox, addGroupMembers, createDiscussion };`,
  ) as (
    dialogStub: Env['dialogSelectUser'],
    ajaxStub: Env['ajax'],
    hint: Env['existAccountHint'],
    mdStub: { global: { Account: { accountId: string } } },
    constant: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
    requireStub: (name: string) => unknown,
  ) => Script;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function make(): {
  script: Script;
  dialogCalls: Record<string, unknown>[];
  ajaxCalls: { name: string; param: Record<string, unknown> }[];
  hints: unknown[];
} {
  const dialogCalls: Record<string, unknown>[] = [];
  const ajaxCalls: { name: string; param: Record<string, unknown> }[] = [];
  const hints: unknown[] = [];
  const record = (name: string) => (param: Record<string, unknown>) => {
    ajaxCalls.push({ name, param });
    return Promise.resolve({ created: true });
  };
  const create = extract();
  const script = create(
    (param) => dialogCalls.push(param),
    {
      addMembers: record('addMembers') as Env['ajax']['addMembers'],
      createGroup: record('createGroup') as Env['ajax']['createGroup'],
      createDiscussion: record('createDiscussion') as Env['ajax']['createDiscussion'],
    },
    (data) => hints.push(data),
    { global: { Account: { accountId: 'me' } } },
    { SESSIONTYPE_GROUP: 1, SESSIONTYPE_USER: 2 },
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  return { script, dialogCalls, ajaxCalls, hints };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('showInviteBox：默认过滤当前账号；显式 filterList 优先；回调仅在传入函数时转发', () => {
  const h = make();
  const received: unknown[] = [];
  h.script.showInviteBox({ sourceId: 's1', fromType: 1, projectId: 'p1', callback: (d: unknown) => received.push(d) });
  assert.equal(h.dialogCalls.length, 1);
  const param = h.dialogCalls[0] as {
    sourceId: string;
    fromType: number;
    isChat: boolean;
    SelectUserSettings: { projectId: string; filterAccountIds: string[]; callback: (data: unknown[]) => void };
  };
  assert.equal(param.sourceId, 's1');
  assert.equal(param.fromType, 1);
  assert.equal(param.isChat, true);
  assert.equal(param.SelectUserSettings.projectId, 'p1');
  assert.deepEqual(param.SelectUserSettings.filterAccountIds, ['me'], '默认过滤当前登录账号');
  param.SelectUserSettings.callback([{ accountId: 'u1' }]);
  assert.deepEqual(received, [[{ accountId: 'u1' }]], '转发选择结果');
});

check('showInviteBox：显式 filterList 覆盖默认值；无 callback 时静默', () => {
  const h = make();
  h.script.showInviteBox({ sourceId: 's2', fromType: 0, filterList: ['a', 'b'] });
  const param = h.dialogCalls[0] as { SelectUserSettings: { filterAccountIds: string[]; callback: (d: unknown[]) => void } };
  assert.deepEqual(param.SelectUserSettings.filterAccountIds, ['a', 'b']);
  param.SelectUserSettings.callback([{ accountId: 'x' }]);
});

check('addGroupMembers（群聊）：邀请结果过滤后 addMembers，并 existAccountHint(回执)', async () => {
  const h = make();
  h.script.addGroupMembers({ id: 'g1', type: 1, projectId: 'p1' });
  const settings = (h.dialogCalls[0] as {
    SelectUserSettings: { callback: (users: SelectedUser[]) => void };
  }).SelectUserSettings;
  settings.callback([
    { accountId: 'u1', fullname: '甲' },
    { accountId: 'u2', fullname: '乙' },
  ]);
  await flush();
  assert.deepEqual(h.ajaxCalls, [{ name: 'addMembers', param: { groupId: 'g1', accountIds: ['u1', 'u2'] } }]);
  assert.equal(h.hints.length, 1, '合并回执交 existAccountHint');
  assert.deepEqual(h.hints[0], { created: true });
});

check('addGroupMembers（单聊）：走 createGroup（空群名）', async () => {
  const h = make();
  h.script.addGroupMembers({ id: 's1', type: 2, projectId: 'p1' });
  const settings = (h.dialogCalls[0] as {
    SelectUserSettings: { callback: (users: SelectedUser[]) => void };
  }).SelectUserSettings;
  settings.callback([{ accountId: 'u1' }]);
  await flush();
  assert.deepEqual(h.ajaxCalls, [{ name: 'createGroup', param: { groupname: '', accountIds: ['u1'] } }]);
});

check('createDiscussion：无 accountid 且只选自己 → 直接 cb(accounts,false) 且不发请求', async () => {
  const h = make();
  const results: unknown[] = [];
  h.script.createDiscussion(undefined, (accounts, isCreated) => results.push([accounts, isCreated]));
  const settings = (h.dialogCalls[0] as { SelectUserSettings: { callback: (users: SelectedUser[]) => void } })
    .SelectUserSettings;
  settings.callback([{ accountId: 'me' }]);
  await flush();
  assert.deepEqual(results, [[[{ accountId: 'me' }], false]]);
  assert.deepEqual(h.ajaxCalls, []);
});

check('createDiscussion：带 accountid → 过滤后补 id，成功 cb(data,true)', async () => {
  const h = make();
  const results: unknown[] = [];
  h.script.createDiscussion('u9', (accounts, isCreated) => results.push([accounts, isCreated]));
  const settings = (h.dialogCalls[0] as { SelectUserSettings: { callback: (users: SelectedUser[]) => void } })
    .SelectUserSettings;
  settings.callback([{ accountId: 'u1' }, { accountId: 'me' }]);
  await flush();
  // 既有行为：过滤条件用 ||（几乎总为真），因此除「同时等于我和 accountid」外都会保留；
  // 'me' 在这里也保留（不是本批要改的业务行为，原样断言）。
  assert.deepEqual(h.ajaxCalls, [{ name: 'createDiscussion', param: { accountIds: ['u1', 'me', 'u9'] } }]);
  assert.deepEqual(results, [[{ created: true }, true]]);
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
  console.log(`chat/group 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
