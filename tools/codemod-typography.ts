/**
 * 把写死的字号/间距换成尺子上的 token。**等价替换，值不变。**
 *
 *   node tools/codemod-typography.ts <目录>            # 干跑，只报数和样例
 *   node tools/codemod-typography.ts <目录> --apply    # 写入
 *
 * 配套：`npm run check:typography`（棘轮，数还剩多少没映射）、
 * `tools/geometry-probe.ts`（改完验版面有没有动）。
 * 标准流程是：采基线 -> 干跑看数 -> apply -> 重采 -> compare 必须零变化。
 *
 * 【为什么值不变还要改】把尺子落到实处。现在换成 token 视觉上什么都不会发生，
 * 但以后要整体调节奏（比如正文 13 -> 14）才有的可调，
 * 而不是全仓 grep 一个个数字去撞。
 *
 * ─────────── 不动的几类，都是刻意的 ───────────
 *
 * · **尺子外的值原样保留**。15/17/22 是立尺子时【故意不设】的档，10/6/5 同理。
 *   不要为了"都用上 token"去凑档 —— 尺子是用来统一节奏的，不是消灭所有数字的。
 *
 * · **负值不动**。`-16px` 要等价成 `calc(-1 * var(--space-4))`，不值得，
 *   字面量更清楚。靠 lead 字符类里不含 `-` 来天然跳过。
 *
 * · **混合值只换命中的那部分**：`margin: 0 10px 0 12px` 只有 12 被换。
 *
 * · **JSX 内联样式的驼峰数值属性不动**（`fontSize: 14`）—— 它不是 CSS 语法，
 *   天然匹配不上 `font-size:`。这是**有意的判别方式**，不是巧合：
 *   CSS 上下文一律是 kebab-case + px，JSX 数值属性一律是驼峰 + 无单位。
 *
 * ─────────── 一个实测踩到的坑 ───────────
 *
 * **字符串形式的内联样式是 CSS，会被映射**，比如 `bodyStyle={{ padding: '16px 24px' }}`。
 * 这类要当心【只映射一半】：lead 字符类原先只有 `[\s(,/]`，引号紧贴的第一个值
 * （`'16px`）匹配不上，第二个（` 24px`）匹配得上，结果产出
 * `padding: '16px var(--space-6)'` —— 能跑（内联样式支持 var()），但半生不熟。
 * 工作台那批就漏了一处，是靠事后 grep 新增行里残留的档位值才发现的。
 * 所以 lead 字符类要带上引号和反引号。
 *
 * ─────────── 另一个实测踩到的坑：LESS 变量声明 ───────────
 *
 * **属性名前面必须挡住 `-` / `@` / `$`**，否则会命中 LESS 变量声明。
 * `@dialog-hr-padding: 24px;` 里的 `padding:` 前面是 `-`，而 `-` 和 `p` 之间
 * **是词边界**，所以原来的 `\b` 拦不住 —— 它被改成了 `var(--space-6)`。
 *
 * 后果不是样式偏差，是**编译直接失败**：同文件里有
 * `right: @dialog-hr-padding - @close-hit-padding;`，那是 LESS 的【编译期】算术，
 * 而 CSS 变量要到浏览器运行时才解析，LESS 拿到 `var(--space-6) - 6px`
 * 报 "Operation on an invalid type"。
 *
 * 更普遍地说：**参与 LESS 运算的值不能换成 CSS 变量**，两者不在同一个时间点求值。
 * 这里靠 lookbehind 一律不碰 `@变量` 声明，是最省事的划界。
 */
const fs = require('fs');
const path = require('path');

/** 档位表，与 theme-default.less 一致。改那边记得改这边和 audit-typography.ts。 */
const FONT: Record<number, string> = { 12: 'xs', 13: 'sm', 14: 'md', 16: 'lg', 18: 'xl', 20: '2xl', 24: '3xl' };
/** 注意没有 28（--space-7 是故意不设的档）。 */
const SPACE: Record<number, string> = { 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' };

const SPACE_PROPS =
  'margin|padding|gap|row-gap|column-gap|margin-top|margin-right|margin-bottom|margin-left|padding-top|padding-right|padding-bottom|padding-left';

const EXTS: Set<string> = new Set(['.less', '.css', '.tsx', '.ts']);
const SKIP: Set<string> = new Set(['node_modules', 'dist', 'build', 'library', '.git']);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (EXTS.has(path.extname(e.name)) && !/\.spec\./.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/**
 * 把一段声明值里的 px 逐个替换。
 * lead 字符类决定了什么算"一个完整的值"：
 *   · 含引号/反引号 —— 见文件头那个「只映射一半」的坑
 *   · 【不含 `-`】—— 负值就是靠这个跳过的，别随手加进去
 *   · 也保证 `140px` 里的 `40px` 匹配不上
 */
function mapValue(value: string, table: Record<number, string>, prefix: string): [string, number] {
  let n = 0;
  const next = value.replace(/(^|[\s(,/'"`])(\d+)px\b/g, (m: string, lead: string, num: string) => {
    const key = table[Number(num)];
    if (!key) return m;
    n++;
    return `${lead}var(--${prefix}-${key})`;
  });
  return [next, n];
}

/**
 * 这条声明是不是在注释行里 —— 改注释里的示例值没意义，只会让 diff 变脏。
 *
 * 【为什么要按 offset 回溯，而不是把行首写进正则】
 * 原来是 `(^|\n)([^\n]*?…prop:\s*)(值)`，靠捕获"行首到属性名"这段来判断注释。
 * 代价是 `g` 标志下 **一行里只有第一条声明会被匹配** ——
 * `'padding-top: 4px !important; padding-bottom: 4px !important;'`
 * 这种单行多声明，后面那条永远映射不到。
 * 全仓实测漏 10 处；更糟的是棘轮用同一个正则，于是这 10 处它也看不见，
 * **"归零"是个假的零**。
 */
function isCommentAt(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  return /^\s*(\/\/|\*|\/\*)/.test(source.slice(lineStart, offset));
}

const root: string = process.argv[2];
const apply = process.argv.includes('--apply');

if (!root) {
  console.error('用法: node tools/codemod-typography.ts <目录> [--apply]');
  process.exit(2);
}

let totalFont = 0;
let totalSpace = 0;
const perFile: Array<{ file: string; f: number; s: number }> = [];
const samples: string[] = [];

for (const file of walk(root)) {
  const src: string = fs.readFileSync(file, 'utf8');
  let f = 0;
  let s = 0;
  let out = src;

  // lookbehind 挡住 `-` / `@` / `$` / 词字符：不碰 `@xxx-font-size:` 这类 LESS 变量声明（见文件头）
  out = out.replace(/(?<![-\w@$])(font-size:\s*)([^;{}\n]+)/g, (m, head, value, offset, str) => {
    if (isCommentAt(str, offset)) return m;
    const [nv, n] = mapValue(value, FONT, 'font');
    if (n) {
      f += n;
      if (samples.length < 5) samples.push(`${path.relative(root, file)}: font-size:${value.trim()} -> ${nv.trim()}`);
    }
    return head + nv;
  });

  const spaceRe = new RegExp(`(?<![-\\w@$])((?:${SPACE_PROPS}):\\s*)([^;{}\\n]+)`, 'g');
  out = out.replace(spaceRe, (m, head, value, offset, str) => {
    if (isCommentAt(str, offset)) return m;
    const [nv, n] = mapValue(value, SPACE, 'space');
    if (n) {
      s += n;
      if (samples.length >= 5 && samples.length < 10) {
        samples.push(`${path.relative(root, file)}: ${head.trim()}${value.trim()} -> ${head.trim()}${nv.trim()}`);
      }
    }
    return head + nv;
  });

  if (f || s) {
    perFile.push({ file: path.relative(root, file), f, s });
    totalFont += f;
    totalSpace += s;
    if (apply) fs.writeFileSync(file, out);
  }
}

perFile.sort((a, b) => b.f + b.s - (a.f + a.s));
for (const r of perFile.slice(0, 20)) {
  console.log(`  字号 ${String(r.f).padStart(3)}  间距 ${String(r.s).padStart(3)}  ${r.file}`);
}
if (perFile.length > 20) console.log(`  …还有 ${perFile.length - 20} 个文件`);

console.log(`\n合计：字号 ${totalFont} 处、间距 ${totalSpace} 处，涉及 ${perFile.length} 个文件`);
console.log(apply ? '（已写入）' : '（干跑，未写入）');

if (!apply && samples.length) {
  console.log('\n样例：');
  for (const s of samples) console.log('  ' + s);
}
