import type { RecordRow } from 'src/utils/controlTypes';

/** Advanced-setting liststyle entries, indexed by the control ID. */
export interface SheetColumnStyle {
  cid?: string | undefined;
  width?: number | undefined;
  direction?: number | undefined;
  showtype?: number | undefined;
  coverFillType?: number | undefined;
  /** Summary choice stored by getWorksheetSheetViewSummary in liststyle. */
  report?: number | undefined;
}

// setColumnStyles maps optional liststyle widths without dropping absent values.
export type SheetColumnWidths = Record<string, number | undefined>;
export type SheetColumnStyles = Record<string, SheetColumnStyle>;
export interface SheetSortControl {
  controlId?: string | undefined;
  datatype?: number | undefined;
  isAsc?: boolean | undefined;
}
export interface SheetViewConfigState {
  fixedColumnCount: number;
  /** ColumnHead calls updateDefaultScrollLeft without a value when clearing the scroll position. */
  defaultScrollLeft: number | undefined;
  sheetColumnWidths: SheetColumnWidths;
  sheetColumnWidthsMap: SheetColumnWidths;
  sheetHiddenColumns: string[];
  allWorksheetIsSelected: boolean;
  sheetSelectedRows: RecordRow[];
  columnStyles: SheetColumnStyles;
}
export interface SheetFetchParamsState {
  pageIndex: number;
  pageSize: number;
  sortControls: SheetSortControl[];
}

export type SheetSummaryTypes = Record<string, number>;
/** GetFilterRowsReport has no generated value contract: retain its raw value without an any escape. */
export type SheetSummaryValues = Record<string, unknown>;
export interface SheetRowsSummary {
  types: SheetSummaryTypes;
  values: SheetSummaryValues;
}
export interface SheetGroupRowsSummaryValue {
  values: SheetSummaryValues;
}
/** The existing runtime stores the common `types` key alongside dynamic group-key entries. */
export interface SheetGroupRowsSummary {
  types?: SheetSummaryTypes | undefined;
  [groupKey: string]: SheetGroupRowsSummaryValue | SheetSummaryTypes | undefined;
}
export interface SheetViewDataState {
  loading: boolean;
  rows: RecordRow[];
  count: number;
  rowsSummary: SheetRowsSummary;
  groupRowsSummary: SheetGroupRowsSummary;
  permission: Record<string, HapApi.MD.Entity.Role.AppRoleGrpcModel.ViewPermission>;
  refreshFlag?: number | undefined;
  pageCountAbnormal?: boolean | undefined;
}
export type SheetFoldedMap = Record<string, boolean>;
export interface SheetGroupFetchParams {
  pageIndex?: number | undefined;
}
export type SheetGroupFetchParamsState = Record<string, SheetGroupFetchParams>;
export interface SheetFetchRowsOptions {
  noLoading?: boolean | undefined;
  noClearSelected?: boolean | undefined;
}

/** Every payload is tied to the action name consumed by this reducer module. */
export type SheetViewAction =
  | { type: 'WORKSHEET_SHEETVIEW_SELECT_ALL'; value: boolean }
  | { type: 'WORKSHEET_SHEETVIEW_SELECT_ROWS'; rows: RecordRow[] }
  | { type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS_START'; value?: SheetFetchRowsOptions | undefined }
  | { type: 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH'; value: SheetColumnWidths }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH'; controlId: string; value: number; changes?: undefined }
  | {
      type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH';
      changes: SheetColumnWidths;
      controlId?: string | undefined;
      value?: number | undefined;
    }
  | { type: 'WORKSHEET_SHEETVIEW_HIDE_COLUMN'; controlId: string }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_FIXED_COLUMN_COUNT'; value: number }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_SCROLL_LEFT'; value: number | undefined }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_STYLES'; value: SheetColumnStyles }
  | { type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGEINDEX'; pageIndex: number }
  | { type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGESIZE'; pageSize: number; pageIndex?: number | undefined }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_SORTS'; sortControl?: SheetSortControl | undefined }
  | {
      type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS' | 'WORKSHEET_SHEETVIEW_UPDATE_ROWS' | 'WORKSHEET_SHEETVIEW_APPEND_ROWS';
      rows: RecordRow[];
      resultCode?: number | undefined;
    }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT'; count: number }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS_BY_ROWIDS'; rowIds: string[]; rowUpdatedValue: Partial<RecordRow> }
  | {
      type: 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS';
      groupKey?: string | undefined;
      types?: SheetSummaryTypes | undefined;
      values?: SheetSummaryValues | undefined;
    }
  | { type: 'WORKSHEET_SHEETVIEW_HIDE_ROWS'; rowIds: string[] }
  | {
      type: 'WORKSHEET_SHEETVIEW_UPDATE_PERMISSION';
      viewId: string;
      value: HapApi.MD.Entity.Role.AppRoleGrpcModel.ViewPermission;
    }
  | { type: 'WORKSHEET_SHEETVIEW_UPDATE_FOLDED'; value: SheetFoldedMap }
  | { type: 'WORKSHEET_SHEETVIEW_CHANGE_GROUP_FETCH_PARAMS'; groupKey: string; changes: SheetGroupFetchParams }
  | {
      type:
        | 'WORKSHEET_INIT'
        | 'WORKSHEET_SHEETVIEW_CLEAR'
        | 'WORKSHEET_SHEETVIEW_CLEAR_SELECT'
        | 'WORKSHEET_SHEETVIEW_CLEAR_HIDDEN_COLUMN'
        | 'WORKSHEET_SHEETVIEW_REFRESH'
        | 'WORKSHEET_SHEETVIEW_UPDATE_COUNT_ABNORMAL'
        | 'WORKSHEET_SHEETVIEW_INIT_ABORT_CONTROLLER'
        | 'WORKSHEET_SHEETVIEW_CLEAR_FOLDED';
    };

export type SheetViewActionOf<Type extends SheetViewAction['type']> = SheetViewAction & { type: Type };

/** WorksheetTable supplies no single-column ID/value for a batch-width event. */
export interface SheetColumnWidthActionCreator {
  (
    controlId: string,
    value: number,
    changes?: SheetColumnWidths,
  ): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH'>;
  (
    controlId: string | undefined,
    value: number | undefined,
    changes: SheetColumnWidths,
  ): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH'>;
}
