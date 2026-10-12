import type { CSSProperties, MouseEvent, ReactElement } from 'react';
import type { Moment, MomentInput } from 'moment';
import type { TimeOptions, TimePickerProps, TimeTriggerProps, TimeValue } from '../TimePicker/types';
import type { CalendarMode, CalendarView, HalfDay } from './footerTypes';
import type defaultLocale from './locale/zh_CN';

export type CalendarLocale = typeof defaultLocale;
export type DateValue = TimeValue;
export type DateRangeValue = readonly [DateValue?, DateValue?];
export type MutableDateRange = [DateValue?, DateValue?];
export type DateRangeInput = readonly [MomentInput?, MomentInput?];
export type HalfDayRange = readonly [(HalfDay | undefined)?, (HalfDay | undefined)?];
export type RangeTarget = 'start' | 'end';
export interface DateSelectCause {
  source?:
    | 'dateTable'
    | 'timePicker'
    | 'clearButton'
    | 'todayButton'
    | 'tomorrowButton'
    | 'goBack'
    | 'goForward'
    | 'monthTable'
    | 'yearTable'
    | undefined;
}
export interface CalendarPresentation {
  locale?: CalendarLocale | undefined;
  prefixCls?: string | undefined;
  className?: string | undefined;
  popupParentNode?: TimePickerProps['popupParentNode'];
}
export interface CalendarProps extends CalendarPresentation, TimeOptions {
  value?: DateValue;
  defaultValue?: DateValue;
  selectedValue?: DateValue;
  mode?: CalendarMode | undefined;
  timePicker?: boolean | undefined;
  style?: CSSProperties | undefined;
  onSelect?: ((value: DateValue, cause: DateSelectCause) => void) | undefined;
  onChange?: ((value: Moment) => void) | undefined;
  onOk?: ((value: Moment) => void) | undefined;
  allowClear?: boolean | undefined;
  onClear?: (() => void) | undefined;
  disabledDate?: ((current: Moment, value: Moment) => boolean) | undefined;
}
export interface CalendarRangeProps extends CalendarPresentation {
  value?: DateRangeInput | undefined;
  defaultValue?: DateRangeInput | undefined;
  selectedValue?: DateRangeInput | undefined;
  halfData?: HalfDayRange | undefined;
  timePicker?: boolean | undefined;
  mode?: 'default' | 'task' | 'halfday' | undefined;
  onSelect?: ((value: DateRangeValue, cause?: DateSelectCause, halfData?: HalfDayRange) => void) | undefined;
  onChange?: ((value: DateRangeValue) => void) | undefined;
  onOk?: ((value: DateRangeValue, halfData: HalfDayRange) => void) | undefined;
  onClear?: (() => void) | undefined;
  format?: string | undefined;
  disabledDate?: CalendarProps['disabledDate'];
}
export interface DateTableProps extends CalendarPresentation {
  value: Moment;
  selectedValue?: DateValue | DateRangeValue;
  direction?: 'left' | 'right' | undefined;
  disabledDate?: CalendarProps['disabledDate'];
  onSelect?: ((value: Moment) => void) | undefined;
}
export interface CalendarPartProps extends DateTableProps {
  onValueChange?: ((value: Moment) => void) | undefined;
  waingAble?: boolean | undefined;
}
export interface NumericTableProps {
  value?: number | null | undefined;
  page?: number | null | undefined;
  onChange?:
    | ((event: MouseEvent<HTMLLIElement>, value: number, info: { prevValue: number | null | undefined }) => void)
    | undefined;
}
export interface CalendarHeaderProps extends CalendarPresentation {
  value: Moment;
  direction?: 'left' | 'right' | undefined;
  mode?: CalendarMode | undefined;
  view?: CalendarView | undefined;
  openView?: ((view: CalendarView) => void) | undefined;
  goBack?: (() => void) | undefined;
  goForward?: (() => void) | undefined;
}
export interface CalendarBinding<V, A extends [V, ...unknown[]], O extends unknown[]> {
  className?: string | undefined;
  defaultValue?: V | undefined;
  selectedValue?: V | undefined;
  popupParentNode?: TimePickerProps['popupParentNode'];
  onSelect?: ((...args: A) => void) | undefined;
  onOk?: ((...args: O) => void) | undefined;
  onClear?: (() => void) | undefined;
}
export interface PickerState<V> {
  value: V | undefined;
  visible: boolean;
  bounding: import('../PositionContainer').PositionBounding | null;
}
export interface PickerProps<V, A extends [V, ...unknown[]], O extends unknown[]> {
  calendar: ReactElement<CalendarBinding<V, A, O>>;
  children: (state: PickerState<V>, props: PickerProps<V, A, O>) => ReactElement<TimeTriggerProps>;
  defaultValue?: V | undefined;
  defaultVisible?: boolean | undefined;
  visible?: boolean | undefined;
  disabled?: boolean | undefined;
  panelCls?: string | undefined;
  className?: string | undefined;
  prefixCls?: string | undefined;
  timePicker?: boolean | undefined;
  offsetLeft?: number | undefined;
  offsetTop?: number | undefined;
  popupParentNode?: TimePickerProps['popupParentNode'];
}
export interface PickerPresentation {
  placeholder?: string | undefined;
  panelCls?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  format?: string | undefined;
  children?: ReactElement | undefined;
  defaultVisible?: boolean | undefined;
  offsetLeft?: number | undefined;
  offsetTop?: number | undefined;
  popupParentNode?: TimePickerProps['popupParentNode'];
}
export interface DatePickerProps extends CalendarProps, PickerPresentation {}
export interface RangePickerProps extends Omit<CalendarRangeProps, 'selectedValue'>, PickerPresentation {
  selectedValue?: DateRangeValue | undefined;
  separator?: string | undefined;
}

export function copyRange(value: DateRangeValue = []): MutableDateRange {
  return value.length === 0 ? [] : value.length === 1 ? [value[0]] : [value[0], value[1]];
}
