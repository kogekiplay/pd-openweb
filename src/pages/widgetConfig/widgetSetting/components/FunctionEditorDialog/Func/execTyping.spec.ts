const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../../../scripts/spec-harness.ts');
interface Control {
  type?: number;
  enumDefault2?: number;
  advancedSetting?: { defaultfunc?: string; nullzero?: string };
  options?: { key: string; value: string; isDeleted?: boolean }[];
  controlId?: string;
  value?: unknown;
}
interface RunResult {
  value?: unknown;
  error?: unknown;
  expression?: string;
}
type Execute = (
  control: Control,
  data: Control[],
  options?: { forceSyncRun?: boolean; type?: string; defaultExpression?: string; update?: (value: string) => void },
) => RunResult | undefined;
interface WorkerMessage {
  type: string;
  value?: unknown;
  err?: unknown;
}
const workers: MockWorker[] = [];
class MockWorker {
  onmessage?: (event: { data: WorkerMessage }) => void;
  constructor(_url: string) {
    workers.push(this);
  }
  postMessage(code: string): void {
    const result: unknown = new Function(code)();
    queueMicrotask(() => this.onmessage?.({ data: { type: 'over', value: result } }));
  }
  terminate(): void {}
}
globalThis.window = { isIphone: false };
globalThis.Worker = MockWorker;
function load(): Execute {
  const source = process.env.FUNCTION_EXEC_SOURCE || path.join(__dirname, 'exec.ts');
  const { code } = transformFileSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const moduleLike: { exports: { default?: Execute } } = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) => {
    if (name === 'lodash' || name === 'dayjs' || name === 'query-string') return require(name);
    if (name === 'src/pages/widgetConfig/config/widget')
      return {
        WIDGETS_TO_API_TYPE_ENUM: {
          TEXT: 2,
          SWITCH: 36,
          NUMBER: 6,
          MONEY: 8,
          DATE: 15,
          DATE_TIME: 16,
          FLAT_MENU: 9,
          MULTI_SELECT: 10,
          DROP_DOWN: 11,
          TIME: 46,
          LOCATION: 40,
        },
      };
    if (name === 'src/utils/function-library') return { formatControlValue: (control: Control) => control.value };
    if (name === './local') return { initLang: () => {} };
    if (name === './enum')
      return { functions: { SUM: (...values: number[]) => values.reduce((sum, value) => sum + value, 0) } };
    throw new Error(`Unexpected execution dependency ${name}`);
  });
  assert.equal(typeof moduleLike.exports.default, 'function');
  return moduleLike.exports.default as Execute;
}
const execute = load();
const control = (expression: string, type = 2, fnType = 'javascript'): Control => ({
  type,
  advancedSetting: { defaultfunc: JSON.stringify({ expression, type: fnType }) },
});
assert.equal(execute(control('return 2.50000000000', 6), [], { forceSyncRun: true })?.value, '2.5');
assert.equal(execute(control('return "true"', 36), [], { forceSyncRun: true })?.value, 1);
assert.equal(execute(control('return null', 2), [], { forceSyncRun: true })?.value, null);
assert.equal(execute(control('return undefined', 2), [], { type: 'lib' })?.value, '');
assert.equal(
  execute(control('SUM($field$,2)', 6, 'formula'), [{ controlId: 'field', value: 3 }], { forceSyncRun: true })?.value,
  '5',
);
assert.equal(execute(control('return $deleted$', 2), [], { forceSyncRun: true })?.value, '');
assert.equal(
  execute(control('UNDEFINEDFN(1)', 6, 'formula'), [], { forceSyncRun: true })?.error,
  'EXIST_UNDEFINED_FUNCTION',
);
assert.equal(execute({ type: 2, advancedSetting: {} }, [])?.error, 'EXPRESSION_IS_UNDEFINED');
assert.ok(execute(control('throw new Error("fail")'), [], { forceSyncRun: true })?.error);
assert.equal(execute(control('return "2026-10-01"', 15), [], { forceSyncRun: true })?.value, '2026-10-01');
assert.equal(
  execute(
    {
      ...control('return "First"', 9),
      options: [
        { key: 'a', value: 'First' },
        { key: 'b', value: 'Second', isDeleted: true },
      ],
    },
    [],
    { forceSyncRun: true },
  )?.value,
  '["a"]',
);
console.log('function executor synchronous protocols passed');
async function run(): Promise<void> {
  let updated: string | undefined;
  execute(control('return 8', 6), [], {
    update: value => {
      updated = value;
    },
  });
  await Promise.resolve();
  assert.equal(workers.length, 1);
  assert.equal(updated, '8');
  globalThis.window.isIphone = true;
  updated = undefined;
  const result = execute(control('return 9', 6), [], {
    update: value => {
      updated = value;
    },
  });
  assert.equal(result, undefined);
  assert.equal(updated, '9');
  console.log('function executor asynchronous protocols passed');
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
