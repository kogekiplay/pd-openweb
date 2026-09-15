import { getTranslateInfo } from 'src/utils/app';

const getTranslatedName = (appId: string, id, originalName) => getTranslateInfo(appId, null, id).name || originalName;

const translateObjectName = (appId: string, obj, idKey: string, nameKey: string) => {
  obj[nameKey] = getTranslatedName(appId, obj[idKey], obj[nameKey]);
};

const translateArrayNames = (appId: string, array, idKey: string, nameKey: string) => {
  (array || []).forEach(item => translateObjectName(appId, item, idKey, nameKey));
};

// 翻译工作表相关信息
export const fillTranslateInfo = (appId: string, roleDetail = {}) => {
  (roleDetail.sheets || []).forEach(sheet => {
    translateObjectName(appId, sheet, 'sheetId', 'sheetName');
    translateArrayNames(appId, sheet.views, 'viewId', 'viewName');
    translateArrayNames(appId, sheet.fields, 'fieldId', 'fieldName');
  });
  translateArrayNames(appId, roleDetail.pages, 'pageId', 'name');
  translateArrayNames(appId, roleDetail.chatbots, 'id', 'name');
};
