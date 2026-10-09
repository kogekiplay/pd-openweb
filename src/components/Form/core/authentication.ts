import _ from 'lodash';
import weixinApi from 'src/api/weixin';
import workWeiXinApi from 'src/api/workWeiXin';
import {
  appSignature,
  dingSignature,
  reportNativeConfigError,
  wechatSignature,
  workWechatSignature,
} from './authenticationTypes';

export const bindWeiXin = (projectId: string) => {
  return new Promise<void>((reslove, reject) => {
    const entryUrl = sessionStorage.getItem('entryUrl');
    const url = (window.isIphone ? entryUrl || location.href : location.href).split('#')[0] ?? '';
    weixinApi
      .getWeiXinConfig({
        url,
        projectId,
      })
      .then((reply: unknown) => {
        const data = wechatSignature(reply);
        window.wx.config({
          debug: false,
          appId: data.appId,
          timestamp: data.timestamp,
          nonceStr: data.nonceStr,
          signature: data.signature,
          jsApiList: ['scanQRCode'],
        });
        window.wx.ready(() => {
          reslove();
        });
        window.wx.error((res: unknown) => {
          reportNativeConfigError(res, url);
          reject();
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

export const bindWxWork = (projectId: string) => {
  return new Promise<void>((reslove, reject) => {
    const url = location.href.split('#')[0] ?? '';

    workWeiXinApi
      .getSignatureInfo({
        projectId,
        url,
        suiteType: 8,
        tickettype: 1,
      })
      .then((reply: unknown) => {
        const data = workWechatSignature(reply);

        window.wx.config({
          beta: true,
          debug: false,
          appId: data.corpId,
          timestamp: data.timestamp,
          nonceStr: data.nonceStr,
          signature: data.signature,
          jsApiList: ['scanQRCode'],
        });
        window.wx.ready(() => {
          reslove();
        });
        window.wx.error((res: unknown) => {
          reportNativeConfigError(res, url);
          reject();
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

export const bindFeishu = (projectId: string) => {
  return new Promise<void>((reslove, reject) => {
    const url = location.href.split('#')[0] ?? '';
    workWeiXinApi
      .getFeiShuSignatureInfo({
        projectId,
        url,
      })
      .then((reply: unknown) => {
        if (!reply) {
          reject(1);
          return;
        }
        const data = appSignature(reply);
        const sdk = window.h5sdk;
        if (!sdk) throw new Error('Feishu SDK unavailable');

        sdk.config({
          appId: data.appId,
          timestamp: data.timestamp,
          nonceStr: data.noncestr,
          signature: data.signature,
          jsApiList: ['scanCode', 'getLocation'],
          onSuccess: () => {},
          onFail: (err: unknown) => {
            reportNativeConfigError(err, url);
            reject();
          },
        });
        sdk.ready(() => {
          reslove();
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

export const bindDing = (projectId: string) => {
  return new Promise<void>((reslove, reject) => {
    const entryUrl = sessionStorage.getItem('entryUrl') || location.href;
    const url = (window.isIphone ? location.href : entryUrl).split('#')[0] ?? '';
    workWeiXinApi
      .getDDSignatureInfo({
        projectId,
        url,
      })
      .then((reply: unknown) => {
        if (!reply) {
          reject();
          return;
        }
        const data = dingSignature(reply);

        window.dd.config({
          agentId: data.agentId,
          corpId: data.corpId,
          timeStamp: data.timestamp,
          nonceStr: data.noncestr,
          signature: data.signature,
          jsApiList: ['device.geolocation.get'],
        });
        window.dd.ready(() => {
          reslove();
        });
        window.dd.error((err: unknown) => {
          reportNativeConfigError(err, url);
          reject();
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

export const bindWeLink = (projectId: string) => {
  return new Promise<void>((reslove, reject) => {
    const url = location.href.split('#')[0] ?? '';
    workWeiXinApi
      .getWeLinkSignatureInfo({
        projectId,
        url,
      })
      .then((reply: unknown) => {
        if (!reply) {
          reject();
          return;
        }
        const data = appSignature(reply);

        window.HWH5.config({
          appId: data.appId,
          timestamp: data.timestamp,
          noncestr: data.noncestr,
          signature: data.signature,
          jsApiList: ['getLocation'],
        });
        window.HWH5.ready(() => {
          reslove();
        });
        window.HWH5.error((err: unknown) => {
          reportNativeConfigError(err, url);
          reject();
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

export const handleTriggerEvent = (
  scanFn: () => void,
  bindFn: PromiseLike<void>,
  errorFn: (error: unknown) => void = _.noop,
) => {
  if (window.currentUrl !== location.href) {
    window.currentUrl = location.href;
    window.configSuccess = false;
    window.configLoading = false;
  }

  if (window.configSuccess) {
    void Promise.resolve(bindFn).catch(() => {});
    scanFn();
  } else {
    if (!window.configLoading) {
      Promise.resolve(bindFn)
        .then(() => {
          window.configLoading = false;
          window.configSuccess = true;
          scanFn();
        })
        .catch(error => {
          window.configLoading = false;
          errorFn(error);
        });
    } else {
      void Promise.resolve(bindFn).catch(() => {});
    }
  }
};
