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
export default function appDetailState(
  state: AppPkgState = defaultState,
  action: AppPkgAction,
): AppPkgState {
  switch (action.type) {
    case SYNC_APP_DETAIL:
      // 与原实现等价的浅合并。用 Object.assign 而不是对象展开，是为了让类型如实表达
      // 「部分详情覆盖到完整状态上」：交集 `AppPkgState & Partial<AppDetail>` 能保住
      // 默认字段的必选性；而 `{ ...state, ...detail }` 会把每个被展开的可选字段
      // 推成 `T | undefined`，那会与 `AppPkgState` 冲突。
      // 两者对普通对象都是浅拷贝，运行行为相同。
      return Object.assign({}, state, action.detail);
    case CHANGE_APP_COLOR:
      return { ...state, iconColor: action.iconColor };
    case CHANGE_NAV_COLOR:
      return { ...state, navColor: action.navColor };
    case UPDATE_APP_GROUP:
      // 原实现在解构处写 `appGroups = []`：载荷缺失时回落成空数组。
      // 类型上该载荷是必填的，但运行时的回落行为要原样保留，所以这里显式 `?? []`。
      return { ...state, appGroups: action.appGroups ?? [] };
    case SET_APP_STATUS:
      // 同上，原实现是 `status = 0`
      return { ...state, appStatus: action.status ?? 0 };
    case CLEAR_APP_DETAIL:
      // 保留原实现的浅拷贝语义（不是直接返回 defaultState 引用）
      return { ...defaultState };
    default:
      return state;
  }
}
