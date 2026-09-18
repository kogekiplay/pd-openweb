/**
 * 工作表侧的领域类型。
 *
 * 控件本身的形状（FormControl / ControlValue 等）住在 src/utils/controlTypes.ts，
 * 表单引擎专有的（FormRule / FormError…）住在 src/components/Form/core/types.ts。
 * 这里只放"工作表 / 视图"这一层的东西。
 *
 * 和 FormControl 一样【故意不完备】：字段是按本仓实际读到的点补的，
 * 不是照着接口文档抄的。碰到没列的就往这里加一行，不要退回 any ——
 * 一旦退回去，各处 view.xxx 又整片变成不受检的黑洞。
 */
import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';

/**
 * 一个工作表视图。
 *
 * advancedSetting 的键极多且按 viewType 各不相同（导航、分组、日历的起止字段…），
 * 值统一是字符串（后端就是这么存的），所以直接复用 ControlAdvancedSetting 的口径。
 */
export interface WorksheetView {
  viewId?: string;
  name?: string;
  worksheetId?: string;
  /** 0 表格、1 看板、2 层级、3 甘特、4 日历、5 详情、6 地图、7 资源… */
  viewType?: number;
  advancedSetting?: ControlAdvancedSetting;
  /** 看板/层级等按某个字段分组时，指向那个字段的 controlId */
  viewControl?: string;
  /** 层级视图的多级分组字段 */
  viewControls?: { controlId?: string }[];
  /** 视图自身的筛选条件 */
  filters?: unknown[];
  /** 快速筛选配置 */
  fastFilters?: unknown[];
  /** 导航分组配置 */
  navGroup?: unknown[];
  /** 表格行高档位 */
  rowHeight?: number;
  /** 表格视图里展示哪些字段 */
  controls?: FormControl[];
}

/**
 * 移动端新建记录里在手里倒来倒去的"文件"。
 *
 * 【故意是个并集】这一路上它先后是三种东西：上传组件给的原生文件项（id/size/type/name/url）、
 * 服务端回来的附件（fileID/originalFilename/fileExt）、以及 App 内选文件回调给的东西
 * （originalFileName —— 注意和 originalFilename 大小写不同，两种都在用）。
 * 几个 format* 函数就是把它们抹平成同一套，所以这里把三边的字段都列上。
 */
export interface MobileFileLike {
  id?: string;
  fileID?: string;
  name?: string;
  fileName?: string;
  /** 后端两种大小写都出现过，调用点是 `a || b` 依次兜底的 */
  originalFilename?: string;
  originalFileName?: string;
  size?: number;
  /** 'image' 或 MIME，isImageAttachment 两种都认 */
  type?: string;
  url?: string;
  ext?: string;
  fileExt?: string;
  status?: string;
}
