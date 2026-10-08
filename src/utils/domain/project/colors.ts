export { SYS_COLOR, SYS_CHART_COLORS } from 'src/pages/Admin/settings/config';

import { TinyColor } from '@ctrl/tinycolor';
import { SYS_COLOR } from 'src/pages/Admin/settings/config';
export const isLightThemeColor = (color = ''): boolean => {
  if (SYS_COLOR.some(item => item.color === color.toLocaleUpperCase())) return false;
  const darkColors = ['ff9300', 'fa8c16', '808080', '4caf50', '08c9c9', 'fad714', 'faad14'];
  const normalizedColor = new TinyColor(color);
  return !darkColors.includes(normalizedColor.toHex()) && normalizedColor.isLight();
};
