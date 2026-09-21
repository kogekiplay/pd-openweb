/**
 * 写死字号/间距的棘轮。跟 audit-colors.ts / audit-radius.ts 同一套路 ——
 * 数一个只允许变少的数，按区切开，防止「这边加、那边减」净额抵消。
 *
 * 【数的是什么：只数【落在尺子上】的写死值】
 * 这一条和另外两个棘轮不一样，是刻意的。色值和圆角是"所有字面量都该消失"，
 * 而间距不是 —— `margin: 10px` 完全正当，10 就是**故意不在尺子上**。
 * 如果把尺子外的值也算进来，这个数永远到不了零，而且**加一条正当的 10px 边距
 * 就会让棘轮报警**，逼着人去凑 token。那是反效果：尺子是用来统一节奏的，
 * 不是用来消灭所有数字的。
 *
 * 所以只数「值正好等于某一档、却没走 var()」的声明 —— 那些是纯粹的遗漏，目标是零。
 *
 * 档位（与 theme-default.less 一致，改那边记得改这边）：
 *   字号 12/13/14/16/18/20/24  —— 15/17/22 故意不设档
 *   间距 4/8/12/16/20/24/32    —— 没有 28（--space-7 故意不设）
 *
 * 【负值不算】`-16px` 要等价成 `calc(-1 * var(--space-4))`，不值得，
 * 字面量更清楚。算进来只会制造一批修不掉的欠账。
 *
 * 【口径要和 codemod 对齐：只数「可以修的」】
 * 这一点和 audit-colors / audit-radius 不同，那两个是"口径故意粗、注释里的照算"。
 * 这里不能那样，因为有两类东西是 codemod **有意不碰**的：
 *   · 注释掉的旧声明（`/*padding: 32px 0;*\/`）—— 改注释里的值没意义，只让 diff 变脏
 *   · LESS 变量声明（`@dialog-hr-padding: 24px`）—— **换成 var() 会让编译失败**，
 *     因为同文件里有 `@dialog-hr-padding - @close-hit-padding` 这种编译期算术，
 *     而 CSS 变量要到运行时才解析（实测踩过，报 "Operation on an invalid type"）
 *
 * 如果把这两类也算进去，某些区就会永远停在 1、2 而到不了零。
 * 那不只是数字不好看 —— **它是个诱饵**：后来的人追着这个 1 找过去，
 * 把 LESS 变量换成 var()，编译当场就炸。
 * 所以这里跟 codemod 用同一套判别（同样的 lookbehind、同样跳过注释行），
 * 让"归零"真的等于"这一区做完了"。
 *
 * 【但值的口径仍然粗】字符串里的照算，不去区分是不是真的会生效。
 * 那类假阳性在前后两次里同时出现、互相抵消，不影响棘轮。
 */
const fs = require('fs');
const path = require('path');

const ROOT: string = path.resolve(__dirname, '..');
const BASELINE: string = path.join(__dirname, 'audit-typography.baseline.json');

const EXTS: Set<string> = new Set(['.less', '.css', '.ts', '.tsx', '.js', '.jsx']);
const SPEC_RE = /\.spec\.[jt]sx?$/;
/** library/ 是打包好的第三方产物，不是我们的源码。 */
const SKIP_DIRS: Set<string> = new Set(['node_modules', 'dist', 'build', 'library', '.git']);

const FONT_STEPS = new Set([12, 13, 14, 16, 18, 20, 24]);
const SPACE_STEPS = new Set([4, 8, 12, 16, 20, 24, 32]);

// lookbehind 挡住 `-` / `@` / `$` / 词字符，跳过 `@xxx-padding:` 这类 LESS 变量声明。
// 【`-` 和 `p` 之间是词边界】所以光靠 \b 拦不住 —— 这是实测踩出来的，见文件头。
//
// 【不要把行首写进正则】曾经写成 `(^|\n)([^\n]*?…prop:)`，为的是能判断注释行。
// 代价是 `g` 下**一行里只有第一条声明会被匹配**，
// `padding-top: 4px !important; padding-bottom: 4px !important;` 后半条就看不见了。
// 全仓 10 处，数目不大但性质恶劣：codemod 也用同一个正则，
// 于是这 10 处它既不改、这里也不算 —— **"归零"是个假的零**。
// 现在按 offset 回溯到行首判注释，和 codemod 完全同构。
const FONT_RE = /(?<![-\w@$])font-size:\s*([^;{}\n]+)/g;
const SPACE_RE = /(?<![-\w@$])(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left))?:\s*([^;{}\n]+)/g;

/** 这条声明是不是在注释行里。codemod 不改它们，算进来就是个修不掉的底数（见文件头）。 */
function isCommentAt(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  return /^\s*(\/\/|\*|\/\*)/.test(source.slice(lineStart, offset));
}

/**
 * 一条声明的值里，有几个「正好落在档位上、又是正数」的裸 px。
 * 前面必须是行首/空白/括号/逗号/斜杠 —— 这样 `-16px` 的负号会挡住匹配（负值不算），
 * 也不会把 `140px` 里的 `40px` 数进来。
 */
function countMissed(value: string, steps: Set<number>): number {
  let n = 0;
  const re = /(^|[\s(,/])(\d+)px\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (steps.has(Number(m[2]))) n++;
  }
  return n;
}

const AREAS: Array<[string, string]> = [
  ['src/ming-ui/', 'ming-ui 共享组件'],
  ['src/common/', '全局样式与主题'],
  ['src/pages/PageHeader/', '顶栏'],
  ['src/pages/AppHomepage/', '工作台'],
  ['src/pages/worksheet/', '工作表'],
  ['src/pages/workflow/', '工作流'],
  ['src/pages/Admin/', '后台管理'],
  ['src/pages/widgetConfig/', '字段配置'],
  ['src/pages/Statistics/', '统计'],
  ['src/pages/customPage/', '自定义页面'],
  ['src/pages/integration/', '集成'],
  ['src/pages/Mobile/', '移动端'],
  ['src/components/', '业务组件'],
  // 下面这些单拎出来，是因为不拆的话「其它」会是最大的一个桶（2629）——
  // 桶太大就失去了按区切开的意义：区内一加一减照样净额抵消。
  ['src/pages/AppSettings/', '应用设置'],
  ['src/pages/task/', '任务'],
  ['src/pages/FormSet/', '表单设置'],
  ['src/pages/chat/', '聊天'],
  ['src/pages/kc/', '知识'],
  ['src/pages/Role/', '角色权限'],
  ['src/pages/calendar/', '日历'],
  ['src/pages/AuthService/', '登录注册'],
  ['src/pages/Personal/', '个人设置'],
  ['src/pages/feed/', '动态'],
  ['src/pages/FormExtend/', '表单扩展'],
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

  FONT_RE.lastIndex = 0;
  while ((m = FONT_RE.exec(source))) {
    if (!isCommentAt(source, m.index)) n += countMissed(m[1], FONT_STEPS);
  }

  SPACE_RE.lastIndex = 0;
  while ((m = SPACE_RE.exec(source))) {
    if (!isCommentAt(source, m.index)) n += countMissed(m[1], SPACE_STEPS);
  }

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
    console.error('没有基线文件，先跑 node tools/audit-typography.ts --write-baseline');
    process.exit(1);
  }
  const base: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const worse = Object.entries(tally).filter(([area, n]) => n > (base[area] || 0));
  if (worse.length) {
    console.error('\n落在档位上却没走 token 的字号/间距变多了（棘轮只允许变少）：');
    for (const [area, n] of worse) console.error(`  ${area}: ${base[area] || 0} -> ${n}`);
    console.error('\n改用 var(--font-*) / var(--space-*)。');
    console.error('值【不在档位上】的不算账，不用为了消警去凑 token —— 10px 的边距就该写 10px。');
    process.exit(1);
  }
  console.log('\n棘轮通过：各分区都没有变多。');
}
