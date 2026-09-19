/**
 * 写死圆角的棘轮。跟 tools/audit-colors.ts 是同一套路、同一形状 ——
 * 数一个只允许变少的数，按区切开，防止「这边加 5、那边减 5」净额抵消。
 *
 * 【数的是什么】`border-radius` 声明里**没有走 var(--radius-*) 的那些**。
 * 动工前的分布（2026-09-19 实测，全仓 4070 处声明）：
 *   1046×3px  649×4px  601×50%  186×5px  178×6px  135×2px  118×8px …
 * 其中 2px–5px 合计 2016 处，就是「界面显旧」的物理来源。
 *
 * 【50% 和 999px 不算账】正圆（头像、图标底、旋钮）和胶囊本来就该是字面量，
 * 它们不是「档位没定好」，把它们算进来只会让基线失去可比性。
 * 同理放过 0 —— 「明确不要圆角」是个正当表达。
 *
 * 【口径故意粗】跟 audit-colors 一样：注释里、字符串里的照算。
 * 别去调正则求"准"，那会让前后两次的数字不可比；假阳性在两次里同时出现、互相抵消。
 */
const fs = require('fs');
const path = require('path');

const ROOT: string = path.resolve(__dirname, '..');
const BASELINE: string = path.join(__dirname, 'audit-radius.baseline.json');

/** 只看会进样式的文件。.ts/.tsx 里的内联 style 与 styled-components 同样算。 */
const EXTS: Set<string> = new Set(['.less', '.css', '.ts', '.tsx', '.js', '.jsx']);

/** spec 里为了断言会写死一堆值，不该计入。 */
const SPEC_RE = /\.spec\.[jt]sx?$/;

/** library/ 是打包好的第三方产物，不是我们的源码。 */
const SKIP_DIRS: Set<string> = new Set(['node_modules', 'dist', 'build', 'library', '.git']);

/**
 * 一条 border-radius 声明的值部分。
 * 简写（border-top-left-radius 等）一并算 —— 它们同样是写死的几何。
 */
const RADIUS_RE = /border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;}\n]+)/g;

/** 这些值本来就该是字面量，不进账（见文件头注释）。 */
function isExempt(value: string): boolean {
  const v = value.trim().toLowerCase().replace(/!important/g, '').trim();
  if (!v) return true;
  if (v.includes('var(--radius-')) return true; // 已经走档位了
  // 全部由「正圆 / 胶囊 / 0 / 继承」这类构成的，放过
  return v.split(/[\s/]+/).every(part => /^(50%|999px|9999px|0|0px|inherit|initial|unset|revert)$/.test(part));
}

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
      continue;
    }
    if (!EXTS.has(path.extname(entry.name))) continue;
    if (SPEC_RE.test(entry.name)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

function countInSource(source: string): number {
  let n = 0;
  let m: RegExpExecArray | null;
  RADIUS_RE.lastIndex = 0;
  while ((m = RADIUS_RE.exec(source))) if (!isExempt(m[1])) n++;
  return n;
}

function collect(): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const file of walk(path.join(ROOT, 'src'), [])) {
    const rel: string = path.relative(ROOT, file).split(path.sep).join('/');
    const n = countInSource(fs.readFileSync(file, 'utf8'));
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
    console.error('没有基线文件，先跑 node tools/audit-radius.ts --write-baseline');
    process.exit(1);
  }
  const base: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const worse = Object.entries(tally).filter(([area, n]) => n > (base[area] || 0));
  if (worse.length) {
    console.error('\n写死的圆角变多了（棘轮只允许变少）：');
    for (const [area, n] of worse) console.error(`  ${area}: ${base[area] || 0} -> ${n}`);
    console.error('\n改用 var(--radius-xs|sm|md|lg)；确有理由时跑 --write-baseline 重设基线，并在提交信息里写明原因。');
    process.exit(1);
  }
  console.log('\n棘轮通过：各分区都没有变多。');
}
