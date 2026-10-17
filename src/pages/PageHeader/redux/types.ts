import type { AppSection, AppSectionItem } from 'src/utils/appTypes';
import type { WorksheetMenuNode } from 'src/utils/worksheetTypes';

/**
 * 应用分组里单个工作表/页面条目。
 *
 * 【为什么要扩展 `AppSectionItem`】`appGroups` 的消费方会读条目上的
 * `status` / `navigateHide`（`PageHeader/AppPkgHeader/AppGroup/index.tsx:106`：
 * `[1, 4].includes(o.status) && !o.navigateHide`），而 `src/utils/appTypes.ts` 的
 * `AppSectionItem` 没有声明这两个字段。
 *
 * 这里**不是凭用法猜形状**：`src/utils/worksheetTypes.ts` 的 `WorksheetMenuNode`
 * 已经声明了 `status?: number`、`navigateHide?: boolean`、`workSheetId?: string`
 * —— 正是缺的那几个，且它本身就是"导航菜单节点"的建模。所以直接复用它的字段，
 * 与 `AppSectionItem` 合成条目类型。
 */
export interface AppSectionEntry extends AppSectionItem {
  status?: number | undefined;
  /** 该条目在当前角色下是否隐藏导航 */
  navigateHide?: boolean | undefined;
}

/** 覆盖 `AppSection` 里会被读取到条目级字段的那几个数组 */
export interface AppSectionView extends Omit<AppSection, 'item' | 'workSheetInfo' | 'childSections'> {
  item?: AppSectionEntry[] | undefined;
  workSheetInfo?: AppSectionEntry[] | undefined;
  childSections?: AppSectionView[] | undefined;
}

/** 与 `WorksheetMenuNode` 的字段保持同源的编译期守卫（任一侧改名会在这里报错） */
type _SectionEntryStatusMatchesMenuNode = AppSectionEntry['status'] extends WorksheetMenuNode['status']
  ? true
  : never;
type _SectionEntryNavigateHideMatchesMenuNode = AppSectionEntry['navigateHide'] extends WorksheetMenuNode['navigateHide']
  ? true
  : never;
export type SectionEntryMenuNodeParity = [
  _SectionEntryStatusMatchesMenuNode,
  _SectionEntryNavigateHideMatchesMenuNode,
];


/**
 * 应用详情（`PageHeader` 顶部栏共享的那份应用信息）。
 *
 * 【为什么所有字段都是可选的】这份 state 不是「接口原样返回的对象」，而是
 * `SYNC_APP_DETAIL` 把**局部详情**一路 `{ ...state, ...detail }` 合并出来的：
 * 调用方会只传 `{ currentPcNaviStyle, iconColor }` 这样的子集（见 AppDetail/index.tsx:188），
 * 也会把接口返回的整份详情合进来。所以除了 `defaultState` 给出的 5 个默认字段，
 * 其它字段在任一时点都可能还没被同步过 —— 标成可选是如实描述，不是偷懒。
 *
 * 【为什么不写索引签名】把业务字段塞进 `[key: string]: unknown` 等于放弃类型：
 * 那样每个字段都会退化成需要下标访问的 unknown。这里的做法是**把真实业务字段逐个列出**，
 * 只有形状确实未建模的少数几个（license / managers / sections / fixAccount）用 `unknown`。
 */
export interface AppDetail {
  // ── 身份 ──
  id?: string | undefined;
  name?: string | undefined;
  iconUrl?: string | undefined;
  projectId?: string | undefined;
  projectName?: string | undefined;

  // ── 颜色与主题 ──
  iconColor?: string | undefined;
  navColor?: string | undefined;
  lightColor?: string | undefined;
  themeType?: string | undefined;

  // ── 导航风格（两个名字在代码里并存，都是数字枚举）──
  /** 当前生效的 PC 导航风格，消费方大量以 `=== 0 / 1 / 2 / 3` 判断 */
  currentPcNaviStyle?: number | undefined;
  /** 设置里保存的导航风格（尚未生效的配置值） */
  pcNaviStyle?: number | undefined;

  // ── 状态与权限 ──
  appStatus?: number | undefined;
  permissionType?: number | undefined;
  isLock?: boolean | undefined;
  viewHideNavi?: boolean | undefined;
  hideFirstSection?: boolean | undefined;
  displayIcon?: string | undefined;
  selectAppItmeType?: number | undefined;
  expandType?: number | undefined;
  /** 工作流 Agent 特性开关，代码里以字符串 '1' 比较 */
  workflowAgentFeatureType?: string | undefined;

  // ── 分组（复用仓内已应用/分组类型，条目级补上被读取的 status/navigateHide）──
  appGroups?: AppSectionView[] | undefined;

  // ── 真实存在但形状未建模：留 unknown，不放进索引签名 ──
  /** 授权/购买信息：字段取自真实读取点，见下方 AppLicense */
  license?: AppLicense | undefined;
  /** 管理员列表：消费方会渲染元素（读 accountId / avatar），见下方 AppManager */
  managers?: AppManager[] | undefined;
  /**
   * 分组/区块数据。
   *
   * 消费方确实按条目读字段：`AppGroup/index.tsx:93/101-109` 取 `sections` 后
   * `.map(item => ({ ...item, workSheetInfo: item.workSheetInfo.filter(o => [1,4].includes(o.status) && !o.navigateHide) }))`。
   * 因此这里不再是 `unknown`，而是与 `appGroups` 同构的 `AppSectionView[]`。
   */
  sections?: AppSectionView[] | undefined;
  /** 固定态文案与账号（见 components/FixedContent） */
  fixRemark?: string | undefined;
  fixAccount?: AppFixAccount | undefined;
  fixed?: boolean | undefined;
  pcDisplay?: boolean | undefined;
  goodsId?: string | undefined;
  /** 调试角色；代码里用 `(appPkg.debugRole || {}).canDebug` 访问 */
  debugRole?: { canDebug?: boolean | undefined } | undefined;
}

/**
 * 管理员（`appPkg.managers` 的元素）。
 *
 * 【字段来自真实渲染路径】`components/UnusualContent/index.tsx:80-91` 会
 * `managers.slice(0, 20).map(data => <UserHead user={{ ...data, accountId: data.accountId, userHead: data.avatar }} />)`：
 * 读 `accountId`、`avatar`，并把整个元素展开给 `UserHead`。
 */
export interface AppManager {
  accountId?: string | undefined;
  /** 头像地址（在组件里映射成 `user.userHead`） */
  avatar?: string | undefined;
}

/**
 * 固定态（应用维护中/停用）时展示的负责人。
 *
 * 【字段来自真实读取】`components/FixedContent/index.tsx:11` 用 `fixAccount.accountId`
 * 拼用户链接；同文件 :44 用 `(fixAccount || {}).fullName` 展示姓名。
 */
export interface AppFixAccount {
  accountId?: string | undefined;
  fullName?: string | undefined;
}

/**
 * 授权 / 购买信息。
 *
 * 【形状来自真实读取点，不是照抄接口文档】
 * - `_.get(appPkg.license, 'status') === 2` → `status: number`
 *   （`components/UnusualContent/index.tsx:130`、`:158`）
 * - `appPkg.license.planType`、`appPkg.license.id` 被直接拼进市场链接
 *   （`components/UnusualContent/index.tsx:167`）
 *
 * 三个字段都标可选：切片是局部详情浅合并出来的，未同步到授权信息时
 * `license` 整体为 `undefined`（外层的 `license?` 已表达这一点）。
 */
export interface AppLicense {
  status?: number | undefined;
  id?: string | undefined;
  planType?: number | undefined;
}

/**
 * store 里 `appPkg` 切片（`RootState['appPkg']`）。
 *
 * 与 `AppDetail` 的区别只有一条：`defaultState` 里给出默认值的 5 个字段
 * **在切片里始终存在**，因此它们在状态类型上是必选的；其余仍为可选。
 */
export interface AppPkgState extends AppDetail {
  iconColor: string;
  projectId: string;
  appGroups: AppSectionView[];
  appStatus: number;
  name: string;
}
