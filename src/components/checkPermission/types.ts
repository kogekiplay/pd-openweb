import type { ReactNode } from 'react';

/** Backend permissions are numeric IDs; these five flags are added by AdminCommon for navigation. */
export type PermissionFlag = 'NOT_MEMBER' | 'SHOW_APPLY' | 'SHOW_MY_CHARACTER' | 'SHOW_MANAGER' | 'CAN_PURCHASE';
export type PermissionId = number | PermissionFlag;
export type RequiredPermission = PermissionId | readonly PermissionId[];
export interface PermissionCacheEntry {
  data: number[];
  time: string;
  version: string;
}
export interface PermissionOptions {
  projectId?: string | undefined;
  myPermissions?: readonly PermissionId[] | undefined;
}
export interface PermissionContainerProps {
  children?: ReactNode | undefined;
  projectId: string;
  needPermission: RequiredPermission;
}
