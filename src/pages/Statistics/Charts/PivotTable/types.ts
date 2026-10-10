import type { CSSProperties, ReactNode } from 'react';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import type { ControlAdvancedSetting } from 'src/utils/controlTypes';

export interface PivotStyleColors {
  columnBgColor?: string | undefined;
  lineBgColor?: string | undefined;
  columnTextColor?: string | undefined;
  lineTextColor?: string | undefined;
  evenBgColor?: string | undefined;
  evenTextColor?: string | undefined;
  oddBgColor?: string | undefined;
  oddTextColor?: string | undefined;
  textColor?: string | undefined;
  cellTextAlign?: string | undefined;
  lineTextAlign?: string | undefined;
  columnTextAlign?: string | undefined;
  pivoTableColorIndex?: number | undefined;
  [metadata: string]: unknown;
}
export interface CustomPageColors {
  pivoTableColor?: string | undefined;
  pivoTableColorIndex?: number | undefined;
  pageStyleType?: string | undefined;
  widgetBgColor?: string | undefined;
  originWidgetBgColor?: string | undefined;
  [metadata: string]: unknown;
}
export interface PivotStyle {
  pivotTableStyle?: PivotStyleColors | undefined;
  pivotTableColumnWidthConfig?: Record<string, number | string> | undefined;
  pivotTableColumnFreeze?: boolean | undefined;
  pivotTableLineFreeze?: boolean | undefined;
  mobilePivotTableColumnFreeze?: boolean | undefined;
  mobilePivotTableLineFreeze?: boolean | undefined;
  pivotTableLineFreezeIndex?: number | undefined;
  mobilePivotTableLineFreezeIndex?: number | undefined;
  pivotTableUnilineShow?: boolean | undefined;
  paginationSize?: number | undefined;
  paginationVisible?: boolean | undefined;
  pcWidthModel?: number | undefined;
  mobileWidthModel?: number | undefined;
  autoLinkageChartObjectIds?: string[] | undefined;
  [metadata: string]: unknown;
}
export interface PivotSetting extends ControlAdvancedSetting {}
export interface PercentConfig {
  enable?: boolean | undefined;
  type?: number | undefined;
  dot?: number | undefined;
  roundType?: number | undefined;
  dotFormat?: string | undefined;
}
export interface AxisField {
  controlId: string;
  cid?: string | undefined;
  controlName?: string | undefined;
  controlType?: number | undefined;
  hide?: boolean | undefined;
  rename?: string | undefined;
  size?: number | undefined;
  fields?: AxisField[] | undefined;
  advancedSetting?: PivotSetting | undefined;
  displayMode?: string | undefined;
  subTotal?: boolean | undefined;
  xaxisEmptyType?: number | boolean | undefined;
  subTotalName?: string | undefined;
  showNumber?: boolean | undefined;
  percent?: PercentConfig | undefined;
  normType?: number | undefined;
  emptyShowType?: number | undefined;
  [metadata: string]: unknown;
}
export interface PivotCellObject {
  value: unknown;
  length?: number | undefined;
  sum?: boolean | undefined;
  subTotalName?: string | undefined;
  sumSuffix?: string | undefined;
  [metadata: string]: unknown;
}
export interface PivotResultItem {
  t_id: string;
  y: unknown[];
  data: unknown[];
  sum?: number | undefined;
  summary_col?: boolean | undefined;
  [metadata: string]: unknown;
}
export interface PivotLineData {
  key: string;
  name?: string | undefined;
  data: unknown[];
  xaxisEmptyType?: number | boolean | undefined;
}
export interface SummaryItem {
  controlId?: string | undefined;
  name?: string | undefined;
  number?: boolean | undefined;
  percent?: boolean | undefined;
}
export interface SummaryConfig {
  location?: number | undefined;
  rename?: string | undefined;
  controlList: SummaryItem[];
}
export interface PivotSummary {
  showLineTotal?: boolean | undefined;
  showColumnTotal?: boolean | undefined;
  lineSummary: SummaryConfig;
  columnSummary: SummaryConfig;
}
export interface PivotRecord {
  key: number | string;
  type?: string | undefined;
  isSubTotal?: boolean | undefined;
  showNumber?: boolean | undefined;
  showPercent?: number | false | '' | undefined;
  lineSubTotal?: number | undefined;
  sumCount?: number | undefined;
  sumData?: SummaryItem | undefined;
  [cell: string]: unknown;
}
export interface PivotReportData extends PivotSummary {
  reportId: string;
  appId?: string | undefined;
  name?: string | undefined;
  reportType?: number | undefined;
  style?: PivotStyle | undefined;
  data: { data: PivotResultItem[]; x: Record<string, string[]>[] };
  columns: AxisField[];
  lines: AxisField[];
  yaxisList: AxisField[];
  valueMap: Record<string, Record<string, unknown>>;
  yvalueMap: Record<string, Record<string, unknown>>;
  displaySetup: {
    mergeCell?: boolean | undefined;
    showRowList?: boolean | undefined;
    colorRules?: ColorRule[] | undefined;
  };
  pivotTable?: PivotSummary | undefined;
  [metadata: string]: unknown;
}
export interface LinkageFilter {
  controlId?: string | undefined;
  values: unknown[];
  controlName?: string | undefined;
  controlValue?: unknown;
  type?: number | undefined;
  control: Partial<AxisField>;
}
export interface LinkageMatch {
  sheetId?: string | undefined;
  reportId: string;
  reportName?: string | undefined;
  reportType?: number | undefined;
  filters: LinkageFilter[];
  lineValue?: unknown;
  columnValue?: unknown;
  onlyChartIds?: string[] | undefined;
}
export interface OriginalDataRequest {
  isPersonal: boolean;
  match: Record<string, unknown> | null;
}
export interface PivotProps {
  reportData: PivotReportData;
  themeColor?: string | undefined;
  customPageConfig?: CustomPageColors | undefined;
  sourceType?: number | undefined;
  linkageMatch?: unknown;
  isViewOriginalData?: boolean | undefined;
  isLinkageData?: boolean | undefined;
  isThumbnail?: boolean | undefined;
  isHorizontal?: boolean | undefined;
  settingVisible?: boolean | undefined;
  projectId?: string | undefined;
  onUpdateLinkageFiltersGroup?: ((match: LinkageMatch | null) => void) | undefined;
  onOpenChartDialog?: ((request: OriginalDataRequest) => void) | undefined;
  requestOriginalData?: ((request: OriginalDataRequest) => void) | undefined;
  onChangeCurrentReport?: ((change: { style: PivotStyle }) => void) | undefined;
}
export interface PivotState {
  dragValue: number;
  pageSize: number | undefined;
  pageIndex: number;
  dropdownVisible: boolean | number | undefined;
  offset: { x?: number | undefined; y?: number | undefined };
  match: Record<string, unknown> | null;
  linkageMatch: LinkageMatch | null;
}
export interface Range {
  min?: unknown;
  max?: unknown;
  center?: number | undefined;
}
export type ControlMinAndMax = Record<string, Range>;
export interface ScopeRule {
  type?: number | undefined;
  and?: number | undefined;
  color?: string | undefined;
  min?: number | null | undefined;
  max?: number | null | undefined;
  value?: number | null | undefined;
  dynamicMin?: boolean | undefined;
  dynamicMax?: boolean | undefined;
}
export interface StyleRule {
  model?: number | undefined;
  applyValue?: number | undefined;
  controlId?: string | undefined;
  colors?: string[] | undefined;
  centerVisible?: boolean | undefined;
  min?: { value?: number | null | undefined } | undefined;
  max?: { value?: number | null | undefined } | undefined;
  center?: { value?: number | null | undefined } | undefined;
  scopeRules?: ScopeRule[] | undefined;
  [metadata: string]: unknown;
}
export interface DataBarRule {
  min?: number | null | undefined;
  max?: number | null | undefined;
  direction?: number | undefined;
  onlyShowBar?: boolean | undefined;
  axisColor?: string | undefined;
  positiveNumberColor?: string | undefined;
  negativeNumberColor?: string | undefined;
  [metadata: string]: unknown;
}
export interface ColorRule {
  controlId?: string | undefined;
  textColorRule?: StyleRule | undefined;
  bgColorRule?: StyleRule | undefined;
  dataBarRule?: DataBarRule | undefined;
  [metadata: string]: unknown;
}
export interface CompiledStyleRule extends StyleRule {
  sourceControlId?: string | undefined;
  sourceIndex?: number | undefined;
  rangeControlId?: string | undefined;
  minValue?: number | undefined;
  maxValue?: number | undefined;
  centerValue?: number | undefined;
}
export interface CompiledDataBarRule extends DataBarRule {
  rangeControlId: string;
  minValue?: number | undefined;
  maxValue?: number | undefined;
  useDefaultMin: boolean;
  dynamicMin: boolean;
  dynamicMax: boolean;
}
export interface CompiledColorRule extends Omit<ColorRule, 'dataBarRule'> {
  textColorRule: CompiledStyleRule;
  bgColorRule: CompiledStyleRule;
  dataBarRule: CompiledDataBarRule | undefined;
}
export interface ColorRuleConfig {
  yaxisMap: Record<string, AxisField>;
  yaxisIndexMap: Record<string, number>;
  colorRuleMap: Record<string, CompiledColorRule>;
  rangeControlIds: string[];
}
export interface BodyCellArgs {
  value: unknown;
  record: PivotRecord;
  controlId: string;
  controlMinAndMax: ControlMinAndMax;
  columnIndex: number;
  recordIndex: number;
  result?: PivotResultItem[] | undefined;
  colorRuleConfig?: Partial<ColorRuleConfig> | undefined;
}
export type RenderOutput = ReturnType<NonNullable<ColumnType<PivotRecord>['render']>>;
export interface PivotTableColumn extends ColumnType<PivotRecord> {
  children?: PivotTableColumn[];
  render?: (value: unknown, record: PivotRecord, index: number) => RenderOutput;
}
export interface CellBackgroundStyle extends CSSProperties {
  '--pivot-table-cell-bg'?: string;
}
export type PivotTableColumns = ColumnsType<PivotRecord>;
export type PivotNode = ReactNode;
export interface PivotFile {
  fileID?: string | undefined;
  previewUrl: string;
  ext: string;
  [metadata: string]: unknown;
}
