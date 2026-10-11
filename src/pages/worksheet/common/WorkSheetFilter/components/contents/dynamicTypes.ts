import type { ReactNode } from 'react';
import type { FormControl } from 'src/utils/controlTypes';
import type { EditingFilter, FilterCondition, FilterDynamicSource, FilterValues } from '../../filterModelTypes';
import type { SearchChange } from './selectionTypes';

export type EditorChange = Pick<
  FilterCondition,
  | 'value'
  | 'minValue'
  | 'maxValue'
  | 'values'
  | 'fullValues'
  | 'type'
  | 'folded'
  | 'dateRange'
  | 'dateRangeType'
  | 'dynamicSource'
  | 'isDynamicsource'
>;
export interface EditorValueProps extends FilterValues {
  control: FormControl;
  controlType?: number | undefined;
  conditionType?: number | undefined;
  type?: number | undefined;
  onChange: (patch: EditorChange) => void;
  disabled?: boolean | undefined;
  projectId?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  from?: string | number | undefined;
  currentColumns?: FormControl[] | undefined;
  relationColumns?: FormControl[] | undefined;
  globalSheetControls?: FormControl[] | undefined;
  sourceControlId?: string | undefined;
  showCustom?: boolean | undefined;
  widgetControlData?: unknown;
  relateSheetList?: unknown;
  filterResigned?: boolean | undefined;
}
export interface DynamicChoice extends FormControl {
  isNavGroup?: boolean | undefined;
}
export interface DynamicWidgetContext {
  globalSheetId?: string | undefined;
  dataSource?: string | undefined;
  controlId?: string | undefined;
  isSubList?: boolean | undefined;
}
export interface RelateBoxProps {
  showUl?: boolean | undefined;
  keywords: string;
  setKeys: (keywords: string) => void;
  onChangeFn: (choice: DynamicChoice, selected?: boolean) => void;
  control: FormControl;
  columns?: FormControl[] | undefined;
  globalSheetControls?: FormControl[] | undefined;
  conditionType?: number | undefined;
  defaultValue?: number | undefined;
  from?: string | number | undefined;
  sourceControlId?: string | undefined;
  showCustom?: boolean | undefined;
  widgetControlData?: unknown;
  relateSheetList?: unknown;
  onClickAwayExceptions?: string[] | undefined;
  onClickAway?: ((target: EventTarget | null) => void) | undefined;
}
export interface RelateFilterState {
  keywords: string;
  showUl: boolean;
}
export interface RelatedFilterRecord {
  id?: string | number | undefined;
  name?: ReactNode;
  [metadata: string]: unknown;
}
export interface SelectedFilterRow {
  rowid?: string | undefined;
  [controlId: string]: unknown;
}
export interface RelatedFilterState {
  records: RelatedFilterRecord[];
  selectRecordVisible: boolean;
}
export interface TagConProps<T extends { name?: ReactNode }> {
  disabled?: boolean | undefined;
  data: T[];
  renderItem?: ((item: T) => ReactNode) | undefined;
  onRemove: (item: T) => void;
  needInput?: boolean | undefined;
  search?: string | undefined;
  keywords?: string | undefined;
  onChangeInput?: ((change: SearchChange) => void) | undefined;
}
export interface FilterTitleListProps {
  title?: ReactNode;
  isCharge?: boolean | undefined;
  activeFilter?: EditingFilter | undefined;
  controls?: FormControl[] | undefined;
  filters?: EditingFilter[] | undefined;
  filterAddConditionControls?: ((controls: FormControl[]) => FormControl[]) | undefined;
  onSortEnd?: ((ids: string[]) => void) | undefined;
  onEditFilter?: ((filter: EditingFilter) => void) | undefined;
  onCopy?: ((filter: EditingFilter) => void) | undefined;
  onDelete?: ((filter: EditingFilter) => void) | undefined;
  onToggleFilterType?: ((filter: EditingFilter) => void) | undefined;
  triggerFilter?: ((filter: EditingFilter) => void) | undefined;
  onHideFilterPopup?: (() => void) | undefined;
}
export interface SavedFiltersProps extends FilterTitleListProps {
  maxHeight?: number | undefined;
  filters: EditingFilter[];
  addFilter: () => void;
  onSortEnd: (ids: string[]) => void;
}
export type DynamicSources = FilterDynamicSource[];
