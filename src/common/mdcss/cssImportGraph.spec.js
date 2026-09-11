/**
 * 从 .css 文件 @import 进来的 .less，【不能写 `//` 注释】。
 *
 * 起因是一次真实的自伤：给 src/common/mdcss/themes/antd-color.less 加了几行
 * `//` 说明，整个 dev server 立刻构建失败：
 *   Module build failed (from ./node_modules/css-loader/dist/cjs.js):
 *   SyntaxError (192:16) Unknown word .ant-popover-arrow-content
 * 现象很唬人 —— 全站主题样式整条消失，左侧导航被挤成一列竖排文字、
 * 公司名一个字一行，看着像布局组件炸了，其实只是一个样式模块没编译出来。
 *
 * 【为什么这些 .less 不走 less-loader】
 * webpack 对 `.less` 的规则只作用于「被 JS/TS import 的 .less」。而
 * src/common/mdcss/basic.css 是 .css，它里面的 `@import './themes/global.less'`
 * 由 css-loader 自己解析，链路上的文件一律按【纯 CSS】交给 postcss ——
 * 嵌套规则 postcss 认（原生 CSS 嵌套），但 `//` 不是合法 CSS，当场报 Unknown word。
 * 同一个目录下、被 tsx import 的 .less 写 `//` 完全没问题，所以这事很反直觉：
 * 是不是合法取决于【这个文件被谁引进来】，而不是它的后缀。
 *
 * 【为什么 less.render 验不出来】
 * 我当时用 `less.render()` 单独编译了这几个文件，四个全过 —— 因为那是 LESS 编译器，
 * 而这条链路上根本没有 LESS 编译器。用错了验证工具，比没验证更危险：
 * 它给了一个「已验证」的假信号。要验就得走真实的 webpack 链路，或者像本 spec 这样
 * 直接把「这些文件按纯 CSS 解析」这个约束钉死。
 *
 * 修法：这些文件里一律用 /* *\/ 注释（LESS 和 CSS 都合法，两条链路都安全）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../../../scripts/spec-harness');

const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;

function collectCssRoots(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collectCssRoots(abs, out);
    } else if (entry.name.endsWith('.css')) {
      out.push(abs);
    }
  }

  return out;
}

// 从每个 .css 出发，沿 @import 传递闭包收集 —— 这些全部按纯 CSS 解析
function resolveImport(from, spec) {
  const base = path.resolve(path.dirname(from), spec);

  for (const candidate of [base, `${base}.less`, `${base}.css`]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }

  return null;
}

const graph = new Set();
const queue = collectCssRoots(path.join(ROOT, 'src'));

while (queue.length) {
  const file = queue.pop();

  if (graph.has(file)) continue;

  graph.add(file);

  for (const m of fs.readFileSync(file, 'utf8').matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) {
    const target = resolveImport(file, m[1]);

    if (target) queue.push(target);
  }
}

// 下限断言：主题那几个 .less 必须在图里，否则是 @import 解析坏了而不是「图是空的」
const lessInGraph = [...graph].filter(f => f.endsWith('.less'));

assert.ok(
  lessInGraph.some(f => f.endsWith('themes/antd-color.less')),
  '没在 @import 图里找到 themes/antd-color.less —— @import 解析逻辑大概率坏了，' +
    `当前图里只有 ${graph.size} 个文件、${lessInGraph.length} 个 .less`,
);

// `//` 只在行首/空白后才算注释，免得把 url(https://...) 误判
const offenders = [];

for (const file of [...graph].sort()) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 60)}`);
  });
}

assert.deepStrictEqual(
  offenders,
  [],
  '这些文件是从 .css 经 @import 进来的，由 css-loader 按纯 CSS 交给 postcss 解析，' +
    '`//` 不是合法 CSS，会让整个样式模块构建失败（全站主题样式消失）。改用 /* */：\n  ' +
    offenders.join('\n  '),
);

console.log(`css @import graph tests passed（图中 ${graph.size} 个文件，其中 ${lessInGraph.length} 个 .less）`);
