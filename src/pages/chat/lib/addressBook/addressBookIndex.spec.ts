/**
 * `src/pages/chat/lib/addressBook/index.tsx` 的行为规格
 * （持续目标·地址簿弹层入口切片）。
 *
 * 【为什么这样测】入口文件有两个真实逻辑：
 * - `AddressBook.shouldComponentUpdate`：**只有 state 变化才重渲染**（props 变化不触发）；
 * - `AddressBook.updateHighlightTab` / `renderContent`：切换左侧分组后按 `TYPES` 渲染对应子面板
 *   （new friends / groups / contacts / friends / others / project contacts / apps）；
 * - `AddressBookDialog`：`showAddressBook` 为假时**返回 null**；为真时把 `config.callback` 指到
 *   `closeDialog` 并渲染 Dialog（关闭图标调用 closeDialog）。
 * 本 spec 从**真实源码**抽出这些函数执行（不复制、不改产品源码），子组件/Dialog/配置用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/lib/addressBook/index.tsx';

interface VNode {
  type: unknown;
  props: Record<string, unknown>;
}

interface Instance {
  props: { type?: string };
  state: { type?: string; projectId: string | null; list: unknown[] };
  setState: (patch: Partial<Instance['state']>) => void;
  shouldComponentUpdate: (nextProps: unknown, nextState: unknown) => boolean;
  updateHighlightTab: (type: string, projectId: string) => void;
  renderContent: () => VNode | null | undefined;
}

type Deps = [
  config: { callback?: unknown },
  TYPES: Record<string, string>,
  SIDER_BAR_LIST: unknown[],
  gatherProjects: () => unknown[],
  shallowEqual: (a: unknown, b: unknown) => boolean,
  Apps: (props: Record<string, unknown>) => VNode,
  Contacts: (props: Record<string, unknown>) => VNode,
  Friends: (props: Record<string, unknown>) => VNode,
  Groups: (props: Record<string, unknown>) => VNode,
  NewFriends: (props: Record<string, unknown>) => VNode,
  Others: (props: Record<string, unknown>) => VNode,
  ProjectContacts: (props: Record<string, unknown>) => VNode,
  Dialog: (props: Record<string, unknown>) => VNode,
  Icon: (props: Record<string, unknown>) => VNode,
  AddressBook: (props: Record<string, unknown>) => VNode,
  React: { Component: unknown; Fragment?: string },
  jsx: (type: unknown, props: Record<string, unknown>) => VNode,
  requireStub: (name: string) => unknown,
];

interface Built {
  createAddressBook: (props: Instance['props'], state: Instance['state'], setState: Instance['setState']) => Instance;
  dialog: (props: Record<string, unknown>) => VNode | null;
}

function extract(): (...deps: Deps) => Built {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wantedMethods = ['shouldComponentUpdate', 'updateHighlightTab', 'renderContent'];
  const found: Record<string, { start: number; end: number }> = {};
  let dialogFound: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      typeof node.key.name === 'string' &&
      wantedMethods.includes(node.key.name) &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found[node.key.name] = { start: node.start, end: node.end };
    }
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'AddressBookDialog') {
      if (typeof node.start === 'number' && typeof node.end === 'number') {
        dialogFound = { start: node.start, end: node.end };
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
  const missing = wantedMethods.filter((name) => !found[name]);
  const dialogLoc = dialogFound as { start: number; end: number } | null;
  if (missing.length || !dialogLoc) throw new Error(`真实源码里缺少：${missing.join(', ') || 'AddressBookDialog'}`);

  const methods = wantedMethods
    .map((name) => source.slice(found[name]!.start, found[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const dialogSource = source.slice(dialogLoc.start, dialogLoc.end).replace(/^export default function/, 'function');
  const wrapped = `var __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n${methods}\n};\n${dialogSource}\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'addressBookIndex-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'config',
    'TYPES',
    'SIDER_BAR_LIST',
    'gatherProjects',
    'shallowEqual',
    'Apps',
    'Contacts',
    'Friends',
    'Groups',
    'NewFriends',
    'Others',
    'ProjectContacts',
    'Dialog',
    'Icon',
    'AddressBook',
    'React',
    '_jsxRuntime',
    'require',
    `${code}\nreturn {\n  createAddressBook: (props, state, setState) => new __cls(props, state, setState),\n  dialog: (props) => AddressBookDialog(props),\n};`,
  ) as unknown as (...deps: Deps) => Built;
}

function makeEnv(): {
  TYPES: Record<string, string>;
  SIDER_BAR_LIST: unknown[];
  gatherProjects: () => unknown[];
  config: { callback?: unknown };
  createAddressBook: (props: Instance['props'], state: Instance['state']) => { instance: Instance; patches: Partial<Instance['state']>[] };
  dialog: (props: Record<string, unknown>) => VNode | null;
} {
  const TYPES = {
    NEW_FRIENDS: 'newFriends',
    ALL_GROUPS: 'allGroups',
    PROJECT_GROUPS: 'projectGroups',
    ALL_CONTACTS: 'allContacts',
    FRIENDS: 'friends',
    OTHERS: 'others',
    PROJECT_CONTACTS: 'projectContacts',
    CONTACTS: 'contacts',
    INBOX: 'inbox',
  };
  const SIDER_BAR_LIST = [{ type: 'newFriends', name: '新朋友' }];
  const config: { callback?: unknown } = {};
  const record = (name: string) => (props: Record<string, unknown>): VNode => ({ type: name, props });
  // JSX 桩：组件函数按 displayName 记名字，便于断言选了哪个子面板
  const jsx = (type: unknown, props: Record<string, unknown>): VNode => {
    const name =
      typeof type === 'function'
        ? ((type as { displayName?: string }).displayName ?? 'Anonymous')
        : (type as string);
    return { type: name, props: props ?? {} };
  };
  const create = extract();
  // 每个宿主用「返回自身名字」的记录组件，便于断言选了哪个子面板
  const component = (name: string): ((props: Record<string, unknown>) => VNode) => {
    const fn = (props: Record<string, unknown>): VNode => ({ type: name, props: props ?? {} });
    (fn as unknown as { displayName?: string }).displayName = name;
    return fn;
  };
  const env = create(
    config,
    TYPES,
    SIDER_BAR_LIST,
    () => [{ projectId: 'p1', name: '项目一' }],
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
    component('Apps'),
    component('Contacts'),
    component('Friends'),
    component('Groups'),
    component('NewFriends'),
    component('Others'),
    component('ProjectContacts'),
    component('Dialog'),
    component('Icon'),
    component('AddressBook'),
    { Component: class {}, Fragment: 'Fragment' },
    jsx,
    (name: string) => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  const createAddressBook = (props: Instance['props'], state: Instance['state']) => {
    const patches: Partial<Instance['state']>[] = [];
    let instance: Instance;
    instance = env.createAddressBook(props, state, (patch) => {
      patches.push(patch);
      Object.assign(instance.state, patch);
    });
    return { instance, patches };
  };
  return {
    TYPES,
    SIDER_BAR_LIST,
    gatherProjects: () => [{ projectId: 'p1', name: '项目一' }],
    config,
    createAddressBook,
    dialog: env.dialog,
  };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('shouldComponentUpdate：只有 state 变化才重渲染', () => {
  const env = makeEnv();
  const { instance } = env.createAddressBook({ type: 'allContacts' }, { type: 'allContacts', projectId: null, list: [] });
  assert.equal(instance.shouldComponentUpdate({ type: 'x' }, { type: 'allContacts', projectId: null, list: [] }), false);
  assert.equal(instance.shouldComponentUpdate({ type: 'x' }, { type: 'friends', projectId: null, list: [] }), true);
});

check('updateHighlightTab：写回 type 与 projectId', () => {
  const env = makeEnv();
  const { instance, patches } = env.createAddressBook(
    { type: 'allContacts' },
    { type: 'allContacts', projectId: null, list: [] },
  );
  instance.updateHighlightTab('projectGroups', 'p9');
  assert.deepEqual(patches, [{ type: 'projectGroups', projectId: 'p9' }]);
});

check('renderContent：按 TYPES 渲染对应子面板（含 projectId 透传）', () => {
  const env = makeEnv();
  const { instance } = env.createAddressBook(
    { type: 'allContacts' },
    { type: 'projectContacts', projectId: null, list: [] },
  );
  const node = instance.renderContent();
  assert.ok(node);
  assert.equal(node!.type, 'ProjectContacts');
  assert.equal(node!.props.projectId, null, 'projectId 原样透传（null=不限项目）');

  instance.state.type = env.TYPES.ALL_CONTACTS;
  assert.equal(instance.renderContent()!.type, 'Contacts');
  instance.state.type = env.TYPES.INBOX;
  assert.equal(instance.renderContent()!.type, 'Apps');
  instance.state.type = 'unknown';
  assert.equal(instance.renderContent(), undefined, '未知类型返回 undefined');
});

check('AddressBookDialog：showAddressBook=false 返回 null；true 时把 config.callback 指向 closeDialog 并渲染', () => {
  const env = makeEnv();
  const calls: number[] = [];
  const closeDialog = () => calls.push(1);
  assert.equal(env.dialog({ showAddressBook: false, closeDialog }), null);
  // 真实顺序：config.callback 在「是否显示」判断之前就写入，即使本次不渲染也生效
  assert.equal(env.config.callback, closeDialog, 'config.callback 先写入（原实现顺序）');

  const node = env.dialog({ showAddressBook: true, closeDialog });
  assert.ok(node);
  assert.equal(env.config.callback, closeDialog, 'config.callback 指向关闭回调');
  assert.equal(node!.type, 'Dialog');
  assert.equal(node!.props.visible, true);
  assert.equal(node!.props.width, 900);
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
  console.log(`chat/AddressBookDialog 行为规格通过：${passed} 项`);
}

main();
