import type { TranslateInfo } from './app';

export interface AppSectionItem {
  workSheetId?: string | undefined;
  workSheetName?: string | undefined;
  name?: string | undefined;
  remark?: string | undefined;
  /** 1 is a custom page; 2 references a nested group. */
  type?: number | undefined;
}
export interface AppSection {
  appSectionId?: string | undefined;
  item?: AppSectionItem[] | undefined;
  workSheetInfo?: AppSectionItem[] | undefined;
  childSections?: AppSection[] | undefined;
}
export interface DescriptionData {
  name?: string | undefined;
  desc?: string | undefined;
  description?: string | undefined;
  sections?: AppSection[] | undefined;
  template?: { controls?: { controlName?: string | undefined; type?: number | undefined }[] | undefined } | undefined;
}
export interface DescriptionRequest {
  name?: string | undefined;
  description?: string | undefined;
  isApp?: boolean | undefined;
  data?: DescriptionData | undefined;
}
export interface DescriptionContext {
  userLanguage: string;
  appName?: string | undefined;
  groups?: string | undefined;
  tableName?: string | undefined;
  tableDescription?: string | undefined;
  fields?: string | undefined;
}
interface DescriptionContent {
  value: string;
}
export type DescriptionPayload =
  | { isSuccess: true; content: DescriptionContent; errorMsg?: string | undefined }
  | { isSuccess: false; content?: DescriptionContent | undefined; errorMsg?: string | undefined };
export interface DescriptionResponse {
  data: DescriptionPayload;
}

export type TranslationId = string | null | undefined;
export interface TranslationItem {
  correlationId?: string | undefined;
  parentId?: string | null | undefined;
  data?: unknown;
}
/** The legacy dictionary path and null array placeholders remain valid cache shapes. */
export type TranslationData =
  Array<TranslationItem | null | undefined> | Record<string, TranslationItem | null | undefined>;
export interface TranslationIndex {
  length: number;
  correlationIdMap: Map<TranslationId, TranslationItem>;
  parentIdMap: Map<TranslationId, Map<TranslationId, TranslationItem>>;
}
export type AppLangInfo = HapApi.MD.Entity.AppLang.LangInfo;
export interface AppLanguage {
  id?: string | undefined;
  langCode?: string | undefined;
}
export interface AppLanguageDetail extends Record<string, unknown> {
  items?: TranslationData | undefined;
}
export interface AppLanguageSource {
  id?: string | undefined;
  projectId?: string | undefined;
  langInfo?: AppLangInfo | null | undefined;
}
export interface SharedLanguageSource {
  appId?: string | undefined;
  projectId?: string | undefined;
  worksheetId?: string | undefined;
}
/** Payload slots start as unknown, so a Window index signature never types a language response. */
export interface AppLanguageCache {
  [key: `langData-${string}`]: unknown;
  [key: `langVersion-${string}`]: number | undefined;
  [key: `appLangs-${string}`]: unknown;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';
export function isTranslateInfo(value: unknown): value is TranslateInfo {
  return isRecord(value) && Object.values(value).every(optionalString);
}
function isTranslationItem(value: unknown): value is TranslationItem | null | undefined {
  return (
    value === null ||
    value === undefined ||
    (isRecord(value) &&
      optionalString(value['correlationId']) &&
      (value['parentId'] === null || optionalString(value['parentId'])))
  );
}
function isTranslationData(value: unknown): value is TranslationData {
  return Array.isArray(value)
    ? value.every(isTranslationItem)
    : isRecord(value) && Object.values(value).every(isTranslationItem);
}
export function decodeTranslationData(value: unknown): TranslationData {
  if (!isTranslationData(value)) throw new TypeError('Invalid application translations');
  return value;
}
export function decodeAppLangInfo(value: unknown): AppLangInfo | null | undefined {
  if (value === null || value === undefined) return value;
  if (
    !isRecord(value) ||
    !optionalString(value['appLangId']) ||
    !optionalString(value['langCode']) ||
    !optionalString(value['projectId']) ||
    (value['version'] !== undefined && (typeof value['version'] !== 'number' || !Number.isFinite(value['version'])))
  ) {
    throw new TypeError('Invalid application language information');
  }
  return value;
}
function isAppLanguage(value: unknown): value is AppLanguage {
  return isRecord(value) && optionalString(value['id']) && optionalString(value['langCode']);
}
export function decodeAppLanguages(value: unknown): AppLanguage[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isAppLanguage)) throw new TypeError('Invalid application language list');
  return value;
}
function isLanguageDetail(value: unknown): value is AppLanguageDetail {
  if (!isRecord(value)) return false;
  const items = value['items'];
  if (items === undefined) return true;
  if (!isTranslationData(items)) return false;
  return Object.values(items).every(item => !item?.data || isTranslateInfo(item.data));
}
export function decodeAppLanguageDetail(value: unknown): AppLanguageDetail {
  if (!isLanguageDetail(value)) throw new TypeError('Invalid application language detail');
  return value;
}
function isDescriptionResponse(value: unknown): value is DescriptionResponse {
  if (!isRecord(value) || !isRecord(value['data'])) return false;
  const data = value['data'];
  const content = data['content'];
  return (
    typeof data['isSuccess'] === 'boolean' &&
    optionalString(data['errorMsg']) &&
    (content === undefined ? !data['isSuccess'] : isRecord(content) && typeof content['value'] === 'string')
  );
}
export function decodeDescriptionResponse(value: unknown): DescriptionResponse {
  if (!isDescriptionResponse(value)) throw new TypeError('Invalid generated application description');
  return value;
}
