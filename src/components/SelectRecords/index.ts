import functionWrap from 'ming-ui/components/FunctionWrap';
import SelectDialog from './SelectDialog';

export function selectRecords(props: Record<string, unknown> = {}) {
  functionWrap(SelectDialog, props);
}
