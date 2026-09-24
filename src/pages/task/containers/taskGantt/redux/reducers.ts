import type { ReduxAction } from 'src/redux/types';
import config from '../config/stateConfig';

type StateConfigAction =
  | { type: 'CHANGE_TASK_STATUS'; status: number }
  | { type: 'CHANGE_VIEW'; viewType: number }
  | { type: 'CHANGE_FILTER_WEEKEND'; filter: boolean }
  | { type: 'CHANGE_SUB_TASK_LEVEL'; level: number }
  | { type: 'GANTT_DRAG_RECORD_ID'; taskId: string }
  | { type: 'GANTT_DRAG_RECORD_INDEX'; index: number };

// 成员及其任务（按账号分组）、时间轴都来自接口 / 由接口数据现算，形状未类型化
type AccountTasksAction =
  { type: 'UPDATE_DATA_SOURCE'; data: ApiPayload[] } | { type: 'ADD_MEMBERS'; accountTasksKV: ApiPayload[] };

// config状态
export const stateConfig = (state = config, action: StateConfigAction) => {
  switch (action.type) {
    case 'CHANGE_TASK_STATUS':
      state.currentStatus = action.status;
      return Object.assign({}, state);
    case 'CHANGE_VIEW':
      state.currentView = action.viewType;
      return Object.assign({}, state);
    case 'CHANGE_FILTER_WEEKEND':
      state.filterWeekend = action.filter;
      return Object.assign({}, state);
    case 'CHANGE_SUB_TASK_LEVEL':
      state.currentLevel = action.level;
      return Object.assign({}, state);
    case 'GANTT_DRAG_RECORD_ID':
      state.dragTaskId = action.taskId;
      return Object.assign({}, state);
    case 'GANTT_DRAG_RECORD_INDEX':
      state.dragHoverIndex = action.index;
      return Object.assign({}, state);
    default:
      return state;
  }
};

// 处理data数据
export const accountTasksKV = (state: ApiPayload[] = [], action: AccountTasksAction) => {
  switch (action.type) {
    case 'UPDATE_DATA_SOURCE':
      return action.data;
    case 'ADD_MEMBERS':
      return action.accountTasksKV;
    default:
      return state;
  }
};

// 时间轴数据
export const timeAxisSource = (state: ApiPayload[] = [], action: ReduxAction<{ timeAxis: ApiPayload[] }>) => {
  switch (action.type) {
    case 'GET_TIME_AXIS_SOURCE':
      return action.timeAxis;
    default:
      return state;
  }
};
