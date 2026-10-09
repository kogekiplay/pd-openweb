import type { FieldStoreRecord } from '../../../../utils/subListStoreTypes';

export interface TreeNode {
  index?: number | undefined;
  rowid?: string | undefined;
  childrenIds?: Array<string | undefined> | undefined;
  key?: string | undefined;
  levelList?: number[] | undefined;
  loaded?: boolean | undefined;
  folded?: boolean | undefined;
  parentKeys?: string[] | undefined;
  hideExpand?: boolean | undefined;
  loading?: boolean | undefined;
}
export type TreeMap = Record<string, TreeNode | undefined>;
export interface TreeViewState {
  maxLevel: number;
  treeMap: TreeMap;
  sortedIds: string[];
  expandedAllKeys: Record<string, boolean>;
  levelCount?: number | undefined;
}

export type TreeViewAction =
  | { type: 'UPDATE_TREE_TABLE_VIEW_DATA' | 'UPDATE_TREE_TABLE_VIEW_ITEM'; value: Partial<TreeViewState> }
  | {
      type: 'UPDATED_TREE_NODE_EXPANSION';
      key: string;
      folded?: boolean | undefined;
      childrenIds?: Array<string | undefined> | undefined;
      loaded?: boolean | undefined;
      loading?: boolean | undefined;
    }
  | { type: 'UPDATE_TREE_TABLE_VIEW_EXPANDED'; key: string }
  | { type: 'UPDATE_TREE_TABLE_VIEW_TREE_MAP'; value: TreeMap }
  | { type: 'RESET' | 'RESET_TREE' | 'WORKSHEET_INIT' | 'WORKSHEET_SHEETVIEW_CLEAR' };

export type TreeExpansionAction =
  TreeViewAction | { type: 'WORKSHEET_SHEETVIEW_APPEND_ROWS'; rows: FieldStoreRecord[] };
