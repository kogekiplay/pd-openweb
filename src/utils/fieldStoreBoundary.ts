import type { FieldStoreRecord } from './subListStoreTypes';

function isStoreObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function storeObject(value: unknown): Record<string, unknown> | undefined {
  return isStoreObject(value) ? value : undefined;
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}
function isRow(value: unknown): value is FieldStoreRecord {
  const row = storeObject(value);
  if (!row) return false;
  for (const key of ['rowid', 'pid', 'childrenids', 'titleValue', 'name']) if (!optionalString(row[key])) return false;
  for (const key of [
    'empty',
    'isCopy',
    'allowedit',
    'allowdelete',
    'isNew',
    'isAddByTree',
    'initRowIsCreate',
    'needShowLoading',
  ])
    if (!optionalBoolean(row[key])) return false;
  const addTime = row['addTime'];
  if (
    addTime !== undefined &&
    typeof addTime !== 'string' &&
    !(typeof addTime === 'number' && Number.isFinite(addTime))
  )
    return false;
  const ids = row['updatedControlIds'];
  return ids === undefined || (Array.isArray(ids) && ids.every(id => typeof id === 'string'));
}
export function storeRows(value: unknown): FieldStoreRecord[] {
  if (!Array.isArray(value) || !value.every(isRow)) throw new TypeError('Invalid field store rows');
  return value;
}

export function storeFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const detail = storeObject(error);
  return typeof detail?.['errorMessage'] === 'string' && detail['errorMessage'] ? detail['errorMessage'] : fallback;
}
