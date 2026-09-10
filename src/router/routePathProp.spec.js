/**
 * genRouteComponent 必须把【配置里原始的 path】作为 prop 发给业务组件。
 *
 * v4 的写法是 `const { component, redirect, ...rest } = ROUTE_CONFIG[key]`，path 留在
 * rest 里、一路 spread 到组件上。迁移时我为了不把 path/exact 透传给 v7 的 <Route>，
 * 把它们一起解构掉了 —— 顺手也把组件的 props.path 断了。
 *
 * 后果（线上实测）：
 *   - AppPkgSimpleHeader 里 `props.path.indexOf('logs')` 直接抛
 *     「Cannot read properties of undefined (reading 'indexOf')」，
 *     /app/:appId/logs|analytics|settings 三个页面【顶栏整条变成「程序错误」】。
 *     正文是好的，只有顶栏坏，很容易漏看。
 *   - 另外五个顶栏组件不抛错、只是静默认错模块：后台顶栏丢了「组织管理」标题、
 *     插件页顶栏写成「集成」。
 *
 * 这类「少传一个 prop」的回归，路由匹配差分和渲染冒烟都看不见 ——
 * 前者只管选中哪条路由，后者只管渲染出哪个组件。所以在这里单独钉住这份契约。
 *
 * 断言两件事：
 *   1. genRouteComponent 产出的 element 上带 path，且等于【配置里的原值】
 *      （不是 expandRoutePaths 摊平补 /* 之后的那条 —— 下游有等值比较，值必须一模一样）
 *   2. 现存的每个 props.path 消费方，在其对应路由下都能拿到非 undefined 的 path
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync, readSource, ROOT } = require('../../scripts/spec-harness');

global._l = global._l || ((s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), String(s)));
global.window = global.window || {};
global.window.subPath = '';
global.md = global.md || { global: { Config: {}, Account: {}, SysSettings: {} } };

// 只跑 genRouteComponent 的取值逻辑，不真的渲染 —— 这里要验的是「path 有没有被发出去」，
// 把 React / 懒加载 / <Route> 都拖进来只会让失败变难读。
function loadGenRouteComponent() {
  const moduleLike = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'genRouteComponent.jsx'), {
    babelrc: false,
    configFile: false,
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  // 记录每个 createElement 的 props，用最小假 React
  const created = [];
  const fakeReact = {
    createElement: (type, props, ...children) => {
      created.push({ type, props: props || {} });

      return { __el: true, type, props: props || {}, children };
    },
    lazy: f => ({ __lazy: true, factory: f }),
  };
  const stubs = {
    react: fakeReact,
    'react-router': { Route: 'Route', Navigate: 'Navigate' },
    lodash: require('lodash'),
    './expandRoutePaths': require('./expandRoutePaths.ts'),
    './SegmentPrefixGuard': { default: 'SegmentPrefixGuard' },
    './withTitle': { default: 'WithTitleRoute' },
  };
  const req = request => {
    if (stubs[request]) return stubs[request];

    throw new Error(`spec 没给 ${request} 打桩`);
  };

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);

  return { gen: moduleLike.exports.default, created };
}

const { gen } = loadGenRouteComponent();

const CONFIG = {
  simple: { path: '/app/:appId/logs/:projectId', component: () => 'x' },
  arrayPath: { path: ['/user', '/:userSeg'], component: () => 'x' },
  nonExact: { path: '/plugin', component: () => 'x' },
  redirected: { path: '/old', redirect: '/new' },
};

const routes = gen()(CONFIG);

// 每条非 redirect 路由的 element 上都要有 path，且等于配置原值
const seen = new Map();

for (const route of routes) {
  const el = route.props.element;

  if (el.props.to) continue; // <Navigate>

  seen.set(el.props.path && String(el.props.path), (seen.get(el.props.path && String(el.props.path)) || 0) + 1);
  assert.notStrictEqual(el.props.path, undefined, `路由 element 上缺少 path：${route.props.path}`);
}

const values = [...seen.keys()];
assert.ok(values.includes('/app/:appId/logs/:projectId'), `path 不是配置原值，实际拿到 ${JSON.stringify(values)}`);
assert.ok(values.includes('/user,/:userSeg'), `数组 path 应原样传下去，实际拿到 ${JSON.stringify(values)}`);

// 补 /* 的那条 Route，element 上的 path 仍应是原值（下游有 === 等值比较）
const pluginRoutes = routes.filter(r => String(r.props.path).startsWith('/plugin'));
assert.ok(pluginRoutes.length >= 2, '非精确路由应展开出带 /* 与不带 /* 两条');
pluginRoutes.forEach(r =>
  assert.strictEqual(
    r.props.element.props.path,
    '/plugin',
    `Route 的 path 是展开后的 ${r.props.path}，但发给组件的必须是配置原值 '/plugin'`,
  ),
);

// 现存消费方清单：这些文件读 props.path，删掉上面的传参会让它们静默认错模块（或直接抛）
const CONSUMERS = [
  'src/pages/PageHeader/AppPkgSimpleHeader/index.jsx',
  'src/pages/PageHeader/AppPkgHeader/index.jsx',
  'src/pages/PageHeader/NetManageHeader/index.jsx',
  'src/pages/PageHeader/GlobalSearchHeader/index.jsx',
  'src/pages/PageHeader/HubAndPluginHeader/index.jsx',
  'src/pages/PageHeader/NativeHeader/index.jsx',
];

for (const file of CONSUMERS) {
  const source = readSource(ROOT, file);
  assert.ok(
    /props\.path\b|\{\s*path[\s,=}]/.test(source),
    `${file} 不再读 props.path 了。若确实不需要了，请从本清单删除；` +
      '若是改用了别的方式，请确认 genRouteComponent 那边的传参还有没有必要。',
  );
}

console.log(`route path prop tests passed（${routes.length} 条路由 element，${CONSUMERS.length} 个消费方）`);
