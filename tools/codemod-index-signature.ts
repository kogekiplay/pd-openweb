/**
 * ⚠ 【本脚本在 TypeScript 7 下已失效，跑不起来】
 * 7.0 是 Go 原生移植版，`require('typescript')` 只剩 { version, versionMajorMinor }，
 * ts.createProgram / ts.SyntaxKind / ts.sys 全部不存在，一执行就是
 * `TypeError: Cannot read properties of undefined`。
 * 保留它是作为当初那次迁移的【记录】（判据、踩过的坑、度量口径都在注释里）。
 * 要重新启用，按 tools/ts7.ts 的适配层改写 —— 那里写清了新 API 的形状和三个坑。
 */
/**
 * 【别用】给「当字典用的常量对象」补索引签名（TS7053）—— 试过了，不划算，留着是为了
 * 让下一个想干这事的人不用再试一遍。
 *
 * 想法：`const MAP = { a: 1 }` 后面 `MAP[key]`，开 noImplicitAny 后每个取值点报 TS7053。
 * 把 MAP 标成 `Record<string, T>`（T 由 checker 从字面量算出来）看着很对。
 *
 * 实测两个问题：
 * 1. 命中率极低。全仓 2161 条 TS7053 里，取值对象是「裸变量 + 对象字面量初值」的只有
 *    百来个；剩下 1165 条的取值对象是 this.state[k]、props.x[k]、import 进来的常量等，
 *    解析不回一个可改的声明。
 * 2. 标上去反而新增诊断。对象字面量的推断类型比 Record<string, T> 精确得多：
 *    - 把 'day' | 'month' 拉成 string，下游 dayjs().startOf(MAP[k]) 当场报 StartOf 不匹配
 *    - 值是对象/函数/类时，Record<string, {}> / Record<string, typeof X> 把下游推断钉死
 *    - 后面还往 MAP[k] 写值的（PivotTable），窄 T 会让赋值全红
 *    只收纯字面量、不 widen，也还剩 6 条新增。
 *
 * 结论：净收益 ~140 条，代价是 6 条新噪声 + 一堆精度损失。不做。
 * 真要治 TS7053，得从「取值对象本身是什么类型」入手，不是给字典补签名。
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');
const MAX_LEN = 120;

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, {
  ...cfg.options,
  noEmit: true,
  noImplicitAny: true, // TS7053 只有开了才报
});
const checker = program.getTypeChecker();

const targets = new Map(); // "file|pos" -> {file, pos, name, valueType, hits}
const skip = { annotated: 0, thirdParty: 0, badType: 0, spread: 0, notObjLiteral: 0, unresolved: 0 };

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC)) continue;
  for (const d of program.getSemanticDiagnostics(sf)) {
    if (d.code !== 7053 || d.start === undefined) continue;
    const access = findAccess(findNode(sf, d.start));
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
    const dsf = decl.getSourceFile();
    if (!dsf.fileName.startsWith(SRC)) {
      skip.thirdParty += 1;
      continue;
    }
    const init = decl.initializer;
    if (!init || !ts.isObjectLiteralExpression(init)) {
      skip.notObjLiteral += 1;
      continue;
    }
    if (init.properties.some(p => ts.isSpreadAssignment(p))) {
      skip.spread += 1;
      continue;
    }

    const key = `${dsf.fileName}|${decl.name.end}`;
    if (targets.has(key)) {
      targets.get(key).hits += 1;
      continue;
    }

    const objType = checker.getTypeAtLocation(init);
    const props = checker.getPropertiesOfType(objType);
    if (!props.length) {
      skip.badType += 1;
      continue;
    }
    const parts = new Set();
    let bad = false;
    for (const p of props) {
      const t = checker.getTypeOfSymbolAtLocation(p, init);
      const s = checker.typeToString(t, init, ts.TypeFormatFlags.NoTruncation);
      // import("/abs/path/...") 会被原样写进源码，绝对路径一写就废
      if (/\bany\b/.test(s) || s.includes('...') || s.includes('import(') || s.length > MAX_LEN) bad = true;
      // 【不能 widen】：把 'day' | 'month' 拉成 string 会丢掉真信息，
      // 下游 dayjs().startOf(MAP[k]) 立刻报 StartOf 不匹配。字面量原样留着。
      // 只收纯字面量/原始类型；对象、函数、类一律不收 —— 那些一标就把
      // 下游推断钉死（Record<string, {}> / typeof X 联合都试过，反而新增诊断）。
      if (!/^(-?\d+(\.\d+)?|(['"`]).*\3|true|false|string|number|boolean|null|undefined)$/.test(s)) bad = true;
      parts.add(s);
    }
    const union = [...parts].sort().join(' | ');
    if (bad || union.length > MAX_LEN) {
      skip.badType += 1;
      continue;
    }
    targets.set(key, { file: dsf.fileName, pos: decl.name.end, name: decl.name.text, union, hits: 1, text: dsf.getFullText() });
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
function findAccess(node) {
  for (let n = node; n; n = n.parent) if (ts.isElementAccessExpression(n)) return n;
  return null;
}

// 按文件聚合改写
const byFile = new Map();
for (const t of targets.values()) {
  if (!byFile.has(t.file)) byFile.set(t.file, { text: t.text, ins: [] });
  byFile.get(t.file).ins.push(t);
}

let total = 0;
let hits = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  bucket.ins.forEach(t => (hits += t.hits));
  console.log(
    `${path.relative(ROOT, file)}: ${bucket.ins.map(t => `${t.name}: Record<string, ${t.union}>（${t.hits} 处取值）`).join(', ')}`,
  );
  if (!APPLY) continue;
  let src = bucket.text;
  for (const t of bucket.ins) {
    src = src.slice(0, t.pos) + `: Record<string, ${t.union}>` + src.slice(t.pos);
  }
  fs.writeFileSync(file, src);
}

console.log(`\n${APPLY ? '已标' : '可标'} ${total} 个字典对象，覆盖 ${hits} 个取值点`);
console.log(
  `跳过：已有标注 ${skip.annotated} / 第三方 ${skip.thirdParty} / 值类型不可用 ${skip.badType} / 含 spread ${skip.spread} / 非对象字面量 ${skip.notObjLiteral} / 解析不到 ${skip.unresolved}`,
);
