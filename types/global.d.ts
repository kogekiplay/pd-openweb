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
 */

// ---- 由 src/common/global.js 在启动时挂到 window 上 ----
declare var _l: any; // src/common/global.js:108 `window._l = function (key, ...args) {`（i18n）
declare var md: any; // src/common/global.js:190 `window.md = {`（全局配置树 md.global.*）
declare var mdyAPI: any; // src/common/global.js:721 `window.mdyAPI = (controllerName, actionName, ...) =>`
declare var agentAPI: any; // src/common/global.js:936 `window.agentAPI = (args = {}, options = {}) =>`
declare var safeParse: any; // src/common/global.js:265 `window.safeParse = (str, type) => {`
declare var createTimeSpan: any; // src/common/global.js:291 `window.createTimeSpan = (dateStr, showType = 1) =>`
declare var getCurrentLang: any; // src/common/global.js:74 `window.getCurrentLang = () => {`
declare var getCurrentLangCode: any; // src/common/global.js:82 `window.getCurrentLangCode = lang => {`
declare var destroyAlert: any; // src/common/global.js:248 `window.destroyAlert = destroyAlert;`

// ---- 由 src/common/cookies.js 挂到 window 上 ----
declare var getCookie: any; // src/common/cookies.js:51
declare var setCookie: any; // src/common/cookies.js:22
declare var delCookie: any; // src/common/cookies.js:70
declare var safeLocalStorageSetItem: any; // src/common/cookies.js:8

// ---- 由构建期/宿主页注入，不是模块 ----
declare var __api_server__: any; // CI/generate.js:123 生成 `var __api_server__ = ...` 内联进 HTML；消费点 src/common/global.js:433
declare var translations: any; // src/pages/embed/mingoEntry/widgetEntry.js:162 `window.translations = hostTranslations`（宿主页注入的语言包）
declare var $: any; // CI/webpack.config.js:454 `externals: { jquery: 'jQuery' }` —— jquery 不打包，运行期取全局
declare var jQuery: any; // 同上；jquery 不在 package.json 里，纯运行期全局

// ---- 第三方 SDK：由外链 <script> 或宿主容器提供，均非 npm 依赖 ----
declare var wx: any; // 外链 script https://res.wx.qq.com/open/js/jweixin-1.2.0.js（src/**/*.html）
declare var dd: any; // 外链 script //g.alicdn.com/dingding/dingtalk-jsapi/2.6.41/dingtalk.open.js
declare var AMap: any; // 动态注入 script，见 src/ming-ui/components/amap/MapLoader.js:43
declare var plupload: any; // 上传库，未登记在 package.json，运行期全局（eslint.config.js 登记）
declare var moxie: any; // plupload 的运行时伴生库，同上
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
  _l: any;
  md: any;
  mdyAPI: any;
  agentAPI: any;
  safeParse: any;
  safeLocalStorageSetItem: any;
  getCookie: any;
  setCookie: any;
  delCookie: any;
  createTimeSpan: any;
  getCurrentLang: any;
  getCurrentLangCode: any;
  destroyAlert: any;
  translations: any;
  __api_server__: any;
  $: any;
  jQuery: any;

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
// 刻意带索引签名：options 不是本批的观测对象，不希望它产生诊断噪声。
declare interface ApiOptions {
  silent?: boolean;
  ajaxOptions?: any;
  [key: string]: any;
}
