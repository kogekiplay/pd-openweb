export { WIDGET_VALUE_ID } from 'src/components/Form/core/config';
export { FIELD_REG_EXP, transferValue } from 'src/utils/controlCommon';
export { checkCellIsEmpty } from 'src/utils/control';
export { getCheckAndOther, getUserValue } from 'src/components/Form/core/utils';

import type { SelectedEntityValue } from 'src/utils/controlTypes';

const selectionValueIds: Readonly<Record<number, keyof SelectedEntityValue>> = {
  26: 'accountId', 27: 'departmentId', 29: 'sid', 35: 'sid', 48: 'organizeId',
};

function parseSelectionValue(value: unknown): SelectedEntityValue[] {
  const parsed: unknown = Array.isArray(value) ? value : safeParse(value, 'array');
  return Array.isArray(parsed) ? parsed.filter((item): item is SelectedEntityValue => Boolean(item) && typeof item === 'object') : [];
}

export function getControlCompareValue<T>(control: { type?: number | undefined }, value: T): T | string {
  const type = control.type;
  if (type === undefined || ![26, 27, 29, 48].includes(type)) return value;
  const key = selectionValueIds[type];
  return key ? parseSelectionValue(value).map(item => item[key]).sort().join('') : value;
}

export function getControlUniqueValue<T>(value: T, type: number): T | string {
  if (![26, 27, 29, 48].includes(type)) return value;
  const key = selectionValueIds[type];
  const parsedValue = typeof value === 'string' && value.startsWith('deleteRowIds') ? '[]' : value || '[]';
  return key ? parseSelectionValue(parsedValue).map(item => item[key]).join('') : value;
}

export function getRelateRecordRowIds(value: unknown): string[] {
  return parseSelectionValue(value).map(item => item.sid).filter((id): id is string => Boolean(id));
}

export function withKeepShowRowIds(ignoreRowIds: string[] = [], control: { keepShowRowIds?: string[] | undefined } = {}): string[] {
  const keepShowRowIds = control.keepShowRowIds || [];
  return keepShowRowIds.length ? [...new Set(ignoreRowIds.concat(keepShowRowIds))] : ignoreRowIds;
}
