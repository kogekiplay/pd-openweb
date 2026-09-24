import type { DataAction } from 'src/redux/types';

// 讨论 / 日志 / 附件都来自接口，形状未类型化，按接口原样值记
type SheetDiscussionAction =
  | { type: 'MOBILE_SET_SHEET_DISCUSSION' | 'MOBILE_ADD_SHEET_DISCUSSION'; data: ApiPayload[] }
  | { type: 'MOBILE_UNSHIFT_SHEET_DISCUSSION'; data: ApiPayload };

export const sheetDiscussions = (state: ApiPayload[] = [], action: SheetDiscussionAction) => {
  switch (action.type) {
    case 'MOBILE_SET_SHEET_DISCUSSION':
      return action.data;
    case 'MOBILE_ADD_SHEET_DISCUSSION':
      return Object.assign([], state.concat(action.data));
    case 'MOBILE_UNSHIFT_SHEET_DISCUSSION':
      return [action.data].concat(state);
    default:
      return state;
  }
};

export const sheetLogs = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'MOBILE_SET_SHEET_LOG':
      return action.data;
    case 'MOBILE_ADD_SHEET_LOG':
      return Object.assign([], state.concat(action.data));
    default:
      return state;
  }
};

export const sheetAttachments = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'MOBILE_SET_SHEET_ATTACHMENTS':
      return action.data;
    default:
      return state;
  }
};
