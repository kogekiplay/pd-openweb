/**
 * 给 `= null` 起手的变量 / 形参 / 类字段补类型（TS2339 on 'never'）
 *
 * strictNullChecks 下 `let out = null` 把 out 推成 `null`，
 * 之后 `if (out) { out.foo }` 里 out 被收窄成 `never`，于是每一处读取都报
 * 「属性不存在于 never」。实测这一类占 TS2339 on 'never' 的绝大多数（2452 条）。
 *
 * 【类型从哪来 —— 不猜，测】看函数体 / 作用域里【实际赋给它的是什么】：
 *   let current = null;
 *   current = rows[i];        // ← 这一句就说明了 current 是什么
 * 把所有赋值点的类型取出来求并集，再并上 null。这是 TS 自己会做的推断，
 * 只是初值是 null 时它不做（控制流分析只对 `let x;` 这种无初值的做「演进类型」）。
 *
 * 【只写得出可移植的类型】checker 打印的类型名可能是别处的本地类型，
 * 直接写进源码就是未定义标识符。所以只接受白名单里的原始类型及其数组/联合。
 * 任何一个赋值点是 any 就整个跳过 —— 不拿 any 充数。
 *
 * 用法：
 *   node tools/codemod-null-init-types.cjs --list
 *   node tools/codemod-null-init-types.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');
const MAX_LEN = 60;

const PORTABLE = new Set([
  'string',
  'number',
  'boolean',
  'Date',
  'RegExp',
  'File',
  'Blob',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Event',
]);
// 这几个不在 PORTABLE 里但同样可直接写：ApiResult 是 types/global.d.ts 里的全局
// 声明，NodeJS.Timeout 是 @types/node 的全局命名空间，React.JSX.Element 只在
// 文件本来就 import 了 react 时才用（不新增第三方 import）。
const GLOBAL_OK = new Set(['ApiResult', 'NodeJS.Timeout']);
const isReactType = x => /^React\.[A-Za-z.]+$/.test(x);

const ok = (s, text) => {
  const base = s.endsWith('[]') ? s.slice(0, -2) : s;
  if (PORTABLE.has(base) || GLOBAL_OK.has(base)) return true;
  // 字符串 / 数字 / 布尔字面量照收
  if (/^(['"`]).*\1$/.test(base) || /^-?\d+(\.\d+)?$/.test(base) || base === 'true' || base === 'false') return true;
  if (isReactType(base)) return /from ['"]react['"]/.test(text);
  return false;
};

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.strictprobe.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const targets = new Map(); // decl -> {sf, name, types:Set, dirty, writes}
const stat = { noWrite: 0, dirty: 0, tooWide: 0, ok: 0, mixed: 0 };

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;

  const decls = [];
  (function collect(n) {
    const isNullInit =
      n.initializer && n.initializer.kind === ts.SyntaxKind.NullKeyword && !n.type && n.name && ts.isIdentifier(n.name);
    if (isNullInit && (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isPropertyDeclaration(n))) {
      decls.push(n);
    }
    n.forEachChild(collect);
  })(sf);
  if (!decls.length) continue;

  for (const decl of decls) {
    const name = decl.name.text;
    // 作用域：形参/变量看它所在的函数，类字段看整个类
    let scope = decl.parent;
    while (scope && !ts.isBlock(scope) && !ts.isSourceFile(scope) && !ts.isClassDeclaration(scope)) scope = scope.parent;
    if (!scope) continue;

    const rec = { sf, name, types: new Set(), dirty: false, writes: 0, pos: decl.name.end };
    (function walk(n) {
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left) &&
        n.left.text === name
      ) {
        // 确认左边解析到的就是这个声明，别被同名变量骗了
        const sym = checker.getSymbolAtLocation(n.left);
        if (sym && sym.valueDeclaration === decl) {
          rec.writes += 1;
          // 【不要 widen】字面量原样留着。把 'day' 拉成 string 会丢掉真信息 ——
          // 下游 moment(x).isSame(y, m) 当场报 m 不是 StartOf。
          // 这里能这么做是因为赋值点是【全收齐的】，联合体就是完整取值集合。
          const t = checker.getTypeAtLocation(n.right);
          const s = checker.typeToString(t, n.right, ts.TypeFormatFlags.NoTruncation);
          s.split('|')
            .map(x => x.trim())
            .forEach(x => {
              if (x === 'null' || x === 'undefined') return;
              if (!ok(x, sf.text)) rec.dirty = true;
              else rec.types.add(x);
            });
        }
      }
      n.forEachChild(walk);
    })(scope);

    if (!rec.writes) {
      stat.noWrite += 1;
      continue;
    }
    if (rec.dirty || !rec.types.size) {
      stat.dirty += 1;
      continue;
    }
    // 【只收「只被赋过一种类型」的】赋过两种以上说明这个变量被复用成了不同的东西
    //（实测撞到 `string | string[]`、`string | ApiResult` 这种），
    // 并起来写进类型只会让下游读取更难受：ApiResult 那条马上就 .abort() 报错。
    if (rec.types.size > 1 && [...rec.types].some(x => !/^(['"`]).*\1$/.test(x))) {
      stat.mixed += 1;
      continue;
    }
    const u = [...rec.types, 'null'].sort().join(' | ');
    if (u.length > MAX_LEN) {
      stat.tooWide += 1;
      continue;
    }
    stat.ok += 1;
    targets.set(decl, { ...rec, type: u });
  }
}

const byFile = new Map();
for (const [, info] of targets) {
  const file = info.sf.fileName;
  if (!byFile.has(file)) byFile.set(file, { text: info.sf.getFullText(), ins: [] });
  byFile.get(file).ins.push({ pos: info.pos, type: info.type, name: info.name });
}

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.map(i => `${i.name}: ${i.type}`).join(', ')}`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + `: ${i.type}` + src.slice(i.pos);
  fs.writeFileSync(file, src);
}

console.log(
  `\n${APPLY ? '已标' : '可标'} ${total} 处；跳过：作用域里没有赋值 ${stat.noWrite} / ` +
    `赋值里有 any 或非白名单类型 ${stat.dirty} / 被赋过多种类型 ${stat.mixed} / 并集过长 ${stat.tooWide}`,
);
