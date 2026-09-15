/**
 * 给「解构时给了 `= {}` 默认值」的绑定元素补形状（TS2339 on type '{}'）
 *
 *   const { base = {}, changes = {} } = getState();
 *   base.viewId            // Property 'viewId' does not exist on type '{}'
 *
 * 默认值 `{}` 把这一项的类型钉死成空对象字面量类型，之后读任何字段都报错。
 * 这一类在剩余 TS2339 里数量仅次于「空对象起手逐条挂属性」那一类。
 *
 * 【为什么不是直接删默认值】删了会改运行时：源对象真给 undefined 时，
 * 下游 `base.x` 会从「undefined」变成「当场抛」。只有在能确认那一项一定存在时
 * 才该删（combineReducers 的 slice 就是这种，本会话早先手工处理过几处）。
 * 这个工具不做那种判断，只放开类型。
 *
 * 单个绑定元素标不了类型，但整个解构目标可以：
 *   const { base = {}, foo }: { base: Record<string, any>; [key: string]: any } = x;
 * 索引签名让其余名字照旧，只把出问题的那几个放开。
 *
 * 【只在初值类型是 any 时改】初值是具体类型时，加注解等于要求它可赋值给带索引
 * 签名的类型 —— interface 没有隐式索引签名，会当场报错。any 则永远可赋值。
 * （和 codemod-domain-destructure-types.cjs 同一条约束，那边栽过。）
 *
 * 【只管变量声明的解构，不碰解构形参】形参标上去会让属性变必填，
 * 所有不传它的调用点齐刷刷 TS2741。原因详见
 * codemod-domain-destructure-types.cjs 的头注释。
 *
 * 用法：
 *   node tools/codemod-destructure-default-shape.cjs --list
 *   node tools/codemod-destructure-default-shape.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

// VariableDeclaration -> Set(出问题的属性名)
const targets = new Map();
const skip = { notBinding: 0, param: 0, notAnyInit: 0, annotated: 0, unresolved: 0 };

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
    if (!decl) {
      skip.unresolved += 1;
      continue;
    }
    if (!ts.isBindingElement(decl)) {
      skip.notBinding += 1;
      continue;
    }
    // 默认值必须就是 `{}`
    const init = decl.initializer;
    if (!init || !ts.isObjectLiteralExpression(init) || init.properties.length) {
      skip.notBinding += 1;
      continue;
    }
    // 往上找这条解构属于谁
    const pattern = decl.parent;
    const owner = pattern && pattern.parent;
    if (!owner || !ts.isVariableDeclaration(owner)) {
      skip.param += 1;
      continue;
    }
    if (owner.type) {
      skip.annotated += 1;
      continue;
    }
    if (!owner.initializer) continue;
    if (checker.typeToString(checker.getTypeAtLocation(owner.initializer)) !== 'any') {
      skip.notAnyInit += 1;
      continue;
    }
    if (!ts.isIdentifier(decl.name)) continue;

    if (!targets.has(owner)) targets.set(owner, { sf, names: new Set(), diags: 0 });
    const key = decl.propertyName && ts.isIdentifier(decl.propertyName) ? decl.propertyName.text : decl.name.text;
    targets.get(owner).names.add(key);
    targets.get(owner).diags += 1;
  }
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
for (const [owner, info] of targets) {
  const file = info.sf.fileName;
  if (!byFile.has(file)) byFile.set(file, { text: info.sf.getFullText(), ins: [] });
  const props = [...info.names].sort().map(n => `${n}: Record<string, any>`).join('; ');
  byFile.get(file).ins.push({
    pos: owner.name.end,
    text: `: { ${props}; [key: string]: any }`,
    names: [...info.names],
    diags: info.diags,
  });
  totalDiags += info.diags;
}

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.map(i => i.names.join('/')).join(', ')}`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + i.text + src.slice(i.pos);
  fs.writeFileSync(file, src);
}

console.log(
  `\n${APPLY ? '已标' : '可标'} ${total} 处解构，覆盖 ${totalDiags} 条诊断，涉及 ${byFile.size} 个文件；` +
    `跳过：不是 \`= {}\` 的绑定元素 ${skip.notBinding} / 解构形参 ${skip.param} / 初值不是 any ${skip.notAnyInit} / 已有标注 ${skip.annotated} / 解析不到 ${skip.unresolved}`,
);
