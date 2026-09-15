/**
 * 调研：propTypes 声明的键，能覆盖组件【实际用到】的 props 吗？（只统计，不改文件）
 *
 * 这是「按 propTypes 生成接口」这条路的致命问题：propTypes 常常是不完整的。
 * 例如 Form/DesktopForm/widgets/Check：propTypes 只写了 disabled/value/onChange，
 * 而组件里解构了 7 个（还有 advancedSetting/hint/switchSize/formItemId）。
 * 只按 propTypes 生成接口并标到 props 上，多出来的那几个会立刻报 TS2339 ——
 * 也就是【改完比不改还差】。
 *
 * 所以先量清覆盖率，再决定这条路怎么走。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0;
let full = 0; // propTypes 覆盖了全部用到的 props
let partial = 0;
const missRatios = [];
const samples = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\.propTypes\s*=|static\s+propTypes/.test(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    continue;
  }

  const declared = new Set();
  const used = new Set();

  traverse(ast, {
    // propTypes 里声明的键
    AssignmentExpression(p) {
      const { left, right } = p.node;
      if (
        left.type === 'MemberExpression' &&
        left.property.type === 'Identifier' &&
        left.property.name === 'propTypes' &&
        right.type === 'ObjectExpression'
      ) {
        for (const pr of right.properties) {
          if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier') declared.add(pr.key.name);
        }
      }
    },
    ClassProperty(p) {
      if (p.node.key?.name === 'propTypes' && p.node.value?.type === 'ObjectExpression') {
        for (const pr of p.node.value.properties) {
          if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier') declared.add(pr.key.name);
        }
      }
    },
    // 实际用到的：从 props 解构、以及 this.props.x / props.x
    VariableDeclarator(p) {
      const { id, init } = p.node;
      if (id.type !== 'ObjectPattern' || !init) return;
      const isProps =
        (init.type === 'Identifier' && init.name === 'props') ||
        (init.type === 'MemberExpression' &&
          init.object.type === 'ThisExpression' &&
          init.property.name === 'props');
      if (!isProps) return;
      for (const pr of id.properties) {
        if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier') used.add(pr.key.name);
        if (pr.type === 'RestElement') used.add('...rest');
      }
    },
    MemberExpression(p) {
      const { object, property } = p.node;
      if (property.type !== 'Identifier') return;
      if (object.type === 'Identifier' && object.name === 'props') used.add(property.name);
      if (
        object.type === 'MemberExpression' &&
        object.object.type === 'ThisExpression' &&
        object.property.name === 'props'
      ) {
        used.add(property.name);
      }
    },
  });

  if (!declared.size || !used.size) continue;
  files++;

  const missing = [...used].filter(u => u !== '...rest' && !declared.has(u));

  if (!missing.length) full++;
  else {
    partial++;
    missRatios.push(missing.length / used.size);
    if (samples.length < 8) {
      samples.push(`${path.relative(ROOT, file)}  声明 ${declared.size} / 用到 ${used.size}，缺 ${missing.length}：${missing.slice(0, 5).join(', ')}`);
    }
  }
}

const avg = missRatios.length ? (missRatios.reduce((a, b) => a + b, 0) / missRatios.length) * 100 : 0;
console.log(`同时有 propTypes 和 props 使用点的组件：${files}`);
console.log(`  propTypes 覆盖完整：${full}（${((full / files) * 100).toFixed(1)}%）`);
console.log(`  有遗漏：${partial}，平均遗漏比例 ${avg.toFixed(1)}%`);
console.log('\n遗漏样例：');
samples.forEach(s => console.log('  ' + s));

/*
 * ── 实测结论（2026-09-14）────────────────────────────────────────────
 * 同时有 propTypes 和 props 使用点的组件 629 个：
 *   propTypes 覆盖完整       210（33.4%）
 *   有遗漏                   419，平均遗漏 43.4%
 *
 * 所以【不能】简单地"按 propTypes 生成接口并标到 props 上" ——
 * 那会让 2/3 的组件因为用到未声明的 prop 而报 TS2339，改完比不改更差。
 *
 * 可行的变体（留给后续）：接口的【键】取 propTypes ∪ 实际解构/访问到的 props，
 * 类型来源优先用 propTypes，其余用有说明的兜底。这样：
 *   - TS7006 消掉（props 有类型了）
 *   - 不会新增 TS2339（用到的键都在接口里）
 *   - 约 57% 的 prop 拿到真实类型，其余是显式的、可 grep 的欠债
 * 另见 tools/survey-proptypes.cjs：686 个有 propTypes 的文件里，
 * 176 个的 propTypes 全部可映射，其余含 object(177)/any(168)/shape({})(149)/array(89)。
 */
