const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const harness: import('../scripts/spec-harness').SpecHarness = require('../scripts/spec-harness.ts');
const source = fs.readFileSync(path.join(__dirname, 'utils.ts'), 'utf8');
const original = process.env['WEBPACK_LIFECYCLE_BEFORE_SOURCE'];
interface WebpackLifecycleOptions {
  production: boolean;
  compileError?: Error;
  closeError?: Error;
  statsError?: boolean;
  notifierError?: boolean;
}
function scenario(options: WebpackLifecycleOptions, codeSource = source) {
  let notifications = 0;
  let closes = 0;
  let completions = 0;
  let result: Error | undefined;
  const logs: string[] = [];
  const stats = {
    compilation: { warnings: [] },
    toString: () => 'compiled stats',
    toJson: () => ({
      errors: options.statsError ? [{ message: 'compile failure' }] : [],
      assets: [{ emitted: true, name: 'fixture.js' }],
    }),
    hasErrors: () => !!options.statsError,
  };
  const compiler = {
    run(callback: (error: Error | null, value: typeof stats) => void) {
      callback(options.compileError || null, stats);
    },
    close(callback: (error: Error | null) => void) {
      closes += 1;
      callback(options.closeError || null);
    },
  };
  const module: { exports: unknown } = { exports: {} };
  const transformed = harness.transformSync(codeSource, { filename: path.join(__dirname, 'utils.ts') });
  assert.ok(transformed?.code);
  new Function('module', 'exports', 'require', '__dirname', 'process', 'console', transformed.code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (name === 'webpack') return () => compiler;
      if (name === 'node-notifier') return { notify() {
        notifications += 1;
        if (options.notifierError) throw new Error('OS notifier unavailable');
      } };
      return require(name);
    },
    __dirname,
    { env: { NODE_ENV: options.production ? 'production' : 'development' }, argv: [] },
    {
      log: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
      error: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
    },
  );
  assert.ok(module.exports && typeof module.exports === 'object');
  const factory: unknown = Reflect.get(module.exports, 'webpackTaskFactory');
  if (typeof factory !== 'function') throw new TypeError('Missing webpack task factory');
  const task: unknown = Reflect.apply(factory, undefined, [{}]);
  if (typeof task !== 'function') throw new TypeError('Missing webpack task');
  Reflect.apply(task, undefined, [(error?: Error) => {
    completions += 1;
    result = error;
  }]);
  assert.equal(closes, 1, 'Compiler cache shutdown must still run');
  assert.equal(completions, 1, 'Build callback must complete exactly once');
  return { notifications, result, logs };
}

const production = scenario({ production: true, notifierError: true });
assert.equal(production.notifications, 0, 'Production never starts the optional OS notification process');
assert.equal(production.result, undefined);
assert.ok(production.logs.some(log => log.includes('compiled stats')));
const development = scenario({ production: false, notifierError: true });
assert.equal(development.notifications, 1);
assert.equal(development.result, undefined, 'Optional notifier failure does not fail a development build');
assert.ok(development.logs.some(log => log.includes('Notifier failed: OS notifier unavailable')));
const compileError = new Error('loader failed');
assert.equal(scenario({ production: true, compileError }).result, compileError);
const closeError = new Error('cache close failed');
assert.equal(scenario({ production: true, closeError }).result, closeError);
assert.match(scenario({ production: true, statsError: true }).result?.message || '', /Webpack compilation failed/);
if (original) {
  const old = scenario({ production: true, notifierError: true }, fs.readFileSync(original, 'utf8'));
  assert.equal(old.notifications, 1, 'Old production code invoked the blocking OS dependency');
}
console.log('webpack production notification isolation, error propagation and cache shutdown passed');
