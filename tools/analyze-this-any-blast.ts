/**
 * 量一下 `Component<any, any>` 到底喂出去多少条诊断，并把 props 侧和 state 侧分开。
 *
 * 【背景】全仓 1184 个类组件【无一例外】都写成 `Component<any, any>`，没有一个带真实
 * 泛型实参。于是 this.props 和 this.state 全是 any，它们往下游流出去的每一处都成了
 * 隐式 any 或 '{}' 访问。analyze-ts7006.ts 显示 method-callback 那 9141 条里 9005 条
 * 的【接收者是 any】—— 怀疑主要来源就是这里。
 *
 * 【为什么要把 props 和 state 分开量】这两侧的可做性完全不同：
 *
 *   props 侧：tools/codemod-props-interface.ts 的文件头已经记了实测结论 ——
 *     这条路不通。键集必须是 propTypes ∪ 组件内使用 ∪ 【全仓所有 JSX 调用点传入的】，
 *     少一维就会在调用点炸 TS2353。那是跨文件全程序分析，成本远超收益。
 *
 *   state 侧：【没有外部调用方】。state 的写入点只有本类的 `this.state = {…}` 和
 *     `this.setState(…)`，读取点只有 `this.state.x`，全都在同一个文件里。
 *     props 那条路的致命伤（调用方传了组件不读的 prop）在 state 上【不存在】。
 *     所以 state 侧值得单独量，看够不够撬。
 *
 * 只统计，不改文件。
 * 用法：node tools/analyze-this-any-blast.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject } = require('./ts7.ts');

const project = openProject('tsconfig.strictprobe.json');
const SRC = path.join(ROOT, 'src') + path.sep;

const CODES = new Set([7006, 2339, 7031, 7053]);
const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => CODES.has(d.code) && d.fileName && d.fileName.startsWith(SRC));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

/** 把表达式往左剥到根，判断是不是 this.props.* / this.state.* */
function rootOfThis(n: any): 'props' | 'state' | null {
  let cur = n;
  const guard = 40;
  for (let i = 0; i < guard && cur; i++) {
    if (is.isPropertyAccessExpression(cur)) {
      const obj = cur.expression;
      if (obj && obj.kind !== undefined && is.isThisExpression && is.isThisExpression(obj)) {
        const nm = cur.name && is.isIdentifier(cur.name) ? cur.name.text : '';
        if (nm === 'props') return 'props';
        if (nm === 'state') return 'state';
        return null;
      }
      cur = obj;
      continue;
    }
    if (is.isElementAccessExpression(cur) || is.isCallExpression(cur) || is.isNonNullExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (is.isParenthesizedExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    return null;
  }
  return null;
}

const tally: Record<string, Record<number, number>> = {
  props: {},
  state: {},
  'destructure-props': {},
  'destructure-state': {},
  other: {},
};
function bump(kind: string, code: number) {
  tally[kind][code] = (tally[kind][code] || 0) + 1;
}

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;

  // 建索引：诊断位置 -> 最内层包含它的表达式链
  //  · method-callback 的情形：诊断在回调形参上，要看【它所在调用的接收者】
  //  · TS2339/TS7053：诊断在属性名上，看属主
  //  · TS7031：解构绑定，看被解构的初值 / 形参来源
  const hits: { pos: number; end: number; kind: string }[] = [];

  (function walk(n: any) {
    // list.map(cb) —— 回调形参的诊断落在回调内部，用调用节点的范围去覆盖
    if (is.isCallExpression(n) && n.expression && is.isPropertyAccessExpression(n.expression)) {
      const r = rootOfThis(n.expression.expression);
      if (r) for (const a of n.arguments || []) hits.push({ pos: a.pos, end: a.end, kind: r });
    }
    // this.props.foo / this.state.foo 上的属性诊断
    if (is.isPropertyAccessExpression(n) || is.isElementAccessExpression(n)) {
      const r = rootOfThis(n.expression);
      if (r && n.name) hits.push({ pos: n.name.pos, end: n.name.end, kind: r });
    }
    // const { a, b } = this.props / this.state
    if (is.isVariableDeclaration(n) && n.initializer && n.name && is.isObjectBindingPattern(n.name)) {
      const r = rootOfThis(n.initializer);
      if (r) hits.push({ pos: n.name.pos, end: n.name.end, kind: `destructure-${r}` });
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    // 取最小的覆盖区间，避免大范围调用吞掉内层
    let best: { pos: number; end: number; kind: string } | null = null;
    for (const h of hits) {
      if (h.pos <= d.pos && d.end <= h.end) {
        if (!best || h.end - h.pos < best.end - best.pos) best = h;
      }
    }
    bump(best ? best.kind : 'other', d.code);
  }
}

// ── 报告 ──────────────────────────────────────────────────────────────────
const codes = [7006, 2339, 7031, 7053];
const label: Record<string, string> = {
  props: 'this.props.* 链上',
  state: 'this.state.* 链上',
  'destructure-props': '解构 this.props',
  'destructure-state': '解构 this.state',
  other: '与 this.props/state 无关',
};

console.log(`统计 ${diags.length} 条诊断（TS7006 / TS2339 / TS7031 / TS7053）按是否源自 this.props / this.state：\n`);
console.log(`  ${'来源'.padEnd(26)} ${'TS7006'.padStart(8)} ${'TS2339'.padStart(8)} ${'TS7031'.padStart(8)} ${'TS7053'.padStart(8)} ${'合计'.padStart(8)}`);
let grandProps = 0;
let grandState = 0;
for (const k of ['props', 'destructure-props', 'state', 'destructure-state', 'other']) {
  const row = tally[k];
  const sum = codes.reduce((a, c) => a + (row[c] || 0), 0);
  if (k.includes('props')) grandProps += sum;
  if (k.includes('state')) grandState += sum;
  console.log(
    `  ${label[k].padEnd(26)} ${codes.map(c => String(row[c] || 0).padStart(8)).join(' ')} ${String(sum).padStart(8)}`,
  );
}
console.log(`\nprops 侧合计 ${grandProps} 条；state 侧合计 ${grandState} 条。`);
console.log(
  'props 侧已知不可做（见 tools/codemod-props-interface.ts 文件头的实测结论）；\n' +
    'state 侧没有外部调用方，写入点和读取点都在同一个文件里，是可以单独评估的。',
);

project.close();
