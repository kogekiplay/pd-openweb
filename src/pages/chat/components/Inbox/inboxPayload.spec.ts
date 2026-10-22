/** Execute the actual Inbox normalizer, PostReply, shared body, CommentArea and cloned reply callback. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const lodash: typeof import('lodash') = require('lodash');

type Data = Record<string, unknown>;
interface ElementNode { type: unknown; props: Data; }
interface Subject {
  props: Data;
  state: Data;
  render(): ElementNode;
  renderComments(): ElementNode;
  renderCommenter(): ElementNode;
  renderCommentArea(): ElementNode;
  addCommentCallback(value: Data): void;
  setState(patch: Data): void;
}
type Component = new (props: Data) => Subject;
const root = 'src/pages/chat/components/Inbox';
const cache = new Map<string, Data>();
const Commenter = () => null;
const Leaf = () => null;
const common = {
  browserIsMobile: () => false,
  htmlDecodeReg: (value: unknown) => value,
  htmlEncodeReg: (value: unknown) => String(value ?? ''),
  pathCompletion: (value: unknown) => value,
  cutStringWithHtml: (value: unknown) => String(value).slice(0, 600),
};
const translate = (value: string) => value;
Reflect.set(globalThis, '_l', translate);
Reflect.set(globalThis, '$', { extend: (_deep: boolean, target: Data, source: Data) => lodash.merge(target, source) });
Reflect.set(globalThis, 'md', { global: { Account: { accountId: 'self', isPortal: false } } });
function load(file: string): Data {
  if (cache.has(file)) return cache.get(file)!;
  const source = harness.readSource(file);
  const transformed = harness.transformSync(source, { filename: path.join(harness.ROOT, file) });
  if (!transformed?.code) throw new Error('No compiled module: ' + file);
  const module = { exports: {} as Data };
  cache.set(file, module.exports);
  const localRequire = (name: string): unknown => {
    if (name === 'src/utils/common' || name.endsWith('/common') && file === 'src/utils/createLinksForMessage.ts') return common;
    if (name === 'src/utils/project') return { dateConvertToUserZone: (x: unknown) => x, addBehaviorLog: () => {} };
    if (name === 'src/utils/createLinksForMessage') return load('src/utils/createLinksForMessage.ts');
    if (name === 'src/components/comment/config') return load('src/components/comment/config.ts');
    if (name === './messageLinkTypes') return load('src/utils/messageLinkTypes.ts');
    if (name === 'src/components/emotion/emotion') return { parse: (value: string) => value };
    if (name === 'src/pages/chat/utils') return { formatMsgDate: (x: unknown) => x };
    if (name === 'src/components/comment/commenter') return Commenter;
    if (name.startsWith('src/api/')) return {};
    if (name === 'ming-ui') return { UserCard: Leaf };
    if (name.startsWith('ming-ui/') || name === 'src/components/UploadFiles') return Leaf;
    if (name === 'react-dom/client') return { createRoot: () => { throw new Error('Unexpected DOM mount'); } };
    if (name.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
      if (['/avatar', '/replyTo', '/star', '/userLink'].some(suffix => target.endsWith(suffix))) return Leaf;
      const resolved = ['.ts', '.tsx', ''].map(ext => target + ext).find(p => fs.existsSync(path.join(harness.ROOT, p)));
      if (resolved) return load(resolved);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', transformed.code)(localRequire, module, module.exports);
  return module.exports;
}
function instance(Type: Component, props: Data): Subject {
  const value = new Type(props);
  value.setState = patch => { Object.assign(value.state, patch); };
  return value;
}
function children(element: unknown): ElementNode[] {
  if (!element || typeof element !== 'object') return [];
  const e = element as ElementNode;
  const found = [e];
  const nested = e.props?.['children'];
  for (const child of Array.isArray(nested) ? nested.flat() : [nested]) found.push(...children(child));
  return found;
}
const util = load(root + '/util.ts') as unknown as { formatTopic: (raw: Data, type?: number) => Data };
const PostReply = load(root + '/components/wrappedComp/postReply.tsx')['default'] as Component;
const Body = load(root + '/components/baseComponent/messageContent.tsx')['default'] as Component;
const Area = load(root + '/components/baseComponent/commentArea.tsx')['default'] as Component;
let passed = 0;
function check(name: string, fn: () => void): void { fn(); passed++; console.log('  ✓ ' + name); }
check('PostReply → body → CommentArea uses the same raw post/comment and mention objects', () => {
  const mentions = [{ accountId: 'a', fullname: 'A' }];
  const attachments = [{ key: 'attachment' }];
  const comment = { message: 'hello', postID: 'p', commentID: 'c', user: { accountId: 'self', userName: 'Self' }, rUserList: mentions, attachments };
  const props = { Post: { postID: 'p', message: 'source', comments: [comment] }, inboxType: 8, createTime: 1, CreateUser: { accountId: 'a' } };
  const reply = instance(PostReply, props);
  const rendered = reply.render();
  assert.equal(rendered.type, Body);
  assert.equal(rendered.props['attachments'], attachments);
  assert.equal(rendered.props['sourceId'], 'p');
  assert.equal(rendered.props['message'], 'hello');
  const body = instance(Body, { ...rendered.props, canReply: true, comments: [comment] });
  const areaElement = body.renderCommentArea();
  assert.equal(areaElement.type, Area);
  const incoming = areaElement.props['commentsProps'] as { comments: Data[] };
  assert.equal(incoming.comments[0], comment);
  const area = instance(Area, areaElement.props);
  const normalized = (area.state['comments'] as Data[])[0]!;
  assert.equal(normalized['accountsInMessage'], mentions);
  assert.equal(normalized['attachment'], attachments);
  assert.equal(normalized['discussionId'], 'c');
});
check('cloned child onSubmit runs the real add callback and formatter; old entries keep identity', () => {
  const first = { user: { accountId: 'self' }, postID: 'p', commentID: 'first', message: 'old' };
  const area = instance(Area, { params: { sourceId: 'p' }, commentsProps: { comments: [first] } });
  const old = (area.state['comments'] as Data[])[0];
  const tree = area.renderComments();
  const itemElement = children(tree).find(e => typeof e.type === 'function' && (e.type as { name: string }).name === 'CommentItem');
  assert.ok(itemElement);
  const item = instance(itemElement.type as Component, itemElement.props);
  item.state['showCommenter'] = true;
  const input = children(item.render()).find(e => e.type === Commenter);
  assert.ok(input);
  const raw = { user: { accountId: 'other' }, message: 'next', commentID: 'next' };
  (input.props['onSubmit'] as (value: Data) => void)(raw);
  const list = area.state['comments'] as Data[];
  assert.equal(list[0]!['discussionId'], 'next');
  assert.equal(list[0]!['canDelete'], false);
  assert.equal(list[1], old);
});
check('discussion normalization retains creator/attachments/reply references and numeric deletion count', () => {
  const creator = { accountId: 'self', fullname: 'Self' }, attachments = [{ id: 1 }], reply = { accountId: 'other' };
  const output = util.formatTopic({ createAccount: creator, attachments, replyId: 'r', replyAccount: reply, sourceId: 's' }, 1);
  assert.equal(output['createAccount'], creator);
  assert.equal(output['attachment'], attachments);
  assert.equal(output['replyAccount'], reply);
  assert.equal(output['isDeleteAttachment'], 1);
  assert.equal(Object.hasOwn(output, 'groupsInMessage'), false);
});
check('native missing-post/comment/body failures and formatter short circuit remain visible', () => {
  for (const Post of [undefined, {}, { comments: [] }]) assert.throws(() => instance(PostReply, { Post }), TypeError);
  assert.throws(() => instance(Body, {}), TypeError);
  assert.throws(() => util.formatTopic({ user: undefined }), TypeError);
  assert.throws(() => util.formatTopic({ createAccount: { accountId: 'self' } }, 1), TypeError);
  assert.equal(util.formatTopic({ createAccount: { accountId: 'other' } }, 1)['isDeleteAttachment'], false);
});
check('feed getters run at original read sites and raw objects are not mutated', () => {
  const trace: string[] = [], mentions = [{ accountId: 'a' }];
  const raw = { user: { accountId: 'other' }, get replyID() { trace.push('replyID'); return 'r'; }, get rUserList() { trace.push('rUserList'); return mentions; }, attachments: [] };
  const keys = Object.keys(raw);
  const out = util.formatTopic(raw);
  assert.deepEqual(trace, ['replyID', 'replyID', 'replyID', 'rUserList']);
  assert.equal(out['accountsInMessage'], mentions);
  assert.deepEqual(Object.keys(raw), keys);
});
console.log('Inbox payload pipeline passed: ' + passed + ' checks');
