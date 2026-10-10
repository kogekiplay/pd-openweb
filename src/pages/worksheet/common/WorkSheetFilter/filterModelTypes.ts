import type { FormControl } from '../../../../utils/controlTypes';

/** Partial editor conditions are intentionally valid under feOnly/noCheck. */
export type FilterScalar = string | number | boolean | null | undefined;
export interface FilterDynamicSource {
  [metadata: string]: unknown;
  cid?: string | undefined;
  rcid?: string | undefined;
  staticValue?: string | number | undefined;
}
export interface FilterValues {
  values?: unknown[] | undefined;
  fullValues?: unknown[] | undefined;
  value?: FilterScalar;
  minValue?: FilterScalar;
  maxValue?: FilterScalar;
  dateRange?: number | undefined;
  dateRangeType?: number | string | undefined;
  isDynamicsource?: boolean | undefined;
  dynamicSource?: FilterDynamicSource[] | undefined;
  emptyRule?: number | undefined;
  folded?: boolean | undefined;
}
export interface FilterCondition extends FilterValues {
  [metadata: string]: unknown;
  controlId?: string | undefined;
  controlType?: number | undefined;
  dataType?: number | undefined;
  type?: number | undefined;
  filterType?: number | undefined;
  spliceType?: number | undefined;
  conditionGroupType?: number | undefined;
  control?: FormControl | undefined;
  keyStr?: string | undefined;
  lastAction?: string | undefined;
}
export type FilterConditionEvaluation = Pick<
  FilterCondition,
  | 'type'
  | 'controlType'
  | 'dataType'
  | 'conditionGroupType'
  | 'value'
  | 'values'
  | 'minValue'
  | 'maxValue'
  | 'dateRange'
>;
export type FilterEvaluationInput = FilterConditionEvaluation & {
  isDynamicsource?: boolean | number | undefined;
  dynamicSource?: Array<Pick<FilterDynamicSource, 'cid' | 'rcid'>> | undefined;
};
export interface FilterWireFields extends FilterValues {
  [metadata: string]: unknown;
  controlId?: string | undefined;
  dataType?: number | undefined;
  filterType?: number | undefined;
  spliceType?: number | undefined;
}
export interface FilterWireCondition extends FilterWireFields {
  isGroup?: false | undefined;
}
export interface FilterWireGroup extends FilterWireFields {
  isGroup: true;
  groupFilters?: FilterWireItem[] | undefined;
}
export type FilterWireItem = FilterWireCondition | FilterWireGroup;
export interface FilterSavedGroup extends FilterWireGroup {
  groupFilters: FilterWireCondition[];
}
export type FilterSaveItem = FilterWireCondition | FilterSavedGroup;
export interface FilterConditionsGroup {
  [metadata: string]: unknown;
  spliceType?: number | undefined;
  conditionSpliceType?: number | undefined;
  conditions: FilterCondition[];
  isGroup?: boolean | undefined;
  groupFilters?: FilterWireItem[] | undefined;
  lastAction?: string | undefined;
}
export interface EditingFilter {
  [metadata: string]: unknown;
  id?: string | undefined;
  name?: string | undefined;
  type?: number | undefined;
  createAccountId?: string | undefined;
  isGroup?: boolean | undefined;
  conditionsGroups?: FilterConditionsGroup[] | undefined;
  conditions?: FilterCondition[] | undefined;
  relationType?: number | undefined;
  lastAction?: string | undefined;
}
export interface SavedFilter {
  [metadata: string]: unknown;
  filterId?: string | undefined;
  name?: string | undefined;
  type?: number | undefined;
  createAccountId?: string | undefined;
  items?: FilterWireItem[] | null | undefined;
}
export interface OriginFilter extends EditingFilter {
  conditions: FilterCondition[];
  relationType: number | undefined;
}
export interface OriginGroupFilter extends EditingFilter {
  id: string;
  conditionsGroups: FilterConditionsGroup[];
}
export interface FilterState {
  [metadata: string]: unknown;
  filters?: EditingFilter[] | undefined;
  editingFilter?: EditingFilter | undefined;
  activeFilter?: EditingFilter | undefined;
  editingFilterVersion?: number | undefined;
  conditionsGroups?: FilterConditionsGroup[] | undefined;
  isGroupFilter?: boolean | undefined;
  loading?: boolean | undefined;
  nameIsUpdated?: boolean | undefined;
  needSave?: boolean | undefined;
  lastAction?: string | undefined;
  error?: string | undefined;
}
/** Extra fields are produced locally by Embed, quick filters and worksheet row adapters. */
export interface FilterFormControl extends FormControl {
  recordId?: string | undefined;
  ignoreFilterControl?: boolean | undefined;
  filterValue?: FilterWireCondition | undefined;
  rcValue?: unknown;
}
export type FilterAction =
  | { type: 'INIT' | 'UPDATE'; value?: Partial<FilterState> | undefined }
  | { type: 'ADD_FILTER' | 'UPDATE_FILTER'; filter: EditingFilter }
  | { type: 'DELETE_FILTER'; filterId: string | undefined }
  | { type: 'CHANGE_EDITING_FILTER'; value: Partial<EditingFilter> }
  | { type: 'ADD_CONDITION'; condition: FilterCondition; groupIndex: number }
  | { type: 'UPDATE_CONDITION'; value: Partial<FilterCondition>; groupIndex: number; conditionIndex: number }
  | { type: 'UPDATE_CONDITIONS_GROUP'; value: Partial<FilterConditionsGroup>; groupIndex: number | '*' }
  | { type: 'DELETE_CONDITION'; groupIndex: number; conditionIndex: number }
  | { type: 'DELETE_CONDITIONS_GROUP' | 'DELETE_GROUP'; groupIndex: number }
  | { type: 'CLEAR_CONDITIONS' | 'RESET' }
  | { type: 'UPDATE_FILTERS'; value: EditingFilter[] }
  | { type: 'UPDATE_LOADING'; value: boolean }
  | { type: 'ADD_GROUP'; group: FilterConditionsGroup }
  | { type: 'SORT_FILTERS'; ids: string[] };
export type FilterDispatch = (action: FilterAction) => void;
export interface SaveFilterOptions {
  appId?: string | undefined;
  worksheetId?: string | undefined;
  filter: EditingFilter;
}
