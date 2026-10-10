import type { QuickUser, UserStatus } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function userObject(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) ? value : undefined;
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function isStatus(value: unknown): value is UserStatus {
  const status = userObject(value);
  return (
    !!status &&
    ['statusId', 'accountId', 'icon', 'remark', 'beginTime', 'endTime'].every(key => optionalString(status[key])) &&
    (status['durationOption'] === undefined ||
      (typeof status['durationOption'] === 'number' && Number.isFinite(status['durationOption'])))
  );
}
function isUser(value: unknown): value is QuickUser {
  const user = userObject(value);
  return (
    !!user &&
    typeof user['accountId'] === 'string' &&
    ['fullname', 'name', 'avatar', 'avatarSmall', 'phone', 'mobilePhone', 'email', 'job', 'department'].every(key =>
      optionalString(user[key]),
    ) &&
    (user['onStatusOption'] === undefined || isStatus(user['onStatusOption']))
  );
}
export function decodeUsers(value: unknown): QuickUser[] {
  if (!Array.isArray(value) || !Array.from(value).every(isUser)) throw new TypeError('Invalid user selection response');
  return value;
}
