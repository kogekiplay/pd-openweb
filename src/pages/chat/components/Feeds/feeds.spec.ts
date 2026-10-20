/**
 * `src/pages/chat/components/Feeds/index.tsx` 的行为规格（持续目标·群动态切片）。
 *
 * 【为什么这样测】`Feeds` 组件依赖两个模块级函数，它们是真实数据处理逻辑：
 * - `classify(files)`：把动态附件按 `attachmentType` 分成图片/文件两组，并给每个附件**原地**写
 *   `index`（预览定位下标）与文件的 `icon`（按扩展名取图标类名）；
 * - `formatFeeds(attachments)`：给带附件的动态挂上分类结果，把正文转成链接并**截断**（先 `slice(0,300)`，
 *   再按 ≥70 截成 70 + '...'）。
 * 本 spec 从**真实源码**抽出这两个函数执行（不复制、不改产品源码），依赖 `getClassNameByExt` /
 * `createLinksForMessage` 由参数注入。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Feeds/index.tsx';

interface Attachment {
  attachmentType?: number;
  ext?: string;
  icon?: string;
  index?: number;
  fileID?: string;
  [key: string]: unknown;
}

interface Classified {
  imagelist: Attachment[];
  filelist: Attachment[];
}

interface FeedItem {
  autoID?: string;
  postID?: string;
  message?: string;
  attachments?: Attachment[];
  content?: string;
  previewAttachments?: Classified;
  [key: string]: unknown;
}

interface Extracted {
  classify: (files: Attachment[]) => Classified;
  formatFeeds: (items: FeedItem[]) => FeedItem[];
}

function extract(): Extracted {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  const wanted = ['classify', 'formatFeeds'];
  const snippets: Record<string, string> = {};
  /** 从顶层声明（含 `export const`）里找目标 VariableDeclarator 的整条声明源码 */
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration' && node.declarations) {
      for (const declaration of node.declarations) {
        const name = declaration.id && declaration.id.name;
        if (!name || !wanted.includes(name)) continue;
        if (typeof node.start !== 'number' || typeof node.end !== 'number') continue;
        // 取 `const name = <init>` 的初始化表达式（`export const` 声明只取 declarator 部分）
        const init = (declaration as unknown as { init?: BabelNode }).init;
        if (!init || typeof init.start !== 'number' || typeof init.end !== 'number') continue;
        snippets[name] = `${source.slice(init.start, init.end)}`;
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

  for (const name of wanted) {
    if (!snippets[name]) throw new Error(`真实源码里没有找到 ${name}：${TARGET}`);
  }

  const wrapped = `var classify = ${snippets.classify};\nvar formatFeeds = ${snippets.formatFeeds};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'feeds-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    'getClassNameByExt',
    'createLinksForMessage',
    `${code}\nreturn { classify, formatFeeds };`,
  ) as (
    getClassNameByExt: (ext?: string) => string,
    createLinksForMessage: (args: Record<string, unknown>) => string,
  ) => Extracted;

  return create(
    (ext?: string) => `icon-${String(ext || 'unknown')}`,
    (args: Record<string, unknown>) => `LINKED(${String(args.message)})`,
  );
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

check('classify：图片进 imagelist、文件进 filelist，其它 attachmentType 丢弃', () => {
  const { classify } = extract();
  const image: Attachment = { attachmentType: 1, fileID: 'i1' };
  const file: Attachment = { attachmentType: 2, ext: 'pdf', fileID: 'f1' };
  const other: Attachment = { attachmentType: 9, fileID: 'x1' };
  const result = classify([image, file, other]);
  assert.deepEqual(result.imagelist, [image], '图片分组');
  assert.deepEqual(result.filelist, [file], '文件分组');
  assert.equal(result.imagelist[0], image, '分组里是同一对象（不是拷贝）');
});

check('classify：原地写入 index（原数组下标）与文件的 icon（按扩展名）', () => {
  const { classify } = extract();
  const first: Attachment = { attachmentType: 2, ext: 'docx' };
  const second: Attachment = { attachmentType: 1 };
  const third: Attachment = { attachmentType: 2, ext: 'png' };
  classify([first, second, third]);
  assert.equal(first.index, 0, '第一个文件 index=0');
  assert.equal(first.icon, 'icon-docx', '图标类名来自 getClassNameByExt(ext)');
  assert.equal(second.index, 1, '图片也写 index');
  assert.equal(third.index, 2, '第三个附件 index=2');
  assert.equal(third.icon, 'icon-png');
});

check('classify：空数组返回两个空数组', () => {
  const { classify } = extract();
  assert.deepEqual(classify([]), { imagelist: [], filelist: [] });
});

check('formatFeeds：带附件的动态挂上分类结果，没有附件的不挂', () => {
  const { formatFeeds } = extract();
  const att: Attachment = { attachmentType: 1, fileID: 'i1' };
  const withAtt: FeedItem = { autoID: 'a1', message: '正文', attachments: [att] };
  const withoutAtt: FeedItem = { autoID: 'a2', message: '正文2' };
  formatFeeds([withAtt, withoutAtt]);
  assert.deepEqual(withAtt.previewAttachments, { imagelist: [att], filelist: [] }, '有附件时分类');
  assert.equal(withoutAtt.previewAttachments, undefined, '无附件不设置');
});

check('formatFeeds：正文转链接后按 300 截断，再按 ≥70 截成 70 + ...', () => {
  const { formatFeeds } = extract();
  // createLinksForMessage 桩返回 80 字符：先 slice(0,300)，再因 >=70 截断到 70+'...'
  const item: FeedItem = { autoID: 'a1', message: 'x'.repeat(80) };
  const [result] = formatFeeds([item]);
  assert.equal(result!.content, `${'LINKED('.concat('x'.repeat(80)).concat(')')}`.slice(0, 70) + '...');
  assert.equal(result!.content!.length, 73, '70 + 省略号 3 字符');
});

check('formatFeeds：短正文（<70）原样保留（只经过 300 截断）', () => {
  const { formatFeeds } = extract();
  const item: FeedItem = { autoID: 'a1', message: '短' };
  const [result] = formatFeeds([item]);
  assert.equal(result!.content, 'LINKED(短)');
});

check('formatFeeds：返回同批对象（原地修改）且顺序/长度不变', () => {
  const { formatFeeds } = extract();
  const first: FeedItem = { autoID: 'a1', message: '一' };
  const second: FeedItem = { autoID: 'a2', message: '二' };
  const input = [first, second];
  const result = formatFeeds(input);
  assert.equal(result.length, 2);
  assert.equal(result[0], first, '第一个元素是同一对象');
  assert.equal(result[1], second);
  assert.equal(first.content, 'LINKED(一)', '入参对象被原地写入 content');
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
  console.log(`chat/Feeds 行为规格通过：${passed} 项`);
}

main();
