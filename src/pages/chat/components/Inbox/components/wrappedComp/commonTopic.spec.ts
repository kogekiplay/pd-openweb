/**
 * `src/pages/chat/components/Inbox/components/wrappedComp/commonTopic.tsx` 的结构规格
 * （持续目标·收件箱通用讨论切片）。
 *
 * 【为什么这样测】这个组件把收件箱条目「归一成一条可渲染消息」，两段纯函数决定结果：
 * - `mergeFromSourceState`：按 `discussion.sourceType` 映射来源标题与链接
 *   （日程/任务/项目/工作表/工作表行；工作表行还要从 `extendsId` 前缀取 appId），
 *   未命中任何来源（含 discussion 缺失）→ 「数据不存在或已删除」；
 * - `mergeTopicState`：把 discussion 原样展开，`message` 交给 `createLinksForMessage` 转 html
 *   （@ 人列表 = accountsInMessage），并带出 `sourceType`/`createTime`。
 * 本 spec 从**真实源码**抽这两个函数执行（不复制、不改产品源码），链接工具为记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/wrappedComp/commonTopic.tsx';

function extract(): (deps: {
  createLinksForMessage: (param: Record<string, unknown>) => string;
  buildSourceLink: (...args: unknown[]) => string;
  formatInboxItem: (item: unknown) => Record<string, unknown>;
  SOURCE_TYPE: Record<string, number | undefined>;
  translate: (key: string, ...args: unknown[]) => string;
  BaseMessageComponent: (props: Record<string, unknown>) => unknown;
  jsx: (type: unknown, props: Record<string, unknown>) => unknown;
  requireStub: (name: string) => unknown;
}) => {
  mergeFromSourceState: (item: Record<string, unknown>) => Record<string, unknown>;
  mergeTopicState: (item: Record<string, unknown>) => Record<string, unknown>;
  CommonTopic: (props: Record<string, unknown>) => unknown;
} {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const functions = ['mergeFromSourceState', 'mergeTopicState'];
  const found: Record<string, { start: number; end: number }> = {};
  let componentFound: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id && typeof node.id.name === 'string') {
      if (functions.includes(node.id.name) && typeof node.start === 'number' && typeof node.end === 'number') {
        found[node.id.name] = { start: node.start, end: node.end };
      }
      if (node.id.name === 'CommonTopic' && typeof node.start === 'number' && typeof node.end === 'number') {
        componentFound = { start: node.start, end: node.end };
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
  const missing = functions.filter((name) => !found[name]);
  const componentLoc = componentFound as { start: number; end: number } | null;
  if (missing.length || !componentLoc) throw new Error(`真实源码里缺少：${missing.join(', ') || 'CommonTopic'}`);
  const componentSource = source
    .slice(componentLoc.start, componentLoc.end)
    .replace(/^export default function/, 'function');
  const wrapped = `${functions.map((name) => source.slice(found[name]!.start, found[name]!.end)).join('\n')}\n${componentSource}\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'commonTopic-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const factory = new Function(
    'createLinksForMessage',
    'buildSourceLink',
    'formatInboxItem',
    'SOURCE_TYPE',
    '_l',
    'BaseMessageComponent',
    '_jsxRuntime',
    'require',
    `${code}\nreturn { mergeFromSourceState, mergeTopicState, CommonTopic };`,
  ) as (...args: unknown[]) => {
    mergeFromSourceState: (item: Record<string, unknown>) => Record<string, unknown>;
    mergeTopicState: (item: Record<string, unknown>) => Record<string, unknown>;
    CommonTopic: (props: Record<string, unknown>) => unknown;
  };
  return (deps) =>
    factory(
      deps.createLinksForMessage,
      deps.buildSourceLink,
      deps.formatInboxItem,
      deps.SOURCE_TYPE,
      deps.translate,
      deps.BaseMessageComponent,
      deps.jsx as never,
      deps.requireStub,
    );
}



const factory = extract();

const SOURCE_TYPE = {
  POST: undefined as number | undefined,
  TASK: 1,
  FOLDER: 2,
  CALENDAR: 3,
  KNOWLEDGE: 4,
  APPROVAL: 5,
  ATTENDANCE: 6,
  WORKSHEET: 7,
  WORKSHEETROW: 8,
  CHAT: 9,
};

const BaseMarker = (props: Record<string, unknown>): unknown => ({ type: 'BaseMessageComponent', props });

function make(): {
  script: ReturnType<typeof factory>;
  links: Record<string, unknown>[];
  sources: unknown[][];
  baseProps: Record<string, unknown>[];
} {
  const links: Record<string, unknown>[] = [];
  const sources: unknown[][] = [];
  const baseProps: Record<string, unknown>[] = [];
  // 渲染走 automatic runtime：用同一个 jsx 桩收集 BaseMessageComponent 的 props
  const jsx = (type: unknown, props: Record<string, unknown>): unknown => {
    if (type === BaseMarker) baseProps.push(props);
    return { type, props };
  };
  const script = factory({
    createLinksForMessage: (param) => {
      links.push(param);
      return `HTML(${String(param.message)})`;
    },
    buildSourceLink: (...args) => {
      sources.push(args);
      return `LINK(${args.map((a) => String(a)).join('|')})`;
    },
    formatInboxItem: () => ({ typeName: 'T' }),
    SOURCE_TYPE,
    translate: (key, ...args) => {
      let out = String(key);
      args.forEach((arg, index) => {
        out = out.replace(`%${index}`, String(arg));
      });
      return out;
    },
    BaseMessageComponent: BaseMarker,
    jsx,
    requireStub: (name: string) => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react') return { createElement: jsx, Fragment: 'Fragment' };
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  } as never);
  return { script, links, sources, baseProps };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('mergeFromSourceState：日程/任务/项目都映射到各自标题与来源链接', () => {
  for (const [sourceType, title] of [
    [SOURCE_TYPE.CALENDAR, '来自日程'],
    [SOURCE_TYPE.TASK, '来自任务'],
    [SOURCE_TYPE.FOLDER, '来自项目'],
  ] as [number, string][]) {
    const h = make();
    const result = h.script.mergeFromSourceState({
      inboxId: 'i1',
      discussion: { name: '名称', sourceId: 's1', sourceType },
    });
    assert.equal(result.fromMessage, '名称');
    assert.equal(result.fromTitle, title);
    assert.equal(result.fromLink, `LINK(${sourceType}|s1)`);
    assert.equal(result.appId, undefined);
  }
});

check('mergeFromSourceState：工作表用实体名做标题；工作表行带 extendsId 前缀与 appId', () => {
  const sheet = make();
  const ws = sheet.script.mergeFromSourceState({
    discussion: { name: 'n', entityName: '实体', sourceId: 's2', sourceType: SOURCE_TYPE.WORKSHEET },
  });
  assert.equal(ws.fromTitle, '来自实体');
  assert.equal(ws.fromLink, `LINK(${SOURCE_TYPE.WORKSHEET}|s2)`);

  const row = make();
  const wsRow = row.script.mergeFromSourceState({
    inboxId: 'i9',
    discussion: {
      name: 'n',
      entityName: '行实体',
      sourceId: 's3',
      extendsId: 'app-1|view-1',
      sourceType: SOURCE_TYPE.WORKSHEETROW,
    },
  });
  assert.equal(wsRow.fromTitle, '来自行实体');
  assert.equal(wsRow.appId, 'app-1');
  assert.deepEqual(row.sources[0], [SOURCE_TYPE.WORKSHEETROW, 's3', 'app-1|view-1', 'i9']);
});

check('mergeFromSourceState：未命中来源（含 discussion 缺失）→ 数据不存在或已删除', () => {
  for (const item of [{}, { discussion: {} }, { discussion: { sourceType: SOURCE_TYPE.KNOWLEDGE } }]) {
    const h = make();
    const result = h.script.mergeFromSourceState(item as Record<string, unknown>);
    assert.equal(result.fromMessage, '数据不存在或已删除');
    assert.equal(result.fromTitle, '来自');
    assert.equal(result.fromLink, '');
    assert.deepEqual(h.sources, [], '不拼链接');
  }
});

check('mergeTopicState：正文转 html、带上 @ 人与来源类型、缺省 discussion 时用空对象', () => {
  const h = make();
  const result = h.script.mergeTopicState({
    createTime: '2026-10-20',
    discussion: { message: 'hi @张三', accountsInMessage: [{ accountId: 'u1' }], sourceType: 9, canReply: true },
  });
  assert.deepEqual(h.links[0], {
    message: 'hi @张三',
    rUserList: [{ accountId: 'u1' }],
    sourceType: 9,
  });
  assert.equal(result.message, 'HTML(hi @张三)');
  assert.equal(result.sourceType, 9);
  assert.equal(result.createTime, '2026-10-20');
  assert.equal(result.canReply, true);

  const empty = make();
  const emptyResult = empty.script.mergeTopicState({});
  assert.deepEqual(empty.links[0], { message: '', rUserList: undefined, sourceType: undefined });
  assert.equal(emptyResult.message, 'HTML()');
});

check('CommonTopic：把三段归一结果合并后交给 BaseMessageComponent', () => {
  const h = make();
  h.script.CommonTopic({
    createTime: 1,
    discussion: { message: 'm', sourceType: SOURCE_TYPE.CHAT, name: 'n', sourceId: 's' },
  } as Record<string, unknown>);
  assert.equal(h.baseProps.length, 1);
  const props = h.baseProps[0]!;
  assert.equal(props.typeName, 'T', 'formatInboxItem 的结果也在其中');
  assert.equal(props.message, 'HTML(m)');
  // CHAT 不是 mergeFromSourceState 的已知来源分支 → 走 default（既有行为）
  assert.equal(props.fromMessage, '数据不存在或已删除');
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
  console.log(`chat/CommonTopic 行为规格通过：${passed} 项`);
}

main();
