import type { FormattedFunctionValue, FunctionRow, FunctionValueObject } from './functionLibraryTypes';

export function functionObject(value: unknown): value is FunctionValueObject {
  return value !== null && (typeof value === 'function' || (typeof value === 'object' && !Array.isArray(value)));
}
/** Preserve raw object/callable identity without claiming a callable or SDK ABI. */
export function isFormattedFunctionValue(
  value: unknown,
  seen = new WeakSet<object>(),
): value is FormattedFunctionValue {
  if (Array.isArray(value)) {
    if (seen.has(value)) return true;
    seen.add(value);
    return value.every((item: unknown) => isFormattedFunctionValue(item, seen));
  }
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    functionObject(value)
  );
}
export function functionValue(value: unknown): FormattedFunctionValue {
  if (!isFormattedFunctionValue(value)) throw new TypeError('Unsupported function field value');
  return value;
}
export function parseFunctionValue(value: unknown): FormattedFunctionValue {
  // JSON.parse applies ToString even to legacy non-string payloads. String() has
  // that same behavior except Symbols, which JSON.parse originally rejected.
  if (typeof value === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  const parsed: unknown = JSON.parse(typeof value === 'string' ? value : String(value));
  return functionValue(parsed);
}
export function functionString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError('Function display name must be a string');
  return value;
}
type NumericPrimitive = string | number | boolean | bigint | symbol | null | undefined;
function numericPrimitive(value: unknown): value is NumericPrimitive {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}
/** Preserve unary-plus ToPrimitive(number), including custom receiver methods and BigInt failure. */
export function functionNumeric(value: unknown): number {
  let primitive: unknown = value;
  if (functionObject(value) || Array.isArray(value)) {
    const toPrimitive: unknown = Reflect.get(value, Symbol.toPrimitive);
    if (toPrimitive !== undefined && toPrimitive !== null) {
      if (typeof toPrimitive !== 'function') throw new TypeError('Invalid numeric primitive method');
      primitive = Reflect.apply(toPrimitive, value, ['number']);
      if (!numericPrimitive(primitive)) throw new TypeError('Numeric primitive method returned an object');
    } else {
      let converted = false;
      for (const key of ['valueOf', 'toString']) {
        const method: unknown = Reflect.get(value, key);
        if (typeof method !== 'function') continue;
        const result: unknown = Reflect.apply(method, value, []);
        if (!numericPrimitive(result)) continue;
        primitive = result;
        converted = true;
        break;
      }
      if (!converted) throw new TypeError('Cannot convert function field to a numeric primitive');
    }
  }
  if (typeof primitive === 'bigint') throw new TypeError('Cannot convert a BigInt value to a number');
  return Number(primitive);
}
export function functionRows(value: unknown): FunctionRow[] {
  if (!Array.isArray(value) || !value.every(isFunctionRow))
    throw new TypeError('Function subtable rows must be records');
  return value;
}
function isFunctionRow(value: unknown): value is FunctionRow {
  return functionObject(value) && (value['rowid'] === undefined || typeof value['rowid'] === 'string');
}
