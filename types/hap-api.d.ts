/**
 * 【生成文件，不要手改】由 tools/gen-api-types.ts 从后端 wwwapi 的 swagger 快照生成。
 * 快照版本：swagger-wwwapi-v8.0.0.0.json（取自生产 HAP 7.4.3）。
 * 只含 src/api 实际用到的接口牵涉的 schema；名字照 .NET 全名分层，见生成脚本文件头的映射规则。
 */

declare namespace HapApi.MD.Entity {
  interface ProjectBase {
    projectId?: string | undefined;
    companyName?: string | undefined;
    isAdmin: boolean;
  }
}

declare namespace HapApi.MD.Entity.Account {
  interface EasyAccount {
    accountId?: string | undefined;
    fullname?: string | undefined;
    avatar?: string | undefined;
    isPortal: boolean;
    status: HapApi.MD.Enum.AccountStatus;
  }
}

declare namespace HapApi.MD.Entity.Apk {
  interface AppSectionDomainModel {
    /** （swagger 里叫 id，实际序列化成 appSectionId） */
    appSectionId?: string | undefined;
    name?: string | undefined;
    appRoleType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
    /** （swagger 里叫 entityInfo，实际序列化成 workSheetInfo） */
    workSheetInfo?: HapApi.MD.Entity.Apk.EntityInfo[] | undefined;
    isLock: boolean;
    isGoodsStatus: boolean;
    fixed: boolean;
    rootId?: string | undefined;
    parentId?: string | undefined;
    icon?: string | undefined;
    iconUrl?: string | undefined;
    iconColor?: string | undefined;
    childSections?: HapApi.MD.Entity.Apk.AppSectionDomainModel[] | undefined;
    timeZone: number;
  }
  interface EntityInfo {
    /** （swagger 里叫 id，实际序列化成 workSheetId） */
    workSheetId?: string | undefined;
    /** （swagger 里叫 name，实际序列化成 workSheetName） */
    workSheetName?: string | undefined;
    type: number;
    createType: number;
    status: number;
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    navigateHide: boolean;
    count: number;
    externalLinkId?: string | undefined;
    urlTemplate?: string | undefined;
    configuration?: Record<string, string> | undefined;
    isMarked: boolean;
    alias?: string | undefined;
    remark?: string | undefined;
    desc?: string | undefined;
    resume?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.ApkMap {
  interface LicenceModel {
    licenceId?: string | undefined;
    name?: string | undefined;
    type: HapApi.MD.Enum.Map.LicenceEnum;
    isStop: boolean;
    startTime?: string | undefined;
    endTime?: string | undefined;
    planType: number;
    personCount: number;
    id?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.AppLang {
  interface LangInfo {
    appLangId?: string | undefined;
    langCode?: string | undefined;
    version?: number | undefined;
    projectId?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.ExternalPortal {
  interface PortalDiscussConfig {
    isEnable: boolean;
    allowExAccountDiscuss: boolean;
    exAccountDiscussEnum: HapApi.MD.Enum.ExternalPortal.ExAccountDiscussEnum;
    approved: boolean;
  }
}

declare namespace HapApi.MD.Entity.Form {
  interface DefaultSourceModel {
    rcid?: string | undefined;
    cid?: string | undefined;
    staticValue?: string | undefined;
    isAsync: boolean;
    type: number;
  }
}

declare namespace HapApi.MD.Entity.HomeApp {
  interface HomeAppModel {
    markedApps?: HapApi.MD.Entity.HomeApp.HomeAppDto[] | undefined;
    validProject?: HapApi.MD.Entity.HomeApp.ProjectForApp[] | undefined;
    aloneApps?: HapApi.MD.Entity.HomeApp.HomeAppDto[] | undefined;
    externalApps?: HapApi.MD.Entity.HomeApp.HomeAppDto[] | undefined;
    expireProject?: HapApi.MD.Entity.HomeApp.ProjectForApp[] | undefined;
    projectHashvalue?: string | undefined;
    versionTime?: string | undefined;
    retry: boolean;
  }
  interface HomeAppDto {
    projectId?: string | undefined;
    id?: string | undefined;
    name?: string | undefined;
    /** （swagger 里叫 avatar，实际序列化成 icon） */
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    navColor?: string | undefined;
    lightColor?: string | undefined;
    isMarked: boolean;
    avatarType: number;
    /** （swagger 里叫 permission，实际序列化成 permissionType） */
    permissionType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
    goodsId?: string | undefined;
    distributeId?: string | undefined;
    isLock: boolean;
    lockPassword?: string | undefined;
    isPassword: boolean;
    epEnableStatus: boolean;
    portalConfig?: HapApi.MD.Entity.ExternalPortal.PortalDiscussConfig | undefined;
    sourceType: number;
    timeZone: number;
    createTime?: string | undefined;
    trade?: HapApi.MD.Entity.Mongo.Apk.AppTrade | undefined;
    enName?: string | undefined;
    licences?: HapApi.MD.Entity.ApkMap.LicenceModel[] | undefined;
    isGoods: boolean;
    isGoodsStatus: boolean;
    endTime?: string | undefined;
    sourceProjectId?: string | undefined;
    createAccountId?: string | undefined;
    isNew: boolean;
    isHideApp: boolean;
    appNaviStyle: number;
    projectName?: string | undefined;
    fixed: boolean;
    pcDisplay: boolean;
    webMobileDisplay: boolean;
    appDisplay: boolean;
    pcNaviStyle: number;
    groupIds?: string[] | undefined;
    sectionIds?: string[] | undefined;
    urlTemplate?: string | undefined;
    configuration?: Record<string, string> | undefined;
    createType: number;
    selectAppItmeType: number;
    appStatus: number;
    origSourceType: number;
    exported: boolean;
  }
  interface ProjectForApp {
    projectId?: string | undefined;
    projectName?: string | undefined;
    projectApps?: HapApi.MD.Entity.HomeApp.HomeAppDto[] | undefined;
    hasApps: boolean;
  }
}

declare namespace HapApi.MD.Entity.Mongo.Apk {
  interface AppTrade {
    developId?: string | undefined;
    developType: number;
    devProjectId?: string | undefined;
    devName?: string | undefined;
    authorizeTime?: string[] | undefined;
    authorizePerson?: string[] | undefined;
    licenseType: number;
    projectId?: string | undefined;
    projectType: number;
    versionId?: string | undefined;
    verseionNo?: string | undefined;
    planId?: string | undefined;
    planType: number;
    limitPerson: number;
    licenseId?: string | undefined;
    licenseName?: string | undefined;
    day: number;
    month: number;
    authLock?: string | undefined;
    endTime?: string | undefined;
    stop: boolean;
    status: number;
    exported: boolean;
  }
}

declare namespace HapApi.MD.Entity.Plugin {
  interface PluginModel {
    id?: string | undefined;
    name?: string | undefined;
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    type: HapApi.MD.Enum.Plugin.PluginType;
    organization?: HapApi.MD.Entity.ProjectBase | undefined;
    developers?: string[] | undefined;
    currentVersion?: HapApi.MD.Entity.Plugin.PluginVersion | undefined;
    latestVersion?: string | undefined;
    creator?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    createTime?: string | undefined;
    state: number;
    isRebuild: boolean;
    debugEnvironments?: HapApi.MD.Entity.Plugin.PluginDubugEnvironment[] | undefined;
    paramSettings?: import('src/utils/controlTypes').FormControl[] | undefined;
    switchSettings?: Record<string, string> | undefined;
    configuration?: Record<string, ApiPayload> | undefined;
    stepState?: number | undefined;
    templateType: number;
    source: HapApi.MD.Enum.Plugin.PluginSourceType;
    codeUrl?: string | undefined;
    lastCommitTime?: string | undefined;
    sourceId?: string | undefined;
    debugConfiguration?: Record<string, ApiPayload> | undefined;
    recentOperation?: HapApi.MD.Entity.Plugin.RecentOperationRecord | undefined;
    license?: HapApi.MD.Entity.Plugin.TradeLicense | undefined;
  }
  interface PluginCommitRecord {
    id?: string | undefined;
    author?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    commitTime?: string | undefined;
    content?: HapApi.MD.Entity.Plugin.CommitContent | undefined;
    message?: string | undefined;
    versionTags?: string[] | undefined;
    beUsing: boolean;
    pluginId?: string | undefined;
  }
  interface PluginVersion {
    id?: string | undefined;
    versionCode?: string | undefined;
    versionDescription?: string | undefined;
    releaseTime?: string | undefined;
    state: HapApi.MD.Entity.Plugin.ReleaseState;
    publisher?: HapApi.MD.Entity.Account.EasyAccount | undefined;
  }
  interface PluginDubugEnvironment {
    appId?: string | undefined;
    worksheetId?: string | undefined;
    viewId?: string | undefined;
    viewName?: string | undefined;
    appName?: string | undefined;
    worksheetName?: string | undefined;
  }
  interface RecentOperationRecord {
    account?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    type: HapApi.MD.Enum.Plugin.PluginOperationType;
    time?: string | undefined;
  }
  interface TradeLicense {
    developName?: string | undefined;
    licenseName?: string | undefined;
    tradeId?: string | undefined;
    licenseId?: string | undefined;
    planType: number;
    personCount: number;
    licenseType: number;
    versionNo?: string | undefined;
    day: number;
    status: number;
    projectType: number;
  }
  interface CommitContent {
    codeUrl?: string | undefined;
  }
  type ReleaseState = 0 | 1 | 2;
}

declare namespace HapApi.MD.Entity.Role.AppRoleGrpcModel {
  interface UserInfoBase {
    addTime?: string | undefined;
    isRoleCharger: boolean;
    operaterName?: string | undefined;
    accountId?: string | undefined;
    fullName?: string | undefined;
    avatar?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.Role.FormFunc {
  type OPRangeType = 1 | 2 | 3;
}

declare namespace HapApi.MD.Entity.Worksheet {
  interface ControlTemplateEntity {
    sourceId?: string | undefined;
    worksheetId?: string | undefined;
    projectId?: string | undefined;
    version: number;
    controls: import('src/utils/controlTypes').FormControl[];
  }
  interface WorksheetViewEntity {
    viewId?: string | undefined;
    unRead: boolean;
    name?: string | undefined;
    worksheetId?: string | undefined;
    sortCid?: string | undefined;
    sortType: number;
    createAccountId?: string | undefined;
    controls?: string[] | undefined;
    filters?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    fastFilters?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    shareRange: number;
    worksheetName?: string | undefined;
    coverCid?: string | undefined;
    customDisplay: boolean;
    displayControls?: string[] | undefined;
    showControls?: string[] | undefined;
    viewType: number;
    viewControl?: string | undefined;
    coverType: number;
    showControlName: boolean;
    moreSort?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    rowHeight: number;
    controlsSorts?: string[] | undefined;
    layersName?: string[] | undefined;
    childType: number;
    viewControls?: HapApi.MD.Entity.Worksheet.LayerControlEntity[] | undefined;
    advancedSetting?: Record<string, string> | undefined;
    navGroup?: HapApi.MD.Entity.Worksheet.EasyFilterSortEntity[] | undefined;
    pluginInfo?: HapApi.MD.Entity.Plugin.PluginModel | undefined;
    pluginId?: string | undefined;
    deleteTime?: string | undefined;
    alias?: string | undefined;
  }
  interface ControlRuleEntity {
    ruleId?: string | undefined;
    name?: string | undefined;
    controlIds?: string[] | undefined;
    worksheetId?: string | undefined;
    type: number;
    disabled: boolean;
    filters?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    createAccountId?: string | undefined;
    ruleItems?: HapApi.MD.Entity.Worksheet.RuleItem[] | undefined;
    checkType: number;
    hintType: number;
    appTimeZone: number;
  }
  interface SwitchPermitModel {
    type: HapApi.MD.Enum.Worksheet.SwitchType;
    state: boolean;
    viewIds?: string[] | undefined;
    displayFlowChart: number;
  }
  interface WorksheetOperationLogPermissionModel {
    enable: boolean;
    range: HapApi.MD.Entity.Role.FormFunc.OPRangeType;
    allowExport: boolean;
    showRequestTypeFilter: boolean;
    showOperatorFilter: boolean;
  }
  interface WorksheetFilterSort {
    controlId?: string | undefined;
    dataType: HapApi.MD.Enum.Form.ControlType;
    spliceType: number;
    filterType: number;
    dateRange: number;
    dateRangeType: number;
    value?: string | undefined;
    values?: string[] | undefined;
    minValue?: string | undefined;
    maxValue?: string | undefined;
    isAsc: boolean;
    dynamicSource?: HapApi.MD.Entity.Form.DefaultSourceModel[] | undefined;
    advancedSetting?: Record<string, string> | undefined;
    isGroup: boolean;
    groupFilters?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    emptyRule?: number | undefined;
  }
  interface LayerControlEntity {
    worksheetId?: string | undefined;
    worksheetName?: string | undefined;
    controlId?: string | undefined;
    controlName?: string | undefined;
    coverCid?: string | undefined;
    coverType: number;
    showControls?: string[] | undefined;
    controlsSorts?: string[] | undefined;
    showControlName: boolean;
    advancedSetting?: Record<string, string> | undefined;
  }
  interface EasyFilterSortEntity {
    controlId?: string | undefined;
    isAsc: boolean;
    viewId?: string | undefined;
    filterType: number;
  }
  interface RuleItem {
    type: number;
    isAll: boolean;
    controls?: HapApi.MD.Entity.Worksheet.RuleChildItem[] | undefined;
    message?: string | undefined;
  }
  interface RuleChildItem {
    isCustom: boolean;
    controlId?: string | undefined;
    childControlIds?: string[] | undefined;
    permission?: string[] | undefined;
    type?: string | undefined;
    value?: string | undefined;
  }
}

declare namespace HapApi.MD.Enum {
  type AccountStatus = 0 | 1 | 2 | 3 | 4 | 5;
}

declare namespace HapApi.MD.Enum.ExternalPortal {
  type ExAccountDiscussEnum = 0 | 1;
}

declare namespace HapApi.MD.Enum.Form {
  type ControlType =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30
    | 31
    | 32
    | 33
    | 34
    | 35
    | 36
    | 37
    | 38
    | 39
    | 40
    | 41
    | 42
    | 43
    | 44
    | 45
    | 46
    | 47
    | 48
    | 49
    | 50
    | 51
    | 52
    | 53
    | 54
    | 10001
    | 10002
    | 10003
    | 10004
    | 10005
    | 10006
    | 10007
    | 10008
    | 10009
    | 10010;
}

declare namespace HapApi.MD.Enum.Map {
  type LicenceEnum = 1 | 2 | 3;
}

declare namespace HapApi.MD.Enum.Plugin {
  type PluginType = 0 | 1;
  type PluginSourceType = 0 | 1 | 2 | 3 | 4;
  type PluginOperationType = 1 | 2 | 3;
}

declare namespace HapApi.MD.Enum.Roles.AppRole {
  type AppRoleType = 0 | 1 | 2 | 3 | 100 | 200;
}

declare namespace HapApi.MD.Enum.Worksheet {
  type ShareRangeEnum = 1 | 2 | 3;
  type SwitchType =
    | 10
    | 11
    | 12
    | 13
    | 14
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30
    | 31
    | 32
    | 33
    | 34
    | 35
    | 36
    | 37
    | 38
    | 39
    | 40
    | 41
    | 50
    | 51
    | 52
    | 1001
    | 1002;
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.App {
  interface GetDto {
    /** 组织id */
    projectId?: string | undefined;
    /** 应用id */
    id?: string | undefined;
    /** 应用名称 */
    name?: string | undefined;
    /** 图标 */
    icon?: string | undefined;
    /** 图标颜色 */
    iconColor?: string | undefined;
    /** 图标链接 */
    iconUrl?: string | undefined;
    /** 导航栏颜色 */
    navColor?: string | undefined;
    /** 是否标星 */
    isMarked: boolean;
    /** 图标类型, 0 =系统，1= 自定义 */
    avatarType: number;
    permissionType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
    /** 商品包id */
    goodsId?: string | undefined;
    /** 分发id */
    distributeId?: string | undefined;
    /** 是否锁定 */
    isLock: boolean;
    /** 是否有密码 */
    isPassword: boolean;
    /** 应用来源(1 = 手动创建) 60 = 应用市场购买 */
    sourceType: number;
    /** 创建类型， 0 = 默认，1= 外部链接类型 */
    createType: number;
    /** 应用状态 （0=关闭，1=启用，2 = 删除，3= 维护中，4 = 升级中，11 = 还原中,20 = 市场授权过期） */
    appStatus: number;
    /** 应用描述 */
    description?: string | undefined;
    /** 分发有效期结束时间 */
    endTime?: string | undefined;
    /** 是否在有效期内 */
    isGoodsStatus: boolean;
    license?: HapApi.MD.Web.Ajax.ResultModel.App.TradeLicense | undefined;
    /** 分组默认展开方式 */
    appNaviDisplayType: number;
    /** 导航展开方式 */
    pcNaviDisplayType: number;
    /** 移动端导航宫格展示样式 */
    gridDisplayMode: number;
    /** 显示方式 */
    appNaviStyle: number;
    /** PC显示方式 */
    pcNaviStyle: number;
    /** 是否在维护中 */
    fixed: boolean;
    /** 维护时描述内容 */
    fixRemark?: string | undefined;
    fixAccount?: HapApi.MD.Entity.Role.AppRoleGrpcModel.UserInfoBase | undefined;
    /** Pc端显示 */
    pcDisplay: boolean;
    /** web移动端显示 */
    webMobileDisplay: boolean;
    /** app端显示 */
    appDisplay: boolean;
    /** 白名单 */
    openApiWhiteList?: string[] | undefined;
    /** 是否查看隐藏导航 */
    viewHideNavi: boolean;
    /** 淡色色值 */
    lightColor?: string | undefined;
    /** url模板 */
    urlTemplate?: string | undefined;
    /** 配置 */
    configuration?: Record<string, string> | undefined;
    /** 导航是否默认选中 */
    selectAppItmeType: number;
    /** 分组信息 */
    sections?: HapApi.MD.Entity.Apk.AppSectionDomainModel[] | undefined;
    /** 应用管理员 */
    managers?: HapApi.MD.Entity.Account.EasyAccount[] | undefined;
    langInfo?: HapApi.MD.Entity.AppLang.LangInfo | undefined;
    /** 组织名称 */
    projectName?: string | undefined;
    debugRole?: HapApi.MD.Web.Ajax.ResultModel.App.GetDto_DebugModel | undefined;
    /** 显示图标,目前只有三级（000，111，，0=不勾选，1=勾选） */
    displayIcon?: string | undefined;
    /** 展开方式  0 = 默认，1 = 手风琴 */
    expandType: number;
    /** 隐藏首个分组 */
    hideFirstSection: boolean;
    /** 时区（默认服务器时区,1= 跟随设备） */
    timeZone: number;
    /** SSO登录首页地址 */
    ssoAddress?: string | undefined;
    /** 原始语言 */
    originalLang?: string | undefined;
    /** 移动端导航应用项ids */
    appNavItemIds?: string[] | undefined;
    portalConfig?: HapApi.MD.Entity.ExternalPortal.PortalDiscussConfig | undefined;
    shortDesc?: string | undefined;
    /** 是否允许导出 */
    exported: boolean;
  }
  interface TradeLicense {
    /** 卖家 */
    developName?: string | undefined;
    /** 套餐名称 */
    licenseName?: string | undefined;
    /** 购买记录id */
    id?: string | undefined;
    /** 套餐id */
    licenseId?: string | undefined;
    /** 套餐类型：0 =免费,1= 试用，2 = 按年订阅，3 = 按用户数量订阅，4 = 买断 */
    planType: number;
    /** 应用中限制加入的人数 */
    personCount: number;
    /** 安装的应用类型, 0 = 免费应用，1 = 付费应用 */
    licenseType: number;
    /** 版本号 */
    versionNo?: string | undefined;
    /** 剩余天数 ，0 天不用展示 */
    day: number;
    /** 商品发布类型 0 = 产品型，1= 模板型 */
    goodsPushType: number;
    /** 授权状态 */
    status: number;
    /** 购买组织类型 （1 = 公有云， 2 = 私有部署） */
    projectType: number;
    exported: boolean;
  }
  interface GetDto_DebugModel {
    /** 是否 可使用调试模式（该结果 已包含 用户是否有权限使用调试） */
    canDebug: boolean;
    /** 已选的 Debug角色 */
    selectedRoles?: HapApi.MD.Web.Ajax.ResultModel.App.GetDto_SelectedRole[] | undefined;
  }
  interface GetDto_SelectedRole {
    roleId?: string | undefined;
    name?: string | undefined;
    roleType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Worksheet {
  interface WorksheetModel {
    /** 工作表id */
    worksheetId?: string | undefined;
    /** 数量 */
    count: number;
    /** 工作表名称 */
    name?: string | undefined;
    pyName?: string | undefined;
    /** 工作表别名 */
    alias?: string | undefined;
    /** 工作表详细说明 */
    desc?: string | undefined;
    /** 摘要 */
    resume?: string | undefined;
    /** 工作表描述 */
    remark?: string | undefined;
    /** 网络id */
    projectId?: string | undefined;
    /** 创建时间 */
    createTime?: string | undefined;
    shareRange: HapApi.MD.Enum.Worksheet.ShareRangeEnum;
    template?: HapApi.MD.Entity.Worksheet.ControlTemplateEntity | undefined;
    entityName?: string | undefined;
    downLoadUrl?: string | undefined;
    resultCode: number;
    /** 查询员工的身份 0:非成员 2:管理员 3:普通成员 4:开发者 */
    roleType: number;
    views?: HapApi.MD.Entity.Worksheet.WorksheetViewEntity[] | undefined;
    allowAdd: boolean;
    appId?: string | undefined;
    appName?: string | undefined;
    groupId?: string | undefined;
    /** 公开表单分享id */
    publicWorksheetShareId?: string | undefined;
    publicShareUrl?: string | undefined;
    /** 公开表单状态 */
    visibleType: number;
    /** 是否包含工作表查询 */
    isWorksheetQuery: boolean;
    type: number;
    rules?: HapApi.MD.Entity.Worksheet.ControlRuleEntity[] | undefined;
    /** 已关闭autoid */
    closeAutoID: boolean;
    /** 工作表创建记录表单配置 */
    advancedSetting?: Record<string, string> | undefined;
    /** 开启审批 */
    openApproval: boolean;
    switches?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
    /** 审批子表操作和列权限是否开启 */
    workflowChildTableSwitch: boolean;
    pluginConfiguration?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.ViewPluginConfiguration | undefined;
    appTimeZone: number;
    /** 开发者备注 */
    developerNotes?: string | undefined;
    /** 是否启用支付 */
    enablePayment: boolean;
    /** 是否支持立即支付 */
    isAllowImmediatePayment: boolean;
    worksheetOperationLogPermission?: HapApi.MD.Entity.Worksheet.WorksheetOperationLogPermissionModel | undefined;
  }
  /** 工作表行结果 */
  interface WorksheetRowsResult {
    /** 状态码 1：成功 */
    resultCode: number;
    /** 是否单行 */
    isSingleRow: boolean;
    /** 具体数据 */
    data?: Record<string, ApiPayload>[] | undefined;
    /** 数量统计 */
    count: number;
    worksheet?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetModel | undefined;
    template?: HapApi.MD.Entity.Worksheet.ControlTemplateEntity | undefined;
    /** 客户端标识，滑动过期 */
    clientId?: string | undefined;
    /** 是否是支付订单 */
    isPayOrder: boolean;
    /** 是否开启开票 */
    isOpenInvoice: boolean;
    contentEncrypted: boolean;
    projectId?: string | undefined;
    appId?: string | undefined;
    isCrossApp: boolean;
  }
  /** 视图插件配置 */
  interface ViewPluginConfiguration {
    functionSwitchSettings?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.FunctionSwitchSettings | undefined;
    /** 参数变量设置 */
    variableParamSettings?: HapApi.System.Collections.Generic.KeyValuePair_String_String[] | undefined;
    currentUseVersion?: HapApi.MD.Entity.Plugin.PluginCommitRecord | undefined;
  }
  /** 功能开关设置 */
  interface FunctionSwitchSettings {
    /** 快速筛选 */
    rapidCull: boolean;
    /** 筛选列表 */
    filterList: boolean;
    /** 移动端显示2 */
    mobileDisplay: boolean;
  }
}

declare namespace HapApi.System.Collections.Generic {
  interface KeyValuePair_String_String {
    key?: string | undefined;
    value?: string | undefined;
  }
}
