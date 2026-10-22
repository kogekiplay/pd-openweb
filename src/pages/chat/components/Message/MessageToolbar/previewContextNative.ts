/** Native operations on raw SDK members. No DTO assertion, eager field read or data clone. */
const nativeReflect: {
  get(target: unknown, key: PropertyKey, receiver: unknown): unknown;
  apply(target: unknown, receiver: unknown, args: unknown[]): unknown;
} = Reflect;
const numericHost: { max(value: unknown): number } = Math;
export type ContextField = 'msg' | 'files' | 'id' | 'name' | 'size' | 'url' | 'indexOf';

/** GetV: box primitive targets, retain the original getter receiver, and let nullish targets fail natively. */
export function contextProperty(value: unknown, key: ContextField): unknown {
  return nativeReflect.get(value === null || value === undefined ? value : Object(value), key, value);
}
export function contextQueryIndex(value: unknown): unknown {
  return nativeReflect.apply(contextProperty(value, 'indexOf'), value, ['?']);
}
/** Single-argument max performs native ToNumber, including the original mixed BigInt/number failure. */
export function contextMegabytes(value: unknown): number {
  return numericHost.max(value) / 1024 / 1024;
}
