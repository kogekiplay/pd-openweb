import type { DefaultSource } from 'src/components/Form/core/formUtils/types';
import type { KnownAdvancedSettings } from 'src/utils/advancedSettingTypes';
import { getAdvanceSetting as readSetting } from 'src/utils/controlCommon';
import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';

export interface SettingFilter extends Record<string, unknown> {
  controlId?: string | undefined;
  dataType?: number | undefined;
  spliceType?: number | undefined;
  isGroup?: boolean | undefined;
  type?: number | undefined;
  isDynamicsource?: boolean | undefined;
  conditionGroupType?: string | number | undefined;
  filterType?: number | undefined;
  values?: string[] | undefined;
  dynamicSource?: DefaultSource[] | undefined;
  groupFilters?: SettingFilter[] | undefined;
}
export interface EventFilter extends Record<string, unknown> {
  valueType?: string | undefined;
  spliceType?: number | undefined;
  dataSource?: string | undefined;
  filterItems?: SettingFilter[] | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
}
export interface EventActionItem extends Record<string, unknown> {
  type?: string | undefined;
  controlId?: string | undefined;
  value?: string | undefined;
}
export interface EventAction extends Record<string, unknown> {
  actionType?: string | undefined;
  actionItems?: EventActionItem[] | undefined;
  isAll?: boolean | undefined;
  message?: string | undefined;
  dataSource?: string | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
}
export interface EventActions {
  eventName?: string | undefined;
  filters?: EventFilter[] | undefined;
  actions?: EventAction[] | undefined;
}
export interface WidgetEvent {
  eventId?: string | undefined;
  eventType?: string | undefined;
  eventActions?: EventActions[] | undefined;
}
export interface SettingMapping extends Record<string, unknown> {
  id?: string | undefined;
  cid?: string | undefined;
  subid?: string | undefined;
  pid?: string | undefined;
  type?: number | undefined;
  defsource?: string | undefined;
}
export interface SettingReference extends Record<string, unknown> {
  cid?: string | undefined;
  name?: string | undefined;
}
export interface SettingSort extends Record<string, unknown> {
  controlId?: string | undefined;
  isAsc?: boolean | undefined;
}
export interface SettingStyle extends Record<string, unknown> {
  size?: string | undefined;
  color?: string | undefined;
  style?: string | undefined;
  direction?: string | undefined;
  bordercolor?: string | undefined;
  background?: string | undefined;
}
export interface SettingFunction extends Record<string, unknown> {
  type?: string | undefined;
  expression?: string | undefined;
  code?: string | undefined;
  id?: string | undefined;
  status?: number | undefined;
}
export interface SettingRegex extends Record<string, unknown> {
  name?: string | undefined;
  value?: string | undefined;
  filters?: SettingFilter[] | undefined;
}
export interface SettingIncrease extends Record<string, unknown> {
  controlId?: string | undefined;
  type?: number | undefined;
  start?: string | number | undefined;
  repeatType?: number | undefined;
  length?: number | undefined;
  format?: string | undefined;
}
export interface SettingCountry extends Record<string, unknown> {
  name?: string | undefined;
  iso2?: string | undefined;
  dialCode?: string | undefined;
  id?: string | undefined;
}
export interface SettingSummary extends Record<string, unknown> {
  id?: string | undefined;
  controlId?: string | undefined;
  type?: number | string | undefined;
}
interface ComplexSettings {
  custom_event: WidgetEvent[];
  filters: SettingFilter[];
  filterItems: SettingFilter[];
  topfilters: SettingFilter[] | string[];
  resultfilters: SettingFilter[];
  searchfilters: SettingFilter[];
  filterregex: SettingRegex[];
  widths: number[];
  itemdesc: string[];
  requestmap: SettingMapping[];
  responsemap: SettingMapping[];
  reference: SettingReference[];
  sorts: SettingSort[];
  choosesorts: SettingSort[];
  statisticsseting: SettingSummary[];
  chooserange: DefaultSource[];
  increase: SettingIncrease[];
  reportsetting: SettingSummary[];
  ocrmap: SettingMapping[];
  defaultfunc: SettingFunction;
  dynamicsrc: SettingFunction;
  cardtitlestyle: SettingStyle;
  cardvaluestyle: SettingStyle;
  rowtitlestyle: SettingStyle;
  rowvaluestyle: SettingStyle;
  titledefault: SettingStyle;
  valuedefault: SettingStyle;
  defaultarea: { id?: string | undefined; dialCode?: string | undefined; name?: string | undefined };
  currency: { currencycode?: string | undefined };
  usetype: number | '';
  usertype: number | '';
  locationbegin: number | '';
}
export type WidgetAdvancedSettings = KnownAdvancedSettings & ComplexSettings;
export function widgetObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown): boolean => value === undefined || typeof value === 'string';
const num = (value: unknown): boolean => value === undefined || (typeof value === 'number' && Number.isFinite(value));
const bool = (value: unknown): boolean => value === undefined || typeof value === 'boolean';
function arrayOf<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}
const strings = (value: unknown): value is string[] =>
  arrayOf(value, (item): item is string => typeof item === 'string');
function source(value: unknown): value is DefaultSource {
  return (
    widgetObject(value) &&
    ['cid', 'rcid', 'staticValue'].every(k => text(value[k])) &&
    num(value['type']) &&
    bool(value['isAsync'])
  );
}
function optionalArray<T>(value: unknown, predicate: (item: unknown) => item is T): boolean {
  return value === undefined || arrayOf(value, predicate);
}
function filter(value: unknown): value is SettingFilter {
  return (
    widgetObject(value) &&
    text(value['controlId']) &&
    bool(value['isGroup']) &&
    bool(value['isDynamicsource']) &&
    (text(value['conditionGroupType']) || num(value['conditionGroupType'])) &&
    ['dataType', 'spliceType', 'filterType', 'type'].every(k => num(value[k])) &&
    (value['values'] === undefined || strings(value['values'])) &&
    optionalArray(value['dynamicSource'], source) &&
    optionalArray(value['groupFilters'], filter)
  );
}
function setting(value: unknown): value is ControlAdvancedSetting {
  return widgetObject(value) && Object.values(value).every(text);
}
function eventFilter(value: unknown): value is EventFilter {
  return (
    widgetObject(value) &&
    text(value['valueType']) &&
    num(value['spliceType']) &&
    text(value['dataSource']) &&
    optionalArray(value['filterItems'], filter) &&
    (value['advancedSetting'] === undefined || setting(value['advancedSetting']))
  );
}
function actionItem(value: unknown): value is EventActionItem {
  return widgetObject(value) && ['type', 'controlId', 'value'].every(k => text(value[k]));
}
function action(value: unknown): value is EventAction {
  return (
    widgetObject(value) &&
    ['actionType', 'message', 'dataSource'].every(k => text(value[k])) &&
    bool(value['isAll']) &&
    optionalArray(value['actionItems'], actionItem) &&
    (value['advancedSetting'] === undefined || setting(value['advancedSetting']))
  );
}
function eventActions(value: unknown): value is EventActions {
  return (
    widgetObject(value) &&
    text(value['eventName']) &&
    optionalArray(value['filters'], eventFilter) &&
    optionalArray(value['actions'], action)
  );
}
function event(value: unknown): value is WidgetEvent {
  return (
    widgetObject(value) &&
    text(value['eventId']) &&
    text(value['eventType']) &&
    optionalArray(value['eventActions'], eventActions)
  );
}
function mapping(value: unknown): value is SettingMapping {
  return (
    widgetObject(value) && ['id', 'cid', 'subid', 'pid', 'defsource'].every(k => text(value[k])) && num(value['type'])
  );
}
function reference(value: unknown): value is SettingReference {
  return widgetObject(value) && text(value['cid']) && text(value['name']);
}
function sort(value: unknown): value is SettingSort {
  return widgetObject(value) && text(value['controlId']) && bool(value['isAsc']);
}
function style(value: unknown): value is SettingStyle {
  return (
    widgetObject(value) &&
    ['size', 'color', 'style', 'direction', 'bordercolor', 'background'].every(k => text(value[k]))
  );
}
function fn(value: unknown): value is SettingFunction {
  return widgetObject(value) && ['type', 'expression', 'code', 'id'].every(k => text(value[k])) && num(value['status']);
}
function regex(value: unknown): value is SettingRegex {
  return widgetObject(value) && text(value['name']) && text(value['value']) && optionalArray(value['filters'], filter);
}
function increase(value: unknown): value is SettingIncrease {
  return (
    widgetObject(value) &&
    text(value['controlId']) &&
    ['type', 'repeatType', 'length'].every(k => num(value[k])) &&
    text(value['format']) &&
    (text(value['start']) || num(value['start']))
  );
}
function summary(value: unknown): value is SettingSummary {
  return (
    widgetObject(value) && text(value['id']) && text(value['controlId']) && (text(value['type']) || num(value['type']))
  );
}
function objectOrEmpty<T>(value: unknown, predicate: (v: unknown) => v is T): T | undefined {
  if (!value) return undefined;
  if (!predicate(value)) throw new TypeError('Invalid widget setting object');
  return value;
}
export function countrySettings(value: unknown): SettingCountry[] {
  return listSetting(value, (item): item is SettingCountry => widgetObject(item) && ['name', 'iso2', 'dialCode', 'id'].every(key => text(item[key])));
}
export function styleSetting(value: unknown): SettingStyle {
  return objectOrEmpty(value, style) || {};
}
export function functionSetting(value: unknown): SettingFunction {
  return objectOrEmpty(value, fn) || {};
}
export function filterSettings(value: unknown): SettingFilter[] {
  return listSetting(value, filter);
}
export function stringSettings(value: unknown): string[] {
  return listSetting(value, (item): item is string => typeof item === 'string');
}
export function numberSetting(value: unknown): number | '' {
  return typeof value === 'number' ? value : '';
}
export function sortSettings(value: unknown): SettingSort[] {
  return listSetting(value, sort);
}
function listSetting<T>(value: unknown, predicate: (v: unknown) => v is T): T[] {
  if (!value) return [];
  if (!arrayOf(value, predicate)) throw new TypeError('Invalid widget setting list');
  return value;
}
const listDecoders: Record<string, (value: unknown) => unknown> = {
  custom_event: value => listSetting(value, event),
  filters: filterSettings,
  filterItems: filterSettings,
  topfilters: value => (!value ? '' : strings(value) ? value : filterSettings(value)),
  resultfilters: filterSettings,
  searchfilters: filterSettings,
  filterregex: value => listSetting(value, regex),
  widths: value => listSetting(value, (item): item is number => typeof item === 'number' && Number.isFinite(item)),
  itemdesc: value => listSetting(value, (item): item is string => typeof item === 'string'),
  requestmap: value => listSetting(value, mapping),
  responsemap: value => listSetting(value, mapping),
  ocrmap: value => listSetting(value, mapping),
  reference: value => listSetting(value, reference),
  sorts: sortSettings,
  choosesorts: sortSettings,
  statisticsseting: value => listSetting(value, summary),
  chooserange: value => listSetting(value, source),
  increase: value => listSetting(value, increase),
  reportsetting: value => listSetting(value, summary),
};
const styleKeys = new Set([
  'cardtitlestyle',
  'cardvaluestyle',
  'rowtitlestyle',
  'rowvaluestyle',
  'titledefault',
  'valuedefault',
]);
export function getWidgetAdvanceSetting(data?: FormControl): ControlAdvancedSetting;
export function getWidgetAdvanceSetting<K extends keyof WidgetAdvancedSettings>(
  data: FormControl | undefined,
  key: K,
): WidgetAdvancedSettings[K] | '';
export function getWidgetAdvanceSetting(data: FormControl | undefined, key: string | string[]): unknown;
export function getWidgetAdvanceSetting(data?: FormControl, key?: string | string[]): unknown {
  if (!key) return readSetting(data);
  const value: unknown = readSetting(data, key);
  if (value === '') return '';
  const decoder = typeof key === 'string' ? listDecoders[key] : undefined;
  if (decoder) return decoder(value);
  if (typeof key === 'string' && styleKeys.has(key)) return styleSetting(value);
  if (key === 'defaultfunc' || key === 'dynamicsrc') return functionSetting(value);
  if (key === 'usertype' || key === 'usetype' || key === 'locationbegin') return typeof value === 'number' ? value : '';
  if (key === 'currency' || key === 'defaultarea') {
    return (
      objectOrEmpty(
        value,
        (item): item is { currencycode?: string; id?: string; dialCode?: string; name?: string } =>
          widgetObject(item) && ['currencycode', 'id', 'dialCode', 'name'].every(k => text(item[k])),
      ) || {}
    );
  }
  return value;
}
