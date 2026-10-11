import type { MouseEventHandler } from 'react';
import type { FormControl } from 'src/utils/controlTypes';
import type { EditingFilter, FilterCondition, FilterConditionsGroup } from './filterModelTypes';

/** Context forwarded to the selected value editor; child-only payloads stay opaque. */
export interface ConditionContextProps {
  projectId?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  from?: string | number | undefined;
  currentColumns?: FormControl[] | undefined;
  columns?: FormControl[] | undefined;
  globalSheetControls?: FormControl[] | undefined;
  relateSheetList?: unknown;
  widgetControlData?: unknown;
  sourceControlId?: string | undefined;
  filterResigned?: boolean | undefined;
  filterDept?: boolean | undefined;
  isRules?: boolean | undefined;
  showCustom?: boolean | undefined;
  disableAddCondition?: boolean | undefined;
  urlParams?: string[] | undefined;
}
export type ConditionError = string | false | null | undefined;
export interface ConditionProps extends ConditionContextProps {
  condition: FilterCondition;
  control?: FormControl | undefined;
  conditionGroupType?: number | '' | undefined;
  conditionError?: ConditionError;
  canEdit?: boolean | undefined;
  index?: number | undefined;
  relationType?: number | undefined;
  conditionsLength?: number | undefined;
  isSheetFieldError?: boolean | undefined;
  onChange(changes: Partial<FilterCondition>): void;
  onDelete(): void;
  /** Consumed by the legacy relation selector, accepted but unused by V2. */
  onUpdateFilter?: ((changes: Partial<EditingFilter>) => void) | undefined;
}
export interface LegacyConditionProps extends ConditionProps {
  onUpdateFilter(changes: Partial<EditingFilter>): void;
}
export interface ConditionState {
  isDynamicsource: boolean | undefined;
}
export interface ConditionV2State extends ConditionState {
  valueType: number | undefined;
}
export type DynamicConditionContext = Pick<ConditionProps, 'condition' | 'control' | 'from'>;
export interface ConditionsGroupProps extends Pick<
  ConditionContextProps,
  'from' | 'appId' | 'worksheetId' | 'projectId' | 'filterResigned' | 'isRules' | 'showCustom' | 'widgetControlData'
> {
  conditions: FilterCondition[];
  controls: FormControl[];
  isSingleFilter?: boolean | undefined;
  isGroup?: boolean | undefined;
  conditionsGroupsLength?: number | undefined;
  conditionSpliceType?: number | undefined;
  canEdit?: boolean | undefined;
  conditionProps?: Partial<ConditionProps> | undefined;
  filterError?: readonly ConditionError[] | undefined;
  filterAddConditionControls?: ((controls: FormControl[]) => FormControl[] | undefined) | undefined;
  onAdd(control: FormControl): void;
  onChange(changes: Partial<FilterCondition>, index: number): void;
  onDelete(index: number): void;
  onUpdateGroup(changes: Partial<FilterConditionsGroup>): void;
}
export type FilterItemFilter = EditingFilter & { conditions: FilterCondition[] };
export interface FilterItemProps {
  projectId?: string | undefined;
  appId?: string | undefined;
  showCustomAddCondition?: boolean | undefined;
  isCharge?: boolean | undefined;
  disableSave?: boolean | undefined;
  expanded?: boolean | undefined;
  selected?: boolean | undefined;
  unsaved?: boolean | undefined;
  columns: FormControl[];
  index?: number | undefined;
  filter: FilterItemFilter;
  hideFilter(): void;
  onExpand(): void;
  onDelete(filter: FilterItemFilter): void;
  onCopy(filter: FilterItemFilter): void;
  onRename(name: string): void;
  onUpdateFilterType(type: number): void;
  onFilter(): void;
  onSave(filter: FilterItemFilter): void;
  onSaveNew: MouseEventHandler<HTMLSpanElement>;
  onSaveAs(filter: FilterItemFilter): void;
  addCondition(filter: FilterItemFilter, condition: FilterCondition, afterAdd: () => void): void;
  updateCondition(filter: FilterItemFilter, index: number, changes: Partial<FilterCondition>): void;
  deleteCondition(filter: FilterItemFilter, index: number): void;
  updateFilter(filter: FilterItemFilter, changes: Partial<EditingFilter>): void;
}
