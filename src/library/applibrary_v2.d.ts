/**
 * applibrary_v2.js 的类型声明。
 *
 * 那个文件是【预打包的 webpack 产物】——单行 1.1MB，不是可读源码，也不该被 tsc 解析。
 * 唯一的使用方是 src/pages/AppHomepage/AppLib/index.tsx 的
 *     import('src/library/applibrary_v2').then(() => { ... })
 * 只取副作用（它自己往 window 上挂东西），不读任何导出。
 *
 * 有了这份声明，根 tsconfig 就不再需要 allowJs —— 否则关掉 allowJs 后
 * 那行 import 会报 TS2307「找不到模块」。
 */
declare const applibraryV2SideEffectOnly: void;
export default applibraryV2SideEffectOnly;
