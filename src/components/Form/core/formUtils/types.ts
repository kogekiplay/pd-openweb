import type { FormControl } from 'src/utils/controlTypes';
import type { FormError, RuleFilterItem } from '../types';

/** Form values keep arbitrary row payloads unknown until their particular widget reads them. */
export type FormRuntimeValue = string | number | boolean | null | undefined | unknown[] | Record<string, unknown>;
export interface EmbedData {
  recordId?: string | undefined;
  [key: string]: unknown;
}
export interface DefaultSource {
  cid?: string | undefined;
  rcid?: string | undefined;
  type?: number | undefined;
  staticValue?: string | undefined;
  isAsync?: boolean | undefined;
}
export interface RegexValidation {
  value: string;
  filters?: FormFilterGroup[] | undefined;
  err?: string | undefined;
}
export interface FormRuleAction {
  type?: number | undefined;
  permission?: string[] | undefined;
  message?: string | undefined;
  controls?: Array<{ controlId?: string | undefined }> | undefined;
}
export interface FormConditionRule {
  ruleId?: string | undefined;
  type?: number | undefined;
  disabled?: boolean | undefined;
  filters?: FormFilterGroup[] | undefined;
  ruleItems?: FormRuleAction[] | undefined;
  checkType?: number | undefined;
  appTimeZone?: number | undefined;
}
export interface FormRuleCheckResult {
  isAvailable: boolean;
  filterControlIds: Array<string | undefined>;
  availableControlIds: Array<string | undefined>;
}
export interface FormRuleMessage {
  errorMessage?: string | undefined;
  ignoreErrorMessage: boolean;
}
export interface BackendRuleError {
  rowId?: string | undefined;
  controlId?: string | undefined;
  errorInfo: FormError[];
}
export interface PermissionUpdate {
  attrs?: FormRuleAction[] | undefined;
  it: FormControl;
  item?: FormControl | undefined;
  verifyAllControls?: boolean | undefined;
  checkRuleValidator: (controlId: string | undefined, errorType: string, errorText: string | undefined) => void;
}
export interface FormFilterGroup extends FormComparisonCondition {
  groupFilters?: FormComparisonCondition[] | undefined;
  isGroup?: boolean | undefined;
}
export interface FormComparisonCondition extends RuleFilterItem {
  filterType?: number | undefined;
  /** Legacy form-operator alias used by isRelateMoreList. */
  type?: number | undefined;
  dataType?: number | undefined;
  dateRange?: number | undefined;
  dateRangeType?: number | undefined;
  dataShowType?: string | number | undefined;
  value?: string | number | undefined;
  values?: string[] | undefined;
  minValue?: string | number | undefined;
  maxValue?: string | number | undefined;
}

export interface FormAttachmentData {
  originalFileName?: string | undefined;
  originalFilename?: string | undefined;
  fileID?: string | undefined;
  [key: string]: unknown;
}
