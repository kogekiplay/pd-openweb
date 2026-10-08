export { enumWidgetType, getEnumType, getDefaultLayout, reorderComponents, getLayout, replaceColor } from 'src/pages/customPage/util';

export const getMaxLayoutHeight = (components: Array<{ web?: { layout?: { h: number; y: number } | undefined } | undefined; mobile?: { layout?: { h: number; y: number } | undefined } | undefined }> = [], layoutType: 'web' | 'mobile' = 'web'): number | undefined => {
  const heights = components.map(item => item[layoutType]?.layout)
    .filter((layout): layout is { h: number; y: number } => Boolean(layout) && Number.isFinite(layout?.h) && Number.isFinite(layout?.y))
    .map(layout => layout.h + layout.y);
  return heights.length ? Math.max(...heights) : undefined;
};
