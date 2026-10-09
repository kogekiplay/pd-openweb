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
import type { ControlAdvancedSetting, FormControl } from '../../utils/controlTypes';

/** 发给取行接口的筛选条件。组条件只有连接方式与子条件，不一定有 controlId/dataType。 */
export interface WorksheetFilterCondition {
  controlId?: string | undefined;
  dataType?: number | undefined;
  spliceType?: number | undefined;
  filterType?: number | undefined;
  dateRange?: number | undefined;
  dateRangeType?: number | undefined;
  value?: string | number | undefined;
  values?: string[] | undefined;
  minValue?: string | number | undefined;
  maxValue?: string | number | undefined;
  /** UI 动态 URL 条件只写 cid/rcid/staticValue；服务端条件还可能带 isAsync/type。 */
  dynamicSource?:
    | {
        cid?: string | undefined;
        rcid?: string | undefined;
        staticValue?: string | undefined;
        isAsync?: boolean | undefined;
        type?: number | undefined;
      }[]
    | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  isGroup?: boolean | undefined;
  groupFilters?: WorksheetFilterCondition[] | undefined;
  /** 导航组筛选在界面里显示的名称，发送前保留在 state 中。 */
  navNames?: string[] | undefined;
}

/** 导航分组由 GroupFilter 的选中项派发；值和显示名数组始终存在，空组选中项用空数组。 */
export interface WorksheetNavGroupCondition extends WorksheetFilterCondition {
  controlId: string;
  dataType: number;
  values: string[];
  navNames: string[];
}

/** GetNavGroup 的消费形状：key 对应分组值，name 用于关联分组标题，count 用于数量显示。 */
export interface WorksheetNavGroupCount {
  key: string;
  name?: string | undefined;
  count: number;
}

/** formatFilterValues 把服务端的字符串转换为人员、部门、角色、地区或关联记录项。 */
export type QuickFilterDisplayValue =
  | string
  | { accountId?: string | undefined; fullname?: string | undefined; avatar?: string | undefined }
  | { organizeId?: string | undefined; organizeName?: string | undefined }
  | { departmentId?: string | undefined; departmentName?: string | undefined }
  | { id?: string | undefined; name?: string | undefined }
  | { rowid?: string | undefined; name?: string | undefined };

export interface QuickFilterDisplayCondition extends Omit<WorksheetFilterCondition, 'values'> {
  values?: QuickFilterDisplayValue[] | undefined;
}

/** sheet.filters：搜索框、筛选面板和嵌入页面分别派发部分更新。 */
export interface WorksheetFilters {
  searchType: number;
  keyWords: string;
  filterControls: WorksheetFilterCondition[];
  filtersGroup?: WorksheetFilterCondition[] | undefined;
  requestParams?: { ignorecase?: string | undefined } | undefined;
}

/** 视图取行请求，筛选字段来自 sheet.filters，其余字段由各视图按需补齐。 */
export interface WorksheetRowsRequest extends Partial<WorksheetFilters> {
  type?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  reportId?: string | undefined;
  /** 日历请求的可见时间范围，由 calendarview 填入。 */
  beginTime?: string | undefined;
  endTime?: string | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  status?: number | undefined;
  kanbanIndex?: number | undefined;
  kanbanSize?: number | undefined;
  kanbanKey?: string | undefined;
  relationWorksheetId?: string | undefined;
  controlId?: string | undefined;
  layer?: number | undefined;
  getType?: number | undefined;
  notGetTotal?: boolean | undefined;
  isGetWorksheet?: boolean | undefined;
  fastFilters?: WorksheetFilterCondition[] | undefined;
  navGroupFilters?: WorksheetFilterCondition[] | undefined;
  sortControls?:
    { controlId?: string | undefined; datatype?: number | undefined; isAsc?: boolean | undefined }[] | undefined;
  langType?: number | undefined;
}

/**
 * 一个工作表视图。
 *
 * advancedSetting 的键极多且按 viewType 各不相同（导航、分组、日历的起止字段…），
 * 值统一是字符串（后端就是这么存的），所以直接复用 ControlAdvancedSetting 的口径。
 */
export interface WorksheetView {
  viewId?: string | undefined;
  name?: string | undefined;
  worksheetId?: string | undefined;
  /** 0 表格、1 看板、2 层级、3 甘特、4 日历、5 详情、6 地图、7 资源… */
  viewType?: number | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  /** 看板/层级等按某个字段分组时，指向那个字段的 controlId */
  viewControl?: string | undefined;
  /** 层级视图的多级分组字段 */
  viewControls?: { controlId?: string | undefined; worksheetId?: string | undefined }[] | undefined;
  /** 层级视图区分本表父子关联与多表关联。 */
  childType?: number | undefined;
  /** 视图自身的筛选条件 */
  filters?: unknown[] | undefined;
  /** 快速筛选配置 */
  fastFilters?: unknown[] | undefined;
  /** 导航分组配置（接口模型 EasyFilterSortEntity，已核对） */
  navGroup?: HapApi.MD.Entity.Worksheet.EasyFilterSortEntity[] | undefined;
  /** 卡片 / 看板等视图上【显示】的字段 id（甘特图读它决定显示哪些列） */
  displayControls?: string[] | undefined;
  /** 表格视图的显示列（字段 id），列宽 / 列顺序按它排 */
  showControls?: string[] | undefined;
  /** 表格行高档位 */
  rowHeight?: number | undefined;
  /**
   * 视图里【隐藏】的字段 id（filterHidedControls 按它过滤）。
   * 原来写成「展示哪些字段」、类型 FormControl[]：接口给的是 string[]，读它的地方也全是按 id 比
   */
  controls?: string[] | undefined;
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

/**
 * 一张工作表的基本信息（redux 的 sheet.worksheetInfo 切片，也是 GetWorksheetInfo 的返回）。
 *
 * 字段是把 src/pages/worksheet 下 worksheetInfo.xxx 的读取点统计出来补的，
 * 不是照接口文档抄的 —— 后端返回的远不止这些。碰到没列的往这里加一行，不要退回 any。
 */
export interface WorksheetInfo {
  worksheetId?: string;
  projectId?: string;
  appId?: string;
  name?: string;
  /** 记录的称呼，如「客户」「订单」，用在「新建%0」这类文案里 */
  entityName?: string;
  allowAdd?: boolean;
  advancedSetting?: ControlAdvancedSetting;
  template?: { controls?: FormControl[] };
  rules?: unknown[];
  views?: WorksheetView[];
  /** 0 表示当前用户在这张表上没有角色 */
  roleType?: number;
  /** 功能开关列表，判定见 isOpenPermit */
  switches?: unknown[];
  enablePayment?: boolean;
  isAllowImmediatePayment?: boolean;
  isWorksheetQuery?: boolean;
  workflowChildTableSwitch?: boolean;
  /** 记录日志的权限（原来写成 boolean；接口给的是对象，WorksheetRecordLog 读它的 allowExport 等） */
  worksheetOperationLogPermission?: HapApi.MD.Entity.Worksheet.WorksheetOperationLogPermissionModel;
  downLoadUrl?: string;
  /** 关联控件的 relationControls 还在请求中；请求期间部分 UI 要等 */
  isRequestingRelationControls?: boolean;
}

/** 当前应用里我的角色信息（redux 的 sheet.appPkgData / sheetList.appPkgData 切片） */
export interface AppPkgData {
  /** 应用角色类型（应用的 permissionType），判定见 isHaveCharge / canEditApp */
  appRoleType?: number | undefined;
  isLock?: boolean | undefined;
}

/**
 * 当前打开的这张表 / 这个视图的定位信息（redux 的 sheet.base 切片）。
 */
export interface WorksheetBase {
  appId?: string | undefined;
  groupId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  /** 从统计图钻取过来时带的图表 id；有它时视图相关的初始化要跳过 */
  chartId?: string | undefined;
  /** 关联记录等场景下限制最多取多少条 */
  maxCount?: number | undefined;
  forcePageSize?: number | undefined;
  /** 'single'：单视图模式（嵌在自定义页面 / 移动端单视图里，见 worksheet/common/SingleView） */
  type?: string | undefined;
  /** 单视图模式下所属应用的 id（单视图里 appId 可能取不到） */
  singleAppId?: string | undefined;
  /** 统计图「以表格查看」时按表格视图渲染 */
  showAsSheetView?: boolean | undefined;
}
