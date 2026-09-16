/**
 * svgIcon.js 的类型声明。
 *
 * 那个文件由 iconfont.cn 生成（scripts/updateIconfont.ts 负责更新），
 * 内容是一段把 SVG symbol 注入 document 的自执行脚本，改成 .ts 会在下次
 * 重新生成时被覆盖回去。三个使用方都是纯副作用导入：
 *     import './svgIcon';
 *     import 'src/pages/integration/svgIcon';
 *     import 'src/pages/integration/svgIcon.js';
 *
 * 有了这份声明，根 tsconfig 就不再需要 allowJs。
 */
declare const svgIconSideEffectOnly: void;
export default svgIconSideEffectOnly;
