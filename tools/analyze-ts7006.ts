/**
 * 把剩下的 TS7006（隐式 any 形参）按【所处语法位置】分类，用来选下一个撬点。
 *
 * 【为什么先分类再写 codemod】前面栽过一次：照着老工具的假设写了一版
 * codemod-null-init-shape.ts，实测 3517/3527 解析不到声明，因为剩下的根本不是
 * 那种形态。TS7006 现在还有 3 万条，占全仓 strict 诊断的一半，随便挑一个判据写
 * 工具很可能又是白写。先量一遍每一类各占多少、哪一类有可靠的类型来源。
 *
 * 分类维度是【形参所属函数出现在什么位置】，因为类型来源完全取决于它：
 *   · jsx-handler     <div onClick={e => …}>   来源：React 的事件类型，精确
 *   · method-callback list.map(x => …)         来源：接收者的元素类型，取决于接收者是不是 any
 *   · call-argument   foo(function (a) {…})     来源：被调函数的形参类型（若有标注）
 *   · object-method   { onOk(a) {…} }          来源：目标对象的类型（若有标注）
 *   · class-method    class X { f(a) {} }      来源：无（除非实现了接口）
 *   · top-function    function f(a) {}         来源：调用点（codemod-callsite-types 已覆盖）
 *   · variable-fn     const f = a => {}        来源：调用点
 *   · export-fn       export function f(a) {}  来源：调用点，但跨文件
 *
 * 只统计，不改任何文件。
 *
 * 用法：node tools/analyze-ts7006.ts [--samples N]
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject } = require('./ts7.ts');

const SAMPLES = (() => {
  const i = process.argv.indexOf('--samples');
  return i >= 0 ? Number(process.argv[i + 1]) || 3 : 3;
})();

const project = openProject('tsconfig.strictprobe.json');
const checker = project.checker;
const SRC = path.join(ROOT, 'src') + path.sep;

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 7006 && d.fileName && d.fileName.startsWith(SRC));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

type Bucket = { count: number; samples: string[]; /** 接收者/目标类型是 any 的有多少 */ anyCtx: number };
const buckets = new Map<string, Bucket>();

function bump(kind: string, sample: string, anyCtx: boolean) {
  if (!buckets.has(kind)) buckets.set(kind, { count: 0, samples: [], anyCtx: 0 });
  const b = buckets.get(kind)!;
  b.count += 1;
  if (anyCtx) b.anyCtx += 1;
  if (b.samples.length < SAMPLES) b.samples.push(sample);
}

/** 这个函数节点挂在哪儿 —— 决定了类型来源 */
function classify(fn: any, text: string): { kind: string; ctxType: string } {
  const parent = fn.parent;
  if (!parent) return { kind: 'orphan', ctxType: '' };

  // <div onClick={e => …}>
  if (is.isJsxExpression(parent) && parent.parent && is.isJsxAttribute(parent.parent)) {
    const attr = parent.parent;
    const tagIsHost =
      attr.parent && attr.parent.parent && attr.parent.parent.tagName && is.isIdentifier(attr.parent.parent.tagName)
        ? /^[a-z]/.test(attr.parent.parent.tagName.text)
        : false;
    return { kind: tagIsHost ? 'jsx-handler-host' : 'jsx-handler-component', ctxType: '' };
  }

  // foo(…, fn, …) —— 区分「接收者是成员访问」（list.map）和普通调用（foo(fn)）
  if (is.isCallExpression(parent) && parent.arguments && parent.arguments.some((a: any) => a === fn)) {
    const callee = parent.expression;
    if (callee && is.isPropertyAccessExpression(callee)) {
      let recvType = '';
      try {
        recvType = checker.typeToString(checker.getTypeAtLocation(callee.expression));
      } catch {
        recvType = '?';
      }
      const m = callee.name && is.isIdentifier(callee.name) ? callee.name.text : '?';
      return { kind: `method-callback:${m}`, ctxType: recvType };
    }
    let calleeType = '';
    try {
      calleeType = checker.typeToString(checker.getTypeAtLocation(callee));
    } catch {
      calleeType = '?';
    }
    return { kind: 'call-argument', ctxType: calleeType };
  }

  // { onOk(a) {…} } 或 { onOk: a => {…} }
  if (is.isPropertyAssignment(parent) || is.isMethodDeclaration(parent)) {
    if (is.isMethodDeclaration(parent) && parent.parent && is.isClassDeclaration(parent.parent)) {
      return { kind: 'class-method', ctxType: '' };
    }
    return { kind: 'object-member', ctxType: '' };
  }

  if (is.isPropertyDeclaration(parent)) return { kind: 'class-field-fn', ctxType: '' };

  if (is.isVariableDeclaration(parent)) {
    return { kind: 'variable-fn', ctxType: '' };
  }

  if (is.isFunctionDeclaration(fn)) {
    return { kind: 'top-function', ctxType: '' };
  }

  if (is.isReturnStatement(parent)) return { kind: 'returned-fn', ctxType: '' };

  return { kind: `other:${parent.kind}`, ctxType: '' };
}

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  // 诊断圈的是标识符，用 name.end 定位到形参，再拿它所属的函数
  const paramAt = new Map<number, { p: any; fn: any }>();
  (function walk(n: any) {
    const params = n.parameters;
    if (params && params.length) {
      params.forEach((p: any) => {
        if (is.isParameterDeclaration(p) && p.name && is.isIdentifier(p.name)) {
          paramAt.set(p.name.end, { p, fn: n });
        }
      });
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    const hit = paramAt.get(d.end);
    if (!hit) {
      bump('unlocatable', '', false);
      continue;
    }
    const { p, fn } = hit;
    const { kind, ctxType } = classify(fn, text);
    const line = text.slice(0, d.pos).split('\n').length;
    const snippet = text
      .slice(fn.pos, Math.min(fn.end, fn.pos + 90))
      .replace(/\s+/g, ' ')
      .trim();
    const anyCtx = ctxType === 'any' || ctxType === '?' || /\bany\b/.test(ctxType);
    bump(kind, `${path.relative(ROOT, fileName)}:${line}  ${snippet}`, anyCtx);
  }
}

// ── 报告 ──────────────────────────────────────────────────────────────────
const sorted = [...buckets].sort((a, b) => b[1].count - a[1].count);
const total = sorted.reduce((a, [, b]) => a + b.count, 0);
console.log(`TS7006 共 ${total} 条（${byFile.size} 个文件）。按形参所属函数的位置分类：\n`);

// method-callback 太细碎，先给个合计
const mcTotal = sorted.filter(([k]) => k.startsWith('method-callback:')).reduce((a, [, b]) => a + b.count, 0);
const mcAny = sorted.filter(([k]) => k.startsWith('method-callback:')).reduce((a, [, b]) => a + b.anyCtx, 0);

for (const [kind, b] of sorted.slice(0, 26)) {
  const pct = ((b.count / total) * 100).toFixed(1);
  const anyNote = b.anyCtx ? `  (其中接收者/被调是 any: ${b.anyCtx})` : '';
  console.log(`  ${kind.padEnd(34)} ${String(b.count).padStart(6)}  ${pct.padStart(5)}%${anyNote}`);
}

console.log(
  `\nmethod-callback 合计 ${mcTotal} 条，其中接收者是 any 的 ${mcAny} 条` +
    `（接收者不是 any 的话 TS 本来就能推，说明那些是别的原因）。`,
);

console.log('\n── 各类样例 ──');
for (const [kind, b] of sorted.slice(0, 12)) {
  console.log(`\n【${kind}】`);
  for (const s of b.samples) console.log(`  ${s}`);
}

project.close();
