export { getMaxControlsCount } from 'src/pages/widgetConfig/config/index';
export { getMapConfig } from 'src/utils/control';

export const getAppTimeZone = (appId: string): number | undefined => window[`timeZone_${appId}`];
export const getAttachmentRuntimeConfig = () => ({
  documentHost: md.global.FileStoreConfig.documentHost,
  isLocal: window.platformENV.isOverseas || window.platformENV.isLocal,
  pictureHost: md.global.FileStoreConfig.pictureHost,
});
export const getSubListSheetMode = (controlId: string): 'new' | 'relate' | undefined => {
  const config = window['subListSheetConfig'] as Record<string, { mode?: 'new' | 'relate' | undefined }> | undefined;
  return config?.[controlId]?.mode;
};
export const hasAppLangData = (appId: string): boolean => Boolean(window[`langData-${appId}`]);
export const isPortalAccount = (): boolean => Boolean(md.global.Account.isPortal);
