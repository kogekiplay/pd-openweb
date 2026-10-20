/**
 * `src/pages/chat/components/Inbox/components/Inbox.tsx` 的行为规格
 * （持续目标·收件箱容器切片）。
 *
 * 【为什么这样测】收件箱容器把父级的 `inboxType/count` 变化翻译成「重载类型 + 清空筛选」，
 * 并提供四个 setState 处理器（切类型/收藏/筛选/强制刷新）；初始类型还由 `getInitialLoadType`
 * 决定（未知类型**抛原生错误**，不是静默兜底）。本 spec 从**真实源码**抽出这些函数执行
 * （不复制、不改产品源码），常量表与 React state 用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
 */

import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const _lodash: typeof import('lodash') = require('lodash');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  value?: BabelNode | null;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/Inbox.tsx';

interface StateLike {
  type: string;
  inboxFavorite: boolean;
  filter: unknown;
  updateNow?: number | undefined;
}

interface Instance {
  props: { inboxType?: string | undefined; count?: number | undefined };
  state: StateLike;
  setState: (patch: Partial<StateLike>) => void;
  componentDidUpdate: (prevProps: Instance['props']) => void;
  changeType: (type: string) => void;
  changeFaviorite: (favorite: boolean) => void;
  changeUpdateNow: () => void;
  changeInboxFilter: (filter: unknown) => void;
}

const DROPDOWN_GROUPLIST_STUB = {
  post: ['PostAll', 'PostReply'],
  calendar: ['CalendarAll'],
};

function extract(): (
  lodash: typeof import('lodash'),
  dropdown: Record<string, string[]>,
  equal: (a: unknown, b: unknown) => boolean,
  requireStub: (name: string) => unknown,
) => (props: Instance['props'], state: StateLike, setState: Instance['setState']) => {
  getInitialLoadType: (inboxType: string | undefined) => string;
  instance: Instance;
} {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wantedMethods = ['componentDidUpdate'];
  const wantedProps = ['changeType', 'changeFaviorite', 'changeUpdateNow', 'changeInboxFilter'];
  let getInitial: { start: number; end: number } | null = null;
  const methods: Record<string, { start: number; end: number }> = {};
  const propsFound: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'getInitialLoadType') {
      const init = node.init;
      if (init && typeof init.start === 'number' && typeof init.end === 'number') {
        getInitial = { start: init.start, end: init.end };
      }
    }
    const keyName = node.key && typeof node.key.name === 'string' ? node.key.name : undefined;
    if (keyName && node.type === 'ClassMethod' && wantedMethods.includes(keyName)) {
      if (typeof node.start === 'number' && typeof node.end === 'number') {
        methods[keyName] = { start: node.start, end: node.end };
      }
    }
    if (keyName && node.type === 'ClassProperty' && wantedProps.includes(keyName)) {
      const value = node.value;
      if (value && typeof value.start === 'number' && typeof value.end === 'number') {
        propsFound[keyName] = { start: value.start, end: value.end };
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
  const initial = getInitial as { start: number; end: number } | null;
  if (!initial) throw new Error('真实源码里没有找到 getInitialLoadType');
  const missingProps = wantedProps.filter((name) => !propsFound[name]);
  if (missingProps.length) throw new Error(`真实源码里没有找到处理器：${missingProps.join(', ')}`);

  const methodSources = wantedMethods
    .filter((name) => methods[name])
    .map((name) => source.slice(methods[name]!.start, methods[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const propSources = wantedProps.map((name) => `${name} = ${source.slice(propsFound[name]!.start, propsFound[name]!.end)};`).join('\n');
  const wrapped = `var getInitialLoadType = ${source.slice(initial.start, initial.end)};\nvar __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n${methodSources}\n${propSources}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'inboxContainer-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_',
    'DROPDOWN_GROUPLIST',
    'shallowEqual',
    'require',
    `${code}\nreturn (props, state, setState) => ({ getInitialLoadType, instance: new __cls(props, state, setState) });`,
  ) as (
    lodash: typeof import('lodash'),
    dropdown: Record<string, string[]>,
    equal: (a: unknown, b: unknown) => boolean,
    requireStub: (name: string) => unknown,
  ) => (props: Instance['props'], state: StateLike, setState: Instance['setState']) => {
    getInitialLoadType: (inboxType: string | undefined) => string;
    instance: Instance;
  };
}

const factory = extract();

function make(props: Instance['props'] = { inboxType: 'post', count: 0 }): {
  instance: Instance;
  patches: Partial<StateLike>[];
  getInitialLoadType: (inboxType: string | undefined) => string;
} {
  const { shallowEqual }: { shallowEqual: (a: unknown, b: unknown) => boolean } = require('react-redux');
  const patches: Partial<StateLike>[] = [];
  const create = factory(
    _lodash,
    DROPDOWN_GROUPLIST_STUB,
    shallowEqual,
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  let instance: Instance;
  const created = create(props, { type: 'PostAll', inboxFavorite: false, filter: null }, (patch) => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  });
  instance = created.instance;
  return { instance, patches, getInitialLoadType: created.getInitialLoadType };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('getInitialLoadType：已知类型 → 该类型下拉第一项；未知/缺省 → 抛原生错误', () => {
  const { getInitialLoadType } = make();
  assert.equal(getInitialLoadType('post'), 'PostAll');
  assert.equal(getInitialLoadType('calendar'), 'CalendarAll');
  assert.throws(() => getInitialLoadType('unknown'), /type in options not recognized!/);
  assert.throws(() => getInitialLoadType(undefined), /type in options not recognized!/);
});

check('componentDidUpdate：inboxType 变化 → 清空筛选并重载初始类型', () => {
  const { instance, patches } = make();
  instance.componentDidUpdate({ inboxType: 'calendar', count: 0 });
  assert.deepEqual(patches, [{ filter: null, type: 'PostAll' }]);
});

check('componentDidUpdate：count 变化也重载；两者都没变则不动', () => {
  const { instance, patches } = make();
  instance.componentDidUpdate({ inboxType: 'post', count: 5 });
  assert.deepEqual(patches, [{ filter: null, type: 'PostAll' }]);
  instance.componentDidUpdate({ inboxType: 'post', count: 0 });
  assert.equal(patches.length, 1, '无变化不再 setState');
});

check('changeType / changeFaviorite / changeInboxFilter / changeUpdateNow：各自写回 state', () => {
  const { instance, patches } = make();
  instance.changeType('PostReply');
  instance.changeFaviorite(true);
  instance.changeInboxFilter({ appId: 'app1' });
  instance.changeUpdateNow();
  assert.deepEqual(patches[0], { type: 'PostReply' });
  assert.deepEqual(patches[1], { inboxFavorite: true });
  assert.deepEqual(patches[2], { filter: { appId: 'app1' } });
  assert.equal(typeof patches[3]!.updateNow, 'number');
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
  console.log(`chat/InboxContainer 行为规格通过：${passed} 项`);
}

main();
