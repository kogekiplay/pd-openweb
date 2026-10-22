/**
 * `components/Inbox/components/inboxMessage` 的分发规格
 * （持续目标·补齐 lead 白名单中未被规格直接覆盖的文件）。
 *
 * 【它做什么】收件箱条目的**渲染分发表**：把 `inboxType` 归一成数字后，按 `MSGTYPES`
 * 分发到 `SystemMessage` / `PostReply` / `PostMention` / `CommonTopic`，其余返回 `null`。
 *
 * 【本 spec 钉住的真实行为】（从真实函数体执行）
 * 1. `inboxType` 先经 `parseInt(x as string, 10)` **归一**：字符串 `'1'` 与数字 `1` 走同一分支；
 * 2. **每个 case 值都来自 `MSGTYPES` 常量表**（不是硬编码数字），逐组验证路由：
 *    - 14 个系统类 → `SystemMessage`
 *    - `PostReply` → `PostReply`
 *    - 4 个 @ 类 → `PostMention`
 *    - 16 个讨论/评论类 → `CommonTopic`
 * 3. **`props` 是 `_.extend({}, inboxItem, { inboxType })`** —— 即
 *    ① **不修改原 inboxItem**（新对象）；② `inboxType` 被**归一后的数字覆盖**；
 *    ③ 其余字段原样透传；
 * 4. 未知类型 → **返回 `null`**（不是抛错、不是回退到某个默认组件）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：抽真实函数体执行，
 * `_`/`MSGTYPES`/四个组件由参数注入；用返回的桩组件名判断路由。
 */
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  id?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/inboxMessage.tsx';
const CONSTANTS = 'src/pages/chat/components/Inbox/constants.ts';

/** 抽 `export default function InboxMessage(...) {...}` 的函数体 */
function extractFnBody(): string {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ExportDefaultDeclaration') {
      const decl = (node as { declaration?: BabelNode }).declaration;
      if (decl && decl.type === 'FunctionDeclaration') {
        const b = (decl as { body?: BabelNode }).body;
        if (b && typeof b.start === 'number' && typeof b.end === 'number') {
          found = { start: b.start + 1, end: b.end - 1 };
        }
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
  if (!loc) throw new Error('真实源码里没有找到 InboxMessage');
  return source.slice(loc.start, loc.end);
}

/** 从真实 constants.ts 读 MSGTYPES 数值 */
function readMsgTypes(): Record<string, number> {
  const src = harness.readSource(CONSTANTS);
  const m = /export const MSGTYPES = \{([\s\S]*?)\n\};/.exec(src);
  if (!m) throw new Error('constants.ts 里没有 MSGTYPES');
  const out: Record<string, number> = {};
  for (const line of (m[1] as string).split('\n')) {
    const f = /^\s+(\w+):\s*(-?\d+)/.exec(line);
    if (f) out[f[1] as string] = Number(f[2]);
  }
  return out;
}

const MSG = readMsgTypes();
const body = extractFnBody();
const transformed = harness.transformSync(`function __InboxMessage(_props) {${body}}\n`, {
  filename: 'inboxMessage-body.tsx',
});
if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换片段');
const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');

type Routed =
  | { kind: 'component'; name: string; props: Record<string, unknown> }
  | { kind: 'null' }
  | { kind: 'other'; value: unknown };

function route(inboxItem: Record<string, unknown>): Routed {
  const make = (name: string) => {
    const fn = (p: Record<string, unknown>) => ({ __stub: name, __props: p });
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
  };
  const Components = {
    SystemMessage: make('SystemMessage'),
    PostReply: make('PostReply'),
    PostMention: make('PostMention'),
    CommonTopic: make('CommonTopic'),
  };
  const _ = require('lodash');
  const jsxRuntime = require('react/jsx-runtime');
  const requireStub = (n: string): unknown => (n === 'react/jsx-runtime' ? jsxRuntime : undefined);
  const factory = new Function(
    '_',
    'MSGTYPES',
    'SystemMessage',
    'PostReply',
    'PostMention',
    'CommonTopic',
    'require',
    `${code}\nreturn __InboxMessage;`,
  ) as unknown as (
    lodash: unknown,
    msgTypes: unknown,
    sm: unknown,
    pr: unknown,
    pm: unknown,
    ct: unknown,
    req: (n: string) => unknown,
  ) => (p: { inboxItem: Record<string, unknown> }) => unknown;
  const fn = factory(
    _,
    MSG,
    Components.SystemMessage,
    Components.PostReply,
    Components.PostMention,
    Components.CommonTopic,
    requireStub,
  );
  const out = fn({ inboxItem });
  if (out === null) return { kind: 'null' };
  const el = out as { type?: unknown; props?: Record<string, unknown> } | undefined;
  if (el && typeof el.type === 'function') {
    return { kind: 'component', name: (el.type as { name?: string }).name ?? '', props: el.props ?? {} };
  }
  return { kind: 'other', value: out };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

const SYSTEM_TYPES = [
  'SystemMessage',
  'TaskMessage',
  'FolderMessage',
  'CalendarMessage',
  'KCMessage',
  'ApprovalMessage',
  'AttendanceMessage',
  'DossierMessage',
  'WorkSheetMessage',
  'WorkFlowMessage',
  'WorkFlowTaskMessage',
  'WorkFlowUserTaskMessage',
  'WorkFlowSendTaskMessage',
  'WorkFlowSendMessage',
];
const MENTION_TYPES = [
  'PostMentionedUser',
  'PostMentionedGroup',
  'PostCommentMentionedUser',
  'PostCommentMentionedGroup',
];
const TOPIC_TYPES = [
  'TaskComment',
  'TaskReply',
  'TaskMentioned',
  'FolderComment',
  'FolderReply',
  'FolderMentioned',
  'CalendarComment',
  'CalendarReply',
  'CalendarMentioned',
  'WorkSheetComment',
  'WorkSheetMentioned',
  'WorkSheetReply',
  'WorkSheetRowReply',
  'WorkSheetRowMentioned',
  'WorkSheetRowComment',
  'FocusMessage',
];

check('MSGTYPES 成功解析（防 spec 自身静默失效）', () => {
  assert.ok(Object.keys(MSG).length >= 20, `解析到 ${Object.keys(MSG).length} 个键`);
  assert.equal(MSG['SystemMessage'], 1, 'SystemMessage 应为 1');
});

check(`14 个系统类消息 → SystemMessage（共 ${SYSTEM_TYPES.length} 个）`, () => {
  for (const k of SYSTEM_TYPES) {
    const r = route({ inboxType: MSG[k] });
    assert.equal(r.kind, 'component', `${k} 应渲染组件`);
    assert.equal((r as { name: string }).name, 'SystemMessage', `${k} 应路由到 SystemMessage`);
  }
});

check('PostReply → PostReply', () => {
  const r = route({ inboxType: MSG['PostReply'] });
  assert.equal((r as { name: string }).name, 'PostReply');
});

check(`4 个 @ 类 → PostMention`, () => {
  for (const k of MENTION_TYPES) {
    const r = route({ inboxType: MSG[k] });
    assert.equal((r as { name: string }).name, 'PostMention', `${k} 应路由到 PostMention`);
  }
});

check(`16 个讨论/评论类 → CommonTopic（共 ${TOPIC_TYPES.length} 个）`, () => {
  for (const k of TOPIC_TYPES) {
    const r = route({ inboxType: MSG[k] });
    assert.equal(r.kind, 'component', `${k} 应渲染组件`);
    assert.equal((r as { name: string }).name, 'CommonTopic', `${k} 应路由到 CommonTopic`);
  }
});

check("字符串形态的 inboxType 经 parseInt 归一后走同一分支（'1' 与 1 等价）", () => {
  const a = route({ inboxType: String(MSG['SystemMessage']) });
  const b = route({ inboxType: MSG['SystemMessage'] });
  assert.equal((a as { name: string }).name, 'SystemMessage');
  assert.equal((a as { name: string }).name, (b as { name: string }).name);
});

check('未知类型 → 返回 null（不抛错、不回退到默认组件）', () => {
  const r = route({ inboxType: 999999 });
  assert.equal(r.kind, 'null', `未知类型应返回 null，实际：${JSON.stringify(r)}`);
});

check('inboxType 缺失 → parseInt(undefined) 为 NaN → 返回 null', () => {
  const r = route({});
  assert.equal(r.kind, 'null');
});

check('props 是 _.extend 新对象：**不修改原 inboxItem**', () => {
  const item: Record<string, unknown> = { inboxType: String(MSG['PostReply']), Post: { id: 'p1' } };
  route(item);
  assert.equal(item['inboxType'], String(MSG['PostReply']), '原对象的 inboxType 应保持字符串形态未被改写');
});

check('传给组件的 inboxType 是**归一后的数字**，其余字段原样透传', () => {
  const r = route({ inboxType: String(MSG['PostReply']), Post: { id: 'p1' }, extra: 'x' });
  const p = (r as { props: Record<string, unknown> }).props;
  assert.equal(p['inboxType'], MSG['PostReply'], 'inboxType 应是数字');
  assert.deepEqual(p['Post'], { id: 'p1' }, '其余字段原样透传');
  assert.equal(p['extra'], 'x');
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
  console.log(`chat/InboxMessage 分发规格通过：${passed} 项`);
}

main();
