import type { ReactNode } from 'react';
import type { ChatPanelRuntime } from './ChatPanel';
import { AgentBusProvider } from './agentBus';
import ChatPanel from './ChatPanel';

// runtime（可选）：匿名/产品版续建等非默认运行模式的配置，透传给 ChatPanel。
// 不传时维持登录态自动路由的既有行为（/agent 落地页、应用内抽屉）。
export default function Agent({ runtime, isSingleMingoPlan = false, children = null }: { runtime?: ChatPanelRuntime | undefined; isSingleMingoPlan?: boolean; children?: ReactNode }) {
  return (
    <AgentBusProvider>
      {children}
      <ChatPanel runtime={runtime} isSingleMingoPlan={isSingleMingoPlan} />
    </AgentBusProvider>
  );
}
