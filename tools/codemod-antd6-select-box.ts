/*
 * antd 6：Select 的「盒子」从内层挪到了根节点，且全部改由 CSS 变量驱动。
 *
 *   v5  .ant-select 只是个壳；边框/底色/圆角画在 .ant-select-selector 上，
 *       箭头 .ant-select-arrow 是绝对定位盖上去的，所以画在内层没问题。
 *   v6  .ant-select-selector 改名 .ant-select-content 且【只剩内容行】；
 *       边框/底色/圆角/内边距/高度全部上移到根节点 .ant-select，由
 *       --ant-select-border-color / -border-size / -background-color / -border-radius
 *       等自定义属性驱动（antd/es/select/style/select-input.js:60 起）。
 *       .ant-select-suffix / .ant-select-clear 也变成了 content 的兄弟、同在根节点里。
 *
 * 于是本仓按 v5 写的规则有两种症状：
 *   border: none/0 → 内层本来就没边框，这条成了空操作，antd 根节点的边框冒出来
 *   border: 1px …  → 双层框（antd 的框套我们的框，箭头夹在两层中间）
 *   只写 border-color / background-color → 颜色落在没有边框的内层上，白给
 *
 * 本脚本把这些「画盒子」的声明从 .ant-select-content 块里搬到根节点，写成变量。
 *
 * 【为什么不用重写选择器】CSS 自定义属性是继承的：设在 select 的任意祖先上都能取到。
 * 所以把选择器末尾的 .ant-select-content 去掉即可 —— 原规则本来就是
 * 「这个祖先底下的 select」这个语义，一字不差。
 *
 * 【为什么补 &.ant-select, & .ant-select】两个理由：
 *  1. 语义：光看选择器判断不了末尾那个类是挂在 select 自己身上还是外层容器上。
 *     两种都发一条，命中的那条对、另一条匹配不到任何元素，天然安全。
 *  2. 特异性：antd 是在 `.ant-select.ant-select-outlined` (0,2,0) 上给这些变量赋值的。
 *     只剩一个祖先类是 (0,1,0)，会被它盖掉。这个坑在 customAntSelect 上踩过一次，
 *     现象极具迷惑性：同一个块里 border-radius / padding-horizontal 生效了，
 *     偏偏 border-color 和 background-color 不生效 —— 因为后两个 antd 在变体规则上
 *     又赋了一次，而前两个只在 (0,1,0) 的 .ant-select 上给默认值。
 *     补一个 .ant-select 凑到 (0,2,0) 打平即可：我们的样式表在 antd 之后
 *     （antd 走 rc-util prependQueue 插到 <head> 最前），平手时后者胜。
 *
 * 【纯 CSS 文件没有 &】basic.css 这类顶层规则不能用 &，改写成 .ant-select.ant-select
 * —— 重复一次类名把特异性顶到 (0,2,0)，同一个目的。
 */
const fs = require('fs');
const path = require('path');

const apply = process.argv.includes('--apply');

// 这三个文件本轮已经手工按 v6 改过（且有意把某些属性留在内层，例如把
// .ant-select-content 的底色显式设成 transparent），脚本再扫会把手改的意图抹掉。
const HAND_MIGRATED = new Set([
  'src/components/Form/DesktopForm/style.less',
  'src/common/mdcss/themes/antd-color.less',
  'src/ming-ui/components/less/Modal.less',
]);

const BOX_PROPS = /^(border|border-color|border-radius|background|background-color|box-shadow)$/i;

function mapDecl(prop, value, bang) {
  const imp = bang ? ' !important' : '';
  const v = value.trim();
  switch (prop) {
    case 'border':
      if (/^(none|0(px)?)$/i.test(v)) return [`--ant-select-border-size: 0${imp};`];
      {
        const m = v.match(/^([\d.]+px)\s+[a-z]+\s+(.+)$/i);
        if (m) return [`--ant-select-border-size: ${m[1]}${imp};`, `--ant-select-border-color: ${m[2]}${imp};`];
      }
      return null;
    case 'border-color':
      return [`--ant-select-border-color: ${v}${imp};`];
    case 'border-radius':
      return [`--ant-select-border-radius: ${v}${imp};`];
    case 'background':
    case 'background-color':
      return [`--ant-select-background-color: ${v}${imp};`];
    case 'box-shadow':
      return [`box-shadow: ${v}${imp};`]; // 根节点上的普通属性，不是变量
    default:
      return null;
  }
}

function transformSelector(fullSel, topLevel) {
  const parts = fullSel.split(',').map(s => s.trim()).filter(Boolean);
  const selectParts = parts.filter(p => /\.ant-select-content$/.test(p));
  const otherParts = parts.filter(p => !/\.ant-select-content$/.test(p));
  if (!selectParts.length) return null;
  const outParts = [];
  for (const p of selectParts) {
    const head = p.replace(/\s*\.ant-select-content$/, '').trim();
    if (head === '' || head === '&') {
      if (topLevel) outParts.push('.ant-select.ant-select');
      else outParts.push('&.ant-select', '& .ant-select');
      continue;
    }
    const last = head.split(/\s+/).pop() || '';
    if (/\.ant-select(?![-\w])/.test(last)) outParts.push(head);
    else outParts.push(`${head}.ant-select`, `${head} .ant-select`);
  }
  return { sel: [...new Set(outParts)], otherParts };
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'library') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(less|css|ts|tsx)$/.test(e.name)) files.push(p);
  }
})('src');

let blockCount = 0, declCount = 0;
const skipped = [];
const changedFiles = [];

for (const file of files) {
  if (HAND_MIGRATED.has(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!/\.ant-select-content(?![-\w])/.test(src)) continue;

  const lines = src.split('\n');
  const out = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = line.match(/^(\s*)(.*?)\{\s*$/);
    if (!header || !/\.ant-select-content(?![-\w])/.test(header[2])) { out.push(line); continue; }

    // 选择器可能跨行 —— 两种跨法都要收回来：
    //   a) 逗号分隔的选择器列表，每行以 , 结尾
    //   b) prettier 把一条过长的后代选择器折行了，上一行【不以 , 结尾】
    //      （basic.css 里就有这种：`.mdAntSelect.ant-select-focused…(no comma)` 换行
    //       再接 `.ant-select-content {`）。第一版漏了 b，结果把上一行原样留在了输出里，
    //       生成出 `选择器 &.ant-select, & .ant-select {` 这种废话，纯 CSS 里还多了个 &。
    const isSelectorContinuation = l => {
      const t = l.trim();
      if (t === '') return false;
      if (/[{};]$/.test(t)) return false;
      if (t.startsWith('/*') || t.startsWith('*') || t.startsWith('//')) return false;
      return true;
    };
    const selLines = [header[2]];
    let back = 0;
    while (out.length - back > 0 && isSelectorContinuation(out[out.length - 1 - back])) {
      selLines.unshift(out[out.length - 1 - back]);
      back++;
    }
    const indent = back > 0 ? (out[out.length - back].match(/^\s*/) || [''])[0] : header[1];
    const fullSel = selLines.join(' ').replace(/\s+/g, ' ').trim();

    // 找块尾
    let depth = 1, j = i + 1;
    const body = [];
    while (j < lines.length && depth > 0) {
      const d = (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
      if (depth + d === 0) break;
      depth += d;
      body.push(lines[j]);
      j++;
    }
    if (j >= lines.length) { out.push(line); continue; }

    const t = transformSelector(fullSel, indent.length === 0);
    const hoisted = [];
    const hoistedRaw = [];
    const kept = [];
    let bail = false;
    for (const b of body) {
      const dm = b.match(/^(\s*)([a-z-]+)\s*:\s*([^;]+?)(\s*!important)?\s*;\s*$/i);
      if (!dm) { kept.push(b); continue; }
      if (!BOX_PROPS.test(dm[2])) { kept.push(b); continue; }
      const mapped = mapDecl(dm[2].toLowerCase(), dm[3], !!dm[4]);
      if (mapped) { hoisted.push(...mapped.map(x => indent + '  ' + x)); hoistedRaw.push(b); }
      else { bail = true; kept.push(b); }
    }

    if (!hoisted.length || !t || bail) {
      if (hoisted.length) skipped.push(`${file}:${i + 1}  ${fullSel.slice(0, 78)}`);
      out.push(line);
      continue;
    }

    // 先把已经写进 out 的那几行选择器收回
    for (let k = 0; k < back; k++) out.pop();

    blockCount++; declCount += hoisted.length; changed = true;

    out.push(t.sel.map(s => indent + s).join(',\n') + ' {');
    out.push(...hoisted);
    out.push(indent + '}');

    // 选择器里还有非 select 的片段（input[type=text], .xxx, .ant-select-content 写在一起）：
    // 原规则保留给它们，盒子属性照旧留在原处，只是不再带 .ant-select-content 那一段。
    if (t.otherParts.length) {
      out.push(t.otherParts.map(s => indent + s).join(',\n') + ' {');
      out.push(...hoistedRaw, ...kept);
      out.push(indent + '}');
    } else if (kept.some(k => k.trim() !== '')) {
      out.push(line);
      out.push(...kept);
      out.push(lines[j]);
    }
    i = j;
  }

  if (changed) {
    changedFiles.push(file);
    if (apply) fs.writeFileSync(file, out.join('\n'));
  }
}

console.log(apply ? '=== 已写入 ===' : '=== 试运行（加 --apply 才写盘）===');
console.log(`改写块 ${blockCount} | 搬走声明 ${declCount} | 文件 ${changedFiles.length}`);
console.log(`\n未自动处理（人工看）：${skipped.length}`);
skipped.forEach(s => console.log('  ' + s));
