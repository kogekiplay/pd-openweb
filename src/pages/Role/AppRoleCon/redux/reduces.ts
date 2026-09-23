import { combineReducers } from 'redux';
import type { DataAction } from 'src/redux/types';
import { initData } from '../UserCon/config';

/** 快捷标签：只用来切当前角色 */
export interface AppRoleQuickTag {
  tab?: string;
  roleId?: string;
}

/** 成员列表的分页 / 搜索参数，形状见 UserCon/config 的 initData */
export type AppRolePagingModel = typeof initData;

export const loading = (state = false, action: DataAction<boolean>) => {
  switch (action.type) {
    case 'UPDATE_ROLE_LOADING':
      return action.data;
    default:
      return state;
  }
};

export const pageLoading = (state = false, action: DataAction<boolean>) => {
  switch (action.type) {
    case 'ROLE_UPDATE_PAGE_LOADING':
      return action.data;
    default:
      return state;
  }
};

export const quickTag = (
  state: AppRoleQuickTag = { tab: '', roleId: '' },
  action: DataAction<AppRoleQuickTag | undefined>,
) => {
  switch (action.type) {
    case 'UPDATE_QUICKTAG':
      return action.data || { tab: '', roleId: '' };
    default:
      return state;
  }
};

export const roleId = (state = 'all', action: DataAction<string>) => {
  switch (action.type) {
    case 'UPDATE_ROLEID':
      return action.data;
    default:
      return state;
  }
};

//成员数据
export const user = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_APPUSER':
      return action.data;
    default:
      return state;
  }
};

//成员全部总数
export const total = (state = 0, action: DataAction<number>) => {
  switch (action.type) {
    case 'UPDATE_APPUSER_LIST_ALL_TOTAL':
      return action.data;
    default:
      return state;
  }
};

//成员数组数据
export const userList = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_APPUSER_LIST':
      return action.data;
    default:
      return state;
  }
};

//申请数据
export const apply = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_APPLYINFO':
      return action.data;
    default:
      return state;
  }
};

//外协数据
export const outsourcing = (state: ApiPayload = {}, action: DataAction<ApiPayload>) => {
  switch (action.type) {
    case 'UPDATE_OUTSOURCING':
      return action.data;
    default:
      return state;
  }
};

//角色数据
export const roleInfos = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_APPROLESUMMARY':
      return action.data;
    default:
      return state;
  }
};

//安装应用相关限制数据
export const roleLimitInfo = (state: ApiPayload = [], action: DataAction<ApiPayload>) => {
  switch (action.type) {
    case 'UPDATE_APPROLESUMMARY_ROLELIMITINFO':
      return action.data;
    default:
      return state;
  }
};

export const selectedIds = (state: string[] = [], action: DataAction<string[]>) => {
  switch (action.type) {
    case 'UPDATE_SELECTLIST':
      return action.data;
    default:
      return state;
  }
};

export const appRolePagingModel = (
  state: AppRolePagingModel = initData,
  action: DataAction<AppRolePagingModel | undefined>,
) => {
  switch (action.type) {
    case 'UPDATE_APPROLEPAGINGMODEL':
      return action.data || initData;
    default:
      return state;
  }
};

export default combineReducers({
  loading,
  user,
  outsourcing,
  apply,
  appRolePagingModel,
  roleInfos,
  roleLimitInfo,
  roleId,
  selectedIds,
  userList,
  total,
  pageLoading,
  quickTag,
});
