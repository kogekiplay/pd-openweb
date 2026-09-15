#!/usr/bin/env node
/**
 * 后缀并存不变量检查。
 *
 * 拦的是这一种故障：同一个目录里出现同名不同后缀的模块（如 base.js 与 base.ts）。
 * 此时 webpack 的 resolve.extensions 让 .ts 先命中，而人眼看到的往往是刚更新的 .js，
 * 于是「改了没生效」——构建绿、tsc 绿、没有任何报错。
 *
 * 已知的并存来源是 codegen：scripts/downloadApiZip.js 从远端拉 zip，用 unzip -o
 * 只覆盖不清理，会把已迁移文件的旧 .js 重新吐出来。该脚本已加了后处理，这里是兜底。
 *
 * 全量改名迁移完成时该不变量为 0 违例，是一个干净的起点。
 *
 * ── 第二条不变量（2026-09-15 加）：仓库里不再出现新的 JavaScript ──────────
 * 全仓已经 TS 化：src 的 4000+ 个模块、scripts/ CI/ 的工具链、69 个行为 spec、
 * 两个根配置，一个不剩。剩下的 .js 只有【外部代码和生成物】，逐条列在
 * JS_ALLOWLIST 里，每条都写了是什么、为什么还在。
 *
 * 这条不变量拦的是「回流」：codegen 吐出 .js、从别处拷一个 .js 进来、
 * 新写脚本图省事用 .js —— 这些都不会被任何其它门禁发现，因为 .js 本来就能跑。
 * 没有这道闸，TS 化的成果会一点点被磨掉，而且是无声的。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT_PATH = path.join(__dirname, '..');
const MODULE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);

/**
 * 允许存在 .js 的路径（前缀匹配）。每一条都必须说清楚【是什么】和【为什么不能改】。
 * 往这里加条目之前先问：这真的是外部代码或生成物吗？是我们自己写的就该写 .ts。
 */
const JS_ALLOWLIST = [
  // 预打包的压缩产物（applibrary_v2.js 等单行数 MB），不是可读源码。
  // 门禁的噪声剔除、tsconfig 的 exclude 一直把这里当外部代码处理。
  'src/library/',

  // FullCalendar v2.1.0 的 vendor 副本 + 40 个语言包，供老的独立「日历」页使用
  //（src/pages/calendar/index.tsx）。仓里另外装了 @fullcalendar/* v6 服务工作表
  // 日历视图，是两个不同功能。把这一份换成 v6 是一次【真正的功能迁移】
  //（2.x 是 jQuery 插件式 API，与 v6 完全不同），不是机械改名，单独排期。
  'src/pages/calendar/modules/calendarControl/',

  // iconfont.cn 生成的 SVG symbol 注入脚本，由 scripts/updateIconfont.ts 更新。
  // 改成 .ts 会在下次重新生成时被覆盖回去。
  'src/pages/integration/svgIcon.js',

  // 压缩过的第三方录音库，被 export default function init() 包了一层。
  'src/components/Mingo/ChatBot/components/Recorder/lib.js',

  // 第三方 tinyToast 的 UMD 包，被 scripts/iconViewer/fonticon.html 用
  // <script src> 直接喂浏览器 —— 那个位置放不了 .ts。
  'scripts/iconViewer/lib/toast.js',

  // 翻译产物：由 `bun run lang:build-js`（scripts/lang.ts）从 .po 生成，
  // 每次重新生成都会覆盖，手改没有意义。
  'locale/',

  // 浏览器直接 <script src> 加载的静态资源，全是第三方发行版
  //（vditor / pdfkit / tailwindcss / mathjax / katex / echarts …）。
  // 这些位置只能是 .js，而且它们不进 webpack 编译。
  'staticfiles/',
];

const JS_EXT = new Set(['.js', '.jsx', '.cjs', '.mjs']);

function findStrayJs(files) {
  return files
    .filter(f => JS_EXT.has(path.extname(f)))
    .filter(f => !JS_ALLOWLIST.some(prefix => f.startsWith(prefix)))
    .sort();
}

function listTrackedFiles() {
  // 【扫全仓不只是 src】后缀并存只在 src 有意义，但「不准出现 .js」要管 scripts/
  // CI/ tools/ 和根目录的配置文件 —— 回流最常发生的恰恰是那些地方。
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT_PATH, maxBuffer: 64 * 1024 * 1024 })
    .toString()
    .split('\0')
    .filter(Boolean);
}

function findCollisions(files) {
  const byStem = new Map();
  for (const file of files.filter(f => f.startsWith('src/'))) {
    const ext = path.extname(file);
    if (!MODULE_EXT.has(ext)) continue;
    // .d.ts 是类型声明，与同名 .js 并存是正常且期望的，不算违例
    if (file.endsWith('.d.ts')) continue;
    const stem = file.slice(0, -ext.length);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(ext);
  }
  const collisions = [];
  for (const [stem, exts] of byStem) {
    if (exts.length > 1) collisions.push({ stem, exts: exts.sort() });
  }
  return collisions.sort((a, b) => a.stem.localeCompare(b.stem));
}

function main() {
  const files = listTrackedFiles();

  const strays = findStrayJs(files);
  if (strays.length) {
    console.error(`JavaScript 回流检查失败：${strays.length} 个 .js/.jsx/.cjs/.mjs 不在白名单里。`);
    console.error('全仓已经 TS 化，新文件请直接写 .ts/.tsx。');
    console.error('确实是外部代码或生成物的，把它加进 scripts/checkExtensionCollisions.ts');
    console.error('的 JS_ALLOWLIST，并写清楚是什么、为什么不能改。\n');
    for (const f of strays.slice(0, 40)) console.error(`  ${f}`);
    if (strays.length > 40) console.error(`  …还有 ${strays.length - 40} 个`);
    process.exit(1);
  }

  const collisions = findCollisions(files);
  if (!collisions.length) {
    console.log(`后缀检查通过：无同名不同后缀的模块；无白名单外的 JavaScript（扫了 ${files.length} 个文件）。`);
    return;
  }
  console.error(`后缀并存检查失败：${collisions.length} 处同名不同后缀。`);
  console.error('这些文件会互相遮蔽，构建不会报错但可能跑的是旧代码。请删掉多余的那一个。');
  for (const { stem, exts } of collisions) {
    console.error(`  ${stem} -> ${exts.join(' + ')}`);
  }
  process.exit(1);
}

if (require.main === module) main();

module.exports = { findCollisions, findStrayJs, JS_ALLOWLIST };
