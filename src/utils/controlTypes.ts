/**
 * 控件（字段）的领域类型。
 *
 * 放在 src/utils 而不是 Form 下：src/utils/control.ts、worksheet 各处都要用它，
 * 放在 components 里会让 utils 反向依赖 components。
 * 表单侧通过 src/components/Form/core/types.ts 再导出使用。
 *
 * 这里的字段【不是照着后端文档抄的】，是把 src/components/Form/core 下
 * 对控件对象的读写点统计出来、按出现次数从高到低补齐的（type 91 次、controlId 61 次、
 * value 50 次、advancedSetting 42 次……）。所以它描述的是「本仓实际怎么用控件」，
 * 而不是「控件理论上有哪些字段」——后者要从 swagger 生成，是另一件事。
 *
 * 因此它【故意不完备】：遇到没列的字段，补一行进来，而不是退回 any。
 */

/**
 * 控件的运行时值。
 *
 * 形状【随控件类型变化】：文本是 string，数值是 number/string，附件和子表是数组，
 * 级联/关联是对象或 JSON 字符串。要精确建模得按 50 多种控件类型做判别联合，
 * 那是一件独立工程（且需要先从 swagger 拿到各类型的值契约）。
 *
 * 在那之前用具名别名而不是裸 any：至少它可以被 grep 出来、可以被逐步收窄，
 * 收窄时也只需要改这一处定义。
 */
export type ControlValue = any;

/**
 * 子表/关联表的行存储句柄，由外部通过 setSubListStore 挂到控件上。
 * 实现在 Form/core 之外（ChildTableStore），这里只需要「有这么个东西」。
 */
export type SubListStore = any;

/** 控件的高级设置。键极多且按控件类型各不相同，值统一是字符串（后端就是这么存的）。 */
export interface ControlAdvancedSetting {
  [key: string]: string;
}

/** 控件权限位。 */
export interface ControlPermissions {
  [key: string]: boolean | number | string;
}

/**
 * 表单控件（字段）。
 * 递归字段（relationControls / showControls）用自身类型，子表控件靠它们描述内层结构。
 */
export interface FormControl {
  controlId?: string;
  /**
   * 控件类型，见 src/utils/enum 的控件类型表。
   * 除数值外还有一个哨兵值 'summaryhead'：统计行最左侧那一格不是真控件，
   * 代码里靠 type === 'summaryhead' 判定（见 SummaryCell.tsx）。
   */
  type?: number | 'summaryhead';
  controlName?: string;
  value?: ControlValue;
  advancedSetting?: ControlAdvancedSetting;
  /** 子表/关联表的行存储，由 setSubListStore 挂上 */
  store?: SubListStore;
  /** 复制控件时的原始 controlId */
  cid?: string;
  sid?: string;
  rcid?: string;
  rowid?: string;
  enumDefault?: number;
  enumDefault2?: number;
  /** 关联表的字段列表 */
  relationControls?: FormControl[];
  /** 关联记录在表单上展示的字段 */
  showControls?: string[];
  dataSource?: string;
  /** 动态默认值配置 */
  dynamicSource?: ControlValue[];
  defsource?: string;
  sourcevalue?: string;
  sourceControlId?: string;
  /** 关联表里作为标题显示的字段 */
  sourceTitleControlId?: string;
  sourceControlType?: number;
  /** 汇总/公式控件里指向的原始控件类型（注意大小写与 sourceControlType 不同，后端就是两个键） */
  sourceControltype?: number;
  /** 他表字段的原始控件类型 */
  originType?: number;
  strDefault?: string;
  storeFromDefault?: boolean;
  fieldPermission?: string;
  controlPermissions?: string | ControlPermissions;
  /** 人员控件的用途：2 表示这一列里的人是记录拥有者 */
  userPermission?: number;
  disabled?: boolean;
  required?: boolean;
  sectionId?: string;
  id?: string;
  editType?: number;
  size?: number;
  options?: ControlValue[];
  isSubList?: boolean;
  dot?: number;
  unit?: string;
  hint?: string;
  desc?: string;
  attribute?: number;
  row?: number;
  col?: number;
  half?: boolean;
  /** 生成来源（如 AI 推荐的原始描述），保留备查 */
  source?: ControlValue;
  isRequired?: boolean;
  isHeading?: boolean;
  description?: string;
  code?: string;
  alias?: string;
  /** 子表控件的行数据 */
  data?: ControlValue;
  /** 规则求值前的原始状态，用于还原 */
  defaultState?: ControlValue;
  hidden?: boolean;
  /** 规则把控件置灰时不参与必填校验 */
  ignoreDisabled?: boolean;
  /** 由 Excel 导入创建，跳过部分校验 */
  isImportFromExcel?: boolean;
  /** 移动端规则锁，避免重复触发 */
  mobileCheckRuleLocked?: boolean;
}

/**
 * 人员 / 部门 / 组织角色 / 选项 这类选择型控件的【值元素】。
 * 控件的 value 是一段 JSON 串，解析出来是这种对象的数组。
 * 字段按各控件类型不同只出现其中几个，所以全部可选。
 */
export interface SelectedEntityValue {
  id?: string;
  sid?: string;
  accountId?: string;
  departmentId?: string;
  organizeId?: string;
  name?: string;
  value?: ControlValue;
}
