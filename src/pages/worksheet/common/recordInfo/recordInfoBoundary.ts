import type { FormConditionRule, FormRuleAction, RuleTarget } from '../../../../components/Form/core/formUtils/types';
import { isRuleGroup, valueRecord } from '../../../../components/Form/core/formUtils/valueBoundary';
import type { RecordDetail } from './crtl';
import type { LoadedRecordInfoData, PortalDiscussionConfig, RecordInfoRow, RecordView } from './recordInfoTypes';

const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown) => value === undefined || typeof value === 'number';
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && Array.from(value).every(item => typeof item === 'string');

function target(value: unknown): value is RuleTarget {
  const item = valueRecord(value);
  return (
    !!item &&
    ['controlId', 'type', 'value'].every(key => optionalString(item[key])) &&
    optionalBoolean(item['isCustom']) &&
    ['childControlIds', 'permission'].every(key => item[key] === undefined || strings(item[key]))
  );
}
function action(value: unknown): value is FormRuleAction {
  const item = valueRecord(value);
  return (
    !!item &&
    optionalNumber(item['type']) &&
    optionalString(item['message']) &&
    (item['permission'] === undefined || strings(item['permission'])) &&
    (item['controls'] === undefined || (Array.isArray(item['controls']) && Array.from(item['controls']).every(target)))
  );
}
function denseCondition(value: unknown): boolean {
  const item = valueRecord(value);
  return (
    !!item &&
    ['values', 'dynamicSource', 'groupFilters'].every(key => {
      const list = item[key];
      return list === undefined || (Array.isArray(list) && Array.from(list).every(entry => entry !== undefined));
    }) &&
    (item['groupFilters'] === undefined ||
      (Array.isArray(item['groupFilters']) && Array.from(item['groupFilters']).every(denseCondition)))
  );
}
function rule(value: unknown): value is FormConditionRule {
  const item = valueRecord(value);
  return (
    !!item &&
    optionalString(item['ruleId']) &&
    optionalBoolean(item['disabled']) &&
    ['type', 'hintType', 'checkType', 'appTimeZone'].every(key => optionalNumber(item[key])) &&
    (item['filters'] === undefined ||
      (Array.isArray(item['filters']) &&
        Array.from(item['filters']).every(entry => isRuleGroup(entry) && denseCondition(entry)))) &&
    (item['ruleItems'] === undefined ||
      (Array.isArray(item['ruleItems']) && Array.from(item['ruleItems']).every(action)))
  );
}
export function recordRules(value: unknown): FormConditionRule[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value) && Array.from(value).every(rule)) return value;
  throw new TypeError('Invalid record rules');
}
function view(value: unknown): value is RecordView {
  const item = valueRecord(value);
  return (
    !!item &&
    optionalNumber(item['viewType']) &&
    (item['childType'] === undefined ||
      typeof item['childType'] === 'string' ||
      typeof item['childType'] === 'number') &&
    (item['controls'] === undefined || strings(item['controls']))
  );
}
/** The controller already produced canonical FormControl[]. This checks the additional display fields, not a raw control DTO. */
export function loadedRecord(raw: RecordDetail): LoadedRecordInfoData {
  const extra = valueRecord(raw);
  if (
    !extra ||
    !Array.isArray(raw.formData) ||
    !['worksheetName', 'entityName'].every(key => optionalString(extra[key])) ||
    (extra['view'] !== undefined && !view(extra['view']))
  )
    throw new TypeError('Invalid record detail');
  return {
    ...raw,
    formData: raw.formData,
    rules: recordRules(raw.rules),
    ...(typeof extra['worksheetName'] === 'string' ? { worksheetName: extra['worksheetName'] } : {}),
    ...(typeof extra['entityName'] === 'string' ? { entityName: extra['entityName'] } : {}),
    ...(view(extra['view']) ? { view: extra['view'] } : {}),
  };
}
export function portalDiscussion(value: unknown): PortalDiscussionConfig {
  // Return the checked source. The existing consumer updates allowExAccountDiscuss in place.
  if (isPortalDiscussion(value)) return value;
  throw new TypeError('Invalid portal discussion configuration');
}
function isPortalDiscussion(value: unknown): value is PortalDiscussionConfig {
  const item = valueRecord(value);
  return (
    !!item &&
    ['allowExAccountDiscuss', 'isEnable', 'approved'].every(key => optionalBoolean(item[key])) &&
    optionalNumber(item['exAccountDiscussEnum'])
  );
}
export function recordRow(value: unknown): RecordInfoRow {
  if (isRecordRow(value)) return value;
  throw new TypeError('Invalid updated record');
}
function isRecordRow(value: unknown): value is RecordInfoRow {
  const item = valueRecord(value);
  return (
    !!item &&
    ['rowid', 'pid', 'childrenids', 'titleValue', 'name', 'groupKey', 'appId', 'viewId', 'worksheetId'].every(key =>
      optionalString(item[key]),
    ) &&
    ['isCopy', 'isLoading', 'sys_lock', 'isviewdata'].every(key => optionalBoolean(item[key])) &&
    optionalNumber(item['controlType']) &&
    (item['updatedControlIds'] === undefined || strings(item['updatedControlIds']))
  );
}
export function recordError(value: unknown): { errorCode?: number; resultCode?: number } {
  const item = valueRecord(value);
  return {
    ...(typeof item?.['errorCode'] === 'number' ? { errorCode: item['errorCode'] } : {}),
    ...(typeof item?.['resultCode'] === 'number' ? { resultCode: item['resultCode'] } : {}),
  };
}
export function badRecordIds(value: unknown): string[] {
  if (strings(value)) return value;
  throw new TypeError('Invalid record validation errors');
}
export function rowEditLock(value: unknown): {
  isopen?: string;
  expiretime?: string;
  countdown?: string;
  expiredaction?: string;
} {
  if (!value) return {};
  const item = valueRecord(value);
  if (!item || !['isopen', 'expiretime', 'countdown', 'expiredaction'].every(key => optionalString(item[key])))
    throw new TypeError('Invalid record edit lock');
  return {
    ...(typeof item['isopen'] === 'string' ? { isopen: item['isopen'] } : {}),
    ...(typeof item['expiretime'] === 'string' ? { expiretime: item['expiretime'] } : {}),
    ...(typeof item['countdown'] === 'string' ? { countdown: item['countdown'] } : {}),
    ...(typeof item['expiredaction'] === 'string' ? { expiredaction: item['expiredaction'] } : {}),
  };
}
export function recordDictionaryOrEmpty(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  return recordDictionary(value);
}
export function recordDictionary(value: unknown): Record<string, unknown> {
  const item = valueRecord(value);
  if (!item) throw new TypeError('Invalid record values');
  return item;
}

export function recordOwner(value: unknown): import('./recordInfoTypes').RecordOwner {
  if (isRecordOwner(value)) return value;
  throw new TypeError('Invalid record owner');
}
function isRecordOwner(value: unknown): value is import('./recordInfoTypes').RecordOwner {
  const item = valueRecord(value);
  return !!item && ['accountId', 'avatar', 'fullname', 'job'].every(key => optionalString(item[key]));
}
export function recordReload(value: unknown): import('./recordInfoTypes').RecordReloadEvent | undefined {
  if (isRecordReload(value)) return value;
  return undefined;
}
function isRecordReload(value: unknown): value is import('./recordInfoTypes').RecordReloadEvent {
  const item = valueRecord(value);
  return (
    !!item &&
    optionalString(item['worksheetId']) &&
    optionalString(item['recordId']) &&
    optionalBoolean(item['closeWhenNotViewData'])
  );
}
