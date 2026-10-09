import type { RuleChange, RuleDataProps, RuleValidator } from 'src/components/Form/core/formUtils/ruleDataTypes';
import type { FormConditionRule } from 'src/components/Form/core/formUtils/types';
import type { FormControl, FormError } from 'src/components/Form/core/types';

export type StoreAction =
  | { type: 'SET_RENDER_DATA'; payload: FormControl[] }
  | { type: 'SET_ERROR_ITEMS' | 'SET_UNIQUE_ERROR_ITEMS'; payload: FormError[] }
  | { type: 'SET_RULES'; payload: FormConditionRule[] | undefined }
  | { type: 'SET_RULES_LOADING' | 'SET_CONFIG_LOCK'; payload: boolean }
  | { type: 'SET_SEARCH_CONFIG'; payload: Array<Record<string, unknown>> | undefined }
  | { type: 'SET_LOADING_ITEMS'; payload: Record<string, boolean> }
  | { type: 'SET_VERIFY_CODE'; payload: string }
  | { type: 'SET_ACTIVE_TAB_CONTROL_ID'; payload: string | undefined }
  | { type: 'SET_EM_SIZE_NUM'; payload: number | string | undefined };
export type StoreDispatch = (action: StoreAction) => unknown;
export interface FormStoreState {
  rules?: FormConditionRule[] | undefined;
  searchConfig?: Array<Record<string, unknown>> | undefined;
  uniqueErrorItems: FormError[];
  errorItems: FormError[];
  renderData: FormControl[];
  loadingItems: Record<string, boolean>;
  activeTabControlId?: string | undefined;
  configLock?: boolean | undefined;
  rulesLoading: boolean;
  verifyCode: string;
  emSizeNum: number | string | undefined;
}
export interface FormDataFormat {
  getDataSource(): FormControl[];
  getUpdateControlIds(): string[];
  getUpdateRuleControlIds(): string[];
  getCurrentRuleControlIds(): string[];
  resetCurrentRuleControlIds(): void;
  getErrorControls(): FormError[];
  updateDataSource(options: {
    controlId?: string | undefined;
    value?: unknown;
    removeUniqueItem?: (id?: string) => void;
    searchByChange?: boolean | undefined;
  }): void;
  setErrorControl(
    controlId?: string,
    errorType?: string,
    errorMessage?: string,
    rule?: FormConditionRule,
    isInit?: boolean,
  ): void;
  callStore(fn: string | { fnName: string; controlId?: string | undefined }, ...args: unknown[]): void;
}
export interface StoreProps {
  rules?: FormConditionRule[] | undefined;
  searchConfig?: Array<Record<string, unknown>> | undefined;
  systemControlData?: FormControl[] | undefined;
  recordId?: string | undefined;
  from?: number | undefined;
  ignoreHideControl?: boolean | undefined;
  verifyAllControls?: boolean | undefined;
  worksheetId?: string | undefined;
  appId?: string | undefined;
  projectId?: string | undefined;
  isRecordLock?: boolean | undefined;
  entityName?: string | undefined;
  onRulesLoad?: ((rules: FormConditionRule[]) => void) | undefined;
  onWidgetChange?: (() => void) | undefined;
  onManualWidgetChange?: (() => void) | undefined;
  handleEventPermission?: (() => void) | undefined;
  tabControlProp?: { handleSectionClick?: ((id: string | undefined) => void) | undefined } | undefined;
  checkCellUnique?: ((id: string | undefined, value: string) => boolean) | undefined;
  onError?: (() => void) | undefined;
  onSave?: (error: boolean | undefined, result: SaveResult) => void;
  [key: string]: unknown;
}
export interface StoreRuleOptions {
  ignoreDialog?: boolean;
  silent?: boolean;
  ignoreAlert?: boolean;
  verifyAllControls?: boolean;
  noTriggerError?: boolean;
  [key: string]: unknown;
}
export type { RuleChange, RuleDataProps, RuleValidator };

export interface SaveResult {
  data: FormControl[];
  updateControlIds: string[];
  isQuickUpdateCheck?: unknown;
  alertLockError: () => void;
  handleRuleError: (badData: string[]) => void;
  handleServiceError: (badData: string[]) => void;
}
export interface StoreOperation {
  props: StoreProps;
  getState: () => FormStoreState;
  dataFormat: FormDataFormat;
  options?: StoreRuleOptions | undefined;
  getSubmitBegin: () => boolean;
  getControlRefs: () => Record<string, { handleExpand?: ((open: boolean) => void) | undefined }>;
  getFormContainer?: (() => HTMLElement | null) | undefined;
  newErrorDialog: (
    errors: Array<{
      controlId?: string | undefined;
      errorMessage?: string | undefined;
      ignoreErrorMessage?: boolean | undefined;
    }>,
    options?: StoreRuleOptions,
  ) => void;
}
export type OnChangeEnhance = (data: FormControl[], ids: string[], change: { controlId?: string | undefined }) => void;

export interface CustomEventParams {
  triggerType?: string | undefined;
  controlId?: string | undefined;
  advancedSetting?: import('src/utils/controlTypes').ControlAdvancedSetting | undefined;
  newItem?: FormControl | undefined;
  [key: string]: unknown;
}
export interface TriggerEventAction {
  params: CustomEventParams;
  props: StoreProps;
  getState: () => FormStoreState;
  dataFormat: FormDataFormat;
  updateRenderData: () => void;
  handleChange: RuleChange;
}
