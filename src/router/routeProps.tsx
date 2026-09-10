import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

/**
 * 把 v4 时代的路由 props（history / location / match）用 hooks 重新造出来。
 *
 * 为什么需要：v4 的 <Route component={X}> 会自动给 X 注入这三样，
 * v7 的 <Route element={<X/>}> 什么都不注入 —— 而本仓有 97 个文件在读
 * props.match / props.location / props.history，其中大量是类组件，用不了 hooks。
 *
 * withRouter / withTitle / RouteElement 三处都用这一份，避免各写一遍口径漂移。
 *
 * 【字段范围是按实测的消费面定的，不是照抄 v4 的全集】：
 *   history: push / replace / go / goBack / goForward / location
 *   match:   params（223 处在用）、url / path（仅 dingSyncCourse 拿 url 做 indexOf 判断）
 * 刻意不提供 history.listen / block / length —— 查过全仓没有消费方，
 * 真有人用到时应当立刻报错，而不是拿到一个静默失效的假实现。
 */
export function useRouteProps() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  return useMemo(() => {
    const history = {
      // v4 的 push/replace 第二参是 state，v7 挪进了 options.state
      push: (to, state) => navigate(to, { state }),
      replace: (to, state) => navigate(to, { state, replace: true }),
      go: n => navigate(n),
      goBack: () => navigate(-1),
      goForward: () => navigate(1),
      location,
    };

    return {
      history,
      location,
      navigate,
      match: {
        params,
        // v4 的 match.url 是【被匹配到的那一段】而非整个 pathname。唯一的消费方
        // dingSyncCourse 只拿它做 indexOf('dingAppCourse') 这类判断，而路由前缀
        // 本来就是 pathname 的前缀，用 pathname 结果相同。
        url: location.pathname,
        path: location.pathname,
        isExact: true,
      },
    };
  }, [navigate, location, params]);
}

/**
 * 给 <Route element={...}> 用的薄包装：把路由 props 注入给目标组件。
 *
 * 用 element={<RouteElement component={X} />} 而不是
 * element={React.createElement(withRouter(X))} —— 后者每次渲染都会生成一个
 * 新的组件类型，React 会把它当成不同组件而整棵卸载重建。
 */
export function RouteElement({ component: Comp, ...rest }) {
  const routeProps = useRouteProps();

  return <Comp {...routeProps} {...rest} />;
}

export default useRouteProps;
