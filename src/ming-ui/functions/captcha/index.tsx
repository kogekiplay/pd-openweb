import { Fragment } from 'react';
import { Dialog } from 'ming-ui';
import { generateRandomPassword } from 'src/utils/common';
import './index.less';

const TENCENT_CAPTCHA_SCRIPT_URL = 'https://turing.captcha.qcloud.com/TJCaptcha.js';
const LANG_MAPS: Record<string, string> = {
  'zh-Hans': 'zh-cn',
  'zh-Hant': 'zh-hk',
  ja: 'en',
  en: 'en',
};

let tencentCaptchaLoaderPromise;

function loadTencentCaptcha() {
  if (window.TencentCaptcha) return Promise.resolve(window.TencentCaptcha);

  if (!tencentCaptchaLoaderPromise) {
    tencentCaptchaLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src = TENCENT_CAPTCHA_SCRIPT_URL;
      script.onload = () => resolve(window.TencentCaptcha);
      script.onerror = () => {
        tencentCaptchaLoaderPromise = undefined;
        reject(new Error('Failed to load TencentCaptcha'));
      };

      document.head.appendChild(script);
    });
  }

  return tencentCaptchaLoaderPromise;
}

/** 验证通过后的结果：图片验证码是 { ret: 0, 用户输入的 ticket, 本地随机串 }，腾讯验证码是它回调给的对象 */
export interface CaptchaResult {
  /** 0 = 通过；腾讯验证码里 2 = 用户把验证框关了 */
  ret: number;
  ticket?: string;
  randstr?: string;
}

export default function captcha(
  callback: (res: CaptchaResult) => void = () => {},
  // 图片验证码弹窗关闭时由 Dialog.confirm 调用，带着「是不是点确定关掉的」；腾讯验证码加载失败时不带参数
  onCancel: (isOkBtn?: boolean) => void = () => {},
) {
  const randstr = generateRandomPassword(16);

  const getImgLink = () => {
    return `${
      __api_server__.main
    }code/CreateVerifyCodeImage?width=320&height=130&fontSize=30&randstr=${randstr}&${Math.random()}`;
  };

  if (md.global.getCaptchaType() === 1) {
    Dialog.confirm({
      title: _l('请输入验证码'),
      closable: false,
      anim: false,
      width: 368,
      description: (
        <Fragment>
          <input
            name="functionsCaptcha"
            autoComplete="off"
            type="text"
            className="captchaInput"
            autoFocus
            placeholder={_l('不区分大小写')}
          />
          <div className="captchaImg">
            <img src={getImgLink()} />
          </div>
          <div className="mTop10">
            <span
              className="colorPrimary hoverColorPrimaryDark pointer"
              onClick={() => {
                $('.captchaImg img').attr('src', getImgLink());
              }}
            >
              {_l('看不清，换一张')}
            </span>
          </div>
        </Fragment>
      ),
      onOk: () => {
        return new Promise(function (reslove, reject) {
          const value = String($('.captchaInput').val() ?? '').trim();

          if (!value) {
            alert(_l('请输入验证码'), 3);
            reject(true);
          } else {
            callback({ ret: 0, ticket: value, randstr: randstr });
            reslove();
          }
        });
      },
      onCancel,
    });
    return;
  }

  loadTencentCaptcha()
    .then(TencentCaptcha => {
      new TencentCaptcha(md.global.Config.CaptchaAppId.toString(), callback, {
        needFeedBack: false,
        userLanguage: LANG_MAPS[window.getCurrentLang()],
      }).show();
    })
    .catch(() => {
      alert(_l('加载失败，请刷新重试'), 2);
      onCancel();
    });
}
