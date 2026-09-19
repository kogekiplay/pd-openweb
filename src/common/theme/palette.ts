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

/**
 * 中性色阶往主色色相偏一点，让整个界面「带上主题感」，而不是只有主按钮变色。
 *
 * 【为什么不是把这些直接换成主色】它们是图标、次要文字、分隔线、浅底 ——
 * 换成主色会毁掉可读性和层级。正确的做法是保留明度、只偏色相。
 *
 * 【为什么文字和背景两档强度】实测对比度：次要文字 #757575 对白底本来就只有
 * 4.61（WCAG AA 正文门槛是 4.5），混 15% 暖色会掉到 4.30、低于 AA。
 * 所以文字取 10%、背景与边框取 32% —— 后者不承担文字对比度，可以偏得明显得多。
 * 冷色（平台蓝）方向反而会把对比度略微推高（4.61 -> 4.68），所以瓶颈是暖色。
 *
 * 【不参与染色的三类】主体表面（页面底、卡片底、输入框底）与正文主文字：
 * 它们是「纸和墨」，染了会让整站发闷、长文阅读变累。
 */
const TINT_TEXT = 10;
const TINT_SURFACE = 32;

/** 中性色阶的基准值，逐字抄自 theme-default.less / theme-dark.less。 */
const NEUTRALS: Record<ThemeMode, Record<string, [string, number]>> = {
  light: {
    '--color-text-secondary': ['#757575', TINT_TEXT],
    '--color-text-tertiary': ['#9e9e9e', TINT_TEXT],
    '--color-text-title': ['#515151', TINT_TEXT],
    '--color-text-placeholder': ['#cccccc', TINT_TEXT],
    '--color-text-disabled': ['#bdbdbd', TINT_TEXT],
    '--color-border-primary': ['#dddddd', TINT_SURFACE],
    '--color-border-secondary': ['#eaeaea', TINT_SURFACE],
    '--color-border-tertiary': ['#cccccc', TINT_SURFACE],
    '--color-border-hover': ['#bdbdbd', TINT_SURFACE],
    '--color-border-strong': ['#9e9e9e', TINT_SURFACE],
    '--color-background-secondary': ['#fafafa', TINT_SURFACE],
    '--color-background-tertiary': ['#f5f5f5', TINT_SURFACE],
    '--color-background-hover': ['#f5f5f5', TINT_SURFACE],
    '--color-background-disabled': ['#f0f0f0', TINT_SURFACE],
  },
  dark: {
    '--color-text-secondary': ['#b3b3b3', TINT_TEXT],
    '--color-text-tertiary': ['#8c8c8c', TINT_TEXT],
    '--color-text-title': ['#f2f2f2', TINT_TEXT],
    '--color-text-placeholder': ['#6f6f6f', TINT_TEXT],
    '--color-text-disabled': ['#5e5e5e', TINT_TEXT],
    '--color-border-primary': ['#3c3c3c', TINT_SURFACE],
    '--color-border-secondary': ['#2a2a2a', TINT_SURFACE],
    '--color-border-tertiary': ['#484848', TINT_SURFACE],
    '--color-border-hover': ['#525252', TINT_SURFACE],
    '--color-border-strong': ['#606060', TINT_SURFACE],
    '--color-background-secondary': ['#090909', TINT_SURFACE],
    '--color-background-tertiary': ['#1f1f1f', TINT_SURFACE],
    '--color-background-hover': ['#393939', TINT_SURFACE],
    '--color-background-disabled': ['#141414', TINT_SURFACE],
  },
};

/**
 * 偏色相但【保住明度】。
 *
 * 只 mix 是不够的：mix 会把明度一起拉向主色，于是暖色主题下次要文字会变亮、
 * 对白底的对比度掉到 WCAG AA 以下（实测纯橙 #ff9800 下掉到 4.28）。
 * 所以 mix 之后再把 HSL 的 L 调回去，直到相对亮度与原值一致 ——
 * 二分 12 轮足够收敛到肉眼无差。
 */
function tintPreservingLuminance(base: string, primary: string, strength: number): string {
  const target = new TinyColor(base).getLuminance();
  const mixed = new TinyColor(base).mix(primary, strength).toHsl();

  let lo = 0;
  let hi = 1;
  let best = mixed.l;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const lum = new TinyColor({ ...mixed, l: mid }).getLuminance();
    best = mid;
    if (lum > target) hi = mid;
    else lo = mid;
  }
  return new TinyColor({ ...mixed, l: best }).toHexString();
}

function tintedNeutrals(primary: string, mode: ThemeMode): ThemeVars {
  const out: ThemeVars = {};
  for (const [name, [base, strength]] of Object.entries(NEUTRALS[mode])) {
    out[name] = tintPreservingLuminance(base, primary, strength);
  }
  return out;
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

    // ——— 淡色档（2026-09-19 补）———
    // theme-default.less 原本只有上面 7 档，缺「淡底 / 淡边框」这两级，
    // 于是选中态那类淡蓝只能写死（Cascader、TagTextarea 都是）。
    // 用透明档代替不行：主色 12% 透明在白底上混出来的那个色，
    // 比 antd 的 colorPrimaryBorder 淡得多，换上去边框会明显变虚。
    // 直接从 antd token 读回这两级，和上面几档同源，不会分叉。
    '--color-primary-bg': token.colorPrimaryBg,
    '--color-primary-border': token.colorPrimaryBorder,

    // ——— 带主题倾向的中性色阶 ———
    // 图标、次要文字、分隔线、浅底都走这一套；不含页面底/卡片底/输入框底/正文主文字。
    ...tintedNeutrals(primary, mode),
  };
}

/** 拼成可直接塞进 <style> 的声明串。 */
export function themeVarsToCssText(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}
