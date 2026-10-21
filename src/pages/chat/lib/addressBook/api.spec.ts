/**
 * `src/pages/chat/lib/addressBook/api.ts` 的行为规格
 * （持续目标·地址簿接口包装切片）。
 *
 * 【为什么这样测】这个模块是地址簿各面板与后端接口之间的**唯一包装层**，真实语义在参数拼装上：
 * - `fetchAllContacts`/`fetchFriends`/`fetchOthers`/`fetchProjectContacts` 各自补
 *   `range = 0/1/3/2` 再走同一个 `getAllAddressbook`（`fetchContacts` 的默认值 0/1/100/''/false 也在里面）；
 * - `fetchAllGroups` 走 `getGroups`，默认 `searchGroupType = JOINED`、`groupStatus = ALL`、并带
 *   `sortFiled: 4 / sortType: 1`；
 * - `editAgreeFriend` 等六个写操作各自调用对应 controller 并原样返回其结果。
 * 本 spec 从**真实源码**取出该对象/函数执行（不复制、不改产品源码），所有 controller 用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

const TARGET = 'src/pages/chat/lib/addressBook/api.ts';

interface Call {
  controller: string;
  method: string;
  param: Record<string, unknown>;
}

interface ApiScript {
  addressBook: {
    fetchAllContacts: (param: Record<string, unknown>) => Promise<unknown>;
    fetchFriends: (param: Record<string, unknown>) => Promise<unknown>;
    fetchOthers: (param: Record<string, unknown>) => Promise<unknown>;
    fetchProjectContacts: (param: Record<string, unknown>) => Promise<unknown>;
    fetchAllGroups: (param?: Record<string, unknown>) => Promise<unknown>;
  };
  editAgreeFriend: (accountId: string) => Promise<unknown>;
  editRefuseFriend: (accountId: string) => Promise<unknown>;
  editIgnoreFriend: (accountId: string) => Promise<unknown>;
  editIgnoreRecommends: (recomendId: string) => Promise<unknown>;
  removeFriend: (accountId: string) => Promise<unknown>;
}

function extract(): (calls: Call[]) => ApiScript {
  const source = harness.readSource(TARGET);
  const stripped = source
    .replace(/import type[^;]+;\s*/g, '')
    .replace(/import [^;]+;\s*/g, '');
  // 结尾的 export const 写操作也要带回来：整段源码只去掉 import/type
  const transformed = harness.transformSync(stripped, { filename: 'addressBookApi-snippet.ts' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换 api.ts');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  // babel 的 CJS 产物会往 exports 上挂 default 与具名导出；这里让它在我们的 exports 对象上执行
  const factory = new Function(
    'AddressListController',
    'DepartmentController',
    'GroupController',
    'UserController',
    'GROUP_STATUS',
    'SEARCH_GROUP_TYPES',
    'exports',
    `${code}
return {
  addressBook: exports.default,
  editAgreeFriend: exports.editAgreeFriend,
  editRefuseFriend: exports.editRefuseFriend,
  editIgnoreFriend: exports.editIgnoreFriend,
  editIgnoreRecommends: exports.editIgnoreRecommends,
  removeFriend: exports.removeFriend,
};`,
  ) as unknown as (
    addressList: Record<string, unknown>,
    department: Record<string, unknown>,
    group: Record<string, unknown>,
    user: Record<string, unknown>,
    groupStatus: Record<string, number>,
    searchTypes: Record<string, number>,
    exportsObj: Record<string, unknown>,
  ) => ApiScript;

  return (calls: Call[]): ApiScript => {
    const record = (controller: string) =>
      new Proxy(
        {},
        {
          get: (_target, method: string) => (param: Record<string, unknown>) => {
            calls.push({ controller, method, param });
            return Promise.resolve({ ok: true });
          },
        },
      );
    const exportsObj: Record<string, unknown> = {};
    return factory(
      record('AddressList'),
      record('Department'),
      record('Group'),
      record('User'),
      { ALL: 0 } as Record<string, number>,
      { ALL: 0, JOINED: 1 } as Record<string, number>,
      exportsObj as never,
    );
  };
}

const factory = extract();

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('fetchAllContacts / fetchFriends / fetchOthers / fetchProjectContacts：各自补 range 后走同一接口', async () => {
  const calls: Call[] = [];
  const api = factory(calls).addressBook;
  await api.fetchAllContacts({ pageIndex: 2, pageSize: 30, keywords: 'kw', isFilterOther: true });
  await api.fetchFriends({ pageIndex: 1, pageSize: 20, keywords: 'f' });
  await api.fetchOthers({ pageIndex: 1, pageSize: 20 });
  await api.fetchProjectContacts({ pageIndex: 1, pageSize: 20, projectId: 'p1' });
  assert.deepEqual(
    calls.map((entry) => [entry.controller, entry.method, entry.param.range]),
    [
      ['AddressList', 'getAllAddressbook', 0],
      ['AddressList', 'getAllAddressbook', 1],
      ['AddressList', 'getAllAddressbook', 3],
      ['AddressList', 'getAllAddressbook', 2],
    ],
  );
  assert.equal(calls[0]!.param.keywords, 'kw');
  assert.equal(calls[0]!.param.isFilterOther, true);
  assert.equal(calls[3]!.param.projectId, 'p1');
});

check('fetchContacts 默认值：pageIndex 1 / pageSize 100 / keywords 空串 / isFilterOther false', async () => {
  const calls: Call[] = [];
  const api = factory(calls).addressBook;
  await api.fetchAllContacts({});
  assert.deepEqual(calls[0]!.param, {
    projectId: '',
    keywords: '',
    range: 0,
    pageIndex: 1,
    pageSize: 100,
    isFilterOther: false,
  });
});

check('fetchAllGroups：走 getGroups，默认 searchGroupType/status 与排序字段固定', async () => {
  const calls: Call[] = [];
  const api = factory(calls).addressBook;
  await api.fetchAllGroups({ pageIndex: 1, pageSize: 20, keywords: 'g', projectId: 'p2' });
  assert.deepEqual(calls[0], {
    controller: 'Group',
    method: 'getGroups',
    param: {
      keywords: 'g',
      searchGroupType: 1,
      status: 0,
      pageIndex: 1,
      pageSize: 20,
      sortFiled: 4,
      sortType: 1,
      projectId: 'p2',
    },
  });
});

check('六个写操作各自调用对应 controller 方法并原样返回', async () => {
  const calls: Call[] = [];
  const api = factory(calls);
  const results = await Promise.all([
    api.editAgreeFriend('a1'),
    api.editRefuseFriend('a2'),
    api.editIgnoreFriend('a3'),
    api.editIgnoreRecommends('r1'),
    api.removeFriend('a4'),
  ]);
  assert.deepEqual(
    calls.map((entry) => [entry.controller, entry.method]),
    [
      ['AddressList', 'editAgreeFriend'],
      ['AddressList', 'editRefuseFriend'],
      ['AddressList', 'editIgnoreFriend'],
      ['AddressList', 'addIgnoreMobileAddress'],
      ['AddressList', 'removeFriend'],
    ],
  );
  assert.deepEqual(results, [
    { ok: true },
    { ok: true },
    { ok: true },
    { ok: true },
    { ok: true },
  ]);
  assert.equal(calls[4]!.param.accountId, 'a4');
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
  console.log(`chat/AddressBookApi 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
