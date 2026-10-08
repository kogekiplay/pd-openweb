import { VersionProductType } from 'src/utils/enum';

export interface SandboxSyncEntity {
  worksheetId: string;
  count: number | 'all';
  totalRecordNum: number;
  isAll?: boolean | undefined;
  isCustom?: boolean | undefined;
}
export interface SandboxAppSettings {
  appId: string;
  exampleType: number;
  selectedCount: number;
  sandboxDataExists?: boolean | undefined;
  entities: SandboxSyncEntity[];
}
export interface SandboxAppSource<E extends { worksheetId: string; count: number } = { worksheetId: string; count: number }> {
  appId: string;
  entities?: E[] | undefined;
}
export const MAX_SYNC_COUNT_PER_SHEET = 10000;
export const MAX_SYNC_COUNT_PER_APP = 50000;
export const SANDBOX_LIST_ORDER = { ASC: 4, DESC: 3 };
const SANDBOX_FEATURE_HOSTNAMES = new Set(['localhost', 'web.dev.mingdao.net', 'sandbox.mingdao.com', 'appsandbox3.mingdao.com']);

function getSelectedSyncCount(entities: SandboxSyncEntity[] = []): number {
  return entities.reduce((total, entity) => {
    const count = entity.count === 'all' ? entity.totalRecordNum : entity.count;
    return total + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);
}
export function isDataSyncSettingsDisabled(list: Pick<SandboxAppSettings, 'exampleType' | 'selectedCount'>[] = []): boolean {
  return list.some(item => item.exampleType === 2 && item.selectedCount > MAX_SYNC_COUNT_PER_APP);
}
export function getSandboxDataExistingAppIds(result: unknown, appIds: string[] = []): string[] {
  const data = result && typeof result === 'object' && 'data' in result ? result.data ?? result : result;
  if (typeof data === 'boolean') return data ? appIds : [];
  if (Array.isArray(data)) {
    if (data.every(item => typeof item === 'boolean')) return appIds.filter((_appId, index) => data[index]);
    return data.reduce<string[]>((ids, item: unknown) => {
      if (typeof item === 'string') return ids.concat(item);
      if (!item || typeof item !== 'object') return ids;
      const entry = item as Record<string, unknown>;
      const appId = entry['appId'] || entry['id'] || entry['key'];
      const exists = entry['exists'] ?? entry['isExists'] ?? entry['dataExists'] ?? entry['hasData'] ?? entry['value'] ?? true;
      return typeof appId === 'string' && exists ? ids.concat(appId) : ids;
    }, []);
  }
  if (!data || typeof data !== 'object') return [];
  const entry = data as Record<string, unknown>;
  const existingAppIds = entry['appIds'] || entry['existingAppIds'];
  if (Array.isArray(existingAppIds)) return getSandboxDataExistingAppIds(existingAppIds, appIds);
  return appIds.filter(appId => Boolean(entry[appId]));
}
export function updateAppDataSyncType<T extends SandboxAppSettings>(list: T[] = [], appId: string, exampleType: number): T[] {
  return list.map(item => item.appId === appId ? { ...item, exampleType } : item);
}
export function updateEntitySyncCount<T extends SandboxAppSettings>(list: T[] = [], appId: string, worksheetId: string, selection: number | 'all' | { count: number | 'all'; isCustom?: boolean | undefined }): T[] {
  return list.map(item => {
    if (item.appId !== appId) return item;
    const entities = (item.entities || []).map(entity => {
      if (entity.worksheetId !== worksheetId) return entity;
      const count = typeof selection === 'object' ? selection.count : selection;
      if (count === 'all') {
        const isAll = entity.totalRecordNum <= MAX_SYNC_COUNT_PER_SHEET;
        return { ...entity, count: Math.min(entity.totalRecordNum, MAX_SYNC_COUNT_PER_SHEET), isAll, isCustom: !isAll };
      }
      return { ...entity, count, isAll: false, isCustom: typeof selection === 'object' ? Boolean(selection.isCustom) : count === -1 };
    });
    return { ...item, entities, selectedCount: getSelectedSyncCount(entities) };
  });
}
export function normalizeSandboxAppSettings<E extends { worksheetId: string; count: number }, T extends SandboxAppSource<E>>(apps: T[] = [], sandboxDataExistingAppIds: string[] = []): Array<Omit<T, 'entities'> & SandboxAppSettings & { entities: Array<E & SandboxSyncEntity> }> {
  const existingIds = new Set(sandboxDataExistingAppIds);
  return apps.map(app => ({
    ...app,
    exampleType: 0,
    selectedCount: 0,
    sandboxDataExists: existingIds.has(app.appId),
    entities: (app.entities || []).map(entity => ({ ...entity, count: 0, totalRecordNum: entity.count })),
  }));
}
export const buildSandboxEnableParams = (item: Pick<SandboxAppSettings, 'appId' | 'exampleType' | 'entities'>) => ({
  appId: item.appId,
  exampleType: item.exampleType,
  sheetConfig: (item.entities || []).map(entity => ({ sheeId: entity.worksheetId, count: typeof entity.count === 'number' && entity.count > 0 ? entity.count : 0 })),
});
export const isSandboxSupportedProject = (projectId: string): boolean => {
  const projects = md.global.Account?.projects as Array<{ projectId: string; version?: { versionIdV2?: string | undefined } | undefined }>;
  const project = (projects || []).find(item => item.projectId === projectId);
  const versions = md.global.Versions as Array<{ VersionIdV2?: string | undefined; Products?: Array<{ ProductType: number; Type: string }> | undefined }>;
  const version = (versions || []).find(item => item.VersionIdV2 === project?.version?.versionIdV2);
  return (version?.Products || []).find(item => item.ProductType === VersionProductType.appSandbox)?.Type === '1';
};
export const isAppSandboxEnabled = (sandboxStatus?: number): boolean => sandboxStatus === 2;
export const isSandboxEnvironment = (): boolean => Boolean((md.global.Config as typeof md.global.Config & { IsAppSandbox?: boolean | undefined }).IsAppSandbox);
export const isSandboxFeatureEnvironment = (hostname?: string): boolean => {
  const currentHostname = hostname || (typeof window === 'undefined' ? '' : window.location.hostname);
  return SANDBOX_FEATURE_HOSTNAMES.has(currentHostname.toLowerCase());
};
export const getPeerEnvironmentUrl = (path?: string): string => {
  const peerWebUrl = (md.global.Config as typeof md.global.Config & { PeerWebUrl?: string | undefined }).PeerWebUrl;
  if (!peerWebUrl) return '';
  const normalizedUrl = peerWebUrl.replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return normalizedPath ? `${normalizedUrl}/${normalizedPath}` : normalizedUrl;
};
export const openPeerEnvironment = (path?: string): boolean => {
  const url = getPeerEnvironmentUrl(path);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};
export const isAppSandboxInProduction = (sandboxStatus?: number): boolean => isAppSandboxEnabled(sandboxStatus) && !isSandboxEnvironment();
