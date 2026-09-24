import { useEffect } from 'react';
import { navigateTo } from './navigateTo';

/**
 * 在【提交之后】调 navigateTo 做跳转；给「render 里判断完要跳走」的地方用。
 *
 * 【为什么不能在 render 里直接调 navigateTo】它会同步更新 BrowserRouter 的状态，
 * 也就是在渲染 A 组件的过程中去改 B 组件（路由）的 state，React 报
 * 「Cannot update a component (BrowserRouter) while rendering a different component」。
 * 2026-09-23 爬后台 34 个路由时在 /admin/billinfo 抓到的就是这个：私有部署的权限里
 * 没有账单中心，Admin 的 render 直接 navigateTo 回首页。
 *
 * 【为什么不用 react-router 的 <Navigate>】navigateTo 还做了子路径补全（pathCompletion）、
 * 离开页面确认（NavigationPrompt）、同址去重、/app/my 的分组重定向，并置 window.redirected ——
 * <Navigate> 一样都不做，换过去就不等价了。这里只改调用时机，不改跳转逻辑。
 *
 * 渲染结果是 null，与原先 `navigateTo(...); return null;` 看到的一致。
 * 同样的写法见 NotFoundRedirect.tsx。
 */
export default function RedirectTo({ url, replace = false }: { url: string; replace?: boolean }) {
  useEffect(() => {
    navigateTo(url, replace);
  }, [url, replace]);

  return null;
}
