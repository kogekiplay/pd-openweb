import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import { parsedArray, valueRecord } from './formUtils/valueBoundary';

/** API template field types are numeric, independent from event string action IDs. */
export interface ApiRequestMapping {
  id?: string | undefined;
  pid?: string | undefined;
  type?: number | undefined;
  defsource?: string | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
}
export interface ApiResponseMapping {
  cid?: string | undefined;
  subid?: string | undefined;
  type?: number | undefined;
}
export type ApiKeywords = string | { url?: string | undefined; fileId?: string | undefined };
export interface ApiUpdateProps {
  advancedSetting?: ControlAdvancedSetting | undefined;
  formData?: FormControl[] | undefined;
  onChange: (value: unknown, controlId?: string, trigger?: boolean) => void;
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function isSetting(value: unknown): value is ControlAdvancedSetting {
  const setting = valueRecord(value);
  return !!setting && Object.values(setting).every(optionalString);
}
function isRequestMapping(value: unknown): value is ApiRequestMapping {
  const item = valueRecord(value);
  return (
    !!item &&
    ['id', 'pid', 'defsource'].every(key => optionalString(item[key])) &&
    (item['type'] === undefined || typeof item['type'] === 'number') &&
    (item['advancedSetting'] === undefined || isSetting(item['advancedSetting']))
  );
}
export function decodeApiRequestMap(value: unknown): ApiRequestMapping[] {
  return parsedArray(value).filter(isRequestMapping);
}
function isResponseMapping(value: unknown): value is ApiResponseMapping {
  const item = valueRecord(value);
  return (
    !!item &&
    ['cid', 'subid'].every(key => optionalString(item[key])) &&
    (item['type'] === undefined || typeof item['type'] === 'number')
  );
}
export function decodeApiResponseMap(value: unknown): ApiResponseMapping[] {
  return parsedArray(value).filter(isResponseMapping);
}
