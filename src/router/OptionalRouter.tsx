import React from 'react';
import { BrowserRouter, useInRouterContext } from 'react-router';

/**
 * 只在【外面还没有 Router】的时候才套一层 BrowserRouter。
 *
 * 为什么需要它：仓里有一批弹层组件有两种挂载方式 ——
 *   1) 走 FunctionWrap / createRoot 挂到一个游离的 div 上，那棵树里没有 Router，
 *      组件内部的 Link / useNavigate / useLocation 会直接抛；
 *   2) 直接嵌在页面组件树里，外面【已经】有 App 的 Router。
 * 它们原来一律自己套 <BrowserRouter>。react-router 4 容忍嵌套 Router，
 * 7 会直接抛 "You cannot render a <Router> inside another <Router>"，
 * 于是第 2 种挂法整个白屏（被 ErrorBoundary 接住，界面上只是打不开）。
 *
 * useInRouterContext() 是 react-router 官方给的判断方式，只读上下文、无副作用。
 */
export default function OptionalRouter({ children }: { children: React.ReactNode }) {
  const inRouterContext = useInRouterContext();

  return inRouterContext ? <>{children}</> : <BrowserRouter>{children}</BrowserRouter>;
}
