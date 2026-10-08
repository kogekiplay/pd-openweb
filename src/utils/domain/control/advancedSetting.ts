export { getAdvanceSetting, handleAdvancedSettingChange } from 'src/utils/controlCommon';
export { parseAdvancedSetting } from 'src/utils/control';

export const getSplitLineTextColor = (color?: string | null): string =>
  !color || color.trim().toLowerCase() === '#151515' ? 'var(--color-text-primary)' : color;
