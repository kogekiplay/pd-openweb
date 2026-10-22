/**
 * `src/pages/chat/lib/addressBook/containers/` 三个列表容器的行为规格
 * （持续目标·地址簿列表容器切片：Contacts / Others / Friends 共用的取数与分页、NewFriends 的加载标记、
 * SiderBar 的展开判定）。
 *
 * 【为什么这样测】这三处都是真实数据流：
 * - `fetchContacts`：无关键词时把回执 `list` 按首字母**分组**进 listData 并推进 pageIndex；有关键词时
 *   平铺 concat 且不推进页码；两种都返回 `list.length` 作为「还有更多」；
 * - `fetch`：`isLoading || !hasMore` 直接返回；否则置 isLoading 并在完成后写回 hasMore/pageIndex+1；
 * - `search`：先 abort 旧请求再重置分页并回调 `fetch`；`changeFilter` 翻转过滤开关并重置；
 * - `NewFriends.updateRecommendsFlag/updateApplysFlag`：写 loaded/have 并结束 firstLoading；
 *   `renderContent`：两类都加载完且都没有数据 → ListNull；否则列表 + 首屏加载态；
 * - `SiderBar.getOpenState`：项目行要 type+projectId 同时命中，非项目行只比 type。
 * 本 spec 从**真实源码**抽方法执行（不复制、不改产品源码），API/JSX 用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
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

const ROOT = 'src/pages/chat/lib/addressBook/containers/';
const FLUSH = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface VNode {
  type: unknown;
  props: Record<string, unknown>;
}

/** 从某个真实源码文件里抽出若干类方法，包成可注入依赖的工厂 */
function extractMethods(
  target: string,
  methods: string[],
  depNames: string[],
  extraMembers = '',
): (...deps: unknown[]) => (props: unknown, state: unknown, setState: (patch: Record<string, unknown>) => void) => Record<string, unknown> {
  const source = harness.readSource(target);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const found: Record<string, { start: number; end: number }> = {};
  const runtimeFields: string[] = [];
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ClassProperty' && node.key?.name === 'requestVersion' && typeof node.start === 'number' && typeof node.end === 'number') runtimeFields.push(source.slice(node.start, node.end));
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      typeof node.key.name === 'string' &&
      methods.includes(node.key.name) &&
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
  const missing = methods.filter((name) => !found[name]);
  if (missing.length) throw new Error(`${target} 里没有找到方法：${missing.join(', ')}`);
  const body = methods
    .map((name) => source.slice(found[name]!.start, found[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const wrapped = `var __cls = class {\n${runtimeFields.join('\n')}\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n${extraMembers}\n${body}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'abContainers-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const factory = new Function(
    ...depNames,
    'React',
    '_jsxRuntime',
    'require',
    `${code}\nreturn (props, state, setState) => new __cls(props, state, setState);`,
  ) as unknown as (...deps: unknown[]) => (
    props: unknown,
    state: unknown,
    setState: (patch: Record<string, unknown>) => void,
  ) => Record<string, unknown>;
  return factory;
}

const jsxStub = (type: unknown, props: Record<string, unknown>): VNode => {
  const name =
    typeof type === 'function' ? ((type as { displayName?: string }).displayName ?? 'Anonymous') : (type as string);
  return { type: name, props: props ?? {} };
};
const component = (name: string): ((props: Record<string, unknown>) => VNode) => {
  const fn = (props: Record<string, unknown>): VNode => ({ type: name, props: props ?? {} });
  (fn as unknown as { displayName?: string }).displayName = name;
  return fn;
};
const jsxRuntime = { jsx: jsxStub, jsxs: jsxStub, Fragment: 'Fragment' };
const reactStub = { createElement: jsxStub, Fragment: 'Fragment' };
const requireStub = (name: string): unknown => {
  if (name === 'react/jsx-runtime') return jsxRuntime;
  if (name === 'react') return reactStub;
  throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
};

const CONTACT_METHODS = ['fetchContacts', 'fetch', 'search', 'changeFilter', 'abortRequest'];
const CONTACT_DEPS = ['API', '_', 'shallowEqual', 'formatContactsData'];

const contactsFactory = extractMethods(`${ROOT}Contacts.tsx`, CONTACT_METHODS, CONTACT_DEPS);

interface ContactEnv {
  instance: Record<string, any>;
  apiCalls: { name: string; param: Record<string, unknown> }[];
  patches: Record<string, unknown>[];
  aborts: number;
  state: Record<string, any>;
}

function makeContacts(options: { list?: Record<string, unknown>[]; promiseResult?: unknown } = {}): ContactEnv {
  const apiCalls: { name: string; param: Record<string, unknown> }[] = [];
  const patches: Record<string, unknown>[] = [];
  let aborts = 0;
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  const lodash: typeof import('lodash') = require('lodash');
  const formatContactsData = (store: Record<string, unknown[]> | null, list: Record<string, unknown>[]) => {
    const result: Record<string, Record<string, unknown>[]> = (store || {}) as Record<string, Record<string, unknown>[]>;
    for (const item of list) {
      const firstCode = String((item as { firstCode?: string }).firstCode ?? '');
      const title = /[A-Z]/.test(firstCode.toUpperCase()) ? firstCode.toUpperCase() : '#';
      if (!result[title]) result[title] = [];
      result[title]!.push(item);
    }
    return result;
  };
  const create = contactsFactory(
    {
      fetchAllContacts: (param: Record<string, unknown>) => {
        apiCalls.push({ name: 'fetchAllContacts', param });
        const promise = Promise.resolve({ list: options.list ?? [] }) as Promise<unknown> & { abort: () => void };
        promise.abort = () => {
          aborts += 1;
        };
        return promise;
      },
    },
    lodash,
    shallowEqual,
    formatContactsData,
    reactStub,
    jsxRuntime,
    requireStub,
  );
  const state: Record<string, any> = {
    listData: null,
    isLoading: false,
    hasMore: true,
    selectedAccountId: null,
    pageIndex: 1,
    keywords: '',
    isFilterOther: true,
  };
  const instance = create({}, state, (patch: Record<string, unknown>, callback?: () => void) => {
    patches.push(patch);
    Object.assign(state, patch);
    if (callback) callback();
  });
  instance.promise = null;
  return { instance, apiCalls, patches, aborts, state };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('Contacts.fetchContacts（无关键词）：回执按首字母分组、pageIndex+1、返回条数', async () => {
  const h = makeContacts({ list: [{ accountId: 'a1', firstCode: 'A' }, { accountId: 'b1', firstCode: 'b' }] });
  const hasMore = await h.instance.fetchContacts();
  assert.deepEqual(h.apiCalls, [{ name: 'fetchAllContacts', param: { pageIndex: 1, isFilterOther: true, keywords: '' } }]);
  assert.deepEqual(h.state.listData, {
    A: [{ accountId: 'a1', firstCode: 'A' }],
    B: [{ accountId: 'b1', firstCode: 'b' }],
  });
  assert.equal(h.state.pageIndex, 2);
  assert.equal(hasMore, 2);
});

check('Contacts.fetchContacts（有关键词）：平铺 concat 且不推进页码', async () => {
  const h = makeContacts({ list: [{ accountId: 'a2', firstCode: 'A' }] });
  h.state.keywords = 'kw';
  h.state.listData = [{ accountId: 'a1', firstCode: 'A' }];
  await h.instance.fetchContacts();
  assert.deepEqual(h.state.listData, [
    { accountId: 'a1', firstCode: 'A' },
    { accountId: 'a2', firstCode: 'A' },
  ]);
  assert.equal(h.state.pageIndex, 1);
});

check('Contacts.fetch：isLoading 或 hasMore=false 直接返回；否则置 loading 并在完成后写回', async () => {
  const busy = makeContacts();
  busy.state.isLoading = true;
  busy.instance.fetch();
  await FLUSH();
  assert.deepEqual(busy.apiCalls, [], 'loading 中不请求');

  const ended = makeContacts();
  ended.state.hasMore = false;
  ended.instance.fetch();
  await FLUSH();
  assert.deepEqual(ended.apiCalls, [], '没有更多不请求');

  const ok = makeContacts({ list: [{ accountId: 'a1' }] });
  ok.instance.fetch();
  assert.deepEqual(ok.patches[0], { isLoading: true });
  await FLUSH();
  assert.equal(ok.state.isLoading, false);
  assert.equal(ok.state.hasMore, 1);
});

check('Contacts.search：先 abort 旧请求，再重置分页/关键词并回调 fetch', async () => {
  const h = makeContacts({ list: [{ accountId: 'a1' }] });
  let fetched = 0;
  h.instance.promise = { abort: () => (fetched += 1) };
  const calls: string[] = [];
  const realFetch = h.instance.fetch;
  h.instance.fetch = () => {
    calls.push('fetch');
    return realFetch.call(h.instance);
  };
  h.instance.search('kw');
  assert.equal(fetched, 1, '旧请求被 abort');
  assert.deepEqual(calls, ['fetch'], '回调触发 fetch');
  assert.equal(h.state.keywords, 'kw');
  assert.equal(h.state.pageIndex, 1);
  assert.equal(h.state.listData, null);
});

check('Contacts.changeFilter：翻转过滤开关并重置分页/数据', () => {
  const h = makeContacts();
  h.state.pageIndex = 3;
  h.state.listData = { A: [] };
  h.instance.fetch = () => undefined;
  h.instance.changeFilter();
  assert.equal(h.state.isFilterOther, false);
  assert.equal(h.state.pageIndex, 1);
  assert.equal(h.state.listData, null);
});

// ---------------- SiderBar ----------------
const siderFactory = extractMethods(`${ROOT}SiderBar.tsx`, ['getOpenState'], ['_', 'SiderBarTabItem', 'SiderBarTabList'], '');

function makeSider(): Record<string, any> {
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  void shallowEqual;
  const lodash: typeof import('lodash') = require('lodash');
  const create = siderFactory(lodash, component('SiderBarTabItem'), component('SiderBarTabList'), reactStub, jsxRuntime, requireStub);
  return create({}, {}, () => undefined);
}

check('SiderBar.getOpenState：项目行需 type+projectId 同时命中；非项目行只比 type', () => {
  const sider = makeSider();
  const list = [
    { type: 'allGroups', name: '全部群组' },
    { type: 'projectGroups', projectId: 'p1', name: '项目群组' },
  ];
  assert.equal(sider.getOpenState(list, 'p1', 'projectGroups'), true);
  assert.equal(sider.getOpenState(list, 'p2', 'projectGroups'), false);
  assert.equal(sider.getOpenState(list, '', 'allGroups'), true);
  // 既有语义：没有 projectId 时只比 type，因此项目行也会被命中（真实实现如此，未改）
  assert.equal(sider.getOpenState(list, '', 'projectGroups'), true);
});

// ---------------- NewFriends ----------------
const nfFactory = extractMethods(
  `${ROOT}NewFriends.tsx`,
  ['updateRecommendsFlag', 'updateApplysFlag', 'renderContent'],
  ['ScrollView', 'LoadDiv', 'ListNull', 'NewFriendsList', 'RecommendsList'],
);

function makeNewFriends(): { instance: Record<string, any>; patches: Record<string, unknown>[]; state: Record<string, any> } {
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  void shallowEqual;
  const create = nfFactory(
    component('ScrollView'),
    component('LoadDiv'),
    component('ListNull'),
    component('NewFriendsList'),
    component('RecommendsList'),
    reactStub,
    jsxRuntime,
    requireStub,
  );
  const patches: Record<string, unknown>[] = [];
  const state: Record<string, any> = {
    loadedRecommends: false,
    haveRecommends: true,
    loadedApplys: false,
    haveApplys: true,
    firstLoading: true,
  };
  const instance = create({}, state, (patch: Record<string, unknown>) => {
    patches.push(patch);
    Object.assign(state, patch);
  });
  return { instance, patches, state };
}

check('NewFriends.updateRecommendsFlag / updateApplysFlag：写 loaded+have 并结束 firstLoading', () => {
  const h = makeNewFriends();
  h.instance.updateRecommendsFlag(false);
  assert.deepEqual(h.patches[0], { loadedRecommends: true, haveRecommends: false, firstLoading: false });
  h.instance.updateApplysFlag(true);
  assert.deepEqual(h.patches[1], { loadedApplys: true, haveApplys: true, firstLoading: false });
});

check('NewFriends.renderContent：两类都加载完且都无数据 → ListNull；否则列表+首屏加载态', () => {
  const empty = makeNewFriends();
  empty.state.loadedRecommends = true;
  empty.state.loadedApplys = true;
  empty.state.haveRecommends = false;
  empty.state.haveApplys = false;
  const emptyTree = empty.instance.renderContent() as VNode;
  assert.equal(emptyTree.type, 'ListNull');
  assert.deepEqual(emptyTree.props, { type: 'newfriends' });

  const loading = makeNewFriends();
  const tree = loading.instance.renderContent() as VNode;
  assert.equal(tree.type, 'ScrollView');
  const children = tree.props.children as VNode[] | VNode;
  const childList = Array.isArray(children) ? children : [children];
  assert.deepEqual(
    childList.map((child) => child.type),
    ['div'],
  );
  const innerRaw = childList[0]!.props.children as VNode[] | VNode;
  const inner = Array.isArray(innerRaw) ? innerRaw : [innerRaw];
  assert.deepEqual(
    inner.map((child) => child.type),
    ['NewFriendsList', 'RecommendsList', 'LoadDiv'],
    '首屏仍有 LoadDiv',
  );
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
  console.log(`chat/AddressBookContainers 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
