import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import _ from 'lodash';
import expandRoutePaths from './expandRoutePaths';
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
      const { component, redirect, path, exact, strict, sensitive, ...rest } = ROUTE_CONFIG[key];

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
              element={<WithTitleRoute component={getComponent(component)} {...rest} preCallback={preCallback} />}
            />,
          );
        }
      });
    });

    return components;
  };
};
