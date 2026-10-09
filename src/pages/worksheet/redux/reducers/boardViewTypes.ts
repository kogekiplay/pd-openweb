import type { WorksheetRowsRequest } from 'src/pages/worksheet/types';
import type { ControlOption, FormControl } from 'src/utils/controlTypes';

/** A board cell is stored in a serialized worksheet record, including complex JSON values. */
export type BoardCellValue =
  string | number | boolean | null | BoardCellValue[] | { [key: string]: BoardCellValue | undefined };
export interface BoardRecord {
  rowid: string;
  allowedit?: boolean | undefined;
  allowdelete?: boolean | undefined;
  [controlId: string]: BoardCellValue | undefined;
}
export type BoardRecordPatch = Partial<BoardRecord>;
/** GetFilterRows with kanban parameters returns groups; its rows are JSON strings, not RecordRow objects. */
export interface BoardGroup {
  key: string;
  rows: string[];
  totalNum: number;
  name?: string | undefined;
  type?: number | undefined;
  sort?: number | undefined;
  color?: string | undefined;
}
export type BoardRecordCounts = Partial<Record<string, number>>;
export interface BoardViewPageState {
  hasMoreData: boolean;
  kanbanIndex: number;
}
export interface BoardViewCardState {
  needUpdate: boolean;
  height: number;
}
export interface BoardViewState {
  boardData: BoardGroup[];
  loading: boolean;
  boardViewLoading?: boolean | undefined;
  boardViewState: BoardViewPageState;
  /** The historical initial state omits this until INIT_BOARD_VIEW_RECORD_COUNT. */
  boardViewRecordCount?: BoardRecordCounts | undefined;
  boardViewCard: BoardViewCardState;
  sortedOptionKeys: string[];
}
export interface BoardRecordLocation {
  key: string;
  rowId: string;
}
export interface BoardAddRecordPayload {
  key: string;
  item: BoardRecord;
}
export interface BoardGroupingInfo {
  type?: number | undefined;
  viewControl?: string | undefined;
}
export interface BoardUpdateRecordPayload extends BoardRecordLocation {
  item: BoardRecordPatch;
  info: BoardGroupingInfo;
  target?: string | undefined;
  targetName?: string | undefined;
}
export interface BoardMultiSelectPayload extends BoardRecordLocation {
  item: BoardRecord;
  prevValue?: string | undefined;
  currentValue?: string | undefined;
  info?: BoardGroupingInfo | undefined;
  selectControl?: { options?: Array<Pick<ControlOption, 'key' | 'value'>> | undefined } | undefined;
}
export interface BoardSortPayload extends BoardRecordLocation {
  targetKey: string;
  value: BoardCellValue | undefined;
  firstGroupChange: boolean;
  firstGroupControlId: string;
  secondGroupValue: BoardCellValue | undefined;
  secondGroupChange: boolean;
  /** viewSortRecord passes null when no second group is configured. */
  secondGroupControlId: string | null;
}
export interface BoardTitlePayload {
  key: string;
  index: number;
  data: BoardRecordPatch;
}
export type BoardRecordCountDelta = [key: string, delta: number];
export type BoardViewAction =
  | { type: 'CHANGE_BOARD_VIEW_DATA' | 'UPDATE_BOARD_VIEW_DATA'; data: BoardGroup[] }
  | { type: 'ADD_BOARD_VIEW_RECORD'; data: BoardAddRecordPayload }
  | { type: 'DEL_BOARD_VIEW_RECORD_COUNT'; data: BoardRecordLocation }
  | { type: 'UPDATE_BOARD_VIEW_RECORD'; data: BoardUpdateRecordPayload }
  | { type: 'SORT_BOARD_VIEW_RECORD'; data: BoardSortPayload }
  | { type: 'UPDATE_BOARD_TITLE_DATA'; data: BoardTitlePayload }
  | { type: 'CHANGE_BOARD_VIEW_LOADING'; loading: boolean; data?: never }
  | { type: 'CHANGE_BOARD_VIEW_STATE'; payload: Partial<BoardViewPageState>; data?: never }
  | { type: 'INIT_BOARD_VIEW_RECORD_COUNT'; data: BoardRecordCounts }
  | { type: 'UPDATE_BOARD_VIEW_RECORD_COUNT'; data: BoardRecordCountDelta }
  | { type: 'UPDATE_MULTI_SELECT_BOARD'; data: BoardMultiSelectPayload }
  | { type: 'CLEAR_BOARD_VIEW'; data: [] }
  | { type: 'UPDATE_BOARD_VIEW_CARD'; data: Partial<BoardViewCardState> }
  | { type: 'UPDATE_BOARD_VIEW_SORTED_OPTION_KEYS'; data: string[] };

export type BoardRowsRequest = WorksheetRowsRequest & { pageSize: number; kanbanIndex: number };
export interface BoardSortRequest extends Omit<BoardSortPayload, 'key'> {
  srcKey: string;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  projectId?: string | undefined;
  newOldControl: Array<
    Pick<FormControl, 'controlId' | 'type' | 'controlName' | 'dot'> & { value: BoardCellValue | undefined }
  >;
}
