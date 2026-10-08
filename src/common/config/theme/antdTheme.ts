import type { ThemeConfig } from 'antd';
import { currentThemeSeed } from 'src/common/theme/applyThemeVars';
import { antdTheme } from 'src/common/theme/palette';

// 复用 fork 的主题算法与 antd 前缀，应用主色、暗色及静态弹层共用同一套 token。
export const HAP_PREFIX_CLS = 'ant';
export const GLOBAL_FEEDBACK_Z_INDEX = 1500;
export const BUTTON_ICON_SIZES = { small: 14, middle: 16, large: 18, default: 16 };
export type AntdThemeMode = 'light' | 'dark';
export function getCurrentAntdThemeMode(mode?: string): AntdThemeMode {
  return (mode || (typeof document === 'undefined' ? 'light' : document.documentElement.getAttribute('data-theme'))) ===
    'dark'
    ? 'dark'
    : 'light';
}
export function getAntdThemeConfig(_mode: AntdThemeMode = getCurrentAntdThemeMode()): ThemeConfig {
  // fork 的颜色 token 使用随 data-theme 切换的 CSS 变量，不能再叠一套暗色算法。
  return antdTheme(currentThemeSeed());
}
