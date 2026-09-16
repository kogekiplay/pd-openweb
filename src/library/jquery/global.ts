/**
 * 把 jQuery 挂成全局 —— 全仓 2800+ 处裸 `$(...)` 靠的就是这里。
 *
 * 【原来是什么样】这个目录下曾经有一份 vendored 的 jquery.min.js（jQuery 3.7.1，87KB
 * 单行压缩产物），global.js 从 './jquery.min' 引它。那样版本只写在文件头的注释里，
 * 既不受 package.json 约束，也没法靠 bun 升级。现在 jquery 是正经依赖（^4.0.0），
 * vendored 的那份已删除。
 *
 * 【为什么走 'jquery/factory' 而不是裸 'jquery'】
 * CI/webpack.config.ts:486 有 `externals: { jquery: 'jQuery' }` —— 裸 'jquery' 会被
 * 映射成【全局 jQuery】。而本文件正是负责创建那个全局的，引裸名就成了自己等自己，
 * 加载时拿到 undefined。externals 的对象写法只精确匹配 'jquery' 这个请求。
 * （externals 那条仍然有用：第三方包里 require('jquery') 会拿到本文件设好的全局，
 *   全仓因此只有一个 jQuery 实例。）
 *
 * 【为什么不是 'jquery/dist/jquery.js'】试过，不行：jQuery 4 的 package.json 有
 * exports 字段，只暴露 '.'、'./slim'、'./factory'、'./factory-slim'、'./src/*.js'，
 * dist 子路径【不在其中】，webpack 直接报 "is not exported under the conditions"。
 * 'jquery/factory' 是 jQuery 4 为"自己决定挂不挂全局"这个场景提供的正式入口，
 * @types/jquery 也自带 factory.d.ts，类型是现成的。
 *
 * 【为什么必须手动挂 window】factory 形态【不会】自己设 window.jQuery / window.$
 *（那正是它存在的意义），所以这一步得我们自己做。
 */
import { jQueryFactory } from 'jquery/factory';

const jQuery = jQueryFactory(window);

window.jQuery = jQuery;
window.$ = jQuery;

export default jQuery;
