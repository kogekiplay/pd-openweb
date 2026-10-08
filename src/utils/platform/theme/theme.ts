export { getDefaultThemeMode, setBodyThemeMode } from 'src/utils/common';

import { TinyColor } from '@ctrl/tinycolor';
export function setAppThemeColor(color: string): boolean {
  const parsedColor = new TinyColor(color);
  if (!parsedColor.isValid) return false;
  const normalizedColor = parsedColor.toHexString();
  const style = document.getElementById('app-theme-color-style') || document.createElement('style');
  style.id = 'app-theme-color-style';
  style.textContent = `:root { --app-primary-color: ${normalizedColor}; --app-primary-hover-color: ${new TinyColor(normalizedColor).darken(5).toString()}; --app-highlight-color: ${new TinyColor(normalizedColor).setAlpha(0.2).toRgbString()}`;
  if (!style.parentNode) document.head.appendChild(style);
  return true;
}
