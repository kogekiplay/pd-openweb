import type { InboxEndpoint } from './inboxTypes';

/** Both actual mutation consumers only test truthiness; no reply fields or Boolean shape are promised. */
export type GroupMutationReply = unknown;
export interface GroupAboutParams { groupId?: string | undefined; groupAbout?: string | undefined; }
export interface GroupToPostParams { groupId?: string | undefined; projectId?: string | undefined; }
export type GroupAboutEndpoint = InboxEndpoint<GroupAboutParams, GroupMutationReply>;
export type GroupToPostEndpoint = InboxEndpoint<GroupToPostParams, GroupMutationReply>;

/** Actual Group/GetGroupInfo consumers: settings, feed project selection and quick selector labels. */
export interface GroupInfoParams { groupId?: string | undefined; withUser?: boolean | undefined; }
export interface GroupProject { projectId?: string | undefined; companyName?: string | undefined; }
/** Flat member rows consumed by settings and chat; these are not the nested Entity.GroupUser records. */
export interface GroupMember {
  accountId?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
  companyName?: string | undefined;
  job?: string | undefined;
  department?: string | undefined;
  status?: number | undefined;
  groupUserRole?: number | undefined;
  isCreateUser?: boolean | undefined;
}
export interface GroupInfo {
  groupId?: string | undefined;
  name?: string | undefined;
  avatar?: string | undefined;
  about?: string | undefined;
  status?: number | undefined;
  isAdmin?: boolean | undefined;
  isPost?: boolean | undefined;
  isVerified?: boolean | undefined;
  isApproval?: boolean | undefined;
  isHidden?: boolean | undefined;
  isForbidInvite?: boolean | undefined;
  isPushNotice?: boolean | undefined;
  createTime?: string | undefined;
  project?: GroupProject | null | undefined;
  projectId?: string | undefined;
  mapDepartmentId?: string | undefined;
  mapDepartmentName?: string | undefined;
  groupMemberCount?: number | undefined;
  adminUsers?: GroupMember[] | undefined;
  groupUsers?: GroupMember[] | undefined;
}
export type GroupInfoEndpoint = InboxEndpoint<GroupInfoParams, GroupInfo | null | undefined>;
export interface GroupUsersParams {
  groupId?: string | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  keywords?: string | undefined;
  type?: number | undefined;
}
/** A member page is consumed as an array plus numeric pagination counters, without normalization. */
export interface GroupMemberPage { groupUsers: GroupMember[]; groupMemberCount: number; matchedMemberCount: number; }
export type GroupUsersEndpoint = InboxEndpoint<GroupUsersParams, GroupMemberPage>;
