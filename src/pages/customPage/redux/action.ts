import {
  ADD_WIDGET,
  COPY_WIDGET,
  DEL_TABS_WIDGET,
  DEL_WIDGET,
  DEL_WIDGET_TAB,
  DELETE_LINKAGE_FILTERS_GROUP,
  INSET_TITLE,
  UPDATE_COMPONENTS,
  UPDATE_EDIT_PAGE_VISIBLE,
  UPDATE_FILTERS_GROUP,
  UPDATE_LAYOUT,
  UPDATE_LINKAGE_FILTERS_GROUP,
  UPDATE_LOADING,
  UPDATE_MODIFIED,
  UPDATE_PAGE_INFO,
  UPDATE_SAVE_LOADING,
  UPDATE_WIDGET,
  UPDATE_WIDGET_VISIBLE,
} from './actionType';
import type { AppCustomPageState, AppLayoutType, AppWidget, AppWidgetLayout, AppWidgetSlot } from './types';

/**
 * `UPDATE_PAGE_INFO` 的载荷：`reducers.ts:179` 做 `{ ...item, ...payload }`，
 * 因此是状态的**部分**更新。3 个不在 initialState 的字段也经这里注入。
 */
export type AppPageInfoPatch = Partial<AppCustomPageState>;

/** `UPDATE_LAYOUT` 的载荷（reducers.ts:45-77 读取 layoutType/layouts/components/adjustScreen） */
export interface AppUpdateLayoutPayload {
  layoutType: string;
  /** 部分更新时可能缺省 —— reducer 里 `if (!layouts) return state` */
  layouts?: AppWidgetLayout[] | undefined;
  /** 当前显示的组件列表，用于按 id/uuid 对齐 layouts */
  components?: AppWidget[] | undefined;
  adjustScreen?: boolean | undefined;
}

/** `UPDATE_WIDGET_VISIBLE` 的载荷 */
export interface AppWidgetVisiblePayload {
  widget: AppWidget;
  layoutType: AppLayoutType;
}

/** `INSET_TITLE` 的载荷 */
export interface AppInsertTitlePayload {
  widget: AppWidget;
  layoutType: AppLayoutType;
  visible: boolean;
}

/** `UPDATE_WIDGET` 的载荷：`{ widget, layoutType, ...rest }`，其中 rest 合并进组件或该端槽位 */
export interface AppUpdateWidgetPayload extends AppWidget, AppWidgetSlot {
  widget: AppWidget;
  layoutType?: AppLayoutType | '' | undefined;
  [key: string]: unknown;
}

/** `DEL_WIDGET` 的载荷 */
export interface AppDelWidgetPayload extends Pick<AppWidget, 'id' | 'type' | 'value' | 'uuid'> {
  [key: string]: unknown;
}

/** `DEL_TABS_WIDGET` / `DEL_WIDGET_TAB` 的载荷 */
export interface AppDelByContainerPayload {
  tabId?: string | undefined;
  config?: { objectId?: string | undefined } | undefined;
  [key: string]: unknown;
}

/** `UPDATE_FILTERS_GROUP` / `UPDATE_LINKAGE_FILTERS_GROUP` 的载荷 */
export interface AppFiltersGroupPayload {
  value: string;
  filters: unknown[];
}

/** `DELETE_LINKAGE_FILTERS_GROUP` 的载荷 */
export interface AppDeleteLinkageGroupPayload {
  value: string;
}

/** `ADD_WIDGET` 的载荷：`{ ...payload }` 整体展开进新组件 */
export interface AppAddWidgetPayload extends AppWidget {
  type: string | number;
  [key: string]: unknown;
}

/** `COPY_WIDGET` 的载荷：`{ web, button, ...rest }` */
export interface AppCopyWidgetPayload extends AppWidget {
  [key: string]: unknown;
}

/**
 * 本 reducer 消费的动作协议。
 *
 * 【为什么用「type 常量 + payload」而不是逐字面量联合】
 * 动作类型全部由 `actionType.ts` 的常量给出，而其中两个常量值**尾部带空格**
 * （`'UPDATE_EDIT_PAGE_VISIBLE '` / `'UPDATE_MODIFIED '`）—— 这是既有事实，
 * 类型化时照抄常量（用 `typeof`）即可，不在这里"顺手修正"常量值。
 */
export type AppCustomPageAction =
  | { type: typeof UPDATE_PAGE_INFO; payload: AppPageInfoPatch }
  | { type: typeof UPDATE_LOADING; payload: boolean }
  | { type: typeof UPDATE_SAVE_LOADING; payload: boolean }
  | { type: typeof UPDATE_EDIT_PAGE_VISIBLE; payload: boolean }
  | { type: typeof UPDATE_MODIFIED; payload: boolean }
  | { type: typeof ADD_WIDGET; payload: AppAddWidgetPayload }
  | { type: typeof COPY_WIDGET; payload: AppCopyWidgetPayload }
  | { type: typeof UPDATE_WIDGET_VISIBLE; payload: AppWidgetVisiblePayload }
  | { type: typeof DEL_WIDGET; payload: AppDelWidgetPayload }
  | { type: typeof DEL_TABS_WIDGET; payload: AppDelByContainerPayload }
  | { type: typeof DEL_WIDGET_TAB; payload: AppDelByContainerPayload }
  | { type: typeof UPDATE_WIDGET; payload: AppUpdateWidgetPayload }
  | { type: typeof UPDATE_LAYOUT; payload: AppUpdateLayoutPayload }
  | { type: typeof UPDATE_COMPONENTS; payload: AppWidget[] }
  | { type: typeof INSET_TITLE; payload: AppInsertTitlePayload }
  | { type: typeof UPDATE_FILTERS_GROUP; payload: AppFiltersGroupPayload }
  | { type: typeof UPDATE_LINKAGE_FILTERS_GROUP; payload: AppFiltersGroupPayload }
  | { type: typeof DELETE_LINKAGE_FILTERS_GROUP; payload: AppDeleteLinkageGroupPayload };

/** Keep the literal type and derive its payload from the handled action union. */
function createAction<T extends AppCustomPageAction['type']>(type: T) {
  return (payload: Extract<AppCustomPageAction, { type: T }>['payload']) => ({ type, payload });
}

export const updatePageInfo = createAction(UPDATE_PAGE_INFO);

export const addWidget = createAction(ADD_WIDGET);

export const delWidget = createAction(DEL_WIDGET);
export const delTabsWidget = createAction(DEL_TABS_WIDGET);
export const delWidgetTab = createAction(DEL_WIDGET_TAB);

export const copyWidget = createAction(COPY_WIDGET);

export const updateWidgetVisible = createAction(UPDATE_WIDGET_VISIBLE);

export const updateWidget = createAction(UPDATE_WIDGET);

export const updateEditPageVisible = createAction(UPDATE_EDIT_PAGE_VISIBLE);

export const updateLayout = createAction(UPDATE_LAYOUT);

export const updateLoading = createAction(UPDATE_LOADING);

export const updateSaveLoading = createAction(UPDATE_SAVE_LOADING);

export const insertTitle = createAction(INSET_TITLE);

export const updateModified = createAction(UPDATE_MODIFIED);

export const updateComponents = createAction(UPDATE_COMPONENTS);

export const updateFiltersGroup = createAction(UPDATE_FILTERS_GROUP);

export const updateLinkageFiltersGroup = createAction(UPDATE_LINKAGE_FILTERS_GROUP);

export const deleteLinkageFiltersGroup = createAction(DELETE_LINKAGE_FILTERS_GROUP);
