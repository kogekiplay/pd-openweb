import {
  CHANGE_APP_COLOR,
  CHANGE_NAV_COLOR,
  CLEAR_APP_DETAIL,
  SET_APP_STATUS,
  SYNC_APP_DETAIL,
  UPDATE_APP_GROUP,
} from './action';
import type { AppPkgAction } from './action';
import type { AppPkgState } from './types';

const defaultState: AppPkgState = {
  iconColor: '#1677ff',
  projectId: '',
  appGroups: [],
  appStatus: 0,
  name: _l('应用'),
};

/**
 * 应用详情 reducer。
 *
 * 【本轮只补类型，不改运行行为】赋值顺序、`{ ...state, ...detail }` 的浅合并语义、
 * `CLEAR_APP_DETAIL` 回到 `{ ...defaultState }`（注意：**不是** `defaultState` 本身，
 * 清空后是浅拷贝，避免后续合入污染默认值）全部保持原样。
 *
 * 复合性说明：`action` 收窄成 `AppPkgAction` 之后，`switch` 的每个分支都能拿到
 * 该动作的真实载荷类型，不再从 `ReduxAction` 的默认索引签名里取 `any`。
 */
export default function appDetailState(state: AppPkgState = defaultState, action: AppPkgAction): AppPkgState {
  switch (action.type) {
    case SYNC_APP_DETAIL:
      return { ...state, ...action.detail };
    case CHANGE_APP_COLOR:
      return { ...state, iconColor: action.iconColor };
    case CHANGE_NAV_COLOR:
      return { ...state, navColor: action.navColor };
    case UPDATE_APP_GROUP:
      // 原实现在解构处写 `appGroups = []`：载荷缺失时回落成空数组。
      // 默认值只处理undefined，不能把原来保留的null替换掉。
      return { ...state, appGroups: action.appGroups === undefined ? [] : action.appGroups };
    case SET_APP_STATUS:
      // 同上，原实现是 `status = 0`
      return { ...state, appStatus: action.status === undefined ? 0 : action.status };
    case CLEAR_APP_DETAIL:
      // 保留原实现的浅拷贝语义（不是直接返回 defaultState 引用）
      return { ...defaultState };
    default:
      // 【为什么 default 不能只写 return state】
      // redux 初始化会派发 `@@redux/INIT` 这类非本 reducer 的 action，所以 default
      // 分支必须存在、且必须原样返回 state（运行行为不变）。
      // 但纯 `return state` 会让「给 AppPkgAction 加了新变体却忘了处理」编译通过 ——
      // 实证过：注入一个 HYPOTHETICAL_NEW_ACTION 变体后，tsc 不报任何错。
      // never参数检查遗漏的变体；运行时为空函数调用，未知action仍返回原引用。
      assertNever(action);
      return state;
  }
}

/** 所有变体都被处理时参数才是never；运行时不抛错，以兼容Redux初始化action。 */
function assertNever(_action: never): void {
  void _action;
  return undefined;
}
