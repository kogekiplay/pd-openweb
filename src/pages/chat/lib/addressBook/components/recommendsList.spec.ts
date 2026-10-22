/**
 * `src/pages/chat/lib/addressBook/components/RecommendsList.tsx` 的行为规格
 * （持续目标·推荐好友列表切片）。
 *
 * 【为什么这样测】该组件把推荐好友的分页/忽略/添加逻辑落到三个真实方法：
 * - `fetch`：按 `isLoading/hasMore` 防重入，成功时把 `list` 追加到 `listData`、`pageIndex+1`、
 *   `hasMore` 按「是否满 10 条」判断，**最后**才 `props.update(allCount !== 0)`（避免提前 render）；
 * - `updateListData`：按 accountId 就地标记 `added`（只替换命中项）；
 * - `ignore`：忽略接口成功 → 标记已忽略；失败 → `alert(..., 2)`。
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

const TARGET = 'src/pages/chat/lib/addressBook/components/RecommendsList.tsx';

interface RecommendItem {
  accountId?: string;
  fullname?: string;
  added?: boolean;
}

interface Props {
  isLoaded: boolean;
  update: (hasRecommends: boolean) => void;
}

interface State {
  isLoading: boolean;
  pageIndex: number;
  hasMore: boolean | undefined;
  listData: (RecommendItem | undefined)[] | null;
}

interface ApiStub {
  fetchRecommends: (param: { pageIndex: number; pageSize: number }) => Promise<{ allCount?: number; list?: RecommendItem[] }>;
}

interface Instance {
  props: Props;
  state: State;
  setState: (patch: Partial<State>, callback?: () => void) => void;
  fetch: () => void;
  updateListData: (accountId: string, isAdd: boolean) => void;
  ignore: (accountId: string) => Promise<void>;
  componentDidUpdate: (prevProps: Props) => void;
}

function extract(): (
  lodash: typeof import('lodash'),
  api: ApiStub,
  editIgnore: (accountId: string) => Promise<boolean>,
  translate: (key: string, ...args: unknown[]) => string,
  alertStub: (text: string, level?: number) => void,
  equal: (a: unknown, b: unknown) => boolean,
  requireStub: (name: string) => unknown,
) => (props: Props, state: State, setState: Instance['setState']) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['componentDidUpdate', 'updateListData', 'ignore', 'fetch'];
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
  const transformed = harness.transformSync(wrapped, { filename: 'recommendsList-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'API',
    'editIgnoreRecommends',
    '_l',
    'alert',
    'shallowEqual',
    'require',
    `${code}\nreturn (props, state, setState) => new __cls(props, state, setState);`,
  ) as (
    lodash: typeof import('lodash'),
    api: ApiStub,
    editIgnore: (accountId: string) => Promise<boolean>,
    translate: (key: string, ...args: unknown[]) => string,
    alertStub: (text: string, level?: number) => void,
    equal: (a: unknown, b: unknown) => boolean,
    requireStub: (name: string) => unknown,
  ) => (props: Props, state: State, setState: Instance['setState']) => Instance;
}

const factory = extract();

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function make(
  options: {
    allCount?: number;
    list?: RecommendItem[];
    ignoreResult?: boolean;
    omitList?: boolean;
  } = {},
): {
  instance: Instance;
  apiCalls: { pageIndex: number; pageSize: number }[];
  updates: boolean[];
  alerts: { text: string; level?: number }[];
  flush: () => Promise<void>;
} {
  const apiCalls: { pageIndex: number; pageSize: number }[] = [];
  const updates: boolean[] = [];
  const alerts: { text: string; level?: number }[] = [];
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  const create = factory(
    _lodash,
    {
      fetchRecommends: (param) => {
        apiCalls.push(param);
        return Promise.resolve({ allCount: options.allCount ?? 2, list: options.omitList ? undefined : options.list ?? [{ accountId: 'a1' }] });
      },
    },
    () => Promise.resolve(options.ignoreResult ?? true),
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
  return { instance, apiCalls, updates, alerts, flush };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('fetch：追加列表、pageIndex+1、按满 10 条算 hasMore，最后才 update(true)', async () => {
  const h = make({ allCount: 2, list: [{ accountId: 'a1' }, { accountId: 'a2' }] });
  h.instance.fetch();
  await h.flush();
  assert.deepEqual(h.apiCalls, [{ pageIndex: 1, pageSize: 10 }], '按当前 pageIndex 请求');
  assert.deepEqual(h.updates, [true], 'update(allCount !== 0)');
  assert.deepEqual(
    h.instance.state.listData!.map((item) => item.accountId),
    ['a1', 'a2'],
  );
  assert.equal(h.instance.state.pageIndex, 2);
  assert.equal(h.instance.state.hasMore, false, '不足 10 条没有更多');
  assert.equal(h.instance.state.isLoading, false);
});

check('fetch：满 10 条 → hasMore=true', async () => {
  const list = Array.from({ length: 10 }, (_item, index) => ({ accountId: `a${index}` }));
  const h = make({ allCount: 10, list });
  h.instance.fetch();
  await h.flush();
  assert.equal(h.instance.state.hasMore, true);
  assert.equal(h.instance.state.listData!.length, 10);
});

check('fetch：缺失 list 保留 undefined 哨兵，局部更新保持哨兵且不崩溃', async () => {
  const h = make({ omitList: true });
  h.instance.fetch();
  await h.flush();
  assert.equal(h.instance.state.hasMore, undefined);
  assert.deepEqual(h.instance.state.listData, [undefined]);
  assert.deepEqual(h.updates, [true]);
  h.instance.updateListData('a1', true);
  assert.deepEqual(h.instance.state.listData, [undefined], '局部更新保留原 undefined 哨兵');
  const broken: RecommendItem = {};
  const reason = new Error('account getter failure');
  Object.defineProperty(broken, 'accountId', { get() { throw reason; } });
  h.instance.state.listData = [broken];
  assert.throws(() => h.instance.updateListData('a1', true), error => error === reason, '非 nil 行原字段 getter 异常原样保留');
});

check('fetch：allCount === 0 → 不追加列表，仍 update(false)', async () => {
  const h = make({ allCount: 0, list: [{ accountId: 'x' }] });
  h.instance.fetch();
  await h.flush();
  assert.equal(h.instance.state.listData, null, '列表保持原值');
  assert.deepEqual(h.updates, [false]);
});

check('fetch：isLoading 或 !hasMore 时直接返回（不发请求）', async () => {
  const h = make();
  h.instance.state.isLoading = true;
  h.instance.fetch();
  await h.flush();
  assert.deepEqual(h.apiCalls, []);
  h.instance.state.isLoading = false;
  h.instance.state.hasMore = false;
  h.instance.fetch();
  await h.flush();
  assert.deepEqual(h.apiCalls, []);
});

check('updateListData：按 accountId 标记 added，其它项保持原对象', () => {
  const h = make();
  const first: RecommendItem = { accountId: 'a1', fullname: '甲' };
  const second: RecommendItem = { accountId: 'a2', fullname: '乙' };
  h.instance.state.listData = [first, second];
  h.instance.updateListData('a1', true);
  const list = h.instance.state.listData!;
  assert.notEqual(list[0], first, '命中项被替换');
  assert.equal(list[0]!.added, true);
  assert.equal(list[0]!.fullname, '甲', '命中项字段保留');
  assert.equal(list[1], second, '未命中项引用不变');
});

check('ignore：接口成功 → 标记已忽略；失败 → alert(..., 2)', async () => {
  const ok = make({ ignoreResult: true });
  ok.instance.state.listData = [{ accountId: 'a1' }];
  await ok.instance.ignore('a1');
  assert.equal(ok.instance.state.listData![0]!.added, false, '成功标记为已忽略');
  assert.deepEqual(ok.alerts, []);

  const fail = make({ ignoreResult: false });
  await fail.instance.ignore('a1');
  assert.deepEqual(fail.alerts, [{ text: '操作失败，请重新尝试', level: 2 }]);
});

check('componentDidUpdate：isLoaded 变 false → 重置分页并立即重新拉取', async () => {
  const h = make();
  h.instance.state.listData = [{ accountId: 'old' }];
  h.instance.state.pageIndex = 3;
  h.instance.props.isLoaded = false;
  h.instance.componentDidUpdate({ isLoaded: true, update: h.instance.props.update });
  await h.flush();
  assert.deepEqual(h.apiCalls, [{ pageIndex: 1, pageSize: 10 }], '重置后从第一页拉取');
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
  console.log(`chat/RecommendsList 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
