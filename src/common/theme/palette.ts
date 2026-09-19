/**
 * 主题调色板：种子色 -> CSS 自定义属性。
 *
 * 【为什么是纯函数】它是整个主题引擎唯一有逻辑的地方，另外两层
 * （写 DOM、React 挂载）薄到只剩三五行。纯函数才能被本仓的 spec
 * runner 测到 —— 本仓没有 jsdom/vitest/jest，79 个 spec 全是
 * node + assert，不存在「渲染一个组件再断言」这个选项。
 *
 * 【为什么用 getDesignToken 而不是 theme.useToken()】两者产出同一套
 * token，但前者是纯函数、不要求在 ConfigProvider 子树里调用。设计文档里
 * 「useToken 的调用位置」那条风险因此直接不存在了。
 *
 * 【调色板绝不能分叉】下面每个值要么原样取自 antd 的 token，要么是对
 * token 加一档透明度。我们【不】自己算 lighten/darken —— 那样 antd 组件
 * 和我们的 Less 会得到两种不同的蓝，正是这次要修的病。
 * palette.spec.ts 第 2 组断言专门钉这条，改成自算会当场红。
 */
import { theme } from 'antd';
import { TinyColor } from '@ctrl/tinycolor';

export type ThemeMode = 'light' | 'dark';
export type ThemeVars = Record<string, string>;

/**
 * 平台色 = theme-default.less 里 --color-primary 的字面值。
 * 以后要做「组织级品牌色」的话，改成从组织设置里读即可，这里是唯一入口。
 */
export const PLATFORM_PRIMARY = '#1677ff';

/**
 * 透明档的取值。明暗两套【故意不同】，直接照搬自
 * theme-default.less（.4 / .12 / .06）与 theme-dark.less（.5 / .2 / .12）——
 * 暗底上同样的 alpha 会看不见，原作者已经调过，不要合并成一套。
 */
const ALPHA: Record<ThemeMode, { focusOuter: number; transparent: number; transparentLight: number }> = {
  light: { focusOuter: 0.4, transparent: 0.12, transparentLight: 0.06 },
  dark: { focusOuter: 0.5, transparent: 0.2, transparentLight: 0.12 },
};

/**
 * 【这里【不】产出 --app-primary-color 系列，也不产出 --color-app 系列】
 *
 * · --app-primary-color / --app-primary-hover-color：
 *   src/common/mdcss/basic.css:3-5 已经把它们【别名】到语义变量上：
 *     --app-primary-color: var(--color-primary);
 *     --app-primary-hover-color: var(--color-link-hover);
 *   所以它们本来就跟着主色走，这里再定义一遍等于造第二个真相源；
 *   而且 hover 那个会被悄悄从 --color-link-hover 改成 colorPrimaryHover。
 *
 *   运行期还有两个注入器会临时覆盖它们，表达「此刻用某个应用的颜色」：
 *     · src/pages/worksheet/WorkSheet.tsx 的 changeAppThemeColor（卸载时 remove，写得对）
 *     · src/utils/common.ts 的 setAppThemeColor（Chatbot 用）
 *   这两条路和本模块并存不冲突：它们改的是别名变量，本模块改的是 --color-primary。
 *
 * · --app-highlight-color：全局【没有】定义，只由上面两个注入器临时产生。
 *   所以 `var(--app-highlight-color, var(--color-mingo-transparent))` 那处兜底
 *   是真的会生效的，在这里定义它会把那处的 Mingo 紫覆盖掉。
 *
 * · --color-app 系列：真·死变量（全仓无赋值），已在同批改指 --color-primary 后删除。
 */
function alpha(color: string, a: number): string {
  return new TinyColor(color).setAlpha(a).toRgbString();
}

export function buildThemeVars(seed: string, mode: ThemeMode = 'light'): ThemeVars {
  // 非法色不能让整站没主题色。TinyColor 对乱字符串返回 isValid=false 而不是抛，
  // 但 antd 的算法拿到它会产出一串 NaN 颜色，界面会变成透明/黑块 —— 比抛错更难查。
  // 空串同样走这里：应用刚建出来时 iconColor 可能是空的。
  const safeSeed = seed && new TinyColor(seed).isValid ? seed : PLATFORM_PRIMARY;

  const token = theme.getDesignToken({
    token: { colorPrimary: safeSeed },
    ...(mode === 'dark' ? { algorithm: theme.darkAlgorithm } : {}),
  });

  const a = ALPHA[mode];
  const primary = token.colorPrimary;

  return {
    // ——— 主色（theme-default.less 的 7 个）———
    '--color-primary': primary,
    '--color-primary-light': token.colorPrimaryHover,
    '--color-primary-dark': token.colorPrimaryActive,
    '--color-primary-focus': primary,
    '--color-primary-focus-outer': alpha(primary, a.focusOuter),
    '--color-primary-transparent': alpha(primary, a.transparent),
    '--color-primary-transparent-light': alpha(primary, a.transparentLight),
  };
}

/** 拼成可直接塞进 <style> 的声明串。 */
export function themeVarsToCssText(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}
