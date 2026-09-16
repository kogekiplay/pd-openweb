/**
 * 把 jQuery 挂成全局 —— 全仓 2800+ 处裸 `$(...)` 靠的就是这里。
 *
 * 【原来是什么样】这个目录下曾经有一份 vendored 的 jquery.min.js（jQuery 3.7.1，87KB
 * 单行压缩产物），global.js 从 './jquery.min' 引它。那样版本只写在文件头的注释里，
 * 既不受 package.json 约束，也没法靠 bun 升级。现在改成引 npm 包，版本由
 * package.json + bun.lock 追踪，vendored 的那份已删除。
 *
 * 【为什么引子路径 'jquery/dist/jquery.js' 而不是裸 'jquery'】
 * CI/webpack.config.ts:486 有 `externals: { jquery: 'jQuery' }` —— 裸 'jquery' 会被
 * 映射成【全局 jQuery】。而本文件正是负责创建那个全局的，引裸名就成了自己等自己，
 * 加载时拿到 undefined。externals 的对象写法只精确匹配 'jquery' 这个请求，
 * 不匹配子路径，所以引 dist 子路径能拿到真正的包。
 * （externals 那条仍然有用：第三方包里 require('jquery') 会拿到本文件设好的全局，
 *   全仓因此只有一个 jQuery 实例。）
 *
 * 【为什么引未压缩的 dist/jquery.js】webpack 生产构建自己会压缩，引未压缩版可以避免
 * 二次压缩，开发态还能正常断点。
 *
 * 【为什么必须手动挂 window】jQuery 作为 CommonJS 模块被引入时，它内部的 noGlobal
 * 为真，【不会】自己去设 window.jQuery / window.$（见 dist 尾部那段 noGlobal 判断）。
 */
import jQuery from 'jquery/dist/jquery.js';

if (typeof window !== 'undefined') {
  window.jQuery = jQuery;
  window.$ = jQuery;
}

export default jQuery;
