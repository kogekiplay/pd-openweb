/** Render the complete production PostMention class. UI shell and message-link leaves are controlled. */
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
type Data = Record<string, unknown>;
interface Subject {
  state: Data;
  render(): import('react').ReactElement;
  renderAccessory(): import('react').ReactElement | null | undefined;
}
const cache = new Map<string, Data>();
Reflect.set(globalThis, '_l', (text: string) => text);
function Shell(props: { children?: import('react').ReactNode }) { return props.children; }
function load(file: string): Data {
  if (cache.has(file)) return cache.get(file)!;
  const transformed = harness.transformFileSync(path.join(harness.ROOT, file));
  assert.ok(transformed?.code, file);
  const module = { exports: {} as Data }; cache.set(file, module.exports);
  const localRequire = (name: string): unknown => {
    if (name === 'src/utils/common') return { pathCompletion: (value: unknown) => value, htmlEncodeReg: (value: unknown) => value, browserIsMobile: () => false };
    if (name === 'src/utils/createLinksForMessage') return (args: { message: string }) => args.message;
    if (name === '../baseComponent/messageContent') return Shell;
    if (name === '../../constants' || name === './constants') return load('src/pages/chat/components/Inbox/constants.ts');
    if (name === '../../util') return load('src/pages/chat/components/Inbox/util.ts');
    return require(name);
  };
  new Function('module', 'exports', 'require', transformed.code)(module, module.exports, localRequire);
  return module.exports;
}
const constants = load('src/pages/chat/components/Inbox/constants.ts')['MSGTYPES'] as Record<string, number>;
const PostMention = load('src/pages/chat/components/Inbox/components/wrappedComp/postMention.tsx')['default'] as new (props: Data) => Subject;
function make(kind: number, post: Data): Subject {
  return new PostMention({ inboxType: kind, createTime: 'now', CreateUser: { accountId: 'author' }, Post: { postID: 'p1', message: 'post text', comments: [{ message: 'comment text', commentID: 'c1' }], ...post } });
}
function render(instance: Subject): string { return renderToStaticMarkup(instance.render()); }
let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log('  ✓ ' + name); }
check('both real comment-mention branches render medal text as inline style, without React style warnings', () => {
  for (const kind of [constants['PostCommentMentionedUser']!, constants['PostCommentMentionedGroup']!]) {
    const warnings: unknown[][] = [], previous = console.error;
    let html: string, instance: Subject;
    console.error = (...args: unknown[]) => { warnings.push(args); };
    try {
      instance = make(kind, { postType: 0, MedalPost: { MedalName: 'Gold <medal>', MedalPath: '/medal.png', MedalDescription: 'Thanks <team>' } });
      html = render(instance);
    } finally { console.error = previous; }
    assert.match(html!, /<p class="colorPrimary mTop20" style="font-size:12px;line-height:20px">Gold &lt;medal&gt;<\/p>/);
    assert.match(html!, /<p style="color:var\(--color-text-secondary\);font-size:12px;line-height:20px">Thanks &lt;team&gt;<\/p>/);
    assert.ok(!html!.includes('[object Object]'));
    assert.deepEqual(warnings, []);
    assert.equal(instance!.state['message'], 'comment text');
    assert.equal(instance!.state['discussionId'], 'c1');
    assert.equal(instance!.state['fromLink'], '/feeddetail?itemID=p1');
  }
});
check('actual medal reads retain getter order and render absent or explicit undefined text as empty', () => {
  const trace: string[] = [];
  const medal = Object.defineProperties({}, {
    MedalName: { get() { trace.push('name'); return undefined; } },
    MedalPath: { get() { trace.push('path'); return '/m.png'; } },
    MedalDescription: { get() { trace.push('description'); return undefined; } },
  });
  const html = render(make(constants['PostCommentMentionedUser']!, { postType: 0, MedalPost: medal }));
  assert.deepEqual(trace, ['name', 'path', 'description']);
  assert.match(html, /<p style="color:var\(--color-text-secondary\);font-size:12px;line-height:20px"><\/p>/);
  assert.ok(!html.includes('undefined'));
  assert.match(render(make(constants['PostCommentMentionedUser']!, { postType: 0, MedalPost: {} })), /line-height:20px"><\/p>/);
});
check('direct mentions keep no accessory and retain the actual constructor source state', () => {
  for (const kind of [constants['PostMentionedUser']!, constants['PostMentionedGroup']!]) {
    const instance = make(kind, { postType: 0, MedalPost: { MedalName: 'unused' }, commentCount: '2' });
    assert.equal(instance.renderAccessory(), null);
    assert.equal(instance.state['message'], 'post text');
    assert.equal(instance.state['commentsCount'], 2);
    assert.equal(render(instance), '');
  }
});
check('link and Q&A/vote accessory branches still execute the actual render implementation', () => {
  const kind = constants['PostCommentMentionedUser']!;
  assert.match(render(make(kind, { postType: 1, linkTitle: 'Link', linkUrl: '/target', linkThumb: '/thumb.png', linkDesc: 'TEXT' })), /href="\/target"/);
  assert.match(render(make(kind, { postType: 1, linkDesc: 'TEXT' })), />text<\/div>/);
  for (const postType of [4, 7]) assert.match(render(make(kind, { postType, message: 'x'.repeat(26) })), />x{25}\.\.\.<\/div>/);
  assert.equal(make(kind, { postType: 9 }).renderAccessory(), undefined);
});
check('missing Post or MedalPost keeps native failure at the original read', () => {
  const instance = make(constants['PostCommentMentionedUser']!, { postType: 0 });
  assert.throws(() => render(instance), TypeError);
  assert.throws(() => new PostMention({ inboxType: constants['PostCommentMentionedUser'] }), TypeError);
});
console.log(`chat/PostMention actual component: ${passed} checks passed`);
