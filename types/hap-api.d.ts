/**
 * 【生成文件，不要手改】由 tools/gen-api-types.ts 从后端 wwwapi 的 swagger 快照生成。
 * 快照版本：swagger-wwwapi-v8.0.0.0.json（取自生产 HAP 7.4.3）。
 * 只含 src/api 实际用到的接口牵涉的 schema；名字照 .NET 全名分层，见生成脚本文件头的映射规则。
 */

declare namespace HapApi.MD.BasicService {
  type Duration_Option = 0 | 5 | 10 | 20 | 30 | 100 | 200 | 1000;
}

declare namespace HapApi.MD.Caching.FixedDataCache {
  interface LangConfig {
    langCode?: string | undefined;
    localLang?: string | undefined;
    enName?: string | undefined;
    zh_hansName?: string | undefined;
    zh_hantName?: string | undefined;
    jaName?: string | undefined;
    thName?: string | undefined;
    msName?: string | undefined;
    isSystemLang: boolean;
  }
}

declare namespace HapApi.MD.Entity {
  interface ReturnResult_ActionLogListWithTotalCountModel {
    code: HapApi.MD.Enum.ResultCode;
    msg?: string | undefined;
    data?: HapApi.MD.Web.Ajax.ResultModel.ActionLog.ActionLogListWithTotalCountModel | undefined;
  }
  interface ReturnResult_OrgLogListWithTotalCountModel {
    code: HapApi.MD.Enum.ResultCode;
    msg?: string | undefined;
    data?: HapApi.MD.Web.Ajax.ResultModel.ActionLog.OrgLogListWithTotalCountModel | undefined;
  }
  interface ReturnResult {
    code: HapApi.MD.Enum.ResultCode;
    msg?: string | undefined;
    data?: ApiPayload | undefined;
  }
  interface RegionConfigInfo {
    code?: string | undefined;
    aliascode?: string | undefined;
    digitalcode?: string | undefined;
    layer: number;
    name?: string | undefined;
    phoneNumber?: string | undefined;
    capitalName?: Record<string, string> | undefined;
    timezone: number;
    capitalTimezoneUTC?: string | undefined;
    currencyCode?: string | undefined;
    currencySymbol?: string | undefined;
    currencyName?: Record<string, string> | undefined;
    currencyPluralNames?: Record<string, string> | undefined;
    subunit?: Record<string, string> | undefined;
    subunits?: Record<string, string> | undefined;
    conversionFactor: number;
    convertCurrencyUnits?: string | undefined;
    type: number;
  }
  interface ActionLog {
    projectId?: string | undefined;
    type?: string | undefined;
    date?: string | undefined;
    log?: Record<string, string> | undefined;
  }
  interface OrgLog {
    id?: string | undefined;
    operator?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    opeartContent?: string | undefined;
    operateTargetType: HapApi.MD.Enum.ActionLog.OperateTargetType;
    operateType: HapApi.MD.Enum.ActionLog.OperateType;
    operationDatetime?: string | undefined;
    ip?: string | undefined;
    geoCity?: string | undefined;
    browserName?: string | undefined;
    browserVersion?: string | undefined;
    systemInfo?: string | undefined;
    systemVersion?: string | undefined;
    latitudeAndLongitude?: string | undefined;
    deviceId?: string | undefined;
    deviceModel?: string | undefined;
    deviceType?: string | undefined;
    extrasAccounts?: HapApi.MD.Entity.Account.EasyAccount[] | undefined;
    accountFullInfo?: HapApi.MD.Entity.Account.AccountFullInfo | undefined;
  }
  interface ProjectBase {
    projectId?: string | undefined;
    companyName?: string | undefined;
    isAdmin: boolean;
  }
  interface User {
    userId?: string | undefined;
    accountId?: string | undefined;
    projectId?: string | undefined;
    companyName?: string | undefined;
    workSiteId?: string | undefined;
    workSiteInfo?: HapApi.MD.Entity.ProjectWorkSite | undefined;
    contactPhone?: string | undefined;
    jobNumber?: string | undefined;
    lastModifyAccountId?: string | undefined;
    status: HapApi.MD.Enum.UserStatus;
    createTime?: string | undefined;
    updateTime?: string | undefined;
    departmentIds?: string[] | undefined;
    jobIds?: string[] | undefined;
    departmentInfos?: HapApi.MD.Entity.ProjectDepartment[] | undefined;
    jobInfos?: HapApi.MD.Entity.ProjectJob[] | undefined;
    orgRoles?: HapApi.MD.Entity.ProjectOrganizeIdName[] | undefined;
    orgRoleIds?: string[] | undefined;
  }
  interface ProjectWorkSite {
    autoId: number;
    workSiteId?: string | undefined;
    workSiteName?: string | undefined;
    createUser?: string | undefined;
    lastModifyUser?: string | undefined;
    projectId?: string | undefined;
    createTime?: string | undefined;
    updateTime?: string | undefined;
    userCount: number;
  }
  interface ProjectDepartment {
    autoId: number;
    departmentId?: string | undefined;
    parentId?: string | undefined;
    parentDepartment?: HapApi.MD.Entity.ProjectDepartment | undefined;
    fullDepartmentName?: string | undefined;
    departmentName?: string | undefined;
    zhDepartmentName?: string | undefined;
    createUser?: string | undefined;
    lastModifyUser?: string | undefined;
    chargeAccountId?: string | undefined;
    chargeAccountIds?: string[] | undefined;
    projectId?: string | undefined;
    mappingGroupId?: string | undefined;
    mappingGroup?: HapApi.MD.Entity.Group | undefined;
    createTime?: string | undefined;
    updateTime?: string | undefined;
    sortIndex: number;
    userCount: number;
    haveSubDepartment: boolean;
    disabled: boolean;
    subDepartments?: HapApi.MD.Entity.ProjectDepartment[] | undefined;
    parentPaths?: HapApi.MD.Entity.DepartmentPath[] | undefined;
    childPaths?: HapApi.MD.Entity.DepartmentPath[] | undefined;
  }
  interface ProjectJob {
    autoId: number;
    jobId?: string | undefined;
    jobName?: string | undefined;
    createAccountId?: string | undefined;
    lastModifyAccountId?: string | undefined;
    projectId?: string | undefined;
    createTime?: string | undefined;
    updateTime?: string | undefined;
    userCount: number;
  }
  interface ProjectOrganizeIdName {
    id?: string | undefined;
    name?: string | undefined;
  }
  interface Group {
    groupID?: string | undefined;
    groupName?: string | undefined;
    zhGroupName?: string | undefined;
    avatar?: string | undefined;
    avatarSmall?: string | undefined;
    avatarBig?: string | undefined;
    about?: string | undefined;
    isApproval: boolean;
    isVerified: boolean;
    isPost: boolean;
    isHidden: boolean;
    isForbidSpeak: boolean;
    isForbidInvite: boolean;
    status: HapApi.MD.Enum.GroupStatus;
    createTime?: string | undefined;
    lastTime?: string | undefined;
    createUserAccountId?: string | undefined;
    createAccountInfo?: HapApi.MD.Entity.Account.AccountFullInfo | undefined;
    groupUsers?: HapApi.MD.Entity.GroupUser[] | undefined;
    groupEffectiveUsers?: HapApi.MD.Entity.GroupUser[] | undefined;
    groupUnEffectiveUsers?: HapApi.MD.Entity.GroupUser[] | undefined;
    groupInactiveUsers?: HapApi.MD.Entity.GroupUser[] | undefined;
    groupAdminUsers?: HapApi.MD.Entity.GroupUser[] | undefined;
    projectID?: string | undefined;
    mapDepartmentId?: string | undefined;
    mapDeptName?: string | undefined;
    postCount: number;
    docCount: number;
    qaCount: number;
    userCount: number;
  }
  interface DepartmentPath {
    departmentId?: string | undefined;
    depth: number;
    departmentName?: string | undefined;
  }
  interface GroupUser {
    accountId?: string | undefined;
    accountFullInfo?: HapApi.MD.Entity.Account.AccountFullInfo | undefined;
    status: HapApi.MD.Enum.GroupFollowedStatus;
    isPushNotice: boolean;
    isCreateUser: boolean;
    createTime?: string | undefined;
    groupUserRole: HapApi.MD.Enum.GroupUserRole;
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
  interface AccountFullInfo {
    accountId?: string | undefined;
    mobilePhone?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
    companyName?: string | undefined;
    profession?: string | undefined;
    address?: string | undefined;
    contactMobilePhone?: string | undefined;
    fullname?: string | undefined;
    enFullname?: string | undefined;
    gender: HapApi.MD.Enum.Gender;
    birthdate?: string | undefined;
    imQQ?: string | undefined;
    snsSina?: string | undefined;
    snsQQ?: string | undefined;
    snsLinkedin?: string | undefined;
    weiXin?: string | undefined;
    firstCode?: string | undefined;
    mark: number;
    lastMark: number;
    numLogin: number;
    numView: number;
    numPost: number;
    numComment: number;
    updateTime?: string | undefined;
    createTime?: string | undefined;
    status: HapApi.MD.Enum.AccountStatus;
    isPortal: boolean;
    sourceType: HapApi.MD.Enum.AccountSourceType;
    lastLoginTime?: string | undefined;
    appId?: string | undefined;
    isSSO: boolean;
    grade?: string | undefined;
    contactType: HapApi.MD.Enum.AccountContactType;
    projectIds?: string[] | undefined;
    user?: HapApi.MD.Entity.User | undefined;
    avatar?: string | undefined;
    isDefaultAvatar: boolean;
    avatarUrlSizeFormat?: string | undefined;
    avatarSmall?: string | undefined;
    avatarMiddle?: string | undefined;
    avatarBig?: string | undefined;
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
  interface AppForProjectModel {
    /** （swagger 里叫 apkId，实际序列化成 appId） */
    appId?: string | undefined;
    isLock: boolean;
    goodsId?: string | undefined;
    distributeId?: string | undefined;
    licences?: HapApi.MD.Entity.ApkMap.LicenceModel[] | undefined;
    sourceProjectId?: string | undefined;
    dbInstance?: string | undefined;
    isGoods: boolean;
    isGoodsStatus: boolean;
    isImageApk: boolean;
    projectId?: string | undefined;
    /** （swagger 里叫 apkName，实际序列化成 appName） */
    appName?: string | undefined;
    /** （swagger 里叫 apkNamePinyin，实际序列化成 appNPY） */
    appNPY?: string | undefined;
    /** （swagger 里叫 avatar，实际序列化成 icon） */
    icon?: string | undefined;
    /** （swagger 里叫 color，实际序列化成 iconColor） */
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    description?: string | undefined;
    /** （swagger 里叫 apkStatus，实际序列化成 status） */
    status: HapApi.MD.Enum.Apk.ApkStatusEnum;
    /** （swagger 里叫 createAccountId，实际序列化成 caid） */
    caid?: string | undefined;
    createAccountInfo?: HapApi.MD.Entity.Role.AppRoleGrpcModel.UserInfos | undefined;
    /** （swagger 里叫 createTime，实际序列化成 ctime） */
    ctime?: string | undefined;
    /** （swagger 里叫 updateTime，实际序列化成 utime） */
    utime?: string | undefined;
    permissionType?: HapApi.MD.Enum.Roles.AppRole.AppRoleType | undefined;
    appSectionIds?: string[] | undefined;
    sheetCount: number;
    createType: number;
    urlTemplate?: string | undefined;
    trade?: HapApi.MD.Entity.Mongo.Apk.AppTrade | undefined;
    sourceType: number;
    worksheetIds?: string[] | undefined;
    migrateTime?: string | undefined;
    pcDisplay: boolean;
    webMobileDisplay: boolean;
    appDisplay: boolean;
    exported: boolean;
  }
  interface OpenAppModel {
    projectId?: string | undefined;
    appId?: string | undefined;
    name?: string | undefined;
    iconUrl?: string | undefined;
    color?: string | undefined;
    desc?: string | undefined;
    remark?: string | undefined;
    sections?: HapApi.MD.Entity.Apk.OpenSectionModel[] | undefined;
    createType: number;
    urlTemplate?: string | undefined;
  }
  interface AppItem {
    name?: string | undefined;
    type?: string | undefined;
  }
  interface OpenSectionModel {
    sectionId?: string | undefined;
    name?: string | undefined;
    items?: HapApi.MD.Entity.Apk.OpenItemModel[] | undefined;
    childSections?: HapApi.MD.Entity.Apk.OpenSectionModel[] | undefined;
  }
  interface OpenItemModel {
    id?: string | undefined;
    name?: string | undefined;
    type: number;
    iconUrl?: string | undefined;
    status: number;
    alias?: string | undefined;
    notes?: string | undefined;
    remark?: string | undefined;
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
  interface GoodsSimpleModel {
    projectId?: string | undefined;
    appId?: string | undefined;
    appName?: string | undefined;
    icon?: string | undefined;
    iconColor?: string | undefined;
    worksheet?: HapApi.MD.Entity.ApkMap.SimpleSheetForApp[] | undefined;
    status: number;
    ctime?: string | undefined;
    createAccount?: HapApi.MD.Entity.Account.EasyAccount | undefined;
  }
  interface SimpleSheetForApp {
    workSheetId?: string | undefined;
    appSectionId?: string | undefined;
    workSheetName?: string | undefined;
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    status: boolean;
    badControl?: HapApi.MD.Entity.ApkMap.BadControl[] | undefined;
    views?: HapApi.MD.Entity.ApkMap.ViewModelForApp[] | undefined;
  }
  interface BadControl {
    controlId?: string | undefined;
    controlName?: string | undefined;
  }
  interface ViewModelForApp {
    viewId?: string | undefined;
    viewName?: string | undefined;
    plugId?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.ApkMap.Upgrade {
  interface UpgradeConfig {
    id?: string | undefined;
    fileName?: string | undefined;
    createTime?: string | undefined;
    apps?: HapApi.MD.Entity.ApkMap.GoodsSimpleModel[] | undefined;
    creater?: HapApi.MD.Entity.Role.AppRoleGrpcModel.UserInfoBase | undefined;
    status: number;
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

declare namespace HapApi.MD.Entity.ExternalPortal.Account {
  interface RoleMemberStatistics {
    roleId?: string | undefined;
    count: number;
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
  interface AppStatusModel {
    appSectionId?: string | undefined;
    workSheetId?: string | undefined;
    type: number;
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
  interface PluginVersion {
    id?: string | undefined;
    versionCode?: string | undefined;
    versionDescription?: string | undefined;
    releaseTime?: string | undefined;
    state?: HapApi.MD.Entity.Plugin.ReleaseState | undefined;
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
  type ReleaseState = 0 | 1 | 2;
  interface CommitContent {
    codeUrl?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.ProjectSetting {
  interface ColorSetting_ThemeColorItem {
    system?: HapApi.MD.Entity.ProjectSetting.ThemeColorItem[] | undefined;
    custom?: HapApi.MD.Entity.ProjectSetting.ThemeColorItem[] | undefined;
  }
  interface ColorSetting_ChartColorItem {
    system?: HapApi.MD.Entity.ProjectSetting.ChartColorItem[] | undefined;
    custom?: HapApi.MD.Entity.ProjectSetting.ChartColorItem[] | undefined;
  }
  interface UserFieldSettings_DisplaySet {
    typeId: number;
    order: number;
    type?: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySetType | undefined;
  }
  type UserFieldSettings_DisplaySetType =
    0 | 1 | 3 | 4 | 5 | 6 | 7 | 8 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60;
  interface ThemeColorItem {
    color?: string | undefined;
    enable: boolean;
  }
  interface ChartColorItem {
    name?: string | undefined;
    colors?: string[] | undefined;
    themeColors?: string[] | undefined;
    enable: boolean;
    id?: string | undefined;
  }
}

declare namespace HapApi.MD.Entity.Role {
  interface PermissionType {
    typeName?: string | undefined;
    typeId: number;
    entityId?: string | undefined;
    entityType: number;
    scopeId?: string | undefined;
    subPermissions?: HapApi.MD.Entity.Role.Permission[] | undefined;
    isAdmin: boolean;
  }
  interface UserRoleDetail {
    accountId?: string | undefined;
    roleId?: string | undefined;
    roleName?: string | undefined;
    originId?: string | undefined;
    originType: HapApi.MD.Entity.Role.OriginType;
    status: HapApi.MD.Enum.UserRoleStatus;
    roleType: HapApi.MD.Entity.Role.RoleType;
    account?: HapApi.MD.Entity.Account.EasyAccount | undefined;
  }
  interface Permission {
    isTypeAdmin: boolean;
    description?: string | undefined;
    permissionName?: string | undefined;
    permissionId: number;
    typeName?: string | undefined;
    typeId: number;
    parentId: number;
    orderId: number;
    entityType: number;
  }
  type OriginType = 0 | 1 | 2 | 99;
  type RoleType = 0 | 1 | 2 | 3 | 4 | 5 | 99;
}

declare namespace HapApi.MD.Entity.Role.AppRoleGrpcModel {
  interface ViewRoleModel {
    roleId?: string | undefined;
    name?: string | undefined;
    view?: HapApi.MD.Entity.Role.AppRoleGrpcModel.ViewPermission | undefined;
    sheet?: HapApi.MD.Entity.Role.AppRoleGrpcModel.SheetPermission | undefined;
    fields?: HapApi.MD.Entity.Role.AppRoleGrpcModel.FieldPermission[] | undefined;
    maxPermissionWayId: number;
  }
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
  interface ViewPermission {
    viewId?: string | undefined;
    viewName?: string | undefined;
    canRead: boolean;
    canEdit: boolean;
    canRemove: boolean;
    type: number;
  }
  interface SheetPermission {
    sheetId?: string | undefined;
    canAdd: boolean;
    readLevel: HapApi.MD.Enum.Roles.AppRole.PermissionLevel;
    editLevel: HapApi.MD.Enum.Roles.AppRole.PermissionLevel;
    removeLevel: HapApi.MD.Enum.Roles.AppRole.PermissionLevel;
  }
  interface FieldPermission {
    fieldId?: string | undefined;
    type: number;
    fieldName?: string | undefined;
    sectionId?: string | undefined;
    userPermission: number;
    notRead: boolean;
    notEdit: boolean;
    notAdd: boolean;
    isDecrypt: boolean;
    dataMask?: string | undefined;
    isReadField: boolean;
    hideWhenAdded: boolean;
    isHide: boolean;
  }
}

declare namespace HapApi.MD.Entity.Role.FormFunc {
  type OPRangeType = 1 | 2 | 3;
}

declare namespace HapApi.MD.Entity.Worksheet {
  interface WorksheetEasy {
    worksheetId?: string | undefined;
    worksheetName?: string | undefined;
    rowIds?: string[] | undefined;
    isCharge?: boolean | undefined;
    status: HapApi.MD.Enum.Worksheet.WSRowStatusEnum;
  }
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
  interface FormComponentModel {
    customeButtons?: HapApi.MD.Entity.Worksheet.ComponentDetail[] | undefined;
    printTempletes?: HapApi.MD.Entity.Worksheet.ComponentDetail[] | undefined;
  }
  interface SwitchPermitModel {
    type: HapApi.MD.Enum.Worksheet.SwitchType;
    state: boolean;
    viewIds?: string[] | undefined;
    displayFlowChart: number;
  }
  interface Worksheet {
    worksheetId?: string | undefined;
    templateId?: string | undefined;
    name?: string | undefined;
    entityName?: string | undefined;
    alias?: string | undefined;
    desc?: string | undefined;
    resume?: string | undefined;
    remark?: string | undefined;
    member?: HapApi.MD.Entity.Role.UserRoleDetail[] | undefined;
    projectId?: string | undefined;
    shareRange: HapApi.MD.Enum.Worksheet.ShareRangeEnum;
    template?: HapApi.MD.Entity.Worksheet.ControlTemplateEntity | undefined;
    controlPermissions?: HapApi.MD.Entity.Worksheet.ControlPermissionsEntity[] | undefined;
    viewIds?: HapApi.MD.Entity.Worksheet.ViewPersonalEntity[] | undefined;
    discussionRowId?: string | undefined;
    downLoadUrl?: string | undefined;
    resultCode: number;
    roleType: number;
    views?: HapApi.MD.Entity.Worksheet.WorksheetViewEntity[] | undefined;
    allowAdd: boolean;
    appId?: string | undefined;
    appName?: string | undefined;
    groupId?: string | undefined;
    iconUrl?: string | undefined;
    icon?: string | undefined;
    publicWorksheetShareId?: string | undefined;
    visibleType: number;
    publicShareUrl?: string | undefined;
    publicWorksheetName?: string | undefined;
    publicDesc?: string | undefined;
    isWorksheetQuery: boolean;
    type: number;
    switches?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
    rowNum: number;
    closeAutoID: boolean;
    viewNull: boolean;
    verificationType: number;
    advancedSetting?: Record<string, string> | undefined;
    openApproval: boolean;
    workflowChildTableSwitch: boolean;
    requestAgain: boolean;
    appTimeZone: number;
    developerNotes?: string | undefined;
  }
  interface AppExtendAttrModel {
    appId?: string | undefined;
    worksheetId?: string | undefined;
    userControlId?: string | undefined;
    extendAttrs?: string[] | undefined;
    extendAndAttrs?: string[] | undefined;
    status: number;
  }
  interface OptionalControl {
    name?: string | undefined;
    id?: string | undefined;
    dataSource?: string | undefined;
  }
  interface WorksheetOperationLogPermissionModel {
    enable: boolean;
    range: HapApi.MD.Entity.Role.FormFunc.OPRangeType;
    allowExport: boolean;
    showRequestTypeFilter: boolean;
    showOperatorFilter: boolean;
  }
  interface WorksheetOpeationLogItem {
    opeartorInfo?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    operatContent?: HapApi.MD.Entity.Worksheet.WorksheetLogEntityOperatContent | undefined;
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
  interface ComponentDetail {
    id?: string | undefined;
    name?: string | undefined;
    btnType: number;
    description?: string | undefined;
  }
  interface WorksheetRowIndexConfig {
    indexConfigId?: string | undefined;
    worksheetId?: string | undefined;
    projectId?: string | undefined;
    customeIndexName?: string | undefined;
    indexFields?: HapApi.MD.Entity.Worksheet.IndexField[] | undefined;
    uniqueIndex: boolean;
    wildcardIndex: boolean;
    sparseIndex: boolean;
    backgroundIndex: boolean;
    indexStateId: number;
    isSystem: boolean;
    systemIndexName?: string | undefined;
    createAccountId?: string | undefined;
    modifyAccountId?: string | undefined;
    createTime?: string | undefined;
    updateTime?: string | undefined;
  }
  interface ControlPermissionsEntity {
    controlId?: string | undefined;
    controlPermissions?: string | undefined;
    isDecrypt?: string | undefined;
  }
  interface ViewPersonalEntity {
    viewId?: string | undefined;
    personalSetting?: string | undefined;
  }
  interface WorksheetLogEntityOperatContent {
    worksheetId?: string | undefined;
    objectId?: string | undefined;
    uniqueId?: string | undefined;
    objectType: number;
    type: number;
    requestType: number;
    createTime?: string | undefined;
    logData?: HapApi.MD.Entity.Worksheet.WorksheetLogItemEntity[] | undefined;
    extendParams?: string[] | undefined;
  }
  interface RuleChildItem {
    isCustom: boolean;
    controlId?: string | undefined;
    childControlIds?: string[] | undefined;
    permission?: string[] | undefined;
    type?: string | undefined;
    value?: string | undefined;
  }
  interface IndexField {
    fieldId?: string | undefined;
    indexType?: string | undefined;
    isSystem: boolean;
    isDelete: boolean;
  }
  interface WorksheetQueryConfig {
    cid?: string | undefined;
    subCid?: string | undefined;
    pid?: string | undefined;
  }
  interface WorksheetLogItemEntity {
    id?: string | undefined;
    name?: string | undefined;
    editType: number;
    type: number;
    oldValue?: string | undefined;
    oldText?: string | undefined;
    newValue?: string | undefined;
    newText?: string | undefined;
    isDeleted: boolean;
  }
}

declare namespace HapApi.MD.Entity.Worksheet.PublicForm {
  interface PublicQueryDomain {
    worksheetId?: string | undefined;
    queryId?: string | undefined;
    viewId?: string | undefined;
    queryControlIds?: string[] | undefined;
    title?: string | undefined;
    worksheetName?: string | undefined;
    visibleType: number;
    worksheet?: HapApi.MD.Entity.Worksheet.Worksheet | undefined;
    url?: string | undefined;
    exported: boolean;
    shareAuthor?: string | undefined;
    projectId?: string | undefined;
    clientId?: string | undefined;
    langInfo?: HapApi.MD.Entity.AppLang.LangInfo | undefined;
  }
  interface LinkSwitchTime {
    isEnable: boolean;
    startTime?: string | undefined;
    endTime?: string | undefined;
    isShowCountDown: boolean;
  }
  interface LimitWriteTime {
    isEnable: boolean;
    monthSetting?: HapApi.MD.Entity.Worksheet.PublicForm.MonthSetting | undefined;
    daySetting?: HapApi.MD.Entity.Worksheet.PublicForm.DaySetting | undefined;
    hourSetting?: HapApi.MD.Entity.Worksheet.PublicForm.HourSetting | undefined;
  }
  interface LimitWriteCountSetting {
    isEnable: boolean;
    limitWriteCount: number;
  }
  interface LimitPasswordWriteSetting {
    isEnable: boolean;
    limitPasswordWrite?: string | undefined;
  }
  interface CacheFieldData {
    isEnable: boolean;
    cacheField?: string[] | undefined;
  }
  interface WeChatSetting {
    onlyWxCollect: boolean;
    isCollectWxInfo: boolean;
    collectChannel: number;
    appId?: string | undefined;
    isRequireAuth: boolean;
    fieldMaps?: Record<string, string> | undefined;
  }
  interface AbilityExpand {
    autoFillField?: HapApi.MD.Entity.Worksheet.PublicForm.AutoFillField | undefined;
    allowViewChange?: HapApi.MD.Entity.Worksheet.PublicForm.AllowViewChange | undefined;
  }
  interface LimitWriteFrequencySetting {
    isEnable: boolean;
    limitRangType: number;
    limitWriteCount: number;
  }
  interface MonthSetting {
    monthType: number;
    defineMonth?: number[] | undefined;
  }
  interface DaySetting {
    dayType: number;
    defineDay?: number[] | undefined;
    defineWeek?: number[] | undefined;
  }
  interface HourSetting {
    hourType: number;
    rangHour?: string[] | undefined;
  }
  interface AutoFillField {
    isAutoFillField: boolean;
    dataSource: number;
    autoFillFields?: string[] | undefined;
  }
  interface AllowViewChange {
    isAllowViewChange: boolean;
    dataSource: number;
    switchViewChange: number;
    changeSetting?: HapApi.MD.Entity.Worksheet.PublicForm.ChangeSetting | undefined;
  }
  interface ChangeSetting {
    changeType: number;
    expireTime: number;
  }
}

declare namespace HapApi.MD.Enum {
  type ProjectIntergrationType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 100;
  type CommonAppShowType = 1 | 2;
  type CommonAppOpenType = 1 | 2;
  type MessageListShowType = 1 | 2;
  type ResultCode =
    | 0
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
    | 50
    | 51
    | 52
    | 53
    | 54
    | 55
    | 56
    | 57
    | 58
    | 59
    | 60
    | 61
    | 62
    | 63
    | 64
    | 65
    | 66
    | 67
    | 68
    | 69
    | 70
    | 71
    | 72
    | 73
    | 74
    | 75
    | 76
    | 77
    | 78
    | 79
    | 80
    | 81
    | 82
    | 83
    | 84
    | 85
    | 86
    | 87
    | 88
    | 89
    | 90
    | 91
    | 92
    | 93
    | 94
    | 95
    | 96
    | 97
    | 98
    | 101
    | 1000
    | 1001
    | 3011
    | 3012
    | 3013
    | 4012
    | 4013
    | 4014
    | 4015
    | 4016
    | 4017
    | 4018
    | 300014
    | 300015
    | 300016;
  type UserStatus = 0 | 1 | 2 | 3 | 4 | 5;
  type LicenseType = 0 | 1 | 2;
  type AccountStatus = 0 | 1 | 2 | 3 | 4 | 5;
  type Gender = 0 | 1 | 2;
  type AccountSourceType = 0 | 1 | 2 | 3 | 4 | 5;
  type AccountContactType = 1 | 2 | 4;
  type ModuleType = 0 | 1 | 2 | 3;
  type UserRoleStatus = 0 | 1 | 2 | 3;
  type GroupStatus = 0 | 1 | 2 | 3 | -1;
  type GroupFollowedStatus = 0 | 1 | 2;
  type GroupUserRole = 0 | 1;
}

declare namespace HapApi.MD.Enum.Account {
  type UserOrgState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

declare namespace HapApi.MD.Enum.ActionLog {
  type OperateTargetType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
  type OperateType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
}

declare namespace HapApi.MD.Enum.Apk {
  type AppSettingsEnum = 1 | 2 | 3 | 4;
  type ApkStatusEnum = 0 | 1 | 2 | 3 | 4 | 11 | 12 | 20;
  type GroupEnum = 0 | 1;
  type DisplayEnum = 0 | 1;
  type MarkedAppDisplay = 0 | 1;
  type TodayDisplayEnum = 0 | 1;
}

declare namespace HapApi.MD.Enum.Calendar {
  type RemindType = 0 | 1 | 2 | 3 | -1;
  type CategroyColor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 99 | 100 | 101 | 102 | 103 | 104 | 105 | 106;
  type MemberType = 0 | 1 | 2 | 3;
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
  type MemberType = 0 | 1 | 2 | 3 | 4 | 5;
  type PermissionLevel = 0 | 20 | 30 | 100;
}

declare namespace HapApi.MD.Enum.Task {
  type TaskExceptionType =
    | 0
    | 5
    | 99
    | 500
    | 501
    | 502
    | 505
    | 600
    | 601
    | 602
    | 603
    | 604
    | 605
    | 1000
    | 1001
    | 30002
    | 40055
    | 40056
    | 40057
    | 40002104
    | 300020001
    | 300020101
    | 300020105
    | 300020201
    | 300020202
    | 300020204
    | 300020206
    | 300020209
    | 400000101
    | 400000103
    | 400000104
    | 400000105
    | 400000106
    | 400000201
    | 400000202
    | 400000204
    | 400000205
    | 400000301
    | 400550001
    | 400550101
    | 400550103
    | 400550105
    | 400550106
    | 400550201
    | 400550202
    | 400550203
    | 400550205
    | 400550207
    | 400550208
    | 400550301
    | 400550401
    | 500000000
    | 500010000
    | 500010102
    | 500020000;
}

declare namespace HapApi.MD.Enum.Worksheet {
  type WSRowStatusEnum = 1 | 9 | 999 | -1;
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
  type SwitchRoleType = 0 | 100;
  type RowIndexFieldType = 0 | 1 | 2 | 3;
}

declare namespace HapApi.MD.Web.Ajax.Enum {
  /** 网络状态 */
  type ProjectStatus = 0 | 1 | 2 | 3 | 4;
  /** 注册返回值 */
  type RegActionResult =
    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 25;
}

declare namespace HapApi.MD.Web.Ajax.ResultModel {
  /** 所有返回列表的Model */
  interface ListModel_ProjectModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.Project.ProjectModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
  interface IdNameMap {
    id?: string | undefined;
    name?: string | undefined;
  }
  /** 所有返回列表的Model */
  interface ListModel_DepartmentModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.Project.DepartmentModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
  /** 所有返回列表的Model */
  interface ListModel_GroupModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.Group.GroupModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
  /** 所有返回列表的Model */
  interface ListModel_JobModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.Project.JobModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
  /** 所有返回列表的Model */
  interface ListModel_UserModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.User.UserModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
  /** 所有返回列表的Model */
  interface ListModel_WorkSiteModel {
    resultCode?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    list?: HapApi.MD.Web.Ajax.ResultModel.Project.WorkSiteModel[] | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    allCount?: number | undefined;
    /** （泛型壳，swagger 里没有，真实响应里有） */
    pageIndex?: number | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Account {
  interface AccountInfoModel {
    /** 账户编号 */
    accountId?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    /** 手机号是否私密 */
    isPrivateMobile?: boolean | undefined;
    /** 邮箱是否私密 */
    isPrivateEmail?: boolean | undefined;
    /** 邮箱是否已经验证 */
    isVerify: boolean;
    /** 是否三方集成账号 */
    isIntergration: boolean;
    /** 是否设置过凭证 */
    isNullCredential: boolean;
    /** 用户部门集合 */
    departments?: string[] | undefined;
    /** 认证类型 */
    authType: number;
    onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | undefined;
    /** （swagger 里没有，真实响应里有） */
    accountStatus?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    grade?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    isHavePrj?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    imQQ?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    snsSina?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    snsQQ?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    snsLinkedin?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    weiXin?: string | undefined;
  }
  interface AccounContacttInfoModel {
    /** 账户编号 */
    accountId?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
  }
  interface AccountSettingModel {
    /** 手机号是否大家可见，false：大家都可见， true：仅自己可见 */
    isPrivateMobile?: boolean | undefined;
    /** 邮箱是否大家可见，false： 大家都可见，true：仅自己可见 */
    isPrivateEmail?: boolean | undefined;
    /** 是否开启两步验证 */
    isTwoauthentication?: boolean | undefined;
    /** 是否开启两步验证(手机号) */
    twoAuthenticationMobilePhoneEnabled?: boolean | undefined;
    /** 是否开启两步验证(邮箱) */
    twoAuthenticationEmailEnabled?: boolean | undefined;
    /** 是否开启两步验证(TOTP) */
    twoAuthenticationTotpEnabled?: boolean | undefined;
    /** 是否开启消息提示音 */
    isOpenMessageSound?: boolean | undefined;
    /** 是否开启消息闪烁 */
    isOpenMessageTwinkle?: boolean | undefined;
    /** 允许多个设备同步登录 */
    allowMultipleDevicesUse: boolean;
    /** 返回首页方式 */
    backHomepageWay: number;
    /** 应用首选语言 */
    appLang?: string | undefined;
    /** 用户最常协作联系人方式 0：默认为系统；1：自定义 */
    addressBookOftenMetioned: number;
    /** 是否显示MingoAI */
    isOpenMingoAI: boolean;
    /** 是否显示消息 此版本暂不允许用户关闭 */
    isOpenMessage: boolean;
    /** 是否显示搜索 */
    isOpenSearch: boolean;
    /** 是否显示收藏 */
    isOpenFavorite: boolean;
    /** 是否显示工具名称 */
    isShowToolName: boolean;
    /** 消息列表 */
    isOpenMessageList: boolean;
    /** 常用应用 */
    isOpenCommonApp: boolean;
    commonAppShowType: HapApi.MD.Enum.CommonAppShowType;
    commonAppOpenType: HapApi.MD.Enum.CommonAppOpenType;
    messageListShowType: HapApi.MD.Enum.MessageListShowType;
    /** （swagger 里没有，真实响应里有） */
    isEmailSystemMsg?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isEmailApps?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    openDeskNotice?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    openWeixinLogin?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isHasWeixin?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    openSettingPanel?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isHasEmail?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isHasPhone?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    joinFriendMode?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    lang?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    map?: number | undefined;
  }
  interface AccountSimpleModel {
    /** 账户Id */
    accountId?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 真实姓名 */
    fullname?: string | undefined;
    /** 原始头像 */
    avatar?: string | undefined;
    /** 公司名称（个人信息） */
    companyName?: string | undefined;
    /** 职业 */
    profession?: string | undefined;
    /** 是否手机号 不可见 */
    isPrivateMobile?: boolean | undefined;
    /** 是否邮箱 不可见 */
    isPrivateEmail?: boolean | undefined;
    /** 是否是当前用户的联系人 */
    isContact: boolean;
    accountStatus: HapApi.MD.Enum.AccountStatus;
    /** 当前 组织名称 */
    currentProjectName?: string | undefined;
    /** 当前 组织主部门名称 */
    currentDepartmentName?: string | undefined;
    /** 当前 组织主部门全称 */
    currentDepartmentFullName?: string | undefined;
    /** 当前 组织主部门Id */
    currentDepartmentId?: string | undefined;
    /** 当前 组织职位 */
    currentJobTitleName?: string | undefined;
    /** 当前 组织工号 */
    currentJobNumber?: string | undefined;
    /** 当前 组织工作地点 */
    currentWorkSiteName?: string | undefined;
    /** 当前 组织工作电话 */
    currentWorkPhone?: string | undefined;
    /** 外部用户 配置字段值 */
    portalValues?: HapApi.System.Collections.Generic.KeyValuePair_String_String[] | undefined;
    /** 名片层 资料显示 字段 */
    cardSetList?: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySet[] | undefined;
    displayFieldForName: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySetType;
    onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | undefined;
    /** 部门信息 */
    departmentInfos?: HapApi.MD.Web.Ajax.ResultModel.Project.DepartmentModel[] | undefined;
    /** 职位信息 */
    jobInfos?: HapApi.MD.Web.Ajax.ResultModel.Project.JobModel[] | undefined;
  }
  /** 获取用户在组织中的状态 */
  interface GetUserOrgStateResponse {
    userState: HapApi.MD.Enum.Account.UserOrgState;
    /** 用户Id */
    accountId?: string | undefined;
    /** 姓名 */
    name?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
    /** 手机号 */
    phone?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    userCardModel?: HapApi.MD.Web.Ajax.ResultModel.User.UserCardModel | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.ActionLog {
  /** 用户日志列表 */
  interface ActionLogListWithTotalCountModel {
    /** 分页返回用户日志点列表 */
    list?: HapApi.MD.Entity.ActionLog[] | undefined;
    /** 查询结果的节点总数 */
    totalCount?: number | undefined;
  }
  /** 组织日志列表 */
  interface OrgLogListWithTotalCountModel {
    /** 分页返回用户日志点列表 */
    list?: HapApi.MD.Entity.OrgLog[] | undefined;
    /** 查询结果的节点总数 */
    totalCount?: number | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.App {
  /** 网络应用列表 */
  interface ProjectAppsModel {
    /** 应用列表 */
    apps?: HapApi.MD.Entity.Apk.AppForProjectModel[] | undefined;
    /** 当前应用总数 */
    total: number;
    /** 当前工作表总数 */
    count: number;
    /** 版本工作表最大数量  为0=无限制 */
    maxCount: number;
  }
  interface AppLogDto {
    logs?: HapApi.MD.Web.Ajax.ResultModel.App.LogModel[] | undefined;
    total: number;
  }
  interface GetAppSupportInfo {
    /** 应用项总数 */
    appItemTotal: number;
    /** 记录总数 */
    rowTotal: number;
  }
  /** 获取应用有效备份文件信息响应模型 */
  interface GetValidBackupFileInfoResponse {
    /** 有效备份文件数量上限 */
    validLimit: number;
    /** 当前有效备份文件数量 */
    currentValid: number;
    /** 定时备份任务状态（0 = 关闭，1 = 开启） */
    backupTaskStatus: number;
  }
  interface GetUpgradeLogsByProjectDto {
    /** 升级记录 */
    records?: HapApi.MD.Entity.ApkMap.Upgrade.UpgradeConfig[] | undefined;
    /** 总数 */
    total: number;
  }
  interface AppStructureDto {
    worksheetId?: string | undefined;
    worksheetName?: string | undefined;
    controls?: HapApi.MD.Web.Ajax.ResultModel.App.ControlStructureDto[] | undefined;
    /** 所属分组id */
    sectionId?: string | undefined;
    /** 所属二级分组 */
    childSectionId?: string | undefined;
  }
  interface BackupTaskDto {
    appId?: string | undefined;
    /** 周期类型 (1= 每天，2 = 每周，3 = 每月) */
    cycleType: number;
    /** 具体周期值 （几号，星期几） */
    cycleValue: number;
    /** 状态 0=关闭，1 = 开启 */
    status: number;
    /** 备份数据 */
    datum: boolean;
  }
  /** 分页获取应用回收站记录响应模型 */
  interface GetAppCoveryRecordResponse {
    /** 记录id */
    id?: string | undefined;
    /** 应用id */
    appId?: string | undefined;
    /** 应用名称 */
    appName?: string | undefined;
    /** icon */
    iconUrl?: string | undefined;
    /** iconColor */
    iconColor?: string | undefined;
    /** 工作表数量 */
    wsCount: number;
    deletePerson?: HapApi.MD.Entity.Account.EasyAccount | undefined;
    /** 删除时间 */
    deleteTime?: string | undefined;
  }
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
  interface AppApiDto {
    apiRequest?: HapApi.MD.Web.Ajax.ResultModel.App.ApiRequestDemo | undefined;
    requestMethod?: string | undefined;
    /** 请求url */
    apiUrl?: string | undefined;
    apiResponse?: HapApi.MD.Entity.Apk.OpenAppModel | undefined;
  }
  interface MyAppDto {
    /** 星标应用 */
    markedApps?: HapApi.MD.Web.Ajax.ResultModel.App.AppBaseDto[] | undefined;
    /** 外部应用 */
    externalApps?: HapApi.MD.Web.Ajax.ResultModel.App.AppBaseDto[] | undefined;
    /** 个人应用（没有网络id的） */
    aloneApps?: HapApi.MD.Web.Ajax.ResultModel.App.AppBaseDto[] | undefined;
    /** 星标分组ids */
    markedGroupIds?: string[] | undefined;
    /** 所有应用 */
    apps?: HapApi.MD.Web.Ajax.ResultModel.App.AppBaseDto[] | undefined;
    /** 个人分组 */
    personalGroups?: HapApi.MD.Web.Ajax.ResultModel.App.AppGroupDto[] | undefined;
    /** 网络分组 */
    projectGroups?: HapApi.MD.Web.Ajax.ResultModel.App.AppGroupDto[] | undefined;
    /** 是否有编辑组织分组的权限 */
    isPermission: boolean;
    homeSetting?: HapApi.MD.Web.Ajax.ResultModel.App.HomeSettingDto | undefined;
    /** 最近使用的应用ids（ids已排序） */
    recentAppIds?: string[] | undefined;
  }
  interface AppBaseDto {
    /** 网络id */
    projectId?: string | undefined;
    /** 网络名称 */
    projectName?: string | undefined;
    /** 应用id */
    id?: string | undefined;
    /** 名称 */
    name?: string | undefined;
    /** 英文名称 */
    enName?: string | undefined;
    icon?: string | undefined;
    iconColor?: string | undefined;
    iconUrl?: string | undefined;
    /** 背景色 */
    lightColor?: string | undefined;
    /** 导航栏颜色 */
    navColor?: string | undefined;
    /** 是否标记 */
    isMarked: boolean;
    avatarType: number;
    permissionType?: HapApi.MD.Enum.Roles.AppRole.AppRoleType | undefined;
    /** 商品包id */
    goodsId?: string | undefined;
    /** 是否锁定 */
    isLock: boolean;
    /** 是否是通过商品包分发 */
    isGoods: boolean;
    /** 是否有效 */
    isGoodsStatus: boolean;
    /** 是否是新应用 */
    isNew: boolean;
    /** 显示方式 */
    appNaviStyle: number;
    /** 是否维护中 */
    fixed: boolean;
    /** Pc端显示, */
    pcDisplay: boolean;
    /** web移动端显示 */
    webMobileDisplay: boolean;
    /** app端显示 */
    appDisplay: boolean;
    pcNaviStyle: number;
    /** 应用所属分组ids */
    groupIds?: string[] | undefined;
    /** 来源类型 */
    sourceType: number;
    /** 创建类型 */
    createType: number;
    /** url模板 */
    urlTemplate?: string | undefined;
    /** 链接配置 */
    configuration?: Record<string, string> | undefined;
    /** 导航默认选中配置 */
    selectAppItmeType: number;
    appStatus: number;
    exported: boolean;
  }
  interface HomePlatformSettingDto {
    /** 组织id */
    projectId?: string | undefined;
    /** 宣传栏 */
    bulletinBoards?: HapApi.MD.Web.Ajax.ResultModel.App.BulletinBoardDto[] | undefined;
    /** 颜色 */
    color?: string | undefined;
    /** 标语 */
    slogan?: string | undefined;
    /** 组织logo */
    logo?: string | undefined;
    /** logo开关 */
    logoSwitch: boolean;
    /** 宣传栏目开关 */
    boardSwitch: boolean;
    /** logo高度 */
    logoHeight: number;
    advancedSetting?: Record<string, string> | undefined;
  }
  interface LogModel {
    id?: string | undefined;
    /** 操作类型 1=创建 2=开启 3=关闭 4=删除 5=导出 6=导入 */
    handleType: number;
    /** 日志消息 */
    message?: string | undefined;
    appItem?: HapApi.MD.Entity.Apk.AppItem | undefined;
    /** 应用名称 */
    appNames?: string[] | undefined;
    /** 创建时间 */
    createTime?: string | undefined;
    operator?: HapApi.MD.Entity.Account.AccountFullInfo | undefined;
  }
  interface ControlStructureDto {
    controlId?: string | undefined;
    controlName?: string | undefined;
    type: number;
    dataSource?: string | undefined;
    sourceControlId?: string | undefined;
    enumDefault: number;
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
  interface ApiRequestDemo {
    /** AppKey */
    appKey?: string | undefined;
    /** 签名 */
    sign?: string | undefined;
  }
  interface AppGroupDto {
    /** 分组id */
    id?: string | undefined;
    groupType: HapApi.MD.Enum.Apk.GroupEnum;
    /** 是否标记 */
    isMarked: boolean;
    /** 分组名称 */
    name?: string | undefined;
    /** 英文名称 */
    enName?: string | undefined;
    icon?: string | undefined;
    iconUrl?: string | undefined;
    /** 当前分组下应用数量 */
    count: number;
    /** 分组下应用Ids */
    appIds?: string[] | undefined;
    /** 分组下应用 */
    apps?: HapApi.MD.Web.Ajax.ResultModel.App.AppBaseDto[] | undefined;
  }
  interface HomeSettingDto {
    displayType: HapApi.MD.Enum.Apk.DisplayEnum;
    markedAppDisplay: HapApi.MD.Enum.Apk.MarkedAppDisplay;
    todoDisplay: HapApi.MD.Enum.Apk.TodayDisplayEnum;
    /** 是否显示外部应用 */
    exDisplay: boolean;
    /** 是否显示常用应用 */
    displayCommonApp: boolean;
    /** 是否开启全部和组织分组 */
    isAllAndProject: boolean;
    /** 是否显示星标应用 */
    displayMark: boolean;
    /** 记录收藏 */
    rowCollect: boolean;
    /** 左侧菜单栏是否显示应用 */
    displayApp: boolean;
    /** 图表收藏开关 */
    displayChart: boolean;
    /** 排序项 */
    sortItems?: HapApi.MD.Web.Ajax.ResultModel.App.PlatformSortItemDto[] | undefined;
  }
  interface BulletinBoardDto {
    id?: string | undefined;
    /** 图片链接 */
    url?: string | undefined;
    /** 文件域 */
    bucket: number;
    /** 文件key（不包域名的路径） */
    key?: string | undefined;
    /** 链接 */
    link?: string | undefined;
    /** 标题 */
    title?: string | undefined;
    /** 主题key */
    themeKey?: string | undefined;
  }
  interface GetDto_SelectedRole {
    roleId?: string | undefined;
    name?: string | undefined;
    roleType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
  }
  interface PlatformSortItemDto {
    moduleType: HapApi.MD.Enum.ModuleType;
    /** 行序号 */
    row: number;
    /** 列序号 */
    col: number;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.App.AppRole {
  /** 分页获取 所有成员 */
  interface GetTotalMemberResult {
    /** 成员信息集 */
    memberModels?: HapApi.MD.Web.Ajax.ResultModel.App.AppRole.MemberInfoModel[] | undefined;
    /** 总成员数量 */
    totalCount: number;
    /** 用户数量 */
    userCount: number;
    /** 部门数量 */
    departementCount: number;
    /** 组织角色数量 */
    organizeRoleCount: number;
    /** 职位数量 */
    jobCount: number;
  }
  /** 分页获取 外协成员 */
  interface GetOutsourcingMembersResult {
    /** 成员信息集 */
    memberModels?: HapApi.MD.Web.Ajax.ResultModel.App.AppRole.MemberInfoModel[] | undefined;
    /** 成员总数 */
    totalCount: number;
  }
  /** 获取 应用角色概要 */
  interface GetAppRoleSummaryResult {
    /** 角色信息集 */
    roleInfos?: HapApi.MD.Web.Ajax.ResultModel.App.AppRole.RoleInfo[] | undefined;
    /** 限制只能加人（true = 限制，false = 不限制） */
    limitState: boolean;
    /** 人数上限 */
    maxCount: number;
    /** 当前人数 */
    currentCount: number;
  }
  interface GetDebugRolesResult {
    roles?: HapApi.MD.Web.Ajax.ResultModel.App.AppRole.GetDebugRolesResult_RoleShortInfo[] | undefined;
  }
  /** 根据角色 分页获取成员集合 */
  interface GetMembersByRoleResult {
    /** 是否 可以 设置 角色成员（设置 含：添加/删除/移动 成员） */
    canSetMembers: boolean;
    /** 成员信息集 */
    memberModels?: HapApi.MD.Web.Ajax.ResultModel.App.AppRole.MemberInfoModel[] | undefined;
    /** 总成员数量 */
    totalCount: number;
    /** 用户数量 */
    userCount: number;
    /** 部门数量 */
    departementCount: number;
    /** 组织角色数量 */
    organizeRoleCount: number;
    /** 职位数量 */
    jobCount: number;
  }
  /** 成员信息模型 */
  interface MemberInfoModel {
    /** Id */
    id?: string | undefined;
    /** 名称 */
    name?: string | undefined;
    /** 是否 角色负责人 */
    isRoleCharger: boolean;
    /** 是否拥有者 */
    isOwner: boolean;
    /** 是否是 管理员 */
    isManager: boolean;
    /** 用户头像（仅成员类型有） */
    avatar?: string | undefined;
    memberType: HapApi.MD.Enum.Roles.AppRole.MemberType;
    /** 角色名称 */
    roleName?: string[] | undefined;
    /** 添加人 */
    operater?: string | undefined;
    /** 添加时间 */
    operateTime?: string | undefined;
  }
  /** 应用角色信息 */
  interface RoleInfo {
    /** 应用角色Id */
    roleId?: string | undefined;
    /** 角色名称 */
    name?: string | undefined;
    /** 角色描述 */
    description?: string | undefined;
    roleType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
    /** 总成员数量 */
    totalCount: number;
    /** 用户数量 */
    userCount: number;
    /** 部门数量 */
    departementCount: number;
    /** 组织角色数量 */
    organizeRoleCount: number;
    /** 职位数量 */
    jobCount: number;
    /** 创建时间 */
    createTime?: string | undefined;
    /** 是否我的角色 */
    isMyRole: boolean;
    /** 代表当前用户 是否可 设置该角色的成员（包含：新增/移除/移动 成员） */
    canSetMembers: boolean;
    /** 角色下成员隐藏应用 */
    hideAppForMembers: boolean;
  }
  interface GetDebugRolesResult_RoleShortInfo {
    roleId?: string | undefined;
    name?: string | undefined;
    roleType: HapApi.MD.Enum.Roles.AppRole.AppRoleType;
    /** 已选择 的模拟角色 */
    seleted: boolean;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.App.ExternalPortal {
  /** 获取 用户协议 */
  interface UserAgreementResult {
    /** 门户定制名称 */
    customizeName?: string | undefined;
    /** AppLogo Url */
    appLogoUrl?: string | undefined;
    /** AppColor */
    appColor?: string | undefined;
    /** LogoImage Url */
    logoImageUrl?: string | undefined;
    /** 修改日期 */
    updateTime?: string | undefined;
    /** 用户协议 */
    userAgreement?: string | undefined;
  }
  /** 获取 隐私条款 */
  interface PrivacyTermsResult {
    /** 门户定制名称 */
    customizeName?: string | undefined;
    /** AppLogo Url */
    appLogoUrl?: string | undefined;
    /** AppColor */
    appColor?: string | undefined;
    /** LogoImage Url */
    logoImageUrl?: string | undefined;
    /** 修改日期 */
    updateTime?: string | undefined;
    /** 隐私条款 */
    privacyTerms?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Application {
  /** 应用实体 */
  interface ApplicationModel {
    /** 应用id */
    appId?: string | undefined;
    /** 应用名称 */
    appName?: string | undefined;
    /** 简介 */
    about?: string | undefined;
    /** 图标 */
    avatar?: string | undefined;
    /** 图标地址 */
    avatarUrl?: string | undefined;
    /** 应用地址 */
    appUrl?: string | undefined;
    /** 回调地址 */
    callbackUrl?: string | undefined;
    /** AppKey */
    appKey?: string | undefined;
    /** AppSecret */
    appSecret?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Attachment {
  interface GetAttachmentTotalDto {
    /** 状态，0 = 数据计算中，1 = 正常 */
    code: number;
    /** 总量 */
    total: number;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Chat {
  interface CardDetailsModel {
    posts?: ApiPayload[] | undefined;
    tasks?: HapApi.MD.Web.Ajax.ResultModel.Chat.TaskCardDetailModel[] | undefined;
    calendars?: HapApi.MD.Web.Ajax.ResultModel.Chat.CalendarCardModel[] | undefined;
    kcFiles?: HapApi.MD.Web.Ajax.ResultModel.Chat.KcFileModel[] | undefined;
    worksheets?: HapApi.MD.Web.Ajax.ResultModel.Chat.WorksheetCardModel[] | undefined;
    worksheetRows?: HapApi.MD.Web.Ajax.ResultModel.Chat.WorksheetRowCardModel[] | undefined;
  }
  /** 任务卡片详情实体 */
  interface TaskCardDetailModel {
    charge?: HapApi.MD.Web.Ajax.ResultModel.Chat.CardAccountModel | undefined;
    /** 子任务已完成数 */
    completedNum: number;
    /** 任务到期日期 */
    deadline?: string | undefined;
    /** 所属项目ID */
    folderId?: string | undefined;
    /** 所属项目名称 */
    folderName?: string | undefined;
    /** 是否锁定 */
    locked: boolean;
    /** 任务成员 */
    members?: HapApi.MD.Web.Ajax.ResultModel.Chat.CardAccountModel[] | undefined;
    /** 网络ID */
    projectId?: string | undefined;
    /** 任务状态 1: 完成 0: 未完成 */
    status: boolean;
    /** 子任务数 */
    subCount: number;
    /** 任务描述 */
    summary?: string | undefined;
    /** 任务ID */
    taskId?: string | undefined;
    /** 任务名称 */
    taskName?: string | undefined;
    /** 任务讨论数 */
    topicCount: number;
  }
  interface CalendarCardModel {
    id?: string | undefined;
    eventID?: string | undefined;
    locked: boolean;
    isChildCalendar: boolean;
    editable: boolean;
    catID?: string | undefined;
    catName?: string | undefined;
    remindTime: number;
    remindType: HapApi.MD.Enum.Calendar.RemindType;
    isContain: boolean;
    color: HapApi.MD.Enum.Calendar.CategroyColor;
    title?: string | undefined;
    description?: string | undefined;
    address?: string | undefined;
    start?: string | undefined;
    end?: string | undefined;
    oldStartTime?: string | undefined;
    oldEndTime?: string | undefined;
    allDay: boolean;
    isRecur: boolean;
    recurTime?: string | undefined;
    frequency: number;
    interval: number;
    recurCount: number;
    untilDate?: string | undefined;
    recurType?: string | undefined;
    weekDay?: string | undefined;
    createUser?: HapApi.MD.Web.Ajax.ResultModel.Chat.CalendarCardAccountModel | undefined;
    members?: HapApi.MD.Web.Ajax.ResultModel.Chat.CalendarCardAccountModel[] | undefined;
    attachments?: ApiPayload[] | undefined;
    canLook: boolean;
    isPrivate: boolean;
  }
  /** 知识中心文件 chat 卡片 */
  interface KcFileModel {
    /** 知识节点 Id */
    id?: string | undefined;
    /** 文件名 */
    name?: string | undefined;
    /** 是否有查看权限，没有的话结果只有 Id 和文件名 */
    hasPermission: boolean;
    /** 预览图地址 */
    previewUrl?: string | undefined;
    /** 新页面打开地址 */
    shareUrl?: string | undefined;
    /** 下载地址，如果为空则不能下载 */
    downloadUrl?: string | undefined;
  }
  /** 工作表卡片实体 */
  interface WorksheetCardModel {
    /** 工作表Id */
    worksheetId?: string | undefined;
    /** 工作表名称 */
    name?: string | undefined;
  }
  /** 工作表记录卡片实体 */
  interface WorksheetRowCardModel {
    /** 所属工作表 Id */
    worksheetId?: string | undefined;
    /** 行 Id */
    rowId?: string | undefined;
    /** 行标题 */
    name?: string | undefined;
    /** 行标题名称 */
    entityName?: string | undefined;
    owner?: HapApi.MD.Web.Ajax.ResultModel.Chat.CardAccountModel | undefined;
  }
  interface CardAccountModel {
    accountId?: string | undefined;
    avatar?: string | undefined;
    fullname?: string | undefined;
    email?: string | undefined;
    mobile?: string | undefined;
  }
  interface CalendarCardAccountModel {
    accountId?: string | undefined;
    avatar?: string | undefined;
    fullname?: string | undefined;
    email?: string | undefined;
    mobile?: string | undefined;
    memberType: HapApi.MD.Enum.Calendar.MemberType;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.DataLimit {
  interface AttachmentSettingDto {
    projectId?: string | undefined;
    /** 状态，0 = 关闭，1 = 开启 */
    status: number;
    /** 限制方式( 0 = 全部，1 = 移动端（H5）) */
    limitType: number;
    /** 白名单 */
    whiteList?: HapApi.MD.Web.Ajax.ResultModel.DataLimit.LimitWhiteListDto[] | undefined;
    /** 策略类型（默认0） 0 = 客户端，1 = IP */
    modelType: number;
    /** 使用类型，0 = 是，1= 不是 */
    useType: number;
    /** IP列表 */
    ipList?: string[] | undefined;
  }
  interface GetListPageDto {
    /** 单个附件上传量 */
    attachmentSingleLimit?: Record<string, number> | undefined;
    /** 行记录量 (key:组织总量，value：单个表限制量) */
    rowLimit?: Record<string, number> | undefined;
    /** 附件用量 */
    attachmentLimit?: Record<string, number> | undefined;
  }
  /** 获取行数限制返回实体 */
  interface GetLimitRowTotalDto {
    /** 单表行记录上限 */
    limitWorksheetRowCount: number;
    /** 组织总表记录上限 */
    limitAllWorksheetRowCount: number;
  }
  interface LimitWhiteListDto {
    /** id */
    id?: string | undefined;
    /** 类型 1= 成员，2 = 部门，3 = 组织角色 */
    sourceType: number;
    /** 名称 */
    name?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Departments {
  interface SearchDeptAndUserListModel {
    /** 用户 */
    users?: HapApi.MD.Web.Ajax.ResultModel.Departments.SearchDeptAndUserListModel_ShortUser[] | undefined;
    /** 部门 */
    departments?: HapApi.MD.Web.Ajax.ResultModel.Departments.SearchDeptAndUserListModel_ShortDepartment[] | undefined;
  }
  interface ShortDepartmentAndUsersModel {
    /** 部门成员信息 */
    members?: HapApi.MD.Web.Ajax.ResultModel.Departments.ShortDepartmentAndUsersModel_Short2User[] | undefined;
    /** 下及部门信息 */
    subDepts?: HapApi.MD.Web.Ajax.ResultModel.Departments.ShortDepartmentAndUsersModel_Short2Department[] | undefined;
  }
  interface SearchDeptAndUserListModel_ShortUser {
    /** 用户ID */
    accountId?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
    /** 名称 */
    fullname?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 工作地点名称 */
    workSiteName?: string | undefined;
    /** 工号 */
    jobNumber?: string | undefined;
    /** 职位 列表 */
    jobs?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap[] | undefined;
    /** 部门 列表 */
    departments?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap[] | undefined;
    orgRoles?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap[] | undefined;
    isPrivateEmail?: boolean | undefined;
    isPrivateMobile?: boolean | undefined;
    /** 加入网络时间 */
    addProjectTime?: string | undefined;
  }
  interface SearchDeptAndUserListModel_ShortDepartment {
    /** 部门Id */
    id?: string | undefined;
    /** 部门名称 */
    name?: string | undefined;
    /** 是否 停用 */
    disabled: boolean;
    parent?: HapApi.MD.Web.Ajax.ResultModel.Departments.SearchDeptAndUserListModel_ShortDepartment | undefined;
    /** 子部门集 */
    subs?: HapApi.MD.Web.Ajax.ResultModel.Departments.SearchDeptAndUserListModel_ShortDepartment[] | undefined;
  }
  interface ShortDepartmentAndUsersModel_Short2User {
    /** 用户ID */
    accountId?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
    /** 名称 */
    fullname?: string | undefined;
    job?: string | undefined;
    department?: string | undefined;
    onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | undefined;
  }
  interface ShortDepartmentAndUsersModel_Short2Department {
    /** 部门Id */
    id?: string | undefined;
    /** 部门名称 */
    name?: string | undefined;
  }
  interface DepartmentJobModel {
    department?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap | undefined;
    jobs?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap[] | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.ExternalPortal {
  interface GetViewShowControlsDto {
    /** 控件信息，全字段 */
    controls?: import('src/utils/controlTypes').FormControl[] | undefined;
    /** 显示的控件id */
    showControlIds?: string[] | undefined;
  }
  /** 获取外部用户分类数量 */
  interface GetExAccountCategoryCountResult {
    /** （未激活、正常、停用）用户数 */
    commonCount: number;
    /** （待审核）用户数 */
    unApproveCount: number;
    /** 角色成员统计集合 */
    roleMemberStatistics?: HapApi.MD.Entity.ExternalPortal.Account.RoleMemberStatistics[] | undefined;
  }
  interface GetUsersDto {
    /** 列表 */
    users?: HapApi.MD.Web.Ajax.ResultModel.ExternalPortal.GetUsersChildDto[] | undefined;
    /** 人员列表总数 */
    total: number;
    /** 版本最大数量 */
    maxCount: number;
  }
  interface GetAppInfoByProjectDto {
    apps?: HapApi.MD.Web.Ajax.ResultModel.ExternalPortal.GetByProjectChildDto[] | undefined;
    total: number;
  }
  interface GetUsersChildDto {
    /** 用户id */
    accountId?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    /** 用户名 */
    name?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
    /** 应用ID */
    appId?: string | undefined;
    /** 应用名称 */
    appName?: string | undefined;
    /** 注册时间 */
    createTime?: string | undefined;
    /** 最近登录时间 */
    lastTime?: string | undefined;
  }
  interface GetByProjectChildDto {
    appId?: string | undefined;
    appName?: string | undefined;
    color?: string | undefined;
    iconUrl?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Group {
  /** 通用邀请群组搜索 */
  interface GroupSearchModel {
    /** 常协作群组 */
    sharedGroups?: HapApi.MD.Web.Ajax.ResultModel.Group.GroupModel[] | undefined;
    normalGroups?: HapApi.MD.Web.Ajax.ResultModel.ListModel_GroupModel | undefined;
  }
  /** 群组 */
  interface GroupModel {
    /** 匹配群组成员总数 */
    matchedMemberCount: number;
    /** 有效成员数量 */
    groupUserCount: number;
    /** （swagger 里没有，真实响应里有） */
    groupId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    name?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    firstCode?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    avatar?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    projectId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    createTime?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    status?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    groupMemberCount?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    postCount?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    isVerified?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isCertificated?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isMember?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isAdmin?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isOpen?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isApproval?: boolean | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Kc {
  /** 知识中心使用情况 */
  interface KcUsageModel {
    /** 本期已用上传流量 */
    used?: number | undefined;
    /** 本期总共可用上传流量 */
    total?: number | undefined;
    /** 本期流量计算起始时间 */
    periodStart?: string | undefined;
    /** 使用应用限制 */
    usageAppLimit: boolean;
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

declare namespace HapApi.MD.Web.Ajax.ResultModel.Organize {
  interface OrgRoleGroupModel {
    orgRoleGroupId?: string | undefined;
    orgRoleGroupName?: string | undefined;
    sortIndex: number;
    disabled: boolean;
  }
  interface OrganizeAccountMaps {
    maps?: HapApi.MD.Web.Ajax.ResultModel.Organize.OrganizeAccountMap[] | undefined;
  }
  interface OrganizeAccountMap {
    accountId?: string | undefined;
    organizes?: HapApi.MD.Web.Ajax.ResultModel.Organize.Organize[] | undefined;
  }
  interface Organize {
    id?: string | undefined;
    name?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Personals {
  interface PeronsalStatusModelList {
    onStatusOptions?: HapApi.MD.Web.Ajax.ResultModel.Personals.OnPStatusOption[] | undefined;
  }
  interface PeronsalStatusModel {
    onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | undefined;
    /** 可选的 自定义的 状态项 */
    statusOptions?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption[] | undefined;
  }
  interface PStatusOption {
    /** Id */
    statusId?: string | undefined;
    /** 图标 */
    icon?: string | undefined;
    /** 备注 */
    remark?: string | undefined;
    /** 起始时间 */
    beginTime?: string | undefined;
    /** 结束时间 */
    endTime?: string | undefined;
    durationOption: HapApi.MD.BasicService.Duration_Option;
    /** （swagger 里没有，真实响应里有） */
    accountId?: string | undefined;
  }
  interface OnPStatusOption {
    /** Id */
    statusId?: string | undefined;
    /** 图标 */
    icon?: string | undefined;
    /** 备注 */
    remark?: string | undefined;
    /** 起始时间 */
    beginTime?: string | undefined;
    /** 结束时间 */
    endTime?: string | undefined;
    durationOption: HapApi.MD.BasicService.Duration_Option;
    /** 用户Id */
    accountId?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Plugin {
  interface GetAllResponse {
    /** 我创建的 */
    myPlugins?: HapApi.MD.Entity.Plugin.PluginModel[] | undefined;
    /** 组织插件 */
    orgPlugins?: HapApi.MD.Entity.Plugin.PluginModel[] | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Project {
  /** 部门 */
  interface DepartmentModel {
    /** 是否 停用 */
    disabled: boolean;
    /** （swagger 里没有，真实响应里有） */
    departmentId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    departmentName?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    userCount?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    haveSubDepartment?: boolean | undefined;
  }
  interface AccountDepartmentsModel {
    maps?: HapApi.MD.Web.Ajax.ResultModel.Project.AccountDepartmentsMap[] | undefined;
  }
  /** project 的总人数，以及没有加入任何部门成员详情 */
  interface ProjectRootDepartmentModel {
    listUser?: HapApi.MD.Web.Ajax.ResultModel.ListModel_UserModel | undefined;
    /** 网络总人数 */
    totalMembers: number;
  }
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
  interface GetProjectInfoModel {
    /** 组织ID */
    projectId?: string | undefined;
    /** 组织名称，只在发票抬头用，其他地方用 companyDisplayName */
    companyName?: string | undefined;
    /** 英文名 */
    companyNameEnglish?: string | undefined;
    /** 呈现名称 */
    companyDisplayName?: string | undefined;
    /** (地理位置)国家地区-编码 */
    geoCountryRegionCode?: string | undefined;
    /** 国家地区名称 */
    geoCountryRegionName?: string | undefined;
    /** 时区偏好 */
    timeZone?: string | undefined;
    timeZoneName?: string | undefined;
    privacyModel?: HapApi.MD.Web.Ajax.ResultModel.Project.GetPrivacyModel | undefined;
    /** 地区 */
    geographyId?: number | undefined;
    /** 行业 */
    industryId?: number | undefined;
    /** 企业认证类型 */
    authType: number;
    projectStatus: HapApi.MD.Web.Ajax.Enum.ProjectStatus;
  }
  /** 组织资源限制信息（限额 + 当前用量） */
  interface ProjectLimitationModel {
    /** 组织ID */
    projectId?: string | undefined;
    /** 工作表数量上限（来源于授权 ProjectWorktableLimitNumber，专业版/旗舰版为 int.MaxValue） */
    limitWorksheetCount: number;
    /** 当前组织下已有的工作表数量 */
    effectiveWorksheetCount: number;
  }
  /** 二级域名首页信息 */
  interface ProjectSubDomainModel {
    /** 网络Id */
    projectId?: string | undefined;
    /** 网络名称 */
    companyName?: string | undefined;
    /** 二级域名背景图 */
    homeImage?: string | undefined;
    /** 是否默认Logo（代表未设置Logo） */
    isDefaultLogo: boolean;
    /** 企业Logo */
    logo?: string | undefined;
    /** 是否开启了LDAP */
    openLDAP: boolean;
    /** Ldap 自定义显示名称 */
    ldapName?: string | undefined;
    /** Ldap 自定义显示名称 */
    ldapIcon?: string | undefined;
    /** 是否隐藏注册入口 */
    hideRegister: boolean;
    /** 是否开启平台登录 */
    isOpenSystemLogin: boolean;
    /** 登录账户显示名称 类型（10=用户名、12=手机号、13=邮箱、100=自定义） */
    accountTxtType: number;
    /** 登录账户显示名称 自定义值（自定义 类型时的 值） */
    accountTxt?: string | undefined;
    /** 是否是国外lark */
    isLark: boolean;
    /** （swagger 里没有，真实响应里有） */
    projectIntergrationType?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    intergrationScanEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    entraOnlyLogin?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    isOpenSso?: boolean | undefined;
  }
  /** 网络设置 */
  interface ProjectSettingModel {
    /** 是否默认Logo（代表未设置Logo） */
    isDefaultLogo: boolean;
    /** 企业账号 */
    regCode?: string | undefined;
    balance?: number | undefined;
    /** （swagger 里没有，真实响应里有） */
    logo?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    homeImage?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    allowStructureSelfEdit?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    onlyManagerCreateApp?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    autoPurchaseWorkflowExtPack?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    enabledWatermark?: boolean | undefined;
  }
  interface GetPrivacyModel {
    /** 企业账号 */
    regCode?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    userAuditEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    userFillCompanyEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    userFillWorkSiteEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    userFillJobNumberEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    userFillDepartmentEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    userFillJobEnabled?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    allowProjectCodeJoin?: boolean | undefined;
  }
  interface GetStructureForAllModel {
    /** 允许全员可见组织结构 */
    allowStructureForAll?: boolean | undefined;
    /** 是否允许 员工自行添加下属 */
    allowStructureSelfEdit: boolean;
  }
  /** 是否允许自动订购工作流执行数 */
  interface AutoPurchaseWorkflowExtPackModel {
    /** 是否 自动订购工作流升级包 */
    autoPurchaseWorkflowExtPack: boolean;
    balance?: number | undefined;
  }
  /** 是否允许自动订购数据集成 */
  interface AutoPurchaseDataPipelineExtPackModel {
    /** 是否 自动订购数据集成升级包 */
    autoPurchaseDataPipelineExtPack: boolean;
    balance?: number | undefined;
  }
  /** 是否允许自动订购外部门户用户额度扩充包 */
  interface AutoPurchaseExternalUserExtPackModel {
    /** 是否 自动订购外部门户用户额度扩充包 */
    autoPurchaseExternalUserExtPack: boolean;
    balance?: number | undefined;
  }
  /** 系统允许设置 */
  interface OnlyManagerSettingsModel {
    /** 是否 只允许管理员创建应用 */
    apiIntgOnlyManager: boolean;
    /** 是否 只允许管理员创建应用 */
    dataPipeOnlyManager: boolean;
    /** 是否 只允许管理员创建应用 */
    pluginsOnlyManager: boolean;
    /** 是否 开启超级搜索 */
    superSearchOnlyManager: boolean;
    balanceLimitNotice?: HapApi.MD.Web.Ajax.ResultModel.Project.BalanceLimitNoticeModel | undefined;
    /** 是否允许 MingoAgent（AI应用搭建）调用扣费（默认开启，老组织无配置时为 true） */
    allowMingoAgentCharge: boolean;
    /** （swagger 里没有，真实响应里有） */
    onlyManagerCreateApp?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    onlyManagerDeleteApp?: boolean | undefined;
  }
  /** 获取自定义颜色response */
  interface GetColorSettingsResponse {
    themeColor?: HapApi.MD.Entity.ProjectSetting.ColorSetting_ThemeColorItem | undefined;
    chartColor?: HapApi.MD.Entity.ProjectSetting.ColorSetting_ChartColorItem | undefined;
  }
  interface GetUserFieldSettingsResponse {
    /** 个人 资料显示 字段 */
    psersonalSetList?: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySet[] | undefined;
    /** 名片层 资料显示 字段 */
    cardSetList?: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySet[] | undefined;
    displayFieldForName: HapApi.MD.Entity.ProjectSetting.UserFieldSettings_DisplaySetType;
  }
  /** 工作地点 */
  interface WorkSiteModel {
    /** （swagger 里没有，真实响应里有） */
    workSiteId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    workSiteName?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    userCount?: number | undefined;
  }
  /** 职位 */
  interface JobModel {
    /** （swagger 里没有，真实响应里有） */
    jobId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    jobName?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    userCount?: number | undefined;
  }
  interface AccountDepartmentsMap {
    accountId?: string | undefined;
    departments?: HapApi.MD.Web.Ajax.ResultModel.Project.AccountDepartmentsMap_IdNameMap[] | undefined;
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
  /** 余额告警提醒设置 */
  interface BalanceLimitNoticeModel {
    /** 是否开启余额告警提醒 */
    noticeEnabled: boolean;
    /** 提醒余额 */
    balanceLimit: number;
    /** 提醒用户列表 */
    noticeAccounts?: HapApi.MD.Entity.Account.EasyAccount[] | undefined;
    /** 提醒方式 1：系统消息；2：短信；3：邮件 */
    noticeTypes?: string[] | undefined;
  }
  interface AccountDepartmentsMap_IdNameMap {
    id?: string | undefined;
    name?: string | undefined;
    departmentPath?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Register {
  /** 注册实体 */
  interface RegisterModel {
    actionResult: HapApi.MD.Web.Ajax.Enum.RegActionResult;
    user?: HapApi.MD.Web.Ajax.ResultModel.Register.UserInfoModel | undefined;
    /** 会话Id */
    sessionId?: string | undefined;
    /** 校验获取部门Token */
    token?: string | undefined;
  }
  /** 用户信息 */
  interface UserInfoModel {
    /** 账号Id */
    accountId?: string | undefined;
    /** 组织编号 */
    projectId?: string | undefined;
    /** 公司名称 */
    companyName?: string | undefined;
    /** 姓名 */
    fullname?: string | undefined;
    /** 职位 */
    job?: string | undefined;
    /** 账号 */
    account?: string | undefined;
    /** 加密的账号 */
    encrypeAccount?: string | undefined;
    /** 加密的密码 */
    encrypePassword?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Roles {
  /** 应用角色 设置 */
  interface GetAppRoleSettingResponse {
    appSettingsEnum: HapApi.MD.Enum.Apk.AppSettingsEnum;
    /** 是否 不发送通知 */
    notify: boolean;
    /** 是否开启 调试 */
    isDebug: boolean;
  }
  interface RoleStandardPermissionModel {
    roleId?: string | undefined;
    roleName?: string | undefined;
    /** 是否 允许添加成员 */
    allowAddMembers: boolean;
    permissions?: HapApi.MD.Web.Ajax.ResultModel.Roles.StandardPermission[] | undefined;
  }
  /** 用户 网络权限信息 */
  interface ProjectPermissionsByUserModel {
    /** 用户 在该企业的网络权限 */
    projectPermissions?: HapApi.MD.Entity.Role.PermissionType[] | undefined;
    projectIntergrationType: HapApi.MD.Enum.ProjectIntergrationType;
    /** 是否是 【组织超级管理员】 */
    isSuperAdmin: boolean;
    /** 是否拥有任意管理员角色 */
    hasRole: boolean;
    /** （swagger 里没有，真实响应里有） */
    isLark?: boolean | undefined;
  }
  interface MyPermissionsModel {
    /** 拥有的 权限Ids */
    permissionIds?: number[] | undefined;
  }
  interface StandardPermission {
    /** 权限Id */
    permissionId: number;
    /** 权限名称 */
    permissionName?: string | undefined;
    /** 角色 描述 */
    description?: string | undefined;
    /** 是否 当前角色 拥有的权限 */
    isRolePermission: boolean;
    /** 子权限 （可能为 空） */
    subPermission?: HapApi.MD.Web.Ajax.ResultModel.Roles.StandardPermission[] | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.TaskCenter {
  /** 返回结果 */
  interface ReturnTemplate {
    /** 执行状态 true 成功 false 失败 */
    status: boolean;
    /** 业务返回的数据 */
    data?: ApiPayload | undefined;
    error?: HapApi.MD.Web.Ajax.ResultModel.TaskCenter.TaskError | undefined;
  }
  /** 错误信息 */
  interface TaskError {
    code: HapApi.MD.Enum.Task.TaskExceptionType;
    /** 自定义错误消息  前端可以直接提示 */
    msg?: string | undefined;
    /** 原始堆栈信息 */
    ex?: string | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.UsageAnalysis {
  interface QueryInactiveUsersResponse {
    /** 查询 日期 */
    queryDate?: string | undefined;
    /** 查询状态 查询中=1，查询完成=2，查询失败=3 */
    queryStatus: number;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.User {
  /** 用户加入网络 */
  interface UserCardModel {
    /** 工作地点 */
    workSites?: HapApi.MD.Web.Ajax.ResultModel.Project.WorkSiteModel[] | undefined;
    /** 部门 */
    departments?: HapApi.MD.Web.Ajax.ResultModel.Project.DepartmentModel[] | undefined;
    /** 工作地点 */
    jobs?: HapApi.MD.Web.Ajax.ResultModel.Project.JobModel[] | undefined;
    user?: HapApi.MD.Web.Ajax.ResultModel.User.UserModel | undefined;
  }
  interface UserModel {
    /** 账号编号 */
    accountId?: string | undefined;
    /** 头像 */
    avatar?: string | undefined;
    /** 手机号 */
    mobilePhone?: string | undefined;
    /** 邮箱 */
    email?: string | undefined;
    onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | undefined;
    jobIds?: string[] | undefined;
    /** 职位信息 */
    jobInfos?: HapApi.MD.Web.Ajax.ResultModel.Project.JobModel[] | undefined;
    /** 部门名称 */
    department?: string | undefined;
    /** 部门信息 */
    departmentInfos?: HapApi.MD.Web.Ajax.ResultModel.Project.DepartmentModel[] | undefined;
    /** 组织角色信息 */
    orgRoles?: HapApi.MD.Web.Ajax.ResultModel.IdNameMap[] | undefined;
    /** 置顶的 显示顺序（ 大于0 则代表 置顶中） */
    displayOrder: number;
    /** 手机号是否私密 */
    isPrivateMobile?: boolean | undefined;
    /** 邮箱是否私密 */
    isPrivateEmail?: boolean | undefined;
    /** 是否是部门负责人 */
    isDepartmentChargeUser?: boolean | undefined;
    /** 是否是外部协作用户 */
    isRelationShip?: boolean | undefined;
    /** 是否多任职 */
    useMultiJobs: boolean;
    /** 多任职，部门职位信息 */
    departmentJobInfos?: HapApi.MD.Web.Ajax.ResultModel.Departments.DepartmentJobModel[] | undefined;
    /** 下属列表 */
    subordinates?: HapApi.MD.Web.Ajax.ResultModel.User.UserModel[] | undefined;
    /** 上级列表 */
    parents?: HapApi.MD.Web.Ajax.ResultModel.User.UserModel[] | undefined;
    /** （swagger 里没有，真实响应里有） */
    fullname?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    companyName?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    contactPhone?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    workSite?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    workSiteId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    jobNumber?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    projectId?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    isAdmin?: boolean | undefined;
    /** （swagger 里没有，真实响应里有） */
    job?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    enFullname?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    createTime?: string | undefined;
    /** （swagger 里没有，真实响应里有） */
    status?: number | undefined;
  }
  interface ContactUserModel {
    oftenUsers?: HapApi.MD.Web.Ajax.ResultModel.ListModel_UserModel | undefined;
    users?: HapApi.MD.Web.Ajax.ResultModel.ListModel_UserModel | undefined;
    departments?: HapApi.MD.Web.Ajax.ResultModel.ListModel_DepartmentModel | undefined;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Worksheet {
  /** 获取应用角色用户扩展属性 */
  interface GetAppExtendAttrResponse {
    appExtendAttr?: HapApi.MD.Entity.Worksheet.AppExtendAttrModel | undefined;
    /** 待选字段集合 */
    optionalControls?: HapApi.MD.Entity.Worksheet.OptionalControl[] | undefined;
    /** 工作表名字 */
    worksheetName?: string | undefined;
    /** Icon */
    iconUrl?: string | undefined;
    /** 工作表所属应用Id */
    appIdOfWorksheet?: string | undefined;
    /** 工作表所属应用名称 */
    appNameOfWorksheet?: string | undefined;
    /** 待选用户字段集合 */
    optionalUserControls?: HapApi.MD.Entity.Worksheet.OptionalControl[] | undefined;
  }
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
  /** 获取工作表日志响应model */
  interface GetWorksheetOpeationLogsResponse {
    /** 日志 */
    logs?: HapApi.MD.Entity.Worksheet.WorksheetOpeationLogItem[] | undefined;
    /** 最后标记时间 */
    lastMark?: string | undefined;
    /** 记录标题 */
    recordTitle?: string | undefined;
    /** 是否要获取老的日志接口的标识量，true表示需要开始调用老的日志接口了 */
    flag: boolean;
  }
  /** 获取 工作表 索引字段配置 */
  interface GetRowIndexesResult {
    /** 工作表索引配置集合 */
    worksheetRowIndexConfigs?: HapApi.MD.Entity.Worksheet.WorksheetRowIndexConfig[] | undefined;
    /** 可选字段集合 */
    worksheetAvailableFields?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetAvailableFieldModel[] | undefined;
    /** 限制数量 */
    worksheetRowIndexLimit: number;
  }
  /** 获取表单提交设置响应模型 */
  interface GetFormSubmissionSettingsResponse {
    /** 配置选项 */
    advancedSetting?: Record<string, string> | undefined;
  }
  interface SwitchConfigDto {
    state: boolean;
    type: HapApi.MD.Enum.Worksheet.SwitchType;
    roleType: HapApi.MD.Enum.Worksheet.SwitchRoleType;
    viewIds?: string[] | undefined;
    displayFlowChart: number;
    view?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.SwitchConfigView[] | undefined;
  }
  /** 表说明 */
  interface WorksheetApiModel {
    /** 工作表ID */
    worksheetId?: string | undefined;
    /** 所属应用ID */
    appId?: string | undefined;
    name?: string | undefined;
    projectId?: string | undefined;
    appKey?: string | undefined;
    sign?: string | undefined;
    controls?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.ControlApiModel[] | undefined;
    /** 视图 */
    views?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.ViewApiModel[] | undefined;
    /** api地址 */
    apiUrl?: string | undefined;
  }
  /** 查询默认值dto */
  interface DefultQueryDto {
    /** 工作表查询数据 */
    queries?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetQueryDto[] | undefined;
    /** 查询表的控件信息 */
    templates?: Record<string, import('src/utils/controlTypes').FormControl[]> | undefined;
  }
  /** 表说明 */
  interface WorksheetCurrencyInfosModel {
    /** 货币符号 */
    symbol?: string | undefined;
    /** 货币代码 */
    currencyCode?: string | undefined;
    /** 辅币单位单数 */
    subCurrencyCode?: Record<string, string> | undefined;
    /** 辅币单位复数 */
    subCurrencyCodePlural?: Record<string, string> | undefined;
    /** 货币名称单数 */
    currencyName?: Record<string, string> | undefined;
    /** 货币名称复数 */
    currencyNamePlural?: Record<string, string> | undefined;
  }
  interface SetFollowDto {
    /** 1 = 成功，7 = 无权限 */
    resultCode: number;
    /** 关注的人 */
    users?: HapApi.MD.Entity.Account.EasyAccount[] | undefined;
  }
  /** 视图插件配置 */
  interface ViewPluginConfiguration {
    functionSwitchSettings?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.FunctionSwitchSettings | undefined;
    /** 参数变量设置 */
    variableParamSettings?: HapApi.System.Collections.Generic.KeyValuePair_String_String[] | undefined;
    currentUseVersion?: HapApi.MD.Entity.Plugin.PluginCommitRecord | undefined;
  }
  /** 工作表可用字段模型 */
  interface WorksheetAvailableFieldModel {
    /** 字段Id */
    id?: string | undefined;
    /** 字段名 */
    name?: string | undefined;
    type: HapApi.MD.Enum.Worksheet.RowIndexFieldType;
    controlType: HapApi.MD.Enum.Form.ControlType;
  }
  interface SwitchConfigView {
    /** 视图id */
    id?: string | undefined;
    /** 名称 */
    name?: string | undefined;
  }
  /** 控件说明 */
  interface ControlApiModel {
    controlId?: string | undefined;
    controlName?: string | undefined;
    type?: string | undefined;
    desc?: string | undefined;
    isSupport: boolean;
    value?: string | undefined;
    relationValue?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.RelationDto | undefined;
    /** 别名 */
    alias?: string | undefined;
  }
  interface ViewApiModel {
    viewId?: string | undefined;
    name?: string | undefined;
    type: number;
    alias?: string | undefined;
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
  interface RelationDto {
    /** 行记录ids */
    rowIds?: string[] | undefined;
    /** 是否是添加关联 */
    isAdd: boolean;
  }
}

declare namespace HapApi.MD.Web.Ajax.ResultModel.Worksheet.PublicForm {
  /** 获取公开表单信息 */
  interface PublicFormDomainDto {
    /** 网络id */
    projectId?: string | undefined;
    /** 网络名称 */
    projectName?: string | undefined;
    /** 工作表id */
    worksheetId?: string | undefined;
    /** 分享id（随机生成,刷新链接改变） */
    shareId?: string | undefined;
    /** 名称 */
    name?: string | undefined;
    /** 描述 */
    desc?: string | undefined;
    /** 提交按钮名称 */
    submitBtnName?: string | undefined;
    /** Logo */
    logo?: string | undefined;
    /** 封面 */
    cover?: string | undefined;
    /** 主题枚举 */
    themeColor: number;
    /** 自定义主题 */
    themeBgColor?: string | undefined;
    /** 表单链接开启关闭状态   1=关闭， 2=开启  3=删除 */
    visibleType: number;
    /** 工作表名称 */
    worksheetName?: string | undefined;
    /** 正常控件信息 */
    controls?: HapApi.MD.Web.Ajax.ResultModel.Worksheet.PublicForm.ContorlBase[] | undefined;
    /** 隐藏控件信息 */
    hidedControlIds?: string[] | undefined;
    /** html */
    code?: string | undefined;
    /** 扩展来源控件id */
    extendSourceId?: string | undefined;
    /** ip对应控件id */
    ipControlId?: string | undefined;
    /** 浏览器对应控件id */
    browserControlId?: string | undefined;
    /** 设备对应控件id */
    deviceControlId?: string | undefined;
    /** 系统对应控件id */
    systemControlId?: string | undefined;
    /** 回执 */
    receipt?: string | undefined;
    /** 扩展信息 */
    extends?: string[] | undefined;
    /** 工作表模板信息 */
    originalControls?: import('src/utils/controlTypes').FormControl[] | undefined;
    /** 是否启用验证码 */
    needCaptcha: boolean;
    /** 短信验证 需要短信验证-true 不需要短信验证-false */
    smsVerification: boolean;
    /** 选择的手机号验证的字段 */
    smsVerificationFiled?: string | undefined;
    /** 短信签名 */
    smsSignature?: string | undefined;
    url?: string | undefined;
    isWorksheetQuery: boolean;
    shareAuthor?: string | undefined;
    appId?: string | undefined;
    advancedSetting?: Record<string, string> | undefined;
    /** 填写人群范围 */
    writeScope: number;
    /** 当前时间是否在填写时间内 */
    isWithinLimitWriteTime: boolean;
    linkSwitchTime?: HapApi.MD.Entity.Worksheet.PublicForm.LinkSwitchTime | undefined;
    limitWriteTime?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteTime | undefined;
    limitWriteCount?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteCountSetting | undefined;
    limitPasswordWrite?: HapApi.MD.Entity.Worksheet.PublicForm.LimitPasswordWriteSetting | undefined;
    /** 缓存未提交内容，下次自动填充 */
    cacheDraft: boolean;
    cacheFieldData?: HapApi.MD.Entity.Worksheet.PublicForm.CacheFieldData | undefined;
    weChatSetting?: HapApi.MD.Entity.Worksheet.PublicForm.WeChatSetting | undefined;
    abilityExpand?: HapApi.MD.Entity.Worksheet.PublicForm.AbilityExpand | undefined;
    limitWriteFrequencySetting?: HapApi.MD.Entity.Worksheet.PublicForm.LimitWriteFrequencySetting | undefined;
    /** 微信登录跳转的url */
    returnUrl?: string | undefined;
    /** 已填人数 */
    completeNumber: number;
    /** ClientId */
    clientId?: string | undefined;
    langInfo?: HapApi.MD.Entity.AppLang.LangInfo | undefined;
    /** 已绑定的控件Id */
    boundControlIds?: string[] | undefined;
    /** 是否应用在维护 */
    fixed: boolean;
    /** 维护备注 */
    fixRemark?: string | undefined;
    /** 扩展数据 */
    extendDatas?: Record<string, string> | undefined;
    /** 应用时区 */
    appTimeZone: number;
  }
  /** 控件基础信息 */
  interface ContorlBase {
    /** 控件id */
    controlId?: string | undefined;
    row: number;
    /** 列 */
    col: number;
    size: number;
  }
}

declare namespace HapApi.System.Collections.Generic {
  interface KeyValuePair_String_String {
    key?: string | undefined;
    value?: string | undefined;
  }
}
