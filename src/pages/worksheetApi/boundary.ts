import type {
  ApiAppInfo,
  ApiAuthorize,
  ApiDocNode,
  ApiField,
  ApiMenuField,
  ApiMenuItem,
  ApiOptionConfig,
  ApiRecord,
  ApiShareData,
  ApiShareResponse,
  ApiSidebarItem,
  ApiSideItem,
  ApiSwitchPermit,
  ApiTemplateControl,
  ApiWorkflowInfo,
  ApiWorksheetMetadata,
} from './types';

export function isRecord(value: unknown): value is ApiRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';
const optionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || typeof value === 'boolean';
function fields(value: ApiRecord, keys: string[], valid: (value: unknown) => boolean): boolean {
  return keys.every(key => valid(value[key]));
}
function arrayOf<T>(value: unknown, valid: (value: unknown) => value is T): value is T[] {
  return Array.isArray(value) && Array.from(value).every(valid);
}
function mapping(value: unknown): value is Record<string, string | undefined> {
  return isRecord(value) && Object.values(value).every(optionalString);
}
function description(value: unknown): value is ApiField['desc'] {
  return optionalString(value) || arrayOf(value, mapping);
}
export function isApiField(value: unknown): value is ApiField {
  return (
    isRecord(value) &&
    fields(
      value,
      ['id', 'linkid', 'controlId', 'controlName', 'dataSource', 'alias', 'value', 'dataType', 'description'],
      optionalString,
    ) &&
    (optionalString(value['name']) || optionalNumber(value['name'])) &&
    (optionalString(value['type']) || optionalNumber(value['type'])) &&
    (optionalString(value['required']) || optionalBoolean(value['required'])) &&
    fields(value, ['isSupport', 'isRequired'], optionalBoolean) &&
    description(value['desc'])
  );
}
export function apiFields(value: unknown): ApiField[] {
  if (!arrayOf(value, isApiField)) throw new TypeError('Invalid worksheet API fields');
  return value;
}
function isMenuField(value: unknown): value is ApiMenuField {
  return isRecord(value) && ['key', 'text', 'className'].every(key => typeof value[key] === 'string');
}
function isMenu(value: unknown): value is ApiMenuItem {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    fields(value, ['type', 'btnText', 'apiName'], optionalString) &&
    optionalBoolean(value['isGet']) &&
    (value['data'] === undefined || arrayOf(value['data'], isApiField)) &&
    (value['fields'] === undefined || arrayOf(value['fields'], isMenuField)) &&
    (value['requestData'] === undefined || isRecord(value['requestData']))
  );
}
/** Return the checked originals: views/data-pipeline rendering intentionally mutate menu metadata. */
export function apiMenuItems(value: unknown): ApiMenuItem[] {
  if (!arrayOf(value, isMenu)) throw new TypeError('Invalid worksheet API menu');
  return value;
}
function isSidebar(value: unknown): value is ApiSidebarItem {
  return (
    isRecord(value) &&
    typeof value['key'] === 'string' &&
    typeof value['title'] === 'string' &&
    optionalString(value['render']) &&
    optionalNumber(value['args'])
  );
}
export function apiSidebarItems(value: unknown): ApiSidebarItem[] {
  if (!arrayOf(value, isSidebar)) throw new TypeError('Invalid worksheet API sidebar');
  return value;
}
function docNode(value: unknown, ancestors: Set<object>): value is ApiDocNode {
  if (!isRecord(value) || ancestors.has(value)) return false;
  if (
    !fields(
      value,
      [
        'name',
        'id',
        'keyName',
        'sectionId',
        'worksheetId',
        'controlId',
        'viewId',
        'alias',
        'value',
        'linkid',
        'title',
        'key',
        'apiUrl',
        'appKey',
        'sign',
      ],
      optionalString,
    ) ||
    !(optionalString(value['type']) || optionalNumber(value['type'])) ||
    !(optionalString(value['required']) || optionalBoolean(value['required'])) ||
    !optionalNumber(value['width']) ||
    !description(value['desc']) ||
    !(value['controls'] === undefined || arrayOf(value['controls'], isApiField))
  )
    return false;
  ancestors.add(value);
  const valid = ['data', 'views', 'items'].every(
    key => value[key] === undefined || arrayOf(value[key], item => docNode(item, ancestors)),
  );
  ancestors.delete(value);
  return valid;
}
function isDoc(value: unknown): value is ApiDocNode {
  return docNode(value, new Set());
}
export function apiDocuments(value: unknown): ApiDocNode[] {
  if (!arrayOf(value, isDoc)) throw new TypeError('Invalid worksheet API documentation');
  return value;
}
function isSideItem(value: unknown): value is ApiSideItem {
  return (
    isRecord(value) &&
    fields(value, ['id', 'workSheetId', 'workSheetName', 'name', 'worksheetId'], optionalString) &&
    optionalNumber(value['startAppType'])
  );
}
export function apiSideItems(value: unknown): ApiSideItem[] {
  if (!arrayOf(value, isSideItem)) throw new TypeError('Invalid worksheet API sidebar records');
  return value;
}
function isAppInfo(value: unknown): value is ApiAppInfo {
  if (
    !isRecord(value) ||
    !fields(value, ['apiUrl', 'id', 'projectId', 'iconUrl', 'iconColor', 'navColor', 'name'], optionalString) ||
    !optionalNumber(value['appStatus'])
  )
    return false;
  const request = value['apiRequest'],
    response = value['apiResponse'],
    lang = value['langInfo'];
  return (
    (request === undefined || (isRecord(request) && fields(request, ['appKey', 'sign'], optionalString))) &&
    (response === undefined ||
      (isRecord(response) &&
        fields(response, ['appId', 'projectId'], optionalString) &&
        (response['sections'] === undefined || arrayOf(response['sections'], isDoc)))) &&
    (lang === undefined ||
      (isRecord(lang) &&
        optionalString(lang['appLangId']) &&
        (optionalString(lang['version']) || optionalNumber(lang['version'])))) &&
    (value['openApiWhiteList'] === undefined ||
      arrayOf(value['openApiWhiteList'], (v): v is string => typeof v === 'string'))
  );
}
export function apiAppInfo(value: unknown): ApiAppInfo {
  if (!isAppInfo(value)) throw new TypeError('Invalid worksheet API application');
  return value;
}
function isAuthorize(value: unknown): value is ApiAuthorize {
  return (
    isRecord(value) &&
    typeof value['appKey'] === 'string' &&
    typeof value['sign'] === 'string' &&
    fields(value, ['name', 'appName', 'remark', 'createTime'], optionalString) &&
    fields(value, ['status', 'type'], optionalNumber) &&
    optionalBoolean(value['viewNull']) &&
    (value['creater'] === undefined ||
      (isRecord(value['creater']) && fields(value['creater'], ['avatar', 'fullname'], optionalString)))
  );
}
export function apiAuthorizes(value: unknown): ApiAuthorize[] {
  if (!arrayOf(value, isAuthorize)) throw new TypeError('Invalid worksheet API authorizations');
  return value;
}
export function apiOptions(value: unknown): ApiOptionConfig {
  if (isEmptyList(value)) return value;
  if (!isRecord(value) || !(value['requestParams'] === undefined || arrayOf(value['requestParams'], isApiField)))
    throw new TypeError('Invalid option-set API description');
  return value;
}
function isEmptyList(value: unknown): value is [] {
  return Array.isArray(value) && value.length === 0;
}
export function optionParameters(value: ApiOptionConfig): ApiField[] | undefined {
  return Array.isArray(value) ? undefined : value.requestParams;
}
function isWorkflow(value: unknown): value is ApiWorkflowInfo {
  return (
    isRecord(value) &&
    fields(value, ['processId', 'name', 'url'], optionalString) &&
    optionalNumber(value['outType']) &&
    (value['inputs'] === undefined || arrayOf(value['inputs'], isApiField)) &&
    (value['outputs'] === undefined || arrayOf(value['outputs'], isApiField))
  );
}
export function apiWorkflow(value: unknown): ApiWorkflowInfo {
  if (!isWorkflow(value)) throw new TypeError('Invalid workflow API documentation');
  return value;
}
function isTemplateOption(value: unknown): value is NonNullable<ApiTemplateControl['options']>[number] {
  return (
    isRecord(value) &&
    typeof value['key'] === 'string' &&
    fields(value, ['value', 'color'], optionalString) &&
    fields(value, ['index', 'score'], optionalNumber) &&
    optionalBoolean(value['isDeleted'])
  );
}
function templateControl(value: unknown, ancestors: Set<object>): value is ApiTemplateControl {
  if (
    !isRecord(value) ||
    ancestors.has(value) ||
    !fields(
      value,
      [
        'controlId',
        'controlName',
        'alias',
        'controlPermissions',
        'unit',
        'dataSource',
        'strDefault',
        'appId',
        'viewId',
        'coverCid',
      ],
      optionalString,
    ) ||
    !fields(
      value,
      ['type', 'sourceControlType', 'enumDefault', 'enumDefault2', 'dot', 'row', 'col', 'originType'],
      optionalNumber,
    ) ||
    !(value['options'] === undefined || arrayOf(value['options'], isTemplateOption)) ||
    !(
      value['showControls'] === undefined || arrayOf(value['showControls'], (v): v is string => typeof v === 'string')
    ) ||
    !(value['advancedSetting'] === undefined || mapping(value['advancedSetting']))
  )
    return false;
  ancestors.add(value);
  const valid = value['sourceControl'] === undefined || templateControl(value['sourceControl'], ancestors);
  ancestors.delete(value);
  return valid;
}
function isTemplateControl(value: unknown): value is ApiTemplateControl {
  return templateControl(value, new Set());
}
export function apiTemplateControls(value: unknown): ApiTemplateControl[] {
  if (!arrayOf(value, isTemplateControl)) throw new TypeError('Invalid worksheet API template controls');
  return value;
}
function isPermit(value: unknown): value is ApiSwitchPermit {
  return (
    isRecord(value) &&
    typeof value['type'] === 'number' &&
    typeof value['state'] === 'boolean' &&
    (value['viewIds'] === undefined || arrayOf(value['viewIds'], (v): v is string => typeof v === 'string'))
  );
}
export function apiWorksheetMetadata(value: unknown): ApiWorksheetMetadata | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || !optionalString(value['alias'])) throw new TypeError('Invalid worksheet API metadata');
  const template = value['template'],
    switches = value['switches'];
  if (
    !(
      template === undefined ||
      (isRecord(template) && (template['controls'] === undefined || arrayOf(template['controls'], isTemplateControl)))
    ) ||
    !(switches === undefined || arrayOf(switches, isPermit))
  )
    throw new TypeError('Invalid worksheet API controls/permissions');
  return value;
}
function isShareData(value: unknown): value is ApiShareData {
  return (
    isRecord(value) &&
    fields(
      value,
      ['appId', 'projectId', 'appIcon', 'appIconColor', 'appName', 'appNavColor', 'clientId'],
      optionalString,
    )
  );
}
export function apiShare(value: unknown): ApiShareResponse {
  if (
    !isRecord(value) ||
    typeof value['resultCode'] !== 'number' ||
    !(value['data'] === undefined || isShareData(value['data']))
  )
    throw new TypeError('Invalid API share response');
  if (value['resultCode'] === 1 && (!isShareData(value['data']) || !value['data']['appId']))
    throw new TypeError('Missing shared application ID');
  return value;
}
export function viewDescriptions(value: unknown): Array<Record<string, string | undefined>> {
  const rows = apiDocuments(value);
  return rows.map(row => ({ [String(row.name)]: row.viewId }));
}
export function textField(value: unknown): string | undefined {
  if (!optionalString(value)) throw new TypeError('Invalid worksheet API display text');
  return value;
}
export function displayDescription(value: ApiField['desc']): string | undefined {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}
export function parseExample(value: string): unknown {
  return JSON.parse(value);
}
export function cachedPosition(value: string | null): {
  selectId?: string | undefined;
  expandIds?: Array<string | null | undefined> | undefined;
} {
  if (value === null) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      !optionalString(parsed['selectId']) ||
      !(
        parsed['expandIds'] === undefined ||
        arrayOf(parsed['expandIds'], (v): v is string | null | undefined => v == null || typeof v === 'string')
      )
    )
      return {};
    return parsed;
  } catch {
    return {};
  }
}
export function errorInfo(value: unknown): { message: string; errorCode: number | undefined } {
  return {
    message: isRecord(value) && typeof value['message'] === 'string' ? value['message'] : _l('加载失败，请重试'),
    errorCode: isRecord(value) && typeof value['errorCode'] === 'number' ? value['errorCode'] : undefined,
  };
}
export function relationExample(value: unknown): {
  length: number | undefined;
  rowIds: string[] | undefined;
  isAdd: boolean | undefined;
} {
  if (Array.isArray(value)) return { length: value.length, rowIds: undefined, isAdd: undefined };
  if (
    !isRecord(value) ||
    !optionalNumber(value['length']) ||
    !optionalBoolean(value['isAdd']) ||
    !(value['rowIds'] === undefined || arrayOf(value['rowIds'], (v): v is string => typeof v === 'string'))
  )
    throw new TypeError('Invalid API relation value example');
  const rawRowIds = value['rowIds'];
  let rowIds: string[] | undefined;
  if (rawRowIds === undefined) rowIds = undefined;
  else if (arrayOf(rawRowIds, (v): v is string => typeof v === 'string')) rowIds = rawRowIds;
  else throw new TypeError('Invalid API relation row IDs');
  return { length: value['length'], rowIds, isAdd: value['isAdd'] };
}
