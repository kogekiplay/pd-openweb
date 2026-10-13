import type { DefaultSource } from 'src/components/Form/core/formUtils/types';
import type { FormQueryConfig } from 'src/components/Form/core/queryTypes';
import type { ControlAdvancedSetting } from 'src/utils/controlTypes';
import type { FormControl } from 'src/utils/controlTypes';
import type { SettingFunction } from '../../../util/advancedSettingBoundary';

/** Fast-filter date identifiers also arrive as numbers. Persist their original wire value. */
export interface DynamicValueSource extends Omit<DefaultSource, 'cid'> {
  cid?: string | number | undefined;
  time?: string | undefined;
  relateSheetName?: string | undefined;
}
export interface DynamicSourceMenuItem {
  key: string | number;
  text?: string | undefined;
  id?: string | undefined;
  icon?: string | undefined;
  value?: string | undefined;
}
export interface DynamicNamedMenuItem extends DynamicSourceMenuItem {
  id: string;
  text: string;
}
export interface DynamicFieldSelection {
  fieldId?: string | undefined;
  relateSheetControlId?: string | undefined;
  type?: number | undefined;
}
export interface DynamicControl extends FormControl {
  isSearch?: boolean | undefined;
}
export interface SelectOtherFieldProps {
  data: DynamicControl;
  onDynamicValueChange: (sources: DynamicValueSource[]) => void;
  onChange?: ((control: FormControl) => void) | undefined;
  allControls?: FormControl[] | undefined;
  controls?: FormControl[] | undefined;
  globalSheetControls?: FormControl[] | undefined;
  globalSheetInfo?:
    | {
        appId?: string | undefined;
        appName?: string | undefined;
        worksheetId?: string | undefined;
        projectId?: string | undefined;
      }
    | undefined;
  dynamicValue?: DynamicValueSource[] | undefined;
  dynamicData?: SettingFunction | DynamicValueSource | undefined;
  queryConfig?: FormQueryConfig | undefined;
  updateQueryConfigs?: ((query: FormQueryConfig | SettingFunction) => void) | undefined;
  from?: number | string | undefined;
  fromRange?: boolean | undefined;
  fromCondition?: string | undefined;
  writeObject?: number | undefined;
  showEmpty?: boolean | undefined;
  hideSearchAndFun?: boolean | undefined;
  hideRelateSheetHeader?: boolean | undefined;
  dynamicMultiple?: boolean | undefined;
  subListSheetId?: string | undefined;
  defaultType?: string | boolean | undefined;
  popupContainer?: HTMLElement | undefined;
  propFiledVisible?: boolean | undefined;
  withLinkParams?: boolean | undefined;
  withDY?: boolean | undefined;
  linkParams?: string[] | undefined;
  fromCustomEventApi?: boolean | undefined;
  actionData?: { actionType?: string | undefined } | undefined;
  parentControl?: FormControl | undefined;
  onTriggerClick?: (() => void) | undefined;
}

/** Decode only the fields this UI consumes, retaining valid records and their extra metadata. */
export function isDynamicValueSource(value: unknown): value is DynamicValueSource {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const optionalText = (field: unknown) => field === undefined || typeof field === 'string';
  const optionalNumber = (field: unknown) =>
    field === undefined || (typeof field === 'number' && Number.isFinite(field));
  return (
    (!('cid' in value) || optionalText(value.cid) || optionalNumber(value.cid)) &&
    (!('rcid' in value) || optionalText(value.rcid)) &&
    (!('staticValue' in value) || optionalText(value.staticValue) || optionalNumber(value.staticValue)) &&
    (!('type' in value) || optionalNumber(value.type)) &&
    (!('time' in value) || optionalText(value.time)) &&
    (!('relateSheetName' in value) || optionalText(value.relateSheetName)) &&
    (!('isAsync' in value) || value.isAsync === undefined || typeof value.isAsync === 'boolean')
  );
}
export function dynamicValueSources(value: unknown): DynamicValueSource[] {
  if (!Array.isArray(value)) return [];
  return value.every(isDynamicValueSource) ? value : value.filter(isDynamicValueSource);
}

/** Date-range IDs are numeric on the wire; the general field-ID decoder only accepts strings. */
export function readDynamicValueSources(control: FormControl): DynamicValueSource[] {
  const value: unknown = control.advancedSetting?.defsource;
  if (typeof value !== 'string') return dynamicValueSources(value);
  try {
    return dynamicValueSources(JSON.parse(value));
  } catch {
    return [];
  }
}

/** Values and callbacks normalized by the dynamic-default entry before selecting an input. */
export interface DynamicInputProps extends Omit<SelectOtherFieldProps, 'dynamicValue' | 'allControls' | 'onChange'> {
  dynamicValue: DynamicValueSource[];
  allControls: FormControl[];
  onChange: (control: FormControl) => void;
  clearOldDefault: (control?: FormControl) => void;
  className?: string | undefined;
  placeholder?: string | undefined;
  hideOtherFields?: boolean | undefined;
  totalWidth?: boolean | undefined;
  eventKey?: string | undefined;
  withMaxOrMin?: boolean | undefined;
  enumDefault2?: number | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  getType?: ((control: FormControl) => string | undefined) | undefined;
}
