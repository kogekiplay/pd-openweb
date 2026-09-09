#!/usr/bin/env node
/**
 * Behaviour-spec runner for the *.spec.js files under src/ and scripts/.
 *
 * Zero new dependencies by design: each spec is a plain Node script using the
 * built-in `assert`, run in its own child process. This runner only needs to
 * start processes, collect exit codes, and buffer output. That is ~100 lines --
 * adding jest/vitest would cost the suite its main property (no new deps) and
 * would fight the repo's .babelrc. See scripts/spec-harness.js.
 *
 * Usage:
 *   node scripts/run-specs.js                  # all specs, parallel
 *   node scripts/run-specs.js --filter router  # only paths containing "router"
 *   node scripts/run-specs.js --concurrency 1  # serial (readable interleaving)
 *   SKIP_TESTS=1 node scripts/run-specs.js     # opt out (mirrors SKIP_TYPECHECK)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
// chalk 5+ 是纯 ESM（package.json 里 "type": "module"、exports 没有 CJS 条件）。
// Node 22 起 require(esm) 已稳定，本仓 engines 要求 >=26.8.1，所以 require 本身没问题——
// 但拿到的是 ESM 命名空间对象，具名导出在 .default 上，直接 chalk.gray 是 undefined
//（表现为 `chalk.gray is not a function`，而不是 require 报错，所以别误判成「装错了」）。
const chalk = require('chalk').default;

const ROOT = path.resolve(__dirname, '..');
const SEARCH_DIRS = ['src', 'scripts'];

// 单个 spec 的墙钟上限。实测最慢的 spec < 3s，30s 是很宽的余量。
// 没有这道保险时，任何一个留下未关闭句柄（定时器、监听器）的 spec 会让
// pre-push 和 release 无限期挂起，且不给任何诊断信息 —— 比失败更难查。
// 已知有 spec 真的在跑定时器：SearchInput 用真实 setTimeout，CountDown 打桩 setInterval。
const DEFAULT_TIMEOUT_MS = 30000;

function parseArgs(argv) {
  const args = { filter: null, concurrency: os.availableParallelism(), timeout: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--filter') args.filter = argv[++i];
    else if (argv[i] === '--concurrency') args.concurrency = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (argv[i] === '--timeout') args.timeout = Math.max(1000, parseInt(argv[++i], 10) || DEFAULT_TIMEOUT_MS);
  }
  return args;
}

function discover(dir, out, suffix) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) continue;
    out.push(path.relative(ROOT, path.join(entry.parentPath || entry.path, entry.name)));
  }
  return out;
}

function runOne(spec, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    execFile(
      process.execPath,
      [path.join(ROOT, spec)],
      { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        // execFile 超时杀进程时 err.killed 为 true。把它和普通断言失败分开，
        // 否则「挂住」会伪装成「断言不过」，排查方向完全跑偏。
        const timedOut = !!(err && err.killed);
        resolve({ spec, ok: !err, timedOut, stdout, stderr, ms: Date.now() - started });
      },
    );
  });
}

async function pool(items, limit, worker) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) results.push(await worker(items[next++]));
    }),
  );
  return results;
}

async function main() {
  if (process.env.SKIP_TESTS === '1') {
    console.log(chalk.yellow('SKIP_TESTS=1 -- behaviour specs skipped.'));
    return;
  }

  // Naming guard. .gitignore once carried a bare `*.test.js` pattern (added by
  // the same 7.4.1 commit that deleted these tests), which silently swallowed
  // any test file so it never appeared in `git status`. *.spec.js is the only
  // supported name; fail loudly rather than let a file vanish again.
  const strays = discover('src', discover('scripts', [], '.test.js'), '.test.js');
  if (strays.length) {
    console.error(chalk.red(`Found ${strays.length} *.test.js file(s). Rename to *.spec.js:`));
    strays.forEach(f => console.error(`  ${f}`));
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  let specs = SEARCH_DIRS.reduce((acc, d) => discover(d, acc, '.spec.js'), []).sort();
  if (args.filter) specs = specs.filter(s => s.includes(args.filter));

  if (!specs.length) {
    console.error(chalk.red(args.filter ? `No specs match "${args.filter}".` : 'No specs found.'));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.gray(`Running ${specs.length} spec(s), concurrency ${args.concurrency}...`));
  const started = Date.now();
  // Output is fully buffered per spec: with concurrency > 1, streaming child
  // stdout straight through would interleave into nonsense.
  const results = await pool(specs, args.concurrency, s => runOne(s, args.timeout));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const failed = results.filter(r => !r.ok);
  const timedOut = results.filter(r => r.timedOut);
  const warned = results.filter(r => r.ok && r.stderr.includes('[known-failure]'));

  for (const r of timedOut) {
    console.log(chalk.red(`TIMEOUT  ${r.spec}  (>${args.timeout}ms，已 SIGKILL)`));
    console.log(chalk.gray('         多半是留了未关闭的句柄（定时器/监听器）。用 --timeout 调整上限。'));
  }

  for (const r of warned) {
    console.log(chalk.yellow(`known-failure  ${r.spec}`));
    r.stderr
      .split('\n')
      .filter(l => l.includes('[known-failure]'))
      .forEach(l => console.log(chalk.yellow(`  ${l.trim()}`)));
  }

  for (const r of failed) {
    console.log(chalk.red(`\nFAIL  ${r.spec}`));
    const out = `${r.stdout}${r.stderr}`.trimEnd().split('\n');
    out.slice(-25).forEach(l => console.log(`      ${l}`));
  }

  const line = `${results.length - failed.length}/${results.length} passed in ${seconds}s`;
  console.log(failed.length ? chalk.red(`\n${line} -- ${failed.length} failed`) : chalk.green(`\n${line}`));
  if (warned.length) console.log(chalk.yellow(`${warned.length} spec(s) contain quarantined known-failures.`));
  if (failed.length) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
