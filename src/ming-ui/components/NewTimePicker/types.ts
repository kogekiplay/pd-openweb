import type { MouseEvent } from 'react';

export type TimeMode = 'hour' | 'minute' | 'second';
export interface ClockTime {
  hour: number;
  minute: number;
  second: number;
}
export type ClockEvent = MouseEvent<HTMLLIElement>;
export interface ClockOptions {
  value?: Readonly<ClockTime> | null | undefined;
  min?: Readonly<ClockTime> | null | undefined;
  max?: Readonly<ClockTime> | null | undefined;
}
export interface TimeProps extends ClockOptions {
  type?: TimeMode | undefined;
  disabled?: boolean | undefined;
  onChange?: ((event: ClockEvent, value: ClockTime, label: string) => void) | undefined;
}
export interface TimeMenuProps extends ClockOptions {
  show?: boolean | undefined;
  mode?: TimeMode | undefined;
  onPick?: ((event: ClockEvent, value: ClockTime) => void) | undefined;
}
export interface TimeItem {
  value: number;
  label: string;
  disabled: boolean;
  current: boolean;
}
export interface TimeListProps {
  data?: readonly TimeItem[] | undefined;
  onPick?: ((event: ClockEvent, value: number) => void) | undefined;
}
export function normalizeClock(value?: Readonly<ClockTime> | null): ClockTime {
  const number = (input: number | undefined, max: number) =>
    typeof input === 'number' && Number.isFinite(input) ? Math.max(0, Math.min(max, Math.trunc(input))) : 0;
  return { hour: number(value?.hour, 23), minute: number(value?.minute, 59), second: number(value?.second, 59) };
}
