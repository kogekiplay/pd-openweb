import { setLocalStorageItemSafely } from 'src/utils/platform/storage/safe';

const getLocalStorage = (): Storage | undefined => window.localStorage;

function isMetadataObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function getDeploymentFlags(): { httpOnly: boolean | undefined; isLocal: boolean | undefined } {
  const metadata: unknown = window.md;
  const globalInfo = isMetadataObject(metadata) ? metadata['global'] : undefined;
  const config = isMetadataObject(globalInfo) ? globalInfo['Config'] : undefined;
  const httpOnly = isMetadataObject(config) ? config['HttpOnly'] : undefined;
  const isLocal = isMetadataObject(config) ? config['IsLocal'] : undefined;
  return {
    httpOnly: typeof httpOnly === 'boolean' ? httpOnly : undefined,
    isLocal: typeof isLocal === 'boolean' ? isLocal : undefined,
  };
}

/**
 * 设置 md_pss_id
 * @param {string} id
 */
export const setPssId = (id: string | null | undefined, verification = false) => {
  if (id) {
    const { httpOnly, isLocal } = getDeploymentFlags();

    if (
      verification ||
      window.isDingTalk ||
      window.isMiniProgram ||
      window.isFeiShu ||
      process.env['NODE_ENV'] === 'development' ||
      location.href.indexOf('theportal.cn') > -1 ||
      location.href.indexOf('localhost') > -1 ||
      location.href.indexOf('share.mingdao.net') > -1 ||
      (!isLocal && location.href.indexOf('mingdaoyun.cn') > -1) ||
      location.href.indexOf('open_in_browser') > -1
    ) {
      window.setCookie('md_pss_id', id);
    }

    const localStorage = getLocalStorage();

    if ((window.top !== window.self || httpOnly) && localStorage) {
      setLocalStorageItemSafely('md_pss_id', id);
    }
  }
};

/**
 * 获取 md_pss_id
 * @returns {string} md_pss_id
 */
export const getPssId = () => {
  const localStorage = getLocalStorage();
  const storagePssId = localStorage ? localStorage.getItem('md_pss_id') : '';
  const cookiePssId = window.getCookie('md_pss_id');

  return cookiePssId || storagePssId;
};

/**
 * 删除 md_pss_id
 */
export const removePssId = () => {
  window.delCookie('md_pss_id');

  const localStorage = getLocalStorage();

  if (localStorage) {
    localStorage.removeItem('md_pss_id');
  }
};
