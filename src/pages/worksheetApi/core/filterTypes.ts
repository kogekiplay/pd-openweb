/** FilterConfig's feOnly callback emits editing conditions, including unfinished fields. */
export interface ApiFilterFields {
  [metadata: string]: unknown;
  controlId?: string | undefined;
  dataType?: number | undefined;
  filterType?: number | undefined;
  spliceType?: number | undefined;
  value?: string | number | null | undefined;
  values?: unknown[] | undefined;
  minValue?: string | number | null | undefined;
  maxValue?: string | number | null | undefined;
}
export interface ApiFilterCondition extends ApiFilterFields {
  isGroup?: false | undefined;
}
export interface ApiFilterGroup extends ApiFilterFields {
  isGroup: true;
  /** Unfinished legacy groups are ignored by the API v3 formatter. */
  groupFilters?: ApiFilterItem[] | undefined;
}
export type ApiFilterItem = ApiFilterCondition | ApiFilterGroup;
export type ApiFilterVersion = 'apiV2' | 'apiV3';
/** Array members remain opaque: legacy parsed id properties are emitted without scalar coercion. */
export type ApiV3Value = string | number | null | unknown[];
export interface ApiV3Condition {
  type: 'condition';
  field: string | undefined;
  operator: string | undefined;
  value: ApiV3Value;
}
export interface ApiV3Group {
  type: 'group';
  logic: string | undefined;
  children: Array<ApiV3Condition | ApiV3Group>;
}
export type ApiV3Filters = ApiV3Group | Record<string, never>;
