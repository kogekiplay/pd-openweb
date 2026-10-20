/**
 * `src/pages/chat/components/SendToolbar/index.tsx` 的行为规格（持续目标·发送工具栏切片）。
 *
 * 【为什么这样测】`SendToolbar` 是 React class 组件，本仓没有 render 测试设施；但模块顶层的
 * `recurShowFileConfirm` 是"逐个文件确认后再放行上传"的**真实递归逻辑**：终止时 `up.start()` 一次、
 * 确认时同步回调 `cb({type, file})` 并在 300ms 后递归下一个、拒绝时移除文件并在 100ms 后递归。
 * 本 spec 从**真实源码**抽出该函数后执行（不复制、不改产品源码），依赖由参数注入。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块，由 harness 读源码 + babel 抽函数。
 */

import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface BabelNode {
  type: string;
  id?: { name?: string } | null;
  declarations?: BabelNode[];
  start?: number | null;
  end?: number | null;
  init?: BabelNode | null;
}

const TARGET = 'src/pages/chat/components/SendToolbar/index.tsx';

interface FakeFile {
  id: string;
  name: string;
}

interface ScheduledTimer {
  fn: () => void;
  delay: number;
  cleared: boolean;
}

interface ConfirmOptions {
  yesFn: () => void;
  noFn: () => void;
}

interface HarnessResult {
  /** 调用真实 `recurShowFileConfirm` */
  run: (up: FakeUp, files: FakeFile[], i: number, length: number, cb?: (message: { type: number; file: FakeFile }) => void) => unknown;
  /** 本次 run 里 fileConfirm 收到的所有 (file, options) */
  confirmations: { file: FakeFile; options: ConfirmOptions }[];
  /** 被 setTimeout 排入的定时器（按调用顺序） */
  timers: ScheduledTimer[];
  /** up.start() 调用次数 */
  started: number;
  /** up.removeFile 收到的对象 */
  removed: FakeFile[];
}

interface FakeUp {
  start(): void;
  removeFile(file: FakeFile): void;
}

function extractRunner(): (inject: {
  fileConfirm: (file: FakeFile, options: ConfirmOptions) => void;
  setTimeout: (fn: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  Constant: { MSGTYPE_FILE: number };
}) => HarnessResult {
  const source = harness.readSource(TARGET);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }) as unknown as {
    program: { body: BabelNode[] };
  };

  let found: { start: number; end: number } | null = null;
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration' || !statement.declarations) continue;
    for (const declaration of statement.declarations) {
      if (!declaration.id || declaration.id.name !== 'recurShowFileConfirm') continue;
      const init = declaration.init;
      if (!init || typeof init.start !== 'number' || typeof init.end !== 'number') continue;
      found = { start: init.start, end: init.end };
    }
  }
  if (!found) throw new Error(`真实源码里没有找到 recurShowFileConfirm：${TARGET}`);

  const initSource = source.slice(found.start, found.end);
  // 用原函数名绑定：函数体内部递归调用的是 `recurShowFileConfirm` 这个名字，
  // 必须让它在同一个 Function 作用域里可见（不能只赋给一个别名）。
  const wrapped = `var recurShowFileConfirm = ${initSource};\n`;
  const transformed = harness.transformSync(wrapped, { filename: 'sendToolbar-snippet.tsx' });
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换抽出的函数片段');
  const code = transformed.code.replace(/^['"]use strict['"];\s*/, '');
  // 自由变量（fileConfirm / setTimeout / clearTimeout / Constant）全部走参数注入
  const create = new Function(
    'fileConfirm',
    'setTimeout',
    'clearTimeout',
    'Constant',
    `${code}\nreturn recurShowFileConfirm;`,
  ) as (
    fileConfirm: (file: FakeFile, options: ConfirmOptions) => void,
    setTimeout: (fn: () => void, delay: number) => unknown,
    clearTimeout: (handle: unknown) => void,
    Constant: { MSGTYPE_FILE: number },
  ) => (
    up: FakeUp,
    files: FakeFile[],
    i: number,
    length: number,
    cb?: (message: { type: number; file: FakeFile }) => void,
  ) => unknown;

  return (inject) => {
    const confirmations: { file: FakeFile; options: ConfirmOptions }[] = [];
    const timers: ScheduledTimer[] = [];
    const removed: FakeFile[] = [];
    const state = { started: 0 };

    const fileConfirm = (file: FakeFile, options: ConfirmOptions): void => {
      confirmations.push({ file, options });
      inject.fileConfirm(file, options);
    };
    const setTimeoutStub = (fn: () => void, delay: number): unknown => {
      const timer: ScheduledTimer = { fn, delay, cleared: false };
      timers.push(timer);
      return timer;
    };
    const clearTimeoutStub = (handle: unknown): void => {
      const timer = handle as ScheduledTimer | undefined;
      if (timer) timer.cleared = true;
    };
    const recur = create(fileConfirm, setTimeoutStub, clearTimeoutStub, inject.Constant);
    const up: FakeUp = {
      start() {
        state.started += 1;
      },
      removeFile(file: FakeFile) {
        removed.push(file);
      },
    };

    return {
      run: (target, files, i, length, cb) => recur(target, files, i, length, cb),
      confirmations,
      timers,
      get started() {
        return state.started;
      },
      removed,
    } as HarnessResult & { started: number };
  };
}

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

function filesOf(count: number): FakeFile[] {
  return Array.from({ length: count }, (_v, index) => ({ id: `f${index}`, name: `file-${index}.png` }));
}

check('终止分支：i >= length 时只调用一次 up.start() 并返回 false', () => {
  const result = extractRunner()({ fileConfirm: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined, Constant: { MSGTYPE_FILE: 5 } });
  const files = filesOf(2);
  const ret = result.run({ start: () => undefined, removeFile: () => undefined }, files, 2, 2, () => undefined);
  assert.equal(ret, false, '终止返回 false');
  assert.equal(result.confirmations.length, 0, '不发起确认');
});

check('确认流：yesFn 同步回调 cb({type, file})，并排入 300ms 后递归', () => {
  const result = extractRunner()({ fileConfirm: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined, Constant: { MSGTYPE_FILE: 5 } });
  const files = filesOf(2);
  const received: { type: number; file: FakeFile }[] = [];
  const fakeUp = { start: () => undefined, removeFile: () => undefined };
  const ret = result.run(fakeUp, files, 0, files.length, (message) => received.push(message));
  assert.equal(ret, undefined, 'i < length 时返回 undefined');
  assert.equal(result.confirmations.length, 1, '当前只确认第 0 个文件');
  assert.equal(result.confirmations[0]!.file, files[0], '确认的是同一个文件对象');
  assert.equal(result.timers.length, 0, 'yesFn 之前不排定时器');

  result.confirmations[0]!.options.yesFn();
  assert.deepEqual(received, [{ type: 5, file: files[0] }], 'cb 收到注入的 MSGTYPE_FILE 与同一文件对象');
  assert.equal(result.timers.length, 1, '确认后排入一个定时器');
  assert.equal(result.timers[0]!.delay, 300, '递归延迟 300ms');
});

check('确认流：定时器触发后递归到下一个文件，直到 i >= length 时 start() 一次', () => {
  const result = extractRunner()({ fileConfirm: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined, Constant: { MSGTYPE_FILE: 5 } });
  const files = filesOf(2);
  const received: { type: number; file: FakeFile }[] = [];
  const started: number[] = [];
  const fakeUp = {
    start: () => started.push(1),
    removeFile: () => undefined,
  };
  const recur = (i: number, cb: (message: { type: number; file: FakeFile }) => void): void => {
    result.run(fakeUp, files, i, files.length, cb);
  };
  recur(0, (message) => received.push(message));
  result.confirmations[0]!.options.yesFn();
  // 触发 300ms 定时器 → 递归 i=1
  result.timers[0]!.fn();
  assert.equal(result.confirmations.length, 2, '递归后确认第 1 个文件');
  assert.equal(result.timers[0]!.cleared, true, '递归后清理自己的定时器');
  result.confirmations[1]!.options.yesFn();
  result.timers[1]!.fn(); // i=2 → 终止分支
  assert.deepEqual(
    received.map((item) => item.file),
    files,
    '回调顺序与文件顺序一致',
  );
  assert.equal(started.length, 1, '全部确认完才 start() 且只调用一次');
});

check('拒绝流：noFn 移除同一文件对象，并排入 100ms 后递归（不回调 cb）', () => {
  const result = extractRunner()({ fileConfirm: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined, Constant: { MSGTYPE_FILE: 5 } });
  const files = filesOf(2);
  const received: unknown[] = [];
  const removed: FakeFile[] = [];
  const fakeUp = { start: () => undefined, removeFile: (file: FakeFile) => removed.push(file) };
  result.run(fakeUp, files, 0, files.length, (message) => received.push(message));
  result.confirmations[0]!.options.noFn();
  assert.equal(removed.length, 1, '移除一次');
  assert.equal(removed[0], files[0], '移除的是同一个文件对象');
  assert.equal(received.length, 0, '拒绝不触发 cb');
  assert.equal(result.timers.length, 1, '拒绝也排入递归定时器');
  assert.equal(result.timers[0]!.delay, 100, '拒绝递归延迟 100ms');
});

check('单文件边界：length=1 时确认一次后递归即终止并 start()', () => {
  const result = extractRunner()({ fileConfirm: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined, Constant: { MSGTYPE_FILE: 5 } });
  const files = filesOf(1);
  const received: { type: number; file: FakeFile }[] = [];
  const started: number[] = [];
  const fakeUp = { start: () => started.push(1), removeFile: () => undefined };
  result.run(fakeUp, files, 0, 1, (message) => received.push(message));
  result.confirmations[0]!.options.yesFn();
  result.timers[0]!.fn();
  assert.equal(received.length, 1);
  assert.equal(started.length, 1);
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
  console.log(`chat/SendToolbar 行为规格通过：${passed} 项`);
}

main();
