declare module 'react' {
  interface ImgHTMLAttributes<T> { placeholder?: string | undefined; }
}

/**
 * 地址簿共享类型（2026-10-20 持续目标·部门树切片）。
 *
 * 【为什么集中】`ProjectContacts`（容器）与 `ProjectContactsList`（组件）各声明过一份
 * `DepartmentNode`，两份的 `subs` 递归字段一旦写法不同（`unknown[]` vs `DepartmentNode[]`），
 * 在跨文件传参时 TS 会判为"两个同名但无关的类型"。这里收成**一份**真实形状。
 */

/** 部门树节点：`pagedDepartmentTrees` 返回项 + 组件补的 `subs`/`haveSubDepartment` */
export interface DepartmentNode {
  departmentId?: string | undefined;
  departmentName?: string | undefined;
  subs?: DepartmentNode[] | undefined;
  /** 是否有下级部门（决定展开箭头是否占位） */
  haveSubDepartment?: boolean | undefined;
}

/** 用户详情里的「我的组织/应用」卡片（`userCards` 元素） */
export interface AddressBookUserCard {
  companyName?: string | undefined;
  projectId?: string | null | undefined;
}

/** 用户详情（`fetchUserDetail` resolve 的账号信息 + 卡片列表） */
export interface AddressBookUserDetail {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  isContact?: boolean | undefined;
  isFriend?: boolean | undefined;
  userCards?: AddressBookUserCard[] | undefined;
}

/** 群组详情（`GroupDetail` 渲染与设置回调更新的字段） */
export interface AddressBookGroupDetail {
  groupId?: string | undefined;
  /** Groups.formatGroupsData 实际读取；缺失时保留原生 toUpperCase 失败。 */
  firstCode?: string | undefined;
  /** Groups.renderDetail 据此选择入群入口或群详情。 */
  isMember?: boolean | undefined;
  avatar?: string | undefined;
  name?: string | undefined;
  groupMemberCount?: number | undefined;
  createTime?: string | number | undefined;
  isOpen?: boolean | undefined;
  isDelete?: boolean | undefined;
  createAccount?: { fullname?: string | undefined } | undefined;
}

/** 地址簿打开聊天面板时注入的选择回调（payload 由各入口给：会话/群/应用） */
export interface AddressBookCallbackPayload {
  accountId?: string | undefined;
  groupId?: string | undefined;
  type?: string | undefined;
}

/** 地址簿选择数据或关闭弹层的事件；工具栏实际读取 target 判断来源。 */
export interface AddressBookClosePayload extends AddressBookCallbackPayload {
  target?: EventTarget | null | undefined;
}

/** Group/settingGroup 真实 success 回调中本地址簿接收的字段。 */
export interface AddressBookSettingResult {
  groupId?: string | undefined;
  groupID?: string | undefined;
  accountId?: string | undefined;
  avatar?: string | undefined;
  groupAvatar?: string | undefined;
  groupName?: string | undefined;
  accounts?: unknown[] | undefined;
  isVerified?: boolean | undefined;
  mapDepartmentId?: string | undefined;
  mapDepartmentName?: string | undefined;
  isApproval?: boolean | undefined;
}

/** 本地群信息补丁：计算字段与 VERIFY/APPROVE 原样展开字段。 */
export type AddressBookGroupPatch = Partial<AddressBookGroupDetail> & AddressBookSettingResult;
