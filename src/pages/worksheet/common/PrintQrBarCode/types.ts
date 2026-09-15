/**
 * 二维码/条码打印这一块的共享类型。
 *
 * 为什么单独开一个模块而不是放在 util.ts：enum.ts 是【被依赖方】
 * （util.ts / vectorLabel.ts / print.ts 都 import './enum'），
 * 它要用 PrintLabelConfig 的话不能反向 import util.ts，会成环。
 * 类型只能放在依赖链的最底下。
 */

/** 标签上的一行文本。各渲染器会把整个对象展开，所以允许携带自己的排版覆盖项。 */
export interface LabelText {
  /** 文本内容。value 是另一种来源，两个键都出现过 */
  text?: string;
  value?: string;
  name?: string;
  type?: number;
  align?: 'left' | 'center' | 'right';
  isBold?: boolean;
  /** 为真时该行不参与自动换行 */
  forceInLine?: boolean;
}

/** 一张标签要打印的内容：码里承载的值 + 标签上的文本行。 */
export interface LabelRecord {
  value: string;
  texts: LabelText[];
}

/**
 * 打印设置面板存下来的那份配置。
 * 数值类字段对应 enum.ts 里的枚举（PRINT_TYPE / QR_LABEL_SIZE / QR_LAYOUT / QR_POSITION），
 * 那些枚举是普通对象字面量而非 as const，值类型只到 number，所以这里就写 number，
 * 另造联合类型也拦不住什么。
 */
export interface PrintLabelConfig {
  printType?: number;
  labelSize?: number;
  /** labelSize 为自定义档时才用这两个，单位 mm */
  labelCustomWidth?: number;
  labelCustomHeight?: number;
  layout?: number;
  position?: number;
  codeSize?: number | string;
  codeFaultTolerance?: number;
  fontSize?: number;
  firstIsBold?: boolean;
  showBarValue?: boolean;
  showControlName?: boolean;
  /** 要打印哪些行；元素是文本配置项，不是布尔（调用点是 showTexts.map(...)） */
  showTexts?: LabelText[];
  /** 码的内容来源：URL 还是某个字段，见 enum.ts 的 SOURCE_TYPE */
  sourceType?: number;
  sourceControlId?: string;
  sourceUrlType?: number;
  /** 预览时没有选中记录，用占位样例填充 */
  emptySetAsSample?: boolean;
  worksheetName?: string;
}

/**
 * enum.ts 里那些「名字 → 数值」的枚举表。
 * 除了枚举项本身，还可能挂两张附表：texts（展示文案）和 shorts（短码）。
 * getList() 正是靠排除这两个 key 来遍历真正的枚举项的。
 */
export interface EnumTable {
  texts?: Record<string, string>;
  shorts?: Record<string, string>;
  [key: string]: number | Record<string, string> | undefined;
}

/** QrPdf 的构造参数，也是 print.ts 默认导出的第一个参数。 */
export interface QrPdfOptions {
  worksheetName?: string;
  printType?: number;
  layout?: number;
  printData?: LabelRecord[];
  correctLevel?: number;
  config?: PrintLabelConfig;
}

/**
 * 码内容的外部来源。两种形态都有：
 * - rowid → 短链 的映射（getRowsShortUrl 的返回）
 * - 按行下标排列的数组（成员访问链接那条路）
 * getCodeContent 里 `urls[row.rowid] || urls[index]` 正是为了同时吃下这两种。
 */
export type CodeUrlSource = Record<string, string> | string[];

/**
 * getList() 产出的下拉选项，直接喂给 antd 的 Radio.Group / Checkbox.Group。
 *
 * value 写 number 而不是 EnumTable[string]：getList 已经把 texts / shorts 两张附表
 * 过滤掉了，剩下的键映射到的都是数值项。写成索引签名的联合类型会带上
 * Record<string,string> | undefined，antd 的 CheckboxOptionType 收不下（TS2322）。
 *
 * text / label 写成【必填但可为 undefined】：getList 无条件设置这两个键
 * （值来自 value.texts，可能没有），而 antd 那边 label 是必填 prop —— 
 * 写成可选属性 TS 会认为它可能整个不存在，同样对不上。
 */
export interface EnumOption {
  value: number;
  text: string | undefined;
  label: string | undefined;
}
