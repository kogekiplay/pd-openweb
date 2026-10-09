import type DataFormat from '../core/DataFormat';
import type { FormControl } from '../core/types';
import type { FormStoreState, StoreAction, StoreProps, StoreRuleOptions } from './types';

export interface EntranceProps extends StoreProps {
  data?: FormControl[] | undefined;
  disabled?: boolean | undefined;
  disabledTabs?: boolean | undefined;
  disabledChildTableCheck?: boolean | undefined;
  flag?: unknown;
  initSource?: boolean | undefined;
  disableRules?: boolean | undefined;
  isCreate?: boolean | undefined;
  isCharge?: boolean | undefined;
  isRecordLock?: boolean | undefined;
  isWorksheetQuery?: boolean | undefined;
  ignoreLock?: boolean | undefined;
  recordCreateTime?: string | undefined;
  masterRecordRowId?: string | undefined;
  loadRowsWhenChildTableStoreCreated?: boolean | undefined;
  controlProps?: Partial<FormControl> | undefined;
  onChange?: ((data: FormControl[], ids: string[], change: unknown) => void) | undefined;
  onFormDataReady?: ((dataFormat: DataFormat) => void) | undefined;
  continueSubmit?: ((options: StoreRuleOptions) => void) | undefined;
  mobileApprovalRecordInfo?: { instanceId?: string | undefined; workId?: string | undefined } | undefined;
  smsVerificationFiled?: string | undefined;
  smsVerification?: boolean | undefined;
}
export interface EntranceRef {
  submitFormData: (options?: StoreRuleOptions) => void;
  dataFormat: DataFormat | null;
  state: FormStoreState;
  [key: string]: unknown;
}
export interface EntranceContextValue {
  state: FormStoreState;
  dispatch: (action: StoreAction) => void;
}
