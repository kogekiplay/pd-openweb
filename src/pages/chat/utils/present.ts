/** Only proves non-null presence of an already declared value; it never certifies a DTO shape. */
const nativeProperty: { get(target: unknown, key: PropertyKey, receiver: unknown): unknown } = Reflect;
export function present<T>(value: T | null | undefined, field: 'md' | 'files' | 'key' | 'name' | 'ext' | 'id' | 'con' | 'oldCon' | 'atParam' | 'msg' | 'fromAccount' | 'refer' | 'msgdetail' | 'title' | 'lng' | 'lat' | 'address' | 'statusOptions'): T {
  if (value === null || value === undefined) {
    // Preserve the native property failure rather than fabricate a body or assert it exists.
    throw nativeProperty.get(value, field, value);
  }
  return value;
}
