import moment from 'moment';
import type { MomentInput } from 'moment';
import type { FilterEntity } from './filterTypes';
import { parseValue, valueRecord } from './valueBoundary';

export function filterEntity(value: unknown): FilterEntity {
  const record = valueRecord(value);
  const result: FilterEntity = {};
  if (!record) throw new Error('Invalid filter entity');
  for (const key of ['id', 'sid', 'accountId', 'departmentId', 'organizeId'] as const) {
    const id = record[key];
    if (id !== undefined && typeof id !== 'string') throw new Error('Invalid filter entity ID');
    if (typeof id === 'string') result[key] = id;
  }
  const code = record['code'];
  if (code !== undefined && typeof code !== 'string' && typeof code !== 'number')
    throw new Error('Invalid filter area code');
  if (typeof code === 'string' || typeof code === 'number') result.code = code;
  return result;
}
export function parsedEntity(value: unknown): FilterEntity {
  return filterEntity(parseValue(value));
}
export function filterEntities(value: unknown): FilterEntity[] {
  return filterArray(value).map(filterEntity);
}
export function filterText(value: unknown): string {
  return String(value);
}
export function filterNumber(value: unknown): number {
  return parseFloat(String(value));
}
export function filterDate(value: unknown): MomentInput {
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date || moment.isMoment(value))
    return value;
  if (Array.isArray(value) && value.every((part: unknown) => typeof part === 'number')) return value;
  return null;
}
/** Unknown units in Moment comparisons normalize to milliseconds; the historic year-space typo stays unknown. */
export function filterMomentUnit(unit: string | undefined): moment.unitOfTime.StartOf | undefined {
  switch (unit) {
    case undefined:
      return undefined;
    case 'year':
      return 'year';
    case 'quarter':
      return 'quarter';
    case 'month':
      return 'month';
    case 'week':
      return 'week';
    case 'day':
      return 'day';
    case 'hour':
      return 'hour';
    case 'minute':
      return 'minute';
    case 'second':
      return 'second';
    default:
      return 'millisecond';
  }
}
export function filterDurationUnit(unit: string | undefined): moment.unitOfTime.DurationConstructor | undefined {
  switch (unit) {
    case 'year':
      return 'year';
    case 'quarter':
      return 'quarter';
    case 'month':
      return 'month';
    case 'week':
      return 'week';
    case 'day':
      return 'day';
    case 'hour':
      return 'hour';
    case 'minute':
      return 'minute';
    case 'second':
      return 'second';
    default:
      return undefined;
  }
}

/** An invalid collection is an evaluation failure, not a valid empty selection. */
export function filterArray(value: unknown): unknown[] {
  const result: unknown = parseValue(value || '[]', true);
  if (!Array.isArray(result)) throw new Error('Invalid filter selection');
  return result;
}
