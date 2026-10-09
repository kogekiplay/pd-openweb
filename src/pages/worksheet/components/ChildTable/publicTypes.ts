import type { FormQueryConfig } from 'src/components/Form/core/queryTypes';
import type { FormRule } from 'src/components/Form/core/types';
import type { FormControl } from 'src/utils/controlTypes';
import type {
  ChildTableState,
  ChildTableStore,
  FieldStoreControl,
  FieldStoreMasterData,
} from 'src/utils/subListStoreTypes';

export interface ChildTableControl extends FieldStoreControl {
  setLoadingInfo?: ((key: string, loading: boolean) => void) | undefined;
}
/** registerCell receives the rendered table, while a React ref receives the outer wrapper. */
export interface ChildTableCellRef {
  props: { store: ChildTableStore };
  handleAddRowByLine(): void;
}
export type ChildTableChange = Pick<ChildTableState, 'rows' | 'lastAction' | 'originRows'>;
export interface ChildTableProps {
  control: ChildTableControl;
  onChange: (value: ChildTableChange) => void;
  registerCell?: ((ref: ChildTableCellRef) => void) | undefined;
  addRefreshEvents?:
    | ((
        name: string,
        refresh: ((options?: { needResetControls?: boolean; isRefresh?: boolean }) => unknown) | undefined,
      ) => void)
    | undefined;
  masterData?: (FieldStoreMasterData & { controlId?: string | undefined }) | undefined;
  worksheetId?: string | undefined;
  appId?: string | undefined;
  projectId?: string | undefined;
  viewId?: string | undefined;
  recordId?: string | undefined;
  from?: number | undefined;
  mode?: string | undefined;
  entityName?: string | undefined;
  formItemId?: string | undefined;
  initSource?: boolean | undefined;
  initRowIsCreate?: boolean | undefined;
  isDraft?: boolean | undefined;
  isWorkflow?: boolean | undefined;
  mobileIsEdit?: boolean | undefined;
  disabled?: boolean | undefined;
  showSearch?: boolean | undefined;
  showExport?: boolean | undefined;
  needResetControls?: boolean | undefined;
  valueChanged?: boolean | undefined;
  disableValidate?: boolean | undefined;
  enableRules?: boolean | undefined;
  controls?: FormControl[] | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  rules?: FormRule[] | undefined;
  sheetSwitchPermit?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
  maxShowRowCount?: number | undefined;
  maxHeight?: number | undefined;
  /** Opaque render invalidation values are compared/passed through without interpreting payloads. */
  flag?: unknown;
  refreshFlag?: unknown;
}
export interface MobileChildTableProps extends Omit<ChildTableProps, 'onChange'> {
  onChange: (value: ChildTableChange, previousValue?: unknown) => void;
}
export interface ChildTableWrapperState {
  retrying: boolean;
}
/** Existing rows are requested from the master worksheet, not control.dataSource. */
export function retryChildTableStore(
  props: Pick<ChildTableProps, 'control' | 'recordId' | 'worksheetId' | 'masterData'>,
  store: ChildTableStore,
): Promise<void> {
  const { base } = store.getState();
  const recordId = props.recordId ?? base.recordId;
  if (!recordId) return store.init();
  const worksheetId = props.worksheetId ?? props.masterData?.worksheetId ?? base.masterData?.worksheetId;
  const controlId = props.control.controlId ?? base.control?.controlId;
  if (!worksheetId || !controlId) return Promise.reject(new TypeError('Missing child row request identifiers'));
  return store.initAndLoadRows({ worksheetId, recordId, controlId });
}
type InjectedTableProps = Pick<ChildTableState, 'baseLoading' | 'base' | 'rows' | 'lastAction'> & {
  store: ChildTableStore;
  registerCell: (ref: ChildTableCellRef) => void;
  retrying: boolean;
  onRetry: () => void;
};
export type ChildTableRenderProps = ChildTableProps & InjectedTableProps;
export type MobileChildTableRenderProps = MobileChildTableProps & InjectedTableProps;
