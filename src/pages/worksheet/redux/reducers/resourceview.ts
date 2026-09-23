import type { DataAction } from 'src/redux/types';
import type { FormControl } from 'src/utils/controlTypes';

export function loading(state = true, action: DataAction<boolean>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_LOADING':
      return action.data;
    default:
      return state;
  }
}

export function keywords(state = '', action: DataAction<string>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_KEYWORDS':
      return action.data;
    default:
      return state;
  }
}

export function resourceRelationControls(state: FormControl[] = [], action: DataAction<FormControl[]>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_RESOURCE_RELATION_CONTROLS':
      return action.data;
    default:
      return state;
  }
}

export function resourceData(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_RESOURCE_DATA':
      return action.data;
    default:
      return state;
  }
}

export function resourceDataByKey(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_RESOURCE_DATA_BY_KEY':
      return action.data;
    default:
      return state;
  }
}

// 初始值是 []，但写进来的是 { list: [...] } 这样的对象（见 actions/resourceview 的 CHANGE_RESOURCE_TIME_LIST）
export function timeList(state: ApiPayload = [], action: DataAction<ApiPayload>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_TIME_LIST':
      return action.data;
    default:
      return state;
  }
}

export function gridTimes(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_TIME_LIST_A':
      return action.data;
    default:
      return state;
  }
}

/** 'YYYY-MM-DD'；null 表示「今天」 */
export function currentTime(state: string | null = null, action: DataAction<string | null>) {
  switch (action.type) {
    case 'CHANGE_RESOURCE_CURRENT_TIME':
      return action.data;
    default:
      return state;
  }
}
