export type AgentEventHandler = (payload: unknown, topic: string) => void;
export type AgentEventDecoder<T> = (payload: unknown) => T | null;
export interface AgentBus {
  on: (topic: string, handler: AgentEventHandler) => () => void;
  emit: (topic: string, payload?: unknown) => void;
}
export function createAgentBus(
  reportError: (error: unknown, topic: string) => void = (error, topic) =>
    console.error(`[agentBus] handler error on "${topic}":`, error),
): AgentBus {
  const listeners = new Map<string, Set<AgentEventHandler>>();
  return {
    on(topic, handler) {
      let handlers = listeners.get(topic);
      if (!handlers) {
        handlers = new Set();
        listeners.set(topic, handlers);
      }
      handlers.add(handler);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        handlers.delete(handler);
        // A later subscription may already have created a different set for this topic.
        if (!handlers.size && listeners.get(topic) === handlers) listeners.delete(topic);
      };
    },
    emit(topic, payload) {
      const handlers = listeners.get(topic);
      if (!handlers?.size) return;
      for (const handler of [...handlers]) {
        try {
          handler(payload, topic);
        } catch (error: unknown) {
          reportError(error, topic);
        }
      }
    },
  };
}
export function subscribeDecodedAgentEvent<T>(
  bus: AgentBus,
  topic: string,
  decode: AgentEventDecoder<T>,
  handler: (payload: T, topic: string) => void,
): () => void {
  return bus.on(topic, (payload, currentTopic) => {
    const decoded = decode(payload);
    if (decoded !== null) handler(decoded, currentTopic);
  });
}
