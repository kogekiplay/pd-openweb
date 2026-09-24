/**
 * 环境全局声明 —— 只为「让环境全局可解析」，不为「消灭错误」。
 *
 * 收录依据：eslint.config.js:44-77 的 languageOptions.globals 是本仓库对
 * 「运行期存在但没有 import」的唯一权威登记表。此处逐条镜像该表，并排除
 * `File`（已在 typescript/lib/lib.dom.d.ts 声明为 `declare var File`，
 * 重复声明会触发 TS2403）。
 *
 * 全部用 `any`：这是有意的下限。给出更精确的签名（例如把 _l 写成
 * (key: string, ...args: any[]) => string）会在测量阶段引入本轮无法验证的
 * 新错误，属于污染，故推迟到试点阶段再做。
 *
 * 【例外：$ / jQuery 已经收窄到真实类型】见下方 jQuery 一节。挑它先做的依据是
 * tools/analyze-any-origins.ts 的爆炸半径排名：`$: any` 一个声明喂出 184 条 TS7006，
 * 是全仓最大的单点。而且它和这里其余的 any 有本质区别 —— jQuery 是有官方类型的
 * 真实库，把它标成 JQueryStatic 是【如实描述运行期真相】，不是猜。
 */

/// <reference types="jquery" />

// ---- 由 src/common/global.js 在启动时挂到 window 上 ----
// 多语言翻译（src/common/global.ts 的 window._l）：key 查翻译表、查不到回落到 key 本身；
// 参数按顺序替换文案里的 %0、%1……（替换时被 String() 化，所以数字也可以）。返回的永远是字符串。
declare var _l: (key: string, ...args: (string | number)[]) => string;
/**
 * 全局配置树。【形状取自生产运行时，不是照文档抄的】——
 * 2026-09-16 在 oa.tlytelec.com 上把 md.global 逐层 dump 下来生成。
 *
 * 【为什么值得从 any 改成真实形状】全仓读 md.global.* 约 1700 次
 *（Account 999、SysSettings 260、Config 250、FileStoreConfig 123），
 * 是被引用最多的一个对象。标成 any 时属性名写错【不会有任何提示】，
 * 拿到 undefined 只会在运行时表现成功能悄悄不生效。
 *
 * 【可选键是如实描述，不是放水】带 ? 的那些在本套私有化部署的采样里确实没有，
 * 但代码会读，且都是合理的：外部门户登录才有的 Account.appId、
 * SaaS 才有的 Config.MdNoticeServer / disableKf5 等。
 * 这批键是【由编译器指出来的】：先按采样写死，再把报错的键逐个改成可选。
 *
 * 【采样的局限】只是一套部署、一个账号。将来若在别处见到新键，按同样办法补，
 * 不要图省事改回 any —— 那等于把 1700 个调用点的保护一次性丢掉。
 */
declare var md: {
  /**
   * 【运行时默认没有这个键】它是从浏览器控制台手动设的调试开关，
   * 调用点一律写成 md.cheat && md.cheat.xxx。标成可选是如实描述，不是放水。
   */
  cheat?: Record<string, any>;
  global: {
    Account: {
      accountId: string;
      hrVisible: boolean;
      guideSettings: Record<string, any>;
      lang: string;
      appLang: string;
      langModified: boolean;
      map: number;
      timeZone: number;
      fullname: string;
      email: string;
      mobilePhone: string;
      avatarMiddle: string;
      avatar: string;
      createTime: string;
      numLogin: number;
      companyName: string;
      profession: string;
      isOpenMessageSound: boolean;
      isOpenMessageTwinkle: boolean;
      backHomepageWay: number;
      isOpenMingoAI: boolean;
      isOpenMessage: boolean;
      isOpenSearch: boolean;
      isOpenFavorite: boolean;
      isShowToolName: boolean;
      isOpenMessageList: boolean;
      isOpenCommonApp: boolean;
      commonAppShowType: number;
      commonAppOpenType: number;
      messageListShowType: number;
      projects: any[];
      isPortal: boolean;
      isSSO: boolean;
      superAdmin: boolean;
      appId?: any;
      cheat?: any;
      watermark?: any;
      watermarkTxt?: any;
      addressSuffix?: any;
      externalProjects?: any;
    };
    Config: {
      DefaultLang: string;
      ServiceTel: string;
      DefaultConfig: Record<string, any>;
      AjaxApiUrl: string;
      WorkFlowUrl: string;
      WsReportUrl: string;
      FormOAUrl: string | null;
      HrCheckUrl: string | null;
      HrDossierUrl: string | null;
      WebUrl: string;
      PlatformUrl: string;
      AccountUrl: string;
      AppFileServer: string;
      WorksheetDownUrl: string;
      DataPipelineUrl: string;
      AggregationUrl: string;
      HDPUrl: string;
      HDPApiUrl: string;
      PlatformApiUrl: string;
      KnowledgeApiUrl: string;
      PluginRuntimeUrl: string | null;
      WorkflowPluginUrl: string;
      PublicFormWebUrl: string | null;
      IntegrationAPIUrl: string;
      DocviewStartUrl: string;
      WpsDocEditUrl: string;
      WpsDocPreviewUrl: string;
      OpenApiDocUrl: string;
      CloudApiUrl: string | null;
      Logo: string;
      IsLocal: boolean;
      CaptchaType: number;
      CaptchaAppId: number;
      DefaultRegion: string;
      DefaultOftenRegions: any[];
      DefaultMap: number;
      DefaultTimeZone: number;
      ServerTime: string;
      MarketUrl: string | null;
      MCPUrl: string;
      AgentUrl: string;
      DefaultSmsProvider: any[];
      EnableWpsDocPreview: boolean;
      ProductCode: string;
      ApiUrl: string;
      MapUrl: string;
      HelpUrl: string;
      PdocUrl: string;
      Version: string;
      IsCluster: boolean;
      IsMultiMds2: boolean;
      IsPlatformLocal: boolean;
      IsCobranding: boolean;
      EnableDataPipeline: boolean;
      EnableHDP: boolean;
      EnableRAG: boolean;
      SessionCookieExpireMinutes: number;
      HttpOnly: boolean;
      ShowLicense: boolean;
      EnableBot: boolean;
      EnableDocEdit: boolean;
      DisableModules: any[];
      pushUniqueId: string;
      MdNoticeServer?: any;
      disableKf5?: any;
    };
    PriceConfig: {
      SmsPrice: string;
      EmailPrice: string;
      PdfPrice: string;
      DataPipelinePrice: string;
    };
    getCaptchaType: Function;
    SysSettings: {
      passwordRegex: string;
      passwordRegexTip: string;
      hideHelpTip: boolean;
      enableMobilePhoneRegister: boolean;
      enableEmailRegister: boolean;
      hideRegister: boolean;
      hideBrandLogo: boolean;
      brandLogoHeight: number;
      brandLogoUrl: string;
      hideBrandName: boolean;
      forbidSuites: string;
      enableFooterInfo: boolean;
      footerThemeColor: number;
      onlyAdminCreateApp: boolean;
      createAppDict: Record<string, any>;
      hideDownloadApp: boolean;
      downloadAppRedirectUrl: string;
      hideTemplateLibrary: boolean;
      templateLibraryTypes: string;
      templateLibraryAuditProjectId: string;
      hideIntegration: boolean;
      hideIntegrationLibrary: boolean;
      hidePlugin: boolean;
      hideDataPipeline: boolean;
      hideHDPAI: boolean;
      hideAIBasicFun: boolean;
      hideAIGCNode: boolean;
      hideRagEmbedFun: boolean;
      hideOCR: boolean;
      hideWorkWeixin: boolean;
      hideDingding: boolean;
      hideFeishu: boolean;
      hideLark: boolean;
      hideWelink: boolean;
      hideWeixin: boolean;
      workflowBatchGetDataLimitCount: number;
      worktableBatchOperateDataLimitCount: number;
      fileUploadLimitSize: number;
      installCaptainUrl: string;
      serviceStatusWebhookUrl: string;
      workWxSelfBuildNoticUrl: string;
      enableAIErrorPush: boolean;
      refreshReportInterval: number;
      allowBindAccountNoVerify: boolean;
      workflowSubProcessDataLimitCount: number;
      worksheetExcelImportDataLimitCount: number;
      exportAppWorksheetLimitCount: number;
      appRecycleDays: number;
      appItemRecycleDays: number;
      worksheetRowRecycleDays: number;
      appBackupRecycleDays: number;
      enableTwoFactorAuthentication: boolean;
      twoFactorAuthenticationSwitchType: number;
      twoFactorAuthenticationPriorityType: number;
      firstLoginResetPassword: boolean;
      passwordOverdueDays: number;
      passwordOverdueDaysUpdateTimestamp: number;
      brandName: string;
      brandLogo: string;
      brandHomeImage: string;
      brandHomeImageUrl: string;
      enableDeclareConfirm: boolean;
      enableDeclareRegisterConfirm: boolean;
      enableCreateProject: boolean;
      enableEditAccountInfo: boolean;
      enableVerificationCodeLogin: boolean;
      enableSmsCustomContent: boolean;
      enableBackupWorksheetData: boolean;
      enableMultipleDevicesUse: boolean;
      multipleDevicesUseSwitchType: number;
      enableRequiredStrictVerification: boolean;
      enableMap: boolean;
      enableSso: boolean;
      ssoIconUrl: string;
      enablePromptNewVersion: boolean;
      sessionExpireRedirectType: number;
      enableVoiceToText: boolean;
      enableOnlinSearch: boolean;
      enableAIConnector: boolean;
      aiBrandName: string;
      aiBrandThemeColor: string;
      aiBrandLogoUrl: string;
      allowSmsSignatureAutoApprove: boolean;
      hideMicrosoftEntra: boolean;
      defaultLang: number;
      initialized: boolean;
      hideWorksheetControl?: any;
      brandLogoRedirectUrl?: any;
      loginGotoUrl?: any;
      loginGotoAppId?: any;
    };
    APPInfo: {
      taskAppID: string;
      taskFolderAppID: string;
      calendarAppID: string;
      kcAppID: string;
      worksheetAppID: string;
      worksheetRowAppID: string;
    };
    FileStoreConfig: {
      uploadHost: string;
      uploadHostV2: string;
      documentHost: string;
      pictureHost: string;
      mediaHost: string;
      pubHost: string;
    };
    Versions: Record<string, any>[];
    ProjectLangs?: any;
    PorjectColor: Record<string, any>[];
  };
};
/**
 * src/common/global.js:721 `window.mdyAPI = (controllerName, actionName, requestData, options = {}) =>`
 *
 * 【为什么要写成函数而不是 `any`】写 any 的话 src/api/* 里所有生成的方法
 * 返回类型也是 any，于是调用点 `.then(res => ...)` 拿不到任何上下文类型，
 * res 成了【隐式 any】—— 光 res/result/data/response 这四个名字就 3745 条 TS7006。
 * 声明成返回 Promise<any> 之后，这些回调参数由上下文推出类型，一个调用点都不用改。
 *
 * 【为什么是 Promise<any> 而不是更精确的类型】本仓没有响应体的 schema
 * （src/api/* 由 scripts/mainApiGen.js 从 swagger 生成，swagger 只给了入参）。
 * 要收窄得先让生成器把 response schema 也带出来，那是独立的一件事。
 * 在那之前 Promise<any> 是【如实】描述，而不是拿 any 搪塞 —— 它至少让
 * .then / .catch / await 这条链本身可被检查。
 *
 * 注意 ajaxOptions.sync 那条路：带 sync 时接口是【同步返回结果对象】而不是 Promise
 * （见 RecordEditLock 的 checkRowEditLock），所以返回类型带上 any 这一支。
 */
/**
 * 返回类型是 Promise 和开放对象的【交集】，两条返回路径都要覆盖：
 *   - 默认是异步，调用点 `.then(res => ...)` 靠它拿到上下文类型；
 *   - 带 ajaxOptions.sync 时接口【同步返回结果对象】（见 RecordEditLock、
 *     checkPermission、preall 的 getGlobalMeta），调用点直接读 data.config / data.status。
 *
 * 为什么不用重载：sync 这条路几乎都经由 src/api/* 生成的包装函数
 * （wrapper 自己的 options 是 ApiOptions，匹配不到 sync 那条重载），
 * 要让重载生效得改生成器、影响 1000+ 个函数，不划算。
 *
 * 为什么不直接写 any：那样 src/api/* 的返回也是 any，
 * 调用点 `.then(res => ...)` 的 res 就成了隐式 any —— 光 res/result/data/response
 * 四个名字就 3745 条 TS7006。交集写法能保住 .then 的上下文类型。
 */
// abort：异步路径（绝大多数调用）在返回的 promise 上挂了 promise.abort = () => controller.abort()
// （src/common/global.ts 的 window.mdyAPI）。显式写出来，调用点 req.abort() 才不算「从索引签名取属性」。
declare type ApiResult = Promise<any> & { abort: () => void; [key: string]: any };

/**
 * 带数据类型的接口返回值：resolve 的是 mdyAPI 解开 { state, data, exception } 信封之后的 data。
 * T 由 tools/gen-api-types.ts 从后端 swagger 快照生成（types/hap-api.d.ts 的 HapApi 命名空间）。
 * 交集里那个索引签名和 ApiResult 一样，给 abort() 这类挂在返回值上的东西留口子。
 */
declare type ApiResultOf<T> = Promise<T> & { abort: () => void; [key: string]: any };

// 接口 resolve 出来的值的类型 —— 就是 ApiResult 解包之后的那个（目前是 any，见上面那段说明）。
// 用在「把接口返回值原样转手 resolve 出去」的地方，比如 new Promise<{ data: ApiPayload }>(...)。
// 【为什么不直接写 any】它引用的是既有声明而不是新造一个 any：哪天 ApiResult 精确化了，
// 这些转手的地方自动跟上；而且一眼能看出「这里是接口原样透传」，不是没人管的漏网之鱼。
declare type ApiPayload = Awaited<ApiResult>;

declare var mdyAPI: (...args: any[]) => ApiResult;
declare var agentAPI: (args?: Record<string, unknown>, options?: AgentApiOptions) => ApiResult;
/**
 * src/common/global.js:265 `window.safeParse = (str, type) => {`
 *
 * 【不要按第二个参数重载】试过写成
 *   safeParse(str, 'array'): any[] / safeParse(str, 'object'): Record<string, any>
 * 想让 `safeParse(x, 'array').map(item => ...)` 的 item 由上下文推出类型（987 个调用点）。
 * 但看实现就知道这是撒谎：type 只决定【空值或解析失败时】的兜底值，
 * 有值时一律 `return JSON.parse(str)` —— 传 'array' 照样可能拿到对象
 * （例：WorksheetRecordLogSelectTags 的定位分支就是 safeParse(v,'array') 之后读 .address/.x/.y）。
 * 标成 any[] 之后那些地方立刻报错，而错的是类型不是代码。
 */
declare var safeParse: any;
declare var createTimeSpan: any; // src/common/global.js:291 `window.createTimeSpan = (dateStr, showType = 1) =>`
// src/common/global.ts 的 window.getCurrentLang：URL 上的 sys_lang 优先，否则取 cookie i18n_langtag（都没有时是 null）
declare var getCurrentLang: () => string | null;
// window.getCurrentLangCode：语言 key（不传就用当前语言）在 langConfig 里对应的数字 code，找不到时 undefined
declare var getCurrentLangCode: (lang?: string | null) => number | undefined;
declare var destroyAlert: any; // src/common/global.js:248 `window.destroyAlert = destroyAlert;`

// ---- 由 src/common/cookies.js 挂到 window 上 ----
// src/common/cookies.ts：读不到时 null；expire 交给 moment() 解析（Date / 日期字符串 / 时间戳），不传就是 10 天
declare var getCookie: (name: string) => string | null;
declare var setCookie: (name: string, value: string, expire?: Date | string | number) => void;
declare var delCookie: (name: string) => void;
// localStorage.setItem 包一层 try/catch（隐私模式 / 配额满时不抛）
declare var safeLocalStorageSetItem: (key: string, value: string) => void;

// ---- 由构建期/宿主页注入，不是模块 ----
declare var __api_server__: any; // CI/generate.js:123 生成 `var __api_server__ = ...` 内联进 HTML；消费点 src/common/global.js:433
declare var translations: any; // src/pages/embed/mingoEntry/widgetEntry.js:162 `window.translations = hostTranslations`（宿主页注入的语言包）
/**
 * ---- jQuery ----
 *
 * jquery 是 package.json 里的真依赖（^4.0.0），由 src/library/jquery/global.ts
 * 挂成 window.$ / window.jQuery。原先那份 vendored 的 jquery.min.js（3.7.1）已删除，
 * 版本改由 package.json + bun.lock 追踪。
 * @types/jquery 是【纯类型包】（devDependency，零运行时产物）。
 *
 * 【两者的大版本必须对齐】@types/jquery 的大版本对应它所描述的 jQuery 大版本：
 * 运行期是 jQuery 4，类型就得是 @types/jquery 4.x。类型包是【对某个运行期版本的描述】，
 * 装新的不等于装对的 —— 拿 v4 的说明书去描述跑 v3 的程序，v4 删掉的 API 会被误报，
 * v4 改过签名的地方会按错的签名放行。升级时两边要一起动。
 *
 * 【3 -> 4 实测过的行为差异】只有一处落在本仓关心的范围：
 *   .attr('disabled', true) 读回来，3.x 是 "disabled"，4.x 是 "true"。
 * 本仓没有把布尔属性读回来跟字符串比较的地方（读取点全是真值判断），故不受影响；
 * 设值点也都已改用 .prop()。自闭合写法 $('<span />')、$.extend、$.proxy、
 * .bind/.unbind 在 4.0.0 实测与 3.7.1 一致。
 *
 * 【为什么值得单独收窄，而不是跟本文件其余全局一样留 any】
 * tools/analyze-any-origins.ts 按"一个声明喂出多少条下游诊断"排过序，
 * `declare var $: any` 是全仓第一名：184 条 TS7006。原因是 jQuery 的 API 几乎
 * 全是回调式的 —— `$(el).on('click', function (e) {…})`、`$.each(list, (i, item) => …)`，
 * 接收者是 any 的话每个回调形参都成了隐式 any。标成 JQueryStatic 之后这些形参
 * 由上下文推出类型，【一个调用点都不用改】。
 *
 * 【为什么这不是"猜"】本文件其余 any（IM / HWH5 / wx …）是宿主注入的私有 SDK，
 * 没有权威签名，写出来的只能是编的。jQuery 相反：类型来自 DefinitelyTyped 的官方
 * 定义，且实测本仓用的全是标准 API（$.extend 643 / $.each 29 / $.map 14 /
 * $.proxy 3 / $.contains 1），自定义插件只有一个，见下面的 JQuery 接口合并。
 */
// 【这里【不要】再写 declare var $ / jQuery】@types/jquery 自己就声明了全局：
// node_modules/@types/jquery/misc.d.ts:7324-7325 的
//   declare const jQuery: JQueryStatic;
//   declare const $: JQueryStatic;
// 上面那条 /// <reference types="jquery" /> 已经把它们带进来了。
// 本文件原先另写了一份 `declare var $: JQueryStatic`，与之【重复且冲突】
//（var 与 const 同名会报"无法重新声明块范围变量"），只是因为 skipLibCheck
// 把 .d.ts 内部的报错吞掉了才没暴露出来。实测删掉后差分门禁依旧全绿。

/**
 * 本仓唯一的 jQuery 插件：src/components/autoTextarea/autoTextarea.ts:10
 * `$.fn.autoTextarea = function (options) {`（随输入内容自动调整 textarea 高度）
 *
 * 插件是运行期往 $.fn 上挂的，官方类型当然不知道它，必须靠接口合并补声明 ——
 * 不补的话那个文件自己的赋值和所有调用点都会报 TS2339。
 * options 标 any 是【如实】：插件实现里对 options 只做 $.extend 合并后读取，
 * 没有约束过形状，编一个精确形状反而是假的确定性。
 */
interface JQuery {
  autoTextarea(options?: any): JQuery;
}

// ---- 第三方 SDK：由外链 <script> 或宿主容器提供，均非 npm 依赖 ----
declare var wx: any; // 外链 script https://res.wx.qq.com/open/js/jweixin-1.2.0.js（src/**/*.html）
declare var dd: any; // 外链 script //g.alicdn.com/dingding/dingtalk-jsapi/2.6.41/dingtalk.open.js
declare var AMap: any; // 动态注入 script，见 src/ming-ui/components/amap/MapLoader.js:43
declare var blobStream: any; // 未登记在 package.json，运行期全局（eslint.config.js 登记）
declare var VConsole: any; // 移动端调试面板，未登记在 package.json（eslint.config.js 登记）
declare var IM: any; // 站内即时通讯 SDK，宿主提供（eslint.config.js 登记）
declare var HWH5: any; // 华为 WeLink 容器 JSAPI，宿主容器注入（eslint.config.js 登记）
declare var WeixinJSBridge: any; // 微信 webview 注入（eslint.config.js 登记）
declare var TencentCaptcha: any; // 腾讯验证码 SDK，外链 script（eslint.config.js 登记）
declare var google: any; // Google 地图/登录 SDK，外链 script（eslint.config.js 登记）
declare var ActiveXObject: any; // 旧版 IE 宿主对象；TS 只在 lib.scripthost.d.ts 提供，默认 lib 不含（eslint.config.js 登记）

interface Window {
  // 与上面同源的 window.X 形态访问点（src/common/global.js、src/common/cookies.js）
  // 嵌入式入口（src/pages/embed/mingoEntry/widgetEntry.ts）会换上自己的精简翻译函数，并打上这个标记防止重复安装
  _l: typeof _l & { __mingoEntryLite?: boolean };
  md: any;
  mdyAPI: any;
  agentAPI: any;
  safeParse: any;
  safeLocalStorageSetItem: typeof safeLocalStorageSetItem;
  getCookie: typeof getCookie;
  setCookie: typeof setCookie;
  delCookie: typeof delCookie;
  createTimeSpan: any;
  getCurrentLang: typeof getCurrentLang;
  getCurrentLangCode: typeof getCurrentLangCode;
  destroyAlert: any;
  translations: any;
  __api_server__: any;
  // 与上面的全局声明保持同一个类型，否则 window.$ 和裸 $ 会是两种东西
  $: JQueryStatic;
  jQuery: JQueryStatic;

  // ---- 按「赋值处的真实类型」逐个登记（2026-09-23 起，终点配置 noPropertyAccessFromIndexSignature 要求）----
  // 全部登记完之后删掉最下面那条索引签名；新加的 window.X 请在这里补一行，写明是谁写入的。

  // src/common/global.ts 启动时按 UA 算好的环境标志
  isDingTalk: boolean;
  isMacOs: boolean;
  isMingDaoApp: boolean;
  isMiniProgram: boolean;
  isWxWork: boolean;
  isWeLink: boolean;
  isFeiShu: boolean;
  isWeiXin: boolean;
  isIphone: boolean;
  isAndroid: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isSafari: boolean;
  isMDClient: boolean;
  isWindows: boolean;
  isIPad: boolean;
  /** 部署形态开关，src/common/global.ts 设初值（嵌入式 Mingo 入口 widgetEntry 自己兜底一份） */
  platformENV: { isOverseas: boolean; isLocal: boolean; isPlatform: boolean };
  /** 被自定义 alert 覆盖之前的原生 window.alert（src/common/global.ts 的 customAlert，启动时必定写入） */
  nativeAlert: Window['alert'];
  /** 公开表单页标记（PublicWorksheet 写入；预览态为 false） */
  isPublicWorksheet?: boolean;
  /** 移动端路由跳转：移动端根组件（src/pages/Mobile/index.tsx）在所有移动端路由之前注入，也只在移动端页面里调用 */
  mobileNavigateTo: (url: string, isReplace?: boolean) => void;
  /** 飞书客户端注入的 JSSDK；本仓只用 config / ready 两个方法 */
  h5sdk?: { config: (options: Record<string, unknown>) => void; ready: (callback: () => void) => void };
  /** 打开 Mingo 时要直接进入的任务：各入口写入，Mingo 挂载或 handleStartPendingTask 时消费后清成 null */
  mingoPendingStartTask?: {
    /** MINGO_TASK_TYPE 里的值 */
    type?: number;
    params?: unknown;
    base?: Record<string, unknown>;
    callFromHelp?: boolean;
  } | null;
  /**
   * 【全仓（含上游）从没被赋值过】mingo 的 Header 用 !window.callFromHelp 决定显不显示「复制链接」，
   * 于是那个条件恒为真。帮助面板写的是 mingoPendingStartTask.callFromHelp，而那个对象用完即清。
   */
  callFromHelp?: boolean;
  /** 聊天语音播放器的构造函数（mp3player.ts 默认导出，同时挂到 window 上兼容全局访问） */
  MP3Player?: typeof import('src/pages/chat/lib/mp3player/mp3player').default;
  /** 表格单元格复制出来的内容，JSON 串（control.ts / CellControls 写入，粘贴时读取） */
  tempCopyForSheetView?: string;

  // ---- 第二批（2026-09-23 傍晚）----
  /**
   * 分发类入口（公开表单 / 视图 / 记录 / 页面 / 图表…）的状态与分享 id。
   * src/common/preall.tsx 的 parseShareId 启动时按路径写入（初值是 {}，所以字段全可选）；
   * 嵌入式 Mingo 入口（widgetEntry）自己兜底一个空对象。
   */
  shareState: {
    /** 从 /public/<类型>/<id> 路径里取：公开表单 32 位，其余 24 位 */
    shareId?: string | undefined;
    isPublicPrint?: boolean | undefined;
    isPublicQuery?: boolean | undefined;
    isPublicForm?: boolean | undefined;
    /** 公开表单的预览态（门户账号信息页会按上下文改写） */
    isPublicFormPreview?: boolean | undefined;
    isPublicView?: boolean | undefined;
    isPublicRecord?: boolean | undefined;
    isPublicWorkflowRecord?: boolean | undefined;
    isPublicPage?: boolean | undefined;
    isPublicChart?: boolean | undefined;
    isPublicChatbot?: boolean | undefined;
    isPublicApidoc?: boolean | undefined;
  };
  /** 公开应用（/public/app/...）标记，src/common/preall.tsx 写入 */
  isPublicApp?: boolean;
  /**
   * 用户选的主题，'system' 表示跟随系统。router/globalEvents 启动时按 localStorage 写入，
   * 个人设置（桌面 / 门户 / 移动端）切换时改写。
   */
  themeMode?: 'light' | 'dark' | 'system';
  /** 系统默认语言的 key（如 'zh-Hans'），src/common/global.ts */
  getDefaultLangKey: () => string;
  /** 可设置的语言列表（SysSettings.defaultAllowLangs 过滤后的 langConfig），src/common/global.ts */
  getAllowLangConfig: () => typeof import('src/common/langConfig').default;
  /**
   * 指定接口编辑后清掉本地缓存的时间戳，让下次读取走接口（src/common/global.ts）。
   * requestData 是那次请求的参数，用来拼缓存键。
   */
  clearLocalDataTime: (options: {
    // 这两个拼成「接口名」去匹配各缓存的 clearInterface；多数调用方只按 clearSpecificKeys 清，不给
    controllerName?: string;
    actionName?: string;
    requestData?: ApiArgs;
    clearSpecificKeys?: string[];
  }) => void;
  /**
   * 按 ESC 关闭的弹层登记表：Modal / Dialog / 附件预览打开时登记、关闭时删掉，
   * router/globalEvents 收到 ESC 时调 index 最大那一项的 fn。
   * fn 写成方法签名是有意的：登记进来的是各组件的 onCancel / onClose，参数类型各写各的，
   * 而这里实际传进去的一律是 keydown 事件。
   */
  closeFns: {
    // Modal 的 id 是 Math.random() 算出来的数，Dialog / 附件预览是字符串
    [id: string]: { id: string | number; className?: string | undefined; index?: number | undefined; fn?(e: KeyboardEvent): void };
  };
  /** closeFns 的层级计数，打开一层 +1、全关时归零（首次打开前是 undefined） */
  closeindex?: number;
  /** 启动时从 global meta 取到的系统配置：preall 的 finish 写入（SSO、公开表单各自再写一次） */
  config: {
    /** IM 长连接退回轮询 */
    SocketPolling?: boolean | undefined;
    /** 文件访问前缀 */
    FilePath?: string | undefined;
    /** 头像等附件访问前缀 */
    AttrPath?: string | undefined;
    /** IM 服务地址 */
    SERVER_NAME?: string | undefined;
    /** 自定义视图插件（WidgetView）在 iframe 里时，postMessage 回宿主要带的容器 id；本仓只有读、没有写入点 */
    containerId?: string | undefined;
  };
  /** 公开分享 / 开放接口文档页拿到授权后写入的 clientId */
  clientId?: string;
  /** 移动端记录列表：点开记录时是否新开页（View 组件按视图配置写入，离开时清成 undefined） */
  APP_OPEN_NEW_PAGE?: boolean | undefined;
  /** 当前激活的表格实例 id：表单里有多个子表 / 关联表时，键盘和点击外部的处理只认它 */
  activeTableId?: string | undefined;
  /** 错开弹出的 Modal 已叠了几层（dislocate 的 Modal 每多一层往右错 10px，全关时归零） */
  dislocateCount?: number;
  /** 为 true 时应用页头的应用导航浮层不弹出（角色页、Chatbot、工作表头的某些操作期间写 true） */
  disabledSideButton?: boolean;
  /** 公开表单的分享 id（PublicWorksheet 写入） */
  publicWorksheetShareId?: string;
  /** 工作表左侧分组 mousedown 的时间戳，按住移动超过 50ms 才算拖拽；松开清成 null */
  dragNow?: number | null;
  /** 单元格编辑器正在失焦保存：子表弹窗的提交要等它 1 秒 */
  cellTextIsBlurring?: boolean;
  /** 页面马上要跳走（改语言后重载、跳登录等）：preall 置 true，根组件只渲染加载中 */
  isWaiting?: boolean;
  /** 各工作表的草稿条数，键是 worksheetId */
  draftTotalNumInfo?: { [worksheetId: string]: number };
  /** 表单设计器 / 函数编辑器挂出来的全局事件总线（就是 src/utils/common 的 emitter） */
  emitter?: import('events').EventEmitter;
  /** 知识库上传助手的弹出窗口（window.open 的返回值） */
  uploadAssistantWindow?: Window | null;
  /** 自定义页面的重排函数：页面组件挂上去，页头切换全屏 / 收起时调它 */
  customPageWindowResize?: () => void;
  /** 打开 Mingo 时预填的输入框文字 */
  mingoInitialMessage?: string;
  /** 打开 Mingo 时要进入的会话 */
  mingoInitialSessionId?: string | undefined;
  /** 从别处交接到 Mingo 时的交接键 */
  mingoInitialHandoffKey?: string;
  /** 打开 Mingo 时要进入的分组 */
  mingoInitialGroupId?: string;
  /** 公开表单 / 公开查询 / 记录填写链接的分享者（接口返回的 shareAuthor）；图表按「有值即公开分享」判断 */
  shareAuthor?: string;
  /** 工作流推送的提示音播放器（桌面 / 移动端的 workflow socket 各建一个 audio 元素） */
  workflowAudioPlayer?: HTMLAudioElement;
  /** 拖拽排序时被拖元素的尺寸，占位块照它画（SortableList、自定义按钮分组写入，拖完清成 undefined） */
  MD_DRAG_ITEM?: { width: number; height: number } | undefined;
  /** 已渲染的表单实例 id：useFormEventManager 挂载时追加、卸载时摘掉，用来隔离各表单的键盘事件 */
  FormActiveTabId?: string[];
  /** 刷新应用页头的分组 / 应用详情（AppDetail、LeftAppGroup 挂载时挂上） */
  updateAppGroups?: () => void;
  /** 有自定义视图插件（iframe）挂着：WidgetContainer 挂载置 true、卸载置 false */
  customWidgetViewIsActive?: boolean;
  /** 表格单元格正在被主动聚焦（WorksheetTable / CellControls 置 true，10ms 后没进编辑就清回 false） */
  handFocusCell?: boolean;
  /** 甘特图能否响应缩放：Zoom 工具条挂载和图表重绘完成时置 true，缩放进行中置 false（防连点） */
  isZoom?: boolean;
  /** 集成场景由宿主注入的访问令牌（本仓只有读取点）；有值且没有 pssid 时请求头用它 */
  access_token?: string;
  /** 公开应用的授权串：URL hash 形如 #publicapp<授权串>，preall 截出来（去掉 #isPrivateBuild） */
  publicAppAuthorization?: string;
  /** 富文本编辑器处于聚焦状态（名字里的 dialog 是历史叫法；CKEditor 的 onFocus / onBlur 维护） */
  richTextDialogIsActive?: boolean;
  /** 部署在子路径下时的路径前缀，由页面外部注入（本仓只有读取点，spec 里置空串） */
  __customSubPath__?: string;
  /** 刷新工作表左侧导航（新建应用项后调） */
  __worksheetLeftReLoad?: () => void;
  /** 表单设计器最近一次加字段是不是 Mingo 发起的 */
  lastAddWidgetsTriggerByMingo?: boolean;

  // ---- 应用代码自己挂到 window 上的状态 / 回调（类型取自全仓 window.X = … 的赋值，2026-09-24 按赋值处推出）----
  // 只收「每处赋值都推得出具体类型」的；宿主 / 原生 App 注入、赋值是 any 的仍走下面的索引签名。
  // 都是可选的：读的时候不一定已经赋过值。
  /** 赋值处：src/pages/integration/svgIcon.ts:1 */
  _iconfont_svg_string_3909252?: string;
  /** 赋值处：src/common/preall.tsx:271 */
  allowNotLogin?: boolean;
  /** 赋值处：src/pages/worksheet/components/CellControls/index.tsx:591、src/pages/worksheet/components/CellControls/index.tsx:699 */
  cellisediting?: boolean;
  /** 赋值处：src/pages/worksheet/components/WorksheetTable/index.tsx:523、src/pages/worksheet/components/WorksheetTable/index.tsx:885 */
  cellisfocus?: boolean;
  /** 赋值处：src/pages/worksheet/components/CellControls/Text.tsx:424、src/pages/worksheet/components/CellControls/index.tsx:462 */
  cellLastKey?: string | undefined;
  /** 赋值处：src/pages/worksheet/components/CellControls/Text.tsx:322 */
  cellTextIsBlurringTimer?: NodeJS.Timeout;
  /** 赋值处：src/components/Form/core/authentication.ts:194、src/components/Form/core/authentication.ts:203 */
  configLoading?: boolean;
  /** 赋值处：src/components/Form/core/authentication.ts:193、src/components/Form/core/authentication.ts:204 */
  configSuccess?: boolean;
  /** 赋值处：src/components/Mingo/modules/CreateRecordBot/index.tsx:259、src/components/Mingo/modules/CreateRecordBot/index.tsx:422 */
  crateRecordInput?: string | undefined;
  /** 赋值处：src/pages/PageHeader/components/PortalUserSet/DelDialog.tsx:45、src/pages/PageHeader/components/PortalUserSet/index.tsx:101 等 4 处 */
  currentLeave?: boolean;
  /** 赋值处：src/components/Form/core/authentication.ts:192 */
  currentUrl?: string;
  /** 赋值处：src/pages/widgetConfig/widgetSetting/components/CustomEvent/CustomAction/actionTypes/PlayVoice.tsx:24、src/pages/widgetConfig/widgetSetting/components/CustomEvent/CustomAction/actionTypes/PlayVoice.tsx:56 */
  customEditPlayer?: HTMLAudioElement | undefined;
  /** 赋值处：src/components/Form/core/customEvent.tsx:789 */
  customEventAudioPlayer?: HTMLAudioElement;
  /** 赋值处：src/pages/AppHomepage/AppCenter/appHomeReducer.tsx:472 */
  dashboardAjax?: ApiResult;
  /** 赋值处：src/pages/worksheet/components/BaseColumnHead/BaseColumnHead.tsx:63、src/pages/worksheet/components/BaseColumnHead/BaseColumnHead.tsx:76 等 3 处 */
  dragclicktimer?: NodeJS.Timeout | undefined;
  /** 赋值处：src/pages/customPage/pageContent/CustomPageHeader.tsx:81 */
  editCustomPage?: () => void;
  /** 赋值处：src/pages/worksheet/components/WorksheetTable/index.tsx:829、src/pages/worksheet/components/WorksheetTable/index.tsx:857 等 3 处 */
  enterColumnPopup?: boolean;
  /** 赋值处：src/components/DateFilter/index.tsx:107 */
  feedSelectDate?: string | number;
  /** 赋值处：src/ming-ui/components/WaterMark.tsx:152、src/ming-ui/components/WaterMark.tsx:154 */
  hadWaterMark?: boolean;
  /** 赋值处：src/pages/worksheet/common/FreeFieldSandbox/messageBridge.ts:30 */
  handleFreeFieldWindowEventBonded?: boolean;
  /** 赋值处：src/pages/worksheet/components/CellControls/index.tsx:488、src/pages/worksheet/components/CellControls/index.tsx:572 */
  hasEditingCell?: boolean;
  /** 赋值处：src/components/Mingo/modules/CreateWorksheetBot/index.tsx:513 */
  hideAllPanels?: boolean;
  /** 赋值处：src/pages/ViewLand/index.tsx:86、src/pages/ViewLand/index.tsx:90 */
  hideColumnHeadFilter?: boolean;
  /** 赋值处：src/pages/agent/AgentLand.tsx:88 */
  hideHeader?: boolean;
  /** 赋值处：src/pages/AppHomepage/AppCenter/appHomeReducer.tsx:521 */
  homeGetMyAppAjax?: ApiResultOf<HapApi.MD.Web.Ajax.ResultModel.App.MyAppDto>;
  /** 赋值处：src/pages/customPage/pageContent/CustomPageHeader.tsx:377、src/pages/customPage/pageContent/CustomPageHeader.tsx:382 */
  inFull?: boolean;
  /** 赋值处：src/pages/worksheet/views/ResourceView/ConTimegrid/index.tsx:366、src/pages/worksheet/views/ResourceView/ConTimegrid/index.tsx:369 */
  isCanvasTime?: boolean;
  /** 赋值处：src/common/global.ts:377 */
  isNewTab?: () => boolean;
  /** 赋值处：src/pages/Personal/systemSettings/index.tsx:235、src/pages/chat/containers/SettingDrawer/Base.tsx:158 */
  isOpenMessageSound?: boolean;
  /** 赋值处：src/pages/Personal/systemSettings/index.tsx:250、src/pages/chat/containers/SettingDrawer/Base.tsx:173 */
  isOpenMessageTwinkle?: boolean;
  /** 赋值处：src/pages/embed/mingoEntry/widgetEntry.ts:441 */
  isProduction?: boolean;
  /** 赋值处：src/components/Mingo/ChatBot/components/TryTry.tsx:74 */
  isTryRefreshClicked?: boolean;
  /** 赋值处：src/pages/worksheet/WorkSheet.tsx:264、src/pages/worksheet/WorkSheet.tsx:350 */
  isWorksheet?: boolean;
  /** 赋值处：src/pages/widgetConfig/widgetDisplay/components/BottomDragPointer.tsx:99 */
  mingoPendingCreateWorksheetTaskStatus?: number;
  /** 赋值处：src/pages/worksheet/common/newRecord/NewRecordContent.tsx:817、src/pages/worksheet/common/newRecord/NewRecordContent.tsx:821 */
  newRecordActive?: boolean;
  /** 赋值处：src/pages/worksheet/common/Sheet/Sheet.tsx:354 */
  openViewConfig?: () => void;
  /** 赋值处：src/components/Mingo/modules/CreateWorksheetBot/MingoGeneratedWidgetsSelector.tsx:537、src/components/Mingo/modules/CreateWorksheetBot/MingoGeneratedWidgetsSelector.tsx:551 等 3 处 */
  pendingSaveWidgetConfigFunction?: (() => void) | undefined;
  /** 赋值处：src/components/Mingo/modules/CreateWorksheetBot/index.tsx:593 */
  pendingTaskForEditWorksheet?: () => void;
  /** 赋值处：src/router/navigateTo.ts:22 */
  redirected?: boolean;
  /** 赋值处：src/pages/FormExtend/PublicWorksheetConfig/PublicWorksheetConfigForm.tsx:90 */
  scrollToFormEnd?: () => void;
  /** 赋值处：src/ming-ui/components/AutoSize.tsx:156 */
  sheetAutoSized?: boolean;
  /** 赋值处：src/router/globalEvents.ts:139、src/router/globalEvents.ts:143 */
  themeModeVisible?: boolean;
  /** 赋值处：src/pages/AppHomepage/AppCenter/appHomeReducer.tsx:924 */
  time?: number;
  /** 赋值处：src/pages/worksheet/components/CellControls/index.tsx:596 */
  timer?: number;

  // !! 测量污染开关 !!
  // 全仓有 4076 处 window.X 访问、276 个不同属性名，其中最热的
  // platformENV(801)/isMingDaoApp(135)/isPublicApp(125)/shareState(123)/
  // mobileNavigateTo(60)/themeMode(42) 等都没有登记在 eslint.config.js 里，
  // 逐条枚举等于凭空造 240+ 条无依据声明。这条索引签名是唯一的兜底，
  // 也是本文件里唯一可能掩盖真实错误的一行 —— 做「干净测量」时删掉这一行。
  [key: string]: any;
}

// ---- 非代码模块：由 webpack loader 处理，tsc 需要 ambient 声明才认 ----
// 样式：CI/webpack.config.js:81(.css) / :85(.less)，仅副作用导入（.less 739 处、.css 82 处）
declare module '*.less';
declare module '*.css';
// raw-loader，默认导出字符串：CI/webpack.config.js:99 `test: /\.html?$/, use: 'raw-loader'`（.html 53 处、.htm 5 处）
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.htm' {
  const content: string;
  export default content;
}
// type:'asset'，默认导出 URL 字符串：CI/webpack.config.js:89
// `test: /\.(woff2|gif|jpg|png|svg|mp3|woff|eot|ttf)(\?[^?]*)?$/`（.png 307 处、.svg 17、.mp3 15、.gif 8）
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.ttf' {
  const src: string;
  export default src;
}
declare module '*.eot' {
  const src: string;
  export default src;
}

// 运行时的全局 alert 不是 DOM 的 window.alert：src/common/global.js:247 的
// customAlert() 把它替换成了 ming-ui/functions/alert 的 antAlert。
// 真实签名见 src/ming-ui/functions/alert/index.js:54 `antAlert(content, alertType = 1)`。
// 不覆盖的话 tsc 会按 DOM 的 alert(message?: any): void 判读，凡是传第二个参数的
// 调用点（本仓大量 `alert(msg, 2)`）都会误报 TS2554 Expected 0-1 arguments。
// 注意：content 可以是字符串/ReactNode，也可以是 { msg, type, duration, onClose, ... } 配置对象。
declare function alert(content?: any, alertType?: number): void;

// src/api/* 方法第二个参数 options 的类型。
// 依据 src/common/global.js:721 `window.mdyAPI = (controllerName, actionName, requestData, options = {}) =>`
// 以及 src/api 里对 options 的实际写入（如 src/api/download.ts 的 options.ajaxOptions）。
// 【索引签名保留】options 会被各处塞自定义键，收紧会产生大量噪声诊断；
// 但下面这些是 window.mdyAPI 自己真正读到的，列出来至少拼错常用键时能报错。
declare interface ApiOptions {
  /** 出错时不弹提示 */
  silent?: boolean;
  /** 透传给底层请求的选项 */
  ajaxOptions?: {
    /** HTTP 方法，缺省 POST。用字面量联合而不是 string —— 它直接交给 axios，
        axios 的 method 就是这么定义的，写 string 会撞 TS2769 无匹配重载 */
    type?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    url?: string;
    /** 缺省 'json'；同样是 axios 的字面量联合 */
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'document' | 'stream';
    /** 同步请求 */
    sync?: boolean;
    timeout?: number;
    header?: Record<string, string>;
    agent?: boolean;
    noAccountIdHeader?: boolean;
  };
  /** 外部传进来的中断器；不传则内部自建一个 */
  abortController?: AbortController;
  /** 自己解析返回体（导出 blob 等场景） */
  customParseResponse?: boolean;
  /** 流式响应 */
  isReadableStream?: boolean;
  /** Agent 服务：不走 {state,data,exception} 契约 */
  agent?: boolean;
  [key: string]: any;
}

// 业务代码 catch 到的「接口错误」。useUnknownInCatchVariables 打开后 catch 变量是 unknown，
// 各处要把它当成下面这个形状来读。【字段是按真实来源取的并集，不是猜的】：
//   - errorCode / errorMessage / errorData：window.mdyAPI 遇到 responseData.exception 时
//       reject({ errorCode: responseData.state, errorMessage: responseData.exception, errorData: responseData })
//       （src/common/global.ts，mdyAPI 的 promise 体内）
//   - status / data / response：HTTP 层失败时 reject 的是 axios 的 error.response，
//       或者拿不到 response 时的原始 axios error（后者的 response 字段才有值）
//   - resultCode：工作表行接口成功时 resolve 的是带 resultCode 的对象，
//       不少调用方在 resultCode !== 1 时把它原样 throw 出去，于是 catch 里也会见到它
// 全部可选：同一个 catch 可能接到上面任一种，也可能接到别的东西。
// 这里只描述形状、不做运行期判断 —— 调用处原有的 err && ... 防御照旧保留。
declare interface ApiRejection {
  errorCode?: number;
  errorMessage?: string;
  errorData?: unknown;
  resultCode?: number;
  status?: number;
  data?: unknown;
  response?: { status?: number; data?: unknown };
}

/** window.agentAPI 的第二个参数。Agent 服务自己一套，与 ApiOptions 不通用。 */
declare interface AgentApiOptions {
  url?: string;
  /** 缺省 POST */
  method?: string;
  /** 走 execute-stream */
  isStream?: boolean;
  silent?: boolean;
  header?: Record<string, string>;
  abortController?: AbortController;
}

// src/api/agent.ts 里带路径参数的方法，第一个参数 args 的类型。
// 生成器 scripts/agentApiGen.js:87 在有 path/query 参数时发 `args = {}`，
// 不标类型的话 TS 从默认值推成 `{}`，紧接着的
// `const { sessionId, ...rest } = args;` 就报 TS2339（实测 29 条）。
//
// 索引签名用 any 而不是 unknown：这个 args 是直接交给网络层的异构参数包，
// 取出来的值会当字符串用（如 encodeURIComponent(sessionId)）。
// 写成 unknown 不会消诊断，只会把 TS2339 换成一批 TS2345，属于原地打转。
// 真正的收敛应该是按接口给出各自的参数类型，那要从 swagger 生成，是另一件事。
declare interface ApiArgs {
  [key: string]: any;
}

// ---- 构建期常量：webpack DefinePlugin 在编译时替换的字面量 ----
// 与本文件其余部分不同，这两个【不是】挂在 window 上的运行时全局，而是
// CI/webpack.config.js:21-24 的 BUILD_CONSTANTS 经 DefinePlugin 做文本替换，
// 打包后源码里根本不存在这两个标识符。
// 因为没有 import、也没有 window 赋值，tsc 与 eslint 都只能靠声明认识它们：
// 不声明的话 src/utils/enum.ts:118/122 会同时报 TS2304 与 no-undef。
// 声明成可选（| undefined）是贴着调用点写的 —— getFastGptConfig 本身就用
// `typeof X === 'undefined'` 做保护，写成必选会让那个保护分支被判成永不成立。
// 同步登记在 eslint.config.js 的 languageOptions.globals 里，保持两张表一致。
declare const ENABLE_FASTGPT: boolean | undefined;
declare const FAST_GPT_CONFIG_BASE64: string | undefined;
