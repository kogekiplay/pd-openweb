/**
 * 给 React 组件生成 props 接口（一次性工具，按文件白名单跑）
 *
 * 背景：全量 strict 下 TS7006「参数隐式 any」3.7 万条是最大的一桶，
 * 其中 props / prevProps / nextProps 合计约 3700 条 —— 都是没标类型的组件 props。
 *
 * 【为什么不能直接用 InferProps】调研见 tools/survey-proptypes-coverage.cjs：
 * 629 个同时有 propTypes 和 props 使用点的组件里，propTypes 覆盖完整的只有 210 个（33%），
 * 其余 419 个平均漏 43% —— 直接按 propTypes 生成接口并标到 props 上，
 * 那 419 个会立刻因为用到未声明的 prop 报 TS2339，【改完比不改更差】。
 *
 * 所以这里取的是那份调研给出的可行变体：
 *   接口的【键】 = propTypes 声明的键 ∪ 组件里实际解构/访问到的 props
 *   类型来源     = 能从 propTypes 映射的就用它，其余标 any 并在注释里点名
 * 这样：
 *   - TS7006 消掉（props 有类型了）
 *   - 不会新增 TS2339（用到的键都在接口里）
 *   - 一部分 prop 拿到真实类型，其余是显式的、可 grep 的欠债
 *
 * 【索引签名的取舍】只有在组件确实做了动态访问（props[expr]）或把 props 原样
 * 透传（{...props} / {...rest}）时才补 [key: string]: any —— 否则不补，
 * 免得把接口变成不设防的口袋，那就白做了。
 *
 * ⚠⚠⚠ 【实测结论：这条路不通，不要用它改文件】⚠⚠⚠
 *
 * 2026-09-14 在 3 个文件上试跑，暴露两个调研时没覆盖到的问题：
 *
 * 1) 一个文件里常常有【多个组件】（例：AppSettings/.../AppLockPasswordDialog/index.tsx
 *    同时有 handleRequest、函数组件 LockApp、和一个 class）。本工具按文件生成单一接口
 *    并标到所有 props 参数上，对其中任何一个都是错的。
 *
 * 2) 更致命：【调用方传的 prop，组件不一定读】。同一个例子里 isPassword 被两个调用点
 *    传入，但组件内部没有任何读取点 —— 于是它既不在 propTypes 也不在"用到的键"里，
 *    接口一标，两个调用点立刻报 TS2353「不存在的属性」。
 *    tools/survey-proptypes-coverage.cjs 那份调研只量了【组件内部】的覆盖率，
 *    漏掉了调用点这一维。
 *
 * 要把这条路走通，键集得是 propTypes ∪ 组件内使用 ∪ 【全仓所有 JSX 调用点传入的 prop】，
 * 也就是要做跨文件的全程序分析；而且还得先按组件而不是按文件切分。
 * 成本和风险都远超收益 —— 组件 props 这 3700 条留给"按组件逐个手写接口"的那一遍。
 *
 * 保留此文件是为了【记住这个结论】，避免以后再走一遍。
 *
 * 用法（仅供调研）：node tools/codemod-props-interface.cjs --list
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
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
};

// PropTypes.X -> TS 类型。刻意【不】映射 any/object/array/shape({})：
// 它们退化后等于没类型，宁可标 any 并在注释里点名，也不要假装有类型。
const PT_MAP = {
  string: 'string',
  number: 'number',
  bool: 'boolean',
  func: '(...args: any[]) => any',
  node: 'React.ReactNode',
  element: 'React.ReactElement',
  elementType: 'React.ElementType',
  symbol: 'symbol',
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

/** 从 propTypes 对象字面量抽出 键 -> TS 类型（映射不了的给 null） */
function readPropTypes(objExpr) {
  const out = new Map();
  for (const pr of objExpr.properties) {
    if (pr.type !== 'ObjectProperty' || pr.key.type !== 'Identifier') continue;
    const name = pr.key.name;
    let node = pr.value;
    // 去掉 .isRequired
    if (node.type === 'MemberExpression' && node.property?.name === 'isRequired') node = node.object;

    let ts = null;
    if (node.type === 'MemberExpression' && node.object?.name === 'PropTypes') {
      ts = PT_MAP[node.property?.name] || null;
    } else if (node.type === 'CallExpression') {
      const callee = node.callee;
      const fn = callee?.property?.name;
      if (fn === 'arrayOf' || fn === 'oneOfType' || fn === 'objectOf') ts = 'any[]';
      if (fn === 'oneOf') ts = 'any';
      if (fn === 'shape' || fn === 'exact') ts = 'any';
      if (fn === 'instanceOf') ts = 'any';
      if (fn === 'arrayOf') ts = 'any[]';
    }
    out.set(name, ts);
  }
  return out;
}

function analyze(file) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    return null;
  }

  const declared = new Map(); // propTypes
  const used = new Set(); // 实际用到的 props
  let needsIndex = false; // 是否有动态访问 / rest 透传
  const targets = []; // 要标注的参数节点

  traverse(ast, {
    // propTypes = { ... } / static propTypes = { ... }
    AssignmentExpression(p) {
      const { left, right } = p.node;
      if (
        left.type === 'MemberExpression' &&
        left.property?.name === 'propTypes' &&
        right.type === 'ObjectExpression'
      ) {
        for (const [k, v] of readPropTypes(right)) declared.set(k, v);
      }
    },
    ClassProperty(p) {
      if (p.node.key?.name === 'propTypes' && p.node.value?.type === 'ObjectExpression') {
        for (const [k, v] of readPropTypes(p.node.value)) declared.set(k, v);
      }
    },
    // const { a, b, ...rest } = props / this.props
    VariableDeclarator(p) {
      const { id, init } = p.node;
      if (id.type !== 'ObjectPattern' || !init) return;
      const isProps =
        (init.type === 'Identifier' && /^(props|nextProps|prevProps)$/.test(init.name)) ||
        (init.type === 'MemberExpression' &&
          init.object?.type === 'ThisExpression' &&
          init.property?.name === 'props');
      if (!isProps) return;
      for (const pr of id.properties) {
        if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier') used.add(pr.key.name);
        if (pr.type === 'RestElement') needsIndex = true;
      }
    },
    MemberExpression(p) {
      const { object, property, computed } = p.node;
      const fromProps =
        (object.type === 'Identifier' && /^(props|nextProps|prevProps)$/.test(object.name)) ||
        (object.type === 'MemberExpression' &&
          object.object?.type === 'ThisExpression' &&
          object.property?.name === 'props');
      if (!fromProps) return;
      if (computed) {
        needsIndex = true;
        return;
      }
      if (property.type === 'Identifier') used.add(property.name);
    },
    // {...props} / {...this.props} 原样透传
    JSXSpreadAttribute(p) {
      const a = p.node.argument;
      if (
        (a.type === 'Identifier' && /^props$/.test(a.name)) ||
        (a.type === 'MemberExpression' && a.object?.type === 'ThisExpression' && a.property?.name === 'props')
      ) {
        needsIndex = true;
      }
    },
  });

  // 找要标注的参数：函数组件的 props、constructor(props)、生命周期
  //
  // 必须跳过 styled-components 模板里的插值函数 —— `styled.div`...${props => ...}`` 收到的是
  // 【styled 组件自己的 props】，不是这个 React 组件的 props，语义完全不同；
  // 而且那种位置多半是无括号单参箭头，直接插标注会写出 `${props: X => ...}` 这种语法错误。
  traverse(ast, {
    Function(p) {
      if (p.findParent(x => x.isTaggedTemplateExpression())) return;
      const params = p.node.params;
      params.forEach(param => {
        if (param.type !== 'Identifier') return;
        if (!/^(props|nextProps|prevProps)$/.test(param.name)) return;
        if (param.typeAnnotation) return;
        // 无括号的单参箭头（x => ...）：加标注必须同时补括号，否则语法错
        const needsParens =
          p.node.type === 'ArrowFunctionExpression' && p.node.params.length === 1 && !/^\s*\(/.test(
            src.slice(p.node.start, param.start + 1),
          );
        targets.push({ start: param.start, end: param.end, needsParens });
      });
    },
  });

  return { src, declared, used, needsIndex, targets, file };
}

function render(name, declared, used, needsIndex) {
  const keys = [...new Set([...declared.keys(), ...used])].filter(k => k !== 'children').sort();
  const lines = [];
  lines.push('/**');
  lines.push(` * ${name} 的 props。`);
  lines.push(' *');
  lines.push(' * 键 = propTypes 声明的 ∪ 组件里实际用到的（propTypes 在本仓平均漏 43%，');
  lines.push(' * 只按它生成会让用到未声明 prop 的地方报 TS2339，见 tools/survey-proptypes-coverage.cjs）。');
  lines.push(' * 标 any 的是 propTypes 里就没有类型信息的（object / array / shape({}) / any），');
  lines.push(' * 它们是显式且可 grep 的欠债，逐个收窄时只改这里。');
  lines.push(' */');
  lines.push(`interface ${name}Props {`);
  lines.push('  children?: React.ReactNode;');
  for (const k of keys) {
    const ts = declared.has(k) ? declared.get(k) : null;
    lines.push(`  ${k}?: ${ts || 'any'};`);
  }
  if (needsIndex) {
    lines.push('  /** 组件对 props 做了动态访问或原样透传，必须留口 */');
    lines.push('  [key: string]: any;');
  }
  lines.push('}');
  return lines.join('\n');
}

const args = process.argv.slice(2);

if (args[0] === '--list') {
  const rows = [];
  for (const f of walk(SRC)) {
    const a = analyze(f);
    if (!a || !a.targets.length) continue;
    if (!a.declared.size && !a.used.size) continue;
    rows.push({ file: path.relative(ROOT, f), keys: new Set([...a.declared.keys(), ...a.used]).size, targets: a.targets.length });
  }
  rows.sort((x, y) => y.targets - x.targets);
  console.log(`可标注的组件文件：${rows.length}`);
  rows.slice(0, 25).forEach(r => console.log(`  ${r.targets} 处  ${r.keys} 键  ${r.file}`));
  process.exit(0);
}

let done = 0;
for (const rel of args) {
  const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  const a = analyze(file);
  if (!a || !a.targets.length) {
    console.log(`跳过（无可标注的 props 参数）: ${rel}`);
    continue;
  }
  if (!a.declared.size && !a.used.size) {
    console.log(`跳过（既无 propTypes 也无使用点）: ${rel}`);
    continue;
  }

  const base = path.basename(path.dirname(file)) === 'components' || path.basename(file) !== 'index.tsx'
    ? path.basename(file, '.tsx')
    : path.basename(path.dirname(file));
  const name = base.replace(/[^a-zA-Z0-9]/g, '') || 'Component';
  const iface = render(name, a.declared, a.used, a.needsIndex);

  let out = a.src;
  // 从后往前插类型标注（改一处后前面的偏移才不受影响）
  a.targets
    .slice()
    .sort((x, y) => y.end - x.end)
    .forEach(t => {
      const ann = `: ${name}Props`;
      if (t.needsParens) {
        out = out.slice(0, t.start) + '(' + out.slice(t.start, t.end) + ann + ')' + out.slice(t.end);
      } else {
        out = out.slice(0, t.end) + ann + out.slice(t.end);
      }
    });

  // 接口插在最后一条顶层 import 之后
  const lines = out.split('\n');
  let idx = 0;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('import ')) {
      depth = (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      idx = i + 1;
    } else if (depth > 0) {
      depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      idx = i + 1;
    }
  }
  lines.splice(idx, 0, '', iface);
  fs.writeFileSync(file, lines.join('\n'));
  done += 1;
  console.log(`${rel}: ${a.targets.length} 处，接口 ${name}Props（${new Set([...a.declared.keys(), ...a.used]).size} 键${a.needsIndex ? '，带索引签名' : ''}）`);
}
console.log(`\n完成 ${done} 个文件。`);
