import type { MomentInput } from 'moment';

export type CategoryColorClass = (color: number | undefined, type?: string) => string | undefined;
export interface CalendarCategory extends Record<string, unknown> {
  catID: string;
  catName: string;
  color?: number | undefined;
}
/** Legacy doT templates read the color helper from the category array itself. */
export interface CalendarCategories extends Array<CalendarCategory> {
  colorClass?: CategoryColorClass | undefined;
}
export interface CalendarOtherUser extends Record<string, unknown> {
  accountID: string;
  fullName: string;
  avatar?: string | undefined;
}
export interface InviteCalendarMethods {
  formatInviteData: (start: MomentInput, end: MomentInput, isAllDay: boolean, type: number | string) => string;
  setWeek: (weekDay: string) => string;
  getWeekUpper: (week: number) => string | undefined;
}
export interface InvitedMember extends Record<string, unknown> {
  accountID: string;
  head: string;
  memberName: string;
  status?: number | string | undefined;
  remark?: string | undefined;
}
export interface InvitedCalendar extends Record<string, unknown> {
  id: string;
  title: string;
  head: string;
  createUser: string;
  createUserName: string;
  members: InvitedMember[];
  startTime: string;
  endTime: string;
  description?: string | undefined;
  address?: string | undefined;
  isRecur?: boolean | undefined;
  repeat?: string | false | undefined;
}
export interface InvitedCalendarList extends Record<string, unknown> {
  count: number;
  calendars?: InvitedCalendar[] | null | undefined;
  statusTypes?: string[] | undefined;
  TplComm?: InviteCalendarMethods | undefined;
}
export interface CalendarResponse extends Record<string, unknown> {
  code: number | string;
  data?: unknown;
  msg?: unknown;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const optionalText = (value: unknown): boolean => value === undefined || typeof value === 'string';

function category(value: unknown): value is CalendarCategory {
  return (
    object(value) &&
    typeof value['catID'] === 'string' &&
    typeof value['catName'] === 'string' &&
    (value['color'] === undefined || typeof value['color'] === 'number')
  );
}

function member(value: unknown): value is InvitedMember {
  return (
    object(value) &&
    ['accountID', 'head', 'memberName'].every(key => typeof value[key] === 'string') &&
    optionalText(value['remark']) &&
    (optionalText(value['status']) || typeof value['status'] === 'number')
  );
}

function invite(value: unknown): value is InvitedCalendar {
  return (
    object(value) &&
    ['id', 'title', 'head', 'createUser', 'createUserName', 'startTime', 'endTime'].every(
      key => typeof value[key] === 'string',
    ) &&
    ['description', 'address'].every(key => optionalText(value[key])) &&
    (value['isRecur'] === undefined || typeof value['isRecur'] === 'boolean') &&
    Array.isArray(value['members']) &&
    Array.from(value['members']).every(member)
  );
}

export function calendarResponse(value: unknown): CalendarResponse {
  if (!object(value) || !(typeof value['code'] === 'number' || typeof value['code'] === 'string'))
    throw new TypeError('Invalid calendar response');
  return value as CalendarResponse;
}

export function calendarCategories(value: unknown): CalendarCategories {
  if (!Array.isArray(value) || !Array.from(value).every(category)) throw new TypeError('Invalid calendar categories');
  return value;
}

export function invitedCalendarList(value: unknown): InvitedCalendarList {
  if (
    !object(value) ||
    typeof value['count'] !== 'number' ||
    !(
      (value['count'] <= 0 && value['calendars'] == null) ||
      (Array.isArray(value['calendars']) && Array.from(value['calendars']).every(invite))
    )
  )
    throw new TypeError('Invalid invited calendars');
  return value as InvitedCalendarList;
}

export function calendarOtherUsers(value: unknown): CalendarOtherUser[] {
  const isUser = (item: unknown): item is CalendarOtherUser =>
    object(item) &&
    typeof item['accountID'] === 'string' &&
    typeof item['fullName'] === 'string' &&
    optionalText(item['avatar']);
  if (!Array.isArray(value) || !Array.from(value).every(isUser)) throw new TypeError('Invalid calendar users');
  return value;
}

export function calendarUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid calendar subscription URL');
  return value;
}
