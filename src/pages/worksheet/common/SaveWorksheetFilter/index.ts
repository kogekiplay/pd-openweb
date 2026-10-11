import functionWrap from 'ming-ui/components/FunctionWrap';
import SaveWorksheetFilter from './SaveWorksheetFilter';
import type { SaveWorksheetFilterOptions } from './types';

export default SaveWorksheetFilter;
export const saveWorksheetFilter = (props: SaveWorksheetFilterOptions): void =>
  functionWrap(SaveWorksheetFilter, props);
export type { SaveWorksheetFilterOptions, SavedFilterSelection } from './types';
