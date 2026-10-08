export { addSubPathOfRoutes, getCurrentSubPath, getPathWithoutSubPath, addSubPathOfRoute, pathCompletion } from 'src/utils/common';

export const toMainSiteUrl = <T extends string | null | undefined>(url: T): T | string => {
  const webUrl = md.global.Config.WebUrl;
  return url && webUrl ? url.replace(/^https?:\/\/[^/]+/, new URL(webUrl).origin) : url;
};
export const getAccountPersonalUrl = (query = ''): string => {
  const config = md.global.Config as typeof md.global.Config & { AccountWebUrl?: string | undefined };
  const baseUrl = (config.AccountWebUrl || '').replace(/\/$/, '');
  const url = baseUrl ? `${baseUrl}/personal` : 'personal';
  return query ? `${url}?${query}` : url;
};
