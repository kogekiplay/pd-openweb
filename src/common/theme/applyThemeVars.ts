/**
 * 把调色板写进 DOM。这一层【故意薄】—— 有逻辑的部分都在 palette.ts 里。
 *
 * 【为什么写 documentElement 的 inline style，而不是应用区域的包裹元素】
 * 设计文档原本写的是后者。核实时发现一条硬事实推翻了它：
 * ming-ui 的 Dialog 用 createPortal 挂到 document.body
 * （src/ming-ui/components/Dialog/DialogBase.tsx:120,375），
 * 在应用区域包裹元素【之外】。按原方案，应用里弹出的所有对话框都吃不到
 * 应用色 —— 而对话框正是主按钮最密集的地方。
 *
 * 反过来做还顺带解决了特异性问题：inline style 天然压过
 * `:root {}` 和 `[data-theme='dark'] {}`（两者特异性都是 0,1,0，
 * 谁后加载谁赢，靠加载顺序很脆）。
 *
 * 平台外壳则用 .platformThemeScope 类把平台调色板重新声明回去：
 * 元素【自身匹配到】的规则压过从 documentElement【继承】下来的值，
 * 继承弱于任何直接声明。
 */
import { buildThemeVars, PLATFORM_PRIMARY, themeVarsToCssText } from './palette';
import type { ThemeMode, ThemeVars } from './palette';

/**
 * 只要求用得上的两个方法。
 * 窄到这个程度是有意的 —— spec 能用几行假对象测，不必引 jsdom（本仓没装）。
 */
export interface ElementLike {
  style: { setProperty(key: string, value: string): void; removeProperty(key: string): void };
}

export const PLATFORM_SCOPE_CLASS = 'platformThemeScope';

const PLATFORM_STYLE_ID = 'md-platform-theme';

/** 暗色的唯一真相是 setBodyThemeMode 设在 documentElement 上的 data-theme。 */
export function currentThemeMode(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
}

/**
 * 【逐键删，不要整体清空】documentElement 的 inline style 不只有我们在写，
 * 一把 cssText = '' 会顺带抹掉别人的。
 */
export function clearThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const key of Object.keys(vars)) el.style.removeProperty(key);
}

/**
 * 拿到平台岛的 <style>，【只注入一次】——
 * 旧的 setAppThemeColor 每调一次就往 head 追加一个 <style>，
 * 那是个泄漏，不要重蹈。
 */
function ensurePlatformStyle(): HTMLStyleElement {
  const existing = document.getElementById(PLATFORM_STYLE_ID);
  if (existing) return existing as HTMLStyleElement;

  const style = document.createElement('style');
  style.id = PLATFORM_STYLE_ID;
  document.head.appendChild(style);
  return style;
}

function platformVars(): ThemeVars {
  return buildThemeVars(PLATFORM_PRIMARY, currentThemeMode());
}

/** 启动时调一次；切换明暗时再调一次。 */
export function installPlatformTheme(): void {
  const vars = platformVars();
  applyThemeVars(document.documentElement, vars);
  ensurePlatformStyle().textContent = `.${PLATFORM_SCOPE_CLASS}{${themeVarsToCssText(vars)}}`;
}

/** 进入某个应用时调。 */
export function applyAppTheme(seed: string): void {
  applyThemeVars(document.documentElement, buildThemeVars(seed, currentThemeMode()));
}

/** 离开应用时调 —— 不是「清空」，是「还原成平台色」。 */
export function resetToPlatformTheme(): void {
  applyThemeVars(document.documentElement, platformVars());
}
