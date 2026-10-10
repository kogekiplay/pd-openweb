export type GanttTime = string | null | undefined;
export type GanttAxisValue = string | string[];
export type GanttAxisBoundary = GanttAxisValue | undefined;
export interface GanttTask {
  taskId: string;
  status: number;
  ancestorIds: string[];
  subTaskIds: string[];
  parentId?: string | null | undefined;
  startTime?: GanttTime;
  deadline?: GanttTime;
  completeTime?: GanttTime;
  isShow?: boolean | undefined;
  singleTime?: number | '' | undefined;
  arrowStatus?: number | undefined;
  showStartTime?: GanttTime;
  showEndTime?: GanttTime;
  showHourLong?: number | undefined;
  [metadata: string]: unknown;
}
export interface GanttTaskGroup {
  tasks: GanttTask[];
  taskTimeBars?: GanttTask[][] | undefined;
  [metadata: string]: unknown;
}
export interface GanttAxisGroup {
  month?: string | undefined;
  year?: string | undefined;
  dateList: GanttAxisValue[];
}
export interface GanttDayAxis {
  month: string;
  dateList: string[];
}
export interface GanttWeekAxis {
  month: string;
  dateList: string[][];
}
export interface GanttMonthAxis {
  year: string;
  dateList: string[];
}
export type WorkingTime = [start: string, end: string];
export interface GanttConfig {
  isReady: boolean;
  isRequestComplete: boolean;
  projectId: string;
  folderId: string;
  timeStamp: string;
  minStartTime: string;
  maxEndTime: string;
  TASKSTATUS: { NO_COMPLETED: number; COMPLETED: number; ALL: number };
  workingTimes: [WorkingTime, ...WorkingTime[]];
  workingSumHours: number;
  VIEWTYPE: { DAY: 1; WEEK: 2; MONTH: 3 };
  GRANULARITY: { DAY: number; WEEK: number; MONTH: number };
  filterWeekendDay: number[];
  SUBTASKLEVEL: { ALL: number; ONE: number; TWO: number; THREE: number; FOUR: number; FIVE: number };
  SINGLE_TIME: { START: number; END: number };
  ARROW_STATUS: { NULL: number; OPEN: number; CLOSED: number };
  TASK_NAME_SIZE: number;
  TASK_MESSAGE_SIZE: number;
  DRAG_GANTT: string;
  mouseOffset: { left: number; top: number };
  offset: { x: number; y: number };
  diffHours: number;
  originalStartTime: GanttTime;
  originalEndTime: GanttTime;
  oldStartTime: GanttTime;
  oldEndTime: GanttTime;
  newStartTime: GanttTime | string[];
  newEndTime: GanttTime | string[];
  offsetX: number;
  scrollLeft: number | undefined;
  setInterval: '' | ReturnType<typeof setInterval>;
  singleDragTaskId: string;
  recordSingleTime: number | '' | undefined;
  isHiddenLastTips: boolean;
  DRAG_DIRECTION: { LEFT: number; RIGHT: number };
  dragItem: '' | GanttTask;
  DARG_INDEX: number;
  isEndDrag: boolean;
  isSingleDrag: boolean;
  scrollSelector: '' | JQuery;
}
