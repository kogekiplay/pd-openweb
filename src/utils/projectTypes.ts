/** Fields consumed from the account bootstrap and GetProjectLicenseInfo response.
 * Extra server metadata is retained, but is deliberately not given a payload type.
 */
export interface ProjectInfo {
  projectId?: string | undefined;
  companyName?: string | undefined;
  enabledWatermarkTxt?: string | undefined;
  currentLicense?: { expireDays?: number | undefined } | undefined;
  licenseType?: number | undefined;
  projectStatus?: number | undefined;
  isHrVisible?: boolean | undefined;
  isSuperAdmin?: boolean | undefined;
  allowSuperSearch?: boolean | undefined;
  enabledWatermark?: boolean | undefined;
  version?: { versionIdV2?: string | undefined; name?: string | undefined } | undefined;
}

export interface FeatureProduct {
  ProductType: number;
  /** Most consumers use '1'/'2'; app import also consumes numeric 2. Preserve the wire type. */
  Type?: string | number | undefined;
}
export interface FeatureVersion {
  VersionIdV2?: string | undefined;
  Products?: FeatureProduct[] | undefined;
}
export interface ProjectChartScheme {
  id?: string | undefined;
  name?: string | undefined;
  colors?: string[] | undefined;
  themeColors?: string[] | undefined;
  enable?: boolean | undefined;
}
export interface EnabledChartScheme extends ProjectChartScheme {
  colors: string[];
}
export interface ProjectThemeColor {
  color?: string | undefined;
  enable?: boolean | undefined;
}
export interface ProjectColor {
  projectId?: string | undefined;
  chartColor: { system?: ProjectChartScheme[] | undefined; custom?: ProjectChartScheme[] | undefined };
  themeColor: { system?: ProjectThemeColor[] | undefined; custom?: ProjectThemeColor[] | undefined };
}
export interface RawProjectColor {
  projectId?: string | undefined;
  chartColor?: ProjectColor['chartColor'] | undefined;
  themeColor?: ProjectColor['themeColor'] | undefined;
}
export type ContactInfo = HapApi.MD.Web.Ajax.ResultModel.Account.AccounContacttInfoModel;
export type ContactInfoKey = 'mobilePhone' | 'email';
export type BehaviorLogType =
  | 'app'
  | 'worksheet'
  | 'customPage'
  | 'worksheetRecord'
  | 'printRecord'
  | 'printWord'
  | 'pintTemplate'
  | 'printQRCode'
  | 'printBarCode'
  | 'batchPrintWord'
  | 'previewFile'
  | 'worksheetDecode'
  | 'worksheetBatchDecode'
  | 'robot';
export interface BehaviorLogParams extends Record<string, unknown> {
  rowId?: string | undefined;
  controlId?: string | undefined;
}
interface BridgeSession {
  sessionId?: string | undefined;
}
export interface ScanBridgeRequest extends BridgeSession {
  type: 'scan';
}
export interface FiltersBridgeRequest extends BridgeSession {
  type: 'getFilters' | 'getLogParams';
}
export type NativeInteractionAction =
  'row' | 'addRow' | 'selectUsers' | 'selectDepartments' | 'selectOrgRole' | 'selectRecord';
interface NativeSettings {
  action: string;
  account?: string | undefined;
  password?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  rowId?: string | undefined;
  projectId?: string | undefined;
  relateSheetId?: string | undefined;
  unique?: boolean | undefined;
  multiple?: boolean | undefined;
}
export interface NativeBridgeRequest extends BridgeSession {
  type: 'native';
  settings: NativeSettings;
}
export interface NativeInteractionRequest extends NativeBridgeRequest {
  settings: NativeSettings & { action: NativeInteractionAction };
}
export interface MapBridgeRequest extends BridgeSession {
  type: 'map';
  settings: { action: 'map'; range?: number | undefined };
}
export type AppBridgeRequest = ScanBridgeRequest | FiltersBridgeRequest | NativeBridgeRequest | MapBridgeRequest;
export interface NativeActionResponse extends Record<string, unknown> {
  action?: string | undefined;
  value?: string | undefined;
}
export interface ScanBridgeResponse extends Record<string, unknown> {
  value?: string | undefined;
}
export interface FiltersBridgeResponse extends Record<string, unknown> {
  value?: unknown[] | undefined;
}
export type SdkParameters = Record<string, unknown>;
export type SdkMethod = (params: SdkParameters) => unknown;
/** Only the native entry points used here, not a substitute for the full SDK. */
export interface ProjectNativeBridge {
  MD_APP_RESPONSE?: (base64: string) => void;
  webkit?: { messageHandlers?: { MD_APP_REQUEST?: { postMessage(base64: string): void } } };
  Android?: { MD_APP_REQUEST(base64: string): void };
  MDJS?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));
const optionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || typeof value === 'boolean';
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');
function isProjectInfo(value: unknown): value is ProjectInfo {
  if (!isRecord(value)) return false;
  const version = value['version'];
  return (
    optionalString(value['projectId']) &&
    optionalString(value['companyName']) &&
    optionalString(value['enabledWatermarkTxt']) &&
    (value['currentLicense'] === undefined ||
      (isRecord(value['currentLicense']) && optionalNumber(value['currentLicense']['expireDays']))) &&
    optionalNumber(value['licenseType']) &&
    optionalNumber(value['projectStatus']) &&
    optionalBoolean(value['isHrVisible']) &&
    optionalBoolean(value['isSuperAdmin']) &&
    optionalBoolean(value['allowSuperSearch']) &&
    optionalBoolean(value['enabledWatermark']) &&
    (version === undefined ||
      (isRecord(version) && optionalString(version['versionIdV2']) && optionalString(version['name'])))
  );
}
export function decodeProjectInfo(value: unknown): ProjectInfo {
  if (!isProjectInfo(value)) throw new TypeError('Invalid project information');
  return value;
}
export function decodeProjects(value: unknown): ProjectInfo[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isProjectInfo)) throw new TypeError('Invalid account project list');
  return value;
}
function isFeatureProduct(value: unknown): value is FeatureProduct {
  return (
    isRecord(value) &&
    typeof value['ProductType'] === 'number' &&
    Number.isFinite(value['ProductType']) &&
    (optionalString(value['Type']) || (typeof value['Type'] === 'number' && Number.isFinite(value['Type'])))
  );
}
function isFeatureVersion(value: unknown): value is FeatureVersion {
  return (
    isRecord(value) &&
    optionalString(value['VersionIdV2']) &&
    (value['Products'] === undefined || (Array.isArray(value['Products']) && value['Products'].every(isFeatureProduct)))
  );
}
export function decodeFeatureVersions(value: unknown): FeatureVersion[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isFeatureVersion)) throw new TypeError('Invalid project feature versions');
  return value;
}
function isChartScheme(value: unknown): value is ProjectChartScheme {
  return (
    isRecord(value) &&
    optionalString(value['id']) &&
    optionalString(value['name']) &&
    optionalBoolean(value['enable']) &&
    (value['colors'] === undefined || stringArray(value['colors'])) &&
    (value['themeColors'] === undefined || stringArray(value['themeColors']))
  );
}
function isThemeColor(value: unknown): value is ProjectThemeColor {
  return isRecord(value) && optionalString(value['color']) && optionalBoolean(value['enable']);
}
function isColorGroup<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is { system?: T[]; custom?: T[] } {
  return (
    isRecord(value) &&
    ['system', 'custom'].every(
      key => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(isItem)),
    )
  );
}
function isProjectColor(value: unknown): value is RawProjectColor {
  return (
    isRecord(value) &&
    optionalString(value['projectId']) &&
    (value['chartColor'] === undefined || isColorGroup(value['chartColor'], isChartScheme)) &&
    (value['themeColor'] === undefined || isColorGroup(value['themeColor'], isThemeColor))
  );
}
export function decodeProjectColors(value: unknown): RawProjectColor[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isProjectColor)) throw new TypeError('Invalid project color settings');
  return value;
}
export function decodeContactInfo(value: unknown): ContactInfo {
  if (
    !isRecord(value) ||
    !optionalString(value['accountId']) ||
    !optionalString(value['mobilePhone']) ||
    !optionalString(value['email'])
  ) {
    throw new TypeError('Invalid account contact information');
  }
  return value;
}
function isNativeInteraction(action: string): action is NativeInteractionAction {
  return ['row', 'addRow', 'selectUsers', 'selectDepartments', 'selectOrgRole', 'selectRecord'].includes(action);
}
export function decodeAppBridgeResponse(request: AppBridgeRequest, value: unknown): unknown {
  if (request.type === 'native' && !isNativeInteraction(request.settings.action)) {
    // Register/delete-account notifications do not consume a response payload.
    return value;
  }
  if (!isRecord(value)) throw new TypeError('Invalid native app response');
  if (request.type === 'getFilters' || request.type === 'getLogParams') {
    if (value['value'] !== undefined && !Array.isArray(value['value']))
      throw new TypeError('Invalid native app response');
  } else if (!optionalString(value['value']) || (request.type !== 'scan' && !optionalString(value['action']))) {
    throw new TypeError('Invalid native app response');
  }
  return value;
}

export function getSdkMethod(sdk: unknown, methodName: string): SdkMethod | undefined {
  if (!sdk) return undefined;
  if (!isRecord(sdk)) throw new TypeError('Invalid native SDK');
  const method = sdk[methodName];
  if (!method) return undefined;
  if (typeof method !== 'function') throw new TypeError('Invalid native SDK method');
  // Native MDJS methods invoked by compatibleMDJS accept one parameter object.
  return method as SdkMethod;
}
