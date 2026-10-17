import type { AppDetail } from 'src/pages/PageHeader/redux/types';
import type { CustomPageConfig } from '../configTypes';

/**
 * 自定义页面（`customPage`）redux 切片的有限类型。
 *
 * 【形状来源，全部是真实读取/写入点，不是照抄接口文档】
 * - `initialState` 给出 14 个字段的默认值（含 `version: null`、`apk: {}` 这类空壳）
 * - 另有 3 个字段（`activeContainerInfo` / `urlParams` / `config`）虽然不在 initialState，
 *   但**确实由 `updatePageInfo(payload)` 的 payload 注入**，并且被 connect 消费方真实读取
 *   （`activeContainerInfo.sectionId/tabId`、`urlParams.map(...)`、`config`），因此必须建模
 * - `components` 元素的字段来自 `reducers.ts` 的读写、`../util.ts` 的 `getDefaultLayout`
 *   返回值形状，以及消费方对 `web/mobile/button/config/layout` 的读取
 *
 * 【为什么 widget 允许索引签名】自定义页面的 widget 是**插件式**的：不同 `type` 携带
 * 各自私有的数据（如 `filter` 带 `filter`、`button` 带 `buttonList`、`tabs` 带 `config.objectId`），
 * 且 reducer 里有 `...payload` / `...rest` 的整体展开。这类"开放扩展元数据"用
 * `[key: string]: unknown` 承载是诚实的 —— 但**已知业务字段仍逐个显式声明**，
 * 不用索引签名替代它们（否则就是放弃类型）。
 */

/** 一个 widget 在某一端（web / mobile）的布局槽位 */
export interface AppWidgetLayout {
  x?: number | undefined;
  /** `Infinity` 是真实取值：`getDefaultLayout` 用它表示"排到最后一行" */
  y?: number | undefined;
  w?: number | undefined;
  h?: number | undefined;
  minW?: number | undefined;
  minH?: number | undefined;
  maxH?: number | undefined;
}

/** widget 在某一端的显示状态 + 布局 */
export interface AppWidgetSlot {
  title?: string | undefined;
  titleVisible?: boolean | undefined;
  visible?: boolean | undefined;
  layout?: AppWidgetLayout | null | undefined;
}

/** 按钮组件里的单个按钮（`COPY_WIDGET` 会重置 id/filterId 并改写 config.isFilter） */
export interface AppWidgetButton {
  id?: string | null | undefined;
  btnId?: string | null | undefined;
  filterId?: string | null | undefined;
  config?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

/** `button` widget 的载荷 */
export interface AppWidgetButtonGroup {
  buttonList?: AppWidgetButton[] | undefined;
  [key: string]: unknown;
}

/**
 * 自定义页面上的一个 widget。
 *
 * `type` 同时存在字符串（`'filter'`）与数字（`enumWidgetType.filter === 6`）两种比较，
 * 两种写法在 reducer 与消费方里都真实存在，所以类型如实写成联合。
 */
export interface AppWidget {
  /** The legacy mobile default-layout helper reads these top-level coordinates. */
  y?: number | undefined;
  h?: number | undefined;
  id?: string | undefined;
  uuid?: string | null | undefined;
  type?: string | number | undefined;
  value?: string | undefined;
  tabId?: string | undefined;
  sectionId?: string | undefined;
  config?: Record<string, unknown> | undefined;
  web?: AppWidgetSlot | undefined;
  mobile?: AppWidgetSlot | null | undefined;
  button?: AppWidgetButtonGroup | undefined;
  /** `ADD_WIDGET` 的入参里可能带 `filter`（仅 type==='filter' 时使用） */
  filter?: AppWidgetFilterPayload | undefined;
  /**
   * 【不再使用索引签名】原先这里写 `[key: string]: unknown` 承载"随 type 变化的
   * 扩展元数据"，但它会让 `immutability-helper` 的 `Spec<AppWidget>` 推断失效
   * （索引签名把每层都推成 unknown，`{ web: { layout: … } }` 无法匹配）。
   * 已知业务字段上面已逐个声明；未被声明字段的读取需要显式加到这里，
   * 这比索引签名更严格，也符合 lead「不能把所有业务字段丢进索引签名」的要求。
   */
}

/** `ADD_WIDGET` 里 filter widget 的入参形状（reducers.ts:243-257 读取） */
export interface AppWidgetFilterPayload {
  advancedSetting?: Record<string, unknown> | undefined;
  filters?: { objectControls?: unknown[] | undefined }[] | undefined;
  [key: string]: unknown;
}

/** `filterComponents` 的元素（reducers.ts 的 ADD/DEL/UPDATE 分支读写入 shape） */
export interface AppFilterComponent {
  value?: string | undefined;
  advancedSetting?: Record<string, unknown> | undefined;
  filters?: unknown[] | undefined;
  /**
   * 移动端是否可见。
   *
   * 【来源】`WidgetContent/ViewDisplay.tsx:97-99` 在 `ownProps.layoutType === 'mobile'`
   * 时按 `n.mobileVisible` 过滤 `filterComponents`（`ChartDisplay.tsx:127` 同款写法）。
   * 该字段不是本 reducer 写入的（由其它流程挂在元素上），但消费方确实读它，故如实声明为可选。
   */
  mobileVisible?: boolean | undefined;
}

/** Known application identity and appearance fields, including the shared-header icon URL. */
export interface AppCustomPageApk extends Pick<AppDetail, 'iconColor' | 'iconUrl' | 'projectId'> {
  appId?: string | undefined;
  appName?: string | undefined;
}

/** 页头里"当前激活容器"的定位信息：消费方读 sectionId / tabId */
export interface AppActiveContainerInfo {
  sectionId?: string | undefined;
  tabId?: string | undefined;
}

/** Known persisted fields are shared with the theme and page-setting producers. */
export type AppCustomPageConfig = CustomPageConfig;

/**
 * store 里 `customPage` 切片（`RootState['customPage']`）。
 *
 * 可读性约定：`initialState` 给出默认值的字段都是必选（始终存在）；
 * 由 `updatePageInfo(payload)` 注入的 3 个字段为可选（未同步前不存在）。
 */
export interface AppCustomPageState {
  // ── initialState 提供的 14 个字段 ──
  loading: boolean;
  modified: boolean;
  pageName: string;
  visible: boolean;
  pageId: string;
  desc: string;
  adjustScreen: boolean;
  version: string | null;
  apk: AppCustomPageApk;
  components: AppWidget[];
  /** 以 widget 的 `value` 为键，值是一组筛选条件（reducers.ts 以 `[payload.value]` 写入） */
  filtersGroup: Record<string, unknown[]>;
  linkageFiltersGroup: Record<string, unknown[]>;
  filterComponents: AppFilterComponent[];
  loadFilterComponentCount: number;
  /** `UPDATE_SAVE_LOADING` 会写入，initialState 未给默认值 */
  saveLoading?: boolean | undefined;

  // ── 由 `updatePageInfo` payload 注入、被消费方读取的 3 个字段 ──
  activeContainerInfo?: AppActiveContainerInfo | undefined;
  urlParams?: string[] | undefined;
  config?: AppCustomPageConfig | undefined;
}
