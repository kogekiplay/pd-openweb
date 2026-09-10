import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router';
import _ from 'lodash';
import expandRoutePaths from './expandRoutePaths';
import SegmentPrefixGuard from './SegmentPrefixGuard';
import WithTitleRoute from './withTitle';

// 按工厂缓存：同一个 import 工厂永远拿到同一个 lazy 组件。
// 本文件里 getComponent 只在配置遍历时调（每个 key 一次），加缓存不是为了省这一次，
// 而是让「绝不会产出新组件类型」成为这个函数【自身】的性质，而不是依赖调用点的纪律 ——
// 下面那段注释里的死循环就是纪律没守住造成的。src/router/renderTimeLazy.spec.js
// 会检查白名单文件确实做了缓存。
const lazyCache = new Map();
const getComponent = component => {
  if (!lazyCache.has(component)) lazyCache.set(component, lazy(component));

  return lazyCache.get(component);
};

export default () => {
  const components = [];

  return (ROUTE_CONFIG, preCallback) => {
    /**
     * 缓存生成的路由组件
     */
    if (components.length > 0) return components;

    _.keys(ROUTE_CONFIG).forEach((key, i) => {
      const { component, redirect, path, exact, strict, sensitive, guard, ...rest } = ROUTE_CONFIG[key];
      // guard：v7 表达不了 v4 的「段内静态前缀」路径（/user_:id 这类），
      // 只能整段匹配后在组件里判前缀。见 ./SegmentPrefixGuard。
      // guard.fallback 在配置里写成 () => import(...)，和 component 一样是懒加载
      // 工厂函数，这里统一用 lazy 包成真正的组件（守卫是直接 <Fallback /> 渲染的）。
      const guardProps = guard
        ? { ...guard, ...(guard.fallback ? { fallback: getComponent(guard.fallback) } : {}) }
        : null;
      // 【lazy() 必须在这里调、不能挪进下面的渲染函数里】
      // lazy(component) 每调一次都产出一个全新的组件类型，而新 lazy 必然先 suspend。
      // 写成 props => <Guard component={lazy(component)} /> 的话：suspend →
      // withTitle 的 <Suspense> 挂起 → promise resolve 后 React 从边界往下重渲染 →
      // 又造一个新 lazy → 又 suspend，无限循环，页面永远出不来。
      // 而且它【不抛错、不刷 CPU、不发网络请求】（webpack 的 import 有缓存），
      // 导航还是 startTransition + fallback={null}，所以线上表现是
      // 「地址栏变了、页面纹丝不动」，一条日志都没有。三条带 guard 的路由全中。
      // 回归测试见 tools/verify-router-client-render.cjs —— 它专门盯工厂调用次数。
      const LazyComponent = getComponent(component);
      const Wrapped = guardProps
        ? props => <SegmentPrefixGuard {...props} {...guardProps} component={LazyComponent} />
        : LazyComponent;

      // v7 的 <Route> 不认数组 path，也不认 exact/strict/sensitive
      //（精确与否改由「有没有 /*」表达，见 expandRoutePaths）。
      // 所以这里把它们在这一层消化掉，不要透传给 <Route>。
      //
      // 【但 path 必须继续【作为 prop】发给业务组件】。v4 的这段代码是
      // `const { component, redirect, ...rest } = ROUTE_CONFIG[key]`，path 留在 rest 里、
      // 一路 spread 到了组件上，于是有 6 个顶栏组件靠 props.path【认自己是哪一条路由】：
      //   AppPkgSimpleHeader  props.path.indexOf('logs'|'analytics'|'settings')
      //   AppPkgHeader        props.path === subPath + '/worksheet/:worksheetId?'
      //   NetManageHeader / GlobalSearchHeader  用 props.path 查 PAGE_HEADER_ROUTE 表定模块
      //   HubAndPluginHeader  _.includes('/plugin', path) 区分集成/插件
      //   NativeHeader        urlMatch.test(path) 高亮页签
      // 第一版顺手把 path 一起解构掉了，后果是 AppPkgSimpleHeader 直接
      // 「Cannot read properties of undefined (reading 'indexOf')」—— 顶栏整条变成
      // 「程序错误」（正文还是好的，所以很容易漏看）；其余五个不抛错、只是静默认错模块：
      // 后台顶栏没了「组织管理」标题、插件页顶栏写着「集成」。
      //
      // 发出去的是【配置里原始的 path】（可能是数组，也已被 addSubPathOfRoutes 加过子路径），
      // 而不是 expandRoutePaths 摊平补 /* 之后的那条 —— 前者才和 v4 拿到的值一模一样，
      // 上面那些等值比较和查表才对得上。
      const routeProps = { ...rest, path };

      expandRoutePaths({ path, exact }).forEach((p, j) => {
        if (redirect) {
          // v4 的 <Redirect> 在 v7 里叫 <Navigate>，而且必须写 replace ——
          // v4 的 Redirect 默认就是替换历史记录，v7 的 Navigate 默认是 push，
          // 不写的话用户点返回会被弹回来、陷在重定向里出不去。
          components.push(<Route key={`${i}-${j}`} path={p} element={<Navigate to={redirect} replace />} />);
        } else {
          components.push(
            <Route
              key={`${i}-${j}`}
              path={p}
              element={<WithTitleRoute component={Wrapped} {...routeProps} preCallback={preCallback} />}
            />,
          );
        }
      });
    });

    return components;
  };
};
