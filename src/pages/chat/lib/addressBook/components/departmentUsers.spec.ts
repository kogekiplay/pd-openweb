/**
 * `src/pages/chat/lib/addressBook/components/DepartmentUsers.tsx` 的行为规格
 * （持续目标·部门成员列表切片）。
 *
 * 【为什么这样测】`DepartmentUsers` 是 class 组件；它的 `handleScrollEnd` 决定滚到底时是
 * **继续加载全部成员**还是**切到下一个部门**（按当前部门是否等于账号所在项目判断），
 * `componentDidUpdate` 决定「换部门时收起详情、外部选中人时打开详情」。这些直接决定列表交互。
 * 本 spec 从**真实源码**抽出相应方法执行（不复制、不改产品源码），`md` 全局由参数注入。
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
  value?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/components/DepartmentUsers.tsx';

interface Props {
  groupId?: string;
  selectedAccountId?: string | null;
  isMoreUsers?: boolean;
  projectId?: string;
  handleLoadAll: () => void;
  handleSelectGroup: (id?: string) => void;
  usersLoading?: boolean;
  groupList?: unknown[];
  allCount?: number;
  groupName?: string;
  hideBackBtn?: boolean;
}

interface State {
  showDetail: boolean;
  selectedAccountId?: string | null | undefined;
}

interface Instance {
  props: Props;
  state: State;
  setState: (patch: Partial<State>) => void;
  handleScrollEnd: () => void;
  componentDidUpdate: (prevProps: Props) => void;
}

function extract(): (
  lodash: typeof import('lodash'),
  equal: (a: unknown, b: unknown) => boolean,
  mdStub: { global: { Account: { projects: { projectId?: string }[] } } },
) => (props: Props, state: State, setState: Instance['setState']) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted: Record<string, 'method' | 'property'> = {
    componentDidUpdate: 'method',
    handleScrollEnd: 'property',
  };
  const found: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    const keyName = node.key && typeof node.key.name === 'string' ? node.key.name : undefined;
    if (keyName && keyName in wanted) {
      if (node.type === 'ClassMethod' && typeof node.start === 'number' && typeof node.end === 'number') {
        found[keyName] = { start: node.start, end: node.end };
      }
      if (
        node.type === 'ClassProperty' &&
        node.value &&
        node.value.type === 'ArrowFunctionExpression' &&
        typeof node.value.start === 'number' &&
        typeof node.value.end === 'number'
      ) {
        found[keyName] = { start: node.value.start as number, end: node.value.end as number };
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
  const missing = Object.keys(wanted).filter((name) => !found[name]);
  if (missing.length) throw new Error(`真实源码里没有找到方法：${missing.join(', ')}`);

  const method = source
    .slice(found.componentDidUpdate!.start, found.componentDidUpdate!.end)
    .replace(/^\s*override\s+/, '');
  const property = source.slice(found.handleScrollEnd!.start, found.handleScrollEnd!.end);
  const wrapped = `var __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n  handleScrollEnd = ${property};\n  ${method}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'departmentUsers-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'shallowEqual',
    'md',
    `${code}\nreturn (props, state, setState) => new __cls(props, state, setState);`,
  ) as (
    lodash: typeof import('lodash'),
    equal: (a: unknown, b: unknown) => boolean,
    mdStub: { global: { Account: { projects: { projectId?: string }[] } } },
  ) => (props: Props, state: State, setState: Instance['setState']) => Instance;
}

const factory = extract();

function make(
  props: Props,
  projects: { projectId?: string }[] = [{ projectId: 'p1' }],
): { instance: Instance; patches: Partial<State>[]; calls: string[] } {
  const patches: Partial<State>[] = [];
  const calls: string[] = [];
  const patched = {
    ...props,
    handleLoadAll: () => calls.push('loadAll'),
    handleSelectGroup: () => calls.push('selectGroup'),
  };
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  let instance: Instance;
  const create = factory(_lodash, shallowEqual, { global: { Account: { projects } } });
  instance = create(patched, { showDetail: false }, (patch: Partial<State>) => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  });
  return { instance, patches, calls };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('handleScrollEnd：没有更多成员时不触发任何加载', () => {
  const { instance, calls } = make({
    projectId: 'p1',
    groupId: 'p1',
    isMoreUsers: false,
    handleLoadAll: () => {},
    handleSelectGroup: () => {},
  });
  instance.handleScrollEnd();
  assert.deepEqual(calls, []);
});

check('handleScrollEnd：当前部门等于账号所在项目 → 加载全部成员', () => {
  const { instance, calls } = make({
    projectId: 'p1',
    groupId: 'p1',
    isMoreUsers: true,
    handleLoadAll: () => {},
    handleSelectGroup: () => {},
  });
  instance.handleScrollEnd();
  assert.deepEqual(calls, ['loadAll']);
});

check('handleScrollEnd：当前部门不是所在项目 → 切到下一个部门', () => {
  const { instance, calls } = make({
    projectId: 'p1',
    groupId: 'g2',
    isMoreUsers: true,
    handleLoadAll: () => {},
    handleSelectGroup: () => {},
  });
  instance.handleScrollEnd();
  assert.deepEqual(calls, ['selectGroup']);
});

check('componentDidUpdate：换部门 → 收起详情', () => {
  const base = { handleLoadAll: () => {}, handleSelectGroup: () => {} };
  const { instance, patches } = make({ ...base, groupId: 'g2' });
  instance.componentDidUpdate({ ...base, groupId: 'g1' });
  assert.deepEqual(patches, [{ showDetail: false }]);
});

check('componentDidUpdate：外部选中人变化 → 记录并打开详情', () => {
  const base = { handleLoadAll: () => {}, handleSelectGroup: () => {} };
  const { instance, patches } = make({ ...base, selectedAccountId: 'a2' });
  instance.componentDidUpdate({ ...base, selectedAccountId: 'a1' });
  assert.deepEqual(patches, [{ selectedAccountId: 'a2', showDetail: true }]);
});

check('componentDidUpdate：相同 props → 不变更', () => {
  const base = { handleLoadAll: () => {}, handleSelectGroup: () => {}, selectedAccountId: 'a1', groupId: 'g1' };
  const { instance, patches } = make({ ...base });
  instance.componentDidUpdate({ ...base });
  assert.deepEqual(patches, []);
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
  console.log(`chat/DepartmentUsers 行为规格通过：${passed} 项`);
}

main();
