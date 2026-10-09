import type { TempRecordMap } from './record';
import type { RuntimeRecordValue } from './recordValueBoundary';

export interface KVOptions {
  expireTime?: string | undefined;
}
/** The transport supplies abort; response payloads of writes/clear remain deliberately unknown. */
export interface KVRequest extends Promise<unknown> {
  abort(): void;
}
export interface TempRecordSnapshot {
  create_at?: string | number | undefined;
  value: TempRecordMap;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function recordValue(value: unknown): value is RuntimeRecordValue {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(recordValue);
  // Cache fields are generic JSON, not worksheet rows. The producer validates actual
  // subtable rows through recordArray, and nested field payloads keep their own keys.
  return object(value) && Object.values(value).every(recordValue);
}
function recordMap(value: unknown): value is TempRecordMap {
  return object(value) && Object.values(value).every(recordValue);
}
/** WebCache/Get returns a cache DTO whose data is the previously stored serialized string. */
export function decodeKVValue(reply: unknown): string {
  if (!reply) return '';
  if (!object(reply)) throw new TypeError('Invalid remote cache response');
  const data = reply['data'];
  if (!data) return '';
  if (typeof data !== 'string') throw new TypeError('Remote record cache must contain serialized text');
  return data;
}
export function decodeTempRecordIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((id: unknown) => typeof id === 'string'))
    throw new TypeError('Invalid temporary record index');
  return value;
}
/** Current writers store a timestamp/value envelope; old new-record caches stored the field map directly. */
export function decodeTempRecordSnapshot(serialized: string): TempRecordSnapshot | undefined {
  const parsed: unknown = JSON.parse(serialized);
  if (!object(parsed)) throw new TypeError('Temporary record cache must be an object');
  if (Object.keys(parsed).length === 0) return undefined;
  const timestamp = parsed['create_at'];
  if (
    timestamp !== undefined &&
    ((typeof timestamp !== 'number' && typeof timestamp !== 'string') ||
      !Number.isFinite(new Date(timestamp).getTime()))
  ) {
    throw new TypeError('Invalid temporary record timestamp');
  }
  const value = Object.prototype.hasOwnProperty.call(parsed, 'value') ? parsed['value'] : parsed;
  if (!recordMap(value)) throw new TypeError('Invalid temporary record fields');
  return { create_at: typeof timestamp === 'number' || typeof timestamp === 'string' ? timestamp : undefined, value };
}
