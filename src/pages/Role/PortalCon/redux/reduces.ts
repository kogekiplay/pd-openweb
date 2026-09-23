import { combineReducers } from 'redux';
import type { DataAction } from 'src/redux/types';
import type { FormControl } from 'src/utils/controlTypes';

/** 门户管理页的基础信息：进页面时由 getControls / 页面入口按字段合并写入 */
export interface PortalBaseInfo {
  appId?: string;
  projectId?: string;
  worksheetId?: string;
  groupId?: string;
  name?: string;
  /** 审核通过 / 拒绝时是否给用户发通知 */
  isSendMsgs?: boolean;
}

/** 各角色的成员数，来自 getExAccountCategoryCount 的 roleMemberStatistics */
export interface PortalRoleCount {
  roleId: string;
  count: number;
}

/** 快捷标签：只用来切当前角色 */
export interface PortalQuickTag {
  tab?: string;
  roleId?: string;
}

export const loading = (state = false, action: DataAction<boolean>) => {
  switch (action.type) {
    case 'UPDATE_LOADING':
      return action.data;
    default:
      return state;
  }
};

//配置的controls
export const controls = (state: FormControl[] = [], action: DataAction<FormControl[]>) => {
  switch (action.type) {
    case 'UPDATE_CONTROLS':
      return action.data;
    default:
      return state;
  }
};

export const sortControls = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_SORTCONTROLS':
      return action.data;
    default:
      return state;
  }
};

//批量搜索手机号
export const telFilters = (state = ``, action: DataAction<string>) => {
  switch (action.type) {
    case 'UPDATE_TELFILTERS':
      return action.data;
    default:
      return state;
  }
};

// 初始值原先写的是 []，但它全程被当对象用（setBaseInfo 展开合并、各处解构读字段），
// 没有任何按数组用的地方：{...[]} 与 {...{}} 都是 {}，解构、真值、_.isEmpty 结果也都一样。
export const baseInfo = (state: PortalBaseInfo = {}, action: DataAction<PortalBaseInfo>) => {
  switch (action.type) {
    case 'UPDATE_BASE':
      return action.data;
    default:
      return state;
  }
};

//设置 排序，显示字段等
// 目前没人写也没人读（setControlsSetting 没有调用方），载荷形状无从考证，按接口原样值记
export const controlsSetting = (state: ApiPayload = [], action: DataAction<ApiPayload>) => {
  switch (action.type) {
    case 'UPDATE_CONTROLS_SETTING':
      return action.data;
    default:
      return state;
  }
};

//成员列表数据
export const list = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_LIST':
      return action.data;
    default:
      return state;
  }
};

// 【初始值是 [] 不是 0，照实写进类型，没改】首屏数据回来之前它会被当 commonCount 传给 User 渲染，
// 改成 0 会让那一帧多显示一个「0」。`count > 0` 这类比较对两者结果相同。
export const count = (state: number | [] = [], action: DataAction<number>) => {
  switch (action.type) {
    case 'UPDATE_LIST_COUNT':
      return action.data;
    default:
      return state;
  }
};

//（待审核）用户数
export const unApproveCount = (state = 0, action: DataAction<number>) => {
  switch (action.type) {
    case 'UPDATE_UNAPPROVECOUNT':
      return action.data;
    default:
      return state;
  }
};

//角色对应用户计数
export const roleCountList = (state: PortalRoleCount[] = [], action: DataAction<PortalRoleCount[]>) => {
  switch (action.type) {
    case 'UPDATE_PORTAL_USER_COUNT':
      return action.data;
    default:
      return state;
  }
};

//（未激活、正常、停用）用户数
export const commonCount = (state = 0, action: DataAction<number>) => {
  switch (action.type) {
    case 'UPDATE_COMMONCOUNT':
      return action.data;
    default:
      return state;
  }
};

//隐藏的控件id
export const showPortalControlIds = (state = ['openId'], action: DataAction<string[]>) => {
  switch (action.type) {
    case 'UPDATE_HIDEIDS':
      return action.data;
    default:
      return state;
  }
};

// sortIds 排序
// 死代码：没挂进下面的 combineReducers，也没人派发 UPDATE_SORTIDS
export const sortIds = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_SORTIDS':
      return action.data;
    default:
      return state;
  }
};

//角色数据
export const roleList = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_ROLELIST':
      return action.data;
    default:
      return state;
  }
};

//角色数据
export const defaultRole = (state = '1', action: DataAction<string>) => {
  switch (action.type) {
    case 'UPDATE_DEFAULTROLE':
      return action.data;
    default:
      return state;
  }
};

export const pageIndex = (state = 1, action: DataAction<number>) => {
  switch (action.type) {
    case 'UPDATE_INDEX':
      return action.data;
    default:
      return state;
  }
};

export const filters = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_FILTERS':
      return action.data;
    default:
      return state;
  }
};

export const fastFilters = (state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) => {
  switch (action.type) {
    case 'UPDATE_FASTFILTERS':
      return action.data;
    default:
      return state;
  }
};

export const keyWords = (state = '', action: DataAction<string>) => {
  switch (action.type) {
    case 'UPDATE_KEYWORDS':
      return action.data;
    default:
      return state;
  }
};

export const quickTag = (
  state: PortalQuickTag = { tab: '', roleId: '' },
  action: DataAction<PortalQuickTag | undefined>,
) => {
  switch (action.type) {
    case 'UPDATE_QUICKTAG':
      return action.data || { tab: '', roleId: '' };
    default:
      return state;
  }
};

export const roleId = (state = '', action: DataAction<string | undefined>) => {
  switch (action.type) {
    case 'UPDATE_DEFAULT_ROLEID':
      return action.data || '';
    default:
      return state;
  }
};

export default combineReducers({
  roleId,
  controls,
  roleList,
  list,
  pageIndex,
  showPortalControlIds,
  defaultRole,
  controlsSetting,
  count,
  baseInfo,
  filters,
  keyWords,
  fastFilters,
  loading,
  commonCount,
  unApproveCount,
  sortControls,
  telFilters,
  quickTag,
  roleCountList,
});
