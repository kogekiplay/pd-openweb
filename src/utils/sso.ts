import { decodeBootstrapReply } from 'src/common/bootstrapMetadata';
import { pathCompletion } from 'src/utils/common';
import { PUBLIC_KEY } from 'src/utils/enum';
import { getPssId } from 'src/utils/pssId';
import { decodeSsoLoginStatus, decodeSsoTransport } from './ssoTypes';
import type { SsoDecodedRequest, SsoOpaqueRequest, SsoQuery, SsoTransport } from './ssoTypes';

export const browserIsMobile = () => {
  let sUserAgent = navigator.userAgent.toLowerCase();
  let bIsIpad = /ipad/i.test(sUserAgent);
  let bIsIphoneOs = /iphone os/i.test(sUserAgent);
  let bIsMidp = /midp/i.test(sUserAgent);
  let bIsUc7 = sUserAgent.match(/rv:1.2.3.4/i)?.[0] === 'rv:1.2.3.4';
  let bIsUc = /ucweb/i.test(sUserAgent);
  let bIsAndroid = /android/i.test(sUserAgent);
  let bIsCE = /windows ce/i.test(sUserAgent);
  let bIsWM = /windows mobile/i.test(sUserAgent);

  return bIsIpad || bIsIphoneOs || bIsMidp || bIsUc7 || bIsUc || bIsAndroid || bIsCE || bIsWM;
};

function get(url: string, fn: (this: XMLHttpRequest, responseText: string) => void): void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if ((xhr.readyState === 4 && xhr.status === 200) || xhr.status === 304) fn.call(this, xhr.responseText);
  };
  xhr.send();
}
function hasResponseDecoder<T>(params: SsoDecodedRequest<T> | SsoOpaqueRequest): params is SsoDecodedRequest<T> {
  return typeof params.decodeData === 'function';
}
function post<T>(this: unknown, params: SsoDecodedRequest<T>): void;
function post(this: unknown, params: SsoOpaqueRequest): void;
function post<T>(this: unknown, params: SsoDecodedRequest<T> | SsoOpaqueRequest): void {
  const mdPssId = getPssId();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', params.url, params.async);
  xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  if (mdPssId) xhr.setRequestHeader('Authorization', `md_pss_id ${mdPssId}`);
  if (window.md && window.md.global.Account && window.md.global.Account.accountId) {
    xhr.setRequestHeader('AccountId', md.global.Account.accountId);
  }
  xhr.withCredentials = 'withCredentials' in params ? !!params.withCredentials : true;
  let failed = false;
  const fail = (receiver: unknown, error: unknown) => {
    if (failed) return;
    failed = true;
    params.error?.call(receiver, error);
  };
  const deliver = (receiver: unknown, result: SsoTransport | { data: unknown }) => {
    if (hasResponseDecoder(params)) {
      const decoded = params.decodeData(result.data);
      params.success.call(receiver, Object.assign(result, { data: decoded }));
    } else {
      params.success.call(receiver, result);
    }
  };
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status !== 200 && xhr.status !== 304) {
      fail(this, new Error(`SSO HTTP ${xhr.status}`));
      return;
    }
    try {
      const value: unknown = JSON.parse(xhr.responseText);
      const result = decodeSsoTransport(value);
      if (result.state) {
        if (result.encrypted) {
          interfaceDataDecryption(result)
            .then(data => deliver(this, data))
            .catch(error => fail(this, error));
        } else {
          deliver(this, result);
        }
      } else {
        window.alert(result.exception);
        fail(this, result);
      }
    } catch (error) {
      fail(this, error);
    }
  };
  // Network errors keep the existing caller receiver, while ready-state callbacks use the XHR receiver.
  xhr.onerror = error => fail(this, error);
  xhr.send(JSON.stringify(params.data));
}
export const ajax = { get, post };

const interfaceDataDecryption = async (source: SsoTransport): Promise<{ data: unknown }> => {
  if (typeof source.data !== 'string' || typeof source.key !== 'string')
    throw new TypeError('Invalid encrypted SSO response');
  const CryptoJS = await import('crypto-js');
  const decrypted = CryptoJS.AES.decrypt(source.data, CryptoJS.enc.Utf8.parse(source.key), {
    iv: CryptoJS.enc.Utf8.parse(PUBLIC_KEY.replace(/\r|\n/, '').slice(26, 42)),
  });
  const data: unknown = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  return { data };
};

export const login = () => {
  location.href = pathCompletion('/login');
};

export const getScript = (src: string, func: () => void) => {
  let script = document.createElement('script');
  script.async = true;
  script.src = src;
  if (func) {
    script.onload = func;
  }

  const head = document.getElementsByTagName('head')[0];
  if (!head) throw new Error('Missing document head');
  head.appendChild(script);
};

export const getRequest = () => {
  const encodeUrl = new URL(location.href.replace('#', encodeURIComponent('#')));
  const search = encodeUrl.search.replace('?', '');
  const theRequest: SsoQuery = {};
  for (const part of search.split('&')) {
    const [key = '', value = ''] = part.split('=');
    theRequest[key] = decodeURIComponent(value);
  }

  return theRequest;
};

export const replenishRet = (ret: string, pc_slide: string) => {
  const url = decodeURIComponent(ret);
  const isHash = url.includes('#');
  const isPcSlide = pc_slide.includes('true');

  const add = (url: string) => {
    return url.includes('?') ? `${url}&pc_slide=true` : `${url}?pc_slide=true`;
  };

  if (!isPcSlide) {
    return url;
  }

  if (isHash) {
    const [page = '', hash] = url.split('#');
    const newUrl = add(page);
    return `${newUrl}#${hash}`;
  } else {
    return add(url);
  }
};

export const formatOtherParam = (param: Record<string, string | undefined>) => {
  let result = '';

  for (let i in param) {
    result = `${result ? `${result}&` : ``}` + `${i}=${param[i]}`;
  }

  return result;
};

export const addOtherParam = <T extends string | null | undefined>(url: T, param: string): string | T => {
  if (url) {
    return url.includes('?') ? `${url}&${param}` : `${url}?${param}`;
  } else {
    return url;
  }
};

/**
 * 校验返回地址是否属于明道云域名或当前页面来源。
 */
export const checkOriginUrl = (url: string | null | undefined) => {
  if (!url) return '';

  try {
    const target = new URL(url, location.origin);
    const isMingdaoDomain = target.hostname === 'mingdao.com' || target.hostname.endsWith('.mingdao.com');
    const isTrusted = target.origin === location.origin || isMingdaoDomain;
    const isHttp = ['http:', 'https:'].includes(target.protocol);

    return isHttp && isTrusted ? target.href : '';
  } catch {
    return '';
  }
};

export const checkLogin = () => {
  let isLoing = false;
  ajax.post({
    url: __api_server__.main + 'Login/CheckLogin',
    data: {},
    async: false,
    decodeData: decodeSsoLoginStatus,
    success: result => {
      if (result.data) {
        isLoing = true;
      }
    },
  });
  return isLoing;
};

export const getGlobalMeta = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    ajax.post({
      url: __api_server__.main + 'Global/GetGlobalMeta',
      data: {},
      async: true,
      decodeData: decodeBootstrapReply,
      success: result => {
        const data = result.data;
        const bootstrapWindow: {
          config: Window['config'] | undefined;
          md?: { global: Record<string, unknown> } | undefined;
        } = window;
        bootstrapWindow.config = data.config;
        if (!bootstrapWindow.md) bootstrapWindow.md = { global: data['md.global'] };
        else bootstrapWindow.md.global = data['md.global'];
        if (bootstrapWindow.md.global && !bootstrapWindow.md.global['Account'])
          bootstrapWindow.md.global['Account'] = {};
        resolve();
      },
      error: error => reject(error),
    });
  });
};

export const getCurrentTime = (time?: Date | null) => {
  let date = time ? time : new Date();
  let month = zeroFill(date.getMonth() + 1);
  let day = zeroFill(date.getDate());
  let hour = zeroFill(date.getHours());
  let minute = zeroFill(date.getMinutes());
  let second = zeroFill(date.getSeconds());
  let curTime = date.getFullYear() + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
  return curTime;
};

function zeroFill(i: number) {
  if (i >= 0 && i <= 9) {
    return '0' + i;
  } else {
    return i;
  }
}

export const getTimeNow = (strTime: string) => {
  return Date.parse(strTime.replace(/-/g, '/'));
};

export const isBefore = (time: string) => {
  let contrastTime = getTimeNow(time);
  let currentTime = getTimeNow(getCurrentTime());
  return currentTime < contrastTime;
};

export const setCookie = (name: string, value: string | number | boolean, expire?: Date | null) => {
  let expireDate;

  if (!expire) {
    let nextyear = new Date();
    nextyear.setFullYear(nextyear.getFullYear() + 10);
    expireDate = nextyear.toUTCString();
  } else {
    expireDate = expire.toUTCString();
  }

  if (document.domain.indexOf('mingdao.com') == -1) {
    document.cookie = name + '=' + escape(String(value)) + ';expires=' + expireDate + ';path=/';
  } else {
    document.cookie = name + '=' + escape(String(value)) + ';expires=' + expireDate + ';path=/;domain=.mingdao.com';
  }
};
