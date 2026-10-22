/**
 * `src/pages/chat/components/Inbox/components/baseComponent/star.tsx` 的行为规格
 * （持续目标·收件箱星标切片）。
 *
 * 【为什么这样测】`Star.clickHandler(flag)` 是真实**星标切换逻辑**：它返回一个闭包（渲染时按当前
 * 星标态选择 '0'/'1'），点击后才请求 `setInboxFavorite`，成功才更新本地状态并提示成功，失败提示失败。
 * 本 spec 从**真实源码**抽出该方法执行（不复制、不改产品源码），`inboxController/alert/_l` 注入。
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

const TARGET = 'src/pages/chat/components/Inbox/components/baseComponent/star.tsx';

interface StarProps {
  isFavorite?: string;
  inboxId?: string | number;
}

interface StarState {
  isFavorite?: string;
}

interface Instance {
  props: StarProps;
  state: StarState;
  setState: (patch: Partial<StarState>, cb?: () => void) => void;
  clickHandler: (flag: string) => () => void;
}

function extract(): (
  api: StarApi,
  alertStub: (text: unknown, level?: unknown) => void,
  translate: (key: string) => string,
) => (props: StarProps, setState: Instance['setState'], api: StarApi) => Instance {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };
  let found: { start: number; end: number } | null = null;
  const visit = (node: BabelNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ClassMethod' &&
      node.key &&
      node.key.name === 'clickHandler' &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      found = { start: node.start, end: node.end };
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
  if (!location) throw new Error(`真实源码里没有找到 clickHandler：${TARGET}`);

  const wrapped = `var __cls = class {\n  constructor(props, setState) {\n    this.props = props;\n    this.state = { isFavorite: props.isFavorite };\n    this.setState = setState;\n  }\n  ${source.slice(location.start, location.end)}\n};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'star-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的方法片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  const create = new Function(
    'inboxController',
    'alert',
    '_l',
    `${code}\nreturn (props, setState, api) => { const instance = new __cls(props, setState); instance.__api = api; return instance; };`,
  ) as unknown as (
    api: StarApi,
    alertStub: (text: unknown, level?: unknown) => void,
    translate: (key: string) => string,
  ) => (props: StarProps, setState: Instance['setState'], api: StarApi) => Instance;
  return create;
}

interface StarApi {
  setInboxFavorite: (payload: { inboxId?: string | number; inboxFavorite?: string }) => Promise<unknown>;
}

const makeFactory = extract();

function make(
  props: StarProps,
  api: StarApi,
  alerts: { text: unknown; level?: unknown }[] = [],
): { instance: Instance; patches: Partial<StarState>[]; alerts: { text: unknown; level?: unknown }[] } {
  const patches: Partial<StarState>[] = [];
  const factory = makeFactory(
    api,
    (text: unknown, level?: unknown) => alerts.push({ text, level }),
    (key: string) => `[${key}]`,
  );
  let instance: Instance;
  instance = factory(
    props,
    (patch: Partial<StarState>, cb?: () => void) => {
      patches.push(patch);
      Object.assign(instance.state, patch);
      if (cb) cb();
    },
    api,
  );
  return { instance, patches, alerts };
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];
function check(name: string, run: () => Promise<void> | void): void {
  checks.push({ name, run });
}

check('clickHandler：返回闭包，调用前不请求', () => {
  let calls = 0;
  const { instance } = make(
    { inboxId: 'i1', isFavorite: '0' },
    {
      setInboxFavorite: async () => {
        calls += 1;
        return true;
      },
    },
  );
  const handler = instance.clickHandler('1');
  assert.equal(typeof handler, 'function');
  assert.equal(calls, 0, '渲染阶段不发请求');
});

check('clickHandler：点击后按 flag 请求星标接口（inboxId 原样透传）', async () => {
  const payloads: unknown[] = [];
  const { instance } = make(
    { inboxId: 7 },
    {
      setInboxFavorite: async payload => {
        payloads.push(payload);
        return false;
      },
    },
  );
  instance.clickHandler('0')();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(payloads, [{ inboxId: 7, inboxFavorite: '0' }]);
});

check('clickHandler：接口成功 → 更新本地星标并提示操作成功', async () => {
  const alerts: { text: unknown; level?: unknown }[] = [];
  const { instance, patches } = make({ inboxId: 'i1' }, { setInboxFavorite: async () => true }, alerts);
  instance.clickHandler('1')();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(patches, [{ isFavorite: '1' }]);
  assert.equal(atof1(alerts), '[操作成功]');
  assert.equal((alerts[0] as { level?: unknown }).level, undefined, '成功提示无等级');
});

check('clickHandler：接口失败 → 不更新状态，提示操作失败(等级 2)', async () => {
  const alerts: { text: unknown; level?: unknown }[] = [];
  const { instance, patches } = make({ inboxId: 'i1' }, { setInboxFavorite: async () => false }, alerts);
  instance.clickHandler('1')();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(patches, [], '失败不改本地星标');
  assert.equal(atof1(alerts), '[操作失败]');
  assert.equal((alerts[0] as { level?: unknown }).level, 2);
});

function atof1(alerts: unknown[]): string {
  const first = alerts[0] as { text?: unknown } | undefined;
  return String(first && first.text);
}

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
  console.log(`chat/Star 行为规格通过：${passed} 项`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
