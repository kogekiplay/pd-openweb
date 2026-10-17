/**
 * `PublicWorksheetConfig` redux 的有限类型
 *
 * 【为什么需要这份】`RootState.publicWorksheet` 的 6 个字段（`shareUrl` /
 * `worksheetInfo` / `worksheetSettings` / `originalControls` / `controls` /
 * `hidedControlIds`）原本都推导为 `any`：reducer 形参没标注、`ReduxAction` 的
 * 默认索引签名把 `action.url` / `action.controls` 等一起拖成 `any`。
 * 结果是读任何不存在的字段都能编译通过。
 *
 * 【建模依据】字段全部来自**真实生产方/消费方**：
 * - 生产方：`actions.ts` 的 `getDispatchData()`（唯一构造 `PUBLICWORKSHEET_LOAD_SUCCESS`
 *   载荷的地方）与各 `PUBLICWORKSHEET_UPDATE_*` 派发点；
 * - 消费方：`PublicWorksheetConfig` 组件侧读到的字段。
 *
 * 【控件复用 `FormControl`】`originalControls` / `controls` 的元素就是工作表控件，
 * 直接复用 `src/utils/controlTypes` 的 `FormControl`（`controlId` / `type` /
 * `advancedSetting` / `col` / `row` / `size` / `half` 均已在其上声明），
 * 不另造一套并行形状。
 *
 * 【动态元数据用 unknown】`worksheetSettings.extendDatas`、`advancedSetting` 这类
 * 随业务开关变化的键确实无法穷举 —— 按提示词允许保留 `unknown`，
 * 但**已知业务字段逐个显式声明**，不把整个对象塞进索引签名当逃生口。
 */
import type { FormControl } from 'src/utils/controlTypes';

/** 回收站/隐藏控件的 id 列表 */
export type HidedControlId = string;

/**
 * 工作表信息。
 *
 * 【生产方】`getDispatchData()` 的 `worksheetInfo` 分支：
 * `themeIndex/themeBgColor/logoUrl/coverUrl` 由 `data.themeColor/themeBgColor/logo/cover`
 * 映射而来，其余由 `_.pick(data, [...])` 取。因此这些键**可能缺失** → 全部可选。
 *
 * 【消费方】组件读 `worksheetId` / `projectId` / `worksheetName` / `name` / `desc` /
 * `themeIndex` / `themeBgColor` / `logoUrl` / `coverUrl` / `visibleType` 等。
 */
export interface PublicWorksheetInfo {
  worksheetId?: string;
  projectId?: string;
  worksheetName?: string;
  name?: string;
  desc?: string;
  projectName?: string;
  visibleType?: number;
  submitBtnName?: string;
  appId?: string;
  /** 主题色索引（生产方来自 `data.themeColor`） */
  themeIndex?: number;
  themeBgColor?: string;
  /** 生产方来自 `data.logo`，经 `changeKeyToServer` 反向后为 `logoUrl` */
  logoUrl?: string;
  /** 生产方来自 `data.cover` */
  coverUrl?: string;
  /** 高级设置：形状随业务变化，无法穷举 → unknown */
  advancedSetting?: unknown;
  [key: string]: unknown;
}

/**
 * 工作表设置。
 *
 * 【生产方】`getDispatchData()` 的 `worksheetSettings` 分支：
 * `extendDatas` 恒定存在（`getDispatchData` 里必被赋 `shareConfig`），
 * 其余键由 `_.pick(data, [...])` 取，**可能缺失**。
 *
 * 【消费方】`getDisabledControls(originalControls, worksheetSettings)` 读
 * `ipControlId` / `browserControlId` / `deviceControlId` / `systemControlId` /
 * `extendSourceId` / `weChatSetting`，故这几个必须显式声明。
 */
export interface PublicWorksheetSettings {
  /**
   * 扩展数据：`getDispatchData` 里必定写入 `shareConfig`（JSON 字符串），
   * 其余键随业务/版本变化 → 已知 `shareConfig` 显式声明，其余走 unknown 索引。
   */
  extendDatas?: PublicWorksheetExtendDatas;
  /** 字段级限制：与控件 id 关联 */
  ipControlId?: string;
  browserControlId?: string;
  deviceControlId?: string;
  systemControlId?: string;
  extendSourceId?: string;
  weChatSetting?: PublicWorksheetWeChatSetting;
  /**
   * 以下由 `_.pick(data, [...])` 直取。
   *
   * 【类型来源：接口生成的权威声明】这些键在 `types/hap-api.d.ts` 的
   * `PublicFormDomainDto` 里**都有明确声明**，因此不再标 `unknown`，
   * 直接沿用生成类型（如 `receipt: string`、`writeScope: number`、
   * `boundControlIds: string[]`、`limitWriteTime: LimitWriteTime` 等）。
   * 这比"unknown + 让消费方自行收窄"更诚实：形状是已知的，只是不在本 redux 内定义。
   */
  limitWriteFrequencySetting?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteFrequencySetting;
  receipt?: string;
  extends?: string[];
  needCaptcha?: boolean;
  smsVerification?: boolean;
  smsVerificationFiled?: string;
  smsSignature?: string;
  writeScope?: number;
  linkSwitchTime?: HapApi.MD.Entity.Worksheet.PublicForm.LinkSwitchTime;
  limitWriteTime?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteTime;
  limitWriteCount?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteCountSetting;
  limitPasswordWrite?: HapApi.MD.Entity.Worksheet.PublicForm.LimitPasswordWriteSetting;
  cacheDraft?: boolean;
  cacheFieldData?: HapApi.MD.Entity.Worksheet.PublicForm.CacheFieldData;
  abilityExpand?: HapApi.MD.Entity.Worksheet.PublicForm.AbilityExpand;
  completeNumber?: number;
  boundControlIds?: string[];
  [key: string]: unknown;
}

/** `extendDatas`：目前只确定 `shareConfig`（JSON 字符串） */
export interface PublicWorksheetExtendDatas {
  /** `getDispatchData` 里 `JSON.stringify(shareConfig)` 的结果 */
  shareConfig?: string;
  [key: string]: unknown;
}

/** `weChatSetting`：`getDisabledControls` 会读 `fieldMaps` */
export interface PublicWorksheetWeChatSetting {
  fieldMaps?: {
    openId?: string;
    nickName?: string;
    headImgUrl?: string;
  };
  [key: string]: unknown;
}

/** 整个 `publicWorksheet` 切片 */
export interface PublicWorksheetState {
  /** 加载中；`LOAD_SUCCESS` 置 false，`CLEAR` 置 true */
  loading: boolean;
  /** 分享地址；`LOAD_SUCCESS` / `UPDATE_URL` 用 `action.url || ''`，`CLEAR` 置 '' */
  shareUrl: string;
  worksheetInfo: PublicWorksheetInfo;
  worksheetSettings: PublicWorksheetSettings;
  /** 原始控件（未按显隐/位置裁剪），元素复用 `FormControl` */
  originalControls: FormControl[];
  /** 当前展示的控件 */
  controls: FormControl[];
  /** 被隐藏的控件 id */
  hidedControlIds: HidedControlId[];
}
