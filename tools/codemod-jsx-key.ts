/**
 * 给「列表里缺 key 的 JSX」补 key。输入是 eslint react/jsx-key 的命中清单（file:line:col）。
 *
 * 【为什么统一补下标而不是 item.id】没有 key 时 React 本来就按下标对齐子节点，
 * 所以 key={下标} 与现状【逐位等价】，只是不再警告。换成 item.id 之类会改变协调行为
 * （重排时状态跟着 id 走而不是跟着位置走），而且没法静态保证唯一 —— 撞 key 比缺 key 更糟。
 * 真需要按 id 协调的列表（可拖拽排序、会插删的有状态行）应当逐个人工改，不在这个 codemod 里。
 *
 * 处理的几种情形：
 *   - 迭代回调里的元素：取回调的第二个参数；没有就补一个，名字避开回调体里已经出现过的标识符，
 *     免得遮蔽外层同名变量改掉行为。单参数箭头函数没括号的要补括号。
 *   - 数组字面量里的元素：key 取它在数组里的位置（字符串字面量）。
 *   - <>…</> 片段：换成 <Fragment key={…}>…</Fragment>，按需补 import。
 *
 * 解析走 @babel/core 的 parseSync + 仓库 .babelrc，与真实构建看到的语法完全一致
 * （本仓 preset-react 给所有文件开 JSX，.ts 里 <T>() => 这类写法 tsc 认、babel 不认）。
 *
 * 用法：node tools/codemod-jsx-key.ts < 命中清单   （每行 "path:line:col"）
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

const hits = fs
  .readFileSync(0, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => {
    const m = l.match(/^(.+?):(\d+):(\d+)$/);
    if (!m) throw new Error(`无法解析命中行：${l}`);
    return { file: m[1], line: +m[2], col: +m[3] };
  });

const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

const FUNC = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/* 只认真正的迭代调用，并且回调必须在它规定的实参位置上。
   【为什么要这么严】「往上找最近的、作为调用实参的函数」会找错层：
   arr.map(item => cond && wrap(() => <X />)) 里最近的是 wrap 的回调，给它补一个下标参数，
   实际收到的是 wrap 传进来的东西。认不出的一律跳过、留给人工。
   这几种迭代的第二个参数都是位置（或对象的键），在同一次渲染里天然唯一。 */
function iteratorCallbackIndex(call) {
  const c = call.callee;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
    const prop = c.property.name;
    const obj = c.object;
    // arr.map(fn) / arr.flatMap(fn)
    if (prop === 'map' || prop === 'flatMap') {
      // _.map(coll, fn) 与 lodash.map(coll, fn)
      if (obj.type === 'Identifier' && (obj.name === '_' || obj.name === 'lodash')) return 1;
      // React.Children.map(children, fn)
      if (obj.type === 'MemberExpression' && obj.property && obj.property.name === 'Children') return 1;
      return 0;
    }
    // Array.from(x, fn)
    if (prop === 'from' && obj.type === 'Identifier' && obj.name === 'Array') return 1;
  }
  // 具名导入的 map(coll, fn)
  if (c.type === 'Identifier' && c.name === 'map') return 1;
  return -1;
}

/* 这个数组（map 的结果或数组字面量）会不会和别的列表并进【同一个】数组？
   会的话各自的下标 key 就在同一个命名空间里撞：[<td key="0"/>].concat(list.map((c, i) => <th key={i}/>))
   合并后 "0" 与 0 字符串化相同。原先没有 key 时 React 按合并后数组的位置对齐，反而不撞 ——
   所以这种情形补下标会把「缺 key」变成「撞 key」，一律跳过交给人工。
   JSX 里并排的 {a.map()}{b.map()} 不算：它们是各自独立的嵌套数组，key 各自一个命名空间。 */
function mergesIntoAnotherList(arrPath) {
  const parent = arrPath.parentPath;
  if (!parent) return false;
  const pn = parent.node;
  // list.concat(...) 里作为接收者
  if (parent.isMemberExpression() && pn.object === arrPath.node && pn.property && pn.property.name === 'concat') return true;
  // x.concat(list) 里作为实参
  if (parent.isCallExpression() && pn.arguments.includes(arrPath.node)) {
    const cal = pn.callee;
    if (cal.type === 'MemberExpression' && cal.property && cal.property.name === 'concat') return true;
  }
  // [...list] 展开进别的数组
  if (parent.isSpreadElement()) return true;
  return false;
}

/* list.map(...).filter(Boolean).slice(0, 3).concat(...)：合并发生在链的末端，
   要顺着链式调用往上走到头（遇到 concat 就停在它前面），再交给 mergesIntoAnotherList 判断。 */
function chainTop(callPath) {
  let cur = callPath;
  while (
    cur.parentPath &&
    cur.parentPath.isMemberExpression() &&
    cur.parentPath.node.object === cur.node &&
    cur.parentPath.node.property &&
    cur.parentPath.node.property.name !== 'concat' &&
    cur.parentPath.parentPath &&
    cur.parentPath.parentPath.isCallExpression() &&
    cur.parentPath.parentPath.node.callee === cur.parentPath.node
  ) {
    cur = cur.parentPath.parentPath;
  }
  return cur;
}
interface Edit {
  start: number;
  end: number;
  text: string;
}

const stats = { files: 0, iterator: 0, array: 0, fragment: 0, addedParam: 0, skipped: [] as string[] };

for (const [file, list] of byFile) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = babel.parseSync(code, { filename: path.resolve(file), babelrc: true, sourceType: 'module' });
  const edits: Edit[] = []; // 替换 [start,end) 为 text；插入时 start===end
  const paramAdded = new Map(); // 同一个回调只补一次参数：fnNode -> name
  let needFragmentImport = false;

  // 按位置索引所有 JSX 元素 / 片段
  const jsxAt = new Map();
  traverse(ast, {
    'JSXElement|JSXFragment'(p) {
      jsxAt.set(`${p.node.loc.start.line}:${p.node.loc.start.column + 1}`, p);
    },
  });

  const pickName = (fnPath) => {
    const used = new Set();
    fnPath.traverse({ Identifier(p) { used.add(p.node.name); } });
    for (const n of fnPath.node.params) if (n.type === 'Identifier') used.add(n.name);
    for (const cand of ['index', 'idx', 'keyIndex', '__keyIndex']) if (!used.has(cand)) return cand;
    throw new Error('找不到可用的下标参数名');
  };

  for (const h of list) {
    const p = jsxAt.get(`${h.line}:${h.col}`);
    if (!p) { stats.skipped.push(`${file}:${h.line}:${h.col} 定位不到 JSX 节点`); continue; }

    // 情形一：数组字面量里的元素
    let keyExpr = null;
    if (p.parentPath && p.parentPath.isArrayExpression()) {
      if (mergesIntoAnotherList(p.parentPath)) { stats.skipped.push(`${file}:${h.line}:${h.col} 数组字面量会与别的列表合并，下标 key 会撞`); continue; }
      const pos = p.parentPath.node.elements.indexOf(p.node);
      keyExpr = `"${pos}"`;
      stats.array++;
    } else {
      // 情形二：迭代回调 —— 往上找最近的、作为调用实参的函数
      let fnPath = p.parentPath;
      while (fnPath && !(FUNC.has(fnPath.node.type) && fnPath.parentPath && fnPath.parentPath.isCallExpression() && fnPath.parentPath.node.arguments.includes(fnPath.node))) {
        fnPath = fnPath.parentPath;
      }
      if (!fnPath) { stats.skipped.push(`${file}:${h.line}:${h.col} 找不到迭代回调`); continue; }
      const call = fnPath.parentPath.node;
      const expectAt = iteratorCallbackIndex(call);
      if (expectAt < 0 || call.arguments[expectAt] !== fnPath.node) {
        stats.skipped.push(`${file}:${h.line}:${h.col} 最近的回调不属于认得的迭代调用（${code.slice(call.callee.start, call.callee.end).slice(0, 40)}）`);
        continue;
      }
      if (mergesIntoAnotherList(chainTop(fnPath.parentPath))) {
        stats.skipped.push(`${file}:${h.line}:${h.col} 这个列表会与别的列表合并（concat / 展开），下标 key 会撞`);
        continue;
      }
      const fn = fnPath.node;
      if (fn.params.length >= 2 && fn.params[1].type === 'Identifier') {
        keyExpr = fn.params[1].name;
      } else if (fn.params.length >= 2) {
        stats.skipped.push(`${file}:${h.line}:${h.col} 第二个参数不是简单标识符`); continue;
      } else if (paramAdded.has(fn)) {
        keyExpr = paramAdded.get(fn);
      } else {
        const name = pickName(fnPath);
        paramAdded.set(fn, name);
        keyExpr = name;
        stats.addedParam++;
        if (fn.params.length === 1) {
          const prm = fn.params[0];
          // 单参数箭头函数可能没括号：item => ...，要改成 (item, index) => ...
          const before = code.slice(fn.start, prm.start);
          const hasParen = before.includes('(');
          if (hasParen) edits.push({ start: prm.end, end: prm.end, text: `, ${name}` });
          else edits.push({ start: prm.start, end: prm.end, text: `(${code.slice(prm.start, prm.end)}, ${name})` });
        } else {
          // 零参数：() => ... 或 function () ...，补成 (_item, index)
          const open = code.indexOf('(', fn.start);
          edits.push({ start: open + 1, end: open + 1, text: `_item, ${name}` });
        }
      }
      stats.iterator++;
    }

    if (p.node.type === 'JSXFragment') {
      const o = p.node.openingFragment, c = p.node.closingFragment;
      edits.push({ start: o.start, end: o.end, text: `<Fragment key={${keyExpr}}>` });
      edits.push({ start: c.start, end: c.end, text: '</Fragment>' });
      needFragmentImport = true;
      stats.fragment++;
    } else {
      const nameNode = p.node.openingElement.name;
      edits.push({ start: nameNode.end, end: nameNode.end, text: ` key={${keyExpr}}` });
    }
  }

  let out = code;
  // 从后往前应用，位置不会互相错动
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  if (needFragmentImport && !/\bFragment\b[^\n]*from 'react'/.test(out) && !/import React,\s*\{[^}]*\bFragment\b/.test(out)) {
    if (/^import React, \{/m.test(out)) out = out.replace(/^import React, \{/m, 'import React, { Fragment,');
    else if (/^import React from 'react';/m.test(out)) out = out.replace(/^import React from 'react';/m, "import React, { Fragment } from 'react';");
    else if (/^import \{([^}]*)\} from 'react';/m.test(out)) out = out.replace(/^import \{([^}]*)\} from 'react';/m, (_, g) => `import {${g}, Fragment } from 'react';`);
    else out = `import { Fragment } from 'react';\n` + out;
  }

  if (out !== code) { fs.writeFileSync(file, out); stats.files++; }
}

console.log(`改了 ${stats.files} 个文件：迭代 ${stats.iterator} 处（其中补参数 ${stats.addedParam}）、数组字面量 ${stats.array} 处、片段 ${stats.fragment} 处`);
if (stats.skipped.length) console.log(`跳过 ${stats.skipped.length} 处（需人工）：\n  ` + stats.skipped.join('\n  '));
