interface PriceMessage {
  role: string;
  ctime: string | number | undefined;
  metadata: { id: string | undefined; price: number };
}

interface CreditUiMessage {
  id?: string | undefined;
  role?: string | undefined;
  modelMessageId?: string | undefined;
  price?: number | undefined;
}

function lastIndex<T>(messages: readonly T[], predicate: (message: T) => boolean): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const item = messages[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}

export function applyStreamCredit<T extends CreditUiMessage>(messages: T[], messageId: string | undefined, price: number): T[] {
  let index = messageId ? lastIndex(messages, item => item.id === messageId) : -1;
  if (index === -1) index = lastIndex(messages, item => item.role === 'assistant');
  return index === -1 ? messages : messages.map((item, i) => i === index ? { ...item, price } : item);
}

export function applySavedCredit<T extends CreditUiMessage>(messages: T[], saved: unknown): T[] {
  const index = lastIndex(messages, item => item.role === 'assistant');
  const target = messages[index];
  const price = getSavedTurnPrice(saved, target?.modelMessageId);
  if (!price || target?.price === price) return messages;
  return messages.map((item, i) => i === index ? { ...item, price } : item);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function sumPrice(prices: readonly number[]): number {
  return Math.round(prices.reduce((total, price) => total + price, 0) * 1e6) / 1e6;
}

export function getSavedTurnPrice(list: unknown, modelMessageId: unknown): number {
  if (!Array.isArray(list) || typeof modelMessageId !== 'string' || !modelMessageId) return 0;
  const messages: PriceMessage[] = [];
  for (const item of list) {
    if (!object(item)) continue;
    const metadata = object(item['metadata']) ? item['metadata'] : {};
    const price = Number(metadata['price']) || 0;
    messages.push({
      role: typeof item['role'] === 'string' ? item['role'] : '',
      ctime: typeof item['ctime'] === 'string' || typeof item['ctime'] === 'number' ? item['ctime'] : undefined,
      metadata: { id: typeof metadata['id'] === 'string' ? metadata['id'] : undefined, price },
    });
  }
  messages.sort((a, b) => new Date(a.ctime ?? 0).getTime() - new Date(b.ctime ?? 0).getTime());
  const index = messages.findIndex(item => item.metadata.id === modelMessageId);
  if (index === -1) return 0;
  let start = index;
  while (start > 0 && messages[start - 1]?.role !== 'user') start -= 1;
  let end = index + 1;
  while (end < messages.length && messages[end]?.role !== 'user') end += 1;
  return sumPrice(messages.slice(start, end).filter(item => item.role === 'assistant').map(item => item.metadata.price));
}

export function getStreamPrice(previous: number, usage: unknown): number {
  const price = object(usage) ? Number(usage['price']) || 0 : 0;
  return price > 0 ? Math.max(previous, price) : previous;
}
