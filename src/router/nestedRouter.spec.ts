/**
 * 禁止在非入口组件里裸渲染 <Router>。
 *
 * 为什么值得单独立一个门禁：这是 react-router 4 → 7 那次迁移里**唯一一个四道门禁
 * 全都没抓到、上线半天后被用户点出来的生产回归**。
 *
 *   v4 容忍嵌套 <Router>，v7 起直接抛
 *   "You cannot render a <Router> inside another <Router>"。
 *   本仓有 7 个弹层组件自己套了 <BrowserRouter>（NewRecord、WorkSheetTrash、
 *   WorksheetDraft、quickSelectUser、relateSearchWorksheet、MobileDraft ×2）。
 *   它们有两种挂法：走 FunctionWrap/createRoot 挂到游离 div（那里没有 Router，
 *   内部的 Link/useNavigate 会抛），或者直接嵌在页面树里（外面已经有 App 的 Router）。
 *   后者在 v7 下抛的异常被 ErrorBoundary 接住，**界面上只表现为「点了没反应」**，
 *   控制台不翻出来根本看不见。
 *
 * 修法是 src/router/OptionalRouter.tsx：用官方的 useInRouterContext() 判断，
 * 已经在 Router 里就直接渲染 children，不在才套一层。
 *
 * ── 判据 ────────────────────────────────────────────────────────────
 * 凡是在 JSX 里渲染了 Router 组件的文件，必须满足下面任一条：
 *   (A) 同文件里调用了 createRoot —— 它是挂载入口，这个 Router 就是根，不存在嵌套
 *   (B) 同文件里调用了 useInRouterContext —— 它自己做了「已在 Router 里就不套」的防护
 *
 * 刻意**不写文件白名单**：白名单会烂（新加一个弹层就漏），而上面两条是可机检的性质。
 * 「Router 组件」也不靠名字硬匹配 —— 从 react-router 的 import 里解析出本地名，
 * 所以 `import { BrowserRouter as Router }` 这种别名照样认得，
 * 而某个恰好叫 Router 的自有组件不会被误伤。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parser, ROOT } = require('../../scripts/spec-harness.ts');

const SCAN_DIRS = ['src'];
const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

/** react-router 里所有「自带 history、会建立 Router 上下文」的导出 */
const ROUTER_EXPORTS = new Set([
  'BrowserRouter',
  'HashRouter',
  'MemoryRouter',
  'Router',
  'RouterProvider',
  'StaticRouter',
  'unstable_HistoryRouter',
]);

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collect(abs, out);
    } else if (EXTS.has(path.extname(entry.name)) && !entry.name.endsWith('.spec.ts')) {
      out.push(abs);
    }
  }

  return out;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;

  if (typeof node.type === 'string') visit(node);

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments') continue;

    const value = node[key];

    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

/** 从 `import { BrowserRouter as Router } from 'react-router'` 收集出本地名 */
function routerLocalNames(ast) {
  const names = new Set();

  walk(ast, node => {
    if (node.type !== 'ImportDeclaration') return;
    if (!/^react-router(\/|$)/.test(node.source.value)) return;

    for (const s of node.specifiers) {
      if (s.type === 'ImportSpecifier' && ROUTER_EXPORTS.has(s.imported.name)) names.add(s.local.name);
    }
  });

  return names;
}

/** JSX 里出现 <X ...> 且 X 在 names 里 */
function rendersRouter(ast, names) {
  let line = null;

  walk(ast, node => {
    if (line !== null) return;
    if (node.type !== 'JSXOpeningElement') return;
    if (node.name.type !== 'JSXIdentifier') return;
    if (!names.has(node.name.name)) return;

    line = node.loc ? node.loc.start.line : 0;
  });

  return line;
}

const callsIdentifier = (ast, name) => {
  let found = false;

  walk(ast, node => {
    if (found) return;
    if (node.type !== 'CallExpression') return;

    const c = node.callee;

    if (c.type === 'Identifier' && c.name === name) found = true;
    else if (c.type === 'MemberExpression' && c.property && c.property.name === name) found = true;
  });

  return found;
};

const violations = [];
let renderers = 0;
let exemptMountEntry = 0;
let exemptGuarded = 0;

for (const dir of SCAN_DIRS) {
  for (const file of collect(path.join(ROOT, dir), [])) {
    const source = fs.readFileSync(file, 'utf8');

    if (!/react-router/.test(source)) continue;

    let ast;

    try {
      ast = parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy', 'dynamicImport'],
      });
    } catch (e) {
      continue; // 语法门禁另有其人，这里不重复报
    }

    const names = routerLocalNames(ast);

    if (!names.size) continue;

    const line = rendersRouter(ast, names);

    if (line === null) continue;

    renderers++;

    const rel = `${path.relative(ROOT, file)}:${line}`;

    if (callsIdentifier(ast, 'createRoot')) {
      exemptMountEntry++;

      continue;
    }

    if (callsIdentifier(ast, 'useInRouterContext')) {
      exemptGuarded++;

      continue;
    }

    violations.push(rel);
  }
}

// 判据自身也要有下限：一处都没扫到，说明 import 解析或 JSX 遍历悄悄坏了
assert.ok(renderers >= 5, `只扫到 ${renderers} 处渲染 Router 的文件，扫描逻辑大概率坏了`);
assert.ok(exemptGuarded >= 1, 'OptionalRouter 那条 useInRouterContext 防护没被识别到，豁免判据大概率坏了');

assert.deepStrictEqual(
  violations,
  [],
  '以下文件裸渲染了 <Router>，挂在已有 Router 的页面树里会抛 ' +
    '"You cannot render a <Router> inside another <Router>"，' +
    '被 ErrorBoundary 接住后界面上只表现为「点了没反应」（见本文件头）。' +
    '请改用 src/router/OptionalRouter：\n  ' +
    violations.join('\n  '),
);

console.log(
  `nested <Router> tests passed（渲染 Router 的文件 ${renderers} 个：` +
    `挂载入口豁免 ${exemptMountEntry}，useInRouterContext 防护豁免 ${exemptGuarded}）`,
);
