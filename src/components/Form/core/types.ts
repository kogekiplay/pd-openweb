// 再导出不会把名字带进本地作用域，下面 FormRule 用到 ControlValue 所以还要 import 一次。
import type { ControlValue, FormControl } from 'src/utils/controlTypes';

/**
 * 表单引擎专有的类型。
 *
 * 控件本身的形状（FormControl / ControlValue 等）住在 src/utils/controlTypes.ts ——
 * 那里是更底层的位置，src/utils/control.ts 等模块也要用，
 * 放在 components 下会让 utils 反向依赖 components。
 * 这里【再导出】一遍，让表单侧的调用点仍然只需要 import 这一个模块。
 */
export type {
  ControlAdvancedSetting,
  ControlPermissions,
  ControlValue,
  FormControl,
  SubListStore,
} from 'src/utils/controlTypes';

/** 校验失败的条目，errorItems 数组的元素。 */
export interface FormError {
  controlId?: string;
  /** 错误类别，见 core/config 的 FORM_ERROR_TYPE */
  errorType?: string;
  errorMessage?: string;
  /** 部分场景用 errorText 而不是 errorMessage */
  errorText?: string;
  showError?: boolean;
  /** 只记错不弹提示 */
  ignoreErrorMessage?: boolean;
  /** 由哪条业务规则产生 */
  ruleId?: string;
  /** 子表内部的逐行错误 */
  errorItems?: FormError[];
  /** 这条错误来自子表（错误气泡的样式要换一套） */
  isChildTable?: boolean;
}

/**
 * 子表/关联表在填写时带着的【主表上下文】。
 * 动态默认值里 `item.rcid === masterData.worksheetId` 时，就从 masterData.formData 里取值
 *（见 formUtils/index.ts 的 getDynamicValue）。
 */
export interface MasterData {
  worksheetId?: string;
  formData?: FormControl[];
}

/**
 * 业务规则里的一个筛选条件。
 * 【只列规则遍历逻辑真正读到的字段】—— 条件本身还有 dataType / filterType / values
 * 等一大堆，那些只有 filterFn 在看；这里不写索引签名兜底，是为了拼错字段名当场报错。
 */
export interface RuleFilterItem {
  controlId?: string;
  /** 与前一条的连接方式：1 且、2 或 */
  spliceType?: number;
  /** 非空表示「跟另一个字段比」，cid 是那个字段的 controlId */
  dynamicSource?: { cid?: string }[];
}

/**
 * 一组筛选条件。组内按 spliceType 连接，组与组之间是「或」。
 *
 * 【故意继承 RuleFilterItem】实际数据里「组」自己也可能直接带 controlId ——
 * recordInfo/crtl.ts 收集受影响字段时就是 `(it.groupFilters || []).map(v => v.controlId)`
 * 之后再 `.concat(it.controlId)`，两层都取。以前 filters 是 any[]，这件事看不出来。
 */
export interface RuleFilterGroup extends RuleFilterItem {
  groupFilters?: RuleFilterItem[];
}

/** 业务规则（显示/必填/只读等），data 之外单独一份。 */
export interface FormRule {
  ruleId?: string;
  type?: number;
  disabled?: boolean;
  filters?: RuleFilterGroup[];
  ruleItems?: ControlValue[];
  [key: string]: ControlValue;
}
