/**
 * 给「先建空对象、再一条条往上挂属性」的对象补形状（TS2339 on type '{}'）
 *
 * 实测命中两类，形态完全一样：
 *   1) 命名空间式的模块对象（BatchTask、Calendar 这种，一挂二十几个方法）
 *   2) 按条件拼出来的请求载荷 / 变更集（changes、param、submitData、result 这种）
 *
 * 本仓有一批老写法：
 *   const BatchTask = {};
 *   BatchTask.Settings = { ... };
 *   BatchTask.initEvent = function () { ... };
 * TS 只能把它推成 `{}`，于是【每一处】BatchTask.xxx 都报「属性不存在」。
 * 单个文件能积 90 多条，是剩余 TS2339 里最集中的一类。
 *
 * 【为什么用索引签名而不是逐个列】挂上去的成员签名各不相同（有配置对象、
 * 有各种形状的方法、有按条件才出现的字段），逐个列出来要么是 `any`、
 * 要么是几十行噪声。
 * `{ [key: string]: any }` 说的是实情：这是个「运行时往上挂成员」的命名空间对象。
 * 它消掉的是一整类【假错误】—— 那些属性确实存在，只是 TS 看不见赋值。
 *
 * 【判据】必须同时满足，少一条都不动：
 *   - 变量声明没有类型标注，初值就是空对象字面量 `{}`
 *   - 同一作用域里对它有 >= 3 处属性赋值（`X.foo = ...`）
 *   - 它身上确实产生了 TS2339 '{}' 诊断
 * 只有 1、2 处赋值的不碰 —— 那更像是「顺手塞两个字段的普通对象」，
 * 该定具名形状，不该用索引签名糊过去。
 *
 * 用法：
 *   node tools/codemod-module-object-shape.cjs --list
 *   node tools/codemod-module-object-shape.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');
const MIN_ASSIGNS = 3;

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

// decl 节点 -> { sf, name, diags, assigns }
const cands = new Map();
const skip = { notEmptyObj: 0, annotated: 0, fewAssigns: 0, unresolved: 0 };

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;

  for (const d of program.getSemanticDiagnostics(sf)) {
    if (d.code !== 2339 || d.start === undefined) continue;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (!/does not exist on type '\{\}'/.test(msg)) continue;

    const node = findNode(sf, d.start);
    const access = node && node.parent && ts.isPropertyAccessExpression(node.parent) ? node.parent : null;
    if (!access) continue;
    const sym = checker.getSymbolAtLocation(access.expression);
    const decl = sym && sym.valueDeclaration;
    if (!decl || !ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name)) {
      skip.unresolved += 1;
      continue;
    }
    if (decl.type) {
      skip.annotated += 1;
      continue;
    }
    const init = decl.initializer;
    if (!init || !ts.isObjectLiteralExpression(init) || init.properties.length) {
      skip.notEmptyObj += 1;
      continue;
    }
    if (!decl.getSourceFile().fileName.startsWith(SRC)) continue;

    if (!cands.has(decl)) {
      cands.set(decl, { sf: decl.getSourceFile(), name: decl.name.text, diags: 0, assigns: countAssigns(decl) });
    }
    cands.get(decl).diags += 1;
  }
}

/** 数一数 `X.foo = ...` 有几处 */
function countAssigns(decl) {
  const name = decl.name.text;
  const sf = decl.getSourceFile();
  let n = 0;
  (function walk(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === name
    ) {
      n += 1;
    }
    node.forEachChild(walk);
  })(sf);
  return n;
}

function findNode(root, pos) {
  let hit = root;
  (function visit(n) {
    if (n.getStart() <= pos && pos < n.getEnd()) {
      hit = n;
      n.forEachChild(visit);
    }
  })(root);
  return hit;
}

const byFile = new Map();
let totalDiags = 0;
for (const [decl, info] of cands) {
  if (info.assigns < MIN_ASSIGNS) {
    skip.fewAssigns += 1;
    continue;
  }
  const file = info.sf.fileName;
  if (!byFile.has(file)) byFile.set(file, { text: info.sf.getFullText(), ins: [] });
  byFile.get(file).ins.push({ pos: decl.name.end, name: info.name, diags: info.diags, assigns: info.assigns });
  totalDiags += info.diags;
}

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(
    `${path.relative(ROOT, file)}: ${bucket.ins.map(i => `${i.name}（${i.assigns} 处赋值 / ${i.diags} 条诊断）`).join(', ')}`,
  );
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) {
    src = src.slice(0, i.pos) + ': Record<string, any>' + src.slice(i.pos);
  }
  fs.writeFileSync(file, src);
}

console.log(
  `\n${APPLY ? '已标' : '可标'} ${total} 个模块对象，覆盖 ${totalDiags} 条诊断，涉及 ${byFile.size} 个文件；` +
    `跳过：赋值不足 ${MIN_ASSIGNS} 处 ${skip.fewAssigns} / 初值不是空对象 ${skip.notEmptyObj} / 已有标注 ${skip.annotated} / 解析不到 ${skip.unresolved}`,
);
