import type { ComponentType, CSSProperties, ReactNode, Ref, RefObject } from 'react';
import type { GridImperativeAPI } from 'react-window';
import type { OverlayScrollbars } from 'overlayscrollbars';

export type GridId = `${'top' | 'main' | 'bottom'}-${'left' | 'center' | 'right'}`;
export interface GridCoordinates {
  id: GridId;
  tableColumnCount: number;
  leftFixed?: boolean | undefined;
  rightFixed?: boolean | undefined;
  topFixed?: boolean | undefined;
  bottomFixed?: boolean | undefined;
  rightFixedCount: number;
  leftFixedCount: number;
}
export interface FixedTableCellProps<Data extends object = object> {
  rowIndex: number;
  columnIndex: number;
  style: CSSProperties;
  data: Omit<Data, 'grid'> & { grid: GridCoordinates };
  /** React reserves key; the old cells read the absent key as undefined. */
  key?: undefined;
}
export interface FixedTableHandle {
  dom: RefObject<HTMLDivElement | null>;
  forceUpdate(): void;
  setScroll(left?: number | undefined, top?: number | undefined): void;
  setScrollX(left: number): void;
}
export interface FixedTableLayoutProps {
  ref?: Ref<FixedTableHandle> | undefined;
  noRenderEmpty?: boolean | undefined;
  isGroupTableView?: boolean | undefined;
  isSubList?: boolean | undefined;
  loading?: boolean | undefined;
  showLoadingMask?: boolean | undefined;
  loadingMaskChildren?: ReactNode;
  className?: string | undefined;
  showHead?: boolean | undefined;
  showFoot?: boolean | undefined;
  width: number;
  height: number;
  columnHeadHeight?: number | undefined;
  rowCount: number;
  disableYScroll?: boolean | undefined;
  columnCount: number;
  barWidth?: number | undefined;
  sheetColumnWidths?: Record<string, number> | undefined;
  rowHeight?: number | undefined;
  getColumnWidth(index: number): number;
  getRowHeight?: ((index: number) => number) | undefined;
  leftFixedCount?: number | undefined;
  rightFixedCount?: number | undefined;
  hasSubListFooter?: boolean | undefined;
  defaultScrollLeft?: number | undefined;
  renderEmpty?: ((args: { style: CSSProperties }) => ReactNode) | undefined;
  disablePanVertical?: boolean | undefined;
  tableFooter?: { height: number; comp?: ReactNode } | undefined;
  onScroll?: ((instance: OverlayScrollbars) => void) | undefined;
  renderCompInMainCenter?: (() => ReactNode) | undefined;
  /** WorksheetTable's styled producer consumes these; FixedTable never reads them. */
  controlStyles?: string | undefined;
  recordControlStyles?: string | undefined;
  setHeightAsRowCount?: boolean | undefined;
}
export interface FixedTableProps<Data extends object> extends FixedTableLayoutProps {
  tableData: Data;
  Cell: ComponentType<FixedTableCellProps<Data>>;
}
export interface EmptyFixedTableProps extends FixedTableLayoutProps {
  tableData?: undefined;
  Cell: ComponentType<FixedTableCellProps<object>>;
}
export type FixedTableCache = {
  left: number;
  top: number;
  needUpdated: Record<string, unknown>;
  didMount?: boolean;
  scrollX?: HTMLElement | null;
  scrollY?: HTMLElement | null;
} & Partial<Record<GridId, GridImperativeAPI | null>>;
export interface HammerCache {
  leftForHammer?: number;
  topForHammer?: number;
  lastPandeltaX?: number;
  lastPandeltaY?: number;
}
export interface GridProps<Data extends object> {
  id: GridId;
  isGroupTableView?: boolean | undefined;
  leftFixed?: boolean | undefined;
  rightFixed?: boolean | undefined;
  topFixed?: boolean | undefined;
  bottomFixed?: boolean | undefined;
  width: number;
  height: number;
  columnHeadHeight: number;
  rowCount: number;
  columnCount: number;
  topFixedCount: number;
  bottomFixedCount: number;
  leftFixedCount: number;
  rightFixedCount: number;
  rowHeight: number;
  getColumnWidth(index: number): number;
  getRowHeight?: ((index: number) => number) | undefined;
  Cell: ComponentType<FixedTableCellProps<Data>>;
  tableData: Data;
  setRef?: ((api: GridImperativeAPI | null) => void) | undefined;
  renderCustomComp?: (() => ReactNode) | undefined;
  cache: FixedTableCache;
}
export interface ScrollBarProps {
  type?: 'x' | 'y' | undefined;
  barWidth: number;
  style?: CSSProperties | undefined;
  contentStyle?: CSSProperties | undefined;
  setRef?: ((element: HTMLElement | null) => void) | undefined;
  onScroll?: ((instance: OverlayScrollbars) => void) | undefined;
  setScrollX?: ((left: number) => void) | undefined;
  setScrollY?: ((top: number) => void) | undefined;
}
