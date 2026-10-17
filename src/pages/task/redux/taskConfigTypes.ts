/** Task navigation/filter state. folderId=1 is the existing all-projects sentinel. */
export interface TaskConfig {
  viewType: number;
  projectId: string;
  lastMyProjectId: string;
  attachmentViewType: number;
  folderId: string | 1;
  filterUserId: string;
  /** Folder search uses '' to clear the task-ascription filter. */
  taskFilter: number | '';
  listStatus: number;
  listSort: number;
  completeTime: string;
  keyWords: string;
  searchKeyWords: string;
  isSubUser: boolean;
  filterSettings: TaskFilterSettings;
}

export interface TaskFilterSettings {
  tags: string[];
  customFilter: Record<string, string[]>;
  selectChargeIds: string[];
  folderSearchRange: number;
}

export type TaskConfigAction =
  | { type: 'UPDATE_STATE_CONFIG'; taskConfig: Partial<TaskConfig> }
  | { type: 'ATTACHMENT_SWITCH'; attachmentViewType: number }
  | { type: 'UPDATE_PROJECT_ID'; projectId: string }
  | { type: 'UPDATE_NETWORK'; lastMyProjectId: string }
  | { type: 'UPDATE_TASK_STATUS'; listStatus: number }
  | { type: 'UPDATE_FOLDER_RANGE'; folderSearchRange: number }
  | { type: 'UPDATE_FOLDER_KEYWORDS'; searchKeyWords: string }
  | { type: 'UPDATE_COMPLETE_TIME'; completeTime: string }
  | { type: 'UPDATE_LIST_SORT'; listSort: number }
  | { type: 'UPDATE_TASK_ASCRIPTION'; taskFilter: number }
  | { type: 'UPDATE_TASK_TAGS'; tags: TaskFilterSettings['tags'] }
  | { type: 'UPDATE_CUSTOM_FILTER'; customFilter: TaskFilterSettings['customFilter'] }
  | { type: 'UPDATE_CHARGE_IDS'; selectChargeIds: TaskFilterSettings['selectChargeIds'] };
