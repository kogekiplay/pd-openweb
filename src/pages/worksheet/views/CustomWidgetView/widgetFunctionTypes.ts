export interface WidgetUser {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
}
export interface WidgetDepartment {
  departmentId?: string | undefined;
  departmentName?: string | undefined;
}
export interface WidgetOrgRole {
  organizeId?: string | undefined;
  organizeName?: string | undefined;
}
/** Plugin options pass through to the native selector or the corresponding web selector. */
export interface WidgetSelectorOptions {
  projectId?: string | undefined;
  unique?: boolean | undefined;
  isIncludeRoot?: boolean | undefined;
  showCreateBtn?: boolean | undefined;
  allPath?: boolean | undefined;
  [option: string]: unknown;
}
export interface WidgetRecordOptions {
  appId?: string | undefined;
  worksheetId: string;
  viewId?: string | undefined;
  projectId?: string | undefined;
  recordId?: string | undefined;
  worksheetInfo?: { allowAdd?: boolean | undefined; appId?: string | undefined } | undefined;
  [option: string]: unknown;
}
export interface WidgetNewRecordOptions {
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  [option: string]: unknown;
}
export interface WidgetRecordSelectorOptions {
  relateSheetId?: string | undefined;
  projectId?: string | undefined;
  multiple?: boolean | undefined;
  pageSize?: number | undefined;
  [option: string]: unknown;
}
export interface WidgetLocation {
  address?: string | undefined;
  lat?: number | string | undefined;
  lng?: number | string | undefined;
  name?: string | undefined;
}
export interface WidgetLocationOptions {
  distance?: number | undefined;
  defaultPosition?: WidgetLocation | undefined;
  closeAfterSelect?: boolean | undefined;
}
