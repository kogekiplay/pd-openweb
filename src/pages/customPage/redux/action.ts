import type { AppWidget, AppWidgetButtonGroup, AppFilterComponent, AppCustomPageConfig, AppActiveContainerInfo, AppWidgetLayout } from './types';
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

/**
 * `UPDATE_PAGE_INFO` 的载荷：`reducers.ts:179` 做 `{ ...item, ...payload }`，
 * 因此是状态的**部分**更新。3 个不在 initialState 的字段也经这里注入。
 */
export interface AppPageInfoPatch {
  loading?: boolean | undefined;
  modified?: boolean | undefined;
  pageName?: string | undefined;
  visible?: boolean | undefined;
  pageId?: string | undefined;
  desc?: string | undefined;
  adjustScreen?: boolean | undefined;
  version?: string | null | undefined;
  apk?: Record<string, unknown> | undefined;
  components?: AppWidget[] | undefined;
  filtersGroup?: Record<string, unknown[]> | undefined;
  linkageFiltersGroup?: Record<string, unknown[]> | undefined;
  filterComponents?: AppFilterComponent[] | undefined;
  loadFilterComponentCount?: number | undefined;
  saveLoading?: boolean | undefined;
  activeContainerInfo?: AppActiveContainerInfo | undefined;
  urlParams?: string[] | undefined;
  config?: AppCustomPageConfig | undefined;
  /**
   * 时间戳标记。
   *
   * 【来源】`worksheet/common/WorkSheetLeft/ExternalLink.tsx:86` 调
   * `updatePageInfo({ flag: Date.now() })`，用于触发更新。原实现里 payload 是 any，
   * 这个键被 `{ ...item, ...payload }` 原样并进 state，因此如实声明为可选数字。
   */
  flag?: number | undefined;
}

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
  layoutType: string;
}

/** `INSET_TITLE` 的载荷 */
export interface AppInsertTitlePayload {
  widget: AppWidget;
  layoutType: string;
  visible: boolean;
}

/** `UPDATE_WIDGET` 的载荷：`{ widget, layoutType, ...rest }`，其中 rest 合并进组件或该端槽位 */
export interface AppUpdateWidgetPayload {
  widget: AppWidget;
  layoutType?: string | undefined;
  filter?: { advancedSetting?: Record<string, unknown> | undefined } | undefined;
  [key: string]: unknown;
}

/** `DEL_WIDGET` 的载荷 */
export interface AppDelWidgetPayload {
  type?: string | number | undefined;
  value?: string | undefined;
  uuid?: string | null | undefined;
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
export interface AppAddWidgetPayload {
  type: string | number;
  config?: Record<string, unknown> | undefined;
  tabId?: string | undefined;
  sectionId?: string | undefined;
  value?: string | undefined;
  filter?: { advancedSetting?: Record<string, unknown> | undefined; filters?: { objectControls?: unknown[] | undefined }[] | undefined } | undefined;
  [key: string]: unknown;
}

/** `COPY_WIDGET` 的载荷：`{ web, button, ...rest }` */
export interface AppCopyWidgetPayload {
  web?: { layout?: AppWidgetLayout | null | undefined } | undefined;
  button?: AppWidgetButtonGroup | undefined;
  type?: string | number | undefined;
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

/**
 * 动作构造器。运行行为与原来完全一致：仍是 `{ type, payload }`，
 * 只是给 `payload` 补上了有限类型，让每个 case 都能收窄到自己的载荷。
 */
/**
 * 动作构造器工厂。
 *
 * 【为什么写成「函数声明 + 返回函数」而不是泛型箭头 `<T>(…) => …`】
 * 泛型箭头在 `.ts`（非 `.tsx`）里会被 babel 的默认解析器当成 JSX 起始标记而报错
 * （`Unexpected token '>'`），导致本模块无法在行为规格里被正确编译加载。
 * 改成函数声明后类型能力完全等价，且可正常解析。
 */
function createAction<T>(type: string): (payload: T) => { type: string; payload: T } {
  return payload => ({ type, payload });
}

export const updatePageInfo = createAction<AppPageInfoPatch>(UPDATE_PAGE_INFO);

export const addWidget = createAction<AppAddWidgetPayload>(ADD_WIDGET);

export const delWidget = createAction<AppDelWidgetPayload>(DEL_WIDGET);
export const delTabsWidget = createAction<AppDelByContainerPayload>(DEL_TABS_WIDGET);
export const delWidgetTab = createAction<AppDelByContainerPayload>(DEL_WIDGET_TAB);

export const copyWidget = createAction<AppCopyWidgetPayload>(COPY_WIDGET);

export const updateWidgetVisible = createAction<AppWidgetVisiblePayload>(UPDATE_WIDGET_VISIBLE);

export const updateWidget = createAction<AppUpdateWidgetPayload>(UPDATE_WIDGET);

export const updateEditPageVisible = createAction<boolean>(UPDATE_EDIT_PAGE_VISIBLE);

export const updateLayout = createAction<AppUpdateLayoutPayload>(UPDATE_LAYOUT);

export const updateLoading = createAction<boolean>(UPDATE_LOADING);

export const updateSaveLoading = createAction<boolean>(UPDATE_SAVE_LOADING);

export const insertTitle = createAction<AppInsertTitlePayload>(INSET_TITLE);

export const updateModified = createAction<boolean>(UPDATE_MODIFIED);

export const updateComponents = createAction<AppWidget[]>(UPDATE_COMPONENTS);

export const updateFiltersGroup = createAction<AppFiltersGroupPayload>(UPDATE_FILTERS_GROUP);

export const updateLinkageFiltersGroup = createAction<AppFiltersGroupPayload>(UPDATE_LINKAGE_FILTERS_GROUP);

export const deleteLinkageFiltersGroup = createAction<AppDeleteLinkageGroupPayload>(DELETE_LINKAGE_FILTERS_GROUP);
