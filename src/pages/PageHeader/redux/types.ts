import type { AppSection } from 'src/utils/appTypes';

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

  // ── 分组（复用仓内已应用/分组类型）──
  appGroups?: AppSection[] | undefined;

  // ── 真实存在但形状未建模：留 unknown，不放进索引签名 ──
  /** 授权/购买信息（消费方只用 `_.get(appPkg.license, 'status')` 这类弱访问） */
  license?: unknown;
  /** 管理员列表（消费方只判空/取长度） */
  managers?: unknown[] | undefined;
  /** 分组/区块数据（消费方只做整体传递） */
  sections?: unknown;
  /** 固定态文案与账号（见 components/FixedContent） */
  fixRemark?: string | undefined;
  fixAccount?: Record<string, unknown> | undefined;
  fixed?: boolean | undefined;
  pcDisplay?: boolean | undefined;
  goodsId?: string | undefined;
  /** 调试角色；代码里用 `(appPkg.debugRole || {}).canDebug` 访问 */
  debugRole?: { canDebug?: boolean | undefined } | undefined;
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
  appGroups: AppSection[];
  appStatus: number;
  name: string;
}
