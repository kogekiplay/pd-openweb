import { decodeUsers as decodeQuickUsers, userObject } from '../../quickSelectUser/boundary';
import type { QuickUser } from '../../quickSelectUser/types';
import type { ContactData, ListData, SelectDepartment, SelectGroup, SelectUser } from './types';

const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
function isUser(value: QuickUser): value is SelectUser {
  const user = userObject(value);
  if (!user || !optionalString(user['companyName'])) return false;
  const info = userObject(user['departmentInfo']);
  return (
    user['departmentInfo'] == null ||
    (!!info && optionalString(info['departmentId']) && optionalString(info['departmentName']))
  );
}
export function decodeUsers(value: unknown): SelectUser[] {
  const users = decodeQuickUsers(value);
  if (!users.every(isUser)) throw new TypeError('Invalid dialog member details');
  return users;
}
function isListData<T>(value: unknown, decode: (list: unknown) => T[]): value is ListData<T> {
  const data = userObject(value);
  if (!data || !optionalNumber(data['allCount']) || !Array.isArray(data['list'])) return false;
  try {
    decode(data['list']);
    return true;
  } catch {
    return false;
  }
}
export function decodeList<T>(value: unknown, decode: (list: unknown) => T[]): ListData<T> {
  if (isListData(value, decode)) return value;
  const data = userObject(value);
  if (!data || !optionalNumber(data['allCount'])) throw new TypeError('Invalid dialog list');
  // Only an omitted/null list needs the legacy empty-list normalization.
  return { ...data, list: decode(data['list'] ?? []) };
}
export const decodeUserList = (value: unknown) => decodeList(value, decodeUsers);
function isContact(value: unknown): value is ContactData {
  const data = userObject(value);
  return (
    !!data &&
    (data['oftenUsers'] == null || isListData(data['oftenUsers'], decodeUsers)) &&
    (data['users'] == null || isListData(data['users'], decodeUsers))
  );
}
export function decodeContact(value: unknown): ContactData {
  if (isContact(value)) return value;
  const data = userObject(value);
  if (!data) throw new TypeError('Invalid dialog contacts');
  return {
    ...data,
    ...(data['oftenUsers'] == null ? {} : { oftenUsers: decodeUserList(data['oftenUsers']) }),
    ...(data['users'] == null ? {} : { users: decodeUserList(data['users']) }),
  };
}
function isDepartment(value: unknown): value is SelectDepartment {
  const data = userObject(value);
  return (
    !!data &&
    typeof data['departmentId'] === 'string' &&
    typeof data['departmentName'] === 'string' &&
    optionalNumber(data['userCount']) &&
    optionalBoolean(data['haveSubDepartment']) &&
    optionalBoolean(data['disabled']) &&
    (optionalBoolean(data['open']) ||
      (typeof data['open'] === 'number' && Number.isInteger(data['open']) && data['open'] >= 0)) &&
    optionalBoolean(data['checkIncludeChilren']) &&
    optionalString(data['parentId']) &&
    (data['subDepartments'] === undefined ||
      (Array.isArray(data['subDepartments']) && Array.from(data['subDepartments']).every(isDepartment))) &&
    (data['users'] === undefined || validUsers(data['users']))
  );
}
function validUsers(value: unknown) {
  try {
    decodeUsers(value);
    return true;
  } catch {
    return false;
  }
}
export function decodeDepartments(value: unknown): SelectDepartment[] {
  if (!Array.isArray(value) || !Array.from(value).every(isDepartment))
    throw new TypeError('Invalid dialog departments');
  return value;
}
function isGroup(value: unknown): value is SelectGroup {
  const data = userObject(value);
  return (
    !!data &&
    typeof data['groupId'] === 'string' &&
    typeof data['name'] === 'string' &&
    optionalNumber(data['groupMemberCount']) &&
    optionalBoolean(data['open']) &&
    (data['users'] === undefined || validUsers(data['users']))
  );
}
export function decodeGroups(value: unknown): SelectGroup[] {
  if (!Array.isArray(value) || !Array.from(value).every(isGroup)) throw new TypeError('Invalid dialog groups');
  return value;
}
export const decodeDepartmentList = (value: unknown) => decodeList(value, decodeDepartments);
export const decodeGroupList = (value: unknown) => decodeList(value, decodeGroups);
export function decodeDepartmentName(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid department full name');
  return value;
}
export function savedBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) return fallback;
  const parsed: unknown = safeParse(value);
  return typeof parsed === 'boolean' ? parsed : fallback;
}

/** Only the two account-project fields consumed by the header are promised. */
export interface DialogProjectHeader {
  projectId?: string | undefined;
  companyName?: string | undefined;
}
function isProjectHeader(value: unknown): value is DialogProjectHeader {
  const project = userObject(value);
  return !!project && optionalString(project['projectId']) && optionalString(project['companyName']);
}
export function decodeProjectHeaders(value: unknown): DialogProjectHeader[] {
  if (!Array.isArray(value) || !Array.from(value).every(isProjectHeader))
    throw new TypeError('Invalid dialog projects');
  return value;
}
