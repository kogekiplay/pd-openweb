import type { ComponentProps, KeyboardEvent } from 'react';
import type { SelectProps } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker/interface';
import type { Moment } from 'moment';
import type { RangePicker } from 'src/ming-ui/components/mdAntPickers';
import type { FormControl } from 'src/utils/controlTypes';

export type PrimitiveValue = number | string | null | undefined;
export interface NumberFilterValues {
  value?: PrimitiveValue;
  minValue?: PrimitiveValue;
  maxValue?: PrimitiveValue;
}
export interface NumberFilterProps extends NumberFilterValues {
  disabled?: boolean | undefined;
  type?: number | undefined;
  onChange(changes: NumberFilterValues): void;
}
export interface DateFilterChanges extends NumberFilterValues {
  values?: string[] | undefined;
  dateRange?: number | undefined;
  dateRangeType?: number | string | undefined;
}
export interface DateFilterProps extends NumberFilterValues {
  control?: FormControl | undefined;
  disabled?: boolean | undefined;
  type?: number | undefined;
  values?: string[] | undefined;
  dateRange?: number | undefined;
  dateRangeType?: number | string | undefined;
  from?: string | number | undefined;
  appId?: string | undefined;
  onChange(changes: DateFilterChanges): void;
}
export interface TimeFilterProps extends NumberFilterValues {
  control?: FormControl | undefined;
  disabled?: boolean | undefined;
  type?: number | undefined;
  dateRange?: number | undefined;
  onChange(changes: DateFilterChanges): void;
}
export interface TextFilterProps {
  disabled?: boolean | undefined;
  values?: string[] | null | undefined;
  onChange(changes: { values: string[] }): void;
}
export interface TextFilterState {
  searchValue: string | undefined;
  values: string[];
}
export interface YesNoFilterProps {
  disabled?: boolean | undefined;
  control: FormControl;
  type?: number | undefined;
  onChange(changes: { type: number; value: 1 }): void;
}
export type DateRangeChange = NonNullable<ComponentProps<typeof RangePicker>['onChange']>;
export type TimeRangeChange = NonNullable<RangePickerProps<Moment>['onChange']>;
export type PickerMode = RangePickerProps<Moment>['picker'];
export type TextSelectProps = SelectProps<string[]>;
type AntdTextTag = Parameters<NonNullable<TextSelectProps['tagRender']>>[0];
// The library's unparameterized raw tag value is open. Make that one field
// opaque here; leave its actual label/close/disabled SDK ABI unchanged.
export type TextTag = Omit<AntdTextTag, 'value'> & { value?: unknown };
export type TextKeyEvent = KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>;
/** Antd's raw tag `value` has an opaque SDK type; this editor's value protocol is string. */
export function textTagValue(value: unknown): string | undefined {
  // Antd's overflow/rest tag passes undefined even when the selected values are
  // strings; the original renderer left that tag text empty.
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid filter text tag');
}
