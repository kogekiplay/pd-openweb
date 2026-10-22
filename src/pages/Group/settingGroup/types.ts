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
