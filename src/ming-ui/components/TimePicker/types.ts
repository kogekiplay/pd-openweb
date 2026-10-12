import type { MouseEventHandler, ReactElement, Ref } from 'react';
import type { Moment } from 'moment';

export type TimeUnit = 'hour' | 'minute' | 'second';
export type TimeValue = Moment | null | undefined;
/** The original Array.map arguments remain available to custom option formatters. */
export type TimeOptionFormatter = (value: number, index: number, values: number[]) => string;
export interface TimeOptions {
  showHour?: boolean | undefined;
  showMinute?: boolean | undefined;
  showSecond?: boolean | undefined;
  optionFormatter?: TimeOptionFormatter | undefined;
  disabledHours?: (() => readonly number[]) | undefined;
  disabledMinutes?: ((hour: number) => readonly number[]) | undefined;
  disabledSeconds?: ((minute: number) => readonly number[]) | undefined;
  panelCls?: string | undefined;
  placeholder?: string | undefined;
}
export interface TimeTriggerProps {
  onClick?: MouseEventHandler<HTMLElement> | undefined;
  ref?: Ref<unknown> | undefined;
}
export interface TimePickerProps extends TimeOptions {
  className?: string | undefined;
  value?: TimeValue;
  defaultValue?: TimeValue;
  onChange?: ((value: Moment | null) => void) | undefined;
  resultFormatter?: ((value: TimeValue, hour: boolean, minute: boolean, second: boolean) => string) | undefined;
  popupParentNode?: (() => HTMLElement | null | undefined) | undefined;
  disabled?: boolean | undefined;
  children?: ReactElement<TimeTriggerProps> | undefined;
}
export interface TimePanelProps extends TimeOptions {
  value?: TimeValue;
  defaultOpenValue: Moment;
  format: (value: TimeValue) => string;
  onChange?: ((value: Moment) => void) | undefined;
  onClear?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  getRef?: ((panel: HTMLDivElement | null) => void) | undefined;
}
