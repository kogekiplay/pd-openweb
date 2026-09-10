import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

/**
 * withRouter —— react-router v6 起被移除，这里用 hooks 重新实现。
 *
 * 为什么保留这个 HOC 而不是把消费方改成函数组件：仓里 32 个消费方绝大多数是
 * 类组件，而 hooks 只能在函数组件里用。把它们逐个改写成函数组件是一次与路由
 * 升级无关的大重构（涉及 state / 生命周期 / ref），风险和体量都远超本次目标。
 * react-router 官方的迁移指南给出的也正是这个写法。
 *
 * 【提供的字段严格按实测的消费面来】（见提交说明里的调查）：
 *   history: push / replace / go / goBack / goForward / location
 *   location: 原样透传 useLocation()
 *   match: params（223 处在用）/ url（仅 dingSyncCourse 用它 indexOf 判断当前路由）
 * 没有提供 history.listen、history.block、history.length ——
 * 查过全仓没有任何消费方读它们（`history.length` 那两处是 DOM 的 window.history，
 * 配合 history.back() 使用，与路由无关）。
 * 刻意不提供而不是给个假实现：真有人用到时应当立刻报错，而不是拿到静默失效的东西。
 */
export default function withRouter(Component) {
  function WithRouter(props) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();

    const history = useMemo(
      () => ({
        // v4 的 push/replace 第二参是 state；v7 挪进了 options.state
        push: (to, state) => navigate(to, { state }),
        replace: (to, state) => navigate(to, { state, replace: true }),
        go: n => navigate(n),
        goBack: () => navigate(-1),
        goForward: () => navigate(1),
        location,
      }),
      [navigate, location],
    );

    const match = useMemo(
      () => ({
        params,
        // v4 的 match.url 是【被匹配到的那一段】，不是整个 pathname。
        // 唯一的消费方 dingSyncCourse 只拿它做 indexOf('dingAppCourse') 这类判断，
        // 而路由前缀本来就是 pathname 的前缀，用 pathname 结果相同。
        url: location.pathname,
        path: location.pathname,
        isExact: true,
      }),
      [params, location.pathname],
    );

    return <Component {...props} history={history} location={location} match={match} navigate={navigate} />;
  }

  WithRouter.displayName = `withRouter(${Component.displayName || Component.name || 'Component'})`;

  return WithRouter;
}
