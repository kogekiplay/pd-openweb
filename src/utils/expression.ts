import { get } from 'lodash';

/**
 * 方法是在下面逐条挂上去的，所以必须先把形状声明出来 ——
 * 写成 `const RegExpValidator = {}` 的话 TS 推成 `{}`，
 * 每一条赋值和每一个调用点都报 TS2339。
 */
interface RegExpValidatorType {
  isEmail: (str?: string) => boolean;
  isURL: (str?: string) => RegExpExecArray | null;
  /** 第二个参数调用点会传，但实现里没用到 —— 正则读的是 md.global.SysSettings.passwordRegex */
  isPasswordValid: (str?: string, passwordRegex?: string) => boolean;
  isVideo: (fileExt?: string) => boolean;
  /** 判断 webpack/url-loader 意义上的"需要走请求"的 url */
  isUrlRequest: (url?: string) => boolean;
  getExtOfFileName: (fileName?: string) => string;
  getNameOfFileName: (fileName?: string) => string;
  /** 可执行文件等危险扩展名一律不放行 */
  validateFileExt: (fileExt?: string) => boolean;
  fileIsPicture: (fileExt?: string) => boolean;
}

const RegExpValidator = {} as RegExpValidatorType;

// 验证一个字符串是email
RegExpValidator.isEmail = function (str?: string) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(String(str));
};

// 验证一个字符串是网址
RegExpValidator.isURL = function (str?: string) {
  const pattern = /^http(s)?:\/\/[A-Za-z0-9-]+\.[A-Za-z0-9-]+[/=?%\-&_~`@[\]:+!]*([^<>])*$/;
  return pattern.exec(String(str));
};

// 验证密码格式是否符合
RegExpValidator.isPasswordValid = function (str?: string) {
  const regex = get(md, 'global.SysSettings.passwordRegex')
    ? new RegExp(get(md, 'global.SysSettings.passwordRegex'))
    : /^(?=.*\d)(?=.*[a-zA-Z]).{8,20}$/;
  return regex.test(String(str));
};

// 判断是视频格式
RegExpValidator.isVideo = (fileExt?: string) => {
  return /.*?\.(mov|mp4|avi|mkv|3gp|3g2|m4v|rm|rmvb|webm)$/.test((fileExt || '').toLowerCase());
};

// 验证一个字符串是否是链接
RegExpValidator.isUrlRequest = (url?: string) => {
  if (/^data:|^chrome-extension:|^(https?:)?\/\/|^[{}[\]#*;,'§$%&(=?`´^°<>]/.test(String(url))) return true;
  if (/^\//.test(String(url))) return true;
  return false;
};

/**
 * 获取文件拓展名
 * @param {string} fileName - 文件名
 * @returns {string} - 文件扩展名
 */
RegExpValidator.getExtOfFileName = (fileName = '') => {
  return get(String(fileName).match(/\.([0-9a-z_A-Z]+)$/), '1') || '';
};

/**
 * 获取文件名（不包含扩展名）
 * @param {string} fileName - 文件名
 * @returns {string} - 文件名（不包含扩展名）
 */
RegExpValidator.getNameOfFileName = (fileName = '') => {
  const base = String(fileName).split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
};

/**
 * 检查文件扩展名是否有效
 * @param {string} fileExt - 文件扩展名
 * @returns {boolean} - 文件扩展名是否有效
 */
RegExpValidator.validateFileExt = function (fileExt = '') {
  return !/^\.(exe|vbs|bat|cmd|com|url)$/.test(String(fileExt).toLowerCase());
};

/**
 * 检查文件扩展名是否有效
 * @param {string} fileExt - 文件扩展名
 * @returns {boolean} - 文件扩展名是否有效
 */
RegExpValidator.fileIsPicture = function (fileExt = '') {
  return /^\.(jpg|gif|png|jpeg|bmp|webp|heic|heif|svg|tif|tiff)$/.test(String(fileExt).toLowerCase());
};

export default RegExpValidator;
