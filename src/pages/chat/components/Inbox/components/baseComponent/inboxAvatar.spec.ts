/**
 * `src/pages/chat/components/Inbox/components/baseComponent/avatar.tsx` 的结构规格
 * （持续目标·收件箱头像切片）。
 *
 * 【为什么这样测】`formatUser` 是这张头像唯一的真实逻辑：按 `inboxType`（`MSGTYPES`）把消息类型
 * 归一成 `applicationType` 图标类别，并把 accountId/fullname/avatar/appId 原样带出：
 * - 系统 1 → 'system'；日历 3 → 'calendar'；任务 4 与项目 14 → 'task'；知识 13 → 'knowledge'；
 *   审批 18 → 'approval'；考勤 22 → 'check'；文档 32 → 'dossier'；工作表 36 → 'worksheet'；
 *   工作流 44/45/46/47 → 'workflow'；其它 → ''（空串，走默认头像）。
 * 本 spec 从**真实源码**抽 `formatUser` 执行（不复制、不改产品源码），常量表传入真实数值。
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

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/avatar.tsx';

/** `MSGTYPES` 的真实数值（与 `components/Inbox/constants.ts` 一致） */
const MSGTYPES = {
  SystemMessage: 1,
  CalendarMessage: 3,
  TaskMessage: 4,
  KCMessage: 13,
  FolderMessage: 14,
  ApprovalMessage: 18,
  AttendanceMessage: 22,
  DossierMessage: 32,
  WorkSheetMessage: 36,
  WorkFlowMessage: 44,
  WorkFlowTaskMessage: 45,
  WorkFlowUserTaskMessage: 46,
  WorkFlowSendTaskMessage: 47,
};

function extract(): (
  msgTypes: Record<string, number>,
  requireStub: (name: string) => unknown,
) => (props: Record<string, unknown>) => Record<string, unknown> {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    // 真实写法是 `const formatUser = function (props) {...}`，取 init 的区间
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'formatUser') {
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
  if (!loc) throw new Error('真实源码里没有找到 formatUser');
  const body = source.slice(loc.start, loc.end);
  // 抽到的是函数表达式（init），包成声明再编译
  const transformed = harness.transformSync(`var formatUser = ${body};\n`, {
    filename: 'avatarFormatUser-snippet.tsx',
  });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function('MSGTYPES', 'require', `${code}\nreturn formatUser;`) as unknown as (
    msgTypes: Record<string, number>,
    requireStub: (name: string) => unknown,
  ) => (props: Record<string, unknown>) => Record<string, unknown>;
}

const factory = extract();

function make(): (props: Record<string, unknown>) => Record<string, unknown> {
  return factory(MSGTYPES, (name: string) => {
    throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
  });
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check(
  'formatUser：各 MSGTYPES 归一成 applicationType（系统/日历/任务与项目/知识/审批/考勤/文档/工作表/工作流）',
  () => {
    const format = make();
    const cases: [number, string][] = [
      [MSGTYPES.SystemMessage, 'system'],
      [MSGTYPES.CalendarMessage, 'calendar'],
      [MSGTYPES.TaskMessage, 'task'],
      [MSGTYPES.FolderMessage, 'task'],
      [MSGTYPES.KCMessage, 'knowledge'],
      [MSGTYPES.ApprovalMessage, 'approval'],
      [MSGTYPES.AttendanceMessage, 'check'],
      [MSGTYPES.DossierMessage, 'dossier'],
      [MSGTYPES.WorkSheetMessage, 'worksheet'],
      [MSGTYPES.WorkFlowMessage, 'workflow'],
      [MSGTYPES.WorkFlowTaskMessage, 'workflow'],
      [MSGTYPES.WorkFlowUserTaskMessage, 'workflow'],
      [MSGTYPES.WorkFlowSendTaskMessage, 'workflow'],
    ];
    for (const [inboxType, expected] of cases) {
      const result = format({ inboxType });
      assert.equal(result.applicationType, expected, `inboxType=${inboxType} 应为 ${expected}`);
    }
  },
);

check('formatUser：未命中 → applicationType 为空串（走默认头像）', () => {
  const format = make();
  assert.equal(format({ inboxType: 999 }).applicationType, '');
  assert.equal(format({}).applicationType, '');
});

check('formatUser：accountId/fullname/avatar/appId 原样带出', () => {
  const format = make();
  const result = format({
    inboxType: MSGTYPES.SystemMessage,
    accountId: 'u1',
    fullname: '张三',
    avatar: 'a.png',
    appId: 'app-1',
  });
  assert.deepEqual(result, {
    accountId: 'u1',
    fullname: '张三',
    avatar: 'a.png',
    applicationType: 'system',
    appId: 'app-1',
  });
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
  console.log(`chat/InboxAvatar 行为规格通过：${passed} 项`);
}

main();
