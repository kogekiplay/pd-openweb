import type { ReactNode } from 'react';
import type { ControlAdvancedSetting } from 'src/utils/controlTypes';

/** Only the fields consumed by this print page and its cell-title formatter. */
export interface PrintOption {
  key: string;
  value?: string | undefined;
  isDeleted?: boolean | undefined;
  [metadata: string]: unknown;
}
export interface PrintControl {
  controlId?: string | undefined;
  controlName?: string | undefined;
  type?: number | undefined;
  value?: unknown;
  dataSource?: string | number | undefined;
  sourceControlId?: string | undefined;
  sourceTitleControlId?: string | undefined;
  sourceControlType?: number | undefined;
  sourceControl?: PrintControl | undefined;
  relationControls?: PrintControl[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  options?: PrintOption[] | undefined;
  showControls?: string[] | undefined;
  unit?: string | undefined;
  formId?: string | undefined;
  innerRow?: number | undefined;
  row?: number | undefined;
  col?: number | undefined;
  attribute?: number | undefined;
  dot?: number | undefined;
  enumDefault?: number | undefined;
  enumDefault2?: number | undefined;
  printDetailType?: number | undefined;
  printHide?: boolean | undefined;
  isRelateMultipleSheet?: boolean | undefined;
  needEvaluate?: boolean | undefined;
  showMaskValue?: boolean | undefined;
  [metadata: string]: unknown;
}
/** Dynamic control ids are keys; raw cells do not assert a complete record DTO. */
export interface PrintRow {
  [controlId: string]: unknown;
}
export interface PrintProps {
  match: { params: { typeId: string; printType: string } };
  reqId?: string | undefined;
}
export interface PrintAttachment {
  originalFilename: string;
  ext?: string | undefined;
  previewUrl?: string | undefined;
  [metadata: string]: unknown;
}
export interface PrintTaskItem {
  key: string;
  name: string;
  show: boolean;
  independent: boolean;
  value: unknown;
}
export interface SubTaskItem {
  name?: string | undefined;
  status?: unknown;
  [metadata: string]: unknown;
}
export interface ChecklistItem {
  checkListName?: string | undefined;
  checkListData: SubTaskItem[];
  [metadata: string]: unknown;
}
export interface PrintTaskData {
  controls: PrintControl[];
  member: unknown[];
  tag: unknown[];
  taskName?: unknown;
  folder?: unknown;
  desc?: unknown;
  startTime?: unknown;
  deadline?: unknown;
  actualStartTime?: unknown;
  completedTime?: unknown;
  [metadata: string]: unknown;
}
export interface PrintWorkLog {
  action: number;
  [metadata: string]: unknown;
}
export interface PrintWorkItem {
  countersignType?: number | undefined;
  workItems: PrintWorkItem[];
  workItemLogList: PrintWorkLog[];
  workType?: number | undefined;
}
export interface PrintWorks {
  taskList?: PrintWorkItem[] | undefined;
  manageList?: PrintWorkItem[] | undefined;
}
export interface PrintFormDetail {
  formId: string;
  tempControls: PrintControl[];
  controls: PrintControl[][];
}
export interface PrintRequestInfo {
  title?: string | undefined;
  reqTitle?: string | undefined;
  reqNo?: string | undefined;
  controls?: PrintControl[] | undefined;
  formControls?: PrintFormDetail[] | undefined;
}
export interface PrintRowInfo {
  controls?: PrintControl[] | undefined;
  shortUrl?: string | undefined;
}
export interface PrintRelateRecord {
  template: { controls: PrintControl[] };
  data: PrintRow[];
}
export interface PrintWorksheetRow {
  receiveControls: PrintControl[];
  shortUrl?: string | undefined;
  titleName?: string | undefined;
  ownerAccount?: unknown;
  updateTime?: string | undefined;
  [metadata: string]: unknown;
}
export interface PrintWorkflowItem {
  show: boolean;
  flowNode: { id: string; name?: string | undefined };
  [metadata: string]: unknown;
}
export interface PrintState {
  reqId: string;
  type: string;
  processOption: string | string[];
  configOptions: { showWorkflowQrCode?: boolean | undefined };
  formDetail: Record<string, unknown>;
  workList: PrintWorkItem[];
  controls: Record<string, PrintControl[]>;
  signatureControls: PrintControl[];
  formControls: PrintFormDetail[];
  logo?: string | undefined;
  detailsType: number;
  showPrintDialog: boolean;
  controlOption: string[] | 'all';
  reqInfo: PrintRequestInfo;
  reqWorks: PrintWorks;
  printCheckAll: boolean;
  fontSize: number;
  appId?: string | undefined;
  viewId?: string | undefined;
  worksheetId?: string | undefined;
  projectId?: string | undefined;
  workSheetGetType: string | number;
  sheetInfo: { name?: string | undefined; ownerAccount?: unknown; updateTime?: string | undefined };
  rowInfo: PrintRowInfo;
  task: PrintTaskItem[];
  workflow: PrintWorkflowItem[];
  printTitle?: ReactNode;
  relateRecords: Record<string, PrintRelateRecord>;
  taskList?: PrintWorkItem[] | undefined;
  manageList?: PrintWorkItem[] | undefined;
  printWorkList?: PrintWorkItem[] | undefined;
  temControl?: unknown;
  loadingError?: string | undefined;
  relationErrors: Record<string, string>;
}
