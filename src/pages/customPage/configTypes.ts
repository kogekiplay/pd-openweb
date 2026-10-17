/** Persisted page settings, shared by the editor, renderer and theme synchronization. */
export interface CustomPageTitleStyles {
  color?: string | undefined;
  fontSize?: number | undefined;
  fontBold?: boolean | undefined;
  fontItalic?: boolean | undefined;
  textAlign?: 'left' | 'center' | 'right' | undefined;
  index?: number | undefined;
  isInitial?: boolean | undefined;
}

export interface CustomPageChartColor {
  colorType?: number | undefined;
  /** BaseColor keeps null for the legacy colorGroupIndex selection. */
  colorGroupId?: string | null | undefined;
  colorGroupIndex?: number | undefined;
  customColors?: string[] | undefined;
  personColor?: { name?: string | undefined; colors?: string[] | undefined } | undefined;
}

export interface CustomPageConfig {
  pageStyleType?: string | undefined;
  pageBgColor?: string | undefined;
  lightPageBgColor?: string | undefined;
  darkPageBgColor?: string | undefined;
  pageBgImage?: string | undefined;
  widgetBgColor?: string | undefined;
  darkenPageBgColor?: string | undefined;
  chartColor?: CustomPageChartColor | '' | undefined;
  chartColorIndex?: number | undefined;
  numberChartColor?: string | undefined;
  numberChartColorIndex?: number | undefined;
  pivoTableColor?: string | undefined;
  pivoTableColorIndex?: number | undefined;
  titleStyle?: number | undefined;
  titleStyles?: CustomPageTitleStyles | undefined;
  customColors?: string[] | undefined;
  refresh?: number | undefined;
  headerVisible?: boolean | undefined;
  shareVisible?: boolean | undefined;
  chartShare?: boolean | undefined;
  chartExportExcel?: boolean | undefined;
  downloadVisible?: boolean | undefined;
  fullScreenVisible?: boolean | undefined;
  autoLinkage?: boolean | undefined;
  webNewCols?: number | undefined;
  /** Existing persisted spelling; this is the original grid width before normalization. */
  orightWebCols?: number | undefined;
}
