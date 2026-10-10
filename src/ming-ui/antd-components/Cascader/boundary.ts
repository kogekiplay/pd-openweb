import type { CascaderLoadResult, CascaderOption, CascaderValue } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function label(value: unknown) {
  return value == null || typeof value === 'string' || typeof value === 'number';
}
function isValue(value: unknown): value is CascaderValue {
  return isObject(value) && typeof value['value'] === 'string' && label(value['label']);
}
function isOption(value: unknown, ancestors: Set<object>): value is CascaderOption {
  if (!isValue(value)) return false;
  if (ancestors.has(value)) return false;
  if (value['isLeaf'] !== undefined && typeof value['isLeaf'] !== 'boolean') return false;
  if (value['checkable'] !== undefined && typeof value['checkable'] !== 'boolean') return false;
  if (value['path'] != null && typeof value['path'] !== 'string') return false;
  const children = value['children'];
  if (children == null) return true;
  if (!Array.isArray(children)) return false;
  ancestors.add(value);
  const valid = Array.from(children).every(child => isOption(child, ancestors));
  ancestors.delete(value);
  return valid;
}
export function cascaderOptions(value: unknown): CascaderOption[] {
  if (!Array.isArray(value) || !Array.from(value).every(option => isOption(option, new Set())))
    throw new TypeError('Invalid Cascader options');
  return value;
}
export function cascaderValues(value: unknown): CascaderValue[] {
  if (!Array.isArray(value) || !Array.from(value).every(isValue)) throw new TypeError('Invalid Cascader selection');
  return value;
}
export function searchPath(value: CascaderOption): string[] {
  const parsed: unknown = JSON.parse(value.path || '[]');
  if (!Array.isArray(parsed) || !Array.from(parsed).every(part => typeof part === 'string'))
    throw new TypeError('Invalid Cascader search path');
  return parsed;
}
export function loadOutcome(value: unknown): CascaderLoadResult {
  // Existing native Promise<void> loaders complete by publishing options before resolving.
  if (value === undefined) return { status: 'loaded' };
  if (isObject(value)) {
    if (value['status'] === 'loaded') return { status: 'loaded' };
    if (value['status'] === 'cancelled') return { status: 'cancelled' };
    if (value['status'] === 'failed') return { status: 'failed', error: value['error'] };
  }
  return { status: 'failed', error: new TypeError('Invalid Cascader loading completion') };
}
export function cancellation(error: unknown): boolean {
  return isObject(error) && error['errorCode'] === 1;
}
