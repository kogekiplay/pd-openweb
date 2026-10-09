import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import type { RuleChange, RuleValidator } from './formUtils/ruleDataTypes';

export interface CustomEventEntry {
  eventType?: string | undefined;
  eventId?: string | undefined;
  eventActions?: Array<{ filters?: unknown[] | undefined; actions?: unknown[] | undefined }> | undefined;
}
export interface CustomEventProps {
  controlId?: string | undefined;
  triggerType?: string | undefined;
  renderData?: FormControl[] | undefined;
  formData?: FormControl[] | undefined;
  recordId?: string | undefined;
  from?: number | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  projectId?: string | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  isRecordLock?: boolean | undefined;
  checkEventComplete: (loading: Record<string, boolean>) => void;
  checkRuleValidator: RuleValidator;
  handleChange: RuleChange;
  handleActiveTab: (id: string) => void;
  setErrorItems: () => void;
  setRenderData: () => void;
  searchConfig?: Array<Record<string, unknown>> | undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isActionGroup(value: unknown): value is NonNullable<CustomEventEntry['eventActions']>[number] {
  return (
    isRecord(value) &&
    (value['filters'] === undefined || Array.isArray(value['filters'])) &&
    (value['actions'] === undefined || Array.isArray(value['actions']))
  );
}
function isEventEntry(value: unknown): value is CustomEventEntry {
  return (
    isRecord(value) &&
    (value['eventType'] === undefined || typeof value['eventType'] === 'string') &&
    (value['eventId'] === undefined || typeof value['eventId'] === 'string') &&
    (value['eventActions'] === undefined ||
      (Array.isArray(value['eventActions']) && value['eventActions'].every(isActionGroup)))
  );
}
export function decodeCustomEventEntries(value: unknown): CustomEventEntry[] {
  return Array.isArray(value) ? value.filter(isEventEntry) : [];
}
