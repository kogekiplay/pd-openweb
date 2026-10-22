/** Shared read view of the actual settingGroup success payloads, consumed by chat and address book. */
export interface GroupSettingResult {
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
  groupAbout?: string | undefined;
  projectId?: string | undefined;
  isPushNotice?: boolean | undefined;
}
export interface GroupSettingOptions {
  groupID?: string | undefined;
  isApprove?: boolean | undefined;
  isChat?: boolean | undefined;
  success?: ((type: string | undefined, data: GroupSettingResult) => void) | undefined;
  onClose?: (() => void) | undefined;
}
export interface GroupSettingProps extends GroupSettingOptions { visible: boolean; onClose: () => void; }

/** Client state preserves the wire fields; presentation flags and pagination are separate known fields. */
import type { GroupInfo } from 'src/api/groupTypes';
export interface GroupSettingsState extends GroupInfo {
  loading: boolean;
  userDialogVisible: boolean;
  aboutDialogVisible: boolean;
  pageIndex: number;
  keywords: string;
  userLoading: boolean;
  users: import('src/api/groupTypes').GroupMemberPage | undefined;
  hasGroupAuth: boolean | string | null | undefined;
  chatOrgId: string | undefined;
  covertVisible: boolean;
  covertOkDisabled: boolean;
  qrLoading: boolean;
}
export interface GroupUsersQuery { pageIndex?: number; keywords?: string; }

export type GroupUserAction = 0 | 1 | 3;
export type GroupMutationAction = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export interface GroupActionPatch {
  isHidden?: boolean;
  isForbidInvite?: boolean;
  isVerified?: boolean;
  mapDepartmentId?: string | undefined;
  mapDepartmentName?: string | undefined;
  isApproval?: boolean;
  isPushNotice?: boolean;
  projectId?: string | undefined;
  covertVisible?: boolean;
}
