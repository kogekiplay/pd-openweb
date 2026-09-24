/**
 * 给 noImplicitReturns（TS7030「不是所有路径都返回值」）补显式的 return undefined。
 * 输入是 tsc 的命中清单，每行 "path:line:col"（tsc 的行列都从 1 开始）。
 *
 * 【为什么统一补 undefined】掉出函数末尾、写裸 return;，运行时得到的都是 undefined ——
 * 显式写成 return undefined 与现状【逐位等价】。没有用 return null 统一渲染函数：函数组件的解构默认值和
 * defaultProps 只对 undefined 生效，渲染结果被当 prop 往下传时 null 会让默认值失效，不是等价替换。
 *
 * 【这个 codemod 只做等价改写，不替人判断】noImplicitReturns 真正想抓的是「该返回却漏了」：
 * reduce 丢了累加器、比较函数漏了分支、replace 回调插进字符串 "undefined"……
 * 2026-09-23 跑之前先按外层函数的上下文分了类，reduce / sort / replace / 返回数据的 map / Promise 回调
 * 逐个人工看过（真 bug 只有 CustomReference 的 reduce 一处，已手工修掉），剩下的才交给它。
 * 以后再用它，也要先分类、先人工看高风险的那几类。
 *
 * tsc 把 TS7030 报在两种位置：
 *   - 裸 return; 上 —— 改成 return undefined;（没写分号的保持不写）
 *   - 函数本身（函数末尾可达）—— 在函数体最后一条语句所在行之后补一行 return undefined;
 *     插在「行尾」而不是紧贴语句末尾：语句后面同一行的注释要留在原处
 *
 * 解析走 @babel/core + 仓库 .babelrc，与真实构建看到的语法一致。
 *
 * 用法：node tools/codemod-implicit-returns.ts < 命中清单
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

interface Hit {
  file: string;
  line: number;
  col: number;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const hits: Hit[] = fs
  .readFileSync(0, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => {
    const m = l.match(/^(.+?):(\d+):(\d+)$/);
    if (!m) throw new Error(`无法解析命中行：${l}`);
    return { file: m[1], line: +m[2], col: +m[3] };
  });

const byFile = new Map<string, Hit[]>();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

const stats = { files: 0, bareReturns: 0, appended: 0, skipped: [] as string[] };

for (const [file, list] of byFile) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = babel.parseSync(code, { filename: path.resolve(file), babelrc: true, sourceType: 'module' });
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
  const posOf = (h: Hit) => lineStarts[h.line - 1] + (h.col - 1);

  const fns = [];
  const returns = new Map();
  // key: function () {} / const f = function () {} 这类：tsc 把错报在属性名 / 变量名上，那个位置在函数节点之外。
  // 记下「名字的区间 -> 它的值那个函数」，命中落在名字上时直接用它
  const namedFns: { start: number; end: number; fn }[] = [];
  const isFn = n => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
  traverse(ast, {
    Function(p) {
      fns.push(p);
    },
    ReturnStatement(p) {
      returns.set(p.node.start, p);
    },
    'ObjectProperty|ClassProperty'(p) {
      if (isFn(p.node.value)) namedFns.push({ start: p.node.key.start, end: p.node.key.end, fn: p.get('value') });
    },
    VariableDeclarator(p) {
      if (isFn(p.node.init)) namedFns.push({ start: p.node.id.start, end: p.node.id.end, fn: p.get('init') });
    },
    AssignmentExpression(p) {
      if (isFn(p.node.right)) namedFns.push({ start: p.node.left.start, end: p.node.left.end, fn: p.get('right') });
    },
  });
  const innermostFn = (pos: number) => {
    const named = namedFns.find(x => x.start <= pos && pos < x.end);
    if (named) return named.fn;
    let best = null;
    for (const p of fns) {
      const n = p.node;
      if (n.start <= pos && pos < n.end && (!best || n.start >= best.node.start)) best = p;
    }
    return best;
  };
  // 命中落在名字上时，「位置在函数头上」的校验改成「位置在名字上」
  const onNameOf = (pos: number, fn) => namedFns.some(x => x.fn === fn && x.start <= pos && pos < x.end);

  const edits: Edit[] = [];
  const appendedTo = new Set<number>();

  for (const h of list) {
    const pos = posOf(h);
    const ret = returns.get(pos);
    if (ret) {
      if (ret.node.argument) {
        stats.skipped.push(`${file}:${h.line}:${h.col} 报在带值的 return 上，没见过这种情况`);
        continue;
      }
      const original = code.slice(ret.node.start, ret.node.end);
      edits.push({
        start: ret.node.start,
        end: ret.node.end,
        text: original.endsWith(';') ? 'return undefined;' : 'return undefined',
      });
      stats.bareReturns++;
      continue;
    }

    const fn = innermostFn(pos);
    if (!fn || fn.node.body.type !== 'BlockStatement') {
      stats.skipped.push(`${file}:${h.line}:${h.col} 定位不到块语句函数体`);
      continue;
    }
    // 函数级的报错必须落在函数头上（函数体的左花括号之前）。落在函数体里面，说明「最内层函数」找的不是它
    // （比如 tsc 报在了函数外面的变量名上，最内层就成了外层函数）—— 那种情况宁可跳过，也不能补错函数
    if (!(fn.node.start <= pos && pos < fn.node.body.start) && !onNameOf(pos, fn)) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 报错位置不在函数头上，没法确定是哪个函数`);
      continue;
    }
    if (appendedTo.has(fn.node.start)) continue;
    appendedTo.add(fn.node.start);

    const body = fn.node.body;
    const last = body.body[body.body.length - 1];
    if (!last) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 函数体是空的`);
      continue;
    }
    const closeBrace = body.end - 1;
    const lineOf = (p: number) => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= p) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    const lastLine = lineOf(last.end);
    const indent = code.slice(lineStarts[lineOf(last.start)]).match(/^[ \t]*/)[0];

    if (lineOf(closeBrace) === lastLine) {
      // 单行函数体 { foo(); } —— 就插在右花括号前
      edits.push({ start: closeBrace, end: closeBrace, text: 'return undefined; ' });
    } else {
      // 插在最后一条语句所在行的行尾之后，保住同一行的尾注释
      const nextLineStart = lineStarts[lastLine + 1];
      edits.push({ start: nextLineStart, end: nextLineStart, text: `${indent}return undefined;\n` });
    }
    stats.appended++;
  }

  let out = code;
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (out !== code) {
    fs.writeFileSync(file, out);
    stats.files++;
  }
}

console.log(`改了 ${stats.files} 个文件：裸 return 改写 ${stats.bareReturns} 处、函数末尾补 ${stats.appended} 处`);
if (stats.skipped.length) console.log(`跳过 ${stats.skipped.length} 处（需人工）：\n  ` + stats.skipped.join('\n  '));
