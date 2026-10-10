import type { ApiFilterItem } from './filterTypes';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';
const scalar = (value: unknown): value is string | number | null | undefined =>
  value === undefined || value === null || typeof value === 'string' || typeof value === 'number';
function item(value: unknown, ancestors: Set<object>): value is ApiFilterItem {
  if (
    !record(value) ||
    ancestors.has(value) ||
    !(value['controlId'] === undefined || typeof value['controlId'] === 'string') ||
    !['dataType', 'filterType', 'spliceType'].every(key => optionalNumber(value[key])) ||
    !['value', 'minValue', 'maxValue'].every(key => scalar(value[key])) ||
    !(value['values'] === undefined || denseArray(value['values'])) ||
    !(value['isGroup'] === undefined || typeof value['isGroup'] === 'boolean')
  )
    return false;
  if (value['isGroup'] !== true) return true;
  ancestors.add(value);
  const children = value['groupFilters'];
  const valid = children === undefined || (denseArray(children) && children.every(child => item(child, ancestors)));
  ancestors.delete(value);
  return valid;
}
function denseArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Array.from({ length: value.length }, (_, index) => index in value).every(Boolean);
}
export function filterItems(value: unknown): ApiFilterItem[] {
  if (!denseArray(value) || !value.every(child => item(child, new Set())))
    throw new TypeError('Invalid worksheet API filter conditions');
  return value;
}
/** Preserve property lookup on parsed objects and boxed primitives, without declaring an entity DTO. */
export function parsedId(value: unknown): unknown {
  if (value === null || value === undefined) throw new TypeError('Invalid parsed filter value');
  const receiver: unknown = Object(value);
  if ((typeof receiver !== 'object' || receiver === null) && typeof receiver !== 'function')
    throw new TypeError('Invalid parsed filter value receiver');
  const id: unknown = Reflect.get(receiver, 'id');
  return id;
}
export function optionalParsedId(value: unknown): unknown {
  return value === null || value === undefined ? undefined : parsedId(value);
}
