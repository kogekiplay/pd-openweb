export { APPLICATION_ICON } from 'src/utils/enum';

export const getCustomIconUrl = (iconName?: string | null): string | undefined =>
  iconName ? `https://fp1.mingdaoyun.cn/customIcon/${iconName}.svg` : undefined;
