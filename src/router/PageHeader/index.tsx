import React from 'react';
import { Routes, useLocation } from 'react-router';
import { withoutHeaderUrl } from '../config';
import genRouteComponent from '../genRouteComponent';
import { PAGE_HEADER_ROUTE_CONFIG } from './config';

const genHeaderRouteComponent = genRouteComponent();
export default () => {
  // 原来外层套了一条 path={withoutHeaderUrl} 的空路由来「屏蔽顶栏」，
  // withoutHeaderUrl 现在是谓词函数（见 config.ts 说明），直接判断。
  // 显式取 useLocation() 而不是读 location.pathname：前者会在导航时
  // 触发本组件重渲染，后者只能指望父组件恰好也重渲染。
  const { pathname } = useLocation();

  if (withoutHeaderUrl(pathname)) return null;

  return (
    <header>
      <Routes>{genHeaderRouteComponent(PAGE_HEADER_ROUTE_CONFIG)}</Routes>
    </header>
  );
};
