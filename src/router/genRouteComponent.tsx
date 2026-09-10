import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router';
import _ from 'lodash';
import expandRoutePaths from './expandRoutePaths';
import SegmentPrefixGuard from './SegmentPrefixGuard';
import WithTitleRoute from './withTitle';

const getComponent = component => lazy(component);

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
      // 所以这里把它们在这一层消化掉，不要透传下去。
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
              element={<WithTitleRoute component={Wrapped} {...rest} preCallback={preCallback} />}
            />,
          );
        }
      });
    });

    return components;
  };
};
