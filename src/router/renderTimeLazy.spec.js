/**
 * 禁止在【渲染期】调 React.lazy()。
 *
 * 为什么这条值得单独立一个门禁：react-router 7 的导航包在 React.startTransition 里，
 * 这让一个 v4 时代无害的写法变成了必然的死循环 ——
 *
 *   lazy() 每调一次都产出一个【全新的组件类型】，新 lazy 必然先 suspend。
 *   撞上一个【已经挂载过】的 <Suspense> 边界时，transition 不会把它换成 fallback，
 *   而是保留旧内容等新树就绪；promise resolve 后 React 从边界往下重渲染，
 *   如果那次重渲染又会执行到 lazy()，就又造一个新 lazy、又 suspend，
 *   无限打转、永不 commit。
 *
 * 这个 bug 极难查，四种常规手段同时失灵：
 *   - 不抛异常，控制台一条错误都没有
 *   - 不刷 CPU（每轮渲染都很小且 React 会让出主线程），定时器抖动测不出
 *   - 只在第一轮发一次 chunk 请求，之后 webpack 命中缓存，网络面板看不出异常
 *   - 页面保留旧内容，看起来就是「地址栏变了、点了没反应」
 * 整页刷新反而正常 —— 首次挂载不是 transition，边界可以直接显示 fallback 再 commit。
 * 所以线上只有「从别的页面切过来」才复现，用户报的现象和刷新后的表现对不上。
 *
 * 迁移过程中同一个根因炸了三处：
 *   1. src/router/genRouteComponent.tsx —— 带 guard 的三条路由全部打不开
 *   2. src/pages/Personal/index.tsx     —— /personal?type= 切页签没反应
 *   3. src/pages/AppSettings/index.tsx  —— 同样的写法，同样的切页签
 *
 * ── 判据 ────────────────────────────────────────────────────────────
 * 函数体里出现 lazy() 即为可疑，除非满足下面任一条（都是「不会产出新类型」的证据）：
 *   (A) 外层函数是个模块级工厂，且它的【所有】调用点都在模块顶层
 *       —— 例如 `const make = l => lazy(l); const A = make(() => import(...))`
 *   (B) lazy() 的结果被写进缓存（`map.set(k, lazy(f))` 或 `cache[k] = lazy(f)`）
 *       —— 同一个 key 只会造一次
 * 刻意不设文件白名单：白名单会烂，而上面两条是可机检的性质。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parser, ROOT } = require('../../scripts/spec-harness');

const SCAN_DIRS = ['src'];
const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const FN = /Function(Declaration|Expression)|ArrowFunctionExpression|ClassMethod|ObjectMethod/;

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collect(abs, out);
    } else if (EXTS.has(path.extname(entry.name)) && !entry.name.endsWith('.spec.js')) {
      out.push(abs);
    }
  }

  return out;
}

function walk(node, visit, parents = []) {
  if (!node || typeof node !== 'object') return;

  if (typeof node.type === 'string') {
    visit(node, parents);
    parents = parents.concat(node);
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments') continue;

    const value = node[key];

    if (Array.isArray(value)) value.forEach(child => walk(child, visit, parents));
    else if (value && typeof value.type === 'string') walk(value, visit, parents);
  }
}

const isLazyCall = node =>
  node.type === 'CallExpression' &&
  ((node.callee.type === 'Identifier' && node.callee.name === 'lazy') ||
    (node.callee.type === 'MemberExpression' &&
      node.callee.property &&
      node.callee.property.name === 'lazy' &&
      node.callee.object &&
      node.callee.object.name === 'React'));

/** (B) 结果被写进缓存：map.set(k, lazy(f)) 或 cache[k] = lazy(f) / cache.x = lazy(f) */
function writesIntoCache(parents) {
  const parent = parents[parents.length - 1];

  if (!parent) return false;

  if (parent.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression') return true;

  if (
    parent.type === 'CallExpression' &&
    parent.callee.type === 'MemberExpression' &&
    parent.callee.property &&
    parent.callee.property.name === 'set'
  ) {
    return true;
  }

  return false;
}

/** 取包住该调用的最内层函数，以及它（如果有）绑定到的名字 */
function enclosingFunction(parents) {
  for (let i = parents.length - 1; i >= 0; i--) {
    if (FN.test(parents[i].type)) {
      const outer = parents[i - 1];
      let name = null;

      if (outer && outer.type === 'VariableDeclarator' && outer.id.type === 'Identifier') name = outer.id.name;
      else if (parents[i].type === 'FunctionDeclaration' && parents[i].id) name = parents[i].id.name;

      return { node: parents[i], name };
    }
  }

  return null;
}

/** (A) 具名工厂的所有调用点都在模块顶层 */
function onlyCalledAtTopLevel(ast, name) {
  if (!name) return false;

  let calls = 0;
  let nested = 0;

  walk(ast, (node, parents) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== name) return;

    calls++;

    if (parents.some(p => FN.test(p.type))) nested++;
  });

  return calls > 0 && nested === 0;
}

const violations = [];
let checked = 0;
let exemptTopLevelFactory = 0;
let exemptCached = 0;

for (const dir of SCAN_DIRS) {
  for (const file of collect(path.join(ROOT, dir), [])) {
    const rel = path.relative(ROOT, file);
    const source = fs.readFileSync(file, 'utf8');

    if (!/\blazy\s*\(/.test(source)) continue;

    let ast;

    try {
      ast = parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy', 'dynamicImport'],
      });
    } catch (e) {
      continue; // 语法门禁另有其人，这里不重复报
    }

    walk(ast, (node, parents) => {
      if (!isLazyCall(node)) return;

      const fn = enclosingFunction(parents);

      if (!fn) return; // 模块顶层，天然安全

      checked++;

      if (writesIntoCache(parents)) {
        exemptCached++;

        return;
      }

      if (onlyCalledAtTopLevel(ast, fn.name)) {
        exemptTopLevelFactory++;

        return;
      }

      violations.push(`${rel}:${node.loc ? node.loc.start.line : '?'}`);
    });
  }
}

// 判据自身也要有下限：一条都没检查到，说明扫描或解析悄悄坏了
assert.ok(checked >= 5, `只检查到 ${checked} 处函数内的 lazy() 调用，扫描逻辑大概率坏了`);

assert.deepStrictEqual(
  violations,
  [],
  '以下位置在渲染期调用了 lazy()，v7 的 startTransition 导航下会导致无限 suspend 循环' +
    '（页面纹丝不动且不报任何错，见本文件头）。请改成按工厂缓存：\n  ' +
    violations.join('\n  '),
);

console.log(
  `render-time lazy() tests passed（函数内调用 ${checked} 处：缓存豁免 ${exemptCached}，顶层工厂豁免 ${exemptTopLevelFactory}）`,
);
