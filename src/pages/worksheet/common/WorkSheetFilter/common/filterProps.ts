import type { ReactNode } from 'react';
import type { FormControl } from 'src/utils/controlTypes';
import type { SheetSwitchPermitItem } from 'src/utils/worksheetTypes';
import type { FilterCondition, FilterSaveItem, FilterWireCondition } from '../filterModelTypes';

/** Data read by the panels, with opaque child-only context passed through intact. */
interface SharedFilterProps {
  appId?: string | undefined;
  projectId?: string | undefined;
  from?: string | number | undefined;
  canEdit?: boolean | undefined;
  isRules?: boolean | undefined;
  feOnly?: boolean | undefined;
  showSystemControls?: boolean | undefined;
  columns?: FormControl[] | undefined;
  currentColumns?: FormControl[] | undefined;
  globalSheetControls?: FormControl[] | undefined;
  sourceControlId?: string | undefined;
  filterDept?: boolean | undefined;
  filterResigned?: boolean | undefined;
  filterColumnClassName?: string | undefined;
  relateSheetList?: unknown;
}

export interface FilterConfigProps extends SharedFilterProps {
  /** Raw serialized/filter-setting members are decoded at the model's origin boundary. */
  conditions?: readonly unknown[] | undefined;
  onConditionsChange: (conditions: FilterSaveItem[]) => void;
  version?: string | number | undefined;
  viewId?: string | undefined;
  supportGroup?: boolean | undefined;
  sheetSwitchPermit?: SheetSwitchPermitItem[] | undefined;
  filterError?: unknown;
  urlParams?: string[] | undefined;
  showCustom?: boolean | undefined;
  widgetControlData?: unknown;
  disableAddCondition?: boolean | undefined;
  /** Accepted by existing callers; the panel does not consume these two values. */
  offset?: readonly number[] | undefined;
}

export interface SingleFilterProps extends SharedFilterProps {
  id?: string | undefined;
  conditions?: readonly unknown[] | undefined;
  onConditionsChange?: ((conditions: FilterWireCondition[]) => void) | undefined;
  controllable?: boolean | undefined;
  conditionItemForDynamicStyle?: boolean | undefined;
  offset?: readonly number[] | undefined;
  comp?: (() => ReactNode) | undefined;
  /** Historical portal caller supplies filters, although this component reads conditions. */
  filters?: unknown;
}
export interface SingleFilterState {
  relationType: number | undefined;
  conditions: FilterCondition[];
}
