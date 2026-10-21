/**
 * `wrappedComp/postReply` 与 `Inbox/util.formatInboxItem` 之间的**类型形状差异证据**
 * （持续目标·为 lead 决策"是否统一两个 props 形状"提供可执行证据；产品源码未改）。
 *
 * 【背景】`postReply.render()` 里：
 * ```ts
 * ...formatInboxItem(props),   // props: PostReplyProps
 * ```
 * 而 `formatInboxItem(inboxItem: InboxItem)`。**当前能通过编译**，但两者的 `Post` 形状并不相同：
 *
 * | 字段 | `PostReplyPost`（postReply 的 props） | `InboxItem['Post']`（formatInboxItem 的入参） |
 * |---|---|---|
 * | `postID` / `message` | `string \| undefined` | 同 |
 * | `rUserList` / `rGroupList` / `categories` | `unknown[]` | `unknown` |
 * | **`comments`** | **`PostReplyComment[]`（必需）** | **`unknown[]`（可选）** |
 * | `postType` / `commentCount` / `link*` | 未声明 | 已声明（可选） |
 *
 * 【为什么这值得钉住】第 166 片我曾尝试把 `InboxItem.Post` 的
 * `rUserList`/`rGroupList`/`categories` 从 `unknown` 收窄为具体提及类型，结果触发
 * `TS2345: PostReplyProps is not assignable to InboxItem` —— 因为 `PostReplyPost` 那边仍是 `unknown[]`。
 *
 * 也就是说：**这两个形状的差异是那两处 `as unknown as MessageArgs` 断言存在的原因**。
 * 要消除断言，必须先统一这两个形状（跨文件结构调整，影响面大）。
 *
 * 【本 spec 做什么】不测运行时行为（这是纯类型问题），而是把**差异事实**写成可执行断言：
 * 从两个源文件抽取类型定义文本，逐字段比对，把"哪里不同"固化成测试输出。
 * 一旦有人统一了形状，本 spec 会失败并提示"差异已消失，可以去掉那两处断言了"。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，用 harness 读源码文本。
 */

import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');

const POST_REPLY = 'src/pages/chat/components/Inbox/components/wrappedComp/postReply.tsx';
const INBOX_UTIL = 'src/pages/chat/components/Inbox/util.ts';

/** 从源码里取出某个 interface 的字段声明（只取顶层 `name?: type;` 形式） */
function readInterfaceFields(file: string, interfaceName: string): Record<string, string> {
  const src = harness.readSource(file);
  const re = new RegExp(`interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`${file} 里没有 interface ${interfaceName}`);
  const body = m[1] as string;
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const f = /^\s{2}(\w+)(\??):\s*(.+?);\s*$/.exec(line);
    if (f) out[f[1] as string] = f[3] as string;
  }
  return out;
}

/** `InboxItem['Post']` 是内联对象字面量，单独解析 */
function readInboxItemPostFields(): Record<string, string> {
  const src = harness.readSource(INBOX_UTIL);
  const m = /Post\?:\s*\n\s*\|?\s*\{([\s\S]*?)\n\s{6}\}/.exec(src);
  if (!m) throw new Error('InboxItem 里没有找到 Post 的内联形状');
  const body = m[1] as string;
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const f = /^\s{8,}(\w+)(\??):\s*(.+?);\s*$/.exec(line);
    if (f) out[f[1] as string] = f[3] as string;
  }
  return out;
}

const postReplyPost = readInterfaceFields(POST_REPLY, 'PostReplyPost');
const inboxPost = readInboxItemPostFields();

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('两个形状都成功解析出字段（防止 spec 自身静默失效）', () => {
  assert.ok(Object.keys(postReplyPost).length >= 4, `PostReplyPost 解析到 ${Object.keys(postReplyPost).length} 个字段`);
  assert.ok(Object.keys(inboxPost).length >= 8, `InboxItem.Post 解析到 ${Object.keys(inboxPost).length} 个字段`);
});

check('【差异 1】comments：PostReplyPost 是 PostReplyComment[]（必需），InboxItem.Post 是 unknown[]（可选）', () => {
  assert.ok('comments' in postReplyPost, 'PostReplyPost 声明了 comments');
  assert.ok('comments' in inboxPost, 'InboxItem.Post 声明了 comments');
  // PostReplyPost.comments 无 ? 号 → 必需
  const postReplySrc = harness.readSource(POST_REPLY);
  assert.ok(
    /interface PostReplyPost \{[\s\S]*?\n {2}comments: PostReplyComment\[\];/.test(postReplySrc),
    'PostReplyPost.comments 是必需的 PostReplyComment[]',
  );
  // InboxItem.Post.comments 带 ? 号 → 可选
  assert.equal(inboxPost['comments'], 'unknown[] | undefined', 'InboxItem.Post.comments 是可选的 unknown[]');
});

check('【差异 2】rUserList/rGroupList/categories：PostReplyPost 是 unknown[]，InboxItem.Post 是 unknown', () => {
  for (const key of ['rUserList', 'rGroupList', 'categories']) {
    assert.equal(postReplyPost[key], 'unknown[] | undefined', `PostReplyPost.${key} 应为 unknown[]`);
    assert.equal(inboxPost[key], 'unknown', `InboxItem.Post.${key} 应为 unknown`);
  }
});

check('【差异 3】InboxItem.Post 额外声明了 postType/commentCount/link* 等字段（PostReplyPost 没有）', () => {
  const extras = ['postType', 'commentCount', 'linkTitle', 'linkUrl', 'linkThumb', 'linkDesc'];
  for (const key of extras) {
    assert.ok(key in inboxPost, `InboxItem.Post 声明了 ${key}`);
    assert.equal(key in postReplyPost, false, `PostReplyPost 未声明 ${key}`);
  }
});

check('共同字段 postID/message 在两边同类型', () => {
  assert.equal(postReplyPost['postID'], 'string | undefined');
  assert.equal(inboxPost['postID'], 'string | undefined');
  assert.equal(postReplyPost['message'], 'string | undefined');
  assert.equal(inboxPost['message'], 'string | undefined');
});

check('【结论固化】两个 props 都带顶层宽索引 —— 这正是差异被"容忍"的原因', () => {
  const postReplySrc = harness.readSource(POST_REPLY);
  assert.ok(
    /interface PostReplyProps \{[\s\S]*?\[key: string\]: unknown;/.test(postReplySrc),
    'PostReplyProps 有宽索引',
  );
  const utilSrc = harness.readSource(INBOX_UTIL);
  const inboxItemBlock = /export interface InboxItem \{([\s\S]*?)\n\}/.exec(utilSrc);
  assert.ok(inboxItemBlock, '找到 InboxItem 定义');
  assert.equal(
    (inboxItemBlock as RegExpExecArray)[1]!.includes('[key: string]: unknown'),
    true,
    'InboxItem 顶层**也有**宽索引 —— 两个宽索引让互不兼容的 Post 形状仍能互相赋值',
  );
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
  console.log(`chat/postReply↔InboxItem 形状差异证据规格通过：${passed} 项`);
}

main();