export interface ApiRecord {
  [metadata: string]: unknown;
}
export interface ApiShareData extends ApiRecord {
  appId?: string | undefined;
  projectId?: string | undefined;
  appIcon?: string | undefined;
  appIconColor?: string | undefined;
  appName?: string | undefined;
  appNavColor?: string | undefined;
  clientId?: string | undefined;
}
export interface ApiShareResponse extends ApiRecord {
  resultCode?: number | undefined;
  data?: ApiShareData | undefined;
}
export interface ApiRequestInfo {
  appKey?: string | undefined;
  sign?: string | undefined;
}
export interface ApiAppInfo extends ApiRecord {
  apiUrl?: string | undefined;
  apiRequest?: ApiRequestInfo | undefined;
  apiResponse?:
    { appId?: string | undefined; projectId?: string | undefined; sections?: ApiSection[] | undefined } | undefined;
  appStatus?: number | undefined;
  id?: string | undefined;
  projectId?: string | undefined;
  langInfo?: { appLangId?: string | undefined; version?: string | number | undefined } | undefined;
  openApiWhiteList?: string[] | undefined;
  iconUrl?: string | undefined;
  iconColor?: string | undefined;
  navColor?: string | undefined;
  name?: string | undefined;
}
export interface ApiAuthorize extends ApiRecord {
  appKey: string;
  sign: string;
  name?: string | undefined;
  appName?: string | undefined;
  remark?: string | undefined;
  status?: number | undefined;
  type?: number | undefined;
  viewNull?: boolean | undefined;
  createTime?: string | undefined;
  creater?: { avatar?: string | undefined; fullname?: string | undefined } | undefined;
}
export interface WorksheetApiProps {
  isSharePage?: boolean | undefined;
  appId?: string | undefined;
  shareData?: ApiShareData | undefined;
}
export interface ApiMenuField {
  key: string;
  text: string;
  className: string;
}
export interface ApiHeader {
  width: number;
  title: string;
  key: string;
}
export interface ApiMenuItem extends ApiRecord {
  id: string;
  title: string;
  type?: string | undefined;
  btnText?: string | undefined;
  apiName?: string | undefined;
  isGet?: boolean | undefined;
  data?: ApiField[] | undefined;
  fields?: ApiMenuField[] | undefined;
  requestData?: ApiRecord | undefined;
  successData?: unknown;
  errorData?: unknown;
  cityData?: unknown;
}
export interface ApiSidebarItem {
  key: string;
  title: string;
  render?: string | undefined;
  args?: number | undefined;
}
export interface ApiSideItem extends ApiRecord {
  id?: string | undefined;
  workSheetId?: string | undefined;
  workSheetName?: string | undefined;
  name?: string | undefined;
  startAppType?: number | undefined;
  worksheetId?: string | undefined;
}
/** Only the documentation fields actually consumed by this page are declared. */
export interface ApiDocNode extends ApiRecord {
  type?: number | string | undefined;
  desc?: string | Array<Record<string, string | undefined>> | undefined;
  name?: string | undefined;
  id?: string | undefined;
  keyName?: string | undefined;
  sectionId?: string | undefined;
  worksheetId?: string | undefined;
  controlId?: string | undefined;
  viewId?: string | undefined;
  alias?: string | undefined;
  value?: string | undefined;
  required?: string | boolean | undefined;
  linkid?: string | undefined;
  width?: number | undefined;
  title?: string | undefined;
  key?: string | undefined;
  data?: ApiDocNode[] | undefined;
  controls?: ApiField[] | undefined;
  views?: ApiDocNode[] | undefined;
  items?: ApiDocNode[] | undefined;
  apiUrl?: string | undefined;
  appKey?: string | undefined;
  sign?: string | undefined;
}
export interface ApiSection extends ApiDocNode {}
export interface ApiField extends ApiRecord {
  id?: string | undefined;
  linkid?: string | undefined;
  /** Parameter names are strings; appendix enum rows also have numeric names. */
  name?: string | number | undefined;
  controlId?: string | undefined;
  controlName?: string | undefined;
  dataSource?: string | undefined;
  type?: number | string | undefined;
  alias?: string | undefined;
  value?: string | undefined;
  required?: boolean | string | undefined;
  desc?: string | Array<Record<string, string | undefined>> | undefined;
  isSupport?: boolean | undefined;
  isRequired?: boolean | undefined;
  dataType?: string | undefined;
  description?: string | undefined;
  example?: unknown;
  relationValue?: unknown;
}
export type ApiOptionConfig = { requestParams?: ApiField[] | undefined; [metadata: string]: unknown } | [];
export interface ApiWorkflowInfo extends ApiRecord {
  processId?: string | undefined;
  name?: string | undefined;
  url?: string | undefined;
  outType?: number | undefined;
  inputs?: ApiField[] | undefined;
  outputs?: ApiField[] | undefined;
}
/** Page comparison and the filter generator consume this projection, not an entire FormControl DTO. */
export interface ApiTemplateControl extends ApiRecord {
  controlId?: string | undefined;
  controlName?: string | undefined;
  alias?: string | undefined;
  type?: number | undefined;
  sourceControlType?: number | undefined;
  enumDefault?: number | undefined;
  enumDefault2?: number | undefined;
  dot?: number | undefined;
  row?: number | undefined;
  col?: number | undefined;
  controlPermissions?: string | undefined;
  unit?: string | undefined;
  dataSource?: string | undefined;
  strDefault?: string | undefined;
  originType?: number | undefined;
  appId?: string | undefined;
  viewId?: string | undefined;
  coverCid?: string | undefined;
  showControls?: string[] | undefined;
  advancedSetting?: Record<string, string | undefined> | undefined;
  sourceControl?: ApiTemplateControl | undefined;
  options?:
    | Array<{
        key: string;
        value?: string | undefined;
        index?: number | undefined;
        isDeleted?: boolean | undefined;
        score?: number | undefined;
        color?: string | undefined;
      }>
    | undefined;
}
export interface ApiSwitchPermit extends ApiRecord {
  type: number;
  state: boolean;
  viewIds?: string[] | undefined;
}
export interface ApiWorksheetMetadata {
  alias?: string | undefined;
  template?: { controls?: ApiTemplateControl[] | undefined } | undefined;
  switches?: ApiSwitchPermit[] | undefined;
}
export interface ApiWorksheetState {
  data: ApiDocNode[];
  worksheetList?: ApiSideItem[] | undefined;
  selectId: string | undefined;
  dataApp: ApiAppInfo;
  loading: boolean;
  loadError?: string | undefined;
  showMoreOption: boolean;
  appKey: string;
  authorizes: ApiAuthorize[];
  addSecretKey: boolean;
  errorCode: number | undefined;
  aliasDialog: { visible: boolean; type?: string | undefined };
  templateControls: ApiTemplateControl[];
  sheetSwitchPermit: ApiSwitchPermit[] | undefined;
  appInfo: ApiAppInfo;
  whiteListDialog: boolean;
  showWorksheetAliasDialog: boolean;
  addOptionsParams: ApiOptionConfig;
  getOptionsParams: ApiOptionConfig;
  selectWorkflowId: string | undefined;
  pbcList: ApiSideItem[];
  workflowInfo: ApiWorkflowInfo;
  shareVisible: boolean;
  dataPipelineList?: ApiSideItem[] | undefined;
  dataPipelineData?: ApiDocNode[] | undefined;
  dataPipelineLoading?: boolean | undefined;
  expandIds: Array<string | null | undefined>;
  webhookList: ApiSideItem[];
  visibleAppKeys: string[];
  visibleSigns: string[];
  tabIndex: string;
  workflowAliasDialog: boolean;
  workflowAlias: string;
  alias?: string | undefined;
  dialogType?: string | undefined;
}
