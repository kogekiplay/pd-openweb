/**
 * `src/pages/chat/components/Feeds/Panel.tsx` 的行为规格（持续目标·群动态面板切片）。
 *
 * 【为什么这样测】动态面板两条真实逻辑：
 * - `splitFeeds`：把动态按「今天 / 最近七天 / 本月 / M月 / YYYY年M月」**首次出现**打上分组时间标签；
 * - `getFeed`：`loading`/`!pageIndex` 防重入；请求带 `gID/pIndex/最后一页 autoID`，按「本页满 10 条
 *   → 下一页，否则 pageIndex=0 结束」推进，并把 `formatFeeds` 结果拼到已有列表后重新分组。
 * 本 spec 从**真实源码**抽出这些函数执行（不复制、不改产品源码），ajax/formatFeeds 用记录桩，
 * moment 走真实实现（相对当前时间构造）。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽片段。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const moment: typeof import('moment') = require('moment');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  declarations?: BabelNode[];
  id?: { name?: string } | null;
  init?: BabelNode | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Feeds/Panel.tsx';

interface FeedItem {
  autoID?: string;
  createTime?: number | string;
  splitTime?: string;
}

interface Instance {
  props: { session: { id?: string }; onSetPanelVisible: (visible: boolean) => void };
  state: { pageIndex: number; loading: boolean; feeds: FeedItem[] };
  setState: (patch: Partial<Instance['state']>) => void;
  getFeed: () => void;
  handleScrollEnd: () => void;
}

function extract(): (
  lodashTranslate: (key: string) => string,
  momentModule: typeof import('moment'),
  ajaxStub: { getFeed: (param: Record<string, unknown>) => Promise<{ postList?: FeedItem[] }> },
  formatFeeds: (list: FeedItem[]) => FeedItem[],
  requireStub: (name: string) => unknown,
) => (props: Instance['props'], state: Instance['state'], setState: Instance['setState']) => {
  splitFeeds: (list: FeedItem[]) => FeedItem[];
  instance: Instance;
} {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let splitFound: { start: number; end: number } | null = null;
  const wantedMethods = ['getFeed', 'handleScrollEnd'];
  const methods: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'splitFeeds') {
      const init = node.init;
      if (init && typeof init.start === 'number' && typeof init.end === 'number') {
        splitFound = { start: init.start, end: init.end };
      }
    }
    const keyName = node.key && typeof node.key.name === 'string' ? node.key.name : undefined;
    if (keyName && node.type === 'ClassMethod' && wantedMethods.includes(keyName)) {
      if (typeof node.start === 'number' && typeof node.end === 'number') {
        methods[keyName] = { start: node.start, end: node.end };
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
  const splitLocation = splitFound as { start: number; end: number } | null;
  if (!splitLocation) throw new Error('真实源码里没有找到 splitFeeds');
  const missing = wantedMethods.filter((name) => !methods[name]);
  if (missing.length) throw new Error(`真实源码里没有找到方法：${missing.join(', ')}`);
  const methodSources = wantedMethods
    .map((name) => source.slice(methods[name]!.start, methods[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const wrapped = `var splitFeeds = ${source.slice(splitLocation.start, splitLocation.end)};\nvar __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n${methodSources}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'feedsPanel-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    '_l',
    'moment',
    'ajax',
    'formatFeeds',
    'require',
    `${code}\nreturn (props, state, setState) => ({ splitFeeds, instance: new __cls(props, state, setState) });`,
  ) as (
    translate: (key: string) => string,
    momentModule: typeof import('moment'),
    ajaxStub: { getFeed: (param: Record<string, unknown>) => Promise<{ postList?: FeedItem[] }> },
    formatFeeds: (list: FeedItem[]) => FeedItem[],
    requireStub: (name: string) => unknown,
  ) => (props: Instance['props'], state: Instance['state'], setState: Instance['setState']) => {
    splitFeeds: (list: FeedItem[]) => FeedItem[];
    instance: Instance;
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function make(options: { postList?: FeedItem[] } = {}): {
  instance: Instance;
  splitFeeds: (list: FeedItem[]) => FeedItem[];
  ajaxCalls: Record<string, unknown>[];
  patches: Partial<Instance['state']>[];
} {
  const ajaxCalls: Record<string, unknown>[] = [];
  const patches: Partial<Instance['state']>[] = [];
  const create = extract();
  const factory = create(
    (key) => key,
    moment,
    {
      getFeed: (param) => {
        ajaxCalls.push(param);
        return Promise.resolve({ postList: options.postList });
      },
    },
    (list) => list,
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  const props: Instance['props'] = { session: { id: 'g1' }, onSetPanelVisible: () => {} };
  const state: Instance['state'] = { pageIndex: 1, loading: false, feeds: [] };
  let instance: Instance;
  const setState = (patch: Partial<Instance['state']>): void => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  };
  const created = factory(props, state, setState);
  instance = created.instance;
  return { instance, splitFeeds: created.splitFeeds, ajaxCalls, patches };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('splitFeeds：今天 / 最近七天 / 本月 各取首次出现打标签，同组后续不再打', () => {
  const { splitFeeds } = make();
  const list: FeedItem[] = [
    { autoID: '1', createTime: moment().format('YYYY-MM-DD HH:mm:ss') },
    { autoID: '2', createTime: moment().format('YYYY-MM-DD HH:mm:ss') },
    { autoID: '3', createTime: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss') },
    { autoID: '4', createTime: moment().subtract(4, 'days').format('YYYY-MM-DD HH:mm:ss') },
  ];
  splitFeeds(list);
  assert.equal(list[0]!.splitTime, '今天');
  assert.equal(list[1]!.splitTime, undefined, '同组第二条不再打标签');
  assert.equal(list[2]!.splitTime, '最近七天');
  assert.equal(list[3]!.splitTime, undefined);
});

check('splitFeeds：更早（跨月/跨年）按 M月 / YYYY年M月 分组', () => {
  const { splitFeeds } = make();
  const oldMonth = moment().startOf('year').add(1, 'month');
  const lastYear = moment().subtract(1, 'year').startOf('year');
  const list: FeedItem[] = [
    { autoID: '1', createTime: oldMonth.format('YYYY-MM-DD HH:mm:ss') },
    { autoID: '2', createTime: oldMonth.format('YYYY-MM-DD HH:mm:ss') },
    { autoID: '3', createTime: lastYear.format('YYYY-MM-DD HH:mm:ss') },
  ];
  splitFeeds(list);
  assert.equal(list[0]!.splitTime, `${oldMonth.month() + 1}月`);
  assert.equal(list[1]!.splitTime, undefined);
  assert.equal(list[2]!.splitTime, `${lastYear.year()}年${lastYear.month() + 1}月`);
});

check('getFeed：本页满 10 条 → pageIndex+1 并追加；请求带最后一页 autoID', async () => {
  const postList = Array.from({ length: 10 }, (_item, index) => ({ autoID: `a${index}` }));
  const h = make({ postList });
  h.instance.state.feeds = [{ autoID: 'old' }];
  h.instance.getFeed();
  await flush();
  assert.deepEqual(h.ajaxCalls, [{ gID: 'g1', pIndex: 1, lastPostAutoID: 'old' }]);
  assert.equal(h.instance.state.pageIndex, 2);
  assert.equal(h.instance.state.loading, false);
  assert.equal(h.instance.state.feeds.length, 11);
});

check('getFeed：不足 10 条或 postList 缺省 → pageIndex=0 结束分页', async () => {
  const few = make({ postList: [{ autoID: 'a1' }] });
  few.instance.getFeed();
  await flush();
  assert.equal(few.instance.state.pageIndex, 0);

  const none = make({});
  none.instance.getFeed();
  await flush();
  assert.equal(none.instance.state.pageIndex, 0);
});

check('getFeed：loading 或 pageIndex=0 时防重入（不发请求）', async () => {
  const busy = make();
  busy.instance.state.loading = true;
  busy.instance.getFeed();
  await flush();
  assert.deepEqual(busy.ajaxCalls, []);

  const ended = make();
  ended.instance.state.pageIndex = 0;
  ended.instance.getFeed();
  await flush();
  assert.deepEqual(ended.ajaxCalls, []);
});

check('handleScrollEnd：滚到底直接触发一次分页请求', async () => {
  const h = make({ postList: [{ autoID: 'a1' }] });
  h.instance.handleScrollEnd();
  await flush();
  assert.equal(h.ajaxCalls.length, 1);
  assert.equal(h.ajaxCalls[0]!.pIndex, 1);
});

async function main(): Promise<void> {
  let passed = 0;
  for (const item of checks) {
    try {
      await item.run();
      passed += 1;
      console.log(`  ✓ ${item.name}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}`);
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`chat/FeedsPanel 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
