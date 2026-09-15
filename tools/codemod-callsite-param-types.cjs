/**
 * 用【调用点】把没标注的形参类型推出来
 *
 * TS 对泛型函数会从实参推类型，对普通函数不会 —— 形参没标注就是隐式 any，
 * 哪怕全仓每个调用点传进去的都是 string。这个工具把 TS 本来就有能力算、
 * 只是不会去算的那一步补上：扫全程序的调用点，取第 i 个实参的类型求并集。
 *
 * 这是【真推断】，不是按名字猜：证据就是代码里实际传了什么。
 *
 * 【只写得出「可移植」的类型】。checker 打印出来的类型名可能是别的文件里的
 * 本地类型，直接写进源码就是未定义标识符。所以只接受一张白名单里的原始类型
 * 及其数组/联合（string / number / boolean / Date / File / ...）。
 * 拿不到白名单内的类型就【不动】—— 不写 any 充数。
 *
 * 【不碰】：
 *   - 已有类型标注、解构形参、剩余参数、有默认值的（默认值那批归
 *     codemod-array-param-types.cjs）
 *   - 无括号单参箭头 `x => ...`：补括号要跟类型标注抢同一个偏移，
 *     顺序错一下就变成给箭头标返回类型（详见 codemod-domain-variable-types.cjs
 *     头注释第 3 条）。这里直接跳过，不值得为它冒险。
 *   - 声明不在 src/*.ts(x) 下的（allowJs 把 .js 也拉进 program 了）
 *   - 任何一个调用点传的是 any —— 说明这个位置本来就什么都可能进来
 *
 * 用法：
 *   node tools/codemod-callsite-param-types.cjs --list
 *   node tools/codemod-callsite-param-types.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');
const MAX_LEN = 60;

/**
 * 这几个文件里，调用点推出来的类型跟函数体里的用法确实对不上。差分闸门挡出来的，
 * 多半是本来就有的不一致（标上只是把它翻出来），这一轮不处理。
 */
const EXCLUDE = [
  'src/components/Form/DesktopForm/widgets/Embed/index.tsx', // currentTimeForSecond 在下游被声明成 boolean
  'src/components/Form/MobileForm/widgets/Embed/index.tsx',
  'src/pages/Admin/integration/platformIntegration/microsoft/index.tsx', // 有调用点往 string 位传 true
  'src/pages/task/containers/folderChart/folderChart.tsx',
];

// 白名单：这些名字在任何文件里都可用，写进源码不需要 import
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
const isPortable = s =>
  s
    .split('|')
    .map(x => x.trim())
    .every(x => PORTABLE.has(x) || (x.endsWith('[]') && PORTABLE.has(x.slice(0, -2))));

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

// 1) 收候选形参
const params = new Map();
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  if (EXCLUDE.some(e => path.relative(ROOT, sf.fileName).startsWith(e))) continue;
  (function visit(n) {
    if (
      ts.isParameter(n) &&
      !n.type &&
      !n.initializer &&
      !n.dotDotDotToken &&
      ts.isIdentifier(n.name) &&
      n.name.text !== 'this'
    ) {
      const fn = n.parent;
      // 无括号单参箭头：跳过
      if (ts.isArrowFunction(fn) && fn.parameters.length === 1) {
        const head = sf.text.slice(fn.getStart(), n.getStart());
        if (!head.includes('(')) {
          n.forEachChild(visit);
          return;
        }
      }
      // 函数体里还会往这个形参上写别的值的，不碰 —— 调用点的并集只覆盖「传进来的」，
      // 覆盖不了「进来以后又被赋成什么」。SpecificFieldsValue 和 ResourceView/util
      // 都是这么中招的：调用点全传 string，函数里又赋了个 number。
      if (isReassigned(fn, n.name.text)) {
        n.forEachChild(visit);
        return;
      }
      params.set(n, { sf, name: n.name.text, types: new Set(), dirty: false, hits: 0 });
    }
    n.forEachChild(visit);
  })(sf);
}

function isReassigned(fn, name) {
  const body = fn.body;
  if (!body) return false;
  let found = false;
  (function walk(n) {
    if (found) return;
    if (
      ts.isBinaryExpression(n) &&
      ts.isIdentifier(n.left) &&
      n.left.text === name &&
      n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      found = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
      ts.isIdentifier(n.operand) &&
      n.operand.text === name
    ) {
      found = true;
      return;
    }
    n.forEachChild(walk);
  })(body);
  return found;
}

// 2) 扫调用点灌类型
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  (function visit(n) {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const sig = checker.getResolvedSignature(n);
      const decl = sig && sig.getDeclaration();
      if (decl && decl.parameters) {
        const args = n.arguments || [];
        decl.parameters.forEach((p, i) => {
          const rec = params.get(p);
          if (!rec || i >= args.length) return;
          rec.hits += 1;
          const t = checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[i]));
          const s = checker.typeToString(t, args[i], ts.TypeFormatFlags.NoTruncation);
          if (s === 'undefined' || s === 'null' || s === 'never') return;
          if (!isPortable(s)) {
            rec.dirty = true;
            return;
          }
          s.split('|').forEach(x => rec.types.add(x.trim()));
        });
      }
    }
    n.forEachChild(visit);
  })(sf);
}

// 3) 定型
const byFile = new Map();
const stat = { ok: 0, dirty: 0, noCall: 0, tooWide: 0 };
for (const [node, rec] of params) {
  // 【至少两个调用点】。单个调用点的证据太薄：实参类型本身可能来自第三方泛型，
  // 而那个泛型未必对得上运行时。columnRules 的 filterUnAvailable 只有一处调用，
  // 实参是 antd Select 的 onChange 形参、被声明成 string，可函数体里通篇
  // `type === 5` 按数字用 —— 照着标就把错的那一半钉死了。
  if (rec.hits < 2) {
    stat.noCall += 1;
    continue;
  }
  if (rec.dirty || !rec.types.size) {
    stat.dirty += 1;
    continue;
  }
  const u = [...rec.types].sort().join(' | ');
  if (u.length > MAX_LEN) {
    stat.tooWide += 1;
    continue;
  }
  stat.ok += 1;
  const file = rec.sf.fileName;
  if (!byFile.has(file)) byFile.set(file, { text: rec.sf.getFullText(), ins: [] });
  // 【插在 ? 后面】：上一轮 codemod-optional-params 给不少形参补过 `?`，
  // name.end 在 `?` 之前，插进去会变成 `foo: boolean?` —— TS17019，
  // 而且整个签名跟着废掉，下游冒出一片看不懂的 "Expected N arguments"。
  const at = node.questionToken ? node.questionToken.end : node.name.end;
  byFile.get(file).ins.push({ pos: at, type: u, name: rec.name });
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
  `\n${APPLY ? '已标' : '可标'} ${total} 个形参（候选 ${params.size}）；` +
    `跳过：调用点少于 2 个 ${stat.noCall} / 有调用点传 any 或非白名单类型 ${stat.dirty} / 并集过长 ${stat.tooWide}`,
);
