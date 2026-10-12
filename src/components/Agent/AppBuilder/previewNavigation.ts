import type { CustomPagePreview, WorksheetPreview } from './builderState';
import { isFileRecord } from './fileTypes';

export interface PreviewUrlOptions {
  appId?: string | undefined;
  sectionIdByName?: Readonly<Record<string, string>> | undefined;
  latestWorksheet?: WorksheetPreview | null | undefined;
  latestCustomPage?: CustomPagePreview | null | undefined;
  previewNonce?: number | undefined;
  appLanguage?: string | undefined;
}
export function buildPreviewUrl(
  activeKey: string,
  { appId, sectionIdByName, latestWorksheet, latestCustomPage, previewNonce, appLanguage }: PreviewUrlOptions,
): string {
  if (!appId) return '';
  const withLang = appLanguage ? `&sys_lang=${encodeURIComponent(appLanguage)}` : '';
  const withRp = (path: string) => `${path}?rp=no${withLang}`;
  const withRefresh = (path: string) => `${withRp(path)}${previewNonce ? `&_r=${previewNonce}` : ''}`;
  switch (activeKey) {
    case 'roles':
      return withRp(`/app/${appId}/role`);
    case 'workflows':
      return withRp(`/app/${appId}/workflow`);
    case 'worksheets': {
      if (latestWorksheet?.worksheetId && latestWorksheet.sectionId)
        return withRp(`/app/${appId}/${latestWorksheet.sectionId}/${latestWorksheet.worksheetId}`);
      const firstSection = Object.values(sectionIdByName || {})[0];
      return withRp(firstSection ? `/app/${appId}/${firstSection}` : `/app/${appId}`);
    }
    case 'customPages':
      if (latestCustomPage?.pageId && latestCustomPage.sectionId)
        return withRefresh(`/app/${appId}/${latestCustomPage.sectionId}/${latestCustomPage.pageId}`);
      return withRefresh(`/app/${appId}`);
    default:
      return withRefresh(`/app/${appId}`);
  }
}
export function withPreviewMode(path: string): string {
  if (!path || /[?&]previewMode=ai(?:&|$)/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}previewMode=ai`;
}
export interface PreviewWindow {
  location: { pathname: string; search: string };
  reactRouterHistory?: unknown;
  updateAppGroups?: unknown;
}
export function navigateInFrame(
  win: PreviewWindow | null,
  path: string,
  refreshFirst = false,
  isCurrent: () => boolean = () => true,
): boolean {
  try {
    if (!win || !isFileRecord(win.reactRouterHistory)) return false;
    const history = win.reactRouterHistory;
    const method = history['push'];
    if (typeof method !== 'function') return false;
    const push = (): boolean => {
      if (!isCurrent()) return false;
      try {
        const current = win.location.pathname + win.location.search;
        if (current !== path) Reflect.apply(method, history, [path]);
        return true;
      } catch {
        return false;
      }
    };
    const refresh = () =>
      typeof win.updateAppGroups === 'function' ? Reflect.apply(win.updateAppGroups, win, []) : undefined;
    if (refreshFirst) {
      const result: unknown = refresh();
      if (result !== null && typeof result === 'object' && 'then' in result && typeof result.then === 'function')
        void Promise.resolve(result).then(push, push);
      else if (!push()) return false;
    } else {
      if (!push()) return false;
      refresh();
    }
    return true;
  } catch {
    return false;
  }
}
