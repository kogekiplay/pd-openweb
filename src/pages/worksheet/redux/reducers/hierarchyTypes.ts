import type { FormControl } from 'src/utils/controlTypes';

/** Tree paths alternate array positions with the children property at runtime. */
export type HierarchyPath = number[];
export type HierarchyPropertyPath = Array<number | 'children'>;

/** Raw worksheet values remain JSON data; worksheet ids dynamically name their cells. */
export type HierarchyCellValue =
  string | number | boolean | null | undefined | HierarchyCellValue[] | { [key: string]: HierarchyCellValue };
export interface HierarchyRecord {
  rowid: string;
  pid?: string | undefined;
  childrenids?: string | string[] | undefined;
  controls?: FormControl[] | undefined;
  allowDelete?: boolean | undefined;
  [controlId: string]: HierarchyCellValue | FormControl[];
}

/** A child id means its record has not been expanded into a state node yet. */
/** String ids have no node properties. Optional never fields model the old renderer's property reads as undefined. */
export type HierarchyUnexpandedId = string & { readonly rowId?: never; readonly children?: never };
export type HierarchyChild = HierarchyUnexpandedId | HierarchyNode;
export interface HierarchyNode {
  rowId: string;
  path: HierarchyPath;
  pathId: string[];
  visible: boolean;
  display: boolean;
  children: HierarchyChild[];
}
export type HierarchyState = HierarchyNode[];

/** Temporary title records use rowId while server records use rowid. */
export interface HierarchyTextTitle {
  /** Temporary entries have no server record id or serialized child ids. */
  rowid?: never;
  childrenids?: never;
  rowId: string;
  path: HierarchyPath;
  pathId: string[];
  pid?: string | undefined;
  type?: 'textTitle' | undefined;
}
export type HierarchyDataItem = HierarchyRecord | HierarchyTextTitle;
export type HierarchyDataMap = Record<string, HierarchyDataItem>;
/** The reset action retains the historical empty-array value. */
export type HierarchyViewData = HierarchyDataMap | [];

export interface HierarchyChildrenPayload {
  data: HierarchyRecord[];
  path: HierarchyPath;
  pathId: string[];
}
export interface AddHierarchyChildPayload extends Omit<HierarchyChildrenPayload, 'data'> {
  data: HierarchyRecord;
  spliceTempRecord?: boolean | undefined;
}
export interface HierarchyMovePayload {
  src: Pick<HierarchyNode, 'rowId' | 'path' | 'pathId'>;
  target: Pick<HierarchyNode, 'rowId' | 'path' | 'pathId' | 'children'>;
}
export interface ExpandedHierarchyPayload {
  data: HierarchyRecord[];
  treeData: HierarchyDataMap;
  /** Config values arrive as strings; arithmetic in genTree coerces them. */
  level: number | string;
}
export type HierarchyStateAction =
  | { type: 'INIT_HIERARCHY_VIEW_STATE'; data: HierarchyRecord[] }
  | { type: 'TOGGLE_HIERARCHY_VISIBLE'; data: { path: HierarchyPath; visible?: boolean | undefined } }
  | { type: 'EXPAND_CHILDREN_STATE' | 'UPDATE_HIERARCHY_CHILDREN'; data: HierarchyChildrenPayload }
  | { type: 'EXPAND_HIERARCHY_VIEW_STATE'; data: ExpandedHierarchyPayload }
  | { type: 'ADD_HIERARCHY_CHILDREN_RECORD_STATE'; data: AddHierarchyChildPayload }
  | { type: 'ADD_RECORD_CHILDREN_WITH_ONLY_PAGINATION'; data: { index: number; rowId: string } }
  | { type: 'ADD_TOP_LEVEL_STATE'; data: HierarchyRecord | HierarchyRecord[] }
  | { type: 'ADD_TOP_LEVEL_STATE_FROM_TEMP'; data: HierarchyRecord }
  | { type: 'MOVE_RECORD' | 'MULTI_RELATE_MOVE_RECORD'; data: HierarchyMovePayload }
  | { type: 'ADD_TEXT_TITLE_RECORD'; data: HierarchyTextTitle }
  | { type: 'REMOVE_HIERARCHY_TEMP_ITEM'; data: Pick<HierarchyTextTitle, 'rowId' | 'path'> }
  | { type: 'CHANGE_HIERARCHY_DATA_VISIBLE'; data: Pick<HierarchyNode, 'rowId' | 'pathId'> };
export type HierarchyDataAction =
  | { type: 'INIT_HIERARCHY_VIEW_DATA'; data: HierarchyViewData }
  | { type: 'CHANGE_HIERARCHY_VIEW_DATA' | 'UPDATE_HIERARCHY_VIEW_DATA'; data: HierarchyDataMap }
  | Extract<
      HierarchyStateAction,
      {
        type:
          | 'ADD_HIERARCHY_CHILDREN_RECORD_STATE'
          | 'ADD_TEXT_TITLE_RECORD'
          | 'REMOVE_HIERARCHY_TEMP_ITEM'
          | 'ADD_TOP_LEVEL_STATE'
          | 'ADD_TOP_LEVEL_STATE_FROM_TEMP';
      }
    >;
export interface HierarchyDataStatus {
  loading: boolean;
  hasMoreData: boolean;
  pageIndex: number;
  pageSize: number;
}
export type HierarchyStatusAction = { type: 'CHANGE_HIERARCHY_DATA_STATUS'; data: Partial<HierarchyDataStatus> };
export type HierarchyCountAction = { type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT'; count: number };
export interface HierarchyControlsPayload {
  ids: string[];
  controls: FormControl[][];
}
export type HierarchyControlsMap = Partial<Record<string, FormControl[]>>;
export type HierarchyControlsAction = {
  type: 'INIT_HIERARCHY_RELATE_SHEET_CONTROLS' | 'ADD_HIERARCHY_RELATE_SHEET_CONTROLS';
  payload: HierarchyControlsPayload;
};
export type HierarchySearchAction = { type: 'CHANGE_HIERARCHY_SEARCH_RECORD_ID'; data: string | null };
export type HierarchyRecordInfoAction = { type: 'CHANGE_HIERARCHY_RECORD_INFO_ID'; data: string | null };
export type HierarchyAction =
  | HierarchyStateAction
  | HierarchyDataAction
  | HierarchyStatusAction
  | HierarchyCountAction
  | HierarchyControlsAction
  | HierarchySearchAction
  | HierarchyRecordInfoAction;
