import type { AppDetail } from './types';
import type { AppSection } from 'src/utils/appTypes';

export const CHANGE_NAV_COLOR = 'CHANGE_NAV_COLOR';
export const CHANGE_APP_COLOR = 'CHANGE_APP_COLOR';
export const UPDATE_APP_GROUP = 'UPDATE_APP_GROUP';
export const SET_APP_STATUS = 'SET_APP_STATUS';
export const SYNC_APP_DETAIL = 'SYNC_APP_DETAIL';
export const CLEAR_APP_DETAIL = 'CLEAR_APP_DETAIL';

/**
 * 本 reducer 消费的动作协议。
 *
 * 【为什么 `detail` 是 `Partial<AppDetail>`】`SYNC_APP_DETAIL` 的语义是
 * 「把这份状态里已经拿到的应用字段并进去」，调用方传的一直是子集
 * （例如只传 `{ currentPcNaviStyle, iconColor }`）。写成完整 `AppDetail` 会与运行时不符。
 */
export type AppPkgAction =
  | { type: typeof SYNC_APP_DETAIL; detail: Partial<AppDetail> }
  | { type: typeof CHANGE_APP_COLOR; iconColor: string }
  | { type: typeof CHANGE_NAV_COLOR; navColor: string }
  | { type: typeof UPDATE_APP_GROUP; appGroups: AppSection[] }
  | { type: typeof SET_APP_STATUS; status: number }
  | { type: typeof CLEAR_APP_DETAIL };

export const syncAppDetail = (detail: Partial<AppDetail>): AppPkgAction => ({
  type: SYNC_APP_DETAIL,
  detail,
});

export const changeAppColor = (iconColor: string): AppPkgAction => ({
  type: CHANGE_APP_COLOR,
  iconColor,
});

export const changeNavColor = (navColor: string): AppPkgAction => ({
  type: CHANGE_NAV_COLOR,
  navColor,
});

export const updateAppGroup = (appGroups: AppSection[]): AppPkgAction => ({
  type: UPDATE_APP_GROUP,
  appGroups,
});

export const setAppStatus = (status: number): AppPkgAction => ({
  type: SET_APP_STATUS,
  status,
});

export const clearAppDetail = (): AppPkgAction => ({
  type: CLEAR_APP_DETAIL,
});
