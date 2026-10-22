/**
 * `src/pages/chat/components/Inbox/components/baseComponent/replyTo.tsx` 的行为规格
 * （持续目标·「回复」气泡预览切片）。
 *
 * 【为什么这样测】这个小组件在鼠标移入时才去拉被回复内容，真实逻辑有三条：
 * - `fetchReplyMsg`：已拿到内容（`replayMsg` 为真）或正在 loading 时**直接返回 false**，不重复请求；
 * - 动态来源（`sourceType === SOURCE_TYPE.POST`）走 `PostController.getReplyMessage({commentID, postID})`，
 *   回执有 `Message` 用它，否则回落「内容已删除」；
 * - 其它来源走 `DiscussionController.getDiscussionMsg({discussionId, sourceType})`：`code` 为真取
 *   `data`，否则同样回落「内容已删除」。
 * 本 spec 从**真实源码**抽出 `fetchReplyMsg` 执行（不复制、不改产品源码），两个 controller 用记录桩。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽方法。
 */
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  key?: { name?: string } | null;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/replyTo.tsx';
const FLUSH = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

interface Props {
  sourceType?: number;
  sourceId?: string;
  replyId?: string;
}

interface State {
  binded: boolean;
  replayMsg?: string | null;
  loading: boolean;
}

interface Instance {
  props: Props;
  state: State;
  setState: (patch: Partial<State>) => void;
  fetchReplyMsg: () => boolean | undefined;
  abortRequest: () => void;
}

function extract(): (
  postController: { getReplyMessage: (param: Record<string, unknown>) => Promise<Record<string, unknown>> },
  discussionController: { getDiscussionMsg: (param: Record<string, unknown>) => Promise<Record<string, unknown>> },
  sourceType: { POST?: number; CHAT: number },
  translate: (key: string) => string,
  requireStub: (name: string) => unknown,
) => (props: Props, state: State, setState: Instance['setState']) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  const wanted = ['fetchReplyMsg', 'abortRequest'];
  const found: Record<string, { start: number; end: number }> = {};
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      typeof node.key.name === 'string' &&
      wanted.includes(node.key.name) &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found[node.key.name] = { start: node.start, end: node.end };
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
  const missing = wanted.filter(name => !found[name]);
  if (missing.length) throw new Error(`真实源码里没有找到方法：${missing.join(', ')}`);
  const methods = wanted
    .map(name => source.slice(found[name]!.start, found[name]!.end).replace(/^\s*override\s+/, ''))
    .join('\n');
  const wrapped = `var __cls = class {\n  constructor(props, state, setState) {\n    this.props = props;\n    this.state = state;\n    this.setState = setState;\n  }\n${methods}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'replyTo-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  return new Function(
    'PostController',
    'DiscussionController',
    'SOURCE_TYPE',
    '_l',
    'require',
    `${code}\nreturn (props, state, setState) => new __cls(props, state, setState);`,
  ) as unknown as (
    postController: { getReplyMessage: (param: Record<string, unknown>) => Promise<Record<string, unknown>> },
    discussionController: { getDiscussionMsg: (param: Record<string, unknown>) => Promise<Record<string, unknown>> },
    sourceType: { POST?: number; CHAT: number },
    translate: (key: string) => string,
    requireStub: (name: string) => unknown,
  ) => (props: Props, state: State, setState: Instance['setState']) => Instance;
}

const factory = extract();

const aborted: string[] = [];

function makeRejectable(
  payload: Record<string, unknown>,
  label: string,
): Promise<Record<string, unknown>> & {
  abort: () => void;
} {
  const promise = Promise.resolve(payload) as Promise<Record<string, unknown>> & { abort: () => void };
  promise.abort = () => aborted.push(label);
  return promise;
}

function make(
  kind: 'post' | 'discussion',
  props: Props,
  opts: { payload?: Record<string, unknown>; state?: Partial<State> } = {},
): {
  instance: Instance;
  postCalls: Record<string, unknown>[];
  discussionCalls: Record<string, unknown>[];
  patches: Partial<State>[];
} {
  const postCalls: Record<string, unknown>[] = [];
  const discussionCalls: Record<string, unknown>[] = [];
  const patches: Partial<State>[] = [];
  const create = factory(
    {
      getReplyMessage: param => {
        postCalls.push(param);
        return makeRejectable(opts.payload ?? { Message: '被回复的动态' }, 'post');
      },
    },
    {
      getDiscussionMsg: param => {
        discussionCalls.push(param);
        return makeRejectable(opts.payload ?? { code: 1, data: '被回复的内容' }, 'discussion');
      },
    },
    { CHAT: 9 } as { POST?: number; CHAT: number },
    key => key,
    (name: string) => {
      throw new Error(`抽取片段里出现了未预期的依赖：${name}`);
    },
  );
  let instance: Instance;
  const state: State = { binded: false, replayMsg: null, loading: false, ...(opts.state ?? {}) };
  instance = create(props, state, patch => {
    patches.push(patch);
    Object.assign(instance.state, patch);
  });
  return { postCalls, discussionCalls, patches, instance };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('动态来源：请求 commentID/postID，回执有 Message 就用它', async () => {
  const h = make(
    'post',
    { sourceType: undefined, sourceId: 'p1', replyId: 'c1' },
    { payload: { Message: '动态内容' } },
  );
  const returned = h.instance.fetchReplyMsg();
  assert.equal(returned, undefined);
  assert.deepEqual(h.discussionCalls, [], '不走讨论接口');
  assert.deepEqual(h.postCalls, [{ commentID: 'c1', postID: 'p1' }]);
  assert.deepEqual(h.patches[0], { loading: true });
  await FLUSH();
  assert.equal(h.instance.state.replayMsg, '动态内容');
  assert.equal(h.instance.state.loading, false);
});

check('动态来源：回执没有 Message → 回落「内容已删除」', async () => {
  const h = make('post', { sourceType: undefined, sourceId: 'p2', replyId: 'c2' }, { payload: {} });
  h.instance.fetchReplyMsg();
  await FLUSH();
  assert.equal(h.instance.state.replayMsg, '内容已删除');
});

check('其它来源：请求 discussionId/sourceType，code 为真取 data', async () => {
  const h = make(
    'discussion',
    { sourceType: 9, sourceId: 's1', replyId: 'd1' },
    { payload: { code: 1, data: '讨论内容' } },
  );
  h.instance.fetchReplyMsg();
  await FLUSH();
  assert.deepEqual(h.discussionCalls, [{ discussionId: 'd1', sourceType: 9 }]);
  assert.deepEqual(h.postCalls, []);
  assert.equal(h.instance.state.replayMsg, '讨论内容');
});

check('其它来源：code 为假 → 同样回落「内容已删除」', async () => {
  const h = make('discussion', { sourceType: 9, sourceId: 's2', replyId: 'd2' }, { payload: { code: 0 } });
  h.instance.fetchReplyMsg();
  await FLUSH();
  assert.equal(h.instance.state.replayMsg, '内容已删除');
});

check('已有内容或正在 loading：直接返回 false，不发请求', () => {
  const loaded = make('post', { sourceId: 'p3', replyId: 'c3' }, { state: { replayMsg: '已有' } });
  assert.equal(loaded.instance.fetchReplyMsg(), false);
  assert.deepEqual(loaded.postCalls, []);

  const busy = make('post', { sourceId: 'p4', replyId: 'c4' }, { state: { loading: true } });
  assert.equal(busy.instance.fetchReplyMsg(), false);
  assert.deepEqual(busy.postCalls, []);
});

check('abortRequest：有 ajax 且带 abort 时调用它', () => {
  const h = make('post', { sourceId: 'p5', replyId: 'c5' });
  const aborts: number[] = [];
  (h.instance as unknown as { ajax: { abort: () => void } }).ajax = { abort: () => aborts.push(1) };
  h.instance.abortRequest();
  assert.deepEqual(aborts, [1]);

  const none = make('post', { sourceId: 'p6', replyId: 'c6' });
  none.instance.abortRequest();
  assert.deepEqual(aborted, [], '无 ajax 时不调用');
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
  console.log(`chat/ReplyTo 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
