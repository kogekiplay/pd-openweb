/**
 * 调研：按 propTypes 生成 TS 接口这条路，能覆盖到多少组件（只统计，不改文件）。
 *
 * 背景：全量 strict 下 TS7006「参数隐式 any」约 4 万条，参数名里 props 占 3359 个 ——
 * 都是没标类型的 React 组件 props。本仓有 694 个组件声明了 propTypes，
 * 那是【现成的、写在源码里的】类型来源，比从使用点反推可靠得多。
 *
 * 但不能直接套 InferProps：
 *   PropTypes.object / shape({})  → InferProps 给出 object，没有任何属性，
 *                                   读 props.advancedSetting.xxx 立刻报 TS2339（反而新增诊断）
 *   PropTypes.any                 → 原样保留 any，与"去 any"的目标相悖
 * 所以要【生成显式接口】并对这几类单独映射。本脚本先量清各类占比和可达范围。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// 能直接映射成有用 TS 类型的
const GOOD = /PropTypes\.(string|number|bool|func|node|element|elementType|symbol|arrayOf|oneOf|oneOfType|objectOf|instanceOf|exact)\b/;
// 会退化成 object / any[] / any 的
const WEAK = /PropTypes\.(any|object|array)\b/;
const EMPTY_SHAPE = /PropTypes\.shape\(\s*\{\s*\}\s*\)/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

// 粗取 propTypes 对象字面量的文本（从 propTypes = { 到配对的 }）
function extractPropTypesBlock(src) {
  const m = src.match(/(?:static\s+propTypes|\b[A-Za-z_$][\w$]*\.propTypes)\s*=\s*\{/);
  if (!m) return null;
  const start = src.indexOf('{', m.index);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

let withPropTypes = 0;
let allGood = 0;
let hasWeak = 0;
const weakCounter = {};
const cleanFiles = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const block = extractPropTypesBlock(src);
  if (!block) continue;
  withPropTypes++;

  const weakHits = [...block.matchAll(new RegExp(WEAK, 'g'))].map(x => x[1]);
  const emptyShape = EMPTY_SHAPE.test(block);

  if (emptyShape) weakHits.push('shape({})');

  for (const w of weakHits) weakCounter[w] = (weakCounter[w] || 0) + 1;

  if (!weakHits.length && GOOD.test(block)) {
    allGood++;
    cleanFiles.push(path.relative(ROOT, file));
  } else if (weakHits.length) {
    hasWeak++;
  }
}

console.log(`声明了 propTypes 的组件文件：${withPropTypes}`);
console.log(`  其中【全部可映射】（无 any/object/array/shape({})）：${allGood}`);
console.log(`  含有退化类型、需要人工决定：${hasWeak}`);
console.log('\n退化类型出现的文件数：');
Object.entries(weakCounter)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v}`));

console.log('\n可直接生成接口的前 15 个文件：');
cleanFiles.slice(0, 15).forEach(f => console.log('  ' + f));
