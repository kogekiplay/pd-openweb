import type { DialogUserSettings } from 'ming-ui/functions/dialogSelectUser/GeneralSelect/types';
import type { FormControl } from 'src/utils/controlTypes';

/** Actual serialized filter entities; unknown metadata stays attached to the original object. */
export interface SelectionItem {
  id?: string | number | undefined;
  name?: string | undefined;
  temp?: boolean | undefined;
  [metadata: string]: unknown;
}
export interface SelectionUser {
  accountId?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
  [metadata: string]: unknown;
}
export interface SelectionChange {
  values?: Array<string | number | undefined> | undefined;
  fullValues?: string[] | undefined;
  folded?: boolean | undefined;
}
export interface SelectionProps {
  control: FormControl;
  onChange: (change: SelectionChange) => void;
  fullValues?: string[] | undefined;
  values?: Array<string | number | undefined> | undefined;
  type?: number | undefined;
  disabled?: boolean | undefined;
  projectId?: string | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  from?: string | number | undefined;
  folded?: boolean | undefined;
  filterResigned?: boolean | undefined;
}
export interface OptionsState {
  selectedOptions: SelectionItem[];
  keywords: string | undefined;
  search: string | undefined;
}
export interface UsersState {
  users: SelectionUser[];
}
export interface CascaderState {
  records: SelectionItem[];
}
export interface SearchChange {
  keywords?: string | undefined;
  search?: string | undefined;
}
export type SelectUserOptions = Omit<DialogUserSettings, 'callback'>;
