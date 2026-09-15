/**
 * 给 `useState()`（不带初值）补上显式类型参数（一次性工具）
 *
 * 【问题】useState() 不传初值时 TS 把它推成 useState<undefined>，
 * setter 的签名于是只剩 `(value: undefined | ((prev: undefined) => undefined))`。
 * 之后任何 setX(真实值) 都报
 *   TS2345: Argument of type 'boolean' is not assignable to parameter of
 *           type '(prevState: undefined) => undefined'
 * 实测全仓 156 处这么写，引发 177 条诊断、涉及 64 个文件。
 *
 * 【类型从哪来 —— 不猜】tsc 的报错信息里【已经写明】实际传进去的是什么类型
 *（上面那条就是 'boolean'）。本工具直接读 tsc 输出，把诊断位置映射回
 * 对应的 setter，再回到它的 useState() 声明处补 <T | undefined>。
 * 也就是说类型是【测出来的】，不是从变量名或默认值猜的。
 *
 * 【只处理确定的形态】收集到的类型全部落在 boolean / string / number 里才改写；
 * 出现对象字面量之类的复杂类型就跳过并列出来，留给人工看 ——
 * 那些往往意味着该定一个具名接口，不适合机械展开。
 *
 * 用法：
 *   npx tsc --noEmit --pretty false > /tmp/tsc.txt 2>&1
 *   node tools/codemod-usestate-explicit-type.ts /tmp/tsc.txt [--dry]
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const [, , tscOutPath, ...flags] = process.argv;
const DRY = flags.includes('--dry');

if (!tscOutPath) {
  console.error('用法: node tools/codemod-usestate-explicit-type.ts <tsc 输出文件> [--dry]');
  process.exit(2);
}

const SIMPLE = new Set(['boolean', 'string', 'number']);

// tsc 诊断头行： path(line,col): error TSxxxx: message
const DIAG = /^(.+?)\((\d+),(\d+)\): error TS2345: Argument of type '([^']+)' is not assignable to parameter of type '\(prevState: undefined\) => undefined'\.$/;

// file -> [{ line, col, type }]
const byFile = new Map();

for (const raw of fs.readFileSync(tscOutPath, 'utf8').split('\n')) {
  const m = raw.match(DIAG);
  if (!m) continue;
  const [, file, line, col, type] = m;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line: Number(line), col: Number(col), type });
}

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

let changedFiles = 0;
let changedSites = 0;
const skipped = [];

for (const [rel, diags] of byFile) {
  const file = path.resolve(ROOT, rel);
  if (!fs.existsSync(file)) {
    skipped.push(`${rel} —— 文件不存在`);
    continue;
  }

  const src = fs.readFileSync(file, 'utf8');
  let ast;

  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch (err) {
    skipped.push(`${rel} —— 解析失败：${err.message}`);
    continue;
  }

  // setter 名 -> 该 setter 被传过的类型集合
  const typesBySetter = new Map();
  // setter 名 -> 对应 useState() 调用节点
  const declBySetter = new Map();

  traverse(ast, {
    VariableDeclarator(p) {
      const { id, init } = p.node;
      if (id.type !== 'ArrayPattern' || id.elements.length !== 2) return;
      if (!init || init.type !== 'CallExpression') return;
      // 只认无参、无类型参数的 useState()
      if (init.callee.type !== 'Identifier' || init.callee.name !== 'useState') return;
      if (init.arguments.length !== 0 || init.typeParameters) return;
      const setter = id.elements[1];
      if (!setter || setter.type !== 'Identifier') return;
      declBySetter.set(setter.name, init);
    },
    CallExpression(p) {
      const { callee, arguments: args } = p.node;
      if (callee.type !== 'Identifier' || !args.length) return;
      const arg = args[0];
      // 诊断指向的是【实参】的位置
      const hit = diags.find(d => d.line === arg.loc.start.line && d.col === arg.loc.start.column + 1);
      if (!hit) return;
      if (!typesBySetter.has(callee.name)) typesBySetter.set(callee.name, new Set());
      typesBySetter.get(callee.name).add(hit.type);
    },
  });

  // 从后往前替换，避免前面的改动使后面的偏移失效
  const edits = [];

  for (const [setter, types] of typesBySetter) {
    const decl = declBySetter.get(setter);

    if (!decl) {
      skipped.push(`${rel} —— ${setter} 的 useState() 声明没找到（可能不是无参形态）`);
      continue;
    }

    const bad = [...types].filter(t => !SIMPLE.has(t));

    if (bad.length) {
      skipped.push(`${rel} —— ${setter} 涉及复杂类型，建议定具名接口：${bad.join(' | ')}`);
      continue;
    }

    const union = [...types].sort().join(' | ');
    edits.push({ start: decl.callee.end, text: `<${union} | undefined>` });
  }

  if (!edits.length) continue;

  let out = src;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.start);
  }

  if (!DRY) fs.writeFileSync(file, out);
  changedFiles++;
  changedSites += edits.length;
  console.log(`  ${rel}  ${edits.length} 处`);
}

console.log(`\n${DRY ? '[dry-run] ' : ''}改写 ${changedFiles} 个文件 / ${changedSites} 处 useState`);

if (skipped.length) {
  console.log(`\n跳过 ${skipped.length} 处（需人工判断）：`);
  skipped.forEach(s => console.log('  ' + s));
}
