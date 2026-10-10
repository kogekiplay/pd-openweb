import type { MouseEvent } from 'react';

/** The actual five producers use worksheet/control/role/knowledge string IDs. */
export type DropdownKey = string;
export type DropdownLabel = string | undefined;
export type SelectionEvent = MouseEvent<HTMLElement>;
interface OptionFields {
  label?: string | undefined;
  disabled?: boolean | undefined;
  items?: DropdownOption[] | undefined;
  [metadata: string]: unknown;
}
export interface ChoiceOption extends OptionFields {
  type?: undefined;
  value: DropdownKey;
}
export interface DecorationOption extends OptionFields {
  type: 'header' | 'divider';
  value?: DropdownKey | undefined;
}
export type DropdownOption = ChoiceOption | DecorationOption;
export type ValuedOption = DropdownOption & { value: DropdownKey };
export type ParentOption = ChoiceOption & { items: DropdownOption[] };
export type DropdownValue = DropdownKey | DropdownKey[] | null | undefined;
export type SingleSelectionLabel = DropdownLabel | DropdownLabel[];
export interface BaseDropdownProps {
  options?: DropdownOption[] | undefined;
  label?: string | string[] | undefined;
  className?: string | undefined;
  maxSelectNum?: number | undefined;
  emptyHint?: string | undefined;
  multipleLevel?: boolean | undefined;
  filter?: boolean | undefined;
  filterHint?: string | undefined;
  multipleHideDropdownNav?: boolean | undefined;
  disabled?: boolean | undefined;
}
export type SingleCallback = (event: SelectionEvent, value: DropdownKey, label: SingleSelectionLabel) => void;
export type MultipleCallback = (event: SelectionEvent, value: DropdownKey[], labels: DropdownLabel[]) => void;
export interface SingleSelectionProps extends BaseDropdownProps {
  multipleSelect?: false | undefined;
  value?: DropdownValue;
  onChange?: SingleCallback | undefined;
  onClick?: SingleCallback | undefined;
}
export interface MultipleSelectionProps extends BaseDropdownProps {
  multipleSelect: true;
  value?: DropdownKey[] | null | undefined;
  onChange?: MultipleCallback | undefined;
  onClick?: MultipleCallback | undefined;
}
export type MultipleDropdownProps = SingleSelectionProps | MultipleSelectionProps;
export interface DropdownState {
  value: DropdownValue;
  label: string | string[];
  menuOpened: boolean;
}
/** Menu keeps the historical four-argument event/value/label/autoHide callback. */
export interface DropdownMenuProps extends BaseDropdownProps {
  multipleSelect?: boolean | undefined;
  value?: DropdownValue;
  openMenu?: boolean | undefined;
  onChange: (
    event: SelectionEvent,
    value: DropdownKey | DropdownKey[],
    label: SingleSelectionLabel,
    autoHide: boolean,
  ) => void;
}
export type CheckedItems = Record<string, ValuedOption | null>;
export interface MenuState {
  value: DropdownValue;
  options: DropdownOption[];
  availOptions: DropdownOption[];
  list: ParentOption[];
  checkedItems: CheckedItems;
  filterText: string;
  filter?: string | undefined;
}
