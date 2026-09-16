/**
 * 找出「哪些声明点的 any 喂出了最多诊断」—— 按爆炸半径给欠债排序。
 *
 * 【为什么要这么找】前面两次猜错了撬点，都是靠量出来才发现的：
 *   · 猜 this.props / this.state 是大头 -> 实测只占 0.7%（analyze-this-any-blast.ts）。
 *     原因很反直觉：this.props 是 any，读它的属性【根本不报诊断】，any 是静默传播的。
 *     所以给 Component<any,any> 补真实泛型不但不会降诊断数，多半还会涨。
 *   · 猜 React 生命周期形参可做 -> 实测 1351 条里几乎全是 Component<any, any>，
 *     标上去等于把 any 显式写一遍，是【给计数器灌水】，不是进展。
 *
 * 所以这一次不猜：直接把每条诊断回溯到【产生那个 any 的声明】，按声明点聚合排序。
 * 排在前面的就是"改一处、下游少一片"的位置。
 *
 * 回溯方式：诊断落在回调形参 / 属性名上 -> 找到它依附的接收者表达式 ->
 * 往左剥到根标识符 -> checker 解析到符号的 valueDeclaration。
 * TS 7 的 valueDeclaration 是惰性句柄，只有 { path, index } 可用，所以聚合键
 * 用 `path|index`，再在该文件里按 index 物化回节点拿名字和行号。
 *
 * 只统计，不改文件。
 * 用法：node tools/analyze-any-origins.ts [--top N]
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject } = require('./ts7.ts');

const TOP = (() => {
  const i = process.argv.indexOf('--top');
  return i >= 0 ? Number(process.argv[i + 1]) || 30 : 30;
})();

const project = openProject('tsconfig.strictprobe.json');
const checker = project.checker;
const SRC = path.join(ROOT, 'src') + path.sep;

const CODES = new Set([7006, 2339]);
const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => CODES.has(d.code) && d.fileName && d.fileName.startsWith(SRC));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

/** 往左剥到根标识符 */
function rootIdentifier(n: any): any {
  let cur = n;
  for (let i = 0; i < 60 && cur; i++) {
    if (is.isIdentifier(cur)) return cur;
    if (
      is.isPropertyAccessExpression(cur) ||
      is.isElementAccessExpression(cur) ||
      is.isCallExpression(cur) ||
      is.isNonNullExpression(cur) ||
      is.isParenthesizedExpression(cur) ||
      is.isAwaitExpression(cur)
    ) {
      cur = cur.expression;
      continue;
    }
    return null;
  }
  return null;
}

type Origin = { count: number; codes: Record<number, number>; name: string; declPath: string; declIndex: number };
const origins = new Map<string, Origin>();
let unresolved = 0;

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;

  // 收集「诊断可能依附的接收者」：调用的接收者、属性访问的属主
  const carriers: { pos: number; end: number; recv: any }[] = [];
  (function walk(n: any) {
    if (is.isCallExpression(n) && n.expression && is.isPropertyAccessExpression(n.expression)) {
      for (const a of n.arguments || []) carriers.push({ pos: a.pos, end: a.end, recv: n.expression.expression });
    }
    if (is.isPropertyAccessExpression(n) && n.name) {
      carriers.push({ pos: n.name.pos, end: n.name.end, recv: n.expression });
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    let best: { pos: number; end: number; recv: any } | null = null;
    for (const c of carriers) {
      if (c.pos <= d.pos && d.end <= c.end) {
        if (!best || c.end - c.pos < best.end - best.pos) best = c;
      }
    }
    if (!best) {
      unresolved += 1;
      continue;
    }
    const root = rootIdentifier(best.recv);
    if (!root) {
      unresolved += 1;
      continue;
    }
    let sym: any = null;
    try {
      sym = checker.getSymbolAtLocation(root);
    } catch {
      sym = null;
    }
    const decl = sym && sym.valueDeclaration;
    if (!decl || !decl.path || decl.index === undefined) {
      unresolved += 1;
      continue;
    }
    const key = `${String(decl.path).toLowerCase()}|${decl.index}`;
    if (!origins.has(key)) {
      origins.set(key, {
        count: 0,
        codes: {},
        name: is.isIdentifier(root) ? root.text : '?',
        declPath: String(decl.path),
        declIndex: decl.index,
      });
    }
    const o = origins.get(key)!;
    o.count += 1;
    o.codes[d.code] = (o.codes[d.code] || 0) + 1;
  }
}

// ── 把 Top N 的声明节点物化出来，拿行号和写法 ─────────────────────────────
const sorted = [...origins.values()].sort((a, b) => b.count - a.count).slice(0, TOP);
const wantByFile = new Map<string, Set<number>>();
for (const o of sorted) {
  if (!wantByFile.has(o.declPath)) wantByFile.set(o.declPath, new Set());
  wantByFile.get(o.declPath)!.add(o.declIndex);
}
const materialized = new Map<string, { line: number; snippet: string; kindName: string }>();
for (const [p, idxs] of wantByFile) {
  const sf = project.program.getSourceFile(p);
  if (!sf) continue;
  const text: string = sf.text;
  (function walk(n: any) {
    if (n.index !== undefined && idxs.has(n.index)) {
      const line = text.slice(0, n.pos).split('\n').length;
      materialized.set(`${p.toLowerCase()}|${n.index}`, {
        line,
        snippet: text.slice(n.pos, Math.min(n.end, n.pos + 110)).replace(/\s+/g, ' ').trim(),
        kindName: is.isParameterDeclaration(n)
          ? '形参'
          : is.isVariableDeclaration(n)
            ? '变量'
            : is.isPropertyDeclaration(n)
              ? '类字段'
              : is.isFunctionDeclaration(n)
                ? '函数'
                : is.isBindingElement(n)
                  ? '解构绑定'
                  : `kind${n.kind}`,
      });
    }
    n.forEachChild(walk);
  })(sf);
}

const totalAttributed = [...origins.values()].reduce((a, o) => a + o.count, 0);
console.log(
  `TS7006 + TS2339 共 ${diags.length} 条；能回溯到声明的 ${totalAttributed} 条，` +
    `回溯不到 ${unresolved} 条；不同声明点 ${origins.size} 个。\n`,
);
console.log(`爆炸半径最大的 ${sorted.length} 个声明点：\n`);
for (const o of sorted) {
  const m = materialized.get(`${o.declPath.toLowerCase()}|${o.declIndex}`);
  const loc = m ? `${path.relative(ROOT, o.declPath)}:${m.line}` : path.relative(ROOT, o.declPath);
  const codes = Object.entries(o.codes)
    .map(([c, n]) => `TS${c}×${n}`)
    .join(' ');
  console.log(`  ${String(o.count).padStart(5)} 条  ${o.name.padEnd(20)} ${(m ? m.kindName : '?').padEnd(8)} ${loc}`);
  console.log(`         ${codes}`);
  if (m) console.log(`         ${m.snippet.slice(0, 100)}`);
}

// 分布：有多少诊断集中在 Top 100 / Top 500 声明点
const all = [...origins.values()].sort((a, b) => b.count - a.count);
for (const n of [50, 100, 500, 1000]) {
  const s = all.slice(0, n).reduce((a, o) => a + o.count, 0);
  console.log(`Top ${String(n).padStart(4)} 个声明点覆盖 ${String(s).padStart(6)} 条（${((s / totalAttributed) * 100).toFixed(1)}%）`);
}

project.close();
