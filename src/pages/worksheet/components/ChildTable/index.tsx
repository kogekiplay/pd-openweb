import React from 'react';
import { shallowEqual } from 'react-redux';
import { connect, Provider } from 'react-redux';
import { get, isFunction } from 'lodash';
import DataFormat from 'src/components/Form/core/DataFormat';
import { isChildTableStore } from 'src/utils/subListStoreTypes';
import type { ChildTableState, ChildTableStore } from 'src/utils/subListStoreTypes';
import ChildTable from './ChildTable';
import { retryChildTableStore } from './publicTypes';
import type { ChildTableCellRef, ChildTableProps, ChildTableRenderProps, ChildTableWrapperState } from './publicTypes';
import generateStore from './redux/store';
import './style.less';

const ChildTableComp = connect((state: ChildTableState) => ({
  baseLoading: state.baseLoading,
  base: state.base,
  rows: state.rows,
  lastAction: state.lastAction,
}))((props: ChildTableRenderProps) => {
  const { retrying, onRetry, ...tableProps } = props;
  const { baseLoading, base, store } = tableProps;
  if (base.initializationError || base.rowLoadError) {
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
          disabled={retrying || baseLoading || store.getState().dataLoading}
          onClick={onRetry}
        >
          {_l('重试')}
        </button>
      </div>
    );
  }

  if (baseLoading || retrying) {
    return (
      <div
        style={{
          minHeight: 74,
          background: 'var(--color-background-secondary)',
        }}
      ></div>
    );
  }

  return <ChildTable {...tableProps} />;
});
export default class extends React.Component<ChildTableProps, ChildTableWrapperState> {
  declare store: ChildTableStore;
  declare unsubscribe: (() => void) | undefined;
  declare unmounted: boolean;

  constructor(props: ChildTableProps) {
    super(props);
    this.state = { retrying: false };
    this.unmounted = false;
    const { worksheetId, recordId, masterData } = props;
    const existingStore = props.control.store;
    if (existingStore) {
      if (!isChildTableStore(existingStore)) throw new TypeError('Expected a child table store');
      this.store = existingStore;
    } else {
      this.store = generateStore(props.control, {
        initRowIsCreate: props.initRowIsCreate,
        relationWorksheetId: worksheetId,
        recordId,
        masterData,
        DataFormat,
      });
    }
    void this.store.init().catch((error: unknown) => console.error(error));
    this.bindSubscribe();
  }

  override componentDidUpdate(prevProps: ChildTableProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.control.store && this.props.control.store !== this.store) {
        const existingStore = this.props.control.store;
        if (!isChildTableStore(existingStore)) throw new TypeError('Expected a child table store');
        if (this.state.retrying) this.setState({ retrying: false });
        this.store = existingStore;
        void this.store.init().catch((error: unknown) => console.error(error));
        this.bindSubscribe();
      }
    }
  }

  override componentWillUnmount() {
    this.unmounted = true;
    if (isFunction(this.props.control.setLoadingInfo)) {
      this.props.control.setLoadingInfo('loadRows_' + this.props.control.controlId, false);
    }

    if (isFunction(this.unsubscribe)) {
      this.unsubscribe();
    }
  }

  bindSubscribe() {
    this.unsubscribe?.();
    const { onChange } = this.props;
    this.unsubscribe = this.store.subscribe(() => {
      const state = this.store.getState();

      if (state.base.initializationError || state.base.rowLoadError) {
        if (this.state.retrying && !state.baseLoading && !state.dataLoading) this.setState({ retrying: false });
        return;
      }

      if (get(state, 'lastAction.type') === 'LOAD_ROWS_COMPLETE') {
        if (this.state.retrying) this.setState({ retrying: false });
        this.store.waitListForLoadRows.forEach(fn => fn());
        this.store.waitListForLoadRows = [];
        return;
      }

      // realCount 仅为内部统计（未筛选真实总数），rows 未变，不构成数据变更，
      // 不向大表单上报，否则会被当成子表变更误触发记录详情进入编辑态。
      if (get(state, 'lastAction.type') === 'SET_REAL_COUNT') {
        return;
      }

      onChange({
        rows: state.rows,
        lastAction: state.lastAction,
        originRows: state.originRows,
      });
    });
  }

  retryLoad = () => {
    const store = this.store;
    this.setState({ retrying: true });
    void retryChildTableStore(this.props, store)
      .then(() => {
        if (!this.unmounted && this.store === store && !(this.props.recordId ?? store.getState().base.recordId))
          this.setState({ retrying: false });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!this.unmounted && this.store === store) this.setState({ retrying: false });
      });
  };

  override render() {
    const { registerCell = () => {} } = this.props;
    return (
      <Provider store={this.store}>
        <ChildTableComp
          {...this.props}
          store={this.store}
          retrying={this.state.retrying}
          onRetry={this.retryLoad}
          registerCell={(ref: ChildTableCellRef) => {
            registerCell(ref);
            this.store.ref = ref;
          }}
        />
      </Provider>
    );
  }
}
