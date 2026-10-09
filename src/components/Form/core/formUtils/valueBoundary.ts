import moment from 'moment';
import type { MomentInput } from 'moment';
import type {
  DefaultSource,
  FormRuntimeValue,
  RegexValidation,
  FormFilterGroup as RuleFilterGroup,
  FormComparisonCondition as RuleFilterItem,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function valueRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}
export function parseValue(value: unknown, array = false): unknown {
  return safeParse(value, array ? 'array' : undefined);
}
export function parsedRecord(value: unknown): Record<string, unknown> {
  return valueRecord(parseValue(value)) || {};
}
export function parsedArray(value: unknown): unknown[] {
  const parsed = parseValue(value, true);
  return Array.isArray(parsed) ? parsed : [];
}
export function parsedRecords(value: unknown): Record<string, unknown>[] {
  return parsedArray(value).filter((item): item is Record<string, unknown> => !!valueRecord(item));
}
export function parsedStrings(value: unknown): string[] {
  return parsedArray(value).filter((item): item is string => typeof item === 'string');
}
export function runtimeValue(value: unknown): FormRuntimeValue {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value;
  return valueRecord(value);
}
export function dateValue(value: unknown): MomentInput {
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date || moment.isMoment(value))
    return value;
  return null;
}
export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function isSource(value: unknown): value is DefaultSource {
  const record = valueRecord(value);
  return (
    !!record &&
    ['cid', 'rcid'].every(key => optionalString(record[key])) &&
    (optionalString(record['staticValue']) ||
      (typeof record['staticValue'] === 'number' && Number.isFinite(record['staticValue']))) &&
    (record['type'] === undefined || typeof record['type'] === 'number') &&
    (record['isAsync'] === undefined || typeof record['isAsync'] === 'boolean')
  );
}
export function defaultSources(value: unknown): DefaultSource[] {
  return parsedArray(value).filter(isSource);
}
function isRuleItem(value: unknown): value is RuleFilterItem {
  const item = valueRecord(value);
  if (
    !item ||
    !optionalString(item['controlId']) ||
    (item['spliceType'] !== undefined && typeof item['spliceType'] !== 'number')
  )
    return false;
  if (
    !['filterType', 'type', 'dataType', 'dateRange', 'dateRangeType'].every(
      key => item[key] === undefined || typeof item[key] === 'number',
    )
  )
    return false;
  if (
    !['value', 'minValue', 'maxValue', 'dataShowType'].every(
      key => item[key] === undefined || typeof item[key] === 'string' || typeof item[key] === 'number',
    )
  )
    return false;
  const values: unknown = item['values'];
  if (values !== undefined && (!Array.isArray(values) || !values.every(value => typeof value === 'string')))
    return false;
  const source: unknown = item['dynamicSource'];
  return (
    source === undefined ||
    (Array.isArray(source) &&
      source.every((entry: unknown) => {
        const record = valueRecord(entry);
        return !!record && optionalString(record['cid']);
      }))
  );
}
function isRuleGroup(value: unknown): value is RuleFilterGroup {
  const group = valueRecord(value);
  return (
    isRuleItem(value) &&
    !!group &&
    (group['isGroup'] === undefined || typeof group['isGroup'] === 'boolean') &&
    (group['groupFilters'] === undefined ||
      (Array.isArray(group['groupFilters']) && group['groupFilters'].every(isRuleItem)))
  );
}
function isRegexValidation(value: unknown): value is RegexValidation {
  const rule = valueRecord(value);
  return (
    !!rule &&
    typeof rule['value'] === 'string' &&
    optionalString(rule['err']) &&
    (rule['filters'] === undefined || (Array.isArray(rule['filters']) && rule['filters'].every(isRuleGroup)))
  );
}
export function regexValidations(value: unknown): RegexValidation[] {
  return parsedArray(value).filter(isRegexValidation);
}

/** Boundaries configured for date/time widgets only accept the stored string format. */
export function dateBoundaryValue(value: unknown, timeOnly = false): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (timeOnly) {
    return /^\d{2}:\d{2}(?::\d{2})?$/.test(value) && moment(value, ['HH:mm:ss', 'HH:mm'], true).isValid()
      ? value
      : null;
  }
  return moment(
    value,
    ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH', 'YYYY-MM-DD', 'YYYY-MM', 'YYYY'],
    true,
  ).isValid()
    ? value
    : null;
}
/** Custom-event URLs have a scalar source contract; rows and array payloads are not links. */
export function eventLinkValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}
