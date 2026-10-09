import type { QuickFilterDisplayValue, WorksheetFilterCondition } from 'src/pages/worksheet/types';

/** URL defaults are emitted by ConditionV2 without backend-only required isAsync/type fields. */
export type QuickFilterDynamicSource = NonNullable<WorksheetFilterCondition['dynamicSource']>[number];
export interface QuickFilterCondition extends WorksheetFilterCondition {
  /** Kept for DateTime to recover the originally configured range operator. */
  originalFilterType?: number | undefined;
  /** parseUrlValue sets this alongside dateRange for URL dates. */
  dateType?: number | undefined;
}
/** Empty selections and primitive number values reach the formatter before it keeps supported strings/IDs. */
export type QuickFilterInputValue = QuickFilterDisplayValue | number | boolean | null | undefined;
export interface FilterSelectedEntity {
  id?: string | undefined;
  name?: string | undefined;
  avatar?: string | undefined;
}
