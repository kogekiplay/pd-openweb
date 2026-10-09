/** Canonical column-style model shared by reducers and parsed liststyle snapshots. */
export interface SheetColumnStyle {
  cid?: string | undefined;
  width?: number | undefined;
  direction?: number | undefined;
  showtype?: number | undefined;
  coverFillType?: number | undefined;
  report?: number | undefined;
}
export type SheetColumnWidths = Record<string, number | undefined>;
export type SheetColumnStyles = Record<string, SheetColumnStyle>;
export interface WorksheetListStyle {
  time?: number | string | undefined;
  styles?: Array<SheetColumnStyle & { cid: string }> | undefined;
  [key: string]: unknown;
}
export interface WorksheetMenuNode<Node = WorksheetMenuItem> {
  workSheetId?: string | undefined;
  type?: number | undefined;
  status?: number | undefined;
  navigateHide?: boolean | undefined;
  items?: Node[] | undefined;
  workSheetName?: string | undefined;
  icon?: string | undefined;
  parentGroupId?: string | undefined;
  parentId?: string | undefined;
}
export interface WorksheetMenuItem extends WorksheetMenuNode<WorksheetMenuItem> {}
export interface WorksheetButtonSource {
  btnId?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
  icon?: string | undefined;
  iconUrl?: string | undefined;
  iconColor?: string | undefined;
  color?: string | undefined;
}
export interface WorksheetPrintSource {
  id?: string | undefined;
  name?: string | undefined;
}
export type CustomOperateButton<B extends WorksheetButtonSource> = Omit<B, 'type' | 'btnId'> & {
  type: 'custom_button';
  btnId: string;
};
export interface GroupOperateButton<B extends WorksheetButtonSource> {
  color?: undefined;
  type: 'group_ref';
  btnId: string;
  id: string;
  source?: string | undefined;
  name?: string | undefined;
  icon?: string | undefined;
  iconUrl?: string | undefined;
  iconColor?: string | undefined;
  buttons: Array<CustomOperateButton<B>>;
}
export interface PrintOperateButton<P extends WorksheetPrintSource> {
  type: 'print';
  btnId: string;
  name: string | undefined;
  icon: 'print';
  color: string;
  printItem: P & { id: string };
}
export type SystemOperateType = 'copy' | 'share' | 'delete' | 'sysprint';
export interface SystemOperateButton {
  type: SystemOperateType;
  btnId: SystemOperateType;
  name: string;
  icon: string;
  color: string;
}
export type WorksheetOperateButton<
  B extends WorksheetButtonSource = WorksheetButtonSource,
  P extends WorksheetPrintSource = WorksheetPrintSource,
> = CustomOperateButton<B> | GroupOperateButton<B> | PrintOperateButton<P> | SystemOperateButton;
export type OperatesButtonStyle = 'standard' | 'text' | 'icon';
/** JSON primitives accepted by the existing action-column settings. */
export type OperateButtonStyleValue = number | string | boolean | null;
export interface StoredOperateButtonStyle {
  icon: OperateButtonStyleValue;
  style: OperateButtonStyleValue;
  btncount: OperateButtonStyleValue;
  primarycount: OperateButtonStyleValue;
}
export interface OperateButtonStyleConfig {
  showIcon: boolean;
  style: OperatesButtonStyle | undefined;
  visibleNum: number;
  primaryNum: number;
}
export interface SheetSwitchPermitItem {
  type?: number | undefined;
  state?: boolean | undefined;
  viewIds?: string[] | undefined;
}
export interface SheetTableStyles {
  updateTime?: string | number | undefined;
  columnStyles: SheetColumnStyles;
  sheetColumnWidths: Record<string, number | string | undefined>;
}

export interface OperatesButtonsWidthOptions {
  buttons?: Array<{ type?: string | undefined; name?: string | undefined; icon?: string | undefined }> | undefined;
  style?: OperatesButtonStyle | undefined;
  visibleNum?: number | undefined;
  showIcon?: boolean | undefined;
  row?: import('src/utils/controlTypes').RecordRow | undefined;
}
export interface WorksheetCachedNavigation {
  groupId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  [key: string]: unknown;
}
export interface WorksheetAppCache {
  worksheets?: WorksheetCachedNavigation[] | undefined;
  lastWorksheetId?: string | undefined;
  [key: string]: unknown;
}
export type WorksheetExtensionNavigation = Record<string, Record<string, string>>;
export type WorksheetActionColumn =
  | { type: 'btn' | 'print'; id: string }
  | { type: 'group'; id: string; source?: string | undefined }
  | { type: SystemOperateType };
export interface WorksheetButtonGroup {
  type: 'group';
  id: string;
  name?: string | undefined;
  icon?: string | undefined;
  iconUrl?: string | undefined;
  iconColor?: string | undefined;
  btns?: string[] | undefined;
}

export interface SheetColumnWidthsSnapshot {
  time?: string | number | undefined;
  map?: SheetColumnWidths | undefined;
}
