/** Header entries are opaque: old extension values must survive editing and serialization. */
export function visibleHeaderList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new TypeError('Invalid public form visible header list');
}

export function serializeVisibleHeaders(value: unknown): string {
  const encoded: unknown = JSON.stringify(value);
  // Keep native stringify/getter/toJSON evaluation; reject a root converted to a non-list.
  if (typeof encoded === 'string' && encoded.startsWith('[')) return encoded;
  throw new TypeError('Invalid public form visible header serialization');
}
