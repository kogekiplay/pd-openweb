import type { ReactNode } from 'react';
import type { ResolveThunks } from 'react-redux';
import type { RootState } from 'src/redux/configureStore';
import type { PageConfigScalar } from '../../pageConfig';
import { readPageProperty } from '../../pageConfig';
import type * as actions from '../redux/actions';
import type { PublicWorksheetSettings } from '../redux/types';

export type SystemSourceKey =
  'ipControlId' | 'browserControlId' | 'deviceControlId' | 'systemControlId' | 'extendSourceId';
export type PublicConfigProps = Pick<
  RootState['publicWorksheet'],
  'loading' | 'shareUrl' | 'worksheetInfo' | 'worksheetSettings' | 'originalControls' | 'controls' | 'hidedControlIds'
> &
  ResolveThunks<Pick<typeof actions, 'updateSettings' | 'addWorksheetControl' | 'refreshShareUrl' | 'hideControl'>> & {
    onClose: () => void;
  };
type PickedSettings = Pick<
  PublicWorksheetSettings,
  | SystemSourceKey
  | 'receipt'
  | 'needCaptcha'
  | 'smsVerificationFiled'
  | 'smsVerification'
  | 'writeScope'
  | 'linkSwitchTime'
  | 'limitWriteTime'
  | 'limitWriteCount'
  | 'limitPasswordWrite'
  | 'cacheDraft'
  | 'cacheFieldData'
  | 'weChatSetting'
  | 'abilityExpand'
  | 'extendDatas'
  | 'limitWriteFrequencySetting'
>;
export interface PublicTimeRange {
  month: { start: number | '' | null | undefined; end: number | '' | null | undefined };
  day: { start: number | '' | null | undefined; end: number | '' | null | undefined };
  hour: Array<{ start: string | null | undefined; end: string | null | undefined }>;
}
export interface PublicTitleFolded {
  writeScope: boolean;
  dataCollect: boolean;
  fillSetting: boolean;
  // The child uses the plural key; it is initially absent, independently of fillSetting.
  fillSettings?: boolean | undefined;
  weChatSetting: boolean;
  abilityExpand: boolean;
  receipt: boolean;
}
export interface PublicConfigState extends PickedSettings {
  addControlVisible: boolean;
  activeTab: number | undefined;
  sourceKeys: string[];
  isEditing: boolean;
  daySelectPopupVisible: boolean;
  mappingDialogVisible: boolean;
  confirmDialog: { visible: boolean; isOnClose?: boolean; tabValue?: number | undefined };
  fieldSearchKeyWords: string;
  weChatBind: PublicWeChatBinding;
  titleFolded: PublicTitleFolded;
  smsSignature: string;
  timeRange: PublicTimeRange;
  settingChanged: boolean;
  displayContent: number[];
  buttonPosition: string;
  activeSourceKey?: SystemSourceKey | undefined;
}
export type ImmediateSettingKey = SystemSourceKey | 'sourceKeys' | 'extendDatas';
export type ImmediateSettingChange = {
  [K in ImmediateSettingKey]: [key: K, value: PublicConfigState[K], cb?: () => void];
}[ImmediateSettingKey];
export type PublicLinkKey = keyof PickedSettings | 'smsSignature' | 'timeRange' | 'titleFolded' | 'weChatBind';
export type PublicLinkSetter = <K extends PublicLinkKey>(patch: Pick<PublicConfigState, K>, changed?: boolean) => void;
export interface PublicWeChatBinding {
  isBind?: boolean | number | undefined;
  appId?: string | undefined;
  nickName?: string | undefined;
  name?: string | undefined;
}
export interface PublicWeChatServiceInfo {
  weChatServiceAccounts: unknown[];
  service: PublicWeChatBinding | undefined;
}
export interface WeChatEnhanceProps {
  worksheetInfo?: PublicConfigProps['worksheetInfo'];
  data: Pick<PublicConfigState, SystemSourceKey | 'writeScope' | 'titleFolded'> &
    Pick<PublicConfigProps, 'originalControls'> & {
      weChatSetting: Partial<NonNullable<PublicConfigState['weChatSetting']>>;
      boundControlIds: PublicWorksheetSettings['boundControlIds'];
    };
  setState: PublicLinkSetter;
  addWorksheetControl: PublicConfigProps['addWorksheetControl'];
  shareConfig?: string | undefined;
  handleUpdateExpandDatas: (patch: Record<string, string>, immediately?: boolean) => void;
  handleSettingChanged: () => void;
}
export interface PublicDropdownOption {
  text: ReactNode;
  value?: string | undefined;
  style?: React.CSSProperties;
}
/** The parent forwards the full share-card value; extension fields are retained by the actual ref. */
export interface PublicShareCardValue {
  title?: string | undefined;
  desc?: string | undefined;
  icon?: string | undefined;
  iconUrl?: string | undefined;
}
export interface PublicShareCardHandle {
  shareConfigValue?: PublicShareCardValue | undefined;
  onSave(info: PublicShareCardValue, shareCardId: string): void;
}

export function publicSettingText(value: unknown, key: 'title' | 'content'): string | null | undefined {
  const field = readPageProperty(value, key);
  if (field === null) return null;
  if (field === undefined) return undefined;
  if (typeof field === 'string') return field;
  throw new TypeError(`Invalid public form setting field: ${key}`);
}

export function publicReceiptAction(value: unknown): PageConfigScalar {
  const field = readPageProperty(value, 'action');
  if (field === null) return null;
  if (field === undefined) return undefined;
  if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') return field;
  throw new TypeError('Invalid public form setting field: action');
}
