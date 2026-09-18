import _, { get } from 'lodash';
import moment from 'moment';
import accountAjax from 'src/api/account';
import actionLogAjax from 'src/api/actionLog';
import projectAjax from 'src/api/project';
import { SYS_CHART_COLORS, SYS_COLOR } from 'src/pages/Admin/settings/config';

// 获取当前网络信息
// id 的调用点里既有 string，也有 localStorage.getItem 的 string | null，
// 还有从 query 里解出来的 string | string[]（那种匹配不上，返回 {}）
export const getCurrentProject = (id?: string | string[] | null, isExternalProject?: boolean) => {
  if (!id) return {};

  const externalProjects = _.get(md, ['global', 'Account', 'externalProjects']) || [];
  const projects = (_.get(md, ['global', 'Account', 'projects']) || []).concat(
    isExternalProject ? externalProjects : [],
  );
  let info = _.find(projects, item => item.projectId === id);

  if (!info && isExternalProject) {
    return getSyncLicenseInfo(id);
  }

  return info || {};
};

/**
 * 调用 app 内的方式
 */
export function mdAppResponse(param) {
  return new Promise(resolve => {
    // 注册监听
    window.MD_APP_RESPONSE = base64 => {
      const decodedData = window.atob(base64);
      resolve(JSON.parse(decodeURIComponent(escape(decodedData))));
    };

    // 触发监听的回调函数
    const string = JSON.stringify(param);
    const base64 = window.btoa(string);

    if (window.isMacOs) {
      window.webkit?.messageHandlers?.MD_APP_REQUEST?.postMessage(base64);
    } else {
      window.Android.MD_APP_REQUEST(base64);
    }
  });
}

/**
 * 获取网络信息
 */
// projectId 和 getFeatureStatus 同理：下面那行 UUID 正则就是用来挡非法入参的，
// 匹配不上直接返回 {}。调用方里有从 query 解出来的 string | string[]。
export const getSyncLicenseInfo = (projectId: string | string[] | null | undefined) => {
  const { projects = [], externalProjects = [] } = md.global.Account;
  let projectInfo = _.find(projects.concat(externalProjects), o => o.projectId === projectId) || {};

  if (_.isEmpty(projectInfo)) {
    if (
      window.isPublicApp ||
      !/^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/.test(String(projectId))
    ) {
      return {};
    }

    const info = projectAjax.getProjectLicenseInfo({ projectId }, { ajaxOptions: { sync: true } });

    projectInfo = { ...info, projectId };
    md.global.Account.externalProjects = (md.global.Account.externalProjects || []).concat(projectInfo);
  }

  return projectInfo;
};

/**
 *  获取功能状态 1: 正常 2: 升级
 */
// projectId 允许为 undefined：下面那行 UUID 正则本来就是用来挡非法入参的，
// undefined 过不了正则、直接早返回。多处调用方的 projectId 就是可选的。
export function getFeatureStatus(projectId: string | undefined, featureId) {
  if (window.shareState.shareId) return;
  if (!/^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/.test(projectId)) return;

  const { Versions = [] } = md.global || {};
  const { version = { versionIdV2: '-1' } } = getSyncLicenseInfo(projectId);
  const versionInfo = _.find(Versions || [], item => item.VersionIdV2 === version.versionIdV2) || {};

  return (_.find(versionInfo.Products || [], item => item.ProductType === featureId) || {}).Type;
}

/**
 * 添加行为日志。
 * @param {string} type - 日志类型，可选值为 'app', 'worksheet', 'customPage', 'worksheetRecord', 'printRecord',
 * 'printWord', 'pintTemplate', 'printQRCode', 'printBarCode', 'batchPrintWord', 'previewFile', 'decode'。
 * @param {string} entityId - 实体 ID。(根据访问类型不同， 传不同模块id：浏览应用，entityId =应用id，
 * 浏览自定义页面，entityId = 页面id。其他的浏览行为 =worksheetId）
 * @param {Object} params - 额外的参数，用于记录日志的详细信息。
 * @param {boolean} isLinkVisited - 是否通过链接访问
 */
export const addBehaviorLog = (type, entityId, params: Record<string, unknown> = {}, isLinkVisited?) => {
  if (!get(md, 'global.Account.accountId')) return;

  const typeObj = {
    app: 1, // 应用
    worksheet: 2, // 工作表
    customPage: 3, // 自定义页面
    worksheetRecord: 4, // 工作表记录
    printRecord: 5, // 打印了记录
    printWord: 6, // 使用了word模板打印
    pintTemplate: 7, // 使用了模板打印了记录
    printQRCode: 8, // 打印了二维码
    printBarCode: 9, // 打印了条形码
    batchPrintWord: 10, // 批量word打印
    previewFile: 11, // 文件预览
    worksheetDecode: 12, // 工作表解码(字段只读状态下记日志，包含H5记录呈现态)
    worksheetBatchDecode: 13, // 工作表批量解码
    robot: 20, // 对话机器人
  };

  if ((type === 'worksheetDecode' && !params.rowId) || (type === 'worksheetDecode' && !params.controlId)) return;

  const addBehaviorLogInfo = sessionStorage.getItem('addBehaviorLogInfo')
    ? safeParse(sessionStorage.getItem('addBehaviorLogInfo'), null)
    : undefined;

  if (isLinkVisited && _.isEqual(addBehaviorLogInfo, { type, entityId, params })) {
    return;
  }

  sessionStorage.setItem('addBehaviorLogInfo', JSON.stringify({ type, entityId, params }));

  // 调用 actionLogAjax.addLog 方法记录行为日志
  actionLogAjax
    .addLog({ type: typeObj[type], entityId, params })
    .then(res => {
      if (res && !(type === 'app' && !isLinkVisited) && !(type === 'worksheet' && !isLinkVisited)) {
        sessionStorage.removeItem('addBehaviorLogInfo');
      }
    })
    .catch(() => {
      sessionStorage.removeItem('addBehaviorLogInfo');
    });
};

/**
 * 获取组织管理颜色配置。
 * @param {string} projectId - 网络ID
 * @returns {Object} - 包含图表颜色和主题颜色配置的对象。
 */
export const getProjectColor = (projectId: string) => {
  const { PorjectColor, Account } = md.global;
  const { projects = [] } = Account;
  const currentProjectId = localStorage.getItem('currentProjectId');
  const id = projectId || currentProjectId || _.get(projects[0], 'projectId');
  const data = _.find(PorjectColor, { projectId: id });

  if (data) {
    const mapColor = colors =>
      colors.map(item => {
        const data = _.find(SYS_CHART_COLORS, { id: item.id });
        return {
          ...data,
          enable: item.enable,
        };
      });
    data.chartColor.system = _.isEmpty(data.chartColor.system) ? SYS_CHART_COLORS : mapColor(data.chartColor.system);
    data.themeColor.system = _.isEmpty(data.themeColor.system) ? SYS_COLOR : data.themeColor.system;

    return data;
  } else {
    return {
      chartColor: {
        custom: [],
        system: SYS_CHART_COLORS,
      },
      themeColor: {
        custom: [],
        system: SYS_COLOR,
      },
    };
  }
};

/**
 * 获取组织管理主题色。
 * @param {string} projectId - 网络ID
 * @returns {[]} - 包含系统色和自定义色的颜色数组。
 */
export const getThemeColors = (projectId: string) => {
  // 获取项目颜色配置
  const { themeColor } = getProjectColor(projectId);
  // 过滤并映射系统色，去除未启用的项
  const systemColorList = (themeColor.system || []).filter(item => item.enable !== false).map(item => item.color);
  // 过滤并映射自定义色，去除未启用的项
  const customColorList = (themeColor.custom || []).filter(item => item.enable !== false).map(item => item.color);
  // 合并系统色和自定义色的颜色数组
  return systemColorList.concat(customColorList);
};

/**
 * 获取时区
 */
export const getTimeZone = () => {
  const serverZone = md.global.Config.DefaultTimeZone; // 服务器时区
  const userZone = md.global.Account.timeZone === 1 ? new Date().getTimezoneOffset() * -1 : md.global.Account.timeZone; // 用户时区

  return { serverZone, userZone };
};

/**
 * 日期时间转为用户时区时间
 */
export const dateConvertToUserZone = date => {
  if (!date) return '';

  const { serverZone, userZone } = getTimeZone();

  return moment(date)
    .add(userZone - serverZone, 'm')
    .format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 日期时间转为服务器时区时间
 */
export const dateConvertToServerZone = date => {
  if (!date) return '';

  const { serverZone, userZone } = getTimeZone();

  return moment(date)
    .add(serverZone - userZone, 'm')
    .format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 日期时间应用时区转为服务器时区时间
 */
export const dateAppZoneToServerZone = (date, appTimeZone) => {
  if (!date) return '';
  if (!appTimeZone) return date;

  const { serverZone } = getTimeZone();

  return moment(date)
    .add(serverZone - appTimeZone, 'm')
    .format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 服务器时区转应用时区呈现
 */
export const dateServerZoneToAppZone = (date, appTimeZone) => {
  if (!date) return '';
  if (!appTimeZone) return date;

  const { serverZone } = getTimeZone();

  return moment(date)
    .add(appTimeZone - serverZone, 'm')
    .format('YYYY-MM-DD HH:mm:ss');
};

/** 缓存是否还能用（用户没换、掩码过的值和缓存对得上） */
function contactInfoIsFresh(contactInfo, key?: string) {
  if (_.isEmpty(contactInfo)) return false;
  if (contactInfo.accountId !== md.global.Account.accountId) return false;

  // 掩码校验：Account 里存的是 138****5678 这种打码值，拿缓存里的明文按位填回去应当相等。
  // 不相等说明用户在别处改了手机号/邮箱，缓存过期了。只有传了 key 才有得比。
  if (key && contactInfo[key] && md.global.Account[key]) {
    const restored = md.global.Account[key].replace(/\*/g, (a, b) => contactInfo[key][b]);
    if (restored !== contactInfo[key]) return false;
  }

  return true;
}

/** 后台取一次联系方式并写回 localStorage。并发调用只跑一次。 */
let contactInfoRequest: Promise<Record<string, unknown>> | null = null;

// 返回的是后端给的联系方式对象，本仓只把它整个塞进 localStorage，不读具体字段
export const prefetchContactInfo = (): Promise<Record<string, unknown>> => {
  if (!md.global.Account.accountId) return Promise.resolve({});
  if (contactInfoRequest) return contactInfoRequest;

  contactInfoRequest = accountAjax
    .getMyContactInfo({}, { silent: true })
    .then(data => {
      if (data) safeLocalStorageSetItem('contactInfo', JSON.stringify(data));
      return data || {};
    })
    .catch(() => ({}))
    .finally(() => {
      contactInfoRequest = null;
    });

  return contactInfoRequest;
};

/**
 * 取当前账号的联系方式（手机号 / 邮箱），给表单算默认值用。
 *
 * 【原先是同步 XHR】缓存没命中就 `{ ajaxOptions: { sync: true } }` 现拉一次，
 * 主线程同步请求已被废弃，控制台每次都报
 * "Synchronous XMLHttpRequest on the main thread is deprecated"。
 *
 * 【为什么可以去掉而不改调用方】4 个调用方（formUtils 里算表单默认值）都要求同步拿到字符串，
 * 签名不能动。但这个值是【每个账号一份、基本不变】的，所以改成：
 *   · 缓存新鲜 -> 直接返回（和以前一样，绝大多数情况都走这条）
 *   · 缓存过期 -> 【先把旧值返回去】，同时后台刷新
 *   · 完全没有缓存 -> 返回 ''，并在后台取
 * 而 preall 启动时会 await prefetchContactInfo()（见那边的调用点），
 * 所以正常进入任何表单之前缓存一定是热的，第三条分支实际走不到。
 */
export const getContactInfo = key => {
  const contactInfo = safeParse(window.localStorage.getItem('contactInfo') || '{}');

  if (!md.global.Account.accountId) return '';

  if (!contactInfoIsFresh(contactInfo, key)) {
    // 过期或没有：后台补，本次调用用手头的值（没有就是 ''）
    prefetchContactInfo();
    return contactInfo[key] || '';
  }

  return contactInfo[key];
};

/**
 * 兼容js sdk方法存在时调用sdk否则用原h5逻辑
 * jsFuncName 方法名
 * jsParams 参数
 * h5callBack h5处理方法
 * appCallBack app处理方法
 */
export const compatibleMDJS = (jsFuncName: string, jsParams = {}, h5callBack = () => {}, appCallBack = () => {}) => {
  if (window.isMingDaoApp && window.MDJS && window.MDJS[jsFuncName]) {
    window.MDJS[jsFuncName](jsParams);
    appCallBack();
  } else {
    h5callBack();
  }
};
