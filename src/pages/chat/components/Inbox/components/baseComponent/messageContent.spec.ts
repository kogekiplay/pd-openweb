/**
 * `src/pages/chat/components/Inbox/components/baseComponent/messageContent.tsx` 的分支行为规格
 * （持续目标·收件箱消息体渲染切片）。
 *
 * 【为什么这样测】`BaseMessageComponent` 的构造器里有**真实的折叠判定**，render 里有多条分支：
 * - 构造器：正文按 `cutStringWithHtml(message, 600, 12)` 截断；**去掉截断部分后仍有剩余**才
 *   `showBtn: true, expanded: false, partMsg`，否则 `showBtn: false, expanded: true`；
 * - `renderSourceFrom`：`fromTitle` 为空直接 `null`；有 `sourceId` 时渲染 `<a>`，否则渲染 `<span>`；
 * - `renderCommentArea`：`isDeleted` → null；`canReply` → `CommentArea`；
 *   否则按 `sourceType` 分派（TASK/FOLDER/… 各自的权限提示文案）；
 * - `render`：`inboxId` 进 className，`children` 有才渲染。
 * 本 spec 从**真实源码**抽构造器与这几个方法执行（不复制、不改产品源码），子组件/工具全用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
 */

import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/messageContent.tsx';

interface VNode {
  type: unknown;
  props: Record<string, unknown>;
}

function readMethod(name: string): string {
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
      node.key.name === name &&
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
  const loc = found as { start: number; end: number } | null;
  if (!loc) throw new Error(`真实源码里没有找到方法 ${name}`);
  return source.slice(loc.start, loc.end).replace(/^\s*override\s+/, '');
}

function readConstructorBody(): string {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.kind === 'constructor' &&
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
  const loc = found as { start: number; end: number } | null;
  if (!loc) throw new Error('真实源码里没有找到构造器');
  return source.slice(loc.start, loc.end);
}

function compile(body: string, filename: string): string {
  const transformed = harness.transformSync(body, { filename });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  return transformed.code.replace(/^['"]use strict['"];\s*/, '');
}

const ctorSource = readConstructorBody()
  .replace(/constructor\(props: BaseMessageComponentProps\)/, 'constructor(props)')
  .replace(/super\(props\);/, 'this.props = props;');
const methods = ['renderSourceFrom', 'renderCommentArea', 'render'].map(readMethod).join('\n');
const code = compile(
  `var __cls = class {\n  ${ctorSource}\n  ${methods}\n};\n`,
  'messageContent-snippet.tsx',
);

const factory = new Function(
  'cutStringWithHtml',
  'xss',
  'SOURCE_TYPE',
  'formatMsgDate',
  'dateConvertToUserZone',
  'pathCompletion',
  'addBehaviorLog',
  '_l',
  '$',
  'Avatar',
  'CommentArea',
  'ReplyTo',
  'Star',
  'UserLink',
  'UploadFile',
  'UserCard',
  'React',
  '_jsxRuntime',
  'require',
  `${code}\nreturn (props) => new __cls(props);`,
) as unknown as (
  cut: (value: string, maxLen: number, maxLines: number) => string,
  xssFn: (value: string, options: Record<string, unknown>) => string,
  sourceType: Record<string, number | undefined>,
  formatMsgDate: (value: unknown) => string,
  dateConvertToUserZone: (value: unknown) => unknown,
  pathCompletion: (path: string) => string,
  addBehaviorLog: (...args: unknown[]) => void,
  translate: (key: string, ...args: unknown[]) => string,
  jquery: (value: string) => { html: (html: string) => { text: () => string } },
  avatar: unknown,
  commentArea: unknown,
  replyTo: unknown,
  star: unknown,
  userLink: unknown,
  uploadFile: unknown,
  userCard: unknown,
  reactStub: Record<string, unknown>,
  jsxRuntimeStub: Record<string, unknown>,
  requireStub: (name: string) => unknown,
) => (props: Record<string, unknown>) => Record<string, any>;

const seen: { logs: unknown[][] } = { logs: [] };

function make(
  props: Record<string, unknown>,
  options: { cut?: (value: string, maxLen: number, maxLines: number) => string } = {},
): Record<string, any> {
  const jsx = (type: unknown, jsxProps: Record<string, unknown>): VNode => {
    const name =
      typeof type === 'function' ? ((type as { displayName?: string }).displayName ?? 'Anonymous') : (type as string);
    return { type: name, props: jsxProps ?? {} };
  };
  const component = (name: string): unknown => {
    const fn = (componentProps: Record<string, unknown>): VNode => ({ type: name, props: componentProps ?? {} });
    (fn as unknown as { displayName?: string }).displayName = name;
    return fn;
  };
  const create = factory(
    options.cut ?? ((value, maxLen, maxLines) => (value.length > maxLen ? value.slice(0, maxLen) : value)),
    (value) => value,
    { TASK: 1, FOLDER: 2, CALENDAR: 3, KNOWLEDGE: 4, APPROVAL: 5, ATTENDANCE: 6, WORKSHEET: 7, WORKSHEETROW: 8, CHAT: 9 },
    (value) => `DATE(${String(value)})`,
    (value) => value,
    (path) => `URL(${path})`,
    (...args) => seen.logs.push(args),
    (key, ...args) => {
      let out = String(key);
      args.forEach((arg, index) => {
        out = out.replace(`%${index}`, String(arg));
      });
      return out;
    },
    () => ({ html: () => ({ text: () => 'SRC' }) }),
    component('Avatar'),
    component('CommentArea'),
    component('ReplyTo'),
    component('Star'),
    component('UserLink'),
    component('UploadFile'),
    component('UserCard'),
    { createElement: jsx, Fragment: 'Fragment' },
    { jsx, jsxs: jsx, Fragment: 'Fragment' },
    (name: string) => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react') return { createElement: jsx, Fragment: 'Fragment' };
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  return create(props);
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('构造器：正文超过 600 字符且有剩余 → showBtn=true、expanded=false 并记录 partMsg', () => {
  const long = 'x'.repeat(700);
  const instance = make({ message: long }, { cut: (value) => value.slice(0, 600) });
  assert.deepEqual(instance.state, { showBtn: true, expanded: false, partMsg: 'x'.repeat(600) });
});

check('构造器：正文短（无剩余）→ showBtn=false、expanded=true，不带 partMsg', () => {
  const instance = make({ message: '短消息' }, { cut: (value) => value });
  assert.deepEqual(instance.state, { showBtn: false, expanded: true });
});

check('renderSourceFrom：无 fromTitle → null；有 sourceId → a 标签；无 sourceId → span', () => {
  const none = make({ message: 'm' });
  assert.equal(none.renderSourceFrom(), null);

  const linked = make({ message: 'm', fromTitle: '来自任务', fromMessage: '源消息', fromLink: '/task/1', sourceId: 'a|b' });
  const anchor = linked.renderSourceFrom() as VNode;
  assert.equal(anchor.type, 'div');
  const anchorChildrenRaw = anchor.props.children as VNode[] | VNode;
  const anchorChildren = Array.isArray(anchorChildrenRaw) ? anchorChildrenRaw : [anchorChildrenRaw];
  const anchorNode = (anchorChildren.find((child) => child && child.type === 'a') ?? anchorChildren[1]) as VNode;
  assert.equal(anchorNode.type, 'a');
  assert.equal(anchorNode.props.target, '_blank');
  assert.equal(anchorNode.props['data-title'], '来自任务');

  const plain = make({ message: 'm', fromTitle: '来自动态', fromMessage: '源', fromLink: '/f' });
  const plainChildrenRaw = (plain.renderSourceFrom() as VNode).props.children as VNode[] | VNode;
  const plainChildren = Array.isArray(plainChildrenRaw) ? plainChildrenRaw : [plainChildrenRaw];
  assert.ok(plainChildren.some((child) => child && child.type === 'span' && child.props.className === 'fromLink cursorDefault'));
});

check('renderCommentArea：isDeleted → null；canReply → CommentArea；否则按 sourceType 出权限提示', () => {
  const deleted = make({ message: 'm', isDeleted: true });
  assert.equal(deleted.renderCommentArea(), null);

  const reply = make({ message: 'm', canReply: true, comments: [], commentsCount: 0 });
  assert.equal((reply.renderCommentArea() as VNode).type, 'CommentArea');

  const task = make({ message: 'm', canReply: false, sourceType: 1, fromLink: '/t' });
  const taskNode = task.renderCommentArea() as VNode;
  assert.equal(taskNode.type, 'div');
  const texts = JSON.stringify(taskNode.props);
  assert.ok(texts.includes('点击这里'), '任务提示含「点击这里」');
  assert.ok(texts.includes('申请任务查看和回复权限'), '任务提示含权限文案');
});

check('render：inboxId 进 className；children 有才渲染', () => {
  const instance = make({ message: 'm', inboxId: 'inbox-7' });
  // render 会调用同类的其它渲染方法；本用例只关心容器 className 与 children，故其余方法用桩
  const stub = (): VNode => ({ type: 'Stub', props: {} });
  instance.renderAvatar = stub;
  instance.renderMsgHeader = stub;
  instance.renderMessage = stub;
  instance.renderAttachments = stub;
  instance.renderSourceFrom = stub;
  instance.renderCreateTime = stub;
  instance.renderCommentArea = stub;
  const tree = instance.render() as VNode;
  assert.ok(String(tree.props.className).includes('messageItem-inbox-7'));

  const child = { type: 'span', props: { children: 'X' } };
  const withChild = make({ message: 'm', inboxId: 'i1', children: child });
  withChild.renderAvatar = stub;
  withChild.renderMsgHeader = stub;
  withChild.renderMessage = stub;
  withChild.renderAttachments = stub;
  withChild.renderSourceFrom = stub;
  withChild.renderCreateTime = stub;
  withChild.renderCommentArea = stub;
  const childrenRaw = (withChild.render() as VNode).props.children as VNode[] | VNode;
  const children = Array.isArray(childrenRaw) ? childrenRaw : [childrenRaw];
  const main = children.find((node) => node && node.type === 'div' && node.props.className === 'itemMain') as VNode | undefined;
  assert.ok(main, '有 itemMain');
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
  console.log(`chat/MessageContent 行为规格通过：${passed} 项`);
}

main();
