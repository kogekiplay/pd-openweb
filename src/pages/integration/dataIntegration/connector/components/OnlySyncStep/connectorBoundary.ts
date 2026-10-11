import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import type { MatchedTypes, SyncField, SyncMapping, SyncOption, SyncWorksheetControl } from './connectorTypes';
import type { SourceTableTab } from './connectorTypes';

export function syncRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sourceTab(value: unknown): value is SourceTableTab {
  return syncRecord(value) && ['db', 'table', 'tableName', 'schema'].every(key => optionalString(value[key]));
}
export function syncSourceTab(value: unknown): SourceTableTab {
  if (!sourceTab(value)) throw new TypeError('Invalid connector source table');
  return value;
}
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';
const nullableString = (value: unknown): value is string | null | undefined => value === null || optionalString(value);
const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';
const nullableNumber = (value: unknown): value is number | null | undefined => value === null || optionalNumber(value);
const optionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || typeof value === 'boolean';
function dense(value: unknown): value is unknown[] {
  return Array.isArray(value) && Array.from({ length: value.length }, (_, i) => i in value).every(Boolean);
}
export function syncField(value: unknown): value is SyncField {
  if (
    !syncRecord(value) ||
    typeof value['name'] !== 'string' ||
    !['id', 'oid', 'fid', 'comment'].every(key => nullableString(value[key])) ||
    !['alias', 'status'].every(key => optionalString(value[key])) ||
    !nullableString(value['dataType']) ||
    !['mdType', 'jdbcTypeId', 'precision', 'scale', 'orderNo'].every(key => nullableNumber(value[key])) ||
    !['isPk', 'isCheck', 'isFakePk', 'isUniquePk', 'isNotNull', 'isCanBePk', 'disabled'].every(key =>
      optionalBoolean(value[key]),
    ) ||
    !(value['isTitle'] === null || optionalBoolean(value['isTitle']))
  )
    return false;
  const setting = value['controlSetting'];
  return (
    setting === undefined ||
    setting === null ||
    (syncRecord(setting) &&
      nullableString(setting['remark']) &&
      optionalString(setting['strDefault']) &&
      optionalNumber(setting['sourceControlType']) &&
      optionalNumber(setting['enumDefault']))
  );
}
export function syncFields(value: unknown): SyncField[] {
  if (!dense(value) || !value.every(syncField)) throw new TypeError('Invalid connector fields');
  return value;
}
function mapping(value: unknown): value is SyncMapping {
  return syncRecord(value) && syncField(value['sourceField']) && syncField(value['destField']);
}
export function syncMappings(value: unknown): SyncMapping[] {
  if (!dense(value) || !value.every(mapping)) throw new TypeError('Invalid connector field mapping');
  return value;
}
export function syncStringList(value: unknown): string[] {
  if (!dense(value) || !value.every((item): item is string => typeof item === 'string'))
    throw new TypeError('Invalid connector database/schema names');
  return value;
}
function matchedChoice(value: unknown): value is import('./connectorTypes').MatchedFieldType {
  return (
    syncRecord(value) &&
    typeof value['typeName'] === 'string' &&
    ['mdType', 'dataType', 'maxLength', 'defaultScale'].every(field => nullableNumber(value[field]))
  );
}
function matchedDictionary(value: unknown): value is MatchedTypes {
  return (
    syncRecord(value) &&
    Object.keys(value).every(key => {
      const choices = value[key];
      return choices === undefined || (dense(choices) && choices.every(matchedChoice));
    })
  );
}
export function syncMatchedTypes(value: unknown): MatchedTypes | undefined {
  if (value === undefined) return undefined;
  if (!matchedDictionary(value)) throw new TypeError('Invalid connector matched types');
  return value;
}
export function syncMatchResponse(value: unknown): MatchedTypes {
  if (!syncRecord(value) || !matchedDictionary(value['matchedTypes']))
    throw new TypeError('Invalid connector match response');
  return value['matchedTypes'];
}
function worksheetControl(value: unknown): value is SyncWorksheetControl {
  if (
    !syncRecord(value) ||
    !['controlId', 'controlName', 'alias', 'strDefault'].every(key => optionalString(value[key])) ||
    !['type', 'enumDefault', 'dot', 'sourceControlType'].every(key => optionalNumber(value[key])) ||
    !optionalBoolean(value['required']) ||
    !nullableString(value['remark'])
  )
    return false;
  const setting = value['advancedSetting'];
  return setting === undefined || (syncRecord(setting) && optionalString(setting['usertype']));
}
export function syncWorksheetControls(value: unknown): SyncWorksheetControl[] {
  if (!syncRecord(value) || !syncRecord(value['template'])) throw new TypeError('Invalid connector worksheet template');
  const controls = value['template']['controls'];
  if (!dense(controls) || !controls.every(worksheetControl))
    throw new TypeError('Invalid connector worksheet controls');
  return controls;
}
function label(value: unknown): value is ReactNode {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    isValidElement(value) ||
    (dense(value) && value.every(label))
  );
}
function option(value: unknown): value is SyncOption {
  return (
    syncRecord(value) &&
    typeof value['value'] === 'string' &&
    label(value['label']) &&
    optionalString(value['workSheetName']) &&
    optionalBoolean(value['disabled'])
  );
}
export function syncOptions(value: unknown): SyncOption[] {
  if (!dense(value) || !value.every(option)) throw new TypeError('Invalid connector table options');
  return value;
}
export function syncLabeledValue(value: unknown): string {
  if (!syncRecord(value) || typeof value['value'] !== 'string') throw new TypeError('Invalid connector selection');
  return value['value'];
}
export function syncSelectedTable(value: unknown): { label: string; value: string } | undefined {
  if (!value) return undefined;
  if (!syncRecord(value) || typeof value['value'] !== 'string' || typeof value['label'] !== 'string')
    throw new TypeError('Invalid connector selected table');
  return { label: value['label'], value: value['value'] };
}
export function syncNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid connector string value');
}
export function syncSchedule(value: unknown): Record<string, unknown> {
  if (!syncRecord(value)) throw new TypeError('Invalid connector schedule');
  return value;
}
export function syncIcon(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid connector field icon');
}
