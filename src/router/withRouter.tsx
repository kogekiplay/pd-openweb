import React from 'react';
import { useRouteProps } from './routeProps';

/**
 * withRouter —— react-router v6 起被移除，这里用 hooks 重新实现。
 *
 * 为什么保留这个 HOC 而不是把消费方改成函数组件：仓里 32 个消费方绝大多数是
 * 类组件，而 hooks 只能在函数组件里用。把它们逐个改写成函数组件是一次与路由
 * 升级无关的大重构（涉及 state / 生命周期 / ref），风险和体量都远超本次目标。
 * react-router 官方的迁移指南给出的也正是这个写法。
 *
 * 注入的字段口径见 ./routeProps（withTitle 和 RouteElement 共用同一份）。
 */
export default function withRouter(Component) {
  function WithRouter(props) {
    const routeProps = useRouteProps();

    return <Component {...props} {...routeProps} />;
  }

  WithRouter.displayName = `withRouter(${Component.displayName || Component.name || 'Component'})`;

  return WithRouter;
}
