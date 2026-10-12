import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
// 极简事件总线：左右两个组件各自管 state，通过具名事件互发。
//
// 约定：topic 用 `<来源>:<动作>` 命名，比如：
//   chat → builder：'file:begin' / 'file:delta' / 'file:end' / 'file:write' / 'file:edit' / 'file:focus'
//   builder → chat：'builder:user-edit' / 'builder:request-prompt' / 'builder:close' / 'builder:generate'
// 双方都不需要预先约定具体 topic 列表，使用方按需加。
//
// 用法：
//   <AgentBusProvider> 包住两侧
//   const bus = useAgentBus(); bus.emit('file:begin', { path: 'plan.md' });
//   useDecodedAgentEvent('file:begin', p => decodeFileEvent('file:begin', p), event => ...);

// Topics stay extensible; their transport payload is unknown until a consumer decodes it.
import { createAgentBus } from './agentEventBus';
import type { AgentBus, AgentEventDecoder, AgentEventHandler } from './agentEventBus';

export type { AgentBus } from './agentEventBus';

// 必须写成 AgentBus | null：只写 createContext(null) 的话 context 类型就是 null，
// 下面 useAgentBus 里 `if (!ctx) throw` 之后 ctx 被收窄成 never，
// 于是每一个 bus.emit(...) 调用点都报「emit 不存在于 never」（全仓 38 处）。
const BusContext = createContext<AgentBus | null>(null);

export function AgentBusProvider({ children }: { children?: React.ReactNode }) {
  const [value] = useState(createAgentBus);

  return <BusContext.Provider value={value}>{children}</BusContext.Provider>;
}

export function useAgentBus(): AgentBus {
  const ctx = useContext(BusContext);

  if (!ctx) {
    throw new Error('useAgentBus must be used within <AgentBusProvider>');
  }
  return ctx;
}

// 语法糖：组件挂载时订阅 topic，卸载时自动取消
export function useAgentEvent(topic: string, handler: AgentEventHandler) {
  const { on } = useAgentBus();
  // handler 用 ref 持续指向最新闭包，避免每次重新订阅
  const handlerRef = useRef(handler);

  handlerRef.current = handler;
  useEffect(() => on(topic, (payload, t) => handlerRef.current && handlerRef.current(payload, t)), [on, topic]);
}

// Typed subscriptions validate the fields they consume; custom topics remain supported.
export function useDecodedAgentEvent<T>(
  topic: string,
  decode: AgentEventDecoder<T>,
  handler: (payload: T, topic: string) => void,
) {
  const decoderRef = useRef(decode);
  const handlerRef = useRef(handler);
  decoderRef.current = decode;
  handlerRef.current = handler;
  useAgentEvent(topic, (payload, currentTopic) => {
    const decoded = decoderRef.current(payload);
    if (decoded !== null) handlerRef.current(decoded, currentTopic);
  });
}
