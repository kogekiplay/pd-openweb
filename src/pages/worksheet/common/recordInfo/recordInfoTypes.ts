import type { ReactElement, ReactNode, RefObject } from 'react';
import type DataFormat from '../../../../components/Form/core/DataFormat';
import type { FormConditionRule } from '../../../../components/Form/core/formUtils/types';
import type { SaveResult, StoreRuleOptions } from '../../../../components/Form/store/types';
import type { SelectedQuickUser } from '../../../../ming-ui/functions/quickSelectUser/types';
import type { FormControl, RecordRow } from '../../../../utils/controlTypes';
import type { ControlAdvancedSetting } from '../../../../utils/controlTypes';
import type { RecordDetail } from './crtl';

export interface RecordView {
  controls?: string[] | undefined;
  viewType?: number | undefined;
  childType?: number | string | undefined;
}
export interface RecordPermit {
  type?: number | undefined;
  state?: boolean | undefined;
  viewIds?: string[] | undefined;
  displayFlowChart?: number | undefined;
}
export interface RecordWorksheetInfo {
  entityName?: string | undefined;
  rules?: FormConditionRule[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  worksheetOperationLogPermission?: unknown;
}
export interface PortalDiscussionConfig {
  allowExAccountDiscuss?: boolean | undefined;
  isEnable?: boolean | undefined;
  approved?: boolean | undefined;
  exAccountDiscussEnum?: number | undefined;
}
export interface RecordInfoProps {
  appId?: string | undefined;
  appSectionId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  recordId?: string | undefined;
  projectId?: string | undefined;
  instanceId?: string | undefined;
  workId?: string | undefined;
  from?: number | undefined;
  width?: number | undefined;
  visible?: boolean | undefined;
  notDialog?: boolean | undefined;
  isCharge?: boolean | undefined;
  allowAdd?: boolean | undefined;
  allowEdit?: boolean | undefined;
  isOpenNewAddedRecord?: boolean | undefined;
  showPrevNext?: boolean | undefined;
  isSubList?: boolean | undefined;
  isRelateRecord?: boolean | undefined;
  isWorksheetQuery?: boolean | undefined;
  isWorksheetRowLand?: boolean | undefined;
  isDraft?: boolean | undefined;
  enablePayment?: boolean | undefined;
  flag?: unknown;
  recordTitle?: string | undefined;
  relationWorksheetId?: string | undefined;
  tableType?: string | undefined;
  hideFormHeader?: boolean | undefined;
  printCharge?: boolean | undefined;
  didMountTimestamp?: number | undefined;
  workflowStatus?: unknown;
  hideRecordInfo?: ((recordId?: string) => void) | undefined;
  updateRows?:
    | ((ids: Array<string | undefined>, value: Record<string, unknown>, changed?: Record<string, unknown>) => void)
    | undefined;
  hideRows?: ((ids: Array<string | undefined>) => void) | undefined;
  updateSuccess?:
    ((recordIds: string[], changedValues: Record<string, unknown>, record: RecordRow) => void) | undefined;
  updateWorksheetControls?: ((controls: FormControl[]) => void) | undefined;
  currentIndex?: number | undefined;
  currentSheetRows?: RecordRow[] | undefined;
  controls?: FormControl[] | undefined;
  rules?: FormConditionRule[] | undefined;
  view?: RecordView | undefined;
  sheetSwitchPermit?: RecordPermit[] | undefined;
  worksheetInfo?: RecordWorksheetInfo | undefined;
  workflow?: ReactElement<{ controls?: FormControl[] | undefined; hideStep?: boolean | undefined }> | null | undefined;
  renderHeader?: (() => ReactNode) | undefined;
  renderAbnormal?: ((value: unknown) => ReactNode) | undefined;
  hideEditingBar?: boolean | undefined;
  handleSwitchRecord?: ((row: RecordRow) => void) | undefined;
  customBtnTriggerCb?: ((...args: unknown[]) => unknown) | undefined;
  updateDraftList?: ((recordId: string | undefined, row?: RecordRow) => void) | undefined;
  addNewRecord?: ((row: RecordRow, view: RecordView) => void) | undefined;
  onDeleteSuccess?: (() => void) | undefined;
  deleteRows?:
    | ((worksheetId: string | undefined, rows: Array<{ rowid: string | undefined; allowDelete: boolean }>) => void)
    | undefined;
  widgetStyle?: ControlAdvancedSetting | undefined;
  setModalRightComp?: ((node: ReactNode) => void) | false | undefined;
  onError?: ((error: unknown) => void) | undefined;
  disableOpenRecordFromRelateRecord?: boolean | undefined;
  loadRowsWhenChildTableStoreCreated?: boolean | undefined;
  allowEmptySubmit?: boolean | undefined;
  handleAddSheetRow?: ((row: RecordRow, afterRowId: string | undefined) => void) | undefined;
}
export interface RecordInfoData extends Omit<RecordDetail, 'rules' | 'ownerAccount'> {
  rules?: FormConditionRule[] | undefined;
  ownerAccount?: RecordOwner | undefined;
  worksheetName?: string | undefined;
  entityName?: string | undefined;
  view?: RecordView | undefined;
  allowAdd?: boolean | undefined;
  isWorksheetQuery?: boolean | undefined;
}
export interface RecordInfoState {
  loading: boolean;
  submitLoading: boolean;
  isSettingTempData: boolean;
  sideWidth: number;
  formSectionWidth: number;
  recordinfo: RecordInfoData;
  tempFormData: FormControl[];
  updateControlIds: string[];
  sheetSwitchPermit: RecordPermit[] | undefined;
  appId: string | undefined;
  worksheetId: string | undefined;
  viewId: string | undefined;
  recordId: string | undefined;
  abnormal: boolean;
  sideVisible: boolean;
  currentIndex: number;
  allowExAccountDiscuss: boolean | undefined;
  exAccountDiscussEnum: number | undefined;
  approved: boolean | undefined;
  forceShowFullValue: boolean | null;
  widgetStyle: ControlAdvancedSetting | undefined;
  relateRecordData: Record<string, FormControl>;
  restoreVisible: boolean | Date;
  payConfig: unknown;
  failure?: unknown;
  discussCount: number | undefined;
  editLockedUser: unknown;
  isRecordLock: boolean | undefined;
  iseditting?: boolean | undefined;
  formFlag?: string | undefined;
  hideRight?: boolean | undefined;
  refreshBtnNeedLoading?: boolean | undefined;
  dragMaskVisible?: boolean | undefined;
  dragLeft?: number | undefined;
  showCloseDialog?: boolean | undefined;
  showError?: boolean | undefined;
  formDidMountFlag?: string | undefined;
}
export interface RecordFormHandle {
  submitFormData(options?: StoreRuleOptions): void;
  uniqueErrorUpdate(ids: string[]): void;
  updateRenderData(options?: { noRule?: boolean | undefined }): void;
  dataFormat: DataFormat | null;
}
export type RecordFormRef = RefObject<RecordFormHandle | null>;
export type RecordSaveResult = SaveResult;

export interface LoadedRecordInfoData extends RecordInfoData {
  formData: FormControl[];
}
export interface RecordRefreshOptions {
  closeWhenNotViewData?: boolean | undefined;
  doNotResetPageIndex?: boolean | undefined;
  reloadDiscuss?: boolean | undefined;
  noLoading?: boolean | undefined;
}
export type RecordRefreshCallback = (options?: RecordRefreshOptions) => unknown;
export interface LoadRecordInfoOptions {
  recordId?: string | undefined;
  props?: RecordInfoProps | undefined;
  needReLoadSheetSwitch?: boolean | undefined;
  closeWhenNotViewData?: boolean | undefined;
  needUpdateControlIds?: string[] | undefined;
  isRefresh?: boolean | undefined;
  cb?: (() => void) | undefined;
}
export interface RecordReloadEvent {
  worksheetId?: string | undefined;
  recordId?: string | undefined;
  closeWhenNotViewData?: boolean | undefined;
}
/** Dynamic control cells stay unknown until a caller uses their own protocol. */
export interface RecordCellRegistration {
  item: FormControl;
  cell: unknown;
}
export interface RecordInfoRow {
  rowid?: string | undefined;
  pid?: string | undefined;
  childrenids?: string | undefined;
  titleValue?: string | undefined;
  name?: string | undefined;
  isCopy?: boolean | undefined;
  updatedControlIds?: string[] | undefined;
  groupKey?: string | undefined;
  isLoading?: boolean | undefined;
  controlType?: number | undefined;
  appId?: string | undefined;
  viewId?: string | undefined;
  worksheetId?: string | undefined;
  sys_lock?: boolean | undefined;
  isviewdata?: boolean | undefined;
  [controlId: string]: unknown;
}
export type RecordOwner = Partial<SelectedQuickUser>;
