import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import 'dayjs/locale/ms';
import 'dayjs/locale/th';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import _ from 'lodash';
import moment from 'moment';
import { StyleSheetManager } from 'styled-components';
import { LoadDiv } from 'ming-ui';
import accountSetting from 'src/api/accountSetting';
import global from 'src/api/global';
import shouldForwardProp from 'src/common/shouldForwardProp';
import { prefetchMyPermissions } from 'src/components/checkPermission';
import { resetPortalUrl } from 'src/pages/AuthService/portalAccount/util.js';
import { initThemeMode } from 'src/router/globalEvents';
import { navigateTo, navigateToLogin, navigateToLogout, redirect } from 'src/router/navigateTo';
import { browserIsMobile, getPathWithoutSubPath, pathCompletion } from 'src/utils/common';
import { prefetchContactInfo } from 'src/utils/project';
import { getPssId, setPssId } from 'src/utils/pssId';
import { installPlatformTheme } from 'src/common/theme';

// 装平台调色板。放在模块级是因为【72 个入口全都 import 这个文件】，
// 这里是唯一一处「必经、且早于任何渲染」的位置。
//
// 装完之后 theme-default.less / theme-dark.less 里那些主色字面值就只剩
// 「JS 还没执行时那一帧的兜底」这一个作用了 —— inline style 恒压过它们。
installPlatformTheme();

/** 存储分发类入口 状态 和 分享id */
const parseShareId = () => {
  window.shareState = {};
  if (/\/public\/print/.test(location.pathname)) {
    window.shareState.isPublicPrint = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/print\/(\w{24})/) || '')[1];
  }

  if (/\/public\/query/.test(location.pathname)) {
    window.shareState.isPublicQuery = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/query\/(\w{24})/) || '')[1];
  }

  if (/\/public\/form/.test(location.pathname)) {
    window.shareState.isPublicForm = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/form\/(\w{32})/) || '')[1];
  }

  if (/\/worksheet\/form\/preview/.test(location.pathname)) {
    window.shareState.isPublicFormPreview = true;
  }

  if (/\/public\/view/.test(location.pathname)) {
    window.shareState.isPublicView = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/view\/(\w{24})/) || '')[1];
  }

  if (/\/public\/record/.test(location.pathname)) {
    window.shareState.isPublicRecord = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/record\/(\w{24})/) || '')[1];
  }

  if (/\/public\/workflow/.test(location.pathname)) {
    window.shareState.isPublicWorkflowRecord = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/workflow\/(\w{24})/) || '')[1];
  }

  if (/\/public\/page/.test(location.pathname)) {
    window.shareState.isPublicPage = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/page\/(\w{24})/) || '')[1];
  }

  if (/\/public\/chart/.test(location.pathname)) {
    window.shareState.isPublicChart = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/chart\/(\w{24})/) || '')[1];
  }

  if (/\/public\/chatbot/.test(location.pathname)) {
    window.shareState.isPublicChatbot = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/chatbot\/(\w{24})/) || '')[1];
  }

  if (/\/public\/apidoc/.test(location.pathname)) {
    window.shareState.isPublicApidoc = true;
    window.shareState.shareId = (location.pathname.match(/.*\/public\/apidoc\/(\w{24})/) || '')[1];
  }
};

const isPublicMingoPlan = () => /\/public\/mingo\/plan(?:\/|$)/i.test(location.pathname);

// 官网免登录跳转承接页路由（PC + 移动端 mingo 创建应用）
const isMingoCreateAppRoute = () => {
  const pathname = getPathWithoutSubPath(location.pathname);
  const params = new URLSearchParams(location.search || '');
  const isMarkedMingoChat =
    /\/mingo\/chat\/[^/]+(?:\/|$)/i.test(pathname) && (params.get('anon') === '1' || params.get('entry') === '1');

  return /\/mobile\/mingo\/create-app(?:\/|$)/i.test(pathname) || isMarkedMingoChat;
};

const clearLocalStorage = () => {
  try {
    Object.keys(localStorage)
      .map(key => ({ key, size: Math.floor(new Blob([localStorage[key]]).size / 1024) }))
      .filter(item => item.size > 200 || item.key.startsWith('_AMap_'))
      .forEach(item => {
        localStorage.removeItem(item.key);
      });
  } catch (err) {
    console.log(err);
  }
};

// 格式化url末尾的斜杠
const normalizeUrls = obj => {
  for (const key in obj) {
    const value = obj[key];

    // AppFileServer、WebUrl、PlatformUrl 不处理
    // AjaxApiUrl 应用库引用的library中没有斜杠，所以不处理
    if (['AppFileServer', 'WebUrl', 'PlatformUrl', 'AccountUrl', 'AjaxApiUrl'].includes(key)) {
      continue;
    }

    // 是字符串、以http或https开头、斜杠结尾
    if (typeof value === 'string' && /^https?:\/\/.*?\/$/i.test(value)) {
      obj[key] = value.trim().replace(/\/$/, '');
    }
  }

  return obj;
};

const getGlobalMeta = ({ allowNotLogin, requestParams, sync = false }: any = {}) => {
  // 处理location.href方法异步的问题
  window.isWaiting = false;

  // 处理各类分享id
  parseShareId();

  // 清除 AMap 和 体积大于200k的 localStorage
  clearLocalStorage();

  const defaultGlobal = window.md ? _.cloneDeep(window.md.global) : {};
  const urlObj = new URL(decodeURIComponent(location.href));
  let args = requestParams || {};

  if (/^#publicapp/.test(urlObj.hash)) {
    window.isPublicApp = true;
    window.publicAppAuthorization = urlObj.hash.slice(10).replace('#isPrivateBuild', '');
  }

  args.lang = getCurrentLangCode();

  // 获取global数据
  /**
   * 拿到 meta 之后的全部处理。抽出来只是为了让取数那一步能异步。
   * 里面的 return 原本是从 getGlobalMeta 返回，现在是从 finish 返回 —— 语义一样，
   * 都是「到此为止，后面的处理不做了」。
   */
  const finish = data => {
    window.config = data.config || {};
    const formatUrlEnum = ['Config', 'FileStoreConfig'];
    const globalData = _.merge(defaultGlobal, data['md.global']);
    const formatGlobalData = {
      ...globalData,
      ...formatUrlEnum.reduce((acc, key) => {
        const config = globalData[key];
        acc[key] = normalizeUrls(config);
        return acc;
      }, {}),
    };
    window.md.global = formatGlobalData;

    window.platformENV.isOverseas = /^nocoly/.test(md.global.Config.ProductCode);
    window.platformENV.isLocal = /(server|server-platform)$/.test(md.global.Config.ProductCode);
    window.platformENV.isPlatform = /(saas|platform)$/.test(md.global.Config.ProductCode);

    // 海外用户默认语言为英文，默认国家为香港
    if (window.platformENV.isOverseas) {
      window.md.global.Config.DefaultLang = 'en';
      window.md.global.Config.DefaultConfig.initialCountry = 'hk';
      window.md.global.Config.DefaultConfig.preferredCountries = ['hk'];
    }

    const lang = getCurrentLang();

    // 设置默认语言
    if (!lang) {
      window.isWaiting = true;
      const sysDefaultLang = window.getDefaultLangKey();

      if (
        (location.pathname.includes('/public/') && !isPublicMingoPlan()) ||
        location.pathname.includes('/recordfileupload')
      ) {
        const url = new URL(location.href);
        url.searchParams.set('sys_lang', sysDefaultLang);
        location.href = pathCompletion(`${url.pathname}${url.search}`);
      } else {
        setCookie('i18n_langtag', sysDefaultLang);
        window.location.reload();
      }

      return;
    }

    // 设置日期库语言。moment 和 dayjs 的 locale id 完全一致，所以共用一个取值。
    //
    // 【为什么 dayjs 也要设，而且语言包必须在文件顶部显式 import】
    // dayjs 的语言包【不会】随 antd 的 locale 一起生效：antd 的 zh_CN 只管
    //「今天」「YYYY年」这些它自己的文案，月份缩写和星期缩写取自底层日期库的
    // localeData（generateConfig 的 getShortMonths / getShortWeekDays）。
    // 语言包没 import 进来时 dayjs【静默】退回 en，日历头会是「2026年 Sep」、
    // 星期是 Su Mo Tu —— 中英混杂，且不报任何错。
    //
    // moment 这边的语言包由 webpack 的 MomentLocalesPlugin 保留（localesToKeep），
    // dayjs 没有对应机制，只能静态 import（各 1~2KB；动态 import 会和首屏渲染抢时序）。
    // 两边保留的语言集保持一致。
    //
    // 注：ming-ui 的 MdAnt* 系列已改用 moment 底层（见 ming-ui/components/mdAntPickers.ts），
    // 不依赖 dayjs 这一支；但仍有一批文件直接 `import { DatePicker } from 'antd'`，
    // 用的是 antd 默认的 dayjs 版本，对它们这行是实打实生效的。
    const dateLocale = _.includes(['en', 'ja', 'th', 'ms'], lang) ? lang : lang === 'zh-Hant' ? 'zh-tw' : 'zh-cn';

    moment.locale(dateLocale);
    dayjs.locale(dateLocale);

    // 设置语言
    $('body').attr('id', lang);

    if (window.shareState.shareId) {
      initThemeMode();
    }

    // H5系统打印
    const isMobilePrintForm =
      /^\/printForm(?:\/|$)/.test(getPathWithoutSubPath(location.pathname)) && browserIsMobile();

    if (allowNotLogin) window.allowNotLogin = true;

    if (allowNotLogin || window.isPublicApp || (isMobilePrintForm && !md.global.Account.accountId)) return;

    if (!md.global.Account.accountId) {
      navigateToLogin();
      return;
    }

    initThemeMode();

    if (
      ((location.href.includes('/portal/') || location.href.indexOf('theportal.cn') > -1) &&
        !md.global.Account.isPortal) ||
      (!location.href.includes('/portal/') &&
        location.href.indexOf('theportal.cn') === -1 &&
        md.global.Account.isPortal)
    ) {
      window.isWaiting = true;
      if (window.isWeiXin) {
        navigateToLogout();
      } else {
        if (
          md.global.Account.isPortal &&
          !location.href.includes('theportal.cn') &&
          !location.href.includes('/portal/') &&
          md.global.Account.appId
        ) {
          location.href = pathCompletion(`/portal/${md.global.Account.appId}`);
          return;
        }

        location.href = pathCompletion('/dashboard');
      }

      return;
    }

    // 第一次进入
    if (!md.global.Account.langModified) {
      accountSetting.autoEditAccountLangSetting({ langType: getCurrentLangCode(lang) });

      if (!md.global.Account.isPortal && !urlObj.href.includes('oauth/authorize') && !isMingoCreateAppRoute()) {
        navigateTo('/app/my');
      }
    } else if (
      md.global.Account.lang !== lang &&
      !window.shareState.isPublicFormPreview &&
      !urlObj.hash.includes('i18n_reload') &&
      !localStorage.getItem('i18n_reload')
    ) {
      setCookie('i18n_langtag', md.global.Account.lang);

      if (window.top !== window.self) {
        localStorage.setItem('i18n_reload', true);
      } else {
        urlObj.hash = 'i18n_reload';
      }

      window.location.reload();
      window.isWaiting = true;
      return;
    }

    // 设置网络多语言
    if (md.global.ProjectLangs && md.global.ProjectLangs.length) {
      const projectLangs = md.global.ProjectLangs.filter(o => o.langType === getCurrentLangCode(lang)).map(o => ({
        projectId: o.projectId,
        companyName: o.data[0].value || (_.find(v => v.projectId === o.projectId) || {}).companyName,
      }));
      const mergedProjects = _.merge(
        _.keyBy(md.global.Account.projects, 'projectId'),
        _.keyBy(projectLangs, 'projectId'),
      );

      md.global.Account.projects = _.values(mergedProjects);
    }

    // HAP显示人事
    if (!window.platformENV.isOverseas && !window.platformENV.isLocal) {
      md.global.SysSettings.forbidSuites = (md.global.SysSettings.forbidSuites || '').replace('5', '');
    }

    // 加载云客服
    !md.global.Account.isPortal && window.mdCustomerService && window.mdCustomerService();

    // 设置md_pss_id
    setPssId(getPssId());

    md.global.Account.isPortal && resetPortalUrl();

    redirect(location.pathname);

    /* 【启动时把几个「同步取值」的缓存一次焐热】
       这些取值函数的签名是同步的（调用方在 render 里或算默认值时直接要结果），
       所以它们以前在缓存未命中时发【同步 XHR】—— 主线程同步请求是被废弃的用法。
       改法统一是：签名不动，这里先异步取好填进缓存，真正用到时一定命中。
       返回这个 promise，外面的 Pre 组件会等它完成后才收起 loading。
         · getMyPermissions：20 个调用点，多数在 render 里当条件用
         · getContactInfo：表单默认值要的手机号/邮箱（formUtils 4 处） */
    return Promise.all([
      ...(_.get(md, 'global.Account.projects') || []).map(p => prefetchMyPermissions(p.projectId)),
      prefetchContactInfo(),
    ]);
  };

  // 【只有 4 个 share 页走 sync】它们用 preall({ type: 'function' }) 这个哨兵值，
  // 调完紧接着就 new 出页面对象读 md.global，没法改成异步（见本文件末尾那个分支）。
  // 其余 47 个入口一律走异步：Pre 组件本来就有 loading 态，正好用上，
  // 从此不再有 "Synchronous XMLHttpRequest on the main thread is deprecated"。
  if (sync) {
    finish(global.getGlobalMeta(args, { ajaxOptions: { sync: true } }));
    return Promise.resolve();
  }

  return global.getGlobalMeta(args).then(finish);
};

const wrapComponent = function (Comp, { allowNotLogin, requestParams } = {}) {
  class Pre extends React.Component<any, any> {
    constructor(props) {
      super(props);
      this.state = {
        loading: true,
      };
    }
    componentDidMount() {
      // 【等取完再放行】getGlobalMeta 以前是同步 XHR，所以下面这句 setState 紧跟着写也没事；
      // 现在改成异步，正好用上这个组件本来就有的 loading 态 —— 期间显示 <LoadDiv>，
      // 被包的 Comp 在 md.global 填好之前不会渲染。
      getGlobalMeta({ allowNotLogin, requestParams }).finally(() => {
        this.setState({ loading: false });
      });
    }

    render() {
      const { loading } = this.state;

      if (window.isDingTalk) {
        document.title = _l('应用');
      }

      return (
        <StyleSheetManager shouldForwardProp={shouldForwardProp}>
          {loading || window.isWaiting ? <LoadDiv size="big" className="pre" /> : <Comp {...this.props} />}
        </StyleSheetManager>
      );
    }
  }

  return Pre;
};

export default function (Comp, { allowNotLogin, requestParams } = {}) {
  if (_.isObject(Comp) && Comp.type === 'function') {
    // 【这条分支只能同步】4 个 share 页用 preall({ type: 'function' }) 当哨兵，
    // 调完紧接着就 new 出页面对象去读 md.global（见 kc/folderShare、kc/shareMobile、
    // Statistics/PublicShare、Chatbot/PublicShare），改异步要连它们一起动。
    // 这 4 个页面需要真实分享链接才能验证，单独一批做。
    getGlobalMeta({ allowNotLogin, requestParams, sync: true });
  } else {
    return wrapComponent(Comp, { allowNotLogin, requestParams });
  }
}

if (location.href.indexOf('?debug') > -1) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/vconsole/dist/vconsole.min.js';
  document.head.appendChild(script);
  script.onload = () => {
    new VConsole();
  };
}
