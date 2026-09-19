/**
 * 硬编码色审计 + 棘轮。
 *
 * 【为什么需要它】六道门禁测的全是类型和纯函数行为，没有一道能发现
 * 「颜色改错了」。视觉重构要动 3000 多处颜色，唯一能自动化的安全网就是
 * 「硬编码色只能变少」这条单调性 —— 它抓不到改错色，但能抓到
 * 「顺手又写死了一个 #1677ff」，而后者才是主题引擎被重新捅穿的方式。
 *
 * 【口径故意粗】正则会把注释、字符串、URL 片段里的 # 十六进制一并算进去。
 * 对棘轮来说这没关系：它比的是【同一口径下的前后数量】，只要口径稳定，
 * 假阳性在两边同时出现、互相抵消。想精确定位时用 --stats 看分区，
 * 再用下面那条 grep 去看具体位置，别去调正则求「准」——
 * 调正则会让基线失去可比性，那才是真正的损失。
 *
 * 用法：
 *   node tools/audit-colors.ts                 # 打印总数
 *   node tools/audit-colors.ts --stats         # 按分区打印
 *   node tools/audit-colors.ts --check         # 对比基线，任一分区变多就非 0 退出
 *   node tools/audit-colors.ts --write-baseline
 */

const fs = require('fs');
const path = require('path');

const ROOT: string = path.resolve(__dirname, '..');
const BASELINE: string = path.join(__dirname, 'audit-colors.baseline.json');

/** 只看会进样式的文件。.ts/.tsx 里的内联 style 同样算。 */
const EXTS: Set<string> = new Set(['.less', '.css', '.ts', '.tsx', '.js', '.jsx']);

/**
 * spec 不渲染任何东西，里面的颜色是【测试夹具】，不是界面上的写死色。
 * 算进来只会让棘轮在「给主题相关代码补测试」时误报 —— 而那恰恰是我们要鼓励的事。
 */
const SPEC_RE = /\.spec\.[jt]sx?$/;

/**
 * 这些目录是第三方产物或压缩包，不是我们写的。
 * src/library 尤其重要：applibrary_v2.js 是自带 styled-components 5.3.8 的
 * 预打包文件，一个文件就有上千个颜色，算进来会淹掉真实信号。
 */
const SKIP_DIRS: Set<string> = new Set(['node_modules', 'dist', 'build', 'library', '.git']);

/** #rgb / #rrggbb / #rrggbbaa / rgb() / rgba() / hsl() / hsla() */
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

/**
 * 分区：路径前缀 -> 人看得懂的名字。顺序敏感，先匹配到的算数。
 *
 * 【分区要切得够细】棘轮是按分区比的，一个大桶里「这边加 5、那边减 5」会净额
 * 抵消、静默放过 —— 这正是差分类型门禁踩过的盲区。下面这份是照着实测分布切的，
 * 凡是超过 100 处的目录都单独成区，剩下的「其它」约 590 处。
 */
const AREAS: Array<[string, string]> = [
  ['src/ming-ui/', 'ming-ui 共享组件'],
  ['src/common/mdcss/', '全局样式'],
  ['src/common/theme/', '主题引擎'],
  ['src/pages/workflow/', '工作流'],
  ['src/pages/Statistics/', '统计'],
  ['src/pages/widgetConfig/', '字段配置'],
  ['src/pages/Admin/', '后台管理'],
  ['src/pages/worksheet/', '工作表'],
  ['src/pages/customPage/', '自定义页面'],
  ['src/components/', '业务组件'],
  ['src/pages/integration/', '集成'],
  ['src/pages/PageHeader/', '顶栏'],
  ['src/pages/task/', '任务'],
  ['src/pages/calendar/', '日历'],
  ['src/pages/kc/', '知识'],
  ['src/pages/Mobile/', '移动端'],
];

function areaOf(rel: string): string {
  for (const [prefix, name] of AREAS) if (rel.startsWith(prefix)) return name;
  return '其它';
}

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (EXTS.has(path.extname(entry.name)) && !SPEC_RE.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function countColorsInSource(source: string): number {
  const matches = source.match(COLOR_RE);
  return matches ? matches.length : 0;
}

function collect(): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const file of walk(path.join(ROOT, 'src'), [])) {
    const rel: string = path.relative(ROOT, file).split(path.sep).join('/');
    const n = countColorsInSource(fs.readFileSync(file, 'utf8'));
    if (!n) continue;
    const area = areaOf(rel);
    tally[area] = (tally[area] || 0) + n;
  }
  return tally;
}

function total(tally: Record<string, number>): number {
  return Object.values(tally).reduce((a: number, b: number) => a + b, 0);
}

const argv: string[] = process.argv.slice(2);
const tally = collect();

if (argv.includes('--write-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify(tally, null, 2) + '\n');
  console.log(`基线已写入 ${path.relative(ROOT, BASELINE)}，合计 ${total(tally)} 处`);
  process.exit(0);
}

if (argv.includes('--stats') || argv.includes('--check')) {
  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  for (const [area, n] of rows) console.log(String(n).padStart(6), area);
  console.log(String(total(tally)).padStart(6), '合计');
} else {
  console.log(total(tally));
}

if (argv.includes('--check')) {
  if (!fs.existsSync(BASELINE)) {
    console.error('没有基线文件，先跑 node tools/audit-colors.ts --write-baseline');
    process.exit(1);
  }
  const base: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const worse = Object.entries(tally).filter(([area, n]) => n > (base[area] || 0));
  if (worse.length) {
    console.error('\n硬编码色变多了（棘轮只允许变少）：');
    for (const [area, n] of worse) console.error(`  ${area}: ${base[area] || 0} -> ${n}`);
    console.error('\n清掉新增的写死颜色；确有理由时跑 --write-baseline 重设基线，并在提交信息里写明原因。');
    process.exit(1);
  }
  console.log('\n棘轮通过：各分区都没有变多。');
}
