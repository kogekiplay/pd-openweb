/**
 * `src/pages/chat/components/Inbox/components/wrappedComp/postMention.tsx` 的行为规格
 * （持续目标·动态提及切片）。
 *
 * 【为什么这样测】`mergeTopicState` / `mergeFromSourceState` 是动态提及条目的真实**取数/拼装逻辑**：
 * - 直接被 @：从动态本体取正文/@列表/附件，带回 `sourceId`、评论列表与 `parseInt` 后的评论数；
 * - 回复里被 @：从**第一条评论**取，并额外带回 `discussionId`/`replyId`/`replyAccountId`；
 * - 来源区：直接被 @ 时只给详情链接；回复里被 @ 时还要拼「来自动态」的引用正文。
 * 本 spec 从**真实源码**抽出这两个方法执行（不复制、不改产品源码），`createLinksForMessage`/`_l` 注入。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
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

const actualSyntax: Record<string, unknown> = require('../../../../../../../scripts/spec-message-syntax.ts').loadMessageSyntaxSpec();

const TARGET = 'src/pages/chat/components/Inbox/components/wrappedComp/postMention.tsx';

interface TopicItem {
  message?: string;
  rUserList?: unknown;
  rGroupList?: unknown;
  categories?: unknown;
  attachments?: unknown[];
  postID?: string;
  commentID?: string;
  replyID?: string;
  replyAccountId?: unknown;
  commentCount?: string | number;
  comments?: TopicItem[];
}

interface InboxItem {
  createTime?: string | number;
  Post: TopicItem & {
    postType?: number;
    MedalPost?: { MedalName?: string };
  };
}

function extract(): (
  links: (args: Record<string, unknown>) => string,
  translate: (key: string) => string,
  strip: unknown,
) => (props: InboxItem) => Record<string, (arg?: unknown) => Record<string, unknown> | undefined> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['mergeTopicState', 'mergeFromSourceState'];
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
  const methods = wanted.map((name) => source.slice(found[name]!.start, found[name]!.end)).join('\n');
  const wrapped = `var __cls = class {\n  constructor(props) {\n    this.props = props;\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'postMention-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'createLinksForMessage',
    '_l',
    'stripMarkdownForMessage',
    `${code}\nreturn (props) => new __cls(props);`,
  ) as (
    links: (args: Record<string, unknown>) => string,
    translate: (key: string) => string,
  strip: unknown,
  ) => (props: InboxItem) => Record<string, (arg?: unknown) => Record<string, unknown> | undefined>;
}

const factory = extract();

function make(item: InboxItem): Record<string, (arg?: unknown) => Record<string, unknown> | undefined> {
  const create = factory(
    (args) => `LINK(${String(args.message)})`,
    (key) => `[${key}]`,
    actualSyntax['stripMarkdownForMessage'],
  );
  return create(item);
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('mergeTopicState(true)：直接被 @，从动态本体取正文与计数', () => {
  const instance = make({
    createTime: '2026-01-01',
    Post: {
      postID: 'p1',
      message: '正文',
      rUserList: ['u1'],
      commentCount: '7',
      comments: [{ message: 'c1' }],
      attachments: [{ file: 1 }],
    },
  });
  const state = instance.mergeTopicState!(true)!;
  assert.equal(state.message, 'LINK(正文)');
  assert.deepEqual(state.attachments, [{ file: 1 }]);
  assert.equal(state.createTime, '2026-01-01');
  assert.equal(state.sourceId, 'p1');
  assert.deepEqual(state.comments, [{ message: 'c1' }]);
  assert.equal(state.commentsCount, 7, 'commentCount 走 parseInt');
});

check('mergeTopicState(false)：回复里被 @，从第一条评论取并带 discussion/reply 字段', () => {
  const instance = make({
    createTime: 1,
    Post: {
      postID: 'p1',
      message: '帖子正文',
      comments: [{ message: '第一条评论', commentID: 'c1', replyID: 'r1', replyAccountId: 'acc1' }],
    },
  });
  const state = instance.mergeTopicState!(false)!;
  assert.equal(state.message, 'LINK(第一条评论)');
  // 既有行为：回复分支的 sourceId 取自【评论对象】的 postID，评论上没有该字段 → undefined；
  // 详情链接由 mergeFromSourceState 用 Post.postID 拼。
  assert.equal(state.sourceId, undefined);
  assert.equal(state.discussionId, 'c1');
  assert.equal(state.replyId, 'r1');
  assert.equal(state.replyAccountId, 'acc1');
  assert.equal('commentsCount' in state, false, '回复分支不带评论数');
});

check('mergeFromSourceState(true)：直接被 @ 只给详情链接', () => {
  const instance = make({ Post: { postID: 'p9' } });
  const state = instance.mergeFromSourceState!(true)!;
  assert.deepEqual(state, { fromLink: '/feeddetail?itemID=p9' });
});

check('mergeFromSourceState(false)：回复里被 @ 还带「来自动态」引用正文', () => {
  const instance = make({ Post: { postID: 'p9', message: '帖子正文' } });
  const state = instance.mergeFromSourceState!(false)!;
  assert.equal(state.fromMessage, 'LINK(帖子正文)');
  assert.equal(state.fromTitle, '[来自动态]');
  assert.equal(state.fromLink, '/feeddetail?itemID=p9');
});

check('mergeFromSourceState()：省略参数等价于回复分支（既有默认行为）', () => {
  const instance = make({ Post: { postID: 'p9', message: 'x' } });
  const state = instance.mergeFromSourceState!()!;
  assert.equal(state.fromMessage, 'LINK(x)');
  assert.equal(state.fromLink, '/feeddetail?itemID=p9');
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
  console.log(`chat/PostMention 行为规格通过：${passed} 项`);
}

main();
