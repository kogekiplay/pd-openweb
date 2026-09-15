/**
 * 把「实际上可以不传」的参数标成可选（TS2554: Expected N arguments, but got M）
 *
 * 背景：本仓大量函数是从 JS 迁过来的，声明写了 N 个形参，但调用方长期只传 M 个
 * （M < N），靠 JS 的 undefined 兜底。开了 strict 之后这些全报 TS2554。
 * 真实契约就是「第 M+1 个开始是可选的」—— 补 `?` 是把既有事实写进类型，
 * 不是塞 any。纯类型层改动，babel 的 TS preset 会直接抹掉，零运行时影响。
 *
 * 靠 TypeScript 自己的 checker 把调用点解析回声明，不做名字猜测。
 *
 * 【不动】的几种形参：
 *   - 已经有 `?` 或有默认值的（本来就可选）
 *   - 剩余参数 `...args`
 *   - 解构形参 `{a, b}` 且没有默认值 —— 标成可选后真传 undefined 会当场解构崩，
 *     那是把类型谎报成运行时安全，比报错更糟
 *   - 声明不在 src/ 下的（第三方 .d.ts）
 *   - this 形参
 *
 * 用法：
 *   node tools/codemod-optional-params.cjs --list   # 只统计
 *   node tools/codemod-optional-params.cjs          # 改写
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');

const cfgPath = path.join(ROOT, 'tsconfig.json');
const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(cfgPath, ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
// 只要 TS2554，不需要 strict；用仓库原配置跑最快
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const edits = new Map(); // file -> Set<pos>
let seenCalls = 0;
let skipped = { thirdParty: 0, pattern: 0, rest: 0, unresolved: 0, overload: 0 };

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  for (const d of program.getSemanticDiagnostics(sf)) {
    if (d.code !== 2554 || d.start === undefined) continue;
    const node = findNode(sf, d.start);
    const call = findCall(node);
    if (!call) continue;
    const argc = call.arguments.length;

    const sig = checker.getResolvedSignature(call);
    const decl = sig && sig.getDeclaration();
    if (!decl || !decl.parameters) {
      skipped.unresolved += 1;
      continue;
    }
    if (decl.parameters.length <= argc) continue; // 多传，不是少传
    const dsf = decl.getSourceFile();
    if (!dsf.fileName.startsWith(SRC)) {
      skipped.thirdParty += 1;
      continue;
    }
    // 有重载的不碰：改一个签名会悄悄改变重载选择
    const sym = sig.getDeclaration() && checker.getSymbolAtLocation(call.expression);
    if (sym && sym.declarations && sym.declarations.filter(ts.isFunctionDeclaration).length > 1) {
      skipped.overload += 1;
      continue;
    }

    seenCalls += 1;
    let ok = true;
    const pending = [];
    for (let i = argc; i < decl.parameters.length; i++) {
      const p = decl.parameters[i];
      if (p.dotDotDotToken) {
        skipped.rest += 1;
        ok = false;
        break;
      }
      if (p.questionToken || p.initializer) continue; // 已可选
      if (!ts.isIdentifier(p.name)) {
        // 解构形参没默认值：标可选 = 运行时会崩的谎
        skipped.pattern += 1;
        ok = false;
        break;
      }
      pending.push(p.name.end);
    }
    if (!ok || !pending.length) continue;
    if (!edits.has(dsf.fileName)) edits.set(dsf.fileName, { text: dsf.getFullText(), ins: new Map() });
    const bucket = edits.get(dsf.fileName);
    pending.forEach(pos => bucket.ins.set(pos, '?'));
    // 无括号单参箭头（`x => ...`）补不了 `?`，要连括号一起补
    if (ts.isArrowFunction(decl) && decl.parameters.length === 1) {
      const p0 = decl.parameters[0];
      const start = p0.getStart();
      // 往前找 '(' 会撞上外层调用的括号（useCallback(e => ...)）。
      // 只看箭头函数自己的起点到形参之间那一小段。
      const head = bucket.text.slice(decl.getStart(), start);
      if (!head.includes('(')) {
        bucket.ins.set(start, '(');
        bucket.ins.set(p0.end, (bucket.ins.get(p0.end) || '') + ')');
      }
    }
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

function findCall(node) {
  for (let n = node; n; n = n.parent) {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) return n;
  }
  return null;
}

let total = 0;
for (const [file, bucket] of [...edits].sort()) {
  const positions = [...bucket.ins.keys()].sort((a, b) => b - a);
  const n = [...bucket.ins.values()].filter(v => v.includes('?')).length;
  total += n;
  console.log(`${path.relative(ROOT, file)}: ${n} 个形参`);
  if (!APPLY) continue;
  // 必须用 TS 自己的 text：仓里不少文件带 BOM，fs 读出来会多一个字符，
  // 直接拿 node.end 当偏移会整体错一位（masterDat?a 这种）
  let src = bucket.text;
  for (const pos of positions) src = src.slice(0, pos) + bucket.ins.get(pos) + src.slice(pos);
  fs.writeFileSync(file, src);
}

console.log(
  `\n${APPLY ? '已标' : '可标'} ${total} 个形参为可选，涉及 ${edits.size} 个文件（命中调用点 ${seenCalls}）`,
);
console.log(`跳过：第三方声明 ${skipped.thirdParty} / 解构形参 ${skipped.pattern} / 剩余参数 ${skipped.rest} / 重载 ${skipped.overload} / 解析不到 ${skipped.unresolved}`);
