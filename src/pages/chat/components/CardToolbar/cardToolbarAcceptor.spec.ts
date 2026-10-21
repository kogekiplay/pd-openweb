/**
 * `components/CardToolbar` 的 `acceptor` 构造规格
 * （持续目标·记录一处**跨文件真实缺陷**的行为证据；产品源码未改）。
 *
 * 【背景】`utils/cardSender` 真实读取 `acceptor.name` 与 `acceptor.isGroup`：
 * ```ts
 * fullname: acceptor.name as string,                                   // :149 与 :236
 * ProjectID: (acceptor.isGroup ? acceptor.projectId : '') as string,   // :158
 * ```
 * 而 `CardToolbar` 构造 acceptor 时**只写 5 个字段**，没有 `name`/`isGroup`。
 *
 * 【本 spec 要钉住的事实】
 * 1. 构造出的 acceptor **不含** `name` 与 `isGroup` 键（`'name' in acceptor === false`）；
 * 2. 因此 `acceptor.name` 为 `undefined` → 建任务/日程时成员 `fullname` 会是 `undefined`；
 * 3. 因此 `acceptor.isGroup` 为 `undefined` → 群聊场景 `ProjectID` 三元**恒走 `''` 分支**，
 *    即便 `projectId` 已被正确算出。
 *
 * 【为什么用"钉住缺陷"而不是"断言正确"】
 * 修复它会改变运行行为（fullname 从 undefined 变成真实值、群聊 ProjectID 从空串变成真实 id），
 * 按协作规则这必须由 lead 决定。本 spec 的作用是让这个缺陷**可复现、可回归**：
 * 一旦哪天补上了这两个字段，本 spec 会失败并提醒复核上游决策。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，从真实源码抽取 constructor 体执行。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  body?: BabelNode | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/CardToolbar/index.tsx';

/** 抽出 constructor 内 `this.acceptor = {...}` 的对象字面量源码（真实源码，非复制） */
function extractAcceptorLiteral(): string {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    // 找 ClassMethod constructor，再在其 body 里找 this.acceptor = <ObjectExpression>
    if (node.type === 'ClassMethod' && node.key && node.key.name === 'constructor') {
      const b = node.body;
      const walk = (n: BabelNode | null | undefined): void => {
        if (!n || typeof n !== 'object') return;
        const node = n as unknown as {
          type?: string;
          left?: { type?: string; property?: { name?: string }; object?: { type?: string } };
          right?: BabelNode;
        };
        if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'MemberExpression') {
          const left = node.left;
          const right = node.right;
          if (
            left.property &&
            left.property.name === 'acceptor' &&
            left.object &&
            left.object.type === 'ThisExpression' &&
            right &&
            right.type === 'ObjectExpression' &&
            typeof right.start === 'number' &&
            typeof right.end === 'number'
          ) {
            found = { start: right.start, end: right.end };
          }
        }
        for (const k of Object.keys(n)) {
          if (k === 'start' || k === 'end' || k === 'loc') continue;
          const v = n[k];
          if (Array.isArray(v)) v.forEach(x => walk(x as BabelNode));
          else if (v && typeof v === 'object' && typeof (v as BabelNode).type === 'string') walk(v as BabelNode);
        }
      };
      walk(b);
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(v => visit(v as BabelNode));
      else if (value && typeof value === 'object' && typeof (value as BabelNode).type === 'string') {
        visit(value as BabelNode);
      }
    }
  };
  visit(ast.program as unknown as BabelNode);
  const loc = found as { start: number; end: number } | null;
  if (!loc) throw new Error('真实源码里没有找到 this.acceptor = {...}');
  return source.slice(loc.start, loc.end);
}

const literal = extractAcceptorLiteral();
const transformed = harness.transformSync(`var __acceptor = ${literal};\n`, { filename: 'cardToolbar-acceptor.ts' });
if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换片段');
const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');

/** 用真实构造表达式生成 acceptor（session/Constant 由参数注入） */
function makeAcceptor(session: Record<string, unknown>, Constant: Record<string, unknown>) {
  const factory = new Function(
    'session',
    'Constant',
    `${code}\nreturn __acceptor;`,
  ) as unknown as (s: Record<string, unknown>, c: Record<string, unknown>) => Record<string, unknown>;
  return factory(session, Constant);
}

const Constant = { SESSIONTYPE_GROUP: 2, SESSIONTYPE_USER: 1 };

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('构造出的 acceptor 有 5 个字段：avatar/id/isPost/projectId/type', () => {
  const a = makeAcceptor({ avatar: 'a.png', id: 's1', isPost: false, projectId: '', isGroup: false }, Constant);
  assert.deepEqual(Object.keys(a).sort(), ['avatar', 'id', 'isPost', 'projectId', 'type']);
});

check('【缺陷证据】acceptor **不含** name 键 → cardSender 读到 undefined', () => {
  const a = makeAcceptor({ id: 's1', name: '产品讨论组', isGroup: true }, Constant);
  assert.equal('name' in a, false, 'CardToolbar 从未写入 name');
  assert.equal(a['name'], undefined, 'cardSender 的 `fullname: acceptor.name` 会得到 undefined');
});

check('【缺陷证据】acceptor **不含** isGroup 键 → 群聊 ProjectID 三元恒走空串分支', () => {
  const a = makeAcceptor({ id: 's1', isGroup: true, projectId: 'p1', project: { projectId: 'pid-123' } }, Constant);
  assert.equal('isGroup' in a, false, 'CardToolbar 从未写入 isGroup');
  // 复现 cardSender 的三元表达式（它就在产品源码里这样写）
  const projectId = (a['isGroup'] ? a['projectId'] : '') as string;
  assert.equal(projectId, '', '尽管 projectId 已被算出为 pid-123，isGroup 缺失导致恒取空串');
  assert.equal(a['projectId'], 'pid-123', 'projectId 本身是对的，问题在 isGroup 缺失');
});

check('群聊时 type 取 SESSIONTYPE_GROUP（这段是对的）', () => {
  const a = makeAcceptor({ id: 's1', isGroup: true }, Constant);
  assert.equal(a['type'], 2);
});

check('单聊时 type 取 SESSIONTYPE_USER', () => {
  const a = makeAcceptor({ id: 's1', isGroup: false }, Constant);
  assert.equal(a['type'], 1);
});

check('projectId 缺省时为空字符串（原实现如此）', () => {
  const a = makeAcceptor({ id: 's1' }, Constant);
  assert.equal(a['projectId'], '');
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
  console.log(`chat/CardToolbar acceptor 缺陷证据规格通过：${passed} 项`);
}

main();