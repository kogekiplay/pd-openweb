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
 * 「程序错误，请刷新页面重试」—— 而路由匹配差分（tools/verify-router-matching.ts）
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
const { transformFileSync, transformSync, readSource, ROOT } = require('../../../scripts/spec-harness.ts');
const { generatePath, matchPath } = require('react-router');

global._l = global._l || ((s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), String(s)));
// router.config 顶层会读 window.md.global.SysSettings 来过滤菜单项
global.window = global.window || { md: { global: { SysSettings: {} } } };

function loadMenuList() {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
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

// ─────────────────────────────────────────────────────────────────────────────
// 真实渲染回归：Admin 父路由已改成 '/admin/*'，不再提供 match.params.projectId。
// 菜单必须从 location.pathname 取 canonical projectId（Admin/config.getProjectIdFromPath），
// 否则 4 个 feature 依赖菜单会拿 undefined 去问授权、组织名称会跳到 /admin/home/undefined。
// 本用例直接实例化真实 menu/index.tsx 的 class 并调用 render()：UI/import 依赖只在模块边界
// 打桩，React 用真的（createElement），不需要 DOM；getProjectIdFromPath 从 Admin/config.ts
// 的真实 AST 里摘出初始化表达式再求值，不复制 helper。
// ─────────────────────────────────────────────────────────────────────────────
{
  const React = require('react');
  const babelParser = require('@babel/parser');

  const REAL_PID = '60a5f4ba-4105-4f79-98cc-5da277d4600e';
  const REAL_PATHNAME = `/admin/home/${REAL_PID}`;

  // 1) 真实 getProjectIdFromPath（AST 摘取 + 去类型 + 求值；不是抄一份）
  const configText = readSource('src/pages/Admin/config.ts');
  const configAst = babelParser.parse(configText, { sourceType: 'module', plugins: ['typescript'] });
  let helperInit = null;
  const walkConfig = node => {
    if (!node || typeof node !== 'object' || helperInit) return;
    if (
      node.type === 'VariableDeclarator' &&
      node.id &&
      node.id.type === 'Identifier' &&
      node.id.name === 'getProjectIdFromPath'
    ) {
      helperInit = node.init;
      return;
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(walkConfig);
      } else if (value && typeof value === 'object' && value.type) {
        walkConfig(value);
      }
    }
  };
  walkConfig(configAst.program);
  assert.ok(helperInit, 'Admin/config.ts 里必须仍有 getProjectIdFromPath —— 菜单的 canonical projectId 来源');
  const helperCompiled = transformSync(
    'const __fn = ' + configText.slice(helperInit.start, helperInit.end) + ';',
    {
      filename: path.join(ROOT, 'src/pages/Admin/config.ts'),
      babelrc: false,
      configFile: false,
      presets: ['@babel/preset-typescript'],
      plugins: [],
    },
  );
  assert.ok(helperCompiled && helperCompiled.code, 'getProjectIdFromPath 片段编译失败');
  const realGetProjectIdFromPath = new Function('location', helperCompiled.code + '\nreturn __fn;')({
    pathname: '/admin/home/unused-default',
  });
  assert.strictEqual(
    realGetProjectIdFromPath(REAL_PATHNAME),
    REAL_PID,
    '真实 getProjectIdFromPath 必须能从 /admin/home/<id> 取出 canonical id',
  );

  // 2) 加载真实 menu/index.tsx；依赖只在模块边界打桩
  const feCalls = [];
  const navCalls = [];
  // MdLink 只会在 React 渲染阶段被调用；这里不跑 ReactDOM，直接按“元素类型”识别并读 props.to。
  const MdLinkStub = () => null;
  const MdLink = MdLinkStub;
  const featureStatus = { F_ANALYTICS: '1', F_AGG: '1', F_GV: '1', F_QUOTA: '1', F_OFF: '' };
  const stubs = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-redux': { shallowEqual: (a, b) => a === b },
    'react-router': require('react-router'),
    '@rc-component/trigger': props => React.createElement('div', { className: 'trigger-stub' }, props.children),
    classnames: (...args) => args.filter(Boolean).join(' '),
    lodash: require('lodash'),
    'ming-ui': {
      MdLink,
      UpgradeIcon: () => React.createElement('i', { className: 'upgrade' }),
    },
    'ming-ui/antd-components': {
      Tooltip: props => React.createElement('span', { className: 'tooltip' }, props.children),
    },
    'src/router/navigateTo': {
      navigateTo: url => {
        navCalls.push(url);
      },
    },
    'src/utils/common': { getPathWithoutSubPath: p => p },
    'src/utils/enum': {
      VersionProductType: {
        workwxIntergration: 'w',
        dingIntergration: 'd',
        feishuIntergration: 'f',
        WelinkIntergration: 'l',
      },
    },
    'src/utils/project': {
      getCurrentProject: projectId => ({ companyName: `测试组织 ${projectId}` }),
      getFeatureStatus: (projectId, featureId) => {
        feCalls.push({ projectId, featureId });
        return featureStatus[featureId] || '';
      },
    },
    '../../../router/withRouter': { __esModule: true, default: Component => Component },
    '../config': { getProjectIdFromPath: realGetProjectIdFromPath },
  };
  const localRequire = request => {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    if (request === './index.less') return {};
    throw new Error('Admin menu regression: 未预期的 import ' + request);
  };

  const menuSource = readSource('src/pages/Admin/menu/index.tsx');
  assert.ok(
    /getProjectIdFromPath\(pathname\)/.test(menuSource),
    'menu/index.tsx 必须用 location.pathname 调 getProjectIdFromPath，而不是 match.params.projectId',
  );
  assert.ok(
    !/match\.params\.projectId|params\.projectId/.test(menuSource),
    'menu/index.tsx 不得再依赖 match.params.projectId（/admin/* 父路由不提供它）',
  );

  const { code } = transformFileSync(path.join(__dirname, 'menu/index.tsx'), {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // 与文件开头 loadMenuList 同一口径：被测模块/渲染树的形状由运行时决定，
  // 用 Record<string, any> 描述（这不是给产品代码开口子，spec 也不在 strict 门禁里）。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);
  const AdminLeftMenu = moduleLike.exports.default;
  assert.strictEqual(
    typeof AdminLeftMenu,
    'function',
    'menu/index.tsx 默认导出应可实例化（withRouter 在 spec 里被 stub 成恒等）',
  );

  // 3) 全局桩（render/renderLinkItem 会读这些）
  global.window = Object.assign(global.window || {}, {
    platformENV: { isLocal: false, isOverseas: false, isPlatform: true },
  });
  global.md = {
    global: {
      SysSettings: {},
      Account: { projects: [{ projectId: REAL_PID, licenseType: 3 }] },
    },
  };
  global._l = global._l || (s => String(s));

  // 4) fixture：4 个 feature 依赖菜单 + 1 个无 featureId + 1 个禁用 feature
  // 真实 router.config 的路径都是 v7 语法：':projectId' 具名段或 '/*' 通配段；
  // buildMenuHref 只在这两种形态下才会把 projectId 填进 href。
  const featureMenus = [
    {
      key: 'analytics',
      name: '数据统计',
      menuPath: 'analytics/:projectId',
      routes: [{ path: 'analytics/:projectId' }],
      featureId: 'F_ANALYTICS',
    },
    {
      key: 'aggregationTable',
      name: '聚合表',
      menuPath: 'aggregationTable/:projectId',
      routes: [{ path: 'aggregationTable/:projectId' }],
      featureId: 'F_AGG',
    },
    {
      key: 'globalVariable',
      name: '全局变量',
      menuPath: 'globalVariable/:projectId',
      routes: [{ path: 'globalVariable/:projectId' }],
      featureId: 'F_GV',
    },
    {
      key: 'quota',
      name: '容量管理',
      menuPath: 'quota/:projectId',
      routes: [{ path: 'quota/:projectId' }],
      featureId: 'F_QUOTA',
    },
  ];
  const plainMenu = {
    key: 'structure',
    name: '组织架构',
    menuPath: 'structure/*',
    routes: [{ path: 'structure/*' }],
  };
  const disabledMenu = {
    key: 'disabledFeature',
    name: '已禁用功能',
    menuPath: 'disabledFeature/:projectId',
    routes: [{ path: 'disabledFeature/:projectId' }],
    featureId: 'F_OFF',
  };
  const menuList = [{ key: 'basic', title: '', subMenuList: [...featureMenus, plainMenu, disabledMenu] }];

  // 关键复现条件：match.params 只有 v7 通配键 '*'，没有 projectId
  const matchWithoutProjectId = { params: { '*': `home/${REAL_PID}` }, path: '/admin/*', url: REAL_PATHNAME };
  assert.ok(
    !Object.prototype.hasOwnProperty.call(matchWithoutProjectId.params, 'projectId'),
    '回归前置：/admin/* 的 match.params 不应有 projectId',
  );

  const instance = new AdminLeftMenu({
    menuList,
    location: { pathname: REAL_PATHNAME, search: '', hash: '' },
    match: matchWithoutProjectId,
    isExtend: true,
  });
  const tree = instance.render();

  type RenderElement = { type?: unknown; props: Record<string, any> };
  const elements: RenderElement[] = [];
  const walkTree = (node: any): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walkTree);
      return;
    }
    if (typeof node === 'string' || typeof node === 'number') return;
    if (typeof node === 'object' && node.props) {
      elements.push(node);
      walkTree(node.props.children);
    }
  };
  walkTree(tree);
  const textOf = (node: any): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (typeof node === 'object' && node.props) return textOf(node.props.children);
    return '';
  };
  const renderedText = textOf(tree);

  // 5) 断言：4 个 feature 菜单都显示，且授权查询用的是真实 projectId
  for (const menu of featureMenus) {
    assert.ok(renderedText.includes(menu.name), `feature 菜单 ${menu.key} 应显示（projectId 正确时）`);
    assert.ok(
      feCalls.some(call => call.projectId === REAL_PID && call.featureId === menu.featureId),
      `${menu.key} 的 getFeatureStatus 必须收到真实 projectId=${REAL_PID}（实际调用：${JSON.stringify(feCalls)}）`,
    );
  }
  assert.ok(renderedText.includes(plainMenu.name), '没有 featureId 的原菜单项必须仍然存在');
  assert.ok(feCalls.some(call => call.featureId === 'F_OFF'), '禁用 feature 仍要走授权查询（不移除授权判断）');
  assert.ok(!renderedText.includes(disabledMenu.name), '禁用 feature 的菜单必须被过滤（不展示），但仍保留授权语义');
  assert.ok(
    feCalls.every(call => call.projectId === REAL_PID),
    `任何 feature 查询都不能用 undefined projectId（实际：${JSON.stringify(feCalls.filter(c => c.projectId !== REAL_PID))}）`,
  );

  // 6) 断言：菜单链接都用真实 projectId 生成（从真实元素树的 MdLink props.to 取）
  const linkTargets = elements.filter(el => el.type === MdLink).map(el => el.props.to);
  assert.ok(
    linkTargets.length >= featureMenus.length + 1,
    `菜单链接数量异常：${JSON.stringify(linkTargets)}（elements=${elements.length}）`,
  );
  for (const target of linkTargets) {
    assert.ok(
      typeof target === 'string' && target.includes(REAL_PID),
      `菜单链接必须包含真实 projectId：${target}`,
    );
  }

  // 7) 断言：组织名称 onClick 导航到 /admin/home/<真实 id>
  const companyNameEl = elements.find(el => typeof el.props.className === 'string' && el.props.className.includes('companyName'));
  assert.ok(companyNameEl, '应渲染出组织名称节点（className 含 companyName）');
  assert.strictEqual(typeof companyNameEl.props.onClick, 'function', '组织名称节点应有 onClick');
  companyNameEl.props.onClick();
  assert.deepStrictEqual(navCalls, [`/admin/home/${REAL_PID}`], '组织名称点击必须导航到 /admin/home/<真实 id>');
}
