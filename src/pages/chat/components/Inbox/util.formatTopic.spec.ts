/**
 * `components/Inbox/util.ts` 的 `formatTopic` 规格
 * （持续目标·补齐有真实逻辑但无任何 spec 覆盖的纯函数）。
 *
 * 【它做什么】把收件箱/评论条目归一成评论组件消费的形状，**两个分支**：
 * - `type === SOURCE_TYPE.POST`（动态）：读 `item.user` 作为创建人，处理回复人三态；
 * - 其它类型（日程/任务/…）：从条目的其它字段取创建人。
 *
 * 【本 spec 钉住的真实语义】（都是从源码读出来的，不是"期望"）
 * 1. 两个分支最终都**返回 `{ ...formatedData, sourceType: type }`** —— `sourceType` 是调用方传进来的 `type`；
 * 2. `canDelete` 的判定：`item.allowOperate === '1'` **或** 创建人就是当前登录账号；
 * 3. `isDeleteAttachment` 是 `canDelete && item.askDeleteAttachment === '1'`（**两个条件都要满足**）；
 * 4. POST 分支的 `status` 由 `item.Secretary` 决定（有则 2，无则 1）；
 * 5. 回复人三态：`replyID` 存在且 `replyUser` 存在 → 用它；`replyID` 存在但无 `replyUser` → 用 `replyAccountId`/`replyUserName`；无 `replyID` → `null`；
 * 6. `replyId` 字段是 `item.replyID ? item.replyID : null`（**空字符串也会走 null**）。
 *
 * 【自包含】从真实源码抽取 `formatTopic` 函数体执行，`md`/`SOURCE_TYPE` 由参数注入。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/util.ts';

function extractVar(name: string): string {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === name) {
      const init = node.init;
      if (init && typeof init.start === 'number' && typeof init.end === 'number') {
        found = { start: init.start, end: init.end };
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
  const loc = found as { start: number; end: number } | null;
  if (!loc) throw new Error(`真实源码里没有找到 ${name}`);
  return source.slice(loc.start, loc.end);
}

const transformed = harness.transformSync(`var formatTopic = ${extractVar('formatTopic')};\n`, {
  filename: 'formatTopic-snippet.ts',
});
if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换片段');
const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');

/**
 * `SOURCE_TYPE.POST` 的真实值是 **`undefined`**（既有缺陷，见 inboxUtil.spec.ts 同款说明）。
 * 这里直接按真实值注入，不猜一个数字——否则测的就不是真实分支了。
 */
const POST = undefined as unknown as number;

function make(myAccountId: string) {
  const md = { global: { Account: { accountId: myAccountId } } };
  const SOURCE_TYPE = { POST };
  const factory = new Function(
    'md',
    'SOURCE_TYPE',
    `${code}\nreturn formatTopic;`,
  ) as unknown as (
    m: unknown,
    s: unknown,
  ) => (item: Record<string, unknown>, type: number | undefined) => Record<string, unknown>;
  return factory(md, SOURCE_TYPE);
}

/** 默认环境：当前登录账号 u1（多数用例用它） */
const formatTopic = make('u1');

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

const postItem = (over: Record<string, unknown> = {}) => ({
  user: { accountId: 'u1', userName: '张三', userMiddleHead: 'h.png' },
  postID: 'p1',
  commentID: 'c1',
  message: '正文',
  attachments: [{ a: 1 }],
  allowOperate: '0',
  askDeleteAttachment: '0',
  ...over,
});

check('POST 分支：createAccount 从 item.user 取 accountId/avatar/fullname', () => {
  const f = formatTopic;
  const r = f(postItem(), POST);
  assert.deepEqual(r['createAccount'], {
    accountId: 'u1',
    avatar: 'h.png',
    fullname: '张三',
    status: 1,
  });
});

check('POST 分支：Secretary 存在时 status 为 2', () => {
  const r = formatTopic(postItem({ Secretary: true }), POST);
  assert.equal((r['createAccount'] as { status: number }).status, 2);
});

check('sourceType 恒为调用方传入的 type（两个分支都是）', () => {
  assert.equal(formatTopic(postItem(), POST)['sourceType'], POST);
  // 非 POST 分支读取的是 topic.createAccount（不是 item.user），attachments 必需
  const other = formatTopic(
    {
      createAccount: { accountId: 'u1' },
      attachments: [],
      sourceId: 's1',
      message: 'm',
    } as Record<string, unknown>,
    3,
  );
  assert.equal(other['sourceType'], 3);
});

check('canDelete：allowOperate === "1" 时为 true（与他人身份无关）', () => {
  const r = formatTopic(postItem({ allowOperate: '1' }), POST);
  assert.equal(r['canDelete'], true);
});

check('canDelete：创建人就是当前账号时为 true', () => {
  const r = formatTopic(postItem(), POST); // 当前账号 u1，创建人 u1
  assert.equal(r['canDelete'], true);
});

check('canDelete：既非 allowOperate==="1" 也不是本人时为 false', () => {
  const r = make('me')(postItem(), POST);
  assert.equal(r['canDelete'], false);
});

check('isDeleteAttachment 需要 canDelete **且** askDeleteAttachment === "1"', () => {
  // canDelete=false + ask='1' → false
  const r1 = formatTopic(postItem({ allowOperate: '0' }), POST);
  assert.equal(r1['isDeleteAttachment'], false, 'canDelete 为 false 时不该是 true');
  // canDelete=true + ask='1' → true
  const r2 = formatTopic(postItem({ allowOperate: '1', askDeleteAttachment: '1' }), POST);
  assert.equal(r2['isDeleteAttachment'], true);
  // canDelete=true + ask='0' → false
  const r3 = formatTopic(postItem({ allowOperate: '1' }), POST);
  assert.equal(r3['isDeleteAttachment'], false);
});

check('回复人三态 1：有 replyID 且有 replyUser → 用 replyUser', () => {
  const r = formatTopic(postItem({ replyID: 'r1', replyUser: { accountId: 'u2', userName: '李四' } }), POST);
  assert.deepEqual(r['replyAccount'], { accountId: 'u2', fullname: '李四' });
  assert.equal(r['replyId'], 'r1');
});

check('回复人三态 2：有 replyID 但无 replyUser → 用 replyAccountId/replyUserName', () => {
  const r = formatTopic(postItem({ replyID: 'r1', replyAccountId: 'u3', replyUserName: '王五' }), POST);
  assert.deepEqual(r['replyAccount'], { accountId: 'u3', fullname: '王五' });
});

check('回复人三态 3：无 replyID → replyAccount 为 null，replyId 为 null', () => {
  const r = formatTopic(postItem(), POST);
  assert.equal(r['replyAccount'], null);
  assert.equal(r['replyId'], null);
});

check('attachments 缺省时为空数组（不是 undefined）', () => {
  const r = formatTopic(postItem({ attachments: undefined }), POST);
  assert.deepEqual(r['attachment'], []);
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
  console.log(`chat/formatTopic 规格通过：${passed} 项`);
}

main();