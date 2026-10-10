import type {
  CheckedItems,
  ChoiceOption,
  DropdownOption,
  MultipleDropdownProps,
  MultipleSelectionProps,
  ParentOption,
  SingleSelectionProps,
  ValuedOption,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isOption(value: unknown, ancestors: Set<object>): value is DropdownOption {
  if (!isObject(value) || ancestors.has(value)) return false;
  if (value['label'] !== undefined && typeof value['label'] !== 'string') return false;
  if (value['disabled'] !== undefined && typeof value['disabled'] !== 'boolean') return false;
  if (value['type'] === undefined) {
    if (typeof value['value'] !== 'string') return false;
  } else if (value['type'] !== 'header' && value['type'] !== 'divider') return false;
  else if (value['value'] !== undefined && typeof value['value'] !== 'string') return false;
  const items = value['items'];
  if (items === undefined) return true;
  if (!Array.isArray(items)) return false;
  ancestors.add(value);
  const valid = Array.from(items).every(item => isOption(item, ancestors));
  ancestors.delete(value);
  return valid;
}
export function dropdownOptions(value: unknown): DropdownOption[] {
  if (!Array.isArray(value) || !Array.from(value).every(item => isOption(item, new Set())))
    throw new TypeError('Invalid MultipleDropdown options');
  return value;
}
export function hasValue(item: DropdownOption): item is ValuedOption {
  return typeof item.value === 'string';
}
export function hasItems(item: ChoiceOption): item is ParentOption {
  return !!item.items?.length;
}
export function isChoiceOption(item: DropdownOption): item is ChoiceOption {
  return item.type === undefined;
}
export function isMultipleSelection(props: MultipleDropdownProps): props is MultipleSelectionProps {
  return props.multipleSelect === true;
}
export function isSingleSelection(props: MultipleDropdownProps): props is SingleSelectionProps {
  return props.multipleSelect !== true;
}
/** Dictionary values are only option objects; arbitrary string IDs cannot read Object.prototype. */
export function emptyCheckedItems(): CheckedItems {
  return Object.create(null);
}
