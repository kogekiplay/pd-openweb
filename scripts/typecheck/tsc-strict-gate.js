#!/usr/bin/env node
/**
 * strict 棘轮闸门：保证【已经能通过 strict 检查的文件】不再退化。
 *
 * 为什么需要它
 * ------------
 * 全仓开 strict 目前还差 7.6 万条诊断（见 --stats），不可能一次到位。
 * 但清理是逐文件推进的，已经清干净的部分如果没人守着，下一个 PR 随手加个
 * 无类型参数就悄悄退回去了 —— 清理速度赶不上退化速度，这件事就永远做不完。
 *
 * 所以这里走【棘轮】而不是【一刀切】：
 *   - 名单里的文件必须在 --strict --noImplicitAny 下零诊断，否则 pre-push 失败；
 *   - 名单外的文件不管，照常用宽松基线（scripts/typecheck/tsc-gate.js）；
 *   - 文件清干净后用 --widen 把它加进名单，只进不退。
 *
 * 为什么必须跑【全量】tsc 而不是只编译名单里的文件
 * ------------------------------------------------
 * 一个文件的诊断取决于它 import 进来的类型。只把名单里的文件喂给 tsc，
 * 那些没被显式列出的依赖会走 node_modules 解析或干脆解析失败，
 * 得到的诊断与真实构建不一致 —— 既可能漏报，也可能凭空多出 TS2307。
 * 所以这里编译整个 program，只在【报告】阶段按名单过滤。
 *
 * 用法：
 *   node scripts/typecheck/tsc-strict-gate.js            # 校验名单
 *   node scripts/typecheck/tsc-strict-gate.js --widen    # 重新计算并写入名单（棘轮收紧）
 *   node scripts/typecheck/tsc-strict-gate.js --stats    # 打印全仓 strict 进度
 *   SKIP_TYPECHECK=1 ...                                 # 与既有闸门一致的跳过开关
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const chalk = require('chalk').default;

const ROOT = path.resolve(__dirname, '../..');
const ALLOWLIST = path.join(__dirname, 'strict-allowlist.json');

const args = process.argv.slice(2);
const WIDEN = args.includes('--widen');
const STATS = args.includes('--stats');

// 与 tsc-gate.js 同款的诊断头行解析。缩进行是同一条诊断的展开说明，不单独计数。
const HEAD = /^(\S[^(]*)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

function runStrictTsc() {
  const started = Date.now();
  // 【不能用 npx】npx 找的是 registry / 全局，不是工作区里的那个 tsc。
  // 2026-09-15 换 nodeLinker 时就是它静默失败、输出为空，而下面把「0 条诊断」
  // 读成了「全仓 strict 干净」—— 棘轮直接失明。
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  const res = spawnSync(
    process.execPath,
    [tsc, '--noEmit', '--pretty', 'false', '--strict', '--noImplicitAny'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return { out, ms: Date.now() - started };
}

function parse(out) {
  const byFile = new Map();

  for (const line of out.split('\n')) {
    const m = line.match(HEAD);
    if (!m) continue;
    const file = m[1];
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(line);
  }

  return byFile;
}

// 参与编译且【应当】被棘轮管理的文件。
// src/library 是预打包压缩产物（与 tsc-gate.js 的噪声定义保持一致），不纳入。
function allCompiledFiles() {
  const res = spawnSync('git', ['ls-files', 'src', 'types'], { cwd: ROOT, encoding: 'utf8' });
  return (res.stdout || '')
    .split('\n')
    .filter(f => /\.tsx?$/.test(f) && !f.startsWith('src/library/') && !/\.spec\.js$/.test(f));
}

if (process.env.SKIP_TYPECHECK === '1') {
  console.log(chalk.yellow('SKIP_TYPECHECK=1 —— strict 棘轮闸门已跳过。'));
  process.exit(0);
}

const { out, ms } = runStrictTsc();
const byFile = parse(out);
const compiled = allCompiledFiles();
const clean = compiled.filter(f => !byFile.has(f));

// ── 安全网：诊断数异常地少 = 编译器塌了，不是全仓变干净了 ──────────────────
// 差分门禁早就有这道网（"剔噪后不足预期 50% 就拒绝执行"），这边一直没有。
// 2026-09-15 换 nodeLinker 时 npx 静默失败、输出为空，这个脚本把「0 条诊断」
// 读成了「4252/4252 全部 strict-clean」并【通过】—— 棘轮彻底失明，
// 而且 --widen 会把全仓写进名单，之后再也报不出回退。
// 阈值取 1000：本仓 strict 全量长期在 6 万条以上，跌到四位数以下一定是出事了。
const totalDiagnostics = [...byFile.values()].reduce((a, l) => a + l.length, 0);
const FLOOR = 1000;
if (totalDiagnostics < FLOOR) {
  console.error(
    chalk.red(
      `\n拒绝执行：strict 全量诊断只有 ${totalDiagnostics} 条（下限 ${FLOOR}），` +
        '这几乎一定是 tsc 没跑起来，而不是代码变干净了。',
    ),
  );
  console.error(chalk.gray('  tsc 的原始输出（前 400 字）：'));
  console.error(chalk.gray(`  ${(out || '(空)').slice(0, 400)}`));
  process.exit(2);
}

if (STATS) {
  const totalDiag = [...byFile.values()].reduce((a, l) => a + l.length, 0);
  console.log(chalk.cyan(`strict 全量诊断 ${totalDiag} 条，涉及 ${byFile.size} 个文件`));
  console.log(chalk.cyan(`已 strict-clean ${clean.length} / ${compiled.length} 个文件（${((clean.length / compiled.length) * 100).toFixed(1)}%）`));
  const codes = {};
  for (const lines of byFile.values()) {
    for (const l of lines) {
      const c = l.match(/(TS\d+)/)[1];
      codes[c] = (codes[c] || 0) + 1;
    }
  }
  console.log(chalk.gray('  Top 错误码：'));
  Object.entries(codes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .forEach(([c, n]) => console.log(chalk.gray(`    ${c}  ${n}`)));
  process.exit(0);
}

if (WIDEN) {
  const prev = fs.existsSync(ALLOWLIST) ? JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')).files : [];
  // 只进不退：即使某文件这次算出来是脏的，也不从名单里删 —— 那属于退化，应当报错而不是静默放行。
  const merged = [...new Set([...prev, ...clean])].sort();
  const added = merged.length - prev.length;
  fs.writeFileSync(ALLOWLIST, `${JSON.stringify({ files: merged }, null, 2)}\n`);
  console.log(chalk.green(`名单已更新：${prev.length} -> ${merged.length}（新增 ${added}）`));
  console.log(chalk.gray(`  当前 strict-clean ${clean.length} / ${compiled.length} 个文件`));
  process.exit(0);
}

if (!fs.existsSync(ALLOWLIST)) {
  console.error(chalk.red(`找不到 ${path.relative(ROOT, ALLOWLIST)}，先跑一次 --widen 生成。`));
  process.exit(2);
}

const listed = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')).files;
const regressed = listed.filter(f => byFile.has(f));

console.log(
  chalk.gray(
    `strict 棘轮：名单 ${listed.length} 个文件 | 全仓 strict-clean ${clean.length}/${compiled.length} | tsc ${(ms / 1000).toFixed(1)}s`,
  ),
);

if (!regressed.length) {
  const candidates = clean.length - listed.filter(f => clean.includes(f)).length;
  console.log(chalk.green('strict 棘轮通过：名单内文件全部零诊断。'));
  if (candidates > 0) {
    console.log(chalk.gray(`  另有 ${candidates} 个文件已达标但不在名单里，可跑 --widen 收紧棘轮。`));
  }
  process.exit(0);
}

console.error(chalk.red(`\nstrict 棘轮失败：${regressed.length} 个已达标文件出现了 strict 诊断\n`));
for (const f of regressed.slice(0, 20)) {
  console.error(chalk.red(`  ${f}`));
  byFile
    .get(f)
    .slice(0, 3)
    .forEach(l => console.error(chalk.gray(`    ${l.replace(`${f}`, '')}`)));
}
if (regressed.length > 20) console.error(chalk.red(`  …其余 ${regressed.length - 20} 个略`));
console.error(
  chalk.yellow('\n这些文件此前能通过 strict 检查。请修好新引入的类型问题，而不是把文件从名单里删掉。'),
);
process.exit(1);
