/**
 * 把 TS7006 里【类成员方法】那一档拆开看 —— 它在 analyze-ts7006.ts 里显示为
 * `other:264`（2415 条），因为方法声明自己就是那个"函数节点"，parent 是类不是属性。
 *
 * 【为什么单看这一档】React 类组件的生命周期方法有【库定的固定签名】：
 *   constructor(props)                     -> P
 *   componentDidUpdate(prevProps, prevState, snapshot)
 *   shouldComponentUpdate(nextProps, nextState)
 *   componentWillReceiveProps(nextProps)
 *   getSnapshotBeforeUpdate(prevProps, prevState)
 * 这几个的形参类型【不是猜的，是 React.Component<P, S> 的契约】：prevProps 就是 P，
 * prevState 就是 S。只要这个类已经写了 `extends React.Component<Props, State>`，
 * 类型就是现成的、精确的。
 *
 * 【反过来，没写泛型参数的类不能碰】那种类的 P 是默认值（{} 或 any），拿它去标
 * 形参等于把"不知道"写成"知道"，是假的确定性 —— 正确顺序是先有 props 接口
 *（tools/codemod-props-interface.ts 干这个），再谈标生命周期。
 *
 * 所以这里要量的是两个数：
 *   1. 生命周期方法的形参有多少条，分别是哪几个方法
 *   2. 其中【所属类已经带了泛型实参】的有多少 —— 那才是真正可做的量
 *
 * 只统计，不改文件。
 * 用法：node tools/analyze-class-method-params.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject } = require('./ts7.ts');

const project = openProject('tsconfig.strictprobe.json');
const SRC = path.join(ROOT, 'src') + path.sep;

/** React 类组件生命周期：方法名 -> 每个形参的来源（'P' = props 类型，'S' = state 类型，null = 无固定来源） */
const LIFECYCLE: Record<string, (string | null)[]> = {
  constructor: ['P'],
  componentDidUpdate: ['P', 'S', null],
  componentWillReceiveProps: ['P', null],
  UNSAFE_componentWillReceiveProps: ['P', null],
  shouldComponentUpdate: ['P', 'S', null],
  componentWillUpdate: ['P', 'S'],
  UNSAFE_componentWillUpdate: ['P', 'S'],
  getSnapshotBeforeUpdate: ['P', 'S'],
  getDerivedStateFromProps: ['P', 'S'],
  componentDidCatch: [null, null],
};

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 7006 && d.fileName && d.fileName.startsWith(SRC));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

type Row = { method: string; param: string; source: string | null; hasTypeArgs: boolean; heritage: string; loc: string };
const rows: Row[] = [];
const nonLifecycle = new Map<string, number>();

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  const paramAt = new Map<number, { p: any; fn: any; index: number }>();
  (function walk(n: any) {
    const params = n.parameters;
    if (params && params.length) {
      params.forEach((p: any, i: number) => {
        if (is.isParameterDeclaration(p) && p.name && is.isIdentifier(p.name)) {
          paramAt.set(p.name.end, { p, fn: n, index: i });
        }
      });
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    const hit = paramAt.get(d.end);
    if (!hit) continue;
    const { p, fn, index } = hit;
    // 只看「方法声明 / 构造函数」，且它的 parent 是类
    const isMember = is.isMethodDeclaration(fn) || is.isConstructorDeclaration(fn);
    if (!isMember) continue;
    const cls = fn.parent;
    if (!cls || (!is.isClassDeclaration(cls) && !is.isClassExpression(cls))) continue;

    const mname = is.isConstructorDeclaration(fn)
      ? 'constructor'
      : fn.name && is.isIdentifier(fn.name)
        ? fn.name.text
        : '?';

    // 类的 extends 子句：有没有写泛型实参
    let hasTypeArgs = false;
    let heritage = '';
    const clauses = cls.heritageClauses;
    if (clauses && clauses.length) {
      for (const c of clauses) {
        if (!c.types) continue;
        for (const t of c.types) {
          heritage = text.slice(t.pos, t.end).trim().replace(/\s+/g, ' ');
          if (t.typeArguments && t.typeArguments.length) hasTypeArgs = true;
        }
      }
    }

    const spec = LIFECYCLE[mname];
    const line = text.slice(0, d.pos).split('\n').length;
    if (spec) {
      rows.push({
        method: mname,
        param: p.name.text,
        source: spec[index] ?? null,
        hasTypeArgs,
        heritage,
        loc: `${path.relative(ROOT, fileName)}:${line}`,
      });
    } else {
      nonLifecycle.set(mname, (nonLifecycle.get(mname) || 0) + 1);
    }
  }
}

// ── 报告 ──────────────────────────────────────────────────────────────────
console.log(`类成员方法里的 TS7006：生命周期 ${rows.length} 条，非生命周期 ${[...nonLifecycle.values()].reduce((a, b) => a + b, 0)} 条\n`);

const byMethod = new Map<string, { total: number; typed: number; untyped: number; noSource: number }>();
for (const r of rows) {
  if (!byMethod.has(r.method)) byMethod.set(r.method, { total: 0, typed: 0, untyped: 0, noSource: 0 });
  const b = byMethod.get(r.method)!;
  b.total += 1;
  if (!r.source) b.noSource += 1;
  else if (r.hasTypeArgs) b.typed += 1;
  else b.untyped += 1;
}

console.log('生命周期方法（typed = 所属类已写泛型实参，类型是现成的；untyped = 类没写泛型，不能碰）：');
console.log(`  ${'方法'.padEnd(34)} ${'合计'.padStart(6)} ${'可做'.padStart(6)} ${'类无泛型'.padStart(8)} ${'无固定来源'.padStart(10)}`);
for (const [m, b] of [...byMethod].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `  ${m.padEnd(34)} ${String(b.total).padStart(6)} ${String(b.typed).padStart(6)} ${String(b.untyped).padStart(8)} ${String(b.noSource).padStart(10)}`,
  );
}

const doable = rows.filter(r => r.source && r.hasTypeArgs);
console.log(`\n真正可做的（有固定来源 且 所属类已带泛型实参）：${doable.length} 条`);
for (const r of doable.slice(0, 10)) {
  console.log(`  ${r.loc.padEnd(64)} ${r.method}(${r.param}) <- ${r.source}   [${r.heritage.slice(0, 48)}]`);
}

console.log('\n非生命周期的类方法（形参类型只能来自调用点，Top 15）：');
for (const [m, n] of [...nonLifecycle].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${m.padEnd(40)} ${n}`);
}

// 类没写泛型实参的那批，看看 heritage 长什么样 —— 决定要不要先补 props 接口
const untypedHeritage = new Map<string, number>();
for (const r of rows) if (r.source && !r.hasTypeArgs) untypedHeritage.set(r.heritage, (untypedHeritage.get(r.heritage) || 0) + 1);
console.log('\n类没写泛型实参的，extends 的是什么（Top 10）：');
for (const [h, n] of [...untypedHeritage].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${String(n).padStart(5)}  ${h.slice(0, 70)}`);
}

project.close();
