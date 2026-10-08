import { getAppOrItemColor } from 'src/pages/AppHomepage/Dashboard/utils';

/** 保留已有应用导航色的存值兼容规则，并用语义变量输出前景色。 */
export function getAppIconColors(app: { iconColor?: string | undefined; navColor?: string | undefined; lightColor?: string | undefined } = {}, fallbackIconColor = 'var(--color-primary)') {
  const iconColor = app.iconColor || fallbackIconColor;
  const source = { ...app, iconColor };
  const appColors = getAppOrItemColor(source);
  return {
    backgroundColor: appColors.bg,
    iconColor: appColors.iconColor === iconColor ? iconColor : 'var(--color-text-inverse)',
    itemIconColor: getAppOrItemColor(source, true).iconColor,
  };
}
