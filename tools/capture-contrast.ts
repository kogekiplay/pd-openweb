/**
 * 把 tools/contrast-probe.ts 变成可以直接粘进浏览器控制台的一段源码。
 *
 *   node tools/capture-contrast.ts          # 打到 stdout
 *   node tools/capture-contrast.ts --clip   # 直接进剪贴板（macOS）
 *
 * 和 capture-geometry.ts 是同一套路、同一理由 —— 探针文件是 .ts（为了进类型门禁），
 * 开头有 `export`、结尾没有调用，直接粘是语法错。
 *
 * 【没有 --sink】对比度结果通常只有几条到几十条，控制台回显就够看；
 * 几何快照是一千多个元素、500KB，那才需要接收端落盘。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROBE = path.join(__dirname, 'contrast-probe.ts');
const source: string = fs.readFileSync(PROBE, 'utf8');

// 探针必须是纯 JS 语法。这里挡两类最容易手滑写进去的 TS：类型标注和类型断言。
// 【为什么值得单列一道检查】两样都能过类型门禁，只在粘进控制台那一刻才炸，
// 而且报的是干巴巴的 SyntaxError，不会告诉你是哪一行、更不会说"你写了 TS"。
const stripped: string = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const tsSyntax: Array<[RegExp, string]> = [
  [/:\s*(string|number|boolean|any|void|unknown|Record<)/, '类型标注'],
  [/\bas\s+(any|unknown|const|[A-Z][A-Za-z]*)\b/, '类型断言'],
];
for (const [re, what] of tsSyntax) {
  const m = stripped.match(re);
  if (m) {
    console.error(`探针里出现了${what}（${m[0]}）—— 粘进控制台会语法错。去掉它，别在这里加转译。`);
    process.exit(1);
  }
}

const payload =
  source.replace(/^export\s+function/m, 'function').trimEnd() +
  `

const __hits = captureContrast();
// 按「字色」归类：同一个色出现几十次，多半是某个 token 的档位或用法问题，
// 而不是几十个独立 bug。先看归类再看明细。
const __byColor = {};
for (const h of __hits) __byColor[h.色] = (__byColor[h.色] || 0) + 1;
({ 路由: location.pathname, 低对比总数: __hits.length, 按字色归类: __byColor, 最差十条: __hits.slice(0, 10) });
`;

if (process.argv.includes('--clip')) {
  execSync('pbcopy', { input: payload });
  console.error(`已复制到剪贴板（${payload.length} 字符）。在目标页面控制台粘贴执行。`);
} else {
  process.stdout.write(payload);
}
