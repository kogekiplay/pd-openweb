/** Persisted ranges may carry future entries; retain them when editing a known view ID. */
export function viewRangeList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new TypeError('Invalid view range list');
}

export function serializeViewRange(value: unknown): string {
  const encoded: unknown = JSON.stringify(value);
  if (typeof encoded === 'string' && encoded.startsWith('[')) return encoded;
  throw new TypeError('Invalid view range serialization');
}
