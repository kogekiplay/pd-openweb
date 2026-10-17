import { combineReducers } from 'redux';
import _ from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';
import type {
  HidedControlId,
  PublicWorksheetInfo,
  PublicWorksheetSettings,
} from './types';

/**
 * 本模块的动作类型。
 *
 * 【为什么显式声明】原先 reducer 形参是默认的 `ReduxAction`，其
 * `{ [key: string]: any }` 索引签名把 `action.url` / `action.controls` /
 * `action.worksheetInfo` … 全部变成 `any`，于是 6 个字段整体推导为 `any`。
 * 这里改成**按 case 精确描述的联合**：每个动作只带它真实派发时会带的键。
 *
 * 【生产方】全部来自 `actions.ts` 的派发点；`PUBLICWORKSHEET_LOAD_SUCCESS`
 * 的唯一生产方是 `getDispatchData()`。
 */
export type PublicWorksheetAction =
  /**
   * 【这几个键是必填而不是可选】唯一生产方是 `actions.ts` 的 `getDispatchData()`，
   * 它返回的字面量里这几个键**始终存在**。把它们标成可选会让 reducer 里
   * `return action.worksheetSettings` 这类**原表达式**产生 `undefined`，
   * 从而逼我用 `?? state` 之类"假默认值"改写行为 —— 那是提示词明确禁止的。
   * 因此这里按真实生产方约束为必填，reducer 表达式保持逐字不变。
   */
  | {
      type: 'PUBLICWORKSHEET_LOAD_SUCCESS';
      url: string;
      worksheetSettings: PublicWorksheetSettings;
      worksheetInfo: PublicWorksheetInfo;
      originalControls: FormControl[];
      controls: FormControl[];
      hidedControlIds: HidedControlId[];
      shareId?: string | undefined;
    }
  | { type: 'PUBLICWORKSHEET_UPDATE_URL'; url?: string | undefined }
  // 【必填依据】以下每个键在其**唯一派发点**都始终提供：
  // `updateWorksheetInfo` / `changeControls` / `addWorksheetControl` / `showControl` / `hideControl`。
  | { type: 'PUBLICWORKSHEET_UPDATE_SETTINGS'; value: Partial<PublicWorksheetSettings> }
  | { type: 'PUBLICWORKSHEET_UPDATE_INFO'; value: Partial<PublicWorksheetInfo> }
  | { type: 'PUBLICWORKSHEET_UPDATE_CONTROLS'; controls: FormControl[] }
  | { type: 'PUBLICWORKSHEET_ADD_CONTROL'; control: FormControl }
  | { type: 'WORKSHEET_SHOW_CONTROL'; controls: FormControl[]; controlIds: HidedControlId[] }
  | { type: 'WORKSHEET_HIDE_CONTROL'; controlId: HidedControlId }
  | { type: 'PUBLICWORKSHEET_CLEAR' };

export function loading(state = true, action: PublicWorksheetAction): boolean {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return false;
    case 'PUBLICWORKSHEET_CLEAR':
      return true;
    default:
      return state;
  }
}

export function shareUrl(state = '', action: PublicWorksheetAction): string {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      // 保留原 `|| ''` 规则：空串/undefined 都归一为空串
      return action.url || '';
    case 'PUBLICWORKSHEET_UPDATE_URL':
      return action.url || '';
    case 'PUBLICWORKSHEET_CLEAR':
      return '';
    default:
      return state;
  }
}

export function worksheetSettings(
  state: PublicWorksheetSettings = {},
  action: PublicWorksheetAction,
): PublicWorksheetSettings {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      // 【逐字保留原表达式】直接返回载荷（不写 `?? state` —— 那会改变行为）
      return action.worksheetSettings;
    case 'PUBLICWORKSHEET_UPDATE_SETTINGS':
      // 保留 `_.assign` 的浅合并与 own 键语义
      return _.assign({}, state, action.value);
    case 'PUBLICWORKSHEET_CLEAR':
      return {};
    default:
      return state;
  }
}

export function worksheetInfo(
  state: PublicWorksheetInfo = {},
  action: PublicWorksheetAction,
): PublicWorksheetInfo {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      // 【逐字保留原表达式】
      return action.worksheetInfo;
    case 'PUBLICWORKSHEET_UPDATE_INFO':
      return _.assign({}, state, action.value);
    case 'PUBLICWORKSHEET_CLEAR':
      return {};
    default:
      return state;
  }
}

export function originalControls(
  state: FormControl[] = [],
  action: PublicWorksheetAction,
): FormControl[] {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      // 【逐字保留原表达式】
      return action.originalControls;
    case 'PUBLICWORKSHEET_ADD_CONTROL':
      // 原实现 `state.concat(action.control)`：缺省时会 concat(undefined) 追加一个 undefined
      return state.concat(action.control);
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

export function controls(state: FormControl[] = [], action: PublicWorksheetAction): FormControl[] {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
    case 'PUBLICWORKSHEET_UPDATE_CONTROLS':
      // 【逐字保留原表达式】
      return action.controls;
    case 'WORKSHEET_SHOW_CONTROL':
      // 原实现 `state.concat(action.controls)`：整体追加数组
      return state.concat(action.controls);
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

export function hidedControlIds(
  state: HidedControlId[] = [],
  action: PublicWorksheetAction,
): HidedControlId[] {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      // 【逐字保留原表达式】
      return action.hidedControlIds;
    case 'WORKSHEET_HIDE_CONTROL':
      // 原实现 `_.uniqBy(state.concat(action.controlId))`：追加单个 id 后去重
      // 【等价修法】原实现 `_.uniqBy(arr)` 不带 iteratee 时按**自身**去重；
      // lodash 类型要求显式 iteratee，传恒等函数 `x => x` 语义完全相同（也无需断言）。
      return _.uniqBy(state.concat(action.controlId), (controlId: HidedControlId) => controlId);
    case 'WORKSHEET_SHOW_CONTROL':
      // 【逐字保留原表达式】原实现是 `!action.controlIds.includes(controlId)` ——
      // 语义为"从隐藏列表里**移除**本次要显示的 id"。我先前漏掉了 `!`，
      // 被本文件的 A/B 规格第一轮就抓到（B 侧得到 ['c2']、A 侧得到 []）。
      return state.filter(controlId => !action.controlIds.includes(controlId));
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

/**
 * 未知动作必须返回**原引用**（Redux 初始化 / 无关键的行为）。
 * `combineReducers` 会对每个子 reducer 传入自己的 slice，未命中 case 时走 default。
 */
/**
 * 【不传泛型参数】`redux@4` 的 `combineReducers` 签名是
 * `combineReducers<M>(reducers: M)`，直接写 `combineReducers<PublicWorksheetState>(…)`
 * 会被解释成"reducers 映射对象本身是 PublicWorksheetState"，从而报一堆
 * `(state, action) => S` 不能赋给 `S` 的错误。保持原来的调用形态，
 * 由各子 reducer 自己的签名给出类型；切片形状通过 `types.ts` 的
 * `PublicWorksheetState` 与 `RootState` 对接。
 */
export default combineReducers({
  loading,
  shareUrl,
  worksheetInfo,
  worksheetSettings,
  originalControls,
  controls,
  hidedControlIds,
});
