/**
 * ⚠ 【本脚本在 TypeScript 7 下已失效，跑不起来】
 * 7.0 是 Go 原生移植版，`require('typescript')` 只剩 { version, versionMajorMinor }，
 * ts.createProgram / ts.SyntaxKind / ts.sys 全部不存在，一执行就是
 * `TypeError: Cannot read properties of undefined`。
 * 保留它是作为当初那次迁移的【记录】（判据、踩过的坑、度量口径都在注释里）。
 * 要重新启用，按 tools/ts7.ts 的适配层改写 —— 那里写清了新 API 的形状和三个坑。
 */
/**
 * 给 jQuery 回调补 `this: HTMLElement` 形参（TS2683）
 *
 * `$(...).on('click', function () { $(this).hide(); })` 里的 this 是隐式 any。
 * jQuery 调这些回调时把当前 DOM 元素绑成 this —— 这是 jQuery 的既定契约，
 * 不是猜测。TS 的 `this` 形参是纯类型语法，babel 直接抹掉，零运行时影响。
 *
 * 【判据要收紧】：只有当这个函数体里确实出现 `$(this)` 时才动。
 * 光看「函数里用了 this」不够 —— 对象方法、类方法、以及被 call/apply 绑了别的
 * 东西的函数，this 都不是 DOM 元素，标上去就是错的。
 *
 * 【不碰】：
 *   - 箭头函数（语法上就不能有 this 形参；它的 this 来自外层，
 *     真要修得去修外层那个 function）
 *   - 已经有 this 形参的
 *   - 不在 src/*.ts(x) 下的（allowJs 把 .js 也拉进 program 了）
 *
 * 用法：
 *   node tools/codemod-jquery-this-param.ts --list
 *   node tools/codemod-jquery-this-param.ts
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
const program = ts.createProgram(cfg.fileNames, {
  ...cfg.options,
  noEmit: true,
  noImplicitThis: true, // TS2683 只有开了才报
});

const byFile = new Map();
const skip = { arrow: 0, noDollarThis: 0, already: 0, noFn: 0, ctor: 0 };

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  for (const d of program.getSemanticDiagnostics(sf)) {
    if (d.code !== 2683 || d.start === undefined) continue;

    // 往上找最近的「能带 this 形参」的函数
    let n = findNode(sf, d.start);
    let fn = null;
    for (; n; n = n.parent) {
      if (ts.isArrowFunction(n)) continue; // 箭头的 this 来自外层，继续往上
      if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) {
        fn = n;
        break;
      }
    }
    if (!fn || !fn.body) {
      skip.noFn += 1;
      continue;
    }
    const first = fn.parameters[0];
    if (first && first.name.getText() === 'this') {
      skip.already += 1;
      continue;
    }
    const body = fn.body.getText();
    if (!/\$\(\s*this\s*\)/.test(body)) {
      skip.noDollarThis += 1;
      continue;
    }
    // 构造函数写法：`var AddTask = function (opts) { this.settings = ... }`。
    // 这里的 this 是正在构造的实例，不是 DOM 元素 —— 哪怕它也对 this 调了 $()。
    // 判据就是「往 this 上写属性」，DOM 回调不会这么干。
    if (/\bthis\.\w+\s*=[^=]/.test(body)) {
      skip.ctor += 1;
      continue;
    }

    const file = sf.fileName;
    if (!byFile.has(file)) byFile.set(file, { text: sf.getFullText(), pos: new Set() });
    // 插在形参列表左括号之后
    const open = fn.getChildren().find(c => c.kind === ts.SyntaxKind.OpenParenToken);
    if (!open) continue;
    byFile.get(file).pos.add({ at: open.end, hasOthers: fn.parameters.length > 0 });
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

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  // 同一个函数可能被多条诊断命中，按插入点去重
  const uniq = [...new Map([...bucket.pos].map(p => [p.at, p])).values()].sort((a, b) => b.at - a.at);
  total += uniq.length;
  console.log(`${path.relative(ROOT, file)}: ${uniq.length} 个回调`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const p of uniq) {
    src = src.slice(0, p.at) + 'this: HTMLElement' + (p.hasOthers ? ', ' : '') + src.slice(p.at);
  }
  fs.writeFileSync(file, src);
}

console.log(
  `\n${APPLY ? '已补' : '可补'} ${total} 个回调的 this 形参，涉及 ${byFile.size} 个文件；` +
    `跳过：函数体里没有 $(this) ${skip.noDollarThis} / 构造函数写法 ${skip.ctor} / 已有 this 形参 ${skip.already} / 找不到可标注的函数 ${skip.noFn}`,
);
