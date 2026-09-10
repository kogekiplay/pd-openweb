/**
 * 路由树的【渲染】冒烟测试。
 *
 * tools/verify-router-matching.cjs 验的是「哪条路由被选中、params 是什么」，
 * 用的是 matchRoutes —— 它不经过 React 渲染。而这次迁移里真正容易炸的另一半是
 * 渲染路径：genRouteComponent 生成的 <Route element={...}>、expandRoutePaths
 * 补出来的 /*、withTitle 注回去的路由 props、SegmentPrefixGuard 的守卫。
 * 这些在 matchRoutes 里一点都跑不到。
 *
 * 本脚本把【生产代码里真实的】genRouteComponent 输出塞进 <Routes> 里渲染，
 * 逐个 URL 断言：不抛异常，且选中的是预期那条路由。
 * 懒加载组件用 Suspense fallback 兜住（不去真的加载业务组件，那会拖进整个依赖图）。
 *
 * 运行：
 *   JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom node tools/verify-router-render.cjs
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

function loadJsdom() {
  for (const c of [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom，见其它 verify-* 脚本文件头。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
for (const k of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Text',
  'getComputedStyle',
  'DOMParser',
  'Range',
  'Selection',
  'MutationObserver',
  'DOMRect',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'Window',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'XMLHttpRequest',
  'FormData',
  'Blob',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.self = global.window;
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), String(s));
global.md = { global: { Config: { PlatformUrl: 'https://example.test/' }, Account: {}, SysSettings: {} } };
global.window.subPath = '';

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx'];
const ALIASES = { worksheet: 'src/pages/worksheet', mobile: 'src/pages/Mobile', statistics: 'src/pages/Statistics' };

function resolveFile(base) {
  for (const ext of EXTS) {
    const c = base + ext;

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  for (const ext of EXTS.filter(Boolean)) {
    const c = path.join(base, 'index' + ext);

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  return null;
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    const head = request.split('/')[0];
    const mapped = ALIASES[head] ? request.replace(head, ALIASES[head]) : request;

    for (const base of [RW + mapped, RW + 'src/' + mapped]) {
      const hit = resolveFile(base);

      if (hit) return hit;
    }
  }

  return origResolve.call(this, request, parent, ...rest);
};

function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { onlyRemoveTypeImports: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;
Module._extensions['.tsx'] = compileTs;
Module._extensions['.less'] = m => m._compile('module.exports = {};', 'noop.less');
Module._extensions['.css'] = Module._extensions['.less'];
Module._extensions['.png'] = Module._extensions['.less'];
Module._extensions['.svg'] = Module._extensions['.less'];

const React = require(RW + 'node_modules/react');
const ReactDOMServer = require(RW + 'node_modules/react-dom/server');
// 【必须用与源码相同的方式 require】用绝对路径 require 会解析到
// dist/development/index.js，而源码里的裸标识符 'react-router' 走的是 package.json
// 的 exports 条件、落到另一份产物 —— 两份是【不同的模块实例】，
// <Routes> 认不出另一实例造出来的 <Route>，整棵渲染成空字符串且不报任何错。
// 这个坑非常隐蔽：路由数量、路径全都对，只是渲染结果是 ''。
const { MemoryRouter, Routes } = require('react-router');

// 懒加载的业务组件不去真的解析（会拖进整个依赖图）。这里替换 lazy，
// 让每个路由渲染成一个带标记的占位元素，从标记就能读出选中了哪个组件。
const realLazy = React.lazy;
const marks = new Map();
React.lazy = factory => {
  const Marker = () => React.createElement('div', { 'data-route-comp': marks.get(factory) || 'unknown' });

  return Marker;
};

// 记录每个路由 key 对应的组件工厂，供上面反查
function tagFactories(cfg) {
  for (const [key, r] of Object.entries(cfg)) {
    if (r && typeof r.component === 'function') marks.set(r.component, key);

    if (r && r.guard && typeof r.guard.fallback === 'function') marks.set(r.guard.fallback, key + ':fallback');
  }
}

const { ROUTE_CONFIG } = require(RW + 'src/router/config.ts');
const genRouteComponent = require(RW + 'src/router/genRouteComponent.tsx').default;

tagFactories(ROUTE_CONFIG);

const routes = genRouteComponent()(ROUTE_CONFIG);
console.log(`  genRouteComponent 产出 ${routes.length} 个 <Route>\n`);

// 每条用例：URL -> 期望选中的路由 key（与 config 里的键名一致）
const CASES = [
  ['/feed', 'feed'],
  ['/feeddetail', 'feedDetail'],
  ['/apps/task', 'task'],
  ['/apps/taskcenter', 'task'],
  ['/apps/task/task_123', 'taskDetail'],
  // 前缀不匹配 → 守卫回落到任务列表（v4 下是被 '/apps/task' 的前缀匹配接住的）
  ['/apps/task/somethingelse', 'taskDetail:fallback'],
  ['/apps/calendar/home', 'calendar'],
  ['/apps/kc/a/b', 'kc'],
  ['/user', 'user'],
  ['/user_abc', 'user'],
  ['/admin/home/proj1', 'admin'],
  ['/integration/connectList', 'integration'],
  ['/plugin/view', 'plugin'],
  ['/app/app1', 'app'],
  ['/worksheet/ws1', 'worksheet'],
];

let pass = 0;
let fail = 0;

for (const [url, expect] of CASES) {
  let html;
  const origErr = console.error;
  const caught = [];
  console.error = (...a) => caught.push(String(a[0]).split('\n')[0].slice(0, 170));

  try {
    html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(React.Suspense, { fallback: null }, React.createElement(Routes, null, routes)),
      ),
    );
  } catch (e) {
    console.error = origErr;
    fail++;
    console.log(`  抛错 ${url}\n        ${e.message.split('\n')[0]}`);
    continue;
  }

  console.error = origErr;

  if (!html && caught.length) console.log('    被吞掉的错误: ' + caught.filter(x => !/useLayoutEffect/.test(x))[0]);

  const m = /data-route-comp="([^"]*)"/.exec(html || '');
  const got = m ? m[1] : '(未渲染任何路由组件)';
  const ok = got === expect;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS ' : 'FAIL '} ${url.padEnd(30)} -> ${got}${ok ? '' : `   期望 ${expect}`}`);
}

React.lazy = realLazy;
console.log(`\n  → PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
