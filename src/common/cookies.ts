import { get } from 'lodash';
import moment from 'moment';

/**
 * 安全地将数据存储到本地存储中
 * @param {...any} args - 传递给 localStorage.setItem() 方法的参数
 */
window.safeLocalStorageSetItem = (...args) => {
  try {
    window.localStorage.setItem(...args);
  } catch (err) {
    console.log(err);
  }
};

/**
 * Cookies 写入
 * @param {string} name - Cookie名称
 * @param {string} value - Cookie值
 * @param {Date} expire - 过期时间
 */
window.setCookie = function setCookie(name: string, value, expire) {
  if (get(window, 'md.global.Config.HttpOnly') && name === 'md_pss_id') {
    safeLocalStorageSetItem(name, value);
    return;
  }

  if (window.top !== window.self && name === 'i18n_langtag') {
    safeLocalStorageSetItem(name, value);
    return;
  }

  // 过期时间处理
  const expiration = expire ? moment(expire).toDate() : moment().add(10, 'days').toDate();
  const secure = location.protocol.indexOf('https') > -1 ? 'Secure;' : '';
  const cookieString = [
    // 【原来写的是 toGMTString()】那是 Annex B 的遗留别名，规范规定它与 toUTCString
    // 【是同一个函数对象】（实测 Date.prototype.toGMTString === Date.prototype.toUTCString），
    // 输出逐字相同；但它已从 TS 的 lib 声明里移除，所以一直在报 TS2551。
    // 【千万别按编译器的提示改成 toString()】那个提示是按名字相近猜的：
    //   toUTCString() -> 'Wed, 16 Sep 2026 06:30:38 GMT'   ← cookie 要的 RFC 格式
    //   toString()    -> 'Wed Sep 16 2026 14:30:38 GMT+0800 (China Standard Time)'
    // 后者不是合法的 expires 值，浏览器会当成会话 cookie —— 关掉浏览器就掉登录。
    `expires=${expiration.toUTCString()}`,
    'path=/',
    `domain=${document.domain.indexOf('mingdao.com') === -1 ? '' : '.mingdao.com'}`,
    'SameSite=Lax',
  ].join(';');

  document.cookie = `${name}=${escape(value)};${secure}${cookieString}`;
};

/**
 * Cookies 读取
 * @param {string} name - Cookie名称
 * @returns {string|null} - Cookie值
 */
window.getCookie = function getCookie(name: string) {
  if (get(window, 'md.global.Config.HttpOnly') && name === 'md_pss_id') {
    return localStorage.getItem(name) || null;
  }

  if (window.top !== window.self && name === 'i18n_langtag') {
    return localStorage.getItem(name) || null;
  }

  const cookieRegex = new RegExp(`(^| )${name}=([^;]*)(;|$)`);
  const cookieMatch = document.cookie.match(cookieRegex);

  return cookieMatch ? decodeURIComponent(cookieMatch[2]) : null;
};

/**
 * Cookies 删除
 * @param {string} name - Cookie名称
 */
window.delCookie = function delCookie(name: string) {
  const cookieValue = getCookie(name);

  if (cookieValue) {
    const cookieOptions = {
      expires: moment().subtract(10, 'seconds').toDate().toUTCString(),
      path: '/',
      domain: document.domain.indexOf('.mingdao.com') !== -1 ? '.mingdao.com' : '',
    };
    document.cookie = `${name}=${cookieValue};expires=${cookieOptions.expires};path=${cookieOptions.path};domain=${cookieOptions.domain}`;
  }
};
