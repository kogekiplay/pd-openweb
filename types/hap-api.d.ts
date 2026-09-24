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
  interface AppForManagerModel {
    appId?: string | undefined;
    appName?: string | undefined;
    /** （swagger 里叫 apkNamePinyin，实际序列化成 appNPY） */
    appNPY?: string | undefined;
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    isLock: boolean;
    /** （swagger 里叫 entityInfo，实际序列化成 workSheetInfo） */
    workSheetInfo?: HapApi.MD.Entity.Apk.EntityInfo[] | undefined;
    createAccountInfo?: HapApi.MD.Entity.Role.AppRoleGrpcModel.UserInfos | undefined;
    /** （swagger 里叫 createTime，实际序列化成 ctime） */
    ctime?: string | undefined;
    licences?: HapApi.MD.Entity.ApkMap.LicenceModel[] | undefined;
    trade?: HapApi.MD.Entity.Mongo.Apk.AppTrade | undefined;
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
  interface HomeAppSimpleDto {
    projectId?: string | undefined;
    appId?: string | undefined;
    appName?: string | undefined;
    appSectionId?: string | undefined;
    workSheetId?: string | undefined;
    urlTemplate?: string | undefined;
    configuration?: Record<string, string> | undefined;
    createType: number;
    permission: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
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
  interface UserInfos {
    addTime?: string | undefined;
    isRoleCharger: boolean;
    operaterName?: string | undefined;
    accountId?: string | undefined;
    fullName?: string | undefined;
    avatar?: string | undefined;
    isOwner: boolean;
    status: number;
  }
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
  interface RowDetailData {
    rowData?: string | undefined;
    createTime?: string | undefined;
    updateTime?: string | undefined;
    titleName?: string | undefined;
    worksheetName?: string | undefined;
    entityName?: string | undefined;
    allowEdit: boolean;
    allowDelete: boolean;
    projectId?: string | undefined;
    ownerAccount?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    createAccount?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    editAccount?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    shareRange: HapApi.MD.Enum.Worksheet.ShareRangeEnum;
    resultCode: number;
    roleType: number;
    view?: ApiPayload | undefined;
    appId?: string | undefined;
    groupId?: string | undefined;
    isViewData: boolean;
    isFavorite: boolean;
    templateControls?: import('src/utils/controlTypes').FormControl[] | undefined;
    advancedSetting?: Record<string, string> | undefined;
    contentEncrypted: boolean;
    isLock: boolean;
    appTimeZone: number;
  }
  interface WorksheetBtnEntity {
    btnId?: string | undefined;
    name?: string | undefined;
    worksheetId?: string | undefined;
    btnType: number;
    showType: number;
    filters?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    isAllView: number;
    displayViews?: string[] | undefined;
    clickType: number;
    confirmMsg?: string | undefined;
    sureName?: string | undefined;
    cancelName?: string | undefined;
    writeObject: number;
    writeType: number;
    relationControl?: string | undefined;
    addRelationControl?: string | undefined;
    workflowType: number;
    workflowId?: string | undefined;
    createAccountId?: string | undefined;
    updateTime?: string | undefined;
    updateAccountId?: string | undefined;
    updateAccount?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    writeControls?: HapApi.MD.Entity.Worksheet.WriteControlEntity[] | undefined;
    status: number;
    color?: string | undefined;
    icon?: string | undefined;
    iconUrl?: string | undefined;
    disabled: boolean;
    desc?: string | undefined;
    advancedSetting?: Record<string, string> | undefined;
    enableConfirm: boolean;
    verifyPwd: boolean;
    isBatch: boolean;
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
  interface ControlTemplateEntity {
    sourceId?: string | undefined;
    worksheetId?: string | undefined;
    projectId?: string | undefined;
    version: number;
    controls: import('src/utils/controlTypes').FormControl[];
  }
  interface SwitchPermitModel {
    type: HapApi.MD.Enum.Worksheet.SwitchType;
    state: boolean;
    viewIds?: string[] | undefined;
    displayFlowChart: number;
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
  interface WriteControlEntity {
    controlId?: string | undefined;
    type: number;
    defsource?: string | undefined;
  }
  interface RuleItem {
    type: number;
    isAll: boolean;
    controls?: HapApi.MD.Entity.Worksheet.RuleChildItem[] | undefined;
    message?: string | undefined;
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
  interface RuleChildItem {
    isCustom: boolean;
    controlId?: string | undefined;
    childControlIds?: string[] | undefined;
    permission?: string[] | undefined;
    type?: string | undefined;
    value?: string | undefined;
  }
  interface WorksheetQueryConfig {
    cid?: string | undefined;
    subCid?: string | undefined;
    pid?: string | undefined;
  }
}

declare namespace HapApi.MD.Enum {
  type UserStatus = 0 | 1 | 2 | 3 | 4 | 5;
  type LicenseType = 0 | 1 | 2;
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

declare namespace HapApi.MD.Web.Ajax.Enum {
  /** 网络状态 */
  type ProjectStatus = 0 | 1 | 2 | 3 | 4;
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

declare namespace HapApi.MD.Web.Ajax.ResultModel.Order {
  /** 版本信息 */
  interface VersionModel {
    /** （swagger 里没有，真实响应里有） */
    versionIdV2?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    name?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Project {
  /** 组织信息 */
  interface ProjectModel {
    /** 组织门牌号 */
    projectCode?: string | undefined;
    /** 组织ID */
    projectId?: string | undefined;
    /** 组织名称，只在发票抬头用，其他地方用 companyDisplayName */
    companyName?: string | undefined;
    /** 英文名 */
    companyNameEnglish?: string | undefined;
    /** 呈现名称 */
    companyDisplayName?: string | undefined;
    /** 地区 */
    geographyId?: number | undefined;
    /** 行业 */
    industryId?: number | undefined;
    /** (地理位置)国家地区-编码 */
    geoCountryRegionCode?: string | undefined;
    /** 国家地区名称 */
    geoCountryRegionName?: string | undefined;
    timeZone?: string | undefined;
    timeZoneName?: string | undefined;
    /** 当前有效计费人数 */
    effectiveUserCount?: number | undefined;
    /** 网络人数上限 */
    limitUserCount?: number | undefined;
    /** 当前有效应用数量 */
    effectiveApkCount?: number | undefined;
    /** 当前组织应用数上限数量 */
    limitApkCount?: number | undefined;
    /** 当前有效工作表数量 */
    effectiveWorksheetCount?: number | undefined;
    /** 当前工作表数量上限 */
    limitWorksheetCount?: number | undefined;
    /** 当前有效工作表总行数 */
    effectiveWorksheetRowCount?: number | undefined;
    /** 当前单个工作表行记录总数量上限 */
    limitWorksheetRowCount?: number | undefined;
    /** 当前所有工作表行记录总数量上限 */
    limitAllWorksheetRowCount?: number | undefined;
    /** 当前有效工作流数量 */
    effectiveWorkflowCount?: number | undefined;
    /** 组织工作流目前上限数量 */
    limitWorkflowCount?: number | undefined;
    /** 当前有效存储量（单位字节） */
    effectiveApkStorageCount?: number | undefined;
    /** 组织存储量目前上限数量（单位GB） */
    limitApkStorageCount?: number | undefined;
    /** 当前外部用户数量 */
    effectiveExternalUserCount?: number | undefined;
    /** 组织外部用户目前上限数量 */
    limitExternalUserCount?: number | undefined;
    /** 当前有效数据集成运行任务数量 */
    effectiveDataPipelineJobCount: number;
    /** 当前有效数据集成包含ETL的运行任务数量 */
    effectiveDataPipelineEtlJobCount: number;
    /** 组织数据集成运行任务目前上限数量 */
    limitDataPipelineJobCount: number;
    /** 组织数据集成ETL运行任务目前上限数量 */
    limitDataPipelineEtlJobCount: number;
    /** 当前有效数据集成运行行数数量 */
    effectiveDataPipelineRowCount: number;
    /** 组织数据集成运行行数目前上限数量 */
    limitDataPipelineRowCount: number;
    /** 当前组织有效聚合表数量 */
    effectiveAggregationTableCount?: number | undefined;
    /** 组织聚合表上限数量 */
    limitAggregationTableCount?: number | undefined;
    /** 当前向量知识库有效数量 */
    effectiveVectorKnowledgeCount?: number | undefined;
    /** 组织向量知识库目前上限数量（单位个） */
    limitVectorKnowledgeCount?: number | undefined;
    /** 当前向量知识库有效分块数量 */
    effectiveVectorKnowledgeChunkCount?: number | undefined;
    /** 组织向量知识库分块目前上限数量（单位行） */
    limitVectorKnowledgeChunkCount?: number | undefined;
    /** 组织商户上限数量 */
    limitMerchantCount?: number | undefined;
    /** 组织电子开票税号上限数量 */
    limitInvoiceTaxIdCount?: number | undefined;
    /** 是否不限人数 */
    unLimited?: boolean | undefined;
    /** 网络余额（信用点） */
    balance?: number | undefined;
    /** 部门数量 */
    departmentCount?: number | undefined;
    /** 网络未激活人数 */
    notActiveUserCount?: number | undefined;
    /** 是否有角色 */
    hasRole?: boolean | undefined;
    /** 是否是 【企业网络管理员】 */
    isProjectAdmin?: boolean | undefined;
    /** 是否是 【企业网络超级管理员】 */
    isSuperAdmin: boolean;
    /** 是否是创建者 */
    isCreateUser?: boolean | undefined;
    /** 是否允许升级 */
    allowUpgradeVersion?: boolean | undefined;
    /** 是否允许续费外部门户 */
    allowUpgradeExternalPortal?: boolean | undefined;
    projectStatus: HapApi.MD.Web.Ajax.Enum.ProjectStatus;
    userStatus: HapApi.MD.Enum.UserStatus;
    /** 该账户在本网路中的加入时间 */
    userUpdateTime?: string | undefined;
    licenseType: HapApi.MD.Enum.LicenseType;
    version?: HapApi.MD.Web.Ajax.ResultModel.Order.VersionModel | undefined;
    currentLicense?: HapApi.MD.Web.Ajax.ResultModel.Project.ProjectLicenseModel | undefined;
    nextLicense?: HapApi.MD.Web.Ajax.ResultModel.Project.ProjectLicenseModel | undefined;
    /** 网络创建者 */
    createAccountId?: string | undefined;
    /** 付费次数 */
    paidCount?: number | undefined;
    /** 汇报关系全员可见 */
    structureForAll?: boolean | undefined;
    /** 是否开放 Hr 入口 */
    isHrVisible: boolean;
    /** 是否 不能创建应用 */
    cannotCreateApp: boolean;
    /** 是否 不能删除应用 */
    cannotDeleteApp: boolean;
    /** 是否 启用水印 */
    enabledWatermark: boolean;
    /** 水印文本 */
    enabledWatermarkTxt?: string | undefined;
    /** 允许使用（非管理员）API集成 */
    allowAPIIntegration: boolean;
    /** 允许使用（非管理员）数据集成 */
    allowDataPipeline: boolean;
    /** 允许使用（非管理员）插件 */
    allowPlugin: boolean;
    /** 允许使用全局搜索 */
    allowSuperSearch: boolean;
    /** 企业认证类型 */
    authType: number;
    /** 自动订购应用上传流量包 */
    autoPurchaseApkStorageExtPack: boolean;
    /** 自动订购数据集成扩展包 */
    autoPurchaseDataPipelineExtPack: boolean;
    /** 自动订购工作流升级包 */
    autoPurchaseWorkflowExtPack: boolean;
    /** 自动订购外部门户用户额度扩充包 */
    autoPurchaseExternalUserExtPack: boolean;
    closedTime?: string | undefined;
    /** 关闭 操作人 名称 */
    closedOperatorName?: string | undefined;
    privacyModel?: HapApi.MD.Web.Ajax.ResultModel.Project.GetPrivacyModel | undefined;
  }
  /** 组织授权 */
  interface ProjectLicenseModel {
    /** 到期天数 */
    expireDays: number;
    /** 开始时间 */
    startDate?: string | undefined;
    /** 结束时间 */
    endDate?: string | undefined;
    version?: HapApi.MD.Web.Ajax.ResultModel.Order.VersionModel | undefined;
  }
  interface GetPrivacyModel {
    /** 企业账号 */
    regCode?: string | undefined;
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
  /** 查询默认值dto */
  interface DefultQueryDto {
    /** 工作表查询数据 */
    queries?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetQueryDto[] | undefined;
    /** 查询表的控件信息 */
    templates?: Record<string, import('src/utils/controlTypes').FormControl[]> | undefined;
  }
  /** 视图插件配置 */
  interface ViewPluginConfiguration {
    functionSwitchSettings?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.FunctionSwitchSettings | undefined;
    /** 参数变量设置 */
    variableParamSettings?: HapApi.System.Collections.Generic.KeyValuePair_String_String[] | undefined;
    currentUseVersion?: HapApi.MD.Entity.Plugin.PluginCommitRecord | undefined;
  }
  interface WorksheetQueryDto {
    id?: string | undefined;
    worksheetId?: string | undefined;
    /** 查询控件id */
    controlId?: string | undefined;
    controlType: HapApi.MD.Enum.Form.ControlType;
    /** 来源id */
    sourceId?: string | undefined;
    /** 来源名称 */
    sourceName?: string | undefined;
    appName?: string | undefined;
    /** 1 = 本表，2 = 他表 */
    sourceType: number;
    /** 筛选条件 */
    items?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    /** 映射字段 */
    configs?: HapApi.MD.Entity.Worksheet.WorksheetQueryConfig[] | undefined;
    /** 0 = 获取第一条时，按配置来，1= 不赋值 */
    moreType: number;
    /** 0 = 赋空值 1 = 保留原值 */
    recordsNotFound: number;
    /** 排序 (默认按创建时间降序) */
    moreSort?: HapApi.MD.Entity.Worksheet.WorksheetFilterSort[] | undefined;
    /** 查询条数(关联多条,子表时值有效) */
    queryCount?: number | undefined;
    /** 结果类型 0=查询到记录，1=仅查询到一条记录，2=查询到多条记录，3=未查询到记录 */
    resultType: number;
    /** 0 = 常规字段默认值，1 = 表单事件 */
    eventType: number;
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
