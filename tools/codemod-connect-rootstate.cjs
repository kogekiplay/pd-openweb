/**
 * 给 connect 的 mapStateToProps 标上 RootState（一次性工具）
 *
 *   connect(state => ({ ...state.sheet }))
 *   → connect((state: RootState) => ({ ...state.sheet }))
 *
 * 【为什么要做】react-redux 8 里有 DefaultRootState，可以靠一次模块增强
 * 让全仓的 connect 都拿到 state 类型；9 把它【删了】。于是 mapStateToProps
 * 的参数退化成 unknown，全仓 `state.sheet` / `state.mobile` 齐刷刷报
 * TS2339「Property 'sheet' does not exist on type 'unknown'」。
 * 这不是哪个文件写错了，是缺一个类型出口 —— 见 src/redux/types.ts。
 *
 * 实测单点效果（src/pages/worksheet/common/Sheet/ViewControl.tsx）：
 * 该文件诊断 27 → 9，且【没有新增 key】，全仓总数 23393 → 23375。
 *
 * 【为什么用 AST 定位但手工拼字符串】babel 的 generator 会把整个文件重新
 * 打印一遍，几百个文件的 diff 会变成无法审阅的全量重排。这里只取参数节点的
 * start/end，按【倒序】逐处splice 原文，格式零扰动。
 *
 * 【括号的判定】箭头函数单参数可以不带括号（state => ...），标类型时必须补上。
 * 不能靠"看参数前一个非空白字符是不是 ("来判断 —— connect(state => ...) 里
 * 参数前面正好就是 connect 的那个左括号。正确的判据是
 * arrow.start === param.start：不带括号时二者重合，带括号时 arrow.start 指向 '('。
 *
 * 覆盖 connect 第一个实参的三种形态（扫描器分类，见
 * tools/scan-redux-state-annotations.cjs）：
 *   a. 内联函数          189 处 / 187 文件   connect(state => ...)
 *   b. 同文件具名函数      56 处              connect(mapStateToProps)
 *                                            （52 个 const = 函数，4 个 function 声明；
 *                                             【没有】跨文件 import 的情形）
 *   c. 解构参数            11 处              connect(({ appPkg }) => ...)
 * 另有 2 处第一个实参写的就是标识符 `undefined`（connect(undefined, mapDispatch)），
 * 本来就没有 state 参数，不需要处理。
 *
 * 只处理 .ts / .tsx —— .js / .jsx 里写不了类型标注。实测目标站点全在 .tsx。
 * 工具幂等：已带 typeAnnotation 的参数会跳过，可以反复跑。
 * 运行后跑 prettier，import 顺序交给 sort-imports 插件收拾。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const IMPORT_LINE = "import type { RootState } from 'src/redux/types';";

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: [
    'jsx',
    'typescript',
    'decorators-legacy',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'objectRestSpread',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'topLevelAwait',
  ],
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0;
let sites = 0;
let importsAdded = 0;
const skipped = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('connect(')) continue;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch (err) {
    skipped.push(`${path.relative(ROOT, file)}: 解析失败 ${err.message}`);
    continue;
  }

  let edits = [];

  const FN_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

  // 给一个函数节点的首参标上 RootState
  function annotate(fn) {
    const param = fn && fn.params && fn.params[0];
    if (!param || param.typeAnnotation) return;

    if (param.type === 'ObjectPattern') {
      // ({ appPkg }) => ...  解构参数本来就带括号，直接在模式后面追加类型即可
      edits.push({ start: param.end, end: param.end, text: ': RootState' });
      return;
    }

    if (param.type !== 'Identifier') return;

    // 单参数不带括号的箭头函数：arrow.start 与 param.start 重合，补括号
    const needParens = fn.type === 'ArrowFunctionExpression' && fn.start === param.start;
    const text = `${param.name}: RootState`;

    edits.push({ start: param.start, end: param.end, text: needParens ? `(${text})` : text });
  }

  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 'connect') return;

      const arg = p.node.arguments[0];
      if (!arg) return;

      if (FN_TYPES.has(arg.type)) {
        annotate(arg);
        return;
      }

      // connect(mapStateToProps) —— 顺着作用域找到同文件里的定义再标。
      // `connect(undefined, mapDispatch)` 也走这里：undefined 查不到绑定，自然跳过。
      if (arg.type === 'Identifier') {
        const binding = p.scope.getBinding(arg.name);
        if (!binding) return;

        const node = binding.path.node;
        if (node.type === 'FunctionDeclaration') annotate(node);
        else if (node.type === 'VariableDeclarator' && node.init && FN_TYPES.has(node.init.type)) annotate(node.init);
      }
    },
  });

  if (!edits.length) continue;

  // 同一个具名函数可能被两处 connect 引用，去重，否则会重复插入类型
  const seen = new Set();
  edits = edits.filter(e => {
    const k = `${e.start}:${e.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 倒序 splice：先改后面的，前面的 start/end 才不会失效
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  // 已有 RootState 绑定就不重复引入
  if (!/\bRootState\b/.test(src)) {
    const lines = out.split('\n');
    // 插在【第一条】import 之前。不能按"最后一条 import 的行号 + 1"插：
    // 多行 import（import {\n a,\n} from 'x';）的首行也匹配 /^\s*import/，
    // 那样会把语句从中间劈开（本仓此前实测产出 110 条 TS1003/TS1005）。
    const firstImport = lines.findIndex(l => /^\s*import\b/.test(l));
    if (firstImport === -1) {
      skipped.push(`${path.relative(ROOT, file)}: 找不到 import 语句，未插入 RootState`);
    } else {
      lines.splice(firstImport, 0, IMPORT_LINE);
      out = lines.join('\n');
      importsAdded++;
    }
  }

  fs.writeFileSync(file, out);
  files++;
  sites += edits.length;
}

console.log(`标注 ${sites} 处 mapStateToProps，涉及 ${files} 个文件；新增 import ${importsAdded} 条`);
if (skipped.length) {
  console.log(`\n⚠ 跳过 ${skipped.length} 处:`);
  skipped.forEach(s => console.log('  ' + s));
}
