/**
 * 扫描全仓「redux state 参数没标类型」的位置（只统计，不改文件）。
 *
 * 背景：react-redux 9 删掉了 DefaultRootState，connect 的 mapStateToProps、
 * useSelector 的 selector 都拿不到默认 state 类型，参数直接是 unknown，
 * 于是 state.sheet / state.mobile 一律报 TS2339
 * 「Property 'sheet' does not exist on type 'unknown'」。
 *
 * 用 AST 而不是正则：这些调用的实参普遍是带箭头函数的多行对象字面量，
 * `connect\((.*?)=>` 这类模式会在嵌套的 `=>` 处截断，数出来的量没有意义
 * （本仓此前在 <Trigger> 上实测把 6 报成 113）。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx|ts|js)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

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

// 参数「没标类型」= 是个裸 Identifier 且没有 typeAnnotation。
// 解构参数（{ sheet } => ...）不在改写范围内：给它标类型是另一种写法，
// 且本仓几乎不用，单独列出来以免被静默漏掉。
function classifyFirstParam(fn) {
  if (!fn || !fn.params || !fn.params.length) return 'no-param';
  const p = fn.params[0];
  if (p.type === 'ObjectPattern') return 'destructured';
  if (p.type !== 'Identifier') return 'other';
  return p.typeAnnotation ? 'annotated' : 'bare';
}

const FN = new Set(['ArrowFunctionExpression', 'FunctionExpression']);
const stats = {};
const bump = (k, file) => ((stats[k] ??= { count: 0, files: new Set() }).count++, stats[k].files.add(file));
const parseFailures = [];

for (const file of walk(SRC)) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), PARSE_OPTS);
  } catch (err) {
    parseFailures.push(`${path.relative(ROOT, file)}: ${err.message}`);
    continue;
  }

  const rel = path.relative(ROOT, file);

  traverse(ast, {
    // 注意：babel traverse 的 visitor【不能有返回值】（会抛
    // "Unexpected return value from visitor method"），所以这里不能写 `return bump(...)`。
    CallExpression(p) {
      const callee = p.node.callee;
      const name = callee.type === 'Identifier' ? callee.name : null;
      if (!name) return;

      if (name === 'connect') {
        const arg = p.node.arguments[0];
        if (!arg) bump('connect: 无 mapStateToProps', rel);
        else if (FN.has(arg.type)) bump(`connect 内联函数: ${classifyFirstParam(arg)}`, rel);
        else if (arg.type === 'Identifier') bump('connect: 传具名函数（需另行处理）', rel);
        else bump('connect: 其它形态', rel);
        return;
      }

      if (name === 'useSelector') {
        const arg = p.node.arguments[0];
        if (arg && FN.has(arg.type)) bump(`useSelector 内联函数: ${classifyFirstParam(arg)}`, rel);
        else if (arg) bump('useSelector: 非内联函数', rel);
      }
    },
  });
}

const rows = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
for (const [k, v] of rows) console.log(`${String(v.count).padStart(4)} 处 / ${String(v.files.size).padStart(3)} 文件  ${k}`);
if (parseFailures.length) {
  console.log(`\n解析失败 ${parseFailures.length} 个文件:`);
  parseFailures.slice(0, 10).forEach(f => console.log('  ' + f));
}

// 扩展名分布：.js/.jsx 里写不了类型标注，必须单列出来
const bare = stats['connect 内联函数: bare'];
if (bare) {
  const byExt = {};
  for (const f of bare.files) {
    const e = path.extname(f);
    byExt[e] = (byExt[e] || 0) + 1;
  }
  console.log('\nbare 站点的文件扩展名分布：');
  for (const [e, n] of Object.entries(byExt).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${e}`);
}
