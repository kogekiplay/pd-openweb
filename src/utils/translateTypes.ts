import type { ControlAdvancedSetting } from './controlTypes';

export interface TranslationAdvancedSetting extends ControlAdvancedSetting {
  otherhint?: string | undefined;
  doubleconfirm?: string | undefined;
}
export interface TranslationItem extends Record<string, unknown> {
  key: string;
  value?: string | undefined;
}
export interface TranslationConfirmation {
  confirmMsg?: string | undefined;
  confirmContent?: string | undefined;
  sureName?: string | undefined;
  cancelName?: string | undefined;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';
function isTranslationItem(value: unknown): value is TranslationItem {
  return isRecord(value) && typeof value['key'] === 'string' && optionalString(value['value']);
}
export function isTranslationItems(value: unknown): value is TranslationItem[] {
  return Array.isArray(value) && value.every(isTranslationItem);
}
export function isTranslationConfirmation(value: unknown): value is TranslationConfirmation {
  return (
    isRecord(value) &&
    ['confirmMsg', 'confirmContent', 'sureName', 'cancelName'].every(key => optionalString(value[key]))
  );
}
