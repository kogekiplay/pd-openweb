import type { ChatMessage } from './types';

export function getSessionMessageGroups(messages: ChatMessage[]): string[][] {
  const groups: string[][] = [];
  for (const message of messages) {
    if (message.role === 'user' || !groups.length) groups.push([]);
    if (message.messageId) groups[groups.length - 1]?.push(message.messageId);
  }
  return groups.filter(ids => ids.length > 0);
}
export function alignSessionMessageIds(messages: ChatMessage[], history: ChatMessage[]): ChatMessage[] {
  const used = new Set(messages.flatMap(message => (message.messageId ? [message.messageId] : [])));
  const next = [...messages];
  for (let i = next.length - 1, j = history.length - 1; i >= 0 && j >= 0; i--, j--) {
    const current = next[i],
      source = history[j];
    if (!current || !source || current.role !== source.role) break;
    if (!current.messageId && source.messageId && !used.has(source.messageId)) {
      next[i] = { ...current, messageId: source.messageId };
      used.add(source.messageId);
    }
  }
  return next;
}

/** Feedback accepts only a backend trace from history/stream or the real billing trace, never a message identifier. */
export function getFeedbackTraceId(message: ChatMessage): string {
  return message.traceId?.trim() || message.creditsTraceId?.trim() || '';
}
