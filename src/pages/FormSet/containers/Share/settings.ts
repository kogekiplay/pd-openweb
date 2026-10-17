import type { WorksheetInfo } from 'src/pages/worksheet/types';
import type { FormControl } from 'src/utils/controlTypes';

type WireSwitch = HapApi.MD.Web.Ajax.ResultModel.Worksheet.SwitchConfigDto;
/** The editor reads these fields and carries all other wire metadata through the original objects. */
export interface SharingSwitch {
  state?: WireSwitch['state'] | undefined;
  // Unknown numeric switch/role IDs keep the original strict-comparison behavior.
  type?: number | undefined;
  roleType?: number | undefined;
  viewIds?: WireSwitch['viewIds'] | null;
}
export type SharingSwitchPatch = SharingSwitch;
export interface SharingSettingsProps {
  worksheetId?: string | undefined;
  worksheetInfo: WorksheetInfo;
  worksheetControls: FormControl[];
  onChange: (info: WorksheetInfo) => void;
}
export interface SharingSettingsState {
  loading: boolean;
  data?: SharingSwitch[] | undefined;
  loadError?: boolean | undefined;
}
export type SharingTab = 'view' | 'record' | 'discussion';
export type DiscussionPermissionPatch = { discusspermission: '' | '2' };

function isSwitch(value: unknown): value is SharingSwitch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if ('state' in value && value.state !== undefined && typeof value.state !== 'boolean') return false;
  if ('type' in value && value.type !== undefined && typeof value.type !== 'number') return false;
  if ('roleType' in value && value.roleType !== undefined && typeof value.roleType !== 'number') return false;
  if ('viewIds' in value && value.viewIds !== undefined && value.viewIds !== null) {
    if (!Array.isArray(value.viewIds) || !value.viewIds.every((id: unknown) => typeof id === 'string')) return false;
  }

  return true;
}

/** Validate the consumed wire fields without cloning entries or dropping unrelated metadata. */
export function sharingSwitches(value: unknown): SharingSwitch[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid sharing switch list');
  for (const item of value) if (!isSwitch(item)) throw new TypeError('Invalid sharing switch fields');
  return value;
}
