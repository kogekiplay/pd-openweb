/**
 * `src/pages/chat/lib/addressBook/components/UserDetail.tsx` 的行为规格
 * （持续目标·用户详情切片）。
 *
 * 【为什么这样测】`fetchUserDetail` 是真实**详情加载逻辑**：成功时把 `userCards` 里没有公司名的
 * 卡片过滤掉再写 state；接口返回空时写 `data:null`；请求失败时写 `data:undefined`
 * （渲染层据此显示「添加好友」占位）——三种结果对应界面上三种完全不同的状态。
 * 本 spec 从**真实源码**抽出该方法执行（不复制、不改产品源码），`API.fetchUserDetail` 用桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const _lodash: typeof import('lodash') = require('lodash');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/components/UserDetail.tsx';

interface UserCard {
  companyName?: string;
}

interface UserDetailData {
  accountId?: string;
  userCards?: UserCard[];
}

interface DetailState {
  data: UserDetailData | null | undefined;
  isLoading: boolean;
}

interface Instance {
  state: DetailState;
  setState: (patch: Partial<DetailState>) => void;
  fetchUserDetail: (accountId: string) => void;
}

function extract(): (
  api: { fetchUserDetail: (accountId: string) => Promise<UserDetailData | undefined> },
) => (state: DetailState, setState: Instance['setState']) => Instance {
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
      node.key.name === 'fetchUserDetail' &&
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
  if (!location) throw new Error(`真实源码里没有找到 fetchUserDetail：${TARGET}`);

  // 模块级默认 state（与真实源码一致）
  const wrapped = `var defaultState = { data: null, isLoading: false };\nvar __cls = class {\n  constructor(state, setState) {\n    this.state = state;\n    this.setState = setState;\n  }\n  ${source.slice(location.start, location.end)}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'userDetail-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    '_',
    'API',
    `${code}\nreturn (state, setState) => new __cls(state, setState);`,
  ) as unknown as (
    lodash: typeof import('lodash'),
    api: { fetchUserDetail: (accountId: string) => Promise<UserDetailData | undefined> },
  ) => (state: DetailState, setState: Instance['setState']) => Instance;
  return (api) => create(_lodash, api);
}

const factory = extract();

function make(api: { fetchUserDetail: (accountId: string) => Promise<UserDetailData | undefined> }): {
  instance: Instance;
  patches: Partial<DetailState>[];
} {
  const patches: Partial<DetailState>[] = [];
  let instance: Instance;
  instance = factory(api)({ data: null, isLoading: false }, (patch: Partial<DetailState>) => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  });
  return { instance, patches };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('fetchUserDetail：请求前先置 isLoading，成功后写入过滤后的数据', async () => {
  const { instance, patches } = make({
    fetchUserDetail: async () => ({
      accountId: 'a1',
      userCards: [{ companyName: '公司A' }, {}, { companyName: '' }, { companyName: '公司B' }],
    }),
  });
  instance.fetchUserDetail('a1');
  assert.deepEqual(patches[0], { isLoading: true }, '先置加载中');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const last = patches[patches.length - 1]!;
  assert.equal(last.isLoading, false);
  assert.equal((last.data as UserDetailData).userCards!.length, 2, '只保留有 companyName 的卡片');
  assert.deepEqual(
    (last.data as UserDetailData).userCards!.map((card) => card.companyName),
    ['公司A', '公司B'],
  );
});

check('fetchUserDetail：接口返回空 → data 为 undefined（渲染层显示「添加好友」）', async () => {
  const { instance, patches } = make({ fetchUserDetail: async () => undefined });
  instance.fetchUserDetail('a1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const last = patches[patches.length - 1]!;
  assert.equal(last.data, undefined);
  assert.equal(last.isLoading, false);
});

check('fetchUserDetail：请求失败 → 写入 undefined（渲染层显示"添加好友"）', async () => {
  const { instance, patches } = make({ fetchUserDetail: () => Promise.reject(new Error('boom')) });
  instance.fetchUserDetail('a1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const last = patches[patches.length - 1]!;
  assert.equal(last.data, undefined);
  assert.equal(last.isLoading, false);
});

check('fetchUserDetail：数据没有 userCards 时写入空数组（不保留 undefined）', async () => {
  const { instance, patches } = make({ fetchUserDetail: async () => ({ accountId: 'a1' }) });
  instance.fetchUserDetail('a1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const last = patches[patches.length - 1]!;
  assert.deepEqual((last.data as UserDetailData).userCards, []);
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
  console.log(`chat/UserDetail 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
