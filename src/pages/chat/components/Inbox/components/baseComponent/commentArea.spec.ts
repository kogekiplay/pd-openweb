/**
 * `src/pages/chat/components/Inbox/components/baseComponent/commentArea.tsx` 的行为规格
 * （持续目标·评论组件切片）。
 *
 * 【为什么这样测】`getComponentProps` 是模块级真实映射逻辑：按评论来源类型（任务/项目/工作表/
 * 工作表记录/日程/动态）拼出评论输入组件需要的 `sourceId/appId/replyId/remark` 等参数。
 * 哪一类来源用哪个 appId、动态来源要带上 `createAccount.accountId`、工作表记录/日程的 remark
 * 如何拼 `sourceId_childId`（日程还要格式化时间戳）——这些直接决定"评论发到哪、@ 到谁"。
 * 本 spec 从**真实源码**抽出该函数执行（不复制、不改产品源码），`_l/htmlDecodeReg/
 * splitSourceId/moment/$/SOURCE_TYPE` 全部参数注入。
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

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/commentArea.tsx';

interface Params {
  sourceId: string;
  sourceType?: number;
  discussionId?: string;
  extendsId?: string;
  name?: string;
  projectId?: string;
  appId?: string;
  createAccount?: { accountId?: string };
}

interface MappedProps {
  placeholder?: string;
  textareaMinHeight?: number;
  autoFocus?: boolean;
  shrinkAfterSubmit?: boolean;
  sourceId?: string;
  sourceType?: number;
  appId?: string;
  replyId?: string;
  remark?: string;
  selectGroupOptions?: { projectId?: string };
  mentionsOptions?: { isAtAll: boolean };
  accountId?: string;
  sendPost?: boolean;
  [key: string]: unknown;
}

function extractGetComponentProps(): (ctx: { params: Params }) => MappedProps {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration' && node.declarations) {
      for (const declaration of node.declarations) {
        if (declaration.id && declaration.id.name === 'getComponentProps' && declaration.init) {
          if (typeof declaration.init.start === 'number' && typeof declaration.init.end === 'number') {
            found = { start: declaration.init.start, end: declaration.init.end };
          }
        }
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
  const location = found as { start: number; end: number } | null;
  if (!location) throw new Error(`真实源码里没有找到 getComponentProps：${TARGET}`);

  const wrapped = `var getComponentProps = ${source.slice(location.start, location.end)};`;
  const transformed = harness.transformSync(wrapped, { filename: 'commentArea-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    '_l',
    'htmlDecodeReg',
    'splitSourceId',
    'moment',
    '$',
    'SOURCE_TYPE',
    `${code}\nreturn getComponentProps;`,
  ) as (
    translate: (key: string) => string,
    decode: (name: string) => string,
    split: (sourceId: string) => { sourceId?: string; childId?: string },
    momentStub: (value: string) => { format: (fmt: string) => string },
    jquery: { extend: (deep: boolean, target: unknown, source: unknown) => unknown },
    sourceTypes: Record<string, number | undefined>,
  ) => (ctx: { params: Params }) => MappedProps;

  // 与 `src/components/comment/config` 的真实 SOURCE_TYPE 数值一致
  const SOURCE_TYPE = {
    POST: undefined,
    TASK: 1,
    FOLDER: 2,
    CALENDAR: 3,
    KNOWLEDGE: 4,
    APPROVAL: 5,
    ATTENDANCE: 6,
    WORKSHEET: 7,
    WORKSHEETROW: 8,
    CHAT: 9,
  };
  return create(
    (key: string) => `[${key}]`,
    (name: string) => `DECODED(${name})`,
    (sourceId: string) => {
      const [head, child] = sourceId.split('|');
      return { sourceId: head, childId: child };
    },
    (value: string) => ({ format: () => `FMT(${value})` }),
    { extend: (_deep, target, source) => Object.assign(target as object, (source ?? {}) as object) },
    SOURCE_TYPE,
  );
}

const getComponentProps = (() => {
  const source = harness.readSource(TARGET);
  void source;
  return extractGetComponentProps();
})();

function params(overrides: Partial<Params> & { sourceId: string }): Params {
  return { name: '实体名', projectId: 'proj1', discussionId: 'disc1', ...overrides };
}

function build(overrides: Partial<Params> & { sourceId: string }): MappedProps {
  return getComponentProps({ params: params(overrides) });
}

const checks: { name: string; run: () => void }[] = [];
function main(): void {
  const checksList: { name: string; run: () => void }[] = [
    {
      name: '公共参数：占位文案、最小高度、自动聚焦、提交后收缩',
      run: () => {
        const mapped = build({ sourceId: 't1', sourceType: 1, name: '任务名' });
        assert.equal(mapped.placeholder, '[请输入回复内容]');
        assert.equal(mapped.textareaMinHeight, 22);
        assert.equal(mapped.autoFocus, true);
        assert.equal(mapped.shrinkAfterSubmit, true);
      },
    },
    {
      name: '任务来源：任务 appId、去掉子 id 的 sourceId、remark 拼类型名',
      run: () => {
        const mapped = build({ sourceId: 'task1|child1', sourceType: 1, name: '任务名' });
        assert.equal(mapped.appId, 'ab99d0bb-3249-46f9-8a60-6952cb76cac2');
        assert.equal(mapped.sourceId, 'task1');
        assert.equal(mapped.sourceType, 1);
        assert.equal(mapped.replyId, 'disc1');
        assert.equal(mapped.remark, 'task1|DECODED(任务名)|[任务]');
        assert.deepEqual(mapped.selectGroupOptions, { projectId: 'proj1' });
      },
    },
    {
      name: '项目来源：项目 appId 与项目 remark',
      run: () => {
        const mapped = build({ sourceId: 'folder1', sourceType: 2, name: '项目名' });
        assert.equal(mapped.appId, '66d51996-6a56-41ba-be15-0d388b548f00');
        assert.equal(mapped.sourceId, 'folder1');
        assert.equal(mapped.remark, 'folder1|DECODED(项目名)|[项目]');
      },
    },
    {
      name: '工作表来源：工作表 appId、extendsId 透传、@ 选项',
      run: () => {
        const mapped = build({ sourceId: 'ws1', sourceType: 7, name: '工作表名', extendsId: 'app|view' });
        assert.equal(mapped.appId, '1e31c859-1605-4d8d-b3be-437ff871f02d');
        assert.equal(mapped.sourceId, 'ws1');
        assert.equal(mapped.extendsId, 'app|view');
        assert.deepEqual(mapped.mentionsOptions, { isAtAll: false });
        assert.equal(mapped.remark, 'ws1|DECODED(工作表名)|[工作表]');
      },
    },
    {
      name: '工作表记录：记录 appId、sourceId 保留原值、remark 拼 sourceId_childId',
      run: () => {
        const mapped = build({ sourceId: 'row1|rowchild', sourceType: 8, name: '记录名', extendsId: 'app|view' });
        assert.equal(mapped.appId, 'c8bc1b25-2bbe-4334-b1e3-be1b207f3126');
        assert.equal(mapped.sourceId, 'row1|rowchild');
        assert.equal(mapped.remark, 'row1_rowchild|DECODED(记录名)|[工作表记录]');
      },
    },
    {
      name: '工作表记录无子 id：remark 只用 sourceId',
      run: () => {
        const mapped = build({ sourceId: 'row1', sourceType: 8, name: '记录名' });
        assert.equal(mapped.remark, 'row1|DECODED(记录名)|[工作表记录]');
      },
    },
    {
      name: '日程来源：日程 appId、remark 里的子 id 被格式化为时间戳',
      run: () => {
        const mapped = build({ sourceId: 'cal1|1700000000000', sourceType: 3, name: '日程名' });
        assert.equal(mapped.appId, '42c96ef1-3ab6-4269-9824-e21436f34a38');
        assert.equal(mapped.sourceId, 'cal1|1700000000000');
        assert.equal(mapped.remark, 'cal1_FMT(1700000000000)|DECODED(日程名)|[日程]');
      },
    },
    {
      name: '动态来源（SOURCE_TYPE.POST 为 undefined）：无 appId、不带 group 选项、带创建人',
      run: () => {
        const mapped = build({
          sourceId: 'post1',
          sourceType: undefined,
          name: '动态名',
          createAccount: { accountId: 'acc1' },
        });
        assert.equal(mapped.appId, undefined);
        assert.equal(mapped.sourceId, 'post1');
        assert.equal(mapped.replyId, 'disc1');
        assert.equal(mapped.accountId, 'acc1');
        assert.equal(mapped.sendPost, false);
        assert.equal(mapped.selectGroupOptions, undefined);
      },
    },
  ];

  let passed = 0;
  for (const item of checksList) {
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
  console.log(`chat/CommentArea 行为规格通过：${passed} 项`);
}

main();
