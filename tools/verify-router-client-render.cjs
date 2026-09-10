/**
 * 路由树的【客户端】渲染测试 —— 真 React.lazy + 真 Suspense + 真导航。
 *
 * 为什么在 verify-router-render.cjs 之外还要一份：
 * 那份为了不把整个依赖图拖进来，把 React.lazy 换成了返回标记元素的假实现。
 * 代价是它【结构上看不见任何与 lazy / Suspense / 并发渲染相关的 bug】——
 * 而这正是本次迁移线上真出问题的地方：
 *
 *   genRouteComponent 里带 guard 的那支写成了
 *     props => <SegmentPrefixGuard ... component={lazy(component)} />
 *   lazy() 在【渲染期】调用 ⇒ 每渲染一次就造一个全新的 lazy 组件类型。
 *   新 lazy 必然先 suspend → withTitle 的 <Suspense> 挂起 → promise resolve 后
 *   React 从边界往下重渲染 → 又造一个新 lazy → 又 suspend → 无限循环。
 *
 * 这个 bug 的表现极具欺骗性：
 *   - 不抛异常、控制台一条错误都没有
 *   - 不刷 CPU（每轮都很小且 React 会让出主线程），定时器抖动测不出来
 *   - 不发网络请求（webpack 的 import 第一次之后就命中缓存）
 *   - 因为是 startTransition 导航 + fallback={null}，React 会一直保留旧页面，
 *     所以【地址栏变了、页面纹丝不动】，看起来像"点了没反应"
 * 线上三条带 guard 的路由（taskDetail / calendarDetail / user）全都打不开。
 *
 * 所以这里必须用真 lazy。做法是保留【真实的 ROUTE_CONFIG 结构】（path / guard /
 * exact 一字不改），只把 component 工厂换成立刻 resolve 的标记组件 —— 既不拖依赖图，
 * 又完整跑通 lazy → Suspense → 重试这条路径。
 *
 * 判据有两条，缺一不可：
 *   1. 导航后 DOM 里出现目标路由的标记
 *   2. 该路由的工厂函数调用次数 ≤ 2（>2 就说明在造新 lazy 打转）
 * 只看第 1 条不够：万一以后 React 改了重试策略让它侥幸收敛，churn 仍是错的。
 *
 * 运行：
 *   JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom node tools/verify-router-client-render.cjs
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

// 兜底超时：真出现死循环时 act() 可能不返回，别让门禁挂死
setTimeout(() => {
  console.error('  超时 60s —— 大概率是渲染死循环，按失败处理');
  process.exit(3);
}, 60000).unref();

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
const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true, url: 'https://example.test/feed' });
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
global.IS_REACT_ACT_ENVIRONMENT = true;
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

// 【裸标识符 require】的理由见 verify-router-render.cjs 文件头：
// 绝对路径 require 会拿到另一份产物，<Routes> 认不出别的实例造的 <Route>。
const React = require('react');
const { createRoot } = require('react-dom/client');
const { MemoryRouter, Routes, useNavigate } = require('react-router');

const { ROUTE_CONFIG } = require(RW + 'src/router/config.ts');
const { PAGE_HEADER_ROUTE_CONFIG } = require(RW + 'src/router/PageHeader/config.ts');
const genRouteComponent = require(RW + 'src/router/genRouteComponent.tsx').default;

// 工厂调用次数：每造一个新的 lazy 就会 +1，是 churn 的直接度量
const factoryCalls = {};
const stubFactory = tag => () => {
  factoryCalls[tag] = (factoryCalls[tag] || 0) + 1;

  return Promise.resolve({ default: () => React.createElement('div', { 'data-route-comp': tag }) });
};

// 只换 component / guard.fallback，path / guard / exact 全部保持真实配置
const stubConfig = (cfg, prefix = '') => {
  const out = {};

  for (const [key, r] of Object.entries(cfg)) {
    out[key] = {
      ...r,
      ...(r.component ? { component: stubFactory(prefix + key) } : {}),
      ...(r.guard && r.guard.fallback
        ? { guard: { ...r.guard, fallback: stubFactory(prefix + key + ':fallback') } }
        : {}),
    };
  }

  return out;
};

const routes = genRouteComponent()(stubConfig(ROUTE_CONFIG));
// 顶栏是【另一张表、另一个 <Routes>】，和主路由表在同一个页面上并存。
// 它同样有 user 路由退化成 /:userSeg 的问题，但守卫要求不同：不匹配时必须
// 「什么都不渲染」而不是跳 404（顶栏只是页面的一个部件）。
// tools/verify-router-matching.cjs 的例外表放行了 67 条顶栏差异，前提就是这个
// emptyFallback 守卫真的生效 —— 所以在这里把它跑出来，而不是只写在注释里。
const headerRoutes = genRouteComponent()(stubConfig(PAGE_HEADER_ROUTE_CONFIG, 'hdr:'));

let navigateRef = null;
function NavHook() {
  navigateRef = useNavigate();

  return null;
}

const container = document.getElementById('app');
const root = createRoot(container);

// 每条用例：导航到 URL -> 期望出现的标记（与 config 键名一致）
const CASES = [
  ['/feeddetail', 'feedDetail'],
  ['/personal', 'personal'],
  // 下面三条是【带 guard 的】—— 线上打不开的就是它们
  ['/user', 'user'],
  ['/user_abc123', 'user'],
  ['/apps/task/task_abc123', 'taskDetail'],
  ['/apps/task/notaprefix', 'taskDetail:fallback'],
  ['/apps/calendar/detail_x1', 'calendarDetail'],
];

// 顶栏表的用例。'' 表示【期望什么都不渲染】—— v4 下这些 URL 一条顶栏路由都没命中。
const HEADER_CASES = [
  ['/user', 'hdr:user'],
  ['/user_abc123', 'hdr:user'],
  ['/feed', 'hdr:feed'],
  ['/personal', 'hdr:personal'],
  ['/search', 'hdr:search'],
  // 下面这些在 v4 下没有顶栏；退化成 /:userSeg 后会被 user 接住，靠 emptyFallback 挡回去
  ['/myprocess', ''],
  ['/apps/taskcenter', ''],
  ['/aggregation', ''],
];

async function flush(times = 12) {
  for (let i = 0; i < times; i++) {
    await React.act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  }
}

(async () => {
  await React.act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/feed'] },
        React.createElement(NavHook),
        React.createElement(Routes, null, routes),
      ),
    );
  });
  await flush();

  let pass = 0;
  let fail = 0;

  for (const [url, expect] of CASES) {
    for (const k of Object.keys(factoryCalls)) delete factoryCalls[k];

    await React.act(async () => {
      navigateRef(url);
    });
    await flush();

    const el = container.querySelector('[data-route-comp]');
    const got = el ? el.getAttribute('data-route-comp') : '(什么都没渲染出来)';
    const churn = factoryCalls[expect] || 0;
    const ok = got === expect && churn <= 2;
    ok ? pass++ : fail++;
    console.log(
      `  ${ok ? 'PASS ' : 'FAIL '} ${url.padEnd(26)} -> ${got.padEnd(22)} 工厂调用 ${churn} 次` +
        (ok ? '' : `   期望 ${expect} / ≤2 次`),
    );

    // 回到一个干净的起点，避免上一条的挂起状态影响下一条
    await React.act(async () => {
      navigateRef('/feed');
    });
    await flush(4);
  }

  // ---- 顶栏表 ----
  const hdrContainer = document.createElement('div');
  document.body.appendChild(hdrContainer);
  const hdrRoot = createRoot(hdrContainer);
  let hdrNavigate = null;
  const HdrNavHook = () => {
    hdrNavigate = useNavigate();

    return null;
  };

  await React.act(async () => {
    hdrRoot.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/feed'] },
        React.createElement(HdrNavHook),
        React.createElement(Routes, null, headerRoutes),
      ),
    );
  });
  await flush();

  console.log('\n  顶栏表：');

  for (const [url, expect] of HEADER_CASES) {
    await React.act(async () => {
      hdrNavigate(url);
    });
    await flush();

    const el = hdrContainer.querySelector('[data-route-comp]');
    const got = el ? el.getAttribute('data-route-comp') : '';
    const ok = got === expect;
    ok ? pass++ : fail++;
    console.log(
      `  ${ok ? 'PASS ' : 'FAIL '} ${url.padEnd(26)} -> ${(got || '(不渲染顶栏)').padEnd(22)}` +
        (ok ? '' : `   期望 ${expect || '(不渲染顶栏)'}`),
    );

    await React.act(async () => {
      hdrNavigate('/feed');
    });
    await flush(4);
  }

  console.log(`\n  → PASS ${pass} / FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
