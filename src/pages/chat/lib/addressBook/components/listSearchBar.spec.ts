/**
 * `src/pages/chat/lib/addressBook/components/ListSearchBar.tsx` 的行为规格
 * （持续目标·地址簿搜索条切片）。
 *
 * 【为什么这样测】`SearchBar` 是 class 组件，本仓没有 render 测试设施；但它是地址簿列表的**搜索输入**：
 * 输入变化先回写本地值、再把关键词交给 500ms 防抖的 `search`；外部 `keywords` 变化时要同步输入框；
 * 卸载时取消未触发的防抖，避免卸载后回调。本 spec 从**真实源码**抽出这三个方法执行
 * （不复制、不改产品源码），防抖函数用记录桩。
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

const TARGET = 'src/pages/chat/lib/addressBook/components/ListSearchBar.tsx';

interface BarState {
  value?: string | undefined;
}

interface Instance {
  props: { keywords?: string; search: (value: string) => void };
  state: BarState;
  search?: { (value: string): void; cancel?: () => void };
  setState: (patch: Partial<BarState>) => void;
  searchHandler: (event: { target: { value: string } }) => void;
  componentDidUpdate: (prevProps: Instance['props']) => void;
  componentWillUnmount: () => void;
}

function extract(): (
  props: Instance['props'],
  state: BarState,
  setState: Instance['setState'],
  search: Instance['search'],
) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['componentDidUpdate', 'componentWillUnmount', 'searchHandler'];
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
  const wrapped = `var __cls = class {\n  constructor(props, state, setState, search) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n    this.search = search;\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'listSearchBar-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    '_',
    'shallowEqual',
    `${code}\nreturn (props, state, setState, search) => new __cls(props, state, setState, search);`,
  ) as (
    lodash: typeof import('lodash'),
    equal: (a: unknown, b: unknown) => boolean,
  ) => (
    props: Instance['props'],
    state: BarState,
    setState: Instance['setState'],
    search: Instance['search'],
  ) => Instance;
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  return create(_lodash, shallowEqual);
}

const factory = extract();

function make(props: Instance['props'], state: BarState = { value: '' }): {
  instance: Instance;
  searched: string[];
  patches: Partial<BarState>[];
  cancelled: { count: number };
} {
  const searched: string[] = [];
  const patches: Partial<BarState>[] = [];
  const cancelled = { count: 0 };
  const search = (value: string) => {
    searched.push(value);
  };
  (search as { cancel?: () => void }).cancel = () => {
    cancelled.count += 1;
  };
  let instance: Instance;
  instance = factory(props, state, (patch: Partial<BarState>) => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  }, search);
  return { instance, searched, patches, cancelled };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('searchHandler：回写输入值并把关键词交给防抖搜索', () => {
  const { instance, searched, patches } = make({ search: () => {}, keywords: '' });
  instance.searchHandler({ target: { value: '张三' } });
  assert.deepEqual(patches, [{ value: '张三' }]);
  assert.deepEqual(searched, ['张三']);
});

check('searchHandler：连续输入每次都回写，但只把当前值交出去（防抖由 debounce 负责）', () => {
  const { instance, searched } = make({ search: () => {}, keywords: '' });
  instance.searchHandler({ target: { value: 'a' } });
  instance.searchHandler({ target: { value: 'ab' } });
  assert.deepEqual(searched, ['a', 'ab']);
});

check('componentDidUpdate：外部 keywords 变化 → 同步输入框', () => {
  const { instance, patches } = make({ search: () => {}, keywords: '旧' }, { value: '旧' });
  instance.componentDidUpdate({ search: () => {}, keywords: '旧' });
  assert.deepEqual(patches, [], '未变化不同步');
  instance.props.keywords = '新';
  instance.componentDidUpdate({ search: () => {}, keywords: '旧' });
  assert.deepEqual(patches, [{ value: '新' }], '变化后同步');
});

check('componentWillUnmount：取消未触发的防抖', () => {
  const { instance, cancelled } = make({ search: () => {}, keywords: '' });
  instance.componentWillUnmount();
  assert.equal(cancelled.count, 1);
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
  console.log(`chat/ListSearchBar 行为规格通过：${passed} 项`);
}

main();
