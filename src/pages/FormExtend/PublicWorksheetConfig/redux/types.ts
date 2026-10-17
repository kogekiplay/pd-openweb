import type { FormControl } from 'src/utils/controlTypes';

export type PublicFormSource = HapApi.MD.Web.Ajax.ResultModel.Worksheet.PublicForm.PublicFormDomainDto;
/** A control ID can be absent on a source control; map/concat preserve that value. */
export type HidedControlId = FormControl['controlId'];

/** The generated wire map also has this locally consumed, optional serialized key. */
export type PublicWorksheetExtendDatas = NonNullable<PublicFormSource['extendDatas']> & {
  shareConfig?: string | undefined;
};

export type PublicWorksheetInfo = Partial<
  Pick<
    PublicFormSource,
    | 'worksheetId'
    | 'projectId'
    | 'worksheetName'
    | 'name'
    | 'desc'
    | 'projectName'
    | 'visibleType'
    | 'submitBtnName'
    | 'appId'
    | 'advancedSetting'
  >
> & {
  themeIndex?: PublicFormSource['themeColor'] | undefined;
  themeBgColor?: PublicFormSource['themeBgColor'];
  logoUrl?: PublicFormSource['logo'];
  coverUrl?: PublicFormSource['cover'];
};

/** Pick preserves explicit undefined from the wire, including keys copied by lodash.pick. */
type WirePublicWorksheetSettings = Pick<
  PublicFormSource,
  | 'extendDatas'
  | 'limitWriteFrequencySetting'
  | 'ipControlId'
  | 'browserControlId'
  | 'deviceControlId'
  | 'systemControlId'
  | 'receipt'
  | 'extendSourceId'
  | 'extends'
  | 'needCaptcha'
  | 'smsVerification'
  | 'smsVerificationFiled'
  | 'smsSignature'
  | 'writeScope'
  | 'linkSwitchTime'
  | 'limitWriteTime'
  | 'limitWriteCount'
  | 'limitPasswordWrite'
  | 'cacheDraft'
  | 'cacheFieldData'
  | 'weChatSetting'
  | 'abilityExpand'
  | 'completeNumber'
  | 'boundControlIds'
>;
/** Editing forwards own undefined values too; Partial alone excludes them on required wire booleans/numbers. */
export type PublicWorksheetSettings = {
  [K in keyof WirePublicWorksheetSettings]?: WirePublicWorksheetSettings[K] | undefined;
};

export interface PublicWorksheetState {
  loading: boolean;
  shareUrl: string;
  worksheetInfo: PublicWorksheetInfo;
  worksheetSettings: PublicWorksheetSettings;
  originalControls: FormControl[];
  // The producer forwards data.controls without a fallback. A missing value is
  // returned by this sub-reducer; Redux rejects it when assembling a real store.
  controls: FormControl[] | undefined;
  hidedControlIds: HidedControlId[];
}

export type PublicWorksheetAction =
  | {
      type: 'PUBLICWORKSHEET_LOAD_SUCCESS';
      url: PublicFormSource['url'];
      shareId: PublicFormSource['shareId'];
      worksheetInfo: PublicWorksheetInfo;
      worksheetSettings: PublicWorksheetSettings;
      originalControls: FormControl[];
      controls: PublicWorksheetState['controls'];
      hidedControlIds: HidedControlId[];
    }
  | { type: 'PUBLICWORKSHEET_UPDATE_URL'; url: PublicFormSource['url'] }
  | { type: 'PUBLICWORKSHEET_UPDATE_SETTINGS'; value: Partial<PublicWorksheetSettings> }
  | { type: 'PUBLICWORKSHEET_UPDATE_INFO'; value: Partial<PublicWorksheetInfo> }
  | { type: 'PUBLICWORKSHEET_UPDATE_CONTROLS'; controls: FormControl[] }
  | { type: 'PUBLICWORKSHEET_ADD_CONTROL'; control: FormControl }
  | { type: 'WORKSHEET_SHOW_CONTROL'; controls: FormControl[]; controlIds: HidedControlId[] }
  | { type: 'WORKSHEET_HIDE_CONTROL'; controlId: HidedControlId | HidedControlId[] }
  | { type: 'PUBLICWORKSHEET_CLEAR' };

export type PublicWorksheetPayload<T extends PublicWorksheetAction['type']> = Omit<
  Extract<PublicWorksheetAction, { type: T }>,
  'type'
>;

// Unlike a conditional alias yielding never, this constraint fails compilation
// when the action union gains a case not handled anywhere in this reducer set.
type AssertNever<T extends never> = T;
export type PublicWorksheetUnhandledAction = AssertNever<
  Exclude<
    PublicWorksheetAction['type'],
    | 'PUBLICWORKSHEET_LOAD_SUCCESS'
    | 'PUBLICWORKSHEET_UPDATE_URL'
    | 'PUBLICWORKSHEET_UPDATE_SETTINGS'
    | 'PUBLICWORKSHEET_UPDATE_INFO'
    | 'PUBLICWORKSHEET_UPDATE_CONTROLS'
    | 'PUBLICWORKSHEET_ADD_CONTROL'
    | 'WORKSHEET_SHOW_CONTROL'
    | 'WORKSHEET_HIDE_CONTROL'
    | 'PUBLICWORKSHEET_CLEAR'
  >
>;
