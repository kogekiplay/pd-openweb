/**
 * 主题引擎的对外出口。
 *
 * 三层，越往下越薄：
 *   palette.ts        纯函数，种子色 -> CSS 变量。唯一有逻辑的地方，被 spec 钉死。
 *   applyThemeVars.ts 写 DOM，无 React。
 *   AppThemeScope.tsx React 侧的挂载点，渲染 null，只有副作用。
 */
export { buildThemeVars, themeVarsToCssText, PLATFORM_PRIMARY } from './palette';
export type { ThemeMode, ThemeVars } from './palette';
export {
  applyAppTheme,
  applyThemeVars,
  clearThemeVars,
  currentThemeMode,
  installPlatformTheme,
  resetToPlatformTheme,
} from './applyThemeVars';
export type { ElementLike } from './applyThemeVars';
export {
  default as AppThemeScope,
  getAppIdFromLocation,
  getCachedAppColor,
  syncThemeFromLocation,
} from './AppThemeScope';
