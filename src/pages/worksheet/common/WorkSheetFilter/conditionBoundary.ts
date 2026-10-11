import type { Key } from 'react';
import type { FormControl } from 'src/utils/controlTypes';
import type { ConditionError } from './conditionTypes';
import { CONTROL_FILTER_WHITELIST } from './enum';
import { getTypeKey } from './util';

export function firstConditionType(options: readonly { value: number }[]): number {
  const first = options[0];
  if (first === undefined) throw new TypeError('Missing condition filter type');
  return first.value;
}

/** Dropdown permits clearing; no numeric coercion or enum remapping. */
export function conditionNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  throw new TypeError('Invalid condition selector value');
}
export function conditionParameter(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid condition URL parameter');
}
export function conditionKey(value: unknown): Key | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  throw new TypeError('Invalid condition key');
}
export function conditionGroupType(control: FormControl | undefined): number | '' {
  if (!control) return '';
  const key = getTypeKey(control.type);
  // A present unsupported control used to fail on whitelist[undefined].value.
  if (key === undefined) throw new TypeError('Unsupported condition control type');
  return CONTROL_FILTER_WHITELIST[key].value;
}
/** FormSet emits class-name strings; its no-error branches are falsy. */
export function conditionErrorRows(value: unknown): readonly ConditionError[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(item => item === undefined || item === null || item === false || typeof item === 'string')
  )
    throw new TypeError('Invalid condition errors');
  return value;
}
