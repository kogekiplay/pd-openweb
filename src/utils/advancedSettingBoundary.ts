import type {
  KnownAdvancedSettingKey,
  KnownAdvancedSettings,
  SettingCountry,
  SettingDefaultSource,
  SettingIcon,
  SettingItemColor,
  SettingItemName,
} from './advancedSettingTypes';

function objectValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function number(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}
function itemName(value: unknown): value is SettingItemName {
  return objectValue(value) && text(value['key']) && text(value['value']);
}
function icon(value: unknown): value is SettingIcon {
  return objectValue(value) && text(value['iconUrl']) && text(value['icon']);
}
function color(value: unknown): value is SettingItemColor {
  return (
    objectValue(value) &&
    number(value['type']) &&
    text(value['color']) &&
    (value['colors'] === undefined ||
      (Array.isArray(value['colors']) &&
        value['colors'].every(
          item =>
            objectValue(item) &&
            text(item['key']) &&
            text(item['value']) &&
            text(item['color']) &&
            number(item['min']) &&
            number(item['max']),
        )))
  );
}
function source(value: unknown): value is SettingDefaultSource {
  return (
    objectValue(value) &&
    text(value['cid']) &&
    text(value['rcid']) &&
    (text(value['staticValue']) || typeof value['staticValue'] === 'number') &&
    number(value['type']) &&
    (value['isAsync'] === undefined || typeof value['isAsync'] === 'boolean')
  );
}
const stringArrayKeys = new Set([
  'syssort',
  'sysids',
  'customShowControls',
  'controlssorts',
  'uniquecontrols',
  'additionalids',
  'batchcids',
  'chooseshowids',
  'freezeids',
  'allowcountries',
  'commcountries',
]);
const numberKeys = new Set([
  'showtype',
  'checktype',
  'detailworksheettype',
  'topshow',
  'querytype',
  'currencytype',
  'minheight',
  'min',
  'max',
  'rownum',
  'blankrow',
  'ocrmaptype',
  'hidetitle',
]);
export function isKnownSettingKey(key: string): key is KnownAdvancedSettingKey {
  return (
    key === 'itemnames' ||
    key === 'itemcolor' ||
    key === 'icon' ||
    key === 'defsource' ||
    stringArrayKeys.has(key) ||
    numberKeys.has(key)
  );
}
function decodeStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function decodeCountries(value: unknown): Array<string | SettingCountry> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string | SettingCountry =>
          typeof item === 'string' ||
          (objectValue(item) && text(item['name']) && text(item['iso2']) && text(item['dialCode']) && text(item['id'])),
      )
    : [];
}
function decodeNumber(value: unknown): number | '' {
  return typeof value === 'number' ? value : '';
}
const settingDecoders: { [K in KnownAdvancedSettingKey]: (value: unknown) => KnownAdvancedSettings[K] } = {
  itemnames: value => (Array.isArray(value) ? value.filter(itemName) : []),
  itemcolor: value => (color(value) ? value : {}),
  icon: value => (icon(value) ? value : {}),
  defsource: value => (Array.isArray(value) ? value.filter(source) : []),
  min: value => (Array.isArray(value) ? value.filter(source) : decodeNumber(value)),
  max: value => (Array.isArray(value) ? value.filter(source) : decodeNumber(value)),
  syssort: decodeStrings,
  sysids: decodeStrings,
  customShowControls: decodeStrings,
  controlssorts: decodeStrings,
  uniquecontrols: decodeStrings,
  additionalids: decodeStrings,
  batchcids: decodeStrings,
  chooseshowids: decodeStrings,
  freezeids: decodeStrings,
  allowcountries: decodeCountries,
  commcountries: decodeCountries,
  showtype: decodeNumber,
  checktype: decodeNumber,
  detailworksheettype: decodeNumber,
  topshow: decodeNumber,
  querytype: decodeNumber,
  currencytype: decodeNumber,
  minheight: decodeNumber,
  rownum: decodeNumber,
  blankrow: decodeNumber,
  ocrmaptype: decodeNumber,
  hidetitle: decodeNumber,
};
export function decodeKnownSetting<K extends KnownAdvancedSettingKey>(
  key: K,
  value: unknown,
): KnownAdvancedSettings[K] {
  return settingDecoders[key](value);
}

export interface SettingSort {
  controlId?: string | undefined;
  isAsc?: boolean | undefined;
}
export function settingSorts(value: unknown): SettingSort[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SettingSort =>
          objectValue(item) &&
          text(item['controlId']) &&
          (item['isAsc'] === undefined || typeof item['isAsc'] === 'boolean'),
      )
    : [];
}
export function settingStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
export interface CalendarSettingPair {
  begin?: string | undefined;
  end?: string | undefined;
}
export function calendarPairs(value: unknown): CalendarSettingPair[] {
  const parsed: unknown = typeof value === 'string' ? safeParse(value, 'array') : value;
  return Array.isArray(parsed)
    ? parsed.filter(
        (pair): pair is CalendarSettingPair => objectValue(pair) && text(pair['begin']) && text(pair['end']),
      )
    : [];
}
export function parsedSettingStrings(value: unknown): string[] {
  return settingStrings(typeof value === 'string' ? safeParse(value, 'array') : value);
}
