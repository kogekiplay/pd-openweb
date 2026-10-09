export type RuntimeRecordValue = string | number | boolean | null | undefined | RuntimeRecordValue[] | RuntimeRecord;
export interface RuntimeRecord {
  rowid?: string | undefined;
  [controlId: string]: RuntimeRecordValue;
}
export interface RuntimeRelatedRecord {
  type?: number | undefined;
  sid?: string | undefined;
  name?: RuntimeRecordValue;
  row?: RuntimeRecord | undefined;
  sourcevalue?: string | undefined;
  [metadata: string]: RuntimeRecordValue;
}
export function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function recordValue(value: unknown): RuntimeRecordValue {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(recordValue);
  const object = objectValue(value);
  if (!object) return undefined;
  const result: RuntimeRecord = {};
  Object.keys(object).forEach(key => {
    result[key] = recordValue(object[key]);
  });
  return result;
}
export function recordObject(value: unknown): RuntimeRecord | undefined {
  const object = objectValue(value);
  if (!object) return undefined;
  const rowId = object['rowid'];
  const normalized = recordValue(object);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return undefined;
  if (rowId !== undefined && typeof rowId !== 'string') return undefined;
  return normalized;
}
export function recordArray(value: unknown): RuntimeRecord[] {
  return Array.isArray(value) ? value.map(recordObject).filter((row): row is RuntimeRecord => row !== undefined) : [];
}
export function parseRecordArray(value: unknown): RuntimeRecord[] {
  return recordArray(safeParse(value, 'array'));
}
export function relatedArray(value: unknown): RuntimeRelatedRecord[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new TypeError('Relation values must be an array');
  return parsed.map(item => {
    const object = objectValue(item);
    if (!object) throw new TypeError('Relation value must be an object');
    const related = recordObject(object);
    if (!related) throw new TypeError('Invalid relation record');
    for (const key of ['sid', 'sourcevalue', 'name']) {
      if (object[key] !== undefined && typeof object[key] !== 'string')
        throw new TypeError('Invalid relation identifier');
    }
    if (object['row'] !== undefined && !recordObject(object['row'])) throw new TypeError('Invalid related row');
    if (object['type'] !== undefined && typeof object['type'] !== 'number')
      throw new TypeError('Invalid relation type');
    return {
      ...related,
      sid: typeof object['sid'] === 'string' ? object['sid'] : undefined,
      sourcevalue: typeof object['sourcevalue'] === 'string' ? object['sourcevalue'] : undefined,
      type: typeof object['type'] === 'number' ? object['type'] : undefined,
    };
  });
}
