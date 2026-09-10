/**
 * 后台左侧菜单的路径消费方，必须和 router.config.ts 里的【路径语法】对得上。
 *
 * 为什么要有这个 spec：
 * 路由迁到 react-router 7 的时候，router.config.ts 里的 path 从 v4 语法
 * （'/admin/structure/(.*)/(create|inactive)?'）换成了 v7 语法（'structure/*'），
 * 但 menu/index.tsx 还在用 path-to-regexp 去 compile / test 它们。
 * v7 的通配段 `/*` 在 path-to-regexp 6 里是个孤立的 MODIFIER，
 * compile('structure/*') 当场抛 "Unexpected MODIFIER at 10, expected END"。
 * 这个异常是渲染期抛的、被 ErrorBoundary 接住，线上整个组织管理后台变成
 * 「程序错误，请刷新页面重试」—— 而路由匹配差分（tools/verify-router-matching.cjs）
 * 只验「哪条路由被选中」，根本不碰菜单这一层，所以一点都没拦住。
 *
 * 断言分三层，最关键的是第三层【往返】：
 *   1. 路径本身不含 v4 正则语法（(.*) / 交替组 / 可选字面量组）
 *   2. matchPath / generatePath 都能吃下去，不抛
 *   3. 用菜单那套规则生成出来的链接，能被它所来自的那条路由匹配上
 * 第三层是真正的护栏：光「不抛」还可能悄悄生成 '/admin/merchant/xxx(.*)'
 * 这种带残留字面量的 URL（generatePath 不认 :param(pattern)，会原样留着），
 * 点了就是 404，而前两层完全看不出来。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync, readSource, ROOT } = require('../../../scripts/spec-harness');
const { generatePath, matchPath } = require('react-router');

global._l = global._l || ((s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), String(s)));
// router.config 顶层会读 window.md.global.SysSettings 来过滤菜单项
global.window = global.window || { md: { global: { SysSettings: {} } } };

function loadMenuList() {
  const moduleLike = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'router.config.js'), {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // 只需要 lodash 和 VersionProductType；component 是 () => import(...)，从不调用
  const req = request => (request === 'lodash' ? require('lodash') : require('src/utils/enum'));

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);

  return moduleLike.exports.menuList;
}

// 与 src/pages/Admin/menu/index.tsx 里那两个同名函数保持一致。
// 这里【故意抄一份】而不是 import：那个文件顶上有一长串 UI 依赖（ming-ui、rc-trigger、
// less），在 spec 里全部打桩的成本远大于抄这两行；而它们一旦漂移，下面的往返断言会挂。
const toAbsoluteAdminPath = p => (!p ? '' : p.startsWith('/') ? p : `/admin/${p}`);
const buildMenuHref = (pattern, projectId) =>
  generatePath(pattern, pattern.includes(':projectId') ? { projectId } : { '*': projectId });

const PID = '60a5f4ba-4105-4f79-98cc-5da277d4600e';
const menuList = loadMenuList();

const items = [];
for (const group of menuList) {
  for (const item of group.subMenuList || []) {
    items.push(item);
  }
}
assert.ok(items.length > 20, `菜单项只解析出 ${items.length} 条，router.config 大概率没加载成功`);

const V4_SYNTAX = /\(\.\*\)|\([^)]*\|[^)]*\)|\)\?/;
let routeCount = 0;

for (const item of items) {
  for (const route of item.routes || []) {
    routeCount++;
    const abs = toAbsoluteAdminPath(route.path);

    assert.ok(!V4_SYNTAX.test(route.path), `${item.key} 的 path 仍是 v4 正则语法：${route.path}`);

    // 菜单高亮走的就是这一句；v7 语法喂给 path-to-regexp 会在这里炸
    assert.doesNotThrow(() => matchPath(abs, '/admin/whatever'), `matchPath 吃不下 ${abs}`);
  }

  if (item.menuPath) {
    assert.ok(!V4_SYNTAX.test(item.menuPath), `${item.key} 的 menuPath 仍是 v4 正则语法：${item.menuPath}`);
  }

  // 菜单链接：用第一条路由（或 menuPath）生成，规则同 renderLinkItem
  const route = (item.routes || [])[0] || {};
  const pattern = toAbsoluteAdminPath(item.menuPath || route.path);

  if (!pattern) continue;

  let href;
  assert.doesNotThrow(() => {
    href = buildMenuHref(pattern, PID);
  }, `generatePath 吃不下 ${pattern}`);

  assert.ok(href.startsWith('/admin/'), `${item.key} 生成的菜单链接不是后台绝对路径：${href}`);
  assert.ok(
    !/[(){}*?:]/.test(href),
    `${item.key} 生成的菜单链接里残留了路径模式字面量：${href}（pattern=${pattern}）`,
  );
  assert.ok(href.includes(PID), `${item.key} 生成的菜单链接里没有 projectId：${href}`);

  // 往返：生成出来的链接必须能被它所来自的那条路由匹配上，否则点了就是 404
  const target = toAbsoluteAdminPath(route.path);

  if (target) {
    assert.ok(matchPath(target, href), `${item.key} 的菜单链接 ${href} 匹配不上自己的路由 ${target}`);
  }
}

assert.ok(routeCount > 40, `只检查到 ${routeCount} 条路由，语料太少，检查加载逻辑`);

// 上面那些断言用的是 matchPath / generatePath，它们【本来就吃得下 v7 语法】。
// 所以还得直接盯住消费方：只要 menu/index.tsx 再把这些 path 喂回 path-to-regexp，
// 线上就会重演一次「组织管理打不开」，而上面一条都拦不住。
{
  const source = readSource(ROOT, 'src/pages/Admin/menu/index.jsx');

  assert.ok(
    !/from ['"]path-to-regexp['"]/.test(source),
    'src/pages/Admin/menu/index.tsx 不能用 path-to-regexp —— ' +
      'router.config 里的 path 是 react-router 7 语法，通配段 /* 在 path-to-regexp 6 里会抛 ' +
      'Unexpected MODIFIER，渲染期抛异常会让整个后台变成「程序错误」。请用 react-router 的 matchPath / generatePath。',
  );
  assert.ok(
    /from ['"]react-router['"]/.test(source),
    'src/pages/Admin/menu/index.tsx 应当从 react-router 取 matchPath / generatePath',
  );
}

console.log(`Admin router.config path syntax tests passed (${items.length} 个菜单项 / ${routeCount} 条路由)`);
