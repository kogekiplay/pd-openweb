/**
 * 回调 ref 去掉返回值（React 19），一次性工具。
 *
 *   ref={el => (this.el = el)}      →  ref={el => { this.el = el; }}
 *
 * 为什么必须改 —— 这【不是】类型洁癖，是运行时语义变了：
 * React 19 让回调 ref 可以返回一个【清理函数】（卸载时调用），于是「返回值」
 * 第一次有了含义。而箭头函数的简写体会把表达式的值返回出去，
 * `el => (this.el = el)` 返回的是被赋的那个 DOM 节点。React 19 会把这个非函数
 * 返回值判为误用并报错（"Ref callbacks must not return a value"）；
 * 如果返回的恰好是个函数，还会被当成 cleanup 在卸载时调用，后果更隐蔽。
 * 类型上表现为 TS2322：
 *   Type '(el: HTMLSpanElement) => HTMLSpanElement' is not assignable to type 'Ref<HTMLSpanElement>'
 *
 * 做法：babel 只负责【定位】，改写用源码区间手术。
 * 不走 @babel/generator —— 那会按 babel 自己的风格重排整个文件，几百个文件的
 * 无关格式变动会把这次改动的 diff 彻底淹掉（本仓 antd select 那次已经踩过）。
 * 同一文件内多处改写按【从后往前】应用，否则前面的替换会让后面的 start/end 失效。
 *
 * 只处理 body 不是 BlockStatement 的箭头函数：块体本来就不返回值。
 * 非箭头（ref={this.handleRef} / ref={createRef()}）一律不碰。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(n => visit(n, fn));
  if (node.type) fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue;
    visit(node[k], fn);
  }
}

let files = 0;
let sites = 0;
const failed = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('ref=')) continue;

  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch (e) {
    failed.push(path.relative(ROOT, file) + ' — ' + e.message.slice(0, 60));
    continue;
  }

  const edits = [];
  visit(ast.program, node => {
    if (node.type !== 'JSXAttribute') return;
    if (!node.name || node.name.name !== 'ref') return;
    const v = node.value;
    if (!v || v.type !== 'JSXExpressionContainer') return;
    const fn = v.expression;
    if (!fn || fn.type !== 'ArrowFunctionExpression') return;
    if (fn.body.type === 'BlockStatement') return; // 已经是块体，不返回值

    // ⚠ babel 的节点范围【不含】包裹它的圆括号：`el => (this.el = el)` 里
    // body 是 AssignmentExpression，start/end 只覆盖 `this.el = el`，括号记在
    // extra.parenthesized / extra.parenStart 上。只按 body.start/end 替换的话，
    // 外层括号会留在原地，产出 `el => ({ this.el = el; })` —— 语法直接坏掉
    // （第一版就是这么错的）。所以括号存在时要把替换区间扩到整对括号。
    let s = fn.body.start;
    let e = fn.body.end;
    const extra = fn.body.extra;
    if (extra && extra.parenthesized && typeof extra.parenStart === 'number') {
      s = extra.parenStart;
      let depth = 0;
      let i = s;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) return; // 括号没配上，放弃这一处而不是产出坏代码
      e = i + 1;
    }
    edits.push([s, e, fn.body.start, fn.body.end]);
  });

  if (!edits.length) continue;

  // 从后往前，保证未处理区间的偏移仍然有效
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, bodyStart, bodyEnd] of edits) {
    // 表达式本体始终取 body 自己的范围（不含括号），外层括号连同一起被替换掉
    const body = src.slice(bodyStart, bodyEnd).trim();
    out = out.slice(0, s) + '{ ' + body + '; }' + out.slice(e);
    sites++;
  }
  fs.writeFileSync(file, out);
  files++;
}

console.log(`改写 ${sites} 处，涉及 ${files} 个文件`);
if (failed.length) {
  console.log(`\n解析失败 ${failed.length} 个:`);
  failed.forEach(f => console.log('  ' + f));
}
