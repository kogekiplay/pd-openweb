import type { ConfigType, Dayjs } from 'dayjs';
import type { ControlAdvancedSetting } from './controlTypes';
import type { SubListStore } from './subListStoreTypes';

/** Formatting reads only these fields; raw field payloads enter as unknown. */
export interface FunctionControl {
  type?: number | undefined;
  value?: unknown;
  advancedSetting?: ControlAdvancedSetting | undefined;
  enumDefault?: number | undefined;
  enumDefault2?: number | undefined;
  sourceControlType?: number | undefined;
  sourceControl?: { advancedSetting?: ControlAdvancedSetting | undefined } | undefined;
  unit?: string | undefined;
  options?: FunctionOption[] | undefined;
  store?: SubListStore | undefined;
}
export interface FunctionOption {
  key?: string | undefined;
  value?: string | undefined;
  isDeleted?: boolean | undefined;
}
/** Open JSON metadata stays unknown at each property; it is not a full worksheet model. */
export interface FunctionValueObject {
  [property: string]: unknown;
}
export interface FunctionRow extends FunctionValueObject {
  rowid?: string | undefined;
}
export type FormattedFunctionValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date
  | FunctionValueObject
  | FormattedFunctionValue[];
export type FunctionDateInput = ConfigType;
export type CalculatedDate = { result: Dayjs; error?: undefined } | { result?: undefined; error: unknown };
export type CoordinateInput = string | number | null | undefined;
