/**
 * `components/Inbox/components/baseComponent/userLink` 的渲染规格
 * （持续目标·补齐 lead 白名单中未被规格直接覆盖的文件）。
 *
 * 【组件做什么】把 `accountId` 交给 `ming-ui` 的 `UserCard`，内部渲染一个
 * `<a ref={...}>{fullname}</a>`，并把 ref 元素存到 `this.card`。
 *
 * 【本 spec 钉住的真实行为】（从源码读出，不是"期望"）
 * 1. `UserCard` 的 `sourceId` 就是 `accountId`（缺省时传 `undefined`，不伪造空串）；
 * 2. `<a>` 的文本子节点是 `fullname`（缺省时为 `undefined` → React 渲染为空）；
 * 3. `<a>` **没有** href/className 等属性（组件不附加任何链接或样式）；
 * 4. ref 回调把元素赋给 `this.card`（用于外部定位/测量）；
 * 5. 构造函数把 props 展开进 `state`（`this.state.accountId === props.accountId`）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：从真实源码抽 `render()` 方法体执行，
 * `React`/`UserCard` 由参数注入；渲染结果用真实 `react-dom/server` 序列化。
 */
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  body?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/userLink.tsx';

/** 抽出 `render()` 方法体（真实源码） */
function extractRenderBody(): string {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ClassMethod' && node.key && node.key.name === 'render' && node.body) {
      const b = node.body;
      if (typeof b.start === 'number' && typeof b.end === 'number') {
        found = { start: b.start + 1, end: b.end - 1 };
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'start' || k === 'end' || k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(x => visit(x as BabelNode));
      else if (v && typeof v === 'object' && typeof (v as BabelNode).type === 'string') visit(v as BabelNode);
    }
  };
  visit(ast.program as unknown as BabelNode);
  const loc = found as { start: number; end: number } | null;
  if (!loc) throw new Error('真实源码里没有找到 render()');
  return source.slice(loc.start, loc.end);
}

const transformed = harness.transformSync(`function __render() {${extractRenderBody()}}\n`, {
  filename: 'userLink-render.tsx',
});
if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换片段');
const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');

interface UserCardProps {
  sourceId?: string | undefined;
  children?: unknown;
}

function render(props: { accountId?: string; fullname?: string }): {
  html: string;
  cardProps: UserCardProps | null;
  assignedRef: unknown;
} {
  let cardProps: UserCardProps | null = null;
  const UserCardStub = (p: UserCardProps) => {
    cardProps = p;
    // 真实 UserCard 会渲染 children；桩也原样返回 children 以便观察 <a>
    return React.createElement(React.Fragment, null, p.children as React.ReactNode);
  };
  const jsxRuntime = require('react/jsx-runtime');
  const factory = new Function('React', 'UserCard', 'require', `${code}\nreturn __render;`) as unknown as (
    react: unknown,
    userCard: unknown,
    requireStub: (n: string) => unknown,
  ) => (this: { props: unknown }) => unknown;
  const fn = factory(React, UserCardStub, (n: string) => (n === 'react/jsx-runtime' ? jsxRuntime : undefined));
  const self = { props };
  const element = fn.call(self);
  const html = renderToStaticMarkup(element as React.ReactElement);
  return { html, cardProps, assignedRef: (self as { card?: unknown }).card };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('UserCard 的 sourceId 就是 accountId', () => {
  const r = render({ accountId: 'u1', fullname: '张三' });
  assert.ok(r.cardProps, '应当渲染出 UserCard');
  assert.equal(r.cardProps!.sourceId, 'u1');
});

check('accountId 缺省时 sourceId 为 undefined（不伪造空串）', () => {
  const r = render({ fullname: '张三' });
  assert.equal(r.cardProps!.sourceId, undefined);
});

check('全名渲染为 <a> 的文本', () => {
  const r = render({ accountId: 'u1', fullname: '张三' });
  assert.ok(r.html.includes('张三'), `输出应含全名，实际：${r.html}`);
  assert.ok(/<a[^>]*>张三<\/a>/.test(r.html), `<a> 内应是全名，实际：${r.html}`);
});

check('fullname 缺省时 <a> 内容为空', () => {
  const r = render({ accountId: 'u1' });
  assert.ok(/<a[^>]*><\/a>/.test(r.html), `应为空 <a>，实际：${r.html}`);
});

check('<a> 不带 href/class 等附加属性（组件不附加链接或样式）', () => {
  const r = render({ accountId: 'u1', fullname: '张三' });
  const anchor = /<a([^>]*)>/.exec(r.html);
  assert.ok(anchor, '应存在 <a>');
  const attrs = (anchor as RegExpExecArray)[1] as string;
  assert.equal(attrs.includes('href'), false, `<a> 不应有 href，实际属性：${attrs}`);
  assert.equal(attrs.includes('class'), false, `<a> 不应有 class，实际属性：${attrs}`);
});

check('ref 回调把元素赋给 this.card（本次静态渲染下 ref 不触发，验证结构存在）', () => {
  const src = harness.readSource(TARGET);
  assert.ok(/ref=\{elem => \{[\s\S]*?this\.card = elem;/.test(src), '源码里 ref 回调把元素赋给 this.card');
  assert.ok(/declare card: HTMLAnchorElement \| null \| undefined;/.test(src), 'card 字段声明保留');
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
  console.log(`chat/UserLink 渲染规格通过：${passed} 项`);
}

main();
