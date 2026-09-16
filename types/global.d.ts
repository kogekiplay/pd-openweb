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
declare var _l: any; // src/common/global.js:108 `window._l = function (key, ...args) {`（i18n）
declare var md: any; // src/common/global.js:190 `window.md = {`（全局配置树 md.global.*）
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
declare type ApiResult = Promise<any> & { [key: string]: any };

declare var mdyAPI: (...args: any[]) => ApiResult;
declare var agentAPI: any; // src/common/global.js:936 `window.agentAPI = (args = {}, options = {}) =>`
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
  // 与上面的全局声明保持同一个类型，否则 window.$ 和裸 $ 会是两种东西
  $: JQueryStatic;
  jQuery: JQueryStatic;

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
