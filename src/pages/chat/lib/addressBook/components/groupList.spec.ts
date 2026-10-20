/**
 * `src/pages/chat/lib/addressBook/components/GroupList.tsx` 的行为规格
 * （持续目标·群列表渲染切片）。
 *
 * 【为什么这样测】群列表容器把两种数据形态渲染成同一列表：
 * - **非搜索**：`list` 是「首字母 → 群数组」字典，键按字母排序后逐组渲染（标题 + 组内行），
 *   空数据时按 `isLoading` 选择加载态/空状态；
 * - **搜索**：`list` 是平铺数组，直接渲染行，空且非 loading → 空状态；
 * - 行内 `isSelected` 由 `item.groupId === props.selectedGroupId` 决定，点击回调透传父级；
 * - `componentDidMount` / 滚动到底（throttle 包装前的原始方法）都调用父级 `fetch`。
 * 本 spec 从**真实源码**抽出这些方法执行（不复制、不改产品源码），子组件用记录桩。
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

const TARGET = 'src/pages/chat/lib/addressBook/components/GroupList.tsx';

interface GroupRow {
  groupId?: string;
  name?: string;
}

interface Props {
  fetch: () => void;
  itemClickHandler: (groupId: string) => void;
  list: Record<string, GroupRow[]> | GroupRow[] | null;
  isLoading: boolean;
  isSearch: boolean;
  selectedGroupId?: string | null;
}

interface VNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

type JsxRecord = (type: unknown, props: Record<string, unknown>) => VNode;
interface JsxRuntimeStub {
  jsx: JsxRecord;
  jsxs: JsxRecord;
  Fragment?: string;
}

interface Instance {
  props: Props;
  componentDidMount: () => void;
  scrollEvent: () => void;
  renderSingleList: (listProps: { title?: string; list?: GroupRow[] }) => VNode;
  renderListContent: () => VNode | null;
}

function extract(): (
  lodash: typeof import('lodash'),
  React: { Fragment: string },
  GroupItem: string,
  ListNull: string,
  LoadDiv: string,
  jsx: JsxRuntimeStub,
  requireStub: (name: string) => unknown,
) => (props: Props) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['componentDidMount', 'scrollEvent', 'renderSingleList', 'renderListContent'];
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
  const wrapped = `var __cls = class {\n  constructor(props) {\n    this.props = props;\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'groupList-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'React',
    'GroupItem',
    'ListNull',
    'LoadDiv',
    '_jsxRuntime',
    'require',
    `${code}\nreturn (props) => new __cls(props);`,
  ) as (
    lodash: typeof import('lodash'),
    React: { Fragment: string },
    GroupItem: string,
    ListNull: string,
    LoadDiv: string,
    jsx: JsxRuntimeStub,
    requireStub: (name: string) => unknown,
  ) => (props: Props) => Instance;
}

const factory = extract();

function make(props: Props): {
  instance: Instance;
  records: { kind: string; props: Record<string, unknown> }[];
  collect: (tree: unknown, type: string) => VNode[];
} {
  const records: { kind: string; props: Record<string, unknown> }[] = [];
  const record = (type: unknown, props: Record<string, unknown>): VNode => ({ type, props: props ?? {} });
  const jsx: JsxRuntimeStub = { jsx: record, jsxs: record, Fragment: 'Fragment' };
  // 字符串标记：classic createElement / automatic jsx 都会把 type 原样放进 VNode
  const GroupItem = 'GroupItem';
  const ListNull = 'ListNull';
  const LoadDiv = 'LoadDiv';
  void records;
  const create = factory(
    _lodash,
    { Fragment: 'Fragment' },
    GroupItem,
    ListNull,
    LoadDiv,
    jsx,
    (name: string) => {
      if (name === 'react/jsx-runtime') return jsx;
      if (name === 'react') {
        const recordReact = (type: unknown, props: Record<string, unknown>, ...children: unknown[]): VNode =>
          record(type, { ...(props ?? {}), children: children.length === 1 ? children[0] : children });
        return { Fragment: 'Fragment', createElement: recordReact };
      }
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  const collect = (tree: unknown, type: string, out: VNode[] = []): VNode[] => {
    if (tree === null || tree === undefined || typeof tree === 'boolean') return out;
    if (typeof tree === 'string' || typeof tree === 'number') return out;
    if (Array.isArray(tree)) {
      for (const item of tree) collect(item, type, out);
      return out;
    }
    const vnode = tree as VNode;
    if (vnode.type === type) out.push(vnode);
    collect(vnode.props?.children, type, out);
    return out;
  };
  return { instance: create(props), records, collect };
}

function texts(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) texts(item, out);
    return out;
  }
  const vnode = node as VNode;
  texts(vnode.props?.children, out);
  return out;
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('componentDidMount / scrollEvent：都走父级 fetch', () => {
  let calls = 0;
  const { instance } = make({
    fetch: () => {
      calls += 1;
    },
    itemClickHandler: () => {},
    list: null,
    isLoading: false,
    isSearch: false,
  });
  instance.componentDidMount();
  instance.scrollEvent();
  assert.equal(calls, 2);
});

check('renderListContent（非搜索）：按键名排序，逐组渲染标题与行', () => {
  const clicked: string[] = [];
  const { instance, collect: collectTree } = make({
    fetch: () => {},
    itemClickHandler: (groupId) => clicked.push(groupId),
    list: {
      B: [{ groupId: 'g2', name: '乙组' }],
      A: [{ groupId: 'g1', name: '甲组' }],
    },
    isLoading: false,
    isSearch: false,
    selectedGroupId: 'g2',
  });
  const tree = instance.renderListContent();
  const all = texts(tree);
  const titles = all.filter((text) => text === 'A' || text === 'B');
  assert.deepEqual(titles, ['A', 'B'], '组标题按字母排序');
  const items = collectTree(tree, 'GroupItem');
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.props.name).sort(),
    ['乙组', '甲组'],
    '行数据原样透传',
  );
  const selected = items.filter((item) => item.props.isSelected === true);
  assert.equal(selected.length, 1);
  assert.equal(selected[0]!.props.groupId, 'g2', '选中标记由 groupId === selectedGroupId 决定');
  (items.find((item) => item.props.groupId === 'g1')!.props.itemClickHandler as (id: string) => void)('g1');
  assert.deepEqual(clicked, ['g1'], '点击回调透传父级');
});

check('renderListContent（非搜索）：空数据 + isLoading → 加载态；空且非 loading → 空状态', () => {
  const loading = make({
    fetch: () => {},
    itemClickHandler: () => {},
    list: {},
    isLoading: true,
    isSearch: false,
  });
  const loadingTree = loading.instance.renderListContent();
  assert.equal(loading.collect(loadingTree, 'LoadDiv').length, 1, '仅第一屏加载态');

  const empty = make({
    fetch: () => {},
    itemClickHandler: () => {},
    list: {},
    isLoading: false,
    isSearch: false,
  });
  const emptyTree = empty.instance.renderListContent();
  const nulls = empty.collect(emptyTree, 'ListNull');
  assert.equal(nulls.length, 1);
  assert.deepEqual(nulls[0]!.props, { isSearch: false, type: 'groups' });
});

check('renderListContent（搜索）：空且非 loading → 空状态；平铺数组逐行渲染并标选中', () => {
  const emptySearch = make({
    fetch: () => {},
    itemClickHandler: () => {},
    list: [],
    isLoading: false,
    isSearch: true,
  });
  const emptySearchTree = emptySearch.instance.renderListContent();
  assert.equal(emptySearch.collect(emptySearchTree, 'ListNull').length, 1);

  const search = make({
    fetch: () => {},
    itemClickHandler: () => {},
    list: [{ groupId: 'g1' }, { groupId: 'g2' }],
    isLoading: false,
    isSearch: true,
    selectedGroupId: 'g1',
  });
  const searchTree = search.instance.renderListContent();
  const items = search.collect(searchTree, 'GroupItem');
  assert.equal(items.length, 2);
  assert.equal(items[0]!.props.isSelected, true);
  assert.equal(items[1]!.props.isSelected, false);
});

check('renderListContent（搜索）：isLoading 时行后追加 LoadDiv', () => {
  const search = make({
    fetch: () => {},
    itemClickHandler: () => {},
    list: [{ groupId: 'g1' }],
    isLoading: true,
    isSearch: true,
  });
  const loadingTree2 = search.instance.renderListContent();
  assert.equal(search.collect(loadingTree2, 'GroupItem').length, 1);
  assert.equal(search.collect(loadingTree2, 'LoadDiv').length, 1);
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
  console.log(`chat/GroupList 行为规格通过：${passed} 项`);
}

main();
