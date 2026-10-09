import _ from 'lodash';
import agentApi from 'src/api/agent';
import appManagementApi from 'src/api/appManagement';
import homeAppApi from 'src/api/homeApp';
import { getAppLangCode } from 'src/common/langConfig';
import { DEFAULT_CONFIG, WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import { genBotSessionId } from 'src/utils/agentSession';
import {
  decodeAppLangInfo,
  decodeAppLanguageDetail,
  decodeAppLanguages,
  decodeDescriptionResponse,
  decodeTranslationData,
  isTranslateInfo,
} from './appTypes';
import type {
  AppLanguageCache,
  AppLanguageDetail,
  AppLanguageSource,
  AppSection,
  AppSectionItem,
  DescriptionContext,
  DescriptionRequest,
  DescriptionResponse,
  SharedLanguageSource,
  TranslationId,
  TranslationIndex,
} from './appTypes';

export const PUBLIC_APP_BASE_LANG = '_base_';

export const getWidgetTypeName = (
  type: number | undefined,
): { controlTypeName: string | undefined; controlType: string } => {
  const widgetType = _.findKey(WIDGETS_TO_API_TYPE_ENUM, value => value === type);

  const name: unknown = _.get(DEFAULT_CONFIG, `${widgetType}.widgetName`);
  return { controlTypeName: typeof name === 'string' ? name : undefined, controlType: String(widgetType) };
};

/** 入参既可能直接是分组数组，也可能是带 sections 的应用详情对象 —— 两种都收 */
export const getExistWorksheet = (data: AppSection[] | { sections?: AppSection[] | undefined } = {}) => {
  const existWorksheet: { name?: string | undefined; description?: string | undefined; type: 'page' | 'table' }[] = [];
  const sections: AppSection[] = Array.isArray(data) ? data : data.sections || [];

  const pushWorksheet = (item: AppSectionItem) => {
    existWorksheet.push({
      name: item.workSheetName || item.name,
      description: item.remark,
      type: item.type === 1 ? 'page' : 'table',
    });
  };

  const walkSections = (sectionList: AppSection[]) => {
    (sectionList || []).forEach(section => {
      (section.item || []).forEach(pushWorksheet);

      (section.workSheetInfo || []).forEach(item => {
        if (item.type === 2) {
          const childSection = (section.childSections || []).find(child => child.appSectionId === item.workSheetId);

          if (childSection) {
            walkSections([childSection]);
          }
        } else {
          pushWorksheet(item);
        }
      });
    });
  };

  walkSections(sections);

  return existWorksheet;
};

export const generateAppOrWorksheetDescription = async ({
  name = '',
  description = '',
  isApp = true,
  data = {},
}: DescriptionRequest): Promise<DescriptionResponse> => {
  const param: DescriptionContext = {
    userLanguage: window.getCurrentLang() || 'zh-Hans',
  };

  if (isApp) {
    param.appName = name || data.name;
    param.groups = JSON.stringify({
      appName: name || data.name,
      description: description || data.desc,
      existWorksheet: getExistWorksheet({ sections: data.sections }),
    });
  } else {
    param.tableName = name || data.name;
    param.tableDescription = description || data.description;
    param.fields = JSON.stringify(
      (data.template?.controls || []).map(item => {
        return {
          controlName: item.controlName,
          type: getWidgetTypeName(item.type).controlTypeName,
        };
      }),
    );
  }

  const result: unknown = await agentApi.agentExecute(
    {
      agentName: isApp ? 'app-description-generator' : 'worksheet-description-generator',
      sessionId: genBotSessionId(),
      message: _l('开始'),
      context: param,
    },
    { silent: true },
  );
  return decodeDescriptionResponse(result);
};

const langDataIndexCache = new WeakMap<TranslationItemArray, TranslationIndex>();
type TranslationItemArray = unknown[];
const languageCache: AppLanguageCache = window;

/**
 * 设置应用的 favicon。
 * @param {string} iconUrl - 图标的 URL。
 * @param {string} iconColor - 用于设置图标的颜色。
 */
export const setFavicon = (iconUrl?: string | null, iconColor?: string | null) => {
  if (!iconUrl) return;
  fetch(iconUrl)
    .then(res => res.text())
    .then(data => {
      if (iconColor) {
        if (iconUrl.indexOf('_preserve.svg') === -1) {
          data = data.replace(/fill=".*?"/g, '').replace(/<svg/, `<svg fill="${iconColor}"`);
        } else {
          data = data.replace(/<svg/, `<svg fill="${iconColor}"`);
        }
      }

      $('[rel="icon"]').attr('href', `data:image/svg+xml;base64,${btoa(data)}`);
    })
    .catch(() => {});
};

const getLangDataIndex = (rawData: unknown[]): TranslationIndex => {
  const langData = rawData;
  const cache = langDataIndexCache.get(langData);

  if (cache && cache.length === langData.length) {
    return cache;
  }

  const correlationIdMap: TranslationIndex['correlationIdMap'] = new Map();
  const parentIdMap: TranslationIndex['parentIdMap'] = new Map();

  const entries = decodeTranslationData(langData);
  if (!Array.isArray(entries)) throw new TypeError('Translation index requires an array');
  entries.forEach(item => {
    if (!item) return;

    const { correlationId, parentId } = item;

    if (!correlationIdMap.has(correlationId)) {
      correlationIdMap.set(correlationId, item);
    }

    if (!parentIdMap.has(parentId)) {
      parentIdMap.set(parentId, new Map());
    }

    const parentMap = parentIdMap.get(parentId)!;

    if (!parentMap.has(correlationId)) {
      parentMap.set(correlationId, item);
    }
  });

  const index = {
    length: langData.length,
    correlationIdMap,
    parentIdMap,
  };

  langDataIndexCache.set(langData, index);
  return index;
};

/**
 * 获取翻译数据
 * @param {*} appId 应用id
 * @param {*} parentId 父级id (应用项id)
 * @param {*} id 项目id (应用项id、分组id、视图id、...)
 * @param {*} data 翻译包数据
 * @returns { name、description、hintText、... }
 */
/**
 * 一条翻译记录的内容：字段名 → 译文。
 *
 * 用索引签名而不是穷举字段：字段集合随对象类型而变（控件有 name / hintText /
 * otherhint，按钮有 btnname / confirmMsg / sureName，标签页有 deftabname …），
 * 穷举会在后端新增字段时【静默漏掉】。
 *
 * 标这个返回类型的收益不在本文件：装上 @types/lodash 后，第 169 行的 _.find
 * 有了真实返回类型，info.data || {} 被推成 {}，于是全仓几十处
 * getTranslateInfo(...).title / .sub / .btnname 一律报 TS2339。
 * 在源头标一次，下游全部消解。
 */
/**
 * 某个实体（应用 / 工作表 / 视图 / 字段 / 按钮…）在当前语言下的译文表：字段名 → 译文。
 * 键集合按实体类型不同而不同，所以保留索引签名；下面列的是全仓按点访问过的键（2026-09-23 统计），
 * 终点配置（noPropertyAccessFromIndexSignature）下点访问必须是已声明的键。查不到译文时这些键就是 undefined，
 * 调用方一律写成 info.name || 原文。
 */
export interface TranslateInfo {
  /** 动作/字段/导航及表单提示的翻译字段，translate.ts 按模块实际消费。 */
  prefix?: string | undefined;
  defaultTabName?: string | undefined;
  message?: string | undefined;
  otherhint?: string | undefined;
  name?: string;
  description?: string;
  recordName?: string;
  nodename?: string;
  title?: string;
  mobileTitle?: string;
  hintText?: string;
  btndescmap?: string;
  sureName?: string;
  remark?: string;
  confirmMsg?: string;
  confirmContent?: string;
  cancelName?: string;
  createBtnName?: string;
  summaryName?: string;
  formTitle?: string;
  formSub?: string;
  formContinue?: string;
  completeText?: string;
  ydisplayTitle?: string;
  targetValueName?: string;
  suffix?: string;
  sendmessage?: string;
  rightYdisplayTitle?: string;
  rightYSummaryName?: string;
  [key: string]: string | undefined;
}

export const getTranslateInfo = (
  appId: string,
  parentId: TranslationId,
  id: TranslationId,
  data?: unknown,
): TranslateInfo => {
  const langData: unknown = data || languageCache[`langData-${appId}`] || [];

  if (!Array.isArray(langData)) {
    const entries = decodeTranslationData(langData);
    const info = Object.values(entries).find(
      item =>
        item !== null && item !== undefined && item.correlationId === id && (!parentId || item.parentId === parentId),
    );
    if (!info?.data) return {};
    if (!isTranslateInfo(info.data)) throw new TypeError('Invalid consumed translation dictionary');
    return info.data;
  }

  if (!langData.length) return {};

  const { correlationIdMap, parentIdMap } = getLangDataIndex(langData);
  const parentMap = parentId ? parentIdMap.get(parentId) : null;
  const info = parentId ? parentMap && parentMap.get(id) : correlationIdMap.get(id);

  if (!info?.data) return {};
  if (!isTranslateInfo(info.data)) throw new TypeError('Invalid consumed translation dictionary');
  return info.data;
};

/**
 * 获取应用的翻译包数据
 */
export const getAppLangDetail = async (appDetail: AppLanguageSource): Promise<AppLanguageDetail | undefined> => {
  const { langInfo } = appDetail;
  const appId = appDetail.id;
  if (!appId) return undefined;
  if (langInfo && langInfo.appLangId && langInfo.version !== languageCache[`langVersion-${appId}`]) {
    const response: unknown = await appManagementApi.getAppLangDetail({
      projectId: appDetail.projectId,
      appId,
      appLangId: langInfo.appLangId,
    });
    const lang = decodeAppLanguageDetail(response);
    languageCache[`langData-${appId}`] = lang.items;
    languageCache[`langVersion-${appId}`] = langInfo.version;
    return lang;
  }
  return undefined;
};

/**
 * 按 appId 按需加载应用翻译包
 * 仅加载「当前应用」之外的语言包（如跨应用打开关联记录），保证 getTranslateInfo / replaceControlsTranslateInfo 能命中缓存
 */
export const ensureAppLangData = async (appId: string) => {
  if (!appId || languageCache[`langData-${appId}`]) return;

  // 公开分享 / 公开表单等未登录态由 shareGetAppLangDetail 处理，避免在此调用需鉴权接口
  const isPublic =
    _.get(window, 'shareState.shareId') ||
    _.get(window, 'shareState.isPublicForm') ||
    _.get(window, 'shareState.isPublicWorkflowRecord');

  if (isPublic || !_.get(window, 'md.global.Account.accountId')) return;

  try {
    const response: unknown = await homeAppApi.getAppLangInfo({ appId });
    const langInfo = decodeAppLangInfo(response);

    if (langInfo && langInfo.appLangId && langInfo.version !== languageCache[`langVersion-${appId}`]) {
      const response: unknown = await appManagementApi.getAppLangDetail({
        appId,
        appLangId: langInfo.appLangId,
        projectId: langInfo.projectId,
      });
      const lang = decodeAppLanguageDetail(response);
      languageCache[`langData-${appId}`] = lang.items;
      languageCache[`langVersion-${appId}`] = langInfo.version;
    }
  } catch (err) {
    // 加载失败时退回原文，不阻塞记录打开
    console.error(err);
  }
};

export const shareGetAppLangDetail = async (source: SharedLanguageSource): Promise<AppLanguageDetail | undefined> => {
  const appLang = new URL(location.href).searchParams.get('app_lang');
  const isBaseLang = appLang === PUBLIC_APP_BASE_LANG;
  const langKey = isBaseLang ? '' : appLang || getAppLangCode(getCurrentLang());
  const { appId, projectId, worksheetId } = source;
  if (!appId) return undefined;
  const response: unknown = await appManagementApi.getAppLangs({
    appId,
    projectId,
    ...(worksheetId ? { worksheetId } : {}),
  });
  const languages = decodeAppLanguages(response);
  languageCache[`appLangs-${appId}`] = languages;
  if (isBaseLang) {
    delete languageCache[`langData-${appId}`];
    delete languageCache[`langVersion-${appId}`];
    return undefined;
  }
  const langInfo = languages.find(item => item.langCode === langKey);
  if (!langInfo || !langInfo.id) return undefined;
  const detailResponse: unknown = await appManagementApi.getAppLangDetail({
    appId,
    projectId,
    appLangId: langInfo.id,
    ...(worksheetId ? { worksheetId } : {}),
  });
  const lang = decodeAppLanguageDetail(detailResponse);
  languageCache[`langData-${appId}`] = lang.items;
  return lang;
};
