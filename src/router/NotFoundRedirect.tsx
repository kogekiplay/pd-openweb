import { useEffect } from 'react';

/**
 * 兜底 404：跳到平台的 404 页。
 *
 * 原来写在 src/router/App.tsx 的 <Route path="*" render={() => { location.href = ... }} /> 里。
 * v7 的 <Route> 只有 element、没有 render，而 element 是个已经创建好的元素，
 * 不能在里面直接写副作用 —— 所以抽成组件。
 *
 * 用 useEffect 而不是在渲染期直接跳：渲染期做副作用在 React 18/19 的并发渲染下
 * 可能被丢弃或重复执行。
 *
 * 除了兜底路由，迁移中还有几处「v7 表达不了 v4 的路径形状」的地方也复用它 ——
 * v7 无法匹配段内静态前缀（/user_:id、/apps/calendar/detail_:id 这类），
 * 只能退化成整段匹配，再在组件里判断前缀，不符就走这里，与 v4 落到兜底路由同效。
 */
export default function NotFoundRedirect() {
  useEffect(() => {
    location.href = md.global.Config.PlatformUrl + '404';
  }, []);

  return null;
}
