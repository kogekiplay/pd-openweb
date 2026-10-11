import type { CSSProperties } from 'react';
import type { FormControl } from '../../../../utils/controlTypes';
import type { RecordRow } from '../../../../utils/controlTypes';
import type { SheetSwitchPermitItem } from '../../../../utils/worksheetTypes';
import type { SheetColumnStyles } from '../../../../utils/worksheetTypes';
import type { SheetSortControl } from '../../redux/reducers/sheetviewTypes';
import type { EditingFilter, FilterSaveItem, FilterState, FilterWireItem } from './filterModelTypes';
import type { FilterActions } from './model';

export interface FilterPanelChange {
  filterControls: FilterSaveItem[] | undefined;
  /** Present in parent callback destructuring; this panel does not set it. */
  searchType?: number | undefined;
}
export interface FilterPanelBase {
  projectId?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  isCharge?: boolean | undefined;
}
export interface WorkSheetFilterProps extends FilterPanelBase {
  viewId?: string | undefined;
  columns: FormControl[];
  sheetSwitchPermit?: SheetSwitchPermitItem[] | undefined;
  onChange: (change: FilterPanelChange) => void;
  showSavedFilters?: boolean | undefined;
  filterResigned?: boolean | undefined;
  style?: CSSProperties | undefined;
  zIndex?: number | undefined;
  filterCompId?: string | undefined;
  className?: string | undefined;
  type?: string | undefined;
  isSingleView?: boolean | undefined;
  persistFilterToUrl?: boolean | undefined;
  getPopupContainer?: (() => HTMLElement) | undefined;
  controlledFilterControls?: readonly FilterWireItem[] | undefined;
  disableAdd?: boolean | undefined;
  readOnly?: boolean | undefined;
  /** Existing pass-through context, unconsumed by the filter panel. */
  chartId?: unknown;
  appPkg?: unknown;
  clearChartId?: unknown;
  onlyUseEditing?: boolean | undefined;
}
export interface FiltersPopupProps extends WorkSheetFilterProps {
  state: FilterState;
  actions: FilterActions;
  popupHandleRef?: import('react').Ref<Pick<WorkSheetFilterHandle, 'handleWorksheetHeadAddFilter'>> | undefined;
}
export interface FiltersPanelProps extends WorkSheetFilterProps {
  state: FilterState;
  actions: FilterActions;
  popupVisible?: boolean | undefined;
  maxHeight?: number | undefined;
  onHideFilterPopup?: (() => void) | undefined;
}
export interface WorkSheetFilterHandle {
  reset(): void;
  handleWorksheetHeadAddFilter(control: FormControl): void;
}
export interface FiltersHandle {
  addFilterByControl(control: FormControl): void;
}
export interface FilterPanelCache {
  callFromColumn?: boolean | undefined;
  queryFlag?: number | undefined;
  editingFilter?: EditingFilter | undefined;
}
export interface ColumnWidthUpdate {
  controlId?: string | undefined;
  value?: number | undefined;
  changes?: Record<string, number | undefined> | undefined;
}
export interface ColumnMenuContext {
  closeMenu(): void;
}
export interface TrashFilterColumnProps {
  worksheetId?: string | undefined;
  selected?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  control: FormControl;
  isAsc?: boolean | undefined;
  isLast?: boolean | undefined;
  changeSort: (isAsc?: boolean) => void;
  updateSheetColumnWidths?: ((value: ColumnWidthUpdate) => unknown) | undefined;
  onShowFullValue?: (() => void) | undefined;
  /** Parent table passes this legacy context through; it is not consumed here. */
  type?: string | undefined;
}
export interface RelateFilterColumnProps extends Omit<TrashFilterColumnProps, 'worksheetId' | 'selected'> {
  iseditting?: boolean | undefined;
  isCustomButtonFillRecord?: boolean | undefined;
  disabled?: boolean | undefined;
  isNewRecord?: boolean | undefined;
  tableId: string;
  columnIndex?: number | undefined;
  fixedColumnCount?: number | undefined;
  isRelationRecord?: boolean | undefined;
  selectedRowIds?: string[] | undefined;
  sheetHiddenColumnIds?: string[] | undefined;
  visibleControls?: FormControl[] | undefined;
  clearHiddenColumn: () => void;
  hideColumn: (controlId: string | undefined) => void;
  frozen: (columnIndex: number) => void;
  getPopupContainer?: ((node: HTMLElement) => HTMLElement) | undefined;
  handleBatchUpdateRecords: (control: FormControl) => void;
  isDraft?: boolean | undefined;
  hideFilter?: boolean | undefined;
}
export interface WorksheetFilterColumnProps {
  control: FormControl & { hideFrozen?: boolean | undefined };
  controlId?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  type?: string | number | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  disabled?: boolean | undefined;
  showRequired?: boolean | undefined;
  isLast?: boolean | undefined;
  isCharge?: boolean | undefined;
  readonly?: boolean | undefined;
  fromEmbed?: boolean | undefined;
  rowIsSelected?: boolean | undefined;
  isTreeTableView?: boolean | undefined;
  columnIndex?: number | undefined;
  fixedColumnCount?: number | undefined;
  canBatchEdit?: boolean | undefined;
  count: number;
  columns?: FormControl[] | undefined;
  rows?: RecordRow[] | undefined;
  columnStyles?: SheetColumnStyles | undefined;
  allWorksheetIsSelected?: boolean | undefined;
  sheetSelectedRows?: RecordRow[] | undefined;
  disabledFunctions?: string[] | undefined;
  sortControls?: SheetSortControl[] | undefined;
  sheetHiddenColumns?: string[] | undefined;
  reduxSheetHiddenColumns?: string[] | undefined;
  hideColumn?: ((id: string | undefined) => unknown) | undefined;
  clearHiddenColumn?: (() => unknown) | undefined;
  reduxHideColumn?: ((id: string) => unknown) | undefined;
  reduxClearHiddenColumn?: (() => unknown) | undefined;
  frozenColumn: (index: number) => unknown;
  sortByControl: (control: SheetSortControl) => unknown;
  updateColumnStyles: (changes: SheetColumnStyles) => unknown;
  saveColumnStylesToLocal: (changes: SheetColumnStyles) => unknown;
  updateSheetColumnWidths: (update: ColumnWidthUpdate) => unknown;
  updateDefaultScrollLeft: () => unknown;
  onBatchEdit: (control: FormControl) => unknown;
  onShowFullValue?: (() => void) | undefined;
  onBatchSetColumns?: (() => void) | undefined;
  scrollToLeftStart?: (() => void) | undefined;
  /** Redux supplies this unused pass-through property. */
  worksheetInfo?: unknown;
}
