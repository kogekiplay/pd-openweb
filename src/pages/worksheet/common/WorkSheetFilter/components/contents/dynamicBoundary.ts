import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import type { EditingFilter } from '../../filterModelTypes';
import type { PrimitiveValue } from '../../primitiveTypes';
import type { DynamicWidgetContext, RelatedFilterRecord, SelectedFilterRow } from './dynamicTypes';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function dynamicWidgetContext(value: unknown): DynamicWidgetContext {
  if (value === undefined) return {};
  if (!record(value)) throw new TypeError('Invalid dynamic worksheet context');
  const globalSheetIdValue = value['globalSheetId'],
    dataSourceValue = value['dataSource'],
    controlIdValue = value['controlId'],
    isSubListValue = value['isSubList'];
  if (
    (globalSheetIdValue !== undefined && typeof globalSheetIdValue !== 'string') ||
    (dataSourceValue !== undefined && typeof dataSourceValue !== 'string') ||
    (controlIdValue !== undefined && typeof controlIdValue !== 'string') ||
    (isSubListValue !== undefined && typeof isSubListValue !== 'boolean')
  )
    throw new TypeError('Invalid dynamic worksheet context fields');
  return {
    globalSheetId: typeof globalSheetIdValue === 'string' ? globalSheetIdValue : undefined,
    dataSource: typeof dataSourceValue === 'string' ? dataSourceValue : undefined,
    controlId: typeof controlIdValue === 'string' ? controlIdValue : undefined,
    isSubList: typeof isSubListValue === 'boolean' ? isSubListValue : undefined,
  };
}
function node(value: unknown, ancestors: Set<object>): value is ReactNode {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return true;
  if (isValidElement(value)) return true;
  if (!Array.isArray(value) || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.from(value).every(item => node(item, ancestors));
  ancestors.delete(value);
  return valid;
}
export function relatedName(value: unknown): ReactNode {
  if (!node(value, new Set())) throw new TypeError('Invalid related filter title');
  return value as ReactNode;
}
function isRelatedRecord(value: unknown): value is RelatedFilterRecord {
  return (
    record(value) &&
    (value['id'] === undefined || typeof value['id'] === 'string' || typeof value['id'] === 'number') &&
    node(value['name'], new Set())
  );
}
export function relatedRecord(value: unknown): RelatedFilterRecord {
  if (!isRelatedRecord(value)) throw new TypeError('Invalid related filter record');
  return value;
}
function isSelectedRow(value: unknown): value is SelectedFilterRow {
  return record(value) && (value['rowid'] === undefined || typeof value['rowid'] === 'string');
}
export function selectedRows(value: unknown): SelectedFilterRow[] {
  if (!Array.isArray(value) || !Array.from(value).every(isSelectedRow))
    throw new TypeError('Invalid selected filter rows');
  return value;
}
export function primitiveValue(value: unknown): PrimitiveValue {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  throw new TypeError('Invalid primitive filter value');
}
export function stringValues(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !Array.from(value).every((item): item is string => typeof item === 'string'))
    throw new TypeError('Invalid filter string values');
  return value;
}
export function selectionValues(value: unknown): Array<string | number | undefined> | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      (item): item is string | number | undefined =>
        item === undefined || typeof item === 'string' || typeof item === 'number',
    )
  )
    throw new TypeError('Invalid filter selection values');
  return value;
}
export function filterId(filter: EditingFilter): string {
  if (filter.id === undefined) throw new TypeError('Missing saved filter ID');
  return filter.id;
}
export function controlCoverId(control: object): string | undefined {
  const value: unknown = Reflect.get(control, 'coverCid');
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid related filter cover control ID');
}
