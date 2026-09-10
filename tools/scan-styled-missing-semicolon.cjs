/**
 * 扫描 styled-components 模板里【漏写分号】的声明。
 *
 * 为什么要有这个：styled-components 4.4.1 内部是 stylis 3，它会把
 *   color: #732ED1        <- 漏了分号
 *   background: #732ED112;
 * 这种写法「修复」成两条正常声明；而 6.5.3 内部的 stylis 4 不修，原样输出
 *   color:#732ED1 background:#732ED112;
 * 浏览器会把这条非法声明整条丢弃 —— 结果是 color 和 background 【一起失效】。
 *
 * 也就是说：这是源码里本来就有的 bug，只是被旧版 CSS 编译器一直遮着。
 * 它不报错、不进控制台，升级 styled-components 时才会突然显形，
 * 所以升级前必须先把这类写法清干净。
 *
 * 用法: node tools/scan-styled-missing-semicolon.cjs
 * 退出码非 0 表示有命中。
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);

    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'library') continue;

      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(p);
    }
  }

  return out;
}

// 定位 styled/css/keyframes/createGlobalStyle 的模板字面量。
// 这里【允许】内部含 ${}，因为带插值的模板同样会踩这个坑
//（差分脚本只覆盖了无插值的那批，所以这个扫描不能也跳过它们）。
const TPL_START = /(?:styled\.[a-zA-Z][a-zA-Z0-9]*|styled\([^)]*\)|css|keyframes|createGlobalStyle)`/g;

function templates(src) {
  const out = [];
  let m;

  while ((m = TPL_START.exec(src)) !== null) {
    // 从起始反引号往后找配对的反引号，跳过 \` 转义与 ${...} 里的嵌套反引号
    let i = m.index + m[0].length;
    let depth = 0;
    const start = i;

    while (i < src.length) {
      const c = src[i];

      if (c === '\\') {
        i += 2;
        continue;
      }

      if (c === '$' && src[i + 1] === '{') {
        depth++;
        i += 2;
        continue;
      }

      if (c === '}' && depth > 0) {
        depth--;
        i++;
        continue;
      }

      if (c === '`' && depth === 0) break;

      i++;
    }

    out.push({ start, body: src.slice(start, i) });
    TPL_START.lastIndex = i;
  }

  return out;
}

// 一条声明：`prop: value`，且行尾不是 ; { } , 或运算符续行
const DECL_NO_SEMI = /^\s*(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*(\S.*?)\s*$/;
// 下一行看起来还是 CSS 内容（声明 / 嵌套选择器 / 插值），而不是块结束
const NEXT_IS_CONTENT = /^\s*(?:[-a-zA-Z][a-zA-Z0-9-]*\s*:|[&.#>+~[a-zA-Z*]|\$\{|@)/;

const hits = [];

for (const file of walk(RW + 'src')) {
  const src = fs.readFileSync(file, 'utf8');
  const before = src.slice(0, src.length);

  for (const tpl of templates(src)) {
    const lines = tpl.body.split('\n');
    // 模板起始处的行号
    const baseLine = before.slice(0, tpl.start).split('\n').length;

    // 行尾注释必须先剥掉再判断，否则 `min-height: 640px; //最小高度`
    // 会因为「行尾不是分号」被误报。
    const decomment = s => s.replace(/\/\*[^*]*\*\/\s*$/, '').replace(/\/\/.*$/, '');

    for (let i = 0; i < lines.length - 1; i++) {
      const raw = lines[i];
      const line = decomment(raw);

      // 已有分号 / 是选择器行 / 是块边界 / 是注释 —— 都跳过
      if (/[;{},]\s*$/.test(line)) continue;

      if (/^\s*(?:\/\/|\/\*|\*)/.test(raw)) continue;

      if (!line.trim()) continue;

      const d = DECL_NO_SEMI.exec(line);

      if (!d) continue;

      // 值里带未闭合的括号说明是跨行的值（如多行 linear-gradient），不算漏分号
      const opens = (d[2].match(/\(/g) || []).length;
      const closes = (d[2].match(/\)/g) || []).length;

      if (opens !== closes) continue;

      // 未闭合的 ${...}：这是【跨多行的插值】，声明其实在后面几行才结束，
      // 不是漏分号。这是本扫描最主要的误报来源（占初版 28 处命中的一半以上）。
      // 必须数【所有】花括号，不能只数 `${`：
      //   border-top: ${({ activeBorder }) =>
      // 里 `${` 一个、`({` 里的 `{` 一个、`})` 里的 `}` 一个 —— 只数 `${` vs `}`
      // 会误判成配平，从而漏掉这个跳过条件。
      if ((d[2].match(/\{/g) || []).length !== (d[2].match(/\}/g) || []).length) continue;

      // 伪类/伪元素选择器（`&:hover` 这种也会匹配 prop:value 的形状）要排除
      if (/^\s*[&.#>+~[*]/.test(line)) continue;

      // 找下一条非空行
      let j = i + 1;

      while (j < lines.length && !lines[j].trim()) j++;

      if (j >= lines.length) continue;

      const next = lines[j];

      // 下一行是 } 说明这是块内最后一条声明，CSS 允许省略分号，stylis 4 也能正确处理
      if (/^\s*\}/.test(next)) continue;

      // 下一行以 ${ 开头：多半是【值的续行】而不是新声明，例如
      //   border: 1px solid
      //     ${({ borderColor }) => ...};
      // 保守跳过（宁可漏报也不误报——误报会把人引到没问题的代码上）。
      // 代价是：如果真有「漏分号 + 下一行是独立 ${mixin}」的写法，这里会漏掉。
      if (/^\s*\$\{/.test(next)) continue;

      if (!NEXT_IS_CONTENT.test(next)) continue;

      hits.push({
        file: path.relative(RW, file),
        line: baseLine + i,
        text: line.trim(),
        next: next.trim(),
      });
    }
  }
}

if (!hits.length) {
  console.log('未发现漏分号的 styled 声明。');
  process.exit(0);
}

console.log(`发现 ${hits.length} 处漏分号的 styled 声明：\n`);
for (const h of hits) {
  console.log(`  ${h.file}:${h.line}`);
  console.log(`    ${h.text}      <- 缺 ;`);
  console.log(`    ${h.next.slice(0, 70)}`);
}
console.log(
  '\n这些在 styled-components 4（stylis 3）下被静默修复，' +
    '升到 6（stylis 4）后浏览器会把该条与相邻声明【一起丢弃】。',
);
process.exit(1);
