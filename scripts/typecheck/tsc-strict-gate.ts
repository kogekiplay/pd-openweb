#!/usr/bin/env node
/**
 * strict 欠债闸门：默认全仓 strict，只有【明确记在欠债清单里的存量文件】可以不干净。
 *
 * 【2026-09-23 从「白名单」翻转成「欠债清单」】
 * 原来记的是「已达标」的文件（671 个），名单外不管。方向是反的，两个后果：
 *   - **新文件天生在管辖之外**，得有人记得跑 --widen 才进来，漏了没人知道；
 *   - 数字越涨越像进度，实际上分母（未受管文件）才是风险所在。
 * 翻转之后默认值变成「必须 strict 干净」，清单是**存量欠债**、只许变短。
 * 清单归零时这个文件和它守的那份 json 一起删掉，tsconfig.json 里直接写 strict:true。
 *
 * 【口径 = 终点配置（2026-09-23 起）】不只是 strict + noImplicitAny，而是 tsconfig 终点要开的
 * 全部严格开关（见 TARGET_FLAGS）。清单外的文件在切换那一刻已经全部按终点口径清干净，
 * 所以切换没有往清单里加任何文件。之后新写的文件一上来就要满足终点配置，不会再攒出一批
 * 「strict 干净、终点下却是脏的」文件 —— 为了切换，先分几批清掉了这样的 34 个文件 / 238 条。
 *
 * 判据
 * ----
 *   - 清单【外】的任何文件出现 strict 诊断 -> 失败。新文件、新目录、
 *     以及原本干净的文件退化，全都落在这一条里。
 *   - 清单【内】的文件出现诊断 -> 放行（那是已知存量）。
 *   - 清单里的文件已经不存在 -> 失败，要求清理，避免清单里攒死条目。
 *   - 清单里的文件已经达标 -> 提示可以跑 --shrink 把它踢出去（不强制失败，
 *     免得一次大范围修复变成「必须同时改清单」的连锁）。
 *
 * 为什么必须跑【全量】tsc 而不是只编译清单外的文件
 * ------------------------------------------------
 * 一个文件的诊断取决于它 import 进来的类型。只把部分文件喂给 tsc，
 * 那些没被显式列出的依赖会走 node_modules 解析或干脆解析失败，
 * 得到的诊断与真实构建不一致 —— 既可能漏报，也可能凭空多出 TS2307。
 * 所以这里编译整个 program，只在【报告】阶段按清单过滤。
 *
 * 用法：
 *   node scripts/typecheck/tsc-strict-gate.ts            # 校验
 *   node scripts/typecheck/tsc-strict-gate.ts --shrink   # 把已达标的文件移出清单（棘轮收紧）
 *   node scripts/typecheck/tsc-strict-gate.ts --stats    # 打印全仓 strict 进度
 *   SKIP_TYPECHECK=1 ...                                 # 与既有闸门一致的跳过开关
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const chalk = require('chalk').default;

const ROOT = path.resolve(__dirname, '../..');
const DEBT = path.join(__dirname, 'strict-debt.json');

const args = process.argv.slice(2);
const SHRINK = args.includes('--shrink');
const STATS = args.includes('--stats');

// 与 tsc-gate.js 同款的诊断头行解析。缩进行是同一条诊断的展开说明，不单独计数。
const HEAD = /^(\S[^(]*)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

// tsconfig.json 里还没打开、但终点配置要开的严格开关。某个开关在 tsconfig.json 里永久打开后，
// 从这里删掉即可（留着也无害，只是重复）。
const TARGET_FLAGS = [
  '--strict',
  '--noImplicitAny',
  '--noUncheckedIndexedAccess',
  '--exactOptionalPropertyTypes',
  '--noPropertyAccessFromIndexSignature',
];

function runStrictTsc() {
  const started = Date.now();
  // 【不能用 npx】npx 找的是 registry / 全局，不是工作区里的那个 tsc。
  // 2026-09-15 换 nodeLinker 时就是它静默失败、输出为空，而下面把「0 条诊断」
  // 读成了「全仓 strict 干净」—— 棘轮直接失明。
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  const res = spawnSync(
    process.execPath,
    [tsc, '--noEmit', '--pretty', 'false', ...TARGET_FLAGS],
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

// 参与编译且【应当】被闸门管理的文件。
// src/library 是预打包压缩产物（与 tsc-gate.js 的噪声定义保持一致），不纳入。
function allCompiledFiles() {
  /* 【--others --exclude-standard 不能去掉】光用 git ls-files 只列【已跟踪】的文件，
     于是「新建但还没 git add 的文件」整个落在管辖之外 —— 本地跑闸门显示通过，
     等到 pre-push（那时文件已被跟踪）才当场失败。
     翻转成欠债清单的全部意义就是「新文件默认受管」，漏掉未跟踪文件等于没翻转。
     实测过：新建一个 export function bad(x) { return x.whatever } 放在 src 下，
     不加这两个参数时闸门一声不吭。
     --exclude-standard 让 .gitignore 照常生效，构建产物不会被卷进来。 */
  const res = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'types'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  // --cached 与 --others 理论上不重叠，去重只是保险；泛型必须写，否则推成 Set<unknown>
  return [...new Set<string>(String(res.stdout || '').split('\n'))]
    // 【两个后缀都要排】spec 是测试脚手架不是产品代码，口径要和差分门禁
    //（tsconfig.gate.json 的 exclude）一致。2026-09-15 把 69 个 spec 改成 .ts
    // 时这里还只排 .spec.js，它们整批混进来，把「strict-clean 605/4252」
    // 一夜刷成「674/4321」——进度数字凭空虚高 69，而产品代码一行没改。
    // 它们由 tsconfig.tools.json 的零容忍门禁负责。
    .filter(f => /\.tsx?$/.test(f) && !f.startsWith('src/library/') && !/\.spec\.(js|ts)$/.test(f));
}

if (process.env.SKIP_TYPECHECK === '1') {
  console.log(chalk.yellow('SKIP_TYPECHECK=1 —— strict 欠债闸门已跳过。'));
  process.exit(0);
}

const { out, ms } = runStrictTsc();
const byFile = parse(out);
const compiled = allCompiledFiles();
const dirty = compiled.filter(f => byFile.has(f));
const clean = compiled.filter(f => !byFile.has(f));

// ── 安全网：诊断数异常地少 = 编译器塌了，不是全仓变干净了 ──────────────────
// 差分门禁早就有这道网（"剔噪后不足预期 50% 就拒绝执行"），这边一直没有。
// 2026-09-15 换 nodeLinker 时 npx 静默失败、输出为空，这个脚本把「0 条诊断」
// 读成了「4252/4252 全部 strict-clean」并【通过】—— 闸门彻底失明，
// 而且当时的 --widen 会把全仓写进名单，之后再也报不出回退。
// 阈值取 1000：本仓 strict 全量长期在 5 万条以上，跌到四位数以下一定是出事了。
// 【等欠债真的快清完时记得下调这个阈值】它到那时会从安全网变成绊脚石。
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
  console.log(chalk.cyan(`strict 全量诊断 ${totalDiagnostics} 条，涉及 ${byFile.size} 个文件`));
  console.log(
    chalk.cyan(
      `已 strict-clean ${clean.length} / ${compiled.length} 个文件（${((clean.length / compiled.length) * 100).toFixed(1)}%）`,
    ),
  );
  // 错误码 -> 条数。不写类型的话 Object.entries 推出来是 [string, unknown][]，
  // 下面 b[1] - a[1] 当场报「算术运算的操作数类型不对」。
  const codes: Record<string, number> = {};
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

if (SHRINK) {
  const prev = fs.existsSync(DEBT) ? JSON.parse(fs.readFileSync(DEBT, 'utf8')).files : [];
  // 只减不增：这次算出来是脏的、但原先不在清单里的文件【不会】被补进来 ——
  // 那是新引入的欠债，应当当场报错，而不是被 --shrink 悄悄接纳。
  const next = prev.filter(f => dirty.includes(f)).sort();
  const removed = prev.length - next.length;
  fs.writeFileSync(DEBT, `${JSON.stringify({ files: next }, null, 2)}\n`);
  console.log(chalk.green(`欠债清单已收紧：${prev.length} -> ${next.length}（移出 ${removed}）`));
  console.log(chalk.gray(`  当前 strict-clean ${clean.length} / ${compiled.length} 个文件`));
  process.exit(0);
}

if (!fs.existsSync(DEBT)) {
  console.error(chalk.red(`找不到 ${path.relative(ROOT, DEBT)}。`));
  process.exit(2);
}

const listed = JSON.parse(fs.readFileSync(DEBT, 'utf8')).files;
const listedSet = new Set(listed);

// 清单外出现诊断 = 新欠债。新文件、新目录、以及原本干净的文件退化都在这里。
const offenders = dirty.filter(f => !listedSet.has(f));
// 清单里的文件已经不存在了 —— 不清掉的话清单会攒死条目，数字失真。
const compiledSet = new Set(compiled);
const stale = listed.filter(f => !compiledSet.has(f));
// 清单里已经达标的 —— 只提示，不失败（否则一次大范围修复会连带要求改清单）。
const payable = listed.filter(f => compiledSet.has(f) && !byFile.has(f));

console.log(
  chalk.gray(
    `strict 欠债闸门：清单 ${listed.length} 个文件 | 全仓 strict-clean ${clean.length}/${compiled.length} | tsc ${(ms / 1000).toFixed(1)}s`,
  ),
);

if (!offenders.length && !stale.length) {
  console.log(chalk.green('strict 欠债闸门通过：清单外的文件全部零诊断。'));
  if (payable.length > 0) {
    console.log(chalk.gray(`  清单里有 ${payable.length} 个文件已达标，可跑 --shrink 把它们移出去。`));
  }
  process.exit(0);
}

if (offenders.length) {
  console.error(chalk.red(`\nstrict 欠债闸门失败：${offenders.length} 个文件不在欠债清单里，却有 strict 诊断\n`));
  for (const f of offenders.slice(0, 20)) {
    console.error(chalk.red(`  ${f}`));
    byFile
      .get(f)
      .slice(0, 3)
      .forEach(l => console.error(chalk.gray(`    ${l.replace(`${f}`, '')}`)));
  }
  if (offenders.length > 20) console.error(chalk.red(`  …其余 ${offenders.length - 20} 个略`));
  console.error(
    chalk.yellow(
      '\n新文件默认就该是 strict 干净的。请修好类型问题，' + '【不要】把文件加进欠债清单 —— 那份清单只减不增。',
    ),
  );
}

if (stale.length) {
  console.error(chalk.red(`\n欠债清单里有 ${stale.length} 个文件已经不存在了，请从清单里删掉：\n`));
  stale.slice(0, 20).forEach(f => console.error(chalk.red(`  ${f}`)));
  if (stale.length > 20) console.error(chalk.red(`  …其余 ${stale.length - 20} 个略`));
}

process.exit(1);
