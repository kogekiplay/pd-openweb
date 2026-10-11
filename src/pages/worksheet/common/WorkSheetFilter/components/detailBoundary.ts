import type { FormControl } from 'src/utils/controlTypes';
import { conditionErrorRows } from '../conditionBoundary';

export function filterDetailId(value: string | undefined): string {
  if (value === undefined) throw new TypeError('Missing worksheet filter ID');
  return value;
}
export function filterGroupErrors(value: unknown, index: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid worksheet filter error groups');
  const group: unknown = value[index];
  return group ? conditionErrorRows(group) : [];
}
export function searchableControlName(control: FormControl): string {
  if (control.controlName === undefined) throw new TypeError('Missing worksheet field name');
  return control.controlName.toLowerCase();
}
/** Only these fields are read from the opaque add-condition widget context. */
export function addConditionWidgetType(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') throw new TypeError('Invalid add-condition widget context');
  const type: unknown = Reflect.get(value, 'type');
  if (type === undefined) return undefined;
  if (typeof type === 'number') return type;
  throw new TypeError('Invalid add-condition widget type');
}
