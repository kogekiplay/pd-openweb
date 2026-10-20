/**
 * `src/pages/chat/lib/addressBook/components/NewFriendsList.tsx` 的行为规格
 * （持续目标·待验证好友申请切片）。
 *
 * 【为什么这样测】该组件把好友申请的同意/拒绝落到真实方法：
 * - `fetch`：按 `isLoading/hasMore` 防重入，成功时追加列表、`pageIndex+1`、按「满 10 条」算 hasMore，
 *   **最后**才 `props.update(allCount !== 0)`（避免提前 render）；
 * - `updateListData`：按 `createAccount.accountId` 就地标记 added（只替换命中项）；
 * - `add` / `refuse`：同意/拒绝接口成功 → 标记；失败 → `alert(..., 2)`。
 * 本 spec 从**真实源码**抽出这些方法执行（不复制、不改产品源码），API/父级回调均用记录桩。
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

const TARGET = 'src/pages/chat/lib/addressBook/components/NewFriendsList.tsx';

interface NewFriendItem {
  createAccount: { accountId?: string; fullname?: string };
  message?: string;
  added?: boolean;
}

interface Props {
  isLoaded: boolean;
  update: (hasApplies: boolean) => void;
}

interface State {
  isLoading: boolean;
  pageIndex: number;
  hasMore: boolean;
  listData: NewFriendItem[] | null;
}

interface ApiStub {
  fetchNewFriends: (param: { pageIndex: number; pageSize: number }) => Promise<{ allCount?: number; list?: NewFriendItem[] }>;
}

interface Instance {
  props: Props;
  state: State;
  setState: (patch: Partial<State>, callback?: () => void) => void;
  fetch: () => void;
  updateListData: (accountId: string, isAdd: boolean) => void;
  add: (accountId: string) => Promise<void>;
  refuse: (accountId: string) => Promise<void>;
  componentDidUpdate: (prevProps: Props) => void;
}

function extract(): (
  lodash: typeof import('lodash'),
  api: ApiStub,
  editAgree: (accountId: string) => Promise<boolean>,
  editRefuse: (accountId: string) => Promise<boolean>,
  translate: (key: string, ...args: unknown[]) => string,
  alertStub: (text: string, level?: number) => void,
  equal: (a: unknown, b: unknown) => boolean,
  requireStub: (name: string) => unknown,
) => (props: Props, state: State, setState: Instance['setState']) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['componentDidUpdate', 'fetch', 'updateListData', 'add', 'refuse'];
  const found: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      typeof node.key.name === 'string' &&
      wanted.includes(node.key.name) &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found[node.key.name] = { start: node.start, end: node.end };
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
  if (missing.length) throw new Error(`真实源码里没有找到方法：${missing.join(', ')}`);

  const methods = wanted
    .map((name) => source.slice(found[name]!.start, found[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const wrapped = `var __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n    this.fetch = this.fetch.bind(this);\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'newFriendsList-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'API',
    'editAgreeFriend',
    'editRefuseFriend',
    '_l',
    'alert',
    'shallowEqual',
    'require',
    `${code}\nreturn (props, state, setState) => new __cls(props, state, setState);`,
  ) as (
    lodash: typeof import('lodash'),
    api: ApiStub,
    editAgree: (accountId: string) => Promise<boolean>,
    editRefuse: (accountId: string) => Promise<boolean>,
    translate: (key: string, ...args: unknown[]) => string,
    alertStub: (text: string, level?: number) => void,
    equal: (a: unknown, b: unknown) => boolean,
    requireStub: (name: string) => unknown,
  ) => (props: Props, state: State, setState: Instance['setState']) => Instance;
}

const factory = extract();
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function make(options: { allCount?: number; list?: NewFriendItem[]; agree?: boolean; refuse?: boolean } = {}): {
  instance: Instance;
  apiCalls: { pageIndex: number; pageSize: number }[];
  updates: boolean[];
  alerts: { text: string; level?: number }[];
} {
  const apiCalls: { pageIndex: number; pageSize: number }[] = [];
  const updates: boolean[] = [];
  const alerts: { text: string; level?: number }[] = [];
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  const create = factory(
    _lodash,
    {
      fetchNewFriends: (param) => {
        apiCalls.push(param);
        return Promise.resolve({
          allCount: options.allCount ?? 2,
          list: options.list ?? [{ createAccount: { accountId: 'a1' } }],
        });
      },
    },
    () => Promise.resolve(options.agree ?? true),
    () => Promise.resolve(options.refuse ?? true),
    (key) => key,
    (text, level) => alerts.push({ text, level }),
    shallowEqual,
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  let instance: Instance;
  const setState = (patch: Partial<State>, callback?: () => void): void => {
    Object.assign(instance.state, patch);
    if (callback) callback();
  };
  instance = create(
    { isLoaded: true, update: (has) => updates.push(has) },
    { isLoading: false, pageIndex: 1, hasMore: true, listData: null },
    setState,
  );
  return { instance, apiCalls, updates, alerts };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('fetch：追加列表、pageIndex+1、按满 10 条算 hasMore，最后才 update(true)', async () => {
  const h = make({ allCount: 2, list: [{ createAccount: { accountId: 'a1' } }, { createAccount: { accountId: 'a2' } }] });
  h.instance.fetch();
  await flush();
  assert.deepEqual(h.apiCalls, [{ pageIndex: 1, pageSize: 10 }]);
  assert.deepEqual(h.updates, [true]);
  assert.deepEqual(
    h.instance.state.listData!.map((item) => item.createAccount.accountId),
    ['a1', 'a2'],
  );
  assert.equal(h.instance.state.pageIndex, 2);
  assert.equal(h.instance.state.hasMore, false);
});

check('fetch：满 10 条 → hasMore=true；allCount===0 → 不追加仍 update(false)', async () => {
  const list = Array.from({ length: 10 }, (_item, index) => ({ createAccount: { accountId: `a${index}` } }));
  const full = make({ allCount: 10, list });
  full.instance.fetch();
  await flush();
  assert.equal(full.instance.state.hasMore, true);

  const none = make({ allCount: 0, list: [{ createAccount: { accountId: 'x' } }] });
  none.instance.fetch();
  await flush();
  assert.equal(none.instance.state.listData, null);
  assert.deepEqual(none.updates, [false]);
});

check('fetch：isLoading 或 !hasMore 时防重入', async () => {
  const h = make();
  h.instance.state.isLoading = true;
  h.instance.fetch();
  await flush();
  assert.deepEqual(h.apiCalls, []);
  h.instance.state.isLoading = false;
  h.instance.state.hasMore = false;
  h.instance.fetch();
  await flush();
  assert.deepEqual(h.apiCalls, []);
});

check('updateListData：按 createAccount.accountId 标记 added，其它项引用不变', () => {
  const h = make();
  const first: NewFriendItem = { createAccount: { accountId: 'a1', fullname: '甲' } };
  const second: NewFriendItem = { createAccount: { accountId: 'a2' } };
  h.instance.state.listData = [first, second];
  h.instance.updateListData('a1', true);
  const list = h.instance.state.listData!;
  assert.notEqual(list[0], first, '命中项被替换');
  assert.equal(list[0]!.added, true);
  assert.equal(list[1], second, '未命中项引用不变');
});

check('add / refuse：成功标记；失败 alert(..., 2)', async () => {
  const ok = make({ agree: true, refuse: true });
  ok.instance.state.listData = [{ createAccount: { accountId: 'a1' } }];
  await ok.instance.add('a1');
  assert.equal(ok.instance.state.listData![0]!.added, true);
  await ok.instance.refuse('a1');
  assert.equal(ok.instance.state.listData![0]!.added, false);
  assert.deepEqual(ok.alerts, []);

  const bad = make({ agree: false, refuse: false });
  await bad.instance.add('a9');
  await bad.instance.refuse('a9');
  assert.deepEqual(bad.alerts, [
    { text: '操作失败，请重新尝试', level: 2 },
    { text: '操作失败，请重新尝试', level: 2 },
  ]);
});

check('componentDidUpdate：isLoaded 变 false → 重置分页并立即重新拉取', async () => {
  const h = make();
  h.instance.state.pageIndex = 3;
  h.instance.props.isLoaded = false;
  h.instance.componentDidUpdate({ isLoaded: true, update: h.instance.props.update });
  await flush();
  assert.deepEqual(h.apiCalls, [{ pageIndex: 1, pageSize: 10 }]);
  assert.equal(h.instance.state.pageIndex, 2);
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
  console.log(`chat/NewFriendsList 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
