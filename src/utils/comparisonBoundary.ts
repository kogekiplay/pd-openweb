type Primitive = string | number | bigint | boolean | symbol | null | undefined;
function primitive(value: unknown): value is Primitive {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}
/** Relational operators ask objects for a primitive with the number hint, before comparing strings or numbers. */
function comparisonPrimitive(value: unknown): Primitive {
  if (primitive(value)) return value;
  if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
    throw new TypeError('Invalid comparison operand');
  const exotic: unknown = Reflect.get(value, Symbol.toPrimitive);
  if (exotic !== undefined && exotic !== null) {
    if (typeof exotic !== 'function') throw new TypeError('Invalid comparison primitive method');
    const result: unknown = Reflect.apply(exotic, value, ['number']);
    if (!primitive(result)) throw new TypeError('Comparison primitive method returned an object');
    return result;
  }
  for (const name of ['valueOf', 'toString']) {
    const method: unknown = Reflect.get(value, name);
    if (typeof method !== 'function') continue;
    const result: unknown = Reflect.apply(method, value, []);
    if (primitive(result)) return result;
  }
  throw new TypeError('Cannot convert comparison operand to a primitive');
}
/** Preserve the existing mixed-value less-than operation without exposing an any input. */
export function isLessThan(left: unknown, right: unknown): boolean {
  const a = comparisonPrimitive(left);
  const b = comparisonPrimitive(right);
  if (typeof a === 'string' && typeof b === 'string') return a < b;
  if (typeof a === 'symbol' || typeof b === 'symbol') throw new TypeError('Cannot compare a Symbol');
  // BigInt/string comparisons parse the string as an integer, rather than rounding through Number.
  if (typeof a === 'bigint' && typeof b === 'string') {
    try {
      return a < BigInt(b);
    } catch {
      return false;
    }
  }
  if (typeof a === 'string' && typeof b === 'bigint') {
    try {
      return BigInt(a) < b;
    } catch {
      return false;
    }
  }
  return (typeof a === 'bigint' ? a : Number(a)) < (typeof b === 'bigint' ? b : Number(b));
}
