import React from 'react';
import { createRoot } from 'react-dom/client';
import { Route, BrowserRouter as Router, Routes } from 'react-router';
import preall from 'src/common/preall';
import { RouteElement } from 'src/router/routeProps';
import { addSubPathOfRoute } from 'src/utils/common';
import AgentLand from './AgentLand';

const root = createRoot(document.getElementById('app'));
// /mingo 独立页：左侧会话历史 + 右侧新版 Agent 对话。/mingo/chat/:sessionId 还原指定会话。
const WrappedComp = preall(() => (
  <Router>
    <Routes>
      {/* v4 里这两条都是非精确匹配，所以各补一条 /*；末尾那条没写 path 的
          在 v4 表示「都不匹配时兜底」，v7 里对应 path="*"（排序恒定最低）。 */}
      <Route path={addSubPathOfRoute('/mingo/chat/:sessionId')} element={<RouteElement component={AgentLand} />} />
      <Route
        path={`${addSubPathOfRoute('/mingo/chat/:sessionId')}/*`}
        element={<RouteElement component={AgentLand} />}
      />
      <Route path="*" element={<RouteElement component={AgentLand} />} />
    </Routes>
  </Router>
));

root.render(<WrappedComp />);
