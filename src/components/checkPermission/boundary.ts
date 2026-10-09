import type { PermissionFlag, PermissionId } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isNumericPermissionId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function isPermissionFlag(value: unknown): value is PermissionFlag {
  return (
    value === 'NOT_MEMBER' ||
    value === 'SHOW_APPLY' ||
    value === 'SHOW_MY_CHARACTER' ||
    value === 'SHOW_MANAGER' ||
    value === 'CAN_PURCHASE'
  );
}
export function isPermissionId(value: unknown): value is PermissionId {
  return isNumericPermissionId(value) || isPermissionFlag(value);
}
/** Fail the entire response if any identifier is malformed, rather than caching a partially trusted grant. */
export function permissionIds(value: unknown): number[] {
  if (!isObject(value)) throw new TypeError('Invalid permission response');
  const ids = value['permissionIds'];
  if (ids === undefined) return [];
  if (!Array.isArray(ids) || !ids.every(isNumericPermissionId)) throw new TypeError('Invalid permission identifiers');
  return ids;
}
export function permissionVersion(value: unknown): string {
  if (!isObject(value) || value['version'] === undefined) return '';
  if (typeof value['version'] !== 'string') throw new TypeError('Invalid permission cache version');
  return value['version'];
}
