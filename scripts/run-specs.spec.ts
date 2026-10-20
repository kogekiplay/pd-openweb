const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const { spawnSync }: typeof import('node:child_process') = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-runner-spec-'));
try {
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.mkdirSync(path.join(directory, 'src/nested'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'CI'));
  fs.symlinkSync(path.join(__dirname, '../node_modules'), path.join(directory, 'node_modules'), 'dir');
  fs.copyFileSync(path.join(__dirname, 'run-specs.ts'), path.join(directory, 'scripts/run-specs.ts'));
  fs.writeFileSync(path.join(directory, 'src/nested/pass.spec.ts'), "console.log('ACTUAL_PASS');");
  fs.writeFileSync(path.join(directory, 'scripts/fail.spec.ts'), "console.error('ACTUAL_FAIL');process.exitCode=2;");
  fs.writeFileSync(path.join(directory, 'CI/known.spec.ts'), "console.error('[known-failure] actual fixture');");
  fs.writeFileSync(path.join(directory, 'CI/timeout.spec.ts'), 'setInterval(() => {}, 1000);');
  const run = (args: string[], skip = false) =>
    spawnSync(process.execPath, [path.join(directory, 'scripts/run-specs.ts'), ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, SKIP_TESTS: skip ? '1' : '0' },
    });
  const pass = run(['--filter', 'pass', '--concurrency', '2']);
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /Running 1 spec.*concurrency 2/);
  assert.match(pass.stdout, /1\/1 passed/);
  const missing = run(['--filter', 'absent']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No specs match/);
  const fail = run(['--filter', 'fail']);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /FAIL.*fail\.spec\.ts/);
  assert.match(fail.stdout, /ACTUAL_FAIL/);
  assert.match(fail.stdout, /0\/1 passed/);
  const known = run(['--filter', 'known']);
  assert.equal(known.status, 0);
  assert.match(known.stdout, /known-failure.*known\.spec\.ts/);
  assert.match(known.stdout, /1 spec\(s\) contain quarantined/);
  const timeout = run(['--filter', 'timeout', '--timeout', '1000']);
  assert.equal(timeout.status, 1);
  assert.match(timeout.stdout, /TIMEOUT.*timeout\.spec\.ts/);
  assert.match(timeout.stdout, /SIGKILL/);
  const defaults = run(['--filter', 'pass', '--concurrency', 'not-number', '--timeout']);
  assert.equal(defaults.status, 0);
  assert.match(defaults.stdout, /concurrency 1/);
  // Observe the actual default pool through child lifetimes: every discovered
  // fixture must run once, while at most four may occupy a slot simultaneously.
  const lifetimes = path.join(directory, 'lifetimes.jsonl');
  for (let i = 0; i < 6; i++) {
    fs.writeFileSync(
      path.join(directory, `src/nested/pool-${i}.spec.ts`),
      `const fs = require('node:fs');\n` +
        `const mark = event => fs.appendFileSync(${JSON.stringify(lifetimes)}, JSON.stringify([event, ${i}]) + '\\n');\n` +
        `mark('start'); setTimeout(() => mark('end'), 150);\n`,
    );
  }
  const pooled = run(['--filter', 'pool-']);
  assert.equal(pooled.status, 0, pooled.stderr);
  assert.match(pooled.stdout, /6\/6 passed/);
  const active = new Set<number>(),
    started = new Set<number>(),
    ended = new Set<number>();
  for (const line of fs.readFileSync(lifetimes, 'utf8').trim().split('\n')) {
    const [event, id] = JSON.parse(line) as ['start' | 'end', number];
    if (event === 'start') {
      assert.ok(!started.has(id));
      started.add(id);
      active.add(id);
      assert.ok(active.size <= 4, 'default pool oversubscribed the host');
    } else {
      assert.ok(active.delete(id));
      ended.add(id);
    }
  }
  assert.equal(active.size, 0);
  assert.equal(started.size, 6);
  assert.equal(ended.size, 6);
  fs.writeFileSync(path.join(directory, 'src/stray.test.ts'), "throw Error('must never run');");
  const naming = run(['--filter', 'pass']);
  assert.equal(naming.status, 1);
  assert.match(naming.stderr, /stray\.test\.ts/);
  assert.doesNotMatch(naming.stdout, /Running/);
  const skipped = run([], true);
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /behaviour specs skipped/);
  assert.doesNotMatch(skipped.stderr, /stray/);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log('Actual spec runner child IO/discovery/filter/failure/known-failure/timeout/naming/skip passed');
