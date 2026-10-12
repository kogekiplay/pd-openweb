import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { Moment, MomentInput } from 'moment';
import moment from 'moment';
import type { ClockEvent, ClockTime, TimeMode } from '../NewTimePicker/types';
import type { PositionBounding, PositionContainerProps } from '../PositionContainer';

export type DateView = 'year' | 'month' | 'date';
export type PickerMode = DateView | 'datetime';
export type RangeMode = PickerMode | 'half' | 'task';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type HalfDay = 'AM' | 'PM';
export type DatePair = [Date, Date];
export type NullableDatePair = [Date | null, Date | null];
export type RangeInput = readonly [MomentInput?, MomentInput?];
export type MomentRange = readonly [Moment | null, Moment | null];
export function emptyMomentRange(): MomentRange {
  return [null, null];
}
export type RangePreview = readonly [Moment | '', Moment | ''];
export type HalfPair = readonly [(HalfDay | undefined)?, (HalfDay | undefined)?];
export type HeaderAction = DateView | 'now' | 'prev' | 'next';
export type GridEvent = MouseEvent<HTMLTableCellElement>;
export type HeaderEvent = MouseEvent<HTMLButtonElement>;
export type PickerEvent = HeaderEvent | GridEvent | ClockEvent | null;
export interface RangeConfig {
  start: boolean;
  end: boolean;
}
export interface DateBounds {
  min?: Date | null | undefined;
  max?: Date | null | undefined;
  disabledDate?: ((date: Date) => boolean | undefined) | undefined;
}
export interface TimeData {
  value: ClockTime;
  min: ClockTime | null;
  max: ClockTime | null;
}
export interface CalendarCell {
  time: Date;
  value: number;
  label: string;
  disabled: boolean;
  current: boolean;
  inRange: boolean;
  now: boolean;
  other?: boolean | -1 | 1 | undefined;
  start?: boolean | undefined;
  end?: boolean | undefined;
  left?: boolean | undefined;
  right?: boolean | undefined;
}
export interface TableProps {
  headData?: readonly string[] | undefined;
  bodyData?: readonly (readonly CalendarCell[])[] | undefined;
  onPick?: ((event: GridEvent, value: number, time: Date) => void) | undefined;
}
export interface CalendarProps extends DateBounds {
  mode?: DateView | undefined;
  range?: boolean | undefined;
  part?: '' | 'start' | 'end' | undefined;
  firstDayOfWeek?: Weekday | undefined;
  value?: Date | readonly [Date, Date] | null | undefined;
  selectedRange?: readonly [Date, Date] | null | undefined;
  cursor?: Date | undefined;
  onPick?: ((event: GridEvent, type: DateView, value: number, time: Date) => void) | undefined;
}
export interface DateBaseProps extends Omit<CalendarProps, 'mode' | 'cursor' | 'onPick'> {
  type?: DateView | undefined;
  prefix?: string | undefined;
  onChange?: ((event: GridEvent, value: Date) => void) | undefined;
}
export type ResolvedCalendarProps = Omit<CalendarProps, 'value' | 'range' | 'cursor' | 'firstDayOfWeek'> & {
  cursor: Date;
  firstDayOfWeek: Weekday;
} & ({ range: true; value: DatePair } | { range: false; value: Date });
export interface HeaderProps {
  view: DateView;
  time: Date;
  prefix?: string | undefined;
  buttonOnClick?: ((event: HeaderEvent, action: HeaderAction) => void) | undefined;
}
export interface PanelProps extends DateBounds {
  show?: boolean | undefined;
  type?: PickerMode | undefined;
  timeType?: TimeMode | undefined;
  firstDayOfWeek?: Weekday | undefined;
  allowClear?: boolean | undefined;
  value?: Date | null | undefined;
  onChange?: ((event: HeaderEvent, value: Date | null) => void) | undefined;
  onSelect?: ((value: Moment) => void) | undefined;
  onOk?: ((value: Moment) => void) | undefined;
  onClear?: (() => void) | undefined;
}
export interface RangePanelProps extends Omit<PanelProps, 'type' | 'value' | 'onSelect' | 'onOk' | 'onChange'> {
  type?: PickerMode | 'half' | undefined;
  value?: readonly [Date | null, Date | null] | null | undefined;
  halfStart?: HalfDay | undefined;
  halfEnd?: HalfDay | undefined;
  partial?: boolean | undefined;
  config?: Partial<RangeConfig> | undefined;
  autoFillEndTime?: number | undefined;
  onChange?: ((event: HeaderEvent, value: DatePair | null, config: RangeConfig) => void) | undefined;
  onSelect?: ((value: RangePreview) => void) | undefined;
  onOk?: ((value: MomentRange, halves: HalfPair | null) => void) | undefined;
}
interface PublicPresentation {
  selectedValue?: MomentInput;
  min?: MomentInput;
  max?: MomentInput;
  timeMode?: TimeMode | undefined;
  timePicker?: boolean | undefined;
  allowClear?: boolean | undefined;
  firstDayOfWeek?: Weekday | undefined;
  disabled?: boolean | undefined;
  defaultVisible?: boolean | undefined;
  children?: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  placeholder?: string | undefined;
  locale?:
    | {
        lang?:
          | {
              dateFormat?: string;
              dateTimeFormat?: string;
              timepicker?: string;
              clear?: string;
              ok?: string;
              today?: string;
              tomorrow?: string;
              begin?: string;
              end?: string;
            }
          | undefined;
      }
    | undefined;
  format?: string | undefined;
  disabledDate?: ((date: Moment) => boolean | undefined) | undefined;
  offset?: PositionContainerProps['offset'];
  popupParentNode?: PositionContainerProps['popupParentNode'];
  onClear?: (() => void) | undefined;
}
export interface DateTimeProps extends PublicPresentation {
  mode?: PickerMode | undefined;
  placement?: PositionContainerProps['placement'];
  onOk?: ((value: Moment) => void) | undefined;
  onSelect?: ((value: Moment) => void) | undefined;
}
interface RangePresentation extends Omit<PublicPresentation, 'selectedValue'> {
  separator?: string | undefined;
  selectedValue?: RangeInput | null | undefined;
  halfData?: HalfPair | undefined;
  onSelect?: RangePanelProps['onSelect'];
  onVisibleChange?: ((visible: boolean) => void) | undefined;
  autoFillEndTime?: number | undefined;
}
export type DateTimeRangeProps = RangePresentation &
  (
    | { mode: 'task'; onOk?: RangePanelProps['onOk'] }
    | {
        mode?: Exclude<RangeMode, 'task'> | undefined;
        onOk?: ((value: readonly [Moment, Moment], halves: HalfPair | null) => void) | undefined;
      }
  );
export interface PublicDateState {
  value: Date | null;
  label: string;
  menuOpened: boolean;
  bounding: PositionBounding | null;
}
export interface PublicRangeState extends Omit<PublicDateState, 'value'> {
  value: NullableDatePair | null;
  config: RangeConfig;
}

export function decodeDate(value: MomentInput): Date | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const parsed = moment(value);
  return parsed.isValid() ? parsed.toDate() : null;
}
export function clockOf(value: Date): ClockTime {
  return { hour: value.getHours(), minute: value.getMinutes(), second: value.getSeconds() };
}
export function clockData(value: ClockTime, bounds: DateBounds, date: Date): TimeData {
  const same = (other: Date | null | undefined) =>
    !!other &&
    date.getFullYear() === other.getFullYear() &&
    date.getMonth() === other.getMonth() &&
    date.getDate() === other.getDate();
  return {
    value: { ...value },
    min: same(bounds.min) && bounds.min ? clockOf(bounds.min) : null,
    max: same(bounds.max) && bounds.max ? clockOf(bounds.max) : null,
  };
}
export function isDatePair(value: CalendarProps['value']): value is readonly [Date, Date] {
  return Array.isArray(value);
}
export function dateValue(value: CalendarProps['value']): Date {
  const candidate = isDatePair(value) ? value[0] : value;
  return candidate && Number.isFinite(candidate.getTime()) ? new Date(candidate) : new Date();
}
export function datePair(value: CalendarProps['value']): DatePair {
  const anchor = dateValue(value);
  return isDatePair(value) ? [dateValue(value[0]), dateValue(value[1])] : [anchor, new Date(anchor)];
}
export function calendarProps(props: CalendarProps): ResolvedCalendarProps {
  const common = { ...props, cursor: dateValue(props.cursor), firstDayOfWeek: props.firstDayOfWeek ?? 1 };
  return props.range
    ? { ...common, range: true, value: datePair(props.value) }
    : { ...common, range: false, value: dateValue(props.value) };
}
export function roundedDate(value: Date, mode: TimeMode = 'minute', bounds?: DateBounds): Date | null {
  const floor = (input: Date) => {
    const copy = new Date(input);
    copy.setMilliseconds(0);
    if (mode !== 'second') copy.setSeconds(0);
    if (mode === 'hour') copy.setMinutes(0);
    return copy;
  };
  let result = floor(value);
  if (bounds?.min && result.getTime() < bounds.min.getTime()) {
    result = floor(bounds.min);
    if (result.getTime() < bounds.min.getTime())
      result = new Date(result.getTime() + (mode === 'hour' ? 3600000 : mode === 'minute' ? 60000 : 1000));
  }
  if (bounds?.max && result.getTime() > bounds.max.getTime()) result = floor(bounds.max);
  return (bounds?.min && result.getTime() < bounds.min.getTime()) ||
    (bounds?.max && result.getTime() > bounds.max.getTime())
    ? null
    : result;
}
export function sameDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return a?.getTime() === b?.getTime();
}
export function sameValue(a: CalendarProps['value'], b: CalendarProps['value']): boolean {
  if (isDatePair(a) && isDatePair(b)) return sameDate(a[0], b[0]) && sameDate(a[1], b[1]);
  return !isDatePair(a) && !isDatePair(b) && sameDate(a, b);
}

export function displayDate(
  value: Date,
  mode: RangeMode = 'date',
  _timeMode: TimeMode = 'minute',
  options: {
    format?: string | undefined;
    locale?: { lang?: { dateFormat?: string; dateTimeFormat?: string } | undefined } | undefined;
  },
): string | null {
  const format =
    options.format ||
    (mode === 'datetime' || mode === 'task' ? options.locale?.lang?.dateTimeFormat : options.locale?.lang?.dateFormat);
  return format ? moment(value).format(format) : null;
}
export function dateAllowed(value: Date, type: PickerMode | 'half' = 'date', bounds: DateBounds): boolean {
  if (bounds.disabledDate?.(new Date(value))) return false;
  const comparable = (input: Date) =>
    type === 'year'
      ? input.getFullYear()
      : type === 'month'
        ? input.getFullYear() * 12 + input.getMonth()
        : new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const selected = comparable(value);
  return (!bounds.min || selected >= comparable(bounds.min)) && (!bounds.max || selected <= comparable(bounds.max));
}
