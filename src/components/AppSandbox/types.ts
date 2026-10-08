import type { ReactNode } from 'react';

/** Only fields read by the sandbox screens are modeled; arbitrary configuration remains unknown. */
export type Request<T> = Promise<T> & { abort?: () => void };
export interface SandboxAccount {
  accountId: string;
  fullname?: string | undefined;
  fullName?: string | undefined;
  avatar?: string | undefined;
  avatarSmall?: string | undefined;
  avatarMiddle?: string | undefined;
  userHead?: string | undefined;
}
export interface SandboxProject {
  projectId: string;
  companyName?: string | undefined;
  projectName?: string | undefined;
  isSuperAdmin?: boolean | undefined;
}
export interface SandboxApp {
  appId: string;
  id: string;
  appName: string;
  sheetCount?: number | undefined;
  name: string;
  icon?: string | undefined;
  iconUrl?: string | undefined;
  iconColor?: string | undefined;
  color?: string | undefined;
  avatar?: string | undefined;
  owner?: SandboxAccount | undefined;
  reviewMode?: number | undefined;
  updateTime?: string | undefined;
  isDeleted?: boolean | undefined;
  pendingStatus?: number | undefined;
  latestVersionNo?: string | undefined;
  sandboxDataExists?: boolean | undefined;
  appDisplay?: boolean | undefined;
  webMobileDisplay?: boolean | undefined;
  createType?: number | undefined;
  urlTemplate?: string | undefined;
  pcNaviStyle?: number | undefined;
  selectAppItmeType?: number | undefined;
}
export interface IconChange {
  text: string;
  type: 'iconChange';
  before?: string | undefined;
  after?: string | undefined;
}
export type ChangeContent = string | IconChange;
export interface ChangeResource {
  id: string;
  name: string;
  itemName?: string | undefined;
  action: string;
  sourceId?: string | undefined;
  source?: SnapshotResource | undefined;
  original?: SnapshotResource | undefined;
  displayName?: string | undefined;
  originalName?: string | undefined;
  iconUrl?: string | undefined;
  originalIconUrl?: string | undefined;
  desc?: string | undefined;
  originalDesc?: string | undefined;
  remark?: string | undefined;
  originalRemark?: string | undefined;
  upgradeType?: number | undefined;
  roleCategory?: number | undefined;
  content?: ChangeContent[] | undefined;
  changes?: ChangeSections | undefined;
  navigationCategory?: boolean | undefined;
}
export type ChangeSections = Record<string, ChangeResource[]>;
export interface ChangeGroup {
  key: string;
  title: string;
  changes: ChangeResource[];
}
export interface SandboxVersion {
  appId?: string | undefined;
  isCurrent?: boolean | undefined;
  id?: string | undefined;
  versionId: string;
  version: string;
  versionNo?: string | undefined;
  minimumVersion?: string | undefined;
  contrastId?: string | undefined;
  status: number;
  description: string | undefined;
  fileUrl?: string | undefined;
  creator?: SandboxAccount | undefined;
  createTime?: string | undefined;
  reviewer?: SandboxAccount | undefined;
  reviewTime?: string | undefined;
  remark?: string | undefined;
  app: SandboxApp;
  changes: ChangeSections;
  upgrading?: boolean | undefined;
}
export interface VersionAction {
  action: string;
  version?: SandboxVersion | null | undefined;
  versionIds?: string[] | undefined;
  rejectReason?: string | undefined;
  batchCount?: number | undefined;
}
export interface ActionSuccess {
  action: string;
  affectedCount: number;
  affectedVersionIds: string[];
  isSingleVersionAction: boolean;
}
export interface SandboxQuota {
  effectiveApkStorageCount?: number | undefined;
  limitApkStorageCount?: number | undefined;
  useExecCount?: number | undefined;
  limitExecCount?: number | undefined;
  effectiveVectorKnowledgeChunkCount?: number | undefined;
  limitVectorKnowledgeChunkCount?: number | undefined;
}
export interface AppSummary {
  currentVersionNo?: string | undefined;
  versionNo?: string | undefined;
  description?: string | undefined;
  upgradeTime?: string | undefined;
  upgrader?: SandboxAccount | undefined;
  version?: string | undefined;
  creator?: SandboxAccount | undefined;
  createTime?: string | undefined;
}
export interface SnapshotResource {
  id?: string | undefined;
  _id?: string | undefined;
  name?: string | undefined;
  title?: string | undefined;
  controlId?: string | undefined;
  controlName?: string | undefined;
  type?: number | undefined;
  updateTime?: string | undefined;
  viewId?: string | undefined;
  indexConfigId?: string | undefined;
  ruleId?: string | undefined;
  btnId?: string | undefined;
  btnType?: number | undefined;
  value?: unknown;
  config?: SnapshotConfig | undefined;
  pbcConfig?: unknown;
  explain?: string | undefined;
  flowNodes?: SnapshotResource[] | undefined;
  desc?: unknown;
  adjustScreen?: unknown;
  urlParams?: unknown;
  components?: SnapshotResource[] | undefined;
  componentId?: string | undefined;
  titleVisible?: unknown;
  visible?: unknown;
  layoutType?: unknown;
  layout?: unknown;
  variableId?: string | undefined;
  controlType?: unknown;
  langCode?: string | undefined;
  collectionId?: string | undefined;
  options?: unknown;
  advancedSetting?: { key: string; value: unknown }[] | undefined;
  [key: string]: unknown;
}
export type SnapshotConfig = Record<string, unknown> & {
  pbcConfig?: unknown;
  template?: { controls?: SnapshotResource[] | undefined } | undefined;
};
export interface SnapshotRoot {
  pages?: SnapshotResource[] | undefined;
  componentLayouts?: SnapshotResource[] | undefined;
  process?: SnapshotResource | undefined;
  config?: Record<string, SnapshotConfig> | undefined;
}
export interface SnapshotDetail {
  data?: unknown;
  originalData?: unknown;
}
export interface AppInfoSnapshot {
  appId?: string | undefined;
  source?: AppAppearance | undefined;
  original?: AppAppearance | undefined;
}
export interface AppAppearance {
  apkName?: string | undefined;
  color?: string | undefined;
  navColor?: string | undefined;
  avatar?: string | undefined;
  description?: string | undefined;
  [key: string]: unknown;
}
export interface SnapshotPair {
  source?: SnapshotResource[] | undefined;
  original?: SnapshotResource[] | undefined;
}
export interface PublishContrastData {
  id?: string | undefined;
  appInfo?: AppInfoSnapshot | undefined;
  variables?: SnapshotPair | undefined;
  appLangs?: SnapshotPair | undefined;
  optionCollection?: { mdyJson?: unknown; currentJson?: unknown } | undefined;
  aggregations?: ChangeResource[] | undefined;
  worksheets?: ChangeResource[] | undefined;
  pages?: ChangeResource[] | undefined;
  workflows?: ChangeResource[] | undefined;
  roles?: ChangeResource[] | undefined;
  chatBots?: ChangeResource[] | undefined;
}
export interface PublishContrastResponse {
  code?: number | undefined;
  message?: string | undefined;
  data?: PublishContrastData | undefined;
}
export interface ContrastResult {
  app?: SandboxApp | undefined;
  contrastId: string;
  description?: string | undefined;
  changes: ChangeSections;
}
export interface ContrastOptions {
  reverse?: boolean | undefined;
  isRelease?: boolean | undefined;
}
export interface DetailResult<T> {
  requestKey: string;
  data: T | null;
  error: unknown;
  attemptKey?: string | undefined;
}
export interface SandboxListColumn {
  key: string;
  title?: ReactNode;
  width?: number | string | undefined;
  flex?: number | undefined;
  className?: string | undefined;
}
export interface WorksheetSnapshot {
  controls?: SnapshotResource[] | undefined;
  views?: SnapshotResource[] | undefined;
  worksheetRowIndexs?: SnapshotResource[] | undefined;
  rules?: SnapshotResource[] | undefined;
  btns?: SnapshotResource[] | undefined;
  prints?: SnapshotResource[] | undefined;
  switch?: SnapshotResource | undefined;
  publicForm?: SnapshotResource | undefined;
  publicQuery?: SnapshotResource | undefined;
  payment?: SnapshotResource | undefined;
  invoice?: SnapshotResource | undefined;
}
export interface WorksheetDetail {
  source?: WorksheetSnapshot | undefined;
  original?: WorksheetSnapshot | undefined;
  mdyJson?: unknown;
  currentJson?: unknown;
}
export interface CategoryConfig {
  getLabel: () => string;
  fields?: string[] | undefined;
  advancedSettingKeys?: string[] | undefined;
  includeGeneralAdvancedSettings?: boolean | undefined;
}
export interface SnapshotFieldConfig {
  key?: string | undefined;
  keys?: string[] | undefined;
  getLabel: () => string;
  labels?: Record<string, () => string> | undefined;
  showUpdateOnly?: boolean | undefined;
  type?: string | undefined;
}
export interface SnapshotListConfig {
  sourceKey: 'views' | 'worksheetRowIndexs' | 'rules' | 'btns' | 'prints';
  idKey: string;
  idPrefix: string;
  nameKey?: string | undefined;
  showNameChange?: boolean | undefined;
}
export interface SnapshotSingletonConfig {
  sourceKey: 'switch' | 'publicForm' | 'publicQuery' | 'payment' | 'invoice';
  id: string;
  getName: () => string;
}
export interface ResourcePair {
  id: string;
  occurrence: number;
  order: number;
  before?: SnapshotResource | undefined;
  after?: SnapshotResource | undefined;
}
export interface SnapshotRowsConfig {
  snapshot?: SnapshotPair | undefined;
  idKey: string;
  isChanged: (source: SnapshotResource, original: SnapshotResource) => boolean;
  getName: (after: SnapshotResource | undefined, before: SnapshotResource | undefined) => string;
}
export function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
export function parseSnapshot<T extends object>(value: unknown): T {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = undefined;
    }
  }
  return objectValue(parsed) as T;
}
export function isPresent<T>(value: T | null | undefined | false): value is T {
  return value !== null && value !== undefined && value !== false;
}
