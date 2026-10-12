import type { PendingBuilderEdit } from './builderContext';
import { fileArray, isFileRecord } from './fileTypes';
import type { SidebarItem, SidebarKey } from './fileTypes';

export type BuildPhase = 'idle' | 'building' | 'completed' | 'failed';
export interface SidebarProps {
  appName: string;
  appIcon?: string | undefined;
  appColor?: string | undefined;
  items: readonly SidebarItem[];
  loading?: boolean | undefined;
  activeKey: SidebarKey;
  onSelect: (key: SidebarKey) => void;
  buildStatus?: BuildPhase | undefined;
  onStatusClick?: (() => void) | undefined;
  showSidebarExpand?: boolean | undefined;
  onExpandSidebar?: (() => void) | undefined;
}
export interface AppMetaState {
  name: string;
  versionLabel: string;
  appId: string;
  sectionIdByName: Record<string, string>;
  sessionId: string;
  artifactId: string;
  versionId: string;
}
export interface WorksheetPreview {
  worksheetId: string;
  sectionId: string;
  name?: string | undefined;
}
export interface CustomPagePreview {
  sectionId: string;
  pageId: string;
}
export interface CreatedCustomPage {
  name: string;
  pageId: string;
}
export function builderText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export function builderRecord(value: unknown): Record<string, unknown> {
  return isFileRecord(value) ? value : {};
}
function sectionIds(value: unknown): Record<string, string> | undefined {
  if (!isFileRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
export function mergeAppMeta(previous: AppMetaState, payload: unknown): AppMetaState {
  const data = builderRecord(payload);
  const built = typeof data['built'] === 'boolean' ? data['built'] : undefined;
  const appId = built === undefined ? builderText(data['appId']) || previous.appId : builderText(data['appId']);
  return {
    name: builderText(data['name']) || previous.name,
    versionLabel: builderText(data['versionLabel']) || previous.versionLabel,
    appId,
    sectionIdByName: sectionIds(data['sectionIdByName']) || (appId !== previous.appId ? {} : previous.sectionIdByName),
    sessionId: builderText(data['sessionId']) || previous.sessionId,
    artifactId: builderText(data['artifactId']) || previous.artifactId,
    versionId: builderText(data['versionId']) || previous.versionId,
  };
}
export function buildPhase(value: unknown): BuildPhase | undefined {
  return value === 'idle' || value === 'building' || value === 'completed' || value === 'failed' ? value : undefined;
}
export function pendingBuilderEdits(value: unknown): PendingBuilderEdit[] {
  return fileArray(value)
    .filter(isFileRecord)
    .map(edit => ({
      module: builderText(edit['module']),
      card: builderText(edit['card']),
      text: builderText(edit['text']),
    }));
}
export function createdCustomPages(value: unknown): CreatedCustomPage[] {
  // Keep empty slots so a later custom-page-built index still identifies the same page.
  return fileArray(value).map(page => {
    const data = builderRecord(page);
    return { name: builderText(data['name']), pageId: builderText(data['pageId']) };
  });
}
export function customPageIndex(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}
