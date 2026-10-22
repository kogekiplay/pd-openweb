/** The independent window only opens user/group sessions with a scalar ID. */
export interface ChatWindowSession {
  id: string;
  type: 1 | 2 | '1' | '2';
}

/** query-string can produce missing keys, null and arrays; check before mounting the socket consumer. */
export function isChatWindowSession(value: unknown): value is ChatWindowSession {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    'type' in value &&
    (value.type === 1 || value.type === 2 || value.type === '1' || value.type === '2')
  );
}
