/**
 * `src/pages/chat/utils/ajax.ts` 的行为规格（持续目标·聊天传输层切片）。
 *
 * 【为什么这样测】这个文件是聊天模块的**接口信封层**：参数拼装/分支选择直接决定请求打到哪个接口。
 * 本 spec 从**真实源码**抽出六个函数执行（不复制、不改产品源码），后端控制器与 `window.mdyAPI`
 * 用记录桩替换，断言真实入参：
 * - `chatSessionItem`：群 → 群信息接口（3s 超时/silent）；个人 → 账号信息接口；其它 type → 不请求；
 * - `getMessage`：默认参数（`sincetime:''`/`page:1`/`num=MSG_LENGTH_MORE`）、群/个人两条 URL、
 *   未知类型返回 undefined；
 * - `addMembers`/`createGroup`：Promise 成功/接口失败/`msg!==1` 的结算方式；
 * - `getFileList`/`getCountByTabName`：按是否有 `groupId` 分流并写默认值。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */
import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const _lodash: typeof import('lodash') = require('lodash');
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

const TARGET = 'src/pages/chat/utils/ajax.ts';
const WANTED = ['chatSessionItem', 'getMessage', 'addMembers', 'createGroup', 'getFileList', 'getCountByTabName'];

interface Call {
  kind: 'mdyAPI' | 'controller';
  action: string;
  args: unknown[];
}

interface Ajax {
  chatSessionItem: (param: { type?: number | string; value?: string }) => unknown;
  getMessage: (conf: {
    type?: number;
    id?: string;
    sincetime?: number | string;
    page?: number;
    num?: number;
    keyword?: string;
    direction?: string | number;
  }) => unknown;
  addMembers: (param: { groupId?: string; accountIds?: unknown; accounts?: unknown }) => Promise<unknown>;
  createGroup: (param: { groupname?: string; useridlist?: unknown; accountIds?: unknown }) => Promise<unknown>;
  getFileList: (param: Record<string, unknown>) => unknown;
  getCountByTabName: (param: Record<string, unknown>) => unknown;
}

type Behavior = (...args: unknown[]) => unknown;

function extractSnippets(): Record<string, string> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module' }) as unknown as { program: { body: BabelNode[] } };
  const snippets: Record<string, string> = {};

  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration' && node.declarations) {
      for (const declaration of node.declarations) {
        const name = declaration.id && declaration.id.name;
        if (!name || !WANTED.includes(name)) continue;
        if (!declaration.init || typeof declaration.init.start !== 'number' || typeof declaration.init.end !== 'number')
          continue;
        snippets[name] = `var ${name} = ${source.slice(declaration.init.start, declaration.init.end)};`;
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
  const missing = WANTED.filter(name => !snippets[name]);
  if (missing.length) throw new Error(`真实源码里没有找到函数：${missing.join(', ')}`);
  return snippets;
}

const SNIPPETS = extractSnippets();

function makeAjax(behaviors: Record<string, Behavior> = {}): { api: Ajax; calls: Call[] } {
  const wrapped = `${WANTED.map(name => SNIPPETS[name]).join('\n')}\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'ajax-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const calls: Call[] = [];
  // 这几个控制器在真实代码里是 Promise 链（`.then/.catch`），默认桩也返回 Promise
  const PROMISE_CONTROLLERS = ['inviteUser', 'addGroup', 'addDiscussionGroup'];

  const controllerCall =
    (name: string) =>
    (...args: unknown[]): unknown => {
      calls.push({ kind: 'controller', action: name, args });
      const behavior = behaviors[name];
      if (behavior) return behavior(...args);
      const result = { rawResult: name };
      return PROMISE_CONTROLLERS.includes(name) ? Promise.resolve(result) : result;
    };

  const mdyAPI = (...args: unknown[]): unknown => {
    calls.push({ kind: 'mdyAPI', action: 'mdyAPI', args });
    return { mocked: true };
  };

  const ChatController = {
    getGroupInfo: controllerCall('getGroupInfo'),
    getUserFileList: controllerCall('getUserFileList'),
    getGroupFileList: controllerCall('getGroupFileList'),
    getGroupCountByTabName: controllerCall('getGroupCountByTabName'),
    getUserCountByTabName: controllerCall('getUserCountByTabName'),
  };
  const UserController = { getAccountBaseInfo: controllerCall('getAccountBaseInfo') };
  const CommonAjaxInvitation = { inviteUser: controllerCall('inviteUser') };
  const GroupController = {
    addGroup: controllerCall('addGroup'),
    addDiscussionGroup: controllerCall('addDiscussionGroup'),
  };
  const create = new Function(
    '_',
    'Constant',
    'chatConfig',
    'ChatController',
    'UserController',
    'CommonAjaxInvitation',
    'GroupController',
    'getPssId',
    'window',
    'isDevelopment',
    `${code}\nreturn { chatSessionItem, getMessage, addMembers, createGroup, getFileList, getCountByTabName };`,
  ) as (
    lodash: typeof import('lodash'),
    constant: { SESSIONTYPE_GROUP: number; SESSIONTYPE_USER: number },
    config: { MSG_LENGTH_MORE: number },
    chatController: typeof ChatController,
    userController: typeof UserController,
    invitation: typeof CommonAjaxInvitation,
    groupController: typeof GroupController,
    pssId: () => string,
    windowStub: { mdyAPI: typeof mdyAPI; config: { HTTP_SERVER: string } },
    isDevelopment: boolean,
  ) => Ajax;
  const api = create(
    _lodash,
    { SESSIONTYPE_GROUP: 1, SESSIONTYPE_USER: 2 },
    { MSG_LENGTH_MORE: 20 },
    ChatController,
    UserController,
    CommonAjaxInvitation,
    GroupController,
    () => 'PSS-ID',
    { mdyAPI, config: { HTTP_SERVER: 'https://api.example.com' } },
    false,
  );
  return { api, calls };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];

function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

/** 取最后一次指定控制器调用 */
function lastCall(calls: Call[], action: string): Call | undefined {
  return [...calls].reverse().find(call => call.action === action);
}

check('chatSessionItem：群会话 → 群信息接口（3s 超时 + silent）', () => {
  const { api, calls } = makeAjax();
  const result = api.chatSessionItem({ type: 1, value: 'g1' });
  assert.deepEqual(result, { rawResult: 'getGroupInfo' });
  const call = lastCall(calls, 'getGroupInfo')!;
  assert.deepEqual(call.args[0], { groupId: 'g1' });
  assert.deepEqual(call.args[1], { ajaxOptions: { timeout: 3000 }, silent: true });
});

check('chatSessionItem：个人会话 → 账号信息接口（同样 3s 超时 + silent）', () => {
  const { api, calls } = makeAjax();
  assert.deepEqual(api.chatSessionItem({ type: 2, value: 'u1' }), { rawResult: 'getAccountBaseInfo' });
  const call = lastCall(calls, 'getAccountBaseInfo')!;
  assert.deepEqual(call.args[0], { accountId: 'u1' });
  assert.deepEqual(call.args[1], { ajaxOptions: { timeout: 3000 }, silent: true });
});

check('chatSessionItem：其它 type → 不请求、返回 undefined', () => {
  const { api, calls } = makeAjax();
  assert.equal(api.chatSessionItem({ type: 99, value: 'x' }), undefined);
  assert.deepEqual(calls, []);
});

check('getMessage：群分支的参数与 URL（num 叠加 MSG_LENGTH_MORE）', () => {
  const { api, calls } = makeAjax();
  api.getMessage({ type: 1, id: 'g1', sincetime: '2026-01-01', page: 2, num: 10, keyword: 'kw', direction: 'up' });
  const call = lastCall(calls, 'mdyAPI')!;
  assert.equal(call.args[0], '');
  assert.equal(call.args[1], '');
  assert.deepEqual(call.args[2], {
    sincetime: '2026-01-01',
    page: 2,
    num: 30,
    keyword: 'kw',
    direction: 'up',
    groupid: 'g1',
  });
  const options = call.args[3] as { customParseResponse: boolean; ajaxOptions: { type: string; url: string } };
  assert.equal(options.customParseResponse, true);
  assert.equal(options.ajaxOptions.type, 'GET');
  assert.equal(options.ajaxOptions.url, 'https://api.example.com/group_messages');
});

check('getMessage：个人分支用 accountid 与 /messages', () => {
  const { api, calls } = makeAjax();
  api.getMessage({ type: 2, id: 'u1' });
  const call = lastCall(calls, 'mdyAPI')!;
  assert.deepEqual(call.args[2], {
    sincetime: '',
    page: 1,
    num: 20,
    keyword: '',
    direction: '',
    accountid: 'u1',
  });
  assert.equal((call.args[3] as { ajaxOptions: { url: string } }).ajaxOptions.url, 'https://api.example.com/messages');
});

check('getMessage：未知 type → 不发请求、返回 undefined', () => {
  const { api, calls } = makeAjax();
  assert.equal(api.getMessage({ type: 99, id: 'x' }), undefined);
  assert.deepEqual(calls, []);
});

check('addMembers：成功后 resolve 接口数据（参数带 fromType:1）', async () => {
  const { api, calls } = makeAjax();
  const data = await api.addMembers({ groupId: 'g1', accountIds: ['a1'] });
  assert.deepEqual(data, { rawResult: 'inviteUser' });
  assert.deepEqual(lastCall(calls, 'inviteUser')!.args[0], { sourceId: 'g1', fromType: 1, accountIds: ['a1'] });
});

check('addMembers：接口失败时 reject 原始 xhr', async () => {
  const xhr = { status: 500 };
  const { api } = makeAjax({ inviteUser: () => Promise.reject(xhr) });
  await assert.rejects(
    () => api.addMembers({ groupId: 'g1' }),
    (err: unknown) => err === xhr,
  );
});

check('createGroup：msg===1 时 resolve(res.data)', async () => {
  const { api, calls } = makeAjax({ addGroup: () => Promise.resolve({ msg: 1, data: { groupId: 'g9' } }) });
  assert.deepEqual(await api.createGroup({ groupname: 'G', useridlist: ['a1'] }), { groupId: 'g9' });
  assert.deepEqual(lastCall(calls, 'addGroup')!.args[0], { groupName: 'G', accountIds: '["a1"]' });
});

check('createGroup：msg!==1 时 reject(res.msg)；请求异常时 reject(xhr)', async () => {
  const failed = makeAjax({ addGroup: () => Promise.resolve({ msg: '该群已存在' }) });
  await assert.rejects(
    () => failed.api.createGroup({ groupname: 'G' }),
    (err: unknown) => err === '该群已存在',
  );
  const xhr = { status: 403 };
  const rejected = makeAjax({ addGroup: () => Promise.reject(xhr) });
  await assert.rejects(
    () => rejected.api.createGroup({ groupname: 'G' }),
    (err: unknown) => err === xhr,
  );
});

check('getFileList：群/个人分流，fileType 默认 -1、其余参数原样透传', () => {
  const groupCall = makeAjax();
  groupCall.api.getFileList({ groupId: 'g1', pageIndex: 1 });
  assert.deepEqual(lastCall(groupCall.calls, 'getGroupFileList')!.args[0], {
    groupId: 'g1',
    pageIndex: 1,
    fileType: -1,
  });

  const userCall = makeAjax();
  userCall.api.getFileList({ withUser: 'u1' });
  assert.deepEqual(lastCall(userCall.calls, 'getUserFileList')!.args[0], { withUser: 'u1', fileType: -1 });
});

check('getCountByTabName：群写 loadTabType=7，个人写 6', () => {
  const groupCall = makeAjax();
  groupCall.api.getCountByTabName({ groupId: 'g1' });
  assert.deepEqual(lastCall(groupCall.calls, 'getGroupCountByTabName')!.args[0], { groupId: 'g1', loadTabType: 7 });

  const userCall = makeAjax();
  userCall.api.getCountByTabName({ withUser: 'u1' });
  assert.deepEqual(lastCall(userCall.calls, 'getUserCountByTabName')!.args[0], { withUser: 'u1', loadTabType: 6 });
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

  console.log(`chat/ajax 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
