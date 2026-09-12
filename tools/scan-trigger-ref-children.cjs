/**
 * 排查 <Trigger> 的子元素是否接得住 ref（只统计，不改文件）。
 *
 * 【为什么必须查】rc-trigger 5 用 ReactDOM.findDOMNode 拿子元素的 DOM 节点，
 * 子组件接不接 ref 都无所谓。继任的 @rc-component/trigger 不再用 findDOMNode，
 * 改为把 ref 挂到子元素上取节点（见 es/index.js 的 targetEle）。
 * 子元素若是【不把 ref 挂到 DOM 上】的函数组件，targetEle 恒为 null，
 * useAlign 算出的坐标完全失真 —— 弹层被放到屏幕外。
 *
 * 这个失败是【静默】的，也是这次迁移最难查的一类：
 * DOM 里弹层在、内容也对、控制台一条报错都没有、类型和构建全绿，
 * 用户看到的只是「点了没反应」。
 * 实例：工作表统计行的下拉（SummaryCell → SummaryContent），
 * 弹层被放到 (-6260, -7880)。
 *
 * 分类口径：
 *   dom      子元素是小写标签（div/span/...），ref 由 React 原生挂上 —— 安全
 *   forwards 子组件源码里能看到接 ref 并挂到元素上（forwardRef 或 React 19 的 ref prop）
 *   risky    子组件【看不到】接 ref 的迹象 —— 需要人工确认
 *   unknown  子元素不是静态 JSX（表达式/变量），静态分析给不出结论
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
    } else if (/\.(jsx|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

const parseCache = new Map();
function parseFile(file) {
  if (parseCache.has(file)) return parseCache.get(file);
  let ast = null;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), PARSE_OPTS);
  } catch {
    /* 解析不了就当未知 */
  }
  parseCache.set(file, ast);
  return ast;
}

// 解析一个 import 说明符到磁盘路径（只处理相对路径和 src/ 开头的绝对别名）
function resolveImport(fromFile, request) {
  let base;
  if (request.startsWith('.')) base = path.resolve(path.dirname(fromFile), request);
  else if (request.startsWith('src/')) base = path.resolve(ROOT, request);
  else return null;

  for (const cand of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.jsx'),
    path.join(base, 'index.js'),
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

// 源码里是否有「接住 ref 并挂到元素上」的迹象。
// 故意做得【宽松】：宁可漏报 risky，也不要在报告里塞满需要人工看的假阳性。
function looksLikeForwardsRef(file, componentName) {
  const src = fs.readFileSync(file, 'utf8');

  // styled-components 生成的组件【原生转发 ref】到它渲染的那个 DOM 元素（v5 起）。
  // 本仓大量 <Trigger> 的子元素就是 styled.div/styled.span，这些天然安全。
  // 注意要按【这个名字】匹配，不能只看文件里有没有 styled ——
  // 一个 style.ts 里往往几十个导出，混着 styled 和普通函数组件。
  const styledDecl = new RegExp(
    `(?:const|let|var)\\s+${componentName}\\s*(?::[^=]+)?=\\s*styled[.(]`,
  );
  if (styledDecl.test(src)) return true;

  // React 19 写法：把 ref 当普通 prop 接收，再 ref={ref} 挂上；或显式 forwardRef
  const fnDecl = new RegExp(
    `(?:function\\s+${componentName}\\b|(?:const|let|var)\\s+${componentName}\\s*(?::[^=]+)?=)`,
  );
  if (fnDecl.test(src)) {
    if (/forwardRef/.test(src)) return true;
    if (/\bref\s*[,}]/.test(src) && /ref=\{/.test(src)) return true;

    // 【class 组件不是天然安全的】@rc-component/trigger 用 getDOM(node) 取节点，
    // 它只认 node.nativeElement 是 DOM、或 node 本身是 DOM
    //（@rc-component/util Dom/findDOMNode.js:10）。class 组件的 ref 给出的是【实例】，
    // 两条都不满足 —— 除非实例上显式挂了 nativeElement。
    // rc-trigger 5 用 findDOMNode，class 组件才是天然可用的；迁移后不再成立。
    if (new RegExp(`class\\s+${componentName}\\b`).test(src)) {
      return /\bnativeElement\s*=/.test(src);
    }

    return false;
  }

  // 名字在目标文件里根本找不到定义（re-export 之类），给不出结论
  return false;
}

const buckets = { dom: [], forwards: [], risky: [], unknown: [] };

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes("@rc-component/trigger")) continue;

  const ast = parseFile(file);
  if (!ast) continue;

  // 本文件里 Trigger 这个名字绑到了什么（默认导入名可能不叫 Trigger）
  const triggerNames = new Set();
  const importedFrom = new Map(); // 组件名 -> import 说明符

  traverse(ast, {
    ImportDeclaration(p) {
      const source = p.node.source.value;
      for (const s of p.node.specifiers) {
        if (source === '@rc-component/trigger' && s.type === 'ImportDefaultSpecifier') {
          triggerNames.add(s.local.name);
        }
        importedFrom.set(s.local.name, source);
      }
    },
  });

  if (!triggerNames.size) continue;
  const rel = path.relative(ROOT, file);

  traverse(ast, {
    JSXElement(p) {
      const name = p.node.openingElement.name;
      if (name.type !== 'JSXIdentifier' || !triggerNames.has(name.name)) return;

      const kids = p.node.children.filter(
        c => c.type === 'JSXElement' || (c.type === 'JSXExpressionContainer' && c.expression.type !== 'JSXEmptyExpression'),
      );
      if (kids.length !== 1) {
        buckets.unknown.push(`${rel}:${p.node.loc.start.line}  子元素 ${kids.length} 个，静态分析跳过`);
        return;
      }

      const kid = kids[0];
      if (kid.type !== 'JSXElement') {
        buckets.unknown.push(`${rel}:${p.node.loc.start.line}  子元素是表达式，静态分析跳过`);
        return;
      }

      const kidName = kid.openingElement.name;
      if (kidName.type !== 'JSXIdentifier') {
        buckets.unknown.push(`${rel}:${p.node.loc.start.line}  子元素是成员表达式，静态分析跳过`);
        return;
      }

      const n = kidName.name;
      if (/^[a-z]/.test(n)) {
        buckets.dom.push(`${rel}:${kid.loc.start.line}  <${n}>`);
        return;
      }

      const request = importedFrom.get(n);
      const target = request ? resolveImport(file, request) : file; // 没找到 import 就当同文件定义
      if (!target) {
        buckets.unknown.push(`${rel}:${kid.loc.start.line}  <${n}> 来自 ${request}（第三方，跳过）`);
        return;
      }

      (looksLikeForwardsRef(target, n) ? buckets.forwards : buckets.risky).push(
        `${rel}:${kid.loc.start.line}  <${n}>  ← ${path.relative(ROOT, target)}`,
      );
    },
  });
}

for (const k of ['risky', 'unknown', 'forwards', 'dom']) {
  console.log(`\n${buckets[k].length} 处  ${k}`);
  const show = k === 'risky' || k === 'unknown' ? buckets[k] : buckets[k].slice(0, 3);
  show.forEach(s => console.log('   ' + s));
  if (show.length < buckets[k].length) console.log(`   …其余 ${buckets[k].length - show.length} 处略`);
}
