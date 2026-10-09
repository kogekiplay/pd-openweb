import type { FormControl } from 'src/utils/controlTypes';

export interface FreeFieldRelationParams {
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  keyWords?: string | undefined;
  [metadata: string]: unknown;
}
export interface FreeFieldTitleRecord {
  rowid?: string | undefined;
  pid?: string | undefined;
  childrenids?: string | undefined;
  titleValue?: string | undefined;
  name?: string | undefined;
  isCopy?: boolean | undefined;
  updatedControlIds?: string[] | undefined;
  groupKey?: string | undefined;
  isLoading?: boolean | undefined;
  controlType?: number | undefined;
  [field: string]: unknown;
}
export type FreeFieldControlHeight = string | number | null | undefined;
export interface FreeFieldWidgetParams {
  currentControlId?: string | undefined;
  value?: unknown;
  env?: unknown;
  recordId?: string | undefined;
  worksheetId?: string | undefined;
  appId?: string | undefined;
  formData?: FormControl[] | undefined;
  onChange?: ((...values: unknown[]) => void) | undefined;
  refreshRecord?: ((params: unknown) => unknown | Promise<unknown>) | undefined;
  setControlHeight?: ((height: FreeFieldControlHeight) => unknown) | undefined;
}
function isBridgeRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function bridgeRecord(value: unknown): Record<string, unknown> | undefined {
  return isBridgeRecord(value) ? value : undefined;
}
export function relationParams(value: unknown): FreeFieldRelationParams {
  if (value === undefined) return {};
  const params = bridgeRecord(value);
  if (!params) throw new TypeError('Invalid relation query parameters');
  for (const key of ['pageIndex', 'pageSize']) {
    const number = params[key];
    if (number !== undefined && (typeof number !== 'number' || !Number.isFinite(number)))
      throw new TypeError('Invalid relation pagination');
  }
  if (params['keyWords'] !== undefined && typeof params['keyWords'] !== 'string')
    throw new TypeError('Invalid relation search text');
  return {
    ...params,
    ...(typeof params['pageIndex'] === 'number' ? { pageIndex: params['pageIndex'] } : {}),
    ...(typeof params['pageSize'] === 'number' ? { pageSize: params['pageSize'] } : {}),
    ...(typeof params['keyWords'] === 'string' ? { keyWords: params['keyWords'] } : {}),
  };
}
function isTitleRecord(value: unknown): value is FreeFieldTitleRecord {
  const record = bridgeRecord(value);
  if (!record) return false;
  for (const key of ['rowid', 'pid', 'childrenids', 'titleValue', 'name', 'groupKey'])
    if (record[key] !== undefined && typeof record[key] !== 'string') return false;
  for (const key of ['isCopy', 'isLoading'])
    if (record[key] !== undefined && typeof record[key] !== 'boolean') return false;
  if (
    record['controlType'] !== undefined &&
    (typeof record['controlType'] !== 'number' || !Number.isFinite(record['controlType']))
  )
    return false;
  const updated = record['updatedControlIds'];
  return updated === undefined || (Array.isArray(updated) && updated.every(id => typeof id === 'string'));
}
export function titleRecord(value: unknown): FreeFieldTitleRecord | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isTitleRecord(value)) throw new TypeError('Invalid title record');
  return value;
}
export function controlHeight(value: unknown): FreeFieldControlHeight {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return value;
  throw new TypeError('Invalid control height');
}
