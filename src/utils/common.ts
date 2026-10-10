import dayjs from 'dayjs';
import EventEmitter from 'events';
import JSEncrypt from 'jsencrypt';
import _, { isEmpty } from 'lodash';
import moment from 'moment';
import qs from 'query-string';
import appManagementAjax from 'src/api/appManagement';
import qiniuAjax from 'src/api/qiniu';
import webCache from 'src/api/webCache';
import { invokeLegacyCaretMethod } from './caretBoundary';
import type { CaretControl } from './caretBoundary';
import {
  decodeAuthToken,
  decodeFileTokens,
  decodeLocalPushData,
  validateFileTokenRequests,
  validateTemporaryAttachment,
} from './commonRequestBoundary';
import type {
  AbortableRequest,
  FileTokenOptions,
  FileTokenRequest,
  FileTokenResult,
  FilledRequestParams,
  LocalPushData,
  RequestBody,
  ResponseDecoder,
  TemporaryAttachment,
  TemporaryAttachmentArgs,
  TokenHttpOptions,
  TokenRequestArgs,
} from './commonRequestTypes';
import { PUBLIC_KEY } from './enum';
import RegExpValidator from './expression';
import type { CalculatedDate, FunctionDateInput } from './functionLibraryTypes';
import { mingoStorePatch, writeMingoStoreValue } from './mingoStoreBoundary';
import type { MingoGlobalStore, MingoStoreKey, MingoStoreUpdater, MingoStoreValues } from './mingoStoreTypes';
import { getPssId } from './pssId';
import { decodeKVValue, decodeTempRecordIds } from './tempRecordCache';
import type { KVOptions, KVRequest } from './tempRecordCache';
import { decodeWorksheetConfigCache, validateWorksheetConfigValue } from './worksheetConfigCache';
import type { WorksheetConfigKey, WorksheetConfigValues, WorksheetConfigWriteArgs } from './worksheetConfigCache';

export const emitter = new EventEmitter();

window.onresize = () => emitter.emit('WINDOW_RESIZE');

/** LRU 存储 */
export function saveLRUWorksheetConfig(...args: WorksheetConfigWriteArgs): void;
export function saveLRUWorksheetConfig(
  key: WorksheetConfigKey,
  id: string | undefined,
  value: WorksheetConfigValues[WorksheetConfigKey],
): void {
  if (!id) return;
  const validatedValue = validateWorksheetConfigValue(key, value);
  let data: Record<string, WorksheetConfigValues[WorksheetConfigKey]> = {};
  try {
    data = decodeWorksheetConfigCache(key, localStorage.getItem(key));
  } catch (err) {
    console.error(err);
  }
  // Updating an entry makes it the most recently written preference.
  delete data[id];
  Object.defineProperty(data, id, { value: validatedValue, enumerable: true, writable: true, configurable: true });
  const previousIds = Object.keys(data).filter(previousId => previousId !== id);
  for (const staleId of previousIds.slice(0, Math.max(0, previousIds.length - 29))) delete data[staleId];
  safeLocalStorageSetItem(key, JSON.stringify(data));
}

/** LRU 存储 */
export function clearLRUWorksheetConfig<Key extends WorksheetConfigKey>(key: Key, id: string | undefined): void {
  if (!id) return;
  let data: Record<string, WorksheetConfigValues[Key]> = {};
  try {
    data = decodeWorksheetConfigCache(key, localStorage.getItem(key));
  } catch (err) {
    console.error(err);
  }
  delete data[id];
  safeLocalStorageSetItem(key, JSON.stringify(data));
}

/** LRU 读取 */
export function getLRUWorksheetConfig<Key extends WorksheetConfigKey>(
  key: Key,
  id: string | undefined,
): WorksheetConfigValues[Key] | undefined {
  if (!id) return undefined;
  try {
    const data = decodeWorksheetConfigCache(key, localStorage.getItem(key));
    return Object.hasOwn(data, id) ? data[id] : undefined;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

/**
 * 后端 key value 存储服务
 * 存
 */
export function KVSet(key: string, value: string, { expireTime }: KVOptions = {}): KVRequest {
  return webCache.add({
    key,
    value,
    moduleType: 2,
    expireTime: expireTime || moment(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).format('YYYY-MM-DD HH:mm:ss'),
  });
}

export const debouncedKVSet = _.debounce(KVSet, 1000);

/**
 * 后端 key value 存储服务
 * 取
 */

export function KVGet(key: string): Promise<string> {
  return webCache.get({ key, moduleType: 2 }).then((reply: unknown) => decodeKVValue(reply));
}

/**
 * 后端 key value 存储服务
 * 清空
 */

export function KVClear(key: string): KVRequest {
  return webCache.clear({ key, moduleType: 2 }, { silent: true });
}

export function saveTempRecordValueToLocal(
  key: string,
  id: string | undefined,
  value: string,
  max = 5,
): typeof debouncedKVSet | undefined {
  if (!id) return undefined;
  if (window.isWxWork) {
    debouncedKVSet(`${md.global.Account.accountId}${id}-${key}`, value);
    return debouncedKVSet;
  }

  let savedIds: string[] = [];

  if (localStorage.getItem(key)) {
    try {
      const storedIndex: unknown = safeParse(localStorage.getItem(key), 'array');
      savedIds = decodeTempRecordIds(storedIndex);
      savedIds = savedIds.filter(sid => sid !== id);
    } catch (err) {
      console.error(err);
    }
  }

  savedIds.push(id);
  if (savedIds.length > max) {
    localStorage.removeItem(`${key}_${savedIds[0]}`);
    savedIds = savedIds.slice(1);
  }

  try {
    safeLocalStorageSetItem(key, JSON.stringify(savedIds));
    safeLocalStorageSetItem(`${key}_${id}`, value);
  } catch (err) {
    console.error(err);
    Object.keys(localStorage)
      .filter(k => k.startsWith(key))
      .forEach(k => localStorage.removeItem(k));
    safeLocalStorageSetItem(key, JSON.stringify(savedIds));
    safeLocalStorageSetItem(`${key}_${id}`, value);
  }
  return undefined;
}

export function removeTempRecordValueFromLocal(key: string, id: string | undefined) {
  if (!id) return undefined;
  if (window.isWxWork) {
    KVClear(`${md.global.Account.accountId}${id}-${key}`);
    return;
  }

  let savedIds: string[] = [];

  if (localStorage.getItem(key)) {
    try {
      const storedIndex: unknown = safeParse(localStorage.getItem(key), 'array');
      savedIds = decodeTempRecordIds(storedIndex);
      savedIds = savedIds.filter(sid => sid !== id);
    } catch (err) {
      console.error(err);
    }
  }

  if (savedIds && savedIds.length) {
    safeLocalStorageSetItem(key, JSON.stringify(savedIds));
  } else {
    localStorage.removeItem(key);
  }

  localStorage.removeItem(`${key}_${id}`);
}

/**
 * 验证函数表达式基础语法
 */
export function validateFnExpression(expression: string, type = 'mdfunction') {
  try {
    expression = expression.replace(/\$(.+?)\$/g, '"1"');
    if (type === 'mdfunction') {
      expression = expression.replace(/[\r\r\n ]/g, '');
      expression = expression.replace(/([A-Z_]+)(?=\()/g, 'test');
      eval(`let test = function() {return '-';};${expression}`);
    } else if (type === 'javascript') {
      eval(`function test() {${expression} }`);
    }

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export function isKeyBoardInputChar(value: string) {
  return (
    `1234567890-=!@#$%^&*()_+[];',./{}|:"<>?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`.indexOf(value) > -1
  );
}

export function getScrollBarWidth() {
  return 10;
}

export function getRowGetType(from?: string | number, { discussId }: { discussId?: unknown } = {}) {
  let isInbox;

  if (typeof discussId !== 'undefined') {
    isInbox = from === 2 && !!discussId;
  } else {
    isInbox = from === 2 && location.search && location.search.indexOf('inboxId') > -1;
  }

  if (from == 21) {
    return 21;
  } else if (
    isInbox ||
    _.get(window, 'shareState.isPublicView') ||
    _.get(window, 'shareState.isPublicPage') ||
    _.get(window, 'shareState.isPublicWorkflowRecord') ||
    _.get(window, 'shareState.isPublicRecord') ||
    _.get(window, 'shareState.isPublicPrint')
  ) {
    return 3;
  } else {
    return 1;
  }
}

// axiosConfig 只有 responseType 被读到（全仓三个调用点里只有导出 Excel 传 'blob'），
// 所以按这一个键标，别用 Record<string, any> 假装它能收任何配置。
export function postWithToken(
  url: string,
  tokenArgs?: TokenRequestArgs,
  body?: RequestBody,
  axiosConfig?: TokenHttpOptions,
): Promise<unknown>;
export function postWithToken<Value>(
  url: string,
  tokenArgs: TokenRequestArgs,
  body: RequestBody,
  axiosConfig: TokenHttpOptions,
  decode: ResponseDecoder<Value>,
): Promise<Value>;
export async function postWithToken(
  url: string,
  tokenArgs: TokenRequestArgs = {},
  body: RequestBody = {},
  axiosConfig: TokenHttpOptions = {},
  decode?: ResponseDecoder<unknown>,
): Promise<unknown> {
  let token: string | undefined;

  if (!_.get(window, 'shareState.shareId')) {
    const rawToken: unknown = await appManagementAjax.getToken(tokenArgs);
    if (!rawToken) {
      throw '获取token失败';
    }
    token = decodeAuthToken(rawToken);
  }

  const result: unknown = await window.mdyAPI(
    '',
    '',
    Object.assign({}, body, {
      token,
      accountId: md.global.Account.accountId,
      clientId: window.clientId || sessionStorage.getItem('clientId'),
    }),
    {
      customParseResponse: axiosConfig.responseType === 'blob',
      ajaxOptions: {
        url,
        responseType: axiosConfig.responseType,
      },
    },
  );
  return decode ? decode(result) : result;
}

export function getWithToken(url: string, tokenArgs?: TokenRequestArgs, body?: RequestBody): Promise<unknown>;
export function getWithToken<Value>(
  url: string,
  tokenArgs: TokenRequestArgs,
  body: RequestBody,
  decode: ResponseDecoder<Value>,
): Promise<Value>;
export async function getWithToken(
  url: string,
  tokenArgs: TokenRequestArgs = {},
  body: RequestBody = {},
  decode?: ResponseDecoder<unknown>,
): Promise<unknown> {
  let token: string | undefined;

  if (!_.get(window, 'shareState.shareId')) {
    const rawToken: unknown = await appManagementAjax.getToken(tokenArgs);
    if (!rawToken) {
      throw '获取token失败';
    }
    token = decodeAuthToken(rawToken);
  }

  const result: unknown = await window.mdyAPI(
    '',
    '',
    {
      ...body,
      token,
      accountId: md.global.Account.accountId,
      clientId: window.clientId || sessionStorage.getItem('clientId'),
    },
    {
      ajaxOptions: {
        type: 'GET',
        url,
      },
    },
  );
  return decode ? decode(result) : result;
}

export const getFilledRequestParams = <Params extends object>(
  params: Params,
  defaultRequestParams: RequestBody = {},
): FilledRequestParams<Params> => {
  const request = getRequest();
  const existing: unknown = Reflect.get(params, 'requestParams');
  const requestParams: Record<string, unknown> =
    existing !== null && (typeof existing === 'object' || typeof existing === 'function') ? { ...existing } : {};

  if (_.isEmpty(request)) {
    return params;
  }

  Object.keys(request).forEach(key => {
    const value = request[key];
    if (Array.isArray(value)) {
      requestParams[key.trim()] = value[value.length - 1];
    } else if (value !== null) {
      requestParams[key.trim()] = value;
    }
  });

  return { ...params, requestParams: { ...defaultRequestParams, ...requestParams } };
};

export function appendDataToLocalPushUniqueId(data?: LocalPushData): void {
  try {
    let pushUniqueId = md.global.Config.pushUniqueId;
    pushUniqueId = pushUniqueId.replace(/__(.+)/, '');
    if (pushUniqueId) {
      const defaultData = data ? getDataFromLocalPushUniqueId() : {};
      md.global.Config.pushUniqueId =
        pushUniqueId + (!data ? '' : `__${JSON.stringify(_.assign({}, defaultData, decodeLocalPushData(data)))}`);
    }
  } catch (err) {
    console.error(err);
  }
}

export function resetLocalPushUniqueId(): void {
  appendDataToLocalPushUniqueId();
}

export function getDataFromLocalPushUniqueId(): LocalPushData {
  const rawId: unknown = md.global.Config.pushUniqueId;
  if (rawId === undefined || rawId === null || rawId === '') return {};
  if (typeof rawId !== 'string') throw new TypeError('Invalid local push identifier');
  const serialized = rawId.match(/__(.+)/)?.[1];
  if (serialized === undefined) return {};
  const parsed: unknown = JSON.parse(serialized);
  return decodeLocalPushData(parsed);
}

export function equalToLocalPushUniqueId(pushUniqueId: string | number | null | undefined): boolean {
  const raw: unknown = pushUniqueId;
  if (raw !== null && raw !== undefined && typeof raw !== 'string' && typeof raw !== 'number')
    throw new TypeError('Invalid local push identifier');
  return String(pushUniqueId).replace(/__(.+)/, '') === md.global.Config.pushUniqueId.replace(/__(.+)/, '');
}

/**
 *  日期公式计算
 * */

export function calcDate(date: FunctionDateInput | moment.Moment, expression: string): CalculatedDate {
  if (!date) {
    return { error: true };
  }

  if (!/^[+-]/.test(expression)) {
    expression = '+' + expression;
  }

  try {
    let result = dayjs(moment.isMoment(date) ? date.toDate() : date);
    const regexp = /([/+/-]){1}(\d+(\.\d+)?)+([YQMwdhms]){1}/g;
    let match = regexp.exec(expression);

    while (match) {
      const operator = match[1];
      const number = Number(match[2]);
      const unit = match[4];

      if ((operator === '+' || operator === '-') && number && unit) {
        const rounded = Math.round(number);
        if (unit === 'Q') {
          const next: unknown = Reflect.apply(result[operator === '+' ? 'add' : 'subtract'], result, [rounded, unit]);
          if (!dayjs.isDayjs(next)) throw new TypeError('Date expression must return a Dayjs value');
          result = next;
        } else if (
          unit === 'Y' ||
          unit === 'M' ||
          unit === 'w' ||
          unit === 'd' ||
          unit === 'h' ||
          unit === 'm' ||
          unit === 's'
        ) {
          result = result[operator === '+' ? 'add' : 'subtract'](rounded, unit === 'Y' ? 'y' : unit);
        }
      }

      match = regexp.exec(expression);
    }

    return { result };
  } catch (err) {
    return { error: err };
  }
}

/**
 * 说明：javascript的乘法结果会有误差，在两个浮点数相乘的时候会比较明显。这个函数返回较为精确的乘法结果。
 * 调用：accMul(arg1,arg2)
 * 返回值：arg1乘以arg2的精确结果
 */
export function accMul(arg1: string | number, arg2: number) {
  let m = 0,
    s1 = arg1.toString(),
    s2 = arg2.toString();

  try {
    m += (s1.split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
  }

  try {
    m += (s2.split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
  }

  return (Number(s1.replace('.', '')) * Number(s2.replace('.', ''))) / Math.pow(10, m);
}

/**
 * 说明：javascript的除法结果会有误差，在两个浮点数相除的时候会比较明显。这个函数返回较为精确的除法结果。
 * 调用：accDiv(arg1,arg2)
 * 返回值：arg1除以arg2的精确结果
 */
export function accDiv(arg1: string | number, arg2: number) {
  let t1 = 0,
    t2 = 0,
    r1,
    r2;

  try {
    t1 = (arg1.toString().split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
  }

  try {
    t2 = (arg2.toString().split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
  }

  r1 = Number(arg1.toString().replace('.', ''));
  r2 = Number(arg2.toString().replace('.', ''));
  const res = (r1 / r2) * Math.pow(10, t2 - t1);

  if (res.toString().replace(/\d+\./, '').length > 9) {
    return parseFloat(res.toFixed(9));
  }

  return res;
}

/**
 * 说明：javascript的加法结果会有误差，在两个浮点数相加的时候会比较明显。这个函数返回较为精确的加法结果。
 * 调用：accAdd(arg1,arg2)
 * 返回值：arg1加上arg2的精确结果
 */
export function accAdd(arg1: number, arg2: number) {
  let r1, r2, m;

  try {
    r1 = (arg1.toString().split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
    r1 = 0;
  }

  try {
    r2 = (arg2.toString().split('.')[1] || '').length;
  } catch (e) {
    console.log(e);
    r2 = 0;
  }

  m = Math.pow(10, Math.max(r1, r2));
  return (arg1 * m + arg2 * m) / m;
}

/**
 * 说明：javascript的减法结果会有误差，在两个浮点数相加的时候会比较明显。这个函数返回较为精确的减法结果。
 * 调用：accSub(arg1,arg2)
 * 返回值：arg1减上arg2的精确结果
 */
export function accSub(arg1: number, arg2: number) {
  return accAdd(arg1, -arg2);
}

export function countChar(str = '', char: string) {
  if (!str || !char) {
    return 0;
  }

  try {
    return str.match(new RegExp(char, 'g'))?.length ?? 0;
  } catch (err) {
    console.log(err);
    return 0;
  }
}

/**
 * 获取字符串字节数
 * @param {string} self - 要计算字节数的字符串
 * @returns {number} - 字符串的字节数
 */
export const getStringBytes = (self: string) => {
  let strLength = 0;

  for (let i = 0; i < self.length; i++) {
    if (self.charAt(i) > '~') strLength += 2;
    else strLength += 1;
  }

  return strLength;
};

export const cutStringWithHtml = (self: string, len: number, rows: number) => {
  let str = '';
  let strLength = 0;
  let isA = false;
  let isPic = false;
  let isBr = false;
  let brCount = 0;

  for (let i = 0; i < self.length; i++) {
    let letter = self.substring(i, i + 1);
    let nextLetter = self.substring(i + 1, i + 2);
    let nextnextLetter = self.substring(i + 2, i + 3);

    if (letter == '<' && nextLetter == 'a') {
      // a标签包含
      isA = true;
    } else if (letter == '<' && nextLetter == 'b' && nextnextLetter == 'r') {
      // 换行符
      isBr = true;
      brCount++;
    } else if (letter == '<') {
      // 图片
      isPic = true;
    }

    if (brCount == Number(rows)) {
      break;
    }

    str += letter;
    if (!isA && !isPic && !isBr) {
      if (self.charAt(i) > '~') {
        strLength += 2;
      } else {
        strLength += 1;
      }
    }

    if (isPic) {
      if (letter == '>') {
        isPic = false;
      } else {
        continue;
      }
    }

    if (isA) {
      if (letter == '>' && self.substring(i - 1, i) == 'a') {
        isA = false;
      } else {
        continue;
      }
    }

    if (isBr) {
      if (letter == '>' && self.substring(i - 1, i) == 'r') {
        isBr = false;
      } else {
        continue;
      }
    }

    if (strLength >= len) {
      break;
    }
  }

  return str;
};

// 加密
export const encrypt = (text: unknown) => {
  if (typeof text === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  const encrypt = new JSEncrypt();
  encrypt.setPublicKey(PUBLIC_KEY);
  return encrypt.encrypt(
    JSON.stringify({
      expire: moment().utc().valueOf(),
      data: encodeURIComponent(String(text)),
    }),
  );
};

/**
 * 编码 html 字符串，只编码 &<>"'/
 * @param  {string} str
 * @return {string}
 */
export const htmlEncodeReg = (str: unknown): string => {
  const encodeHTMLRules: Record<string, string> = {
    '&': '&#38;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&#34;',
    "'": '&#39;',
    '/': '&#47;',
  };
  const matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
  return str
    ? str.toString().replace(matchHTML, function (m) {
        return encodeHTMLRules[m] || m;
      })
    : '';
};

/**
 * 解码 html 字符串，只解码 '&#38;','&amp;','&#60;','&#62;','&#34;','&#39;','&#47;','&lt;','&gt;','&quot;'
 * @param  {string} str
 * @return {string}
 */
export const htmlDecodeReg = (str: unknown): string => {
  const decodeHTMLRules: Record<string, string> = {
    '&#38;': '&',
    '&amp;': '&',
    '&#60;': '<',
    '&#62;': '>',
    '&#34;': '"',
    '&#39;': "'",
    '&#47;': '/',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
  };
  const matchHTML = /&#(38|60|62|34|39|47);|&(amp|lt|gt|quot);/g;
  return str
    ? str.toString().replace(matchHTML, function (m) {
        return decodeHTMLRules[m] || m;
      })
    : '';
};

/**
 * 将文件大小转换成可读的格式，即 123.4 MB 这种类型
 * @param  {Number} size  文件以 byte 为单位的大小
 * @param  {Array}  accuracy 小数点后保留的位数
 * @param  {String} space 数字和单位间的内容，默认为一个空格
 * @param  {Array}  units 自定义文件大小单位的数组，默认为 ['B', 'KB', 'MB', 'GB', 'TB']
 * @return {String}       可读的格式
 */
export const formatFileSize = (
  size: string | number | null | undefined,
  accuracy?: number | undefined,
  space?: string,
  units?: string[],
) => {
  units = units || ['B', 'KB', 'MB', 'GB', 'TB'];
  space = space || ' ';
  accuracy = (accuracy && typeof accuracy === 'number' && accuracy) || 0;
  if (!size) {
    return '0' + space + units[0];
  }

  let i = Math.floor(Math.log(Number(size)) / Math.log(1024));
  return Number((Number(size) / Math.pow(1024, i)).toFixed(accuracy)) + space + units[i];
};

export const downloadFile = (url: string): string => {
  if (window.isDingTalk) {
    const [, search] = decodeURIComponent(url).split('?');
    const { validation } = qs.parse(search ?? '');
    return addToken(url, validation ? true : false);
  } else {
    return addToken(url, md.global.Config.HttpOnly || window.self !== window.top ? false : true);
  }
};

/**
 * 下载地址和包含 md.global.Config.AjaxApiUrl 的 url 添加 token
 * @param {string} url
 * @returns {string} url
 */
export const addToken = (url: string, verificationId = true) => {
  const id = window.getCookie('md_pss_id') || window.localStorage.getItem('md_pss_id');

  if (verificationId && id && !md.global.Account.isPortal) {
    return url;
  }

  if (url.includes('?')) {
    return `${url}&md_pss_id=${getPssId()}`;
  } else {
    return `${url}?md_pss_id=${getPssId()}`;
  }
};

/**
 * 判断当前设备是否为移动端
 */
export const browserIsMobile = () => {
  const sUserAgent = navigator.userAgent.toLowerCase();
  const bIsIphoneOs = sUserAgent.match(/iphone os/i)?.[0] === 'iphone os';
  const bIsMidp = sUserAgent.match(/midp/i)?.[0] === 'midp';
  const bIsUc7 = sUserAgent.match(/rv:1.2.3.4/i)?.[0] === 'rv:1.2.3.4';
  const bIsUc = sUserAgent.match(/ucweb/i)?.[0] === 'ucweb';
  const bIsAndroid = sUserAgent.match(/android/i)?.[0] === 'android';
  const bIsCE = sUserAgent.match(/windows ce/i)?.[0] === 'windows ce';
  const bIsWM = sUserAgent.match(/windows mobile/i)?.[0] === 'windows mobile';
  const bIsApp = sUserAgent.match(/mingdao application/i)?.[0] === 'mingdao application';
  const bIsMiniProgram = sUserAgent.match(/miniprogram/i)?.[0] === 'miniprogram';
  const isHuawei = sUserAgent.match(/mobile huaweibrowser/i)?.[0] === 'mobile huaweibrowser';
  const isHarmony = sUserAgent.match(/penharmony/i)?.[0] === 'penharmony';
  const isAndroid = sUserAgent.match(/android/i)?.[0] === 'android';

  const value =
    bIsIphoneOs ||
    bIsMidp ||
    bIsUc7 ||
    bIsUc ||
    bIsAndroid ||
    bIsCE ||
    bIsWM ||
    bIsApp ||
    bIsMiniProgram ||
    isHuawei ||
    isHarmony ||
    isAndroid;

  if (sUserAgent.includes('dingtalk') || sUserAgent.includes('wxwork') || sUserAgent.includes('feishu')) {
    // 钉钉和微信设备针对侧边栏打开判断为 mobile 环境
    const pcSlide = getRequest()['pc_slide'];
    return (pcSlide === undefined || pcSlide === null ? false : pcSlide.includes('true')) ||
      sessionStorage.getItem('dingtalk_pc_slide')
      ? true
      : value;
  } else {
    return value;
  }
};

export const getDefaultThemeMode = () => {
  return browserIsMobile() ? 'system' : 'light';
};

/**
 * 获取URL里的参数，返回一个参数对象
 * @param  {string} str url中 ? 之后的部分，可以包含 ?
 * @return {object}
 */
export const getRequest = (str?: string) => {
  str = str || location.search;
  str = str
    .replace(/^\?/, '')
    .replace(/#.*$/, '')
    .replace(/(^&|&$)/, '');

  return qs.parse(str);
};

/**
 * 根据拓展名获取拓展名对应的 icon 名
 * @param  {string} ext 拓展名
 * @return {string}          背景图片 icon 名
 */
export const getIconNameByExt = (ext?: string | null) => {
  let extType = null;

  switch (ext && ext.toLowerCase()) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'tif':
    case 'tiff':
      extType = 'img';
      break;
    case 'xls':
    case 'xlsx':
      extType = 'excel';
      break;
    case 'doc':
    case 'docx':
    case 'dot':
      extType = 'word';
      break;
    case 'md':
      extType = 'md';
      break;
    case 'js':
    case 'ts':
    case 'java':
    case 'py':
    case 'rb':
    case 'cpp':
    case 'c':
    case 'html':
    case 'css':
    case 'php':
    case 'swift':
    case 'go':
    case 'rust':
    case 'lua':
    case 'sql':
    case 'pl':
    case 'sh':
    case 'json':
    case 'xml':
    case 'cs':
    case 'vb':
    case 'scala':
    case 'perl':
    case 'r':
    case 'matlab':
    case 'groovy':
    case 'jsp':
    case 'jsx':
    case 'tsx':
    case 'sass':
    case 'less':
    case 'scss':
    case 'coffee':
    case 'asm':
    case 'bat':
    case 'powershell':
    case 'h':
    case 'hpp':
    case 'm':
    case 'mm':
    case 'd':
    case 'kt':
    case 'ini':
    case 'yml':
      extType = 'code';
      break;
    case 'ppt':
    case 'pptx':
    case 'pps':
      extType = 'ppt';
      break;
    case 'mov':
    case 'mp4':
    case 'mpg':
    case 'flv':
    case 'f4v':
    case 'rm':
    case 'rmvb':
    case 'avi':
    case 'mkv':
    case 'wmv':
    case '3gp':
    case '3g2':
    case 'swf':
    case 'm4v':
      extType = 'mp4';
      break;
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ape':
    case 'alac':
    case 'wavpack':
    case 'm4a':
    case 'aac':
    case 'ogg':
    case 'vorbis':
    case 'opus':
    case 'au':
    case 'mmf':
    case 'aif':
      extType = 'mp3';
      break;
    case 'mmap':
    case 'xmind':
    case 'cal':
    case 'zip':
    case 'rar':
    case '7z':
    case 'pdf':
    case 'txt':
    case 'ai':
    case 'psd':
    case 'vsd':
    case 'aep':
    case 'apk':
    case 'ascx':
    case 'db':
    case 'dmg':
    case 'dwg':
    case 'eps':
    case 'exe':
    case 'indd':
    case 'iso':
    case 'key':
    case 'ma':
    case 'max':
    case 'numbers':
    case 'obj':
    case 'pages':
    case 'prt':
    case 'rp':
    case 'skp':
    case 'xd':
      extType = ext?.toLowerCase() ?? 'doc';
      break;
    case 'url':
      extType = 'link';
      break;
    case 'mdy':
      extType = 'mdy';
      break;
    default:
      extType = 'doc';
  }

  return extType;
};

/**
 * 根据文件名获取相应图标的背景图片 css 类名
 * @param  {string} filename 文件名
 * @return {string}          背景图片 css 类名
 */
export const getClassNameByExt = (ext?: string | false | null) => {
  if (ext === false) {
    return 'fileIcon-folder';
  }

  /*
   * 之前方法针对的是普通附件，普通附件的 ext 属性是带 "." 的，知识文件不带点，这里简单的加个匹配判断
   * 传入的参数没有 "." 时，直接把它用作拓展名
   */
  ext = ext || '';
  ext = /^\w+$/.test(ext) ? ext.toLowerCase() : RegExpValidator.getExtOfFileName(ext).toLowerCase();
  return 'fileIcon-' + getIconNameByExt(ext);
};

/**
 * 获取光标位置
 */
export const getCaretPosition = (ctrl: CaretControl): number | null | undefined => {
  let caretPos: number | null | undefined = 0;
  const selection: unknown = Reflect.get(document, 'selection');

  if (selection) {
    // IE Support
    ctrl.focus();
    const sel = invokeLegacyCaretMethod(selection, 'createRange');
    const sel2 = invokeLegacyCaretMethod(sel, 'duplicate');
    invokeLegacyCaretMethod(sel2, 'moveToElementText', [ctrl]);
    caretPos = -1;
    while (invokeLegacyCaretMethod(sel2, 'inRange', [sel])) {
      invokeLegacyCaretMethod(sel2, 'moveStart', ['character']);
      caretPos++;
    }
  } else if (ctrl.setSelectionRange) {
    // W3C
    ctrl.focus();
    caretPos = ctrl.selectionStart;
  }

  return caretPos;
};

/**
 * 设置光标位置
 */
export const setCaretPosition = (ctrl: CaretControl | null | undefined, caretPos?: number | null) => {
  if (!ctrl) return;
  if (ctrl.createTextRange) {
    let range = ctrl.createTextRange();
    invokeLegacyCaretMethod(range, 'move', ['character', caretPos]);
    invokeLegacyCaretMethod(range, 'select');
  } else if (caretPos) {
    ctrl.focus();
    if (!ctrl.setSelectionRange) throw new TypeError('Missing caret selection method');
    ctrl.setSelectionRange(caretPos, caretPos);
  } else {
    ctrl.focus();
  }
};

/**
 * 获取上传token
 */
export const getToken = (
  files: FileTokenRequest[],
  type = 0,
  args: TokenRequestArgs = {},
  options: FileTokenOptions = {},
): AbortableRequest<FileTokenResult> => {
  validateFileTokenRequests(files);
  const request: AbortableRequest<unknown> = !md.global.Account.accountId
    ? qiniuAjax.getFileUploadToken({ files, type, ...args }, options)
    : qiniuAjax.getUploadToken({ files, type, ...args }, options);
  const decoded = request.then(decodeFileTokens);
  return Object.assign(decoded, request, { abort: () => request.abort() });
};

/**
 * 路由添加子路径，返回新的路由对象
 */
export type SubPathRoute = string | SubPathRoute[];
interface SubPathRouteConfig {
  path: SubPathRoute;
}
type NormalizedRoutes<Routes extends Record<string, SubPathRouteConfig>> = {
  [Key in keyof Routes]: Omit<Routes[keyof Routes], 'path'> & { path: SubPathRoute };
};
export function addSubPathOfRoutes<Routes extends Record<string, SubPathRouteConfig>>(
  routes: Routes,
): NormalizedRoutes<Routes> {
  if (!getCurrentSubPath()) {
    return routes;
  }

  const newRoutes: NormalizedRoutes<Routes> = _.cloneDeep(routes);
  _.forOwn(newRoutes, route => {
    route.path = addSubPathOfRoute(route.path);
  });
  return newRoutes;
}

/**
 * 子路径处理
 */
export const getCurrentSubPath = (): string => {
  const path: unknown = window['subPath'];
  return (typeof path === 'string' && path) || window.__customSubPath__ || '';
};

const hasSubPath = (route: string, subPath: string) =>
  !!subPath && (route === subPath || route.startsWith(`${subPath}/`) || route.startsWith(`${subPath}?`));

const getPathWithSubPath = (route: string, subPath = getCurrentSubPath()) =>
  subPath && !hasSubPath(route, subPath) ? subPath + route : route;

export function getPathWithoutSubPath(url = '', subPath = getCurrentSubPath()) {
  const route = String(url).startsWith(location.origin) ? String(url).slice(location.origin.length) : String(url);
  const pathname = route.split(/(?=[?#])/)[0] ?? '';

  if (hasSubPath(pathname, subPath)) {
    return (pathname.slice(subPath.length) || '/') + route.slice(pathname.length);
  }

  return route;
}

/**
 * 路由添加子路径，返回新的路由路径
 */
export function addSubPathOfRoute(route: string): string;
export function addSubPathOfRoute(route: string[]): string[];
export function addSubPathOfRoute(route: SubPathRoute): SubPathRoute;
export function addSubPathOfRoute(route: SubPathRoute): SubPathRoute {
  const subPath = getCurrentSubPath();

  if (!subPath) {
    return route;
  }

  if (_.isArray(route)) {
    return route.map(addSubPathOfRoute);
  }

  if (hasSubPath(route, subPath)) {
    return route;
  }

  return subPath + route;
}

/**
 * 根据索引获取不重复名称
 * @param {Array} data - 包含名称的对象数组
 * @param {string} name - 初始名称
 * @param {string} key - 用于比较的键名，默认为 'name'
 * @returns {string} - 不重复的名称
 */
export const getUnUniqName = (data: Array<Record<string, unknown>>, name = '', key = 'name') => {
  const nameExists = _.some(data, [key, name]);

  if (nameExists) {
    const maxNumber = _.max(
      _.filter(data, item => _.startsWith(_.toString(item[key]), String(name).replace(/\d*$/, ''))).map(item => {
        const value = item[key];
        if (typeof value !== 'string') throw new TypeError('Unique names must be strings');
        return parseInt(value.replace(/^.*?(\d+)$/, '$1'));
      }),
    );

    name = String(name).replace(/\d*$/, String((maxNumber || 0) + 1));
  }

  return name;
};

/**
 * 生成包含大写字母、小写字母和数字的随机密码。
 * @param {number} length - 密码长度。
 * @returns {string} - 随机生成的密码。
 */
export const generateRandomPassword = (length: number) => {
  const chars = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    number: '0123456789',
  };

  // 至少包含一个字符
  const password = _.flatMap(Object.values(chars), group => _.sample(group)).join('');

  // 生成剩余部分，并使用 Fisher-Yates 洗牌算法随机排序
  const remainingChars = _.times(length - 3, i => _.sample(Object.values(chars)[i % 3]));
  const shuffledPassword = _.shuffle([password, ...remainingChars]).join('');

  return shuffledPassword;
};

/**
 * regexFilter dom 转换方式过滤 html标签
 * 缺点：慢
 */
export function domFilterHtmlScript(html: string): string {
  try {
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  } catch (err) {
    console.log(err);
    return html;
  }
}

const globalStoreForMingo: MingoGlobalStore = {
  emitter: new EventEmitter<Record<string, unknown[]>>(),
  activeModule: 'worksheet', // ["worksheet", "worksheetControlsEdit"]
};

window.globalStoreForMingo = globalStoreForMingo;

export const updateGlobalStoreForMingo: MingoStoreUpdater = (key: unknown, value?: unknown) => {
  if (typeof key === 'string') {
    writeMingoStoreValue(globalStoreForMingo, key, value);
  } else {
    const patch = mingoStorePatch(key);
    if (value === 'clear') {
      Object.keys(globalStoreForMingo).forEach(k => {
        delete globalStoreForMingo[k];
      });
    }

    Object.keys(patch).forEach(k => {
      writeMingoStoreValue(globalStoreForMingo, k, patch[k]);
    });
  }
};

export function getGlobalStoreForMingo(): MingoGlobalStore;
export function getGlobalStoreForMingo(key: undefined | null | ''): MingoGlobalStore;
export function getGlobalStoreForMingo<Key extends MingoStoreKey>(key: Key): MingoStoreValues[Key];
export function getGlobalStoreForMingo(key: string): unknown;
export function getGlobalStoreForMingo(key?: string | null): unknown {
  return key ? globalStoreForMingo[key] : globalStoreForMingo;
}

function generateFileOId(): string {
  const prefix = 'o_';

  // 使用当前时间戳作为基础（更具唯一性）
  const timestamp = Date.now().toString(36); // 转成36进制，包含数字+字母

  // 随机部分，用于增加复杂度和避免冲突
  const randomPart = Array.from({ length: 20 }, () => Math.random().toString(36)[2]).join('');

  return prefix + timestamp + randomPart;
}

export function getTemporaryAttachmentFromUrl({
  fileUrl,
  fileName = '',
  fileSize,
  fileExt,
}: TemporaryAttachmentArgs = {}): TemporaryAttachment {
  validateTemporaryAttachment({ fileUrl, fileName, fileSize, fileExt });
  const urlObj = new URL(String(fileUrl));
  const name = fileName.replace(/\.[^.]+$/, '');
  const ext = fileExt || fileName.match(/\.[^.]+$/)?.[0];
  const fileNameSegment = urlObj.pathname.match(/\/([^/]*$)/)?.[1];
  if (fileNameSegment === undefined) throw new TypeError('Invalid attachment URL path');
  const fileNameOfUrl = fileNameSegment.replace(/\.[^.]+$/, '');
  return {
    fileID: generateFileOId(),
    fileSize: fileSize || 0,
    serverName: urlObj.origin + '/',
    filePath: urlObj.pathname.replace(/\/([^/]*$)/, '').replace(/^\//, '') + '/',
    fileName: fileNameOfUrl,
    fileExt: ext,
    originalFileName: name,
    key: urlObj.pathname.replace(/^\//, ''),
    oldOriginalFileName: name,
    url: fileUrl,
  };
}

/**
 * 根据文件扩展名获取对应的 MIME 类型
 * @param  {string} ext 文件扩展名
 * @return {string}     MIME 类型
 */
export const getMimeTypeByExt = (ext?: string | null) => {
  if (!ext) return 'application/octet-stream';
  ext = ext.replace(/^\./, '');
  const extLower = ext.toLowerCase();

  switch (extLower) {
    // 图片类型
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';

    // 文档类型
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'dot':
      return 'application/msword';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'pps':
      return 'application/vnd.ms-powerpoint';

    // 文本类型
    case 'txt':
      return 'text/plain';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
      return 'application/javascript';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'csv':
      return 'text/csv';
    case 'md':
      return 'text/markdown';

    // 代码文件
    case 'ts':
      return 'application/typescript';
    case 'java':
      return 'text/x-java-source';
    case 'py':
      return 'text/x-python';
    case 'rb':
      return 'text/x-ruby';
    case 'cpp':
    case 'c':
      return 'text/x-c';
    case 'php':
      return 'application/x-php';
    case 'swift':
      return 'text/x-swift';
    case 'go':
      return 'text/x-go';
    case 'rust':
      return 'text/x-rust';
    case 'lua':
      return 'text/x-lua';
    case 'sql':
      return 'application/sql';
    case 'pl':
      return 'text/x-perl';
    case 'sh':
      return 'application/x-sh';
    case 'cs':
      return 'text/x-csharp';
    case 'vb':
      return 'text/x-vb';
    case 'scala':
      return 'text/x-scala';
    case 'perl':
      return 'text/x-perl';
    case 'r':
      return 'text/x-r';
    case 'matlab':
      return 'text/x-matlab';
    case 'groovy':
      return 'text/x-groovy';
    case 'jsp':
      return 'application/x-jsp';
    case 'jsx':
      return 'text/jsx';
    case 'tsx':
      return 'text/tsx';
    case 'sass':
      return 'text/x-sass';
    case 'less':
      return 'text/x-less';
    case 'scss':
      return 'text/x-scss';
    case 'coffee':
      return 'text/x-coffeescript';
    case 'asm':
      return 'text/x-asm';
    case 'bat':
      return 'application/x-bat';
    case 'powershell':
      return 'application/x-powershell';
    case 'h':
    case 'hpp':
      return 'text/x-c';
    case 'm':
    case 'mm':
      return 'text/x-objective-c';
    case 'd':
      return 'text/x-d';
    case 'kt':
      return 'text/x-kotlin';
    case 'ini':
      return 'text/plain';
    case 'yml':
    case 'yaml':
      return 'application/x-yaml';

    // 音频类型
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'ape':
      return 'audio/ape';
    case 'alac':
      return 'audio/alac';
    case 'wavpack':
      return 'audio/wavpack';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      return 'audio/ogg';
    case 'vorbis':
      return 'audio/vorbis';
    case 'opus':
      return 'audio/opus';
    case 'au':
      return 'audio/basic';
    case 'mmf':
      return 'audio/mmf';
    case 'aif':
      return 'audio/aiff';

    // 视频类型
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'mpg':
    case 'mpeg':
      return 'video/mpeg';
    case 'flv':
      return 'video/x-flv';
    case 'f4v':
      return 'video/x-f4v';
    case 'rm':
    case 'rmvb':
      return 'video/vnd.rn-realvideo';
    case 'avi':
      return 'video/x-msvideo';
    case 'mkv':
      return 'video/x-matroska';
    case 'wmv':
      return 'video/x-ms-wmv';
    case '3gp':
      return 'video/3gpp';
    case '3g2':
      return 'video/3gpp2';
    case 'swf':
      return 'application/x-shockwave-flash';
    case 'm4v':
      return 'video/x-m4v';

    // 压缩文件
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/x-rar-compressed';
    case '7z':
      return 'application/x-7z-compressed';
    case 'tar':
      return 'application/x-tar';
    case 'gz':
      return 'application/gzip';

    // 其他文件类型
    case 'psd':
      return 'image/vnd.adobe.photoshop';
    case 'ai':
      return 'application/postscript';
    case 'eps':
      return 'application/postscript';
    case 'exe':
      return 'application/x-msdownload';
    case 'dmg':
      return 'application/x-apple-diskimage';
    case 'iso':
      return 'application/x-iso9660-image';
    case 'apk':
      return 'application/vnd.android.package-archive';
    case 'db':
      return 'application/x-sqlite3';
    case 'dwg':
      return 'image/vnd.dwg';
    case 'indd':
      return 'application/x-indesign';
    case 'key':
      return 'application/vnd.apple.keynote';
    case 'ma':
    case 'max':
      return 'application/x-3ds-max';
    case 'numbers':
      return 'application/vnd.apple.numbers';
    case 'obj':
      return 'application/x-tgif';
    case 'pages':
      return 'application/vnd.apple.pages';
    case 'prt':
      return 'application/x-prt';
    case 'rp':
      return 'application/x-rp';
    case 'skp':
      return 'application/x-sketchup';
    case 'xd':
      return 'application/vnd.adobe.xd';
    case 'url':
      return 'application/x-url';
    case 'mdy':
      return 'application/x-mdy';

    // 默认类型
    default:
      return 'application/octet-stream';
  }
};

export const setBodyThemeMode = (value: string) => {
  const isMobile = browserIsMobile();

  const theme =
    value === 'light' || value === 'dark'
      ? value
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // 设置 ant mobile 主题
  if (isMobile) {
    document.documentElement.setAttribute('data-prefers-color-scheme', theme);
  }
};

export const getLatestCreateTimestampOfWithSaveShortcut = () => {
  const timestamps = [...document.querySelectorAll('.withSaveShortcut')].map(el =>
    Number(el.className.match(/createTimestamp-(\d+)/)?.[1] || 0),
  );

  if (isEmpty(timestamps)) {
    return 0;
  }

  return Math.max(...timestamps);
};

/**
 * 获取应用界面特性是否可见
 */
export const getAppFeaturesVisible = () => {
  const { s, tb, tr, ln, rp, td, ss, ac, ch } = qs.parse(location.search.substr(1));

  return {
    s: s !== 'no', // 回首页按钮
    tb: tb !== 'no', // 应用分组
    tr: tr !== 'no', // 导航右侧内容（应用扩展信息）
    ln: ln !== 'no', // 左侧导航
    rp: rp !== 'no', // chart
    td: td !== 'no', // 待办
    ss: ss !== 'no', // 超级搜索
    ac: ac !== 'no', // 账户
    ch: ch !== 'no', // 消息侧边栏
  };
};

/**
 * 获取应用界面特性路径
 */
export const getAppFeaturesPath = () => {
  const { s, tb, tr, ln, rp, td, ss, ac, ch } = getAppFeaturesVisible();

  return [
    s ? '' : 's=no',
    tb ? '' : 'tb=no',
    tr ? '' : 'tr=no',
    ln ? '' : 'ln=no',
    rp ? '' : 'rp=no',
    td ? '' : 'td=no',
    ss ? '' : 'ss=no',
    ac ? '' : 'ac=no',
    ch ? '' : 'ch=no',
  ]
    .filter(o => o)
    .join('&');
};

// 路径补全
// parameters 的类型不能靠默认值推断 —— 那样会推成两个字段都必填，
// 而全仓大量调用点只传 { hasDomain: false }（navigateTo、portalAccount/util 等）。
// 显式标成可选：缺省时 localHasDomain 是 undefined，与原来传 false 同为假值，行为不变。
export function pathCompletion(url: string, parameters?: { hasDomain?: boolean; localHasDomain?: boolean }): string;
export function pathCompletion(
  url: string | null | undefined,
  parameters?: { hasDomain?: boolean; localHasDomain?: boolean },
): string | null | undefined;
export function pathCompletion(
  url: string | null | undefined,
  parameters: { hasDomain?: boolean; localHasDomain?: boolean } = { hasDomain: true, localHasDomain: false },
) {
  if (!url || url.startsWith('#') || url.startsWith('http')) return url;

  const { hasDomain, localHasDomain } = parameters;
  const hash = url.split('#')[1] || '';
  const hash2 = url.split('#')[2] || '';
  // 隐藏功能项参数
  const hideOptions = getAppFeaturesPath();
  // AI 实时预览（src/components/Agent/AppBuilder/PreviewFrame.jsx）会在 iframe URL 上挂 previewMode=ai，
  // 用于让工作表渲染层在 views 暂时为空时给出伪「全部」视图。navigateTo / pathCompletion
  // 默认会重写 query 丢掉非白名单参数（如 AppPkgHeader.completePara 跳 ?flag=Date.now()），
  // 所以这里跟 hideOptions 一样把 previewMode 透传，确保它在 iframe 路由跳转后依然保留。
  const currentPreviewMode = qs.parse(location.search.substr(1))['previewMode'];
  const previewModeOption = currentPreviewMode === 'ai' ? 'previewMode=ai' : '';

  url = url.split('#')[0] ?? '';

  // 外部门户自定义域名后缀：PC 用 /suffix 路径，移动端用 /app/appId 路径
  const { isPortal, addressSuffix, appId } = _.get(window.md, 'global.Account') || {};

  if (isPortal && addressSuffix) {
    const isMobile = browserIsMobile();

    if (!isMobile && url.includes('/app/') && !url.includes(`/${addressSuffix}`)) {
      url = url.replace(/\/app\/.*?(\/.*)?$/, `/${addressSuffix}$1`);
    } else if (isMobile && appId && addressSuffix && url.includes(`/${addressSuffix}`)) {
      url = url.replace(`/${addressSuffix}`, `/app/${appId}`);
    }
  }

  // 隐藏功能项补充
  if (hideOptions && url.indexOf(hideOptions) < 0) {
    url = url + (url.indexOf('?') > -1 ? '&' : '?') + hideOptions;
  }

  if (previewModeOption && url.indexOf(previewModeOption) < 0) {
    url = url + (url.indexOf('?') > -1 ? '&' : '?') + previewModeOption;
  }

  const shouldCompleteDomain = hasDomain && (!location.origin.includes('localhost:') || localHasDomain) && !isPortal;

  if (shouldCompleteDomain) {
    url = location.origin + getPathWithSubPath(url);
  } else {
    url = getPathWithSubPath(url);
  }

  // 只替换路径中多余的 //，保留协议部分的 ://
  url = url.replace(/(^|[^:])\/(?=\/)/g, '$1');

  if (window.isPublicApp && !new URL('http://z.z' + url).hash) {
    url = url + '#publicapp' + window.publicAppAuthorization + (hash2 ? `#${hash2}` : ``);
    return url;
  }

  return url + (hash ? `#${hash}` : '');
}
