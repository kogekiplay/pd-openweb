// 再导出不会把名字带进本地作用域，下面 FormRule 用到 ControlValue 所以还要 import 一次。
import type { ControlValue } from 'src/utils/controlTypes';

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
}

/** 业务规则（显示/必填/只读等），data 之外单独一份。 */
export interface FormRule {
  ruleId?: string;
  type?: number;
  disabled?: boolean;
  filters?: ControlValue[];
  ruleItems?: ControlValue[];
  [key: string]: ControlValue;
}
