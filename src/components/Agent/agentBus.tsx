import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

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
//   useAgentEvent('file:begin', ({ path }) => ...);

/**
 * payload 的形状随 topic 变，而 topic 是使用方按需加的开放集合
 * （见上面的约定），所以这里不可能有比 any 更精确的类型。
 * 要收窄得先把 topic 收成有限联合并逐个绑定 payload，那是另一件事。
 */
type BusPayload = any;

type BusHandler = (payload: BusPayload, topic: string) => void;

export interface AgentBus {
  /** 订阅 topic，返回取消订阅的函数 */
  on: (topic: string, handler: BusHandler) => () => void;
  emit: (topic: string, payload?: BusPayload) => void;
}

// 必须写成 AgentBus | null：只写 createContext(null) 的话 context 类型就是 null，
// 下面 useAgentBus 里 `if (!ctx) throw` 之后 ctx 被收窄成 never，
// 于是每一个 bus.emit(...) 调用点都报「emit 不存在于 never」（全仓 38 处）。
const BusContext = createContext<AgentBus | null>(null);

export function AgentBusProvider({ children }: { children?: React.ReactNode }) {
  const listenersRef = useRef(new Map<string, Set<BusHandler>>());

  const on = useCallback((topic: string, handler: BusHandler) => {
    let set = listenersRef.current.get(topic);

    if (!set) {
      set = new Set();
      listenersRef.current.set(topic, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) listenersRef.current.delete(topic);
    };
  }, []);

  const emit = useCallback((topic: string, payload?: BusPayload) => {
    const set = listenersRef.current.get(topic);

    if (!set || set.size === 0) return;
    // 复制一份再迭代，handler 在执行中取消订阅不会影响本轮派发
    [...set].forEach(handler => {
      try {
        handler(payload, topic);
      } catch (error) {
        console.error(`[agentBus] handler error on "${topic}":`, error);
      }
    });
  }, []);

  const value = useMemo(() => ({ on, emit }), [on, emit]);

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
export function useAgentEvent(topic: string, handler: BusHandler) {
  const { on } = useAgentBus();
  // handler 用 ref 持续指向最新闭包，避免每次重新订阅
  const handlerRef = useRef(handler);

  handlerRef.current = handler;
  useEffect(() => on(topic, (payload, t) => handlerRef.current && handlerRef.current(payload, t)), [on, topic]);
}
