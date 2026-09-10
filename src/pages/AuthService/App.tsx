import React, { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import preall from 'src/common/preall';
import { addSubPathOfRoute } from 'src/utils/common';
import { RouteElement } from '../../router/routeProps';
import withRouter from '../../router/withRouter';
import FindPassword from './findPassword';
import Login from './login';
import Register from './register';
import ResetPassword from './resetPassword';
import Twofactor from './twofactor';

const AUTH_ROUTES = [
  [['/resetPassword'], ResetPassword],
  [['/login', '/network'], Login],
  [['/findPassword'], FindPassword],
  [['/twofactor'], Twofactor],
  [['/register', '/linkInvite', '/join', '/enterpriseregister', '/enterpriseRegister'], Register],
];

function LoginContain(props) {
  useEffect(() => {
    window.reactRouterHistory = props.history;
  }, []);

  return (
    <ErrorBoundary>
      {/* v4 的 '/login*' 里 * 是【段内通配】，能匹配 /loginXYZ；v7 的 * 必须跟在
          / 后面，只能表达 /login 与 /login/... 两种。查过仓里认证类 URL 全是裸路径
          （/login、/register、/resetPassword…），没有带后缀的形态，所以按
          ['/x', '/x/*'] 展开是等价的。 */}
      <Routes>
        {AUTH_ROUTES.map(([paths, Comp]) =>
          paths
            .flatMap(one => [addSubPathOfRoute(one), `${addSubPathOfRoute(one)}/*`])
            .map(p => <Route key={p} path={p} element={<RouteElement component={Comp} />} />),
        )}
        <Route path="*" element={<RouteElement component={Login} />} />
      </Routes>
    </ErrorBoundary>
  );
}

const WrappedComp = preall(withRouter(LoginContain), { allowNotLogin: true });

export default WrappedComp;
