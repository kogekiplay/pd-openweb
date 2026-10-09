import type { DefaultSource } from 'src/components/Form/core/formUtils/types';

export type SettingDefaultSource = Omit<DefaultSource, 'staticValue'> & { staticValue?: string | number | undefined };

export interface SettingItemName {
  key?: string | undefined;
  value?: string | undefined;
}
export interface SettingItemColor {
  type?: number | undefined;
  color?: string | undefined;
  colors?:
    | Array<{
        key?: string | undefined;
        value?: string | undefined;
        color?: string | undefined;
        min?: number | undefined;
        max?: number | undefined;
      }>
    | undefined;
}
export interface SettingCountry {
  name?: string | undefined;
  iso2?: string | undefined;
  dialCode?: string | undefined;
  id?: string | undefined;
}
export interface SettingIcon {
  iconUrl?: string | undefined;
  icon?: string | undefined;
}
export interface KnownAdvancedSettings {
  itemnames: SettingItemName[];
  itemcolor: SettingItemColor;
  icon: SettingIcon;
  defsource: SettingDefaultSource[];
  syssort: string[];
  sysids: string[];
  customShowControls: string[];
  controlssorts: string[];
  uniquecontrols: string[];
  additionalids: string[];
  batchcids: string[];
  chooseshowids: string[];
  freezeids: string[];
  allowcountries: Array<string | SettingCountry>;
  commcountries: Array<string | SettingCountry>;
  showtype: number | '';
  checktype: number | '';
  detailworksheettype: number | '';
  topshow: number | '';
  querytype: number | '';
  currencytype: number | '';
  minheight: number | '';
  min: number | SettingDefaultSource[] | '';
  max: number | SettingDefaultSource[] | '';
  rownum: number | '';
  blankrow: number | '';
  ocrmaptype: number | '';
  hidetitle: number | '';
}
export type KnownAdvancedSettingKey = keyof KnownAdvancedSettings;
