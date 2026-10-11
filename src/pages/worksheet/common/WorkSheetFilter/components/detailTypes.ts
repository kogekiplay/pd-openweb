import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { TriggerProps } from '@rc-component/trigger';
import type { FormControl } from 'src/utils/controlTypes';
import type { ConditionProps } from '../conditionTypes';
import type { EditingFilter } from '../filterModelTypes';
import type { FilterPanelBase } from '../filterPanelTypes';
import type { FilterActions } from '../model';

export interface SelectControlsProps {
  controls: FormControl[];
  style?: CSSProperties | undefined;
  maxHeight?: number | undefined;
  footer?: ReactNode | undefined;
  className?: string | undefined;
  classNamePopup?: string | undefined;
  filterColumnClassName?: string | undefined;
  selected?: string | readonly (string | undefined)[] | undefined;
  onAdd?: ((control: FormControl) => void) | undefined;
  onClose?: (() => void) | undefined;
  /** Accepted by AddCondition's call, not consumed by this selector. */
  visible?: boolean | undefined;
}
export interface AddConditionProps {
  columns?: FormControl[] | undefined;
  onAdd: (control: FormControl) => void;
  from?: string | number | undefined;
  disabled?: boolean | undefined;
  defaultVisible?: boolean | undefined;
  doNotCloseMenuWhenAdd?: boolean | undefined;
  isAppendToBody?: boolean | undefined;
  renderInParent?: boolean | undefined;
  conditionCount?: number | undefined;
  filterColumnClassName?: string | undefined;
  widgetControlData?: unknown;
  style?: CSSProperties | undefined;
  classNamePopup?: string | undefined;
  /** Existing callers pass this value; the legacy add-condition wrapper ignores it. */
  className?: string | undefined;
  popupAlign?: TriggerProps['popupAlign'];
  offset?: number[] | undefined;
  children?: ReactNode | undefined;
  comp?: (() => ReactNode) | undefined;
}
export interface AddConditionState {
  columnListVisible: boolean;
}
export interface FilterDetailProps {
  controls: FormControl[];
  filter?: EditingFilter | undefined;
  actions: Pick<
    FilterActions,
    | 'saveFilter'
    | 'changeEditingFilter'
    | 'addCondition'
    | 'updateCondition'
    | 'deleteConditionsGroup'
    | 'deleteCondition'
    | 'updateConditionsGroup'
    | 'deleteGroup'
    | 'addGroup'
  >;
  base?: FilterPanelBase | undefined;
  conditionProps?: Partial<ConditionProps> | undefined;
  from?: string | number | undefined;
  maxHeight?: number | undefined;
  showQueryButton?: boolean | undefined;
  queryButtonDisabled?: boolean | undefined;
  supportGroup?: boolean | undefined;
  isSingleFilter?: boolean | undefined;
  canEdit?: boolean | undefined;
  needSave?: boolean | undefined;
  nameIsUpdated?: boolean | undefined;
  hideSave?: boolean | undefined;
  filterResigned?: boolean | undefined;
  filterError?: unknown;
  isRules?: boolean | undefined;
  showCustom?: boolean | undefined;
  filterAddConditionControls?: ((controls: FormControl[]) => FormControl[] | undefined) | undefined;
  setActiveTab?: ((tab: number) => void) | undefined;
  handleTriggerFilter?: ((filter: EditingFilter) => void) | undefined;
  onAddCondition?: (() => void) | undefined;
  onBack?: ((discard?: boolean) => void) | undefined;
  onQuery?: MouseEventHandler<HTMLDivElement> | undefined;
}
export interface EmptyProps {
  controls?: FormControl[] | undefined;
  isNew?: boolean | undefined;
  maxHeight?: number | undefined;
  onAdd?: ((control: FormControl) => void) | undefined;
}
export interface FilterDetailNameProps {
  name?: string | undefined;
  withStar?: boolean | undefined;
  editable?: boolean | undefined;
  onChange?: ((value: string | undefined) => unknown) | undefined;
}
export interface QueryButtonProps {
  num?: number | undefined;
  hasQuery?: boolean | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}
export interface SaveButtonChoice {
  name: ReactNode;
  disabled?: boolean | undefined;
  onClick: () => unknown;
}
export interface SaveButtonProps {
  disabled?: boolean | undefined;
  downList?: SaveButtonChoice[] | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}
export interface SplitDropdownProps {
  canEdit?: boolean | undefined;
  type?: number | undefined;
  onChange: (value: number | undefined) => void;
  onDelete: MouseEventHandler<HTMLDivElement>;
}
