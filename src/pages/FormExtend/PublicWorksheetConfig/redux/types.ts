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
 * 【已按生成类型收敛到字段级，不留索引签名】原先 `worksheetInfo` /
 * `worksheetSettings` / `extendDatas` / `weChatSetting` 各带一个 `[key: string]: unknown`
 * 索引签名作为逃生口。现在：
 * - `worksheetSettings` 的 17 个原先标 `unknown` 的键，已按 `types/hap-api.d.ts` 的
 *   `PublicFormDomainDto`（接口生成类型）逐个收敛；
 * - 消费方读取的字段已全部显式声明（已核对 `state.publicWorksheet.*` 的读取点）；
 * - **实测移除全部 4 个索引签名后，全仓诊断数不变、无任何新增**，因此它们已无必要，
 *   一并删除。这样读一个未声明的键会**直接报错**，而不是静默得到 `unknown`。
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
  /**
   * 【这 4 个字段必须是 `?: T | undefined` 而不是 `?: T`】
   * `getDispatchData` 里它们是**直接赋值**（`themeIndex: data.themeColor` 等），
   * 所以键**始终存在**；当 DTO 缺对应字段时，值为**显式 `undefined`**（已实测确认）。
   * 而 `exactOptionalPropertyTypes` 下 `?: T` 表示"可缺失、不可显式 undefined"，
   * 用它描述这 4 个字段是**不诚实**的。其余字段由 `_.pick` 构造，缺键时键本身不出现，
   * 因此保持 `?: T` 才是正确建模。
   */
  themeIndex?: number | undefined;
  themeBgColor?: string | undefined;
  logoUrl?: string | undefined;
  coverUrl?: string | undefined;
  /**
   * 高级设置。生产方来自 DTO 的 `advancedSetting`（`Record<string, string>`），
   * 形状为"字符串到字符串"的映射，已按 DTO 声明。
   */
  advancedSetting?: Record<string, string>;
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
   * 其余键：`extendDatas` 是接口扩展下发，`shareConfig` 由本模块必定写入，已显式声明。
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
}

/** `extendDatas`：目前只确定 `shareConfig`（JSON 字符串） */
export interface PublicWorksheetExtendDatas {
  /** `getDispatchData` 里 `JSON.stringify(shareConfig)` 的结果 */
  shareConfig?: string;
}

/** `weChatSetting`：`getDisabledControls` 会读 `fieldMaps` */
export interface PublicWorksheetWeChatSetting {
  fieldMaps?: {
    openId?: string;
    nickName?: string;
    headImgUrl?: string;
  };
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
