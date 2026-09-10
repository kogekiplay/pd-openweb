import React from 'react';
import hoistStatics from 'hoist-non-react-statics';
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
 *
 * 【必须 hoist 静态属性】v4 的 withRouter 内部就用了 hoist-non-react-statics。
 * 少了它，被包装组件上的 static defaultProps / propTypes / 自定义静态属性会全部丢掉 ——
 * 这不只是类型问题，运行时也会丢。第一版垫片漏了这一步，是 tsc 门禁在
 * ViewItems.tsx 上报 TS2741（defaultProps 缺失）才暴露出来的；
 * 仓里被包装的组件里有 4 个带静态属性。
 */
// 返回类型显式标成 any：仓里有 `let X = class {...}; X = withRouter(X);` 这种
// 【原地重新赋值】的写法，TS 会按类去推 X 的类型，而 HOC 的具体返回类型跟它不兼容。
// v4 时代本仓没装 @types/react-router-dom，withRouter 本身就是 any，所以一直没事。
// 标成 any 是把类型精度维持在升级前的水平，避免为了类型去改 32 个消费方。
export default function withRouter(Component): any {
  function WithRouter(props) {
    const routeProps = useRouteProps();

    return <Component {...props} {...routeProps} />;
  }

  WithRouter.displayName = `withRouter(${Component.displayName || Component.name || 'Component'})`;
  WithRouter.WrappedComponent = Component;

  return hoistStatics(WithRouter, Component);
}
