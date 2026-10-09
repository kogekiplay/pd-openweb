import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { connect, Provider } from 'react-redux';
import cx from 'classnames';
import { get, includes, isEqual, isFunction } from 'lodash';
import { arrayOf, bool, func, number, shape, string } from 'prop-types';
import styled from 'styled-components';
import { RecordFormContext } from 'worksheet/common/recordInfo/RecordForm';
import { getFilter } from 'src/pages/worksheet/common/WorkSheetFilter/util';
import type { FormControl } from 'src/utils/controlTypes';
import { objectValue } from 'src/utils/recordValueBoundary';
import { isRelateRecordTableStore } from 'src/utils/subListStoreTypes';
import type {
  FieldStoreControl,
  RelateChanges,
  RelateRecordState,
  RelateRecordTableStore,
} from 'src/utils/subListStoreTypes';
import { loadRecords, updateFilter, updateTableConfigByControl } from './redux/action';
import { initialChanges } from './redux/reducer';
import generateStore from './redux/store';
import RelateRecordTable from './RelateRecordTable';

const Con = styled.div`
  position: relative;
  line-height: 1.5;
  ${({ useHeight }) => useHeight && 'height: 100%;'}
  ${({ isSplit }) => isSplit && 'flex: 1; overflow: hidden; display: flex; flex-direction: column;'}
`;

export interface RelateRecordTableProps {
  control: FieldStoreControl;
  mode?: string | undefined;
  appId?: string | undefined;
  isCharge?: boolean | undefined;
  allowEdit?: boolean | undefined;
  pageSize?: number | undefined;
  worksheetId?: string | undefined;
  recordId?: string | undefined;
  instanceId?: string | undefined;
  workId?: string | undefined;
  openFrom?: string | undefined;
  formData?: FormControl[] | undefined;
  sheetSwitchPermit?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
  onCountChange?: ((count: number | undefined, changed: boolean | undefined) => void) | undefined;
  isDraft?: boolean | undefined;
  useHeight?: boolean | undefined;
  isSplit?: boolean | undefined;
  saveSync?: boolean | undefined;
  formItemId?: string | undefined;
  onUpdateCell?: (() => void) | undefined;
  updateWorksheetControls?: ((controls: FormControl[]) => void) | undefined;
  setRelateNumOfControl?: ((controlId: string, count: number | undefined) => void) | undefined;
}
interface RelateWrapperCache {
  changes: Pick<RelateChanges, 'addedRecordIds' | 'deletedRecordIds'>;
  storeVersion?: string | undefined;
  count?: number | undefined;
}
interface RelationContentProps {
  store: RelateRecordTableStore;
  tableProps: RelateRecordTableProps;
  loading: boolean;
  error: string | undefined;
}
const RelationContent = connect((state: RelateRecordState) => ({
  loading: state.loading || !!state.tableState.tableLoading,
  error: state.tableState.error,
}))(({ store, tableProps, loading, error }: RelationContentProps) => {
  if (error) {
    return (
      <div
        role="alert"
        className="flexRow alignItemsCenter justifyContentCenter textTertiary"
        style={{ minHeight: 74 }}
      >
        {_l('加载失败')}
        <button
          type="button"
          className="ThemeColor Hand"
          style={{ marginInlineStart: 'var(--space-2)' }}
          disabled={loading}
          onClick={() => {
            const retry = store.getState().initialized ? store.dispatch(loadRecords()) : store.init();
            void retry.catch((failure: unknown) => console.error(failure));
          }}
        >
          {_l('重试')}
        </button>
      </div>
    );
  }
  return <RelateRecordTable {...tableProps} />;
});

export default function RelateRecordTableIndex(props: RelateRecordTableProps) {
  const {
    mode,
    appId,
    control,
    isCharge,
    allowEdit,
    pageSize,
    worksheetId,
    recordId,
    openFrom,
    formData = [],
    sheetSwitchPermit,
    onCountChange,
    isDraft,
  } = props;
  const formContext: unknown = useContext(RecordFormContext);
  const recordbase = objectValue(objectValue(formContext)?.['recordbase']);
  const instanceId = typeof recordbase?.['instanceId'] === 'string' ? recordbase['instanceId'] : undefined;
  const workId = typeof recordbase?.['workId'] === 'string' ? recordbase['workId'] : undefined;
  // Filter results are only an effect invalidation token here; the action owns their interpretation.
  const [filters, setFilters] = useState<unknown>(false);
  const cache = useRef<RelateWrapperCache>({
    changes: { addedRecordIds: [], deletedRecordIds: [] },
  });
  const store = useMemo<RelateRecordTableStore>(() => {
    cache.current = {
      changes: { addedRecordIds: [], deletedRecordIds: [] },
    };
    const existingStore = control.store;
    if (existingStore) {
      if (!isRelateRecordTableStore(existingStore)) throw new TypeError('Expected a relation table store');
      return existingStore;
    }
    return generateStore(control, {
      mode,
      recordId,
      allowEdit,
      worksheetId,
      formData,
      pageSize,
      sheetSwitchPermit,
      isCharge,
      appId,
      instanceId,
      workId,
      isDraft,
      openFrom,
    });
  }, [control.controlId, isRelateRecordTableStore(control.store) ? control.store.version : undefined]);
  useEffect(() => {
    cache.current.storeVersion = store.version;
    return store.subscribe(() => {
      if (cache.current.storeVersion !== store.version) return;
      const state = store.getState();
      if (!state.initialized || state.loading || state.tableState.error) return;
      const lastAction = get(state, 'lastAction');

      if (includes(['UPDATE_BASE', 'UPDATE_TABLE_STATE'], lastAction?.type)) {
        return;
      }

      const keywords = state?.tableState?.keywords;

      if (keywords) {
        return;
      }

      let changed = !isEqual(cache.current.changes, state.changes) && !isEqual(state.changes, initialChanges);

      if (lastAction?.type === 'DELETE_RECORDS') {
        changed = true;
      }

      const newCount =
        !state.base.saveSync && typeof state.tableState.countForShow !== 'undefined'
          ? state.tableState.countForShow
          : state.tableState.count;

      if ((cache.current.count !== newCount || !recordId) && isFunction(onCountChange)) {
        onCountChange(newCount, state.base.isTab ? state.changes.changed : changed);
      }

      cache.current.count = newCount;
      cache.current.changes = state.changes;
    });
  }, [store.version]);
  useEffect(() => {
    if (control.type !== 51) return;
    const filterControl = { ...control, relationControls: store.getState().controls, recordId };
    setFilters(
      getFilter({
        control: filterControl,
        formData,
        filterKey: 'resultfilters',
        appId,
      }),
    );
  }, [
    recordId,
    formData
      .filter(
        (a: FormControl) =>
          typeof a.controlId === 'string' &&
          (control.advancedSetting?.['resultfilters'] || '').indexOf(a.controlId) > -1,
      )
      .map(c => c.value)
      .join(''),
  ]);
  useEffect(() => {
    if (control.type !== 51) return;
    store.dispatch({
      type: 'UPDATE_BASE',
      value: { formData, recordId },
    });
    if (!store.getState().loading && control.type === 51) {
      store.dispatch(updateFilter());
    }
  }, [filters]);
  useEffect(() => {
    if (typeof allowEdit !== 'undefined') {
      store.dispatch({
        type: 'UPDATE_BASE',
        value: { allowEdit },
      });
      store.dispatch(updateTableConfigByControl());
    }
  }, [allowEdit]);
  useEffect(() => {
    void store.init().catch((error: unknown) => console.error(error));
  }, [store.version]);
  return (
    <Provider store={store}>
      <Con useHeight={props.useHeight} isSplit={props.isSplit} className={cx({ flexColumn: props.useHeight })}>
        <RelationContent store={store} tableProps={props} />
      </Con>
    </Provider>
  );
}

RelateRecordTableIndex.propTypes = {
  useHeight: bool,
  allowEdit: bool,
  pageSize: number,
  control: shape({}),
  worksheetId: string,
  recordId: string,
  formData: arrayOf(shape({})),
  sheetSwitchPermit: arrayOf(shape({})),
  onCountChange: func,
};
