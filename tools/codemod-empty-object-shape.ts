/**
 * 给「空对象起手、之后逐条挂属性」的声明补形状（TS2339 on type '{}'）
 *
 * 全仓 TS2339 有 14776 条，其中 4385 条是「属性不存在于类型 '{}'」——
 * 单一最大的一类。来源是这种老写法：
 *
 *     const settings = {};          // 类型被钉成空对象字面量类型
 *     settings.foo = 1;             // ← Property 'foo' does not exist on type '{}'
 *     if (settings.bar) { … }       // ← 同上，每读一次就是一条
 *
 * 一个声明往往贡献几十条诊断（实测 global.ts 里一个 jqXHR 就 46 条），
 * 所以这类的"每处改动收益"远高于形参标注。
 *
 * 【为什么写 Record<string, any> 而不是把真实形状测出来】
 * 测形状是可行的（把所有 `x.foo = …` 的赋值点收齐求并集），tools/
 * 下的老版本 codemod-module-object-shape.ts 就是那么做的。但这里【故意不那么做】：
 * 这类变量的属性是在运行期按分支逐步挂上去的，写死一个形状会把"某个分支下才有
 * 这个字段"的事实变成"所有分支都有"，下游拿到的就是【假的确定性】。
 * Record<string, any> 只是把"这是个字典"这件事说出来，不假装知道里面有什么。
 *
 * 【只改真的报了 TS2339 的声明】不是见到 `= {}` 就标。没报错的说明 TS 已经从
 * 上下文推出了更好的类型（比如作为实参传给有类型的形参），标上去反而是降级。
 *
 * 【不碰已有标注的】以及不碰 `as` 断言过的。
 *
 * 用法：
 *   node tools/codemod-empty-object-shape.ts --list
 *   node tools/codemod-empty-object-shape.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject, writeSource } = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const SRC = path.join(ROOT, 'src') + path.sep;

const project = openProject('tsconfig.strictprobe.json');
const checker = project.checker;

// ── 收集所有「属性不存在于 '{}'」的诊断，按文件分组 ────────────────────────
const diags = project.program
  .getSemanticDiagnostics()
  .filter(
    (d: any) =>
      d.code === 2339 &&
      d.fileName &&
      d.fileName.startsWith(SRC) &&
      / does not exist on type '\{\}'/.test(d.text || ''),
  );

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

type Target = { fileName: string; text: string; pos: number; name: string; count: number };
const targets = new Map<string, Target>(); // key: fileName|declNameEnd
const skip = { annotated: 0, notEmptyLiteral: 0, unresolved: 0, notVarDecl: 0 };

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  // 诊断落在 `x.foo` 的 foo 上；往上找到属主标识符 x，再解析到它的声明
  const idAt = new Map<number, any>();
  (function walk(n: any) {
    if (is.isPropertyAccessExpression(n) && n.name && n.expression && is.isIdentifier(n.expression)) {
      idAt.set(n.name.end, n.expression);
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    const owner = idAt.get(d.end);
    if (!owner) {
      skip.unresolved += 1;
      continue;
    }
    let sym: any = null;
    try {
      sym = checker.getSymbolAtLocation(owner);
    } catch {
      sym = null;
    }
    const decl = sym && sym.valueDeclaration;
    if (!decl || decl.index === undefined || !decl.path) {
      skip.unresolved += 1;
      continue;
    }
    // 声明必须在同一个文件里（跨文件的声明这里不物化，也不该由本工具改）
    if (String(decl.path).toLowerCase() !== fileName.toLowerCase()) {
      skip.unresolved += 1;
      continue;
    }

    // 把声明节点物化出来：按 index 在本文件里找
    let declNode: any = null;
    (function walk(n: any) {
      if (declNode) return;
      if (n.index === decl.index) {
        declNode = n;
        return;
      }
      n.forEachChild(walk);
    })(sf);

    // 除了 `const x = {}`，形参和类字段的 `= {}` 默认值是同一回事，一并处理。
    // 实测这三类之外的（绑定元素等）占大头，但绑定元素标不了单个元素、
    // 要标整个解构目标，那是另一件事，本工具不做。
    const isSupported =
      is.isVariableDeclaration(declNode) ||
      is.isParameterDeclaration(declNode) ||
      is.isPropertyDeclaration(declNode);
    if (!declNode || !isSupported) {
      skip.notVarDecl += 1;
      continue;
    }
    if (declNode.type) {
      skip.annotated += 1;
      continue;
    }
    const init = declNode.initializer;
    // 只处理字面意义上的「空对象起手」
    if (!init || !is.isObjectLiteralExpression(init) || (init.properties && init.properties.length)) {
      skip.notEmptyLiteral += 1;
      continue;
    }
    if (!declNode.name || !is.isIdentifier(declNode.name)) {
      skip.notVarDecl += 1;
      continue;
    }

    // 插入点：questionToken 之后（写在它之前是 TS17019，会毁掉整个签名）
    const insertAt = declNode.questionToken ? declNode.questionToken.end : declNode.name.end;
    const key = `${fileName}|${insertAt}`;
    const prev = targets.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      targets.set(key, { fileName, text, pos: insertAt, name: declNode.name.text, count: 1 });
    }
  }
}

// ── 报告与应用 ────────────────────────────────────────────────────────────
const list = [...targets.values()].sort((a, b) => b.count - a.count);
const covered = list.reduce((a, t) => a + t.count, 0);

console.log(`可标 ${list.length} 个声明，覆盖 ${covered} 条诊断。收益最高的 12 个：`);
for (const t of list.slice(0, 12)) {
  console.log(`  ${path.relative(ROOT, t.fileName).padEnd(72)} ${t.name.padEnd(18)} ${t.count} 条`);
}
console.log(
  `\n跳过：已有标注 ${skip.annotated} / 不是空对象字面量起手 ${skip.notEmptyLiteral} / ` +
    `不是变量/形参/类字段声明 ${skip.notVarDecl} / 解析不到声明 ${skip.unresolved}`,
);

if (APPLY && list.length) {
  const edits = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const t of list) {
    if (!edits.has(t.fileName)) edits.set(t.fileName, { text: t.text, list: [] });
    edits.get(t.fileName)!.list.push({ pos: t.pos, text: ': Record<string, any>' });
  }
  for (const [fileName, bucket] of edits) writeSource(fileName, bucket.text, bucket.list);
  console.log(`已写入 ${edits.size} 个文件。`);
}

project.close();
