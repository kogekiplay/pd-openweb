import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import type { RuleChange, RuleTarget, RuleValidator } from './formUtils/ruleDataTypes';
import type { EmbedData, FormFilterGroup } from './formUtils/types';
import { isRuleGroup, valueRecord } from './formUtils/valueBoundary';
import type { FormQueryConfig } from './queryTypes';
import type { FormError, MasterData } from './types';

/** Stored event/operator IDs are strings, distinct from numeric worksheet rule operators. */
export interface CustomEventAction {
  actionType?: string | undefined;
  actionItems?: RuleTarget[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  message?: string | undefined;
  dataSource?: string | undefined;
  isAll?: boolean | undefined;
}
export interface CustomEventFilter {
  valueType?: string | undefined;
  spliceType?: string | undefined;
  filterItems?: FormFilterGroup[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
}
export interface CustomEventEntry {
  eventType?: string | undefined;
  eventId?: string | undefined;
  eventActions?:
    | Array<{
        filters?: CustomEventFilter[] | undefined;
        actions?: CustomEventAction[] | undefined;
      }>
    | undefined;
}
export interface EventValueContext {
  controlId?: string | undefined;
  formData?: FormControl[] | undefined;
  recordId?: string | undefined;
  from?: number | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  projectId?: string | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  embedData?: EmbedData | undefined;
  masterData?: MasterData | undefined;
  disabled?: boolean | undefined;
  isSetValueFromEvent?: boolean | undefined;
  isSetValueFromRule?: boolean | undefined;
  handleChange: RuleChange;
}
export interface CustomEventProps extends EventValueContext {
  triggerType?: string | undefined;
  renderData?: FormControl[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  isRecordLock?: boolean | undefined;
  checkEventComplete: (loading: Record<string, boolean>) => void;
  checkRuleValidator: RuleValidator;
  handleActiveTab: (id: string) => void;
  setErrorItems: (errors?: FormError[]) => void;
  setRenderData: (data?: FormControl[]) => void;
}
export interface EventRecordRow extends Record<string, unknown> {
  rowid?: string | undefined;
  sid?: string | undefined;
  wsid?: string | undefined;
  sourcevalue?: string | undefined;
}
export interface EventQueryResult {
  count: number;
  result: EventRecordRow[] | false;
}
export interface EventQueryRequest {
  filterControls: unknown[];
  pageIndex: number;
  searchType: number;
  status: number;
  getType: number;
  worksheetId: string;
  pageSize: number;
  id?: string | undefined;
  getAllControls: boolean;
  sortControls?: FormQueryConfig['moreSort'];
  relationWorksheetId?: string | undefined;
}
export interface EventQueryContext extends EventValueContext {
  queryConfig?: FormQueryConfig | undefined;
  control?: FormControl | undefined;
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function optionalStrings(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(item => typeof item === 'string'));
}
function isSetting(value: unknown): value is ControlAdvancedSetting {
  const record = valueRecord(value);
  return !!record && Object.values(record).every(optionalString);
}
function isTarget(value: unknown): value is RuleTarget {
  const target = valueRecord(value);
  return (
    !!target &&
    ['controlId', 'type', 'value'].every(key => optionalString(target[key])) &&
    optionalStrings(target['childControlIds']) &&
    optionalStrings(target['permission']) &&
    (target['isCustom'] === undefined || typeof target['isCustom'] === 'boolean')
  );
}
function isAction(value: unknown): value is CustomEventAction {
  const action = valueRecord(value);
  return (
    !!action &&
    ['actionType', 'message', 'dataSource'].every(key => optionalString(action[key])) &&
    (action['isAll'] === undefined || typeof action['isAll'] === 'boolean') &&
    (action['advancedSetting'] === undefined || isSetting(action['advancedSetting'])) &&
    (action['actionItems'] === undefined ||
      (Array.isArray(action['actionItems']) && action['actionItems'].every(isTarget)))
  );
}
function isFilter(value: unknown): value is CustomEventFilter {
  const filter = valueRecord(value);
  return (
    !!filter &&
    ['valueType', 'spliceType'].every(key => optionalString(filter[key])) &&
    (filter['advancedSetting'] === undefined || isSetting(filter['advancedSetting'])) &&
    (filter['filterItems'] === undefined ||
      (Array.isArray(filter['filterItems']) && filter['filterItems'].every(isRuleGroup)))
  );
}
function isActionGroup(value: unknown): value is NonNullable<CustomEventEntry['eventActions']>[number] {
  const group = valueRecord(value);
  return (
    !!group &&
    (group['filters'] === undefined || (Array.isArray(group['filters']) && group['filters'].every(isFilter))) &&
    (group['actions'] === undefined || (Array.isArray(group['actions']) && group['actions'].every(isAction)))
  );
}
function isEventEntry(value: unknown): value is CustomEventEntry {
  const entry = valueRecord(value);
  return (
    !!entry &&
    optionalString(entry['eventType']) &&
    optionalString(entry['eventId']) &&
    (entry['eventActions'] === undefined ||
      (Array.isArray(entry['eventActions']) && entry['eventActions'].every(isActionGroup)))
  );
}
export function decodeCustomEventEntries(value: unknown): CustomEventEntry[] {
  return Array.isArray(value) ? value.filter(isEventEntry) : [];
}
function isEventRow(value: unknown): value is EventRecordRow {
  const row = valueRecord(value);
  return !!row && ['rowid', 'sid', 'wsid', 'sourcevalue'].every(key => optionalString(row[key]));
}
export function eventRows(value: unknown): EventRecordRow[] {
  return Array.isArray(value) ? value.filter(isEventRow) : [];
}
export function eventQueryResponse(
  value: unknown,
): { resultCode: number; count: number; data: EventRecordRow[] } | undefined {
  const record = valueRecord(value);
  const count = record?.['count'];
  if (record?.['resultCode'] !== 1 || typeof count !== 'number' || !Number.isFinite(count) || count < 0)
    return undefined;
  const data = record['data'];
  // The API data field is optional; total count does not prove a nonempty visible page.
  if (data !== undefined && data !== null && !Array.isArray(data)) return undefined;
  const rows = eventRows(data);
  if (Array.isArray(data) && rows.length !== data.length) return undefined;
  return { resultCode: 1, count, data: rows };
}
