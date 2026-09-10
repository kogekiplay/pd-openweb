import React, { Fragment, Suspense, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import DocumentTitle from 'react-document-title';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';

/**
 * 路由组件的统一外壳：标题 + 错误边界 + Suspense + 【把 v4 时代的路由 props 注回去】。
 *
 * v4 里 <Route component={X}> 会自动给 X 注入 history / location / match，
 * v7 的 <Route element={<X/>}> 不再注入任何东西 —— 而本仓有 97 个文件在读
 * props.match / props.location / props.history。逐个改成 hooks 是一次波及面
 * 极大的重构（其中很多是类组件，根本用不了 hooks），所以在这一层统一补上，
 * 与 src/router/withRouter.tsx 的做法和字段口径保持一致。
 *
 * 注意本组件自己【不再渲染 <Route>】：它现在是被当作 element 传进 <Route> 的，
 * 再套一层 Route 会变成嵌套路由、path 语义完全不对。
 */
export default function WithTitle(props) {
  const { title, component: Comp, preCallback, ...rest } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const routeProps = useMemo(() => {
    const history = {
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
      match: { params, url: location.pathname, path: location.pathname, isExact: true },
    };
  }, [navigate, location, params]);

  // preCallback 在 v4 里是 componentDidMount 时调一次。这里用 ref 保证同样只调一次：
  // element 会随每次导航重新渲染，直接在渲染里调会重复触发。
  const called = React.useRef(false);
  React.useEffect(() => {
    if (called.current) return;

    called.current = true;
    preCallback && preCallback({ ...routeProps, ...rest });
  }, []);

  return (
    <Fragment>
      {title && <DocumentTitle title={title} />}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Comp {...routeProps} {...rest} />
        </Suspense>
      </ErrorBoundary>
    </Fragment>
  );
}
