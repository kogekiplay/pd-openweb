import React, { useContext, useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import cx from 'classnames';
import _, { get, identity, isFunction, pick } from 'lodash';
import PropTypes, { bool, func, shape } from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from 'ming-ui';
import autoSize from 'ming-ui/components/AutoSize';
import worksheetAjax from 'src/api/worksheet';
import { getRowDetail } from 'worksheet/api';
import { batchEditRecord } from 'worksheet/common/BatchEditRecord';
import RecordInfo from 'worksheet/common/recordInfo/RecordInfoWrapper';
import { getSheetViewRows, getTreeExpandCellWidth } from 'worksheet/common/TreeTableHelper';
import getTableColumnWidth from 'worksheet/components/BaseColumnHead/getTableColumnWidth';
import GroupByControl from 'worksheet/components/GroupByControl';
import OperateButtons from 'worksheet/components/OperateButtons';
import WorksheetTable from 'worksheet/components/WorksheetTable';
import { ColumnHead, RowHead, SummaryCell } from 'worksheet/components/WorksheetTable/components/';
import { ROW_HEIGHT, SHEET_VIEW_HIDDEN_TYPES } from 'worksheet/constants/enum';
import {
  refreshWorksheetControls,
  saveView,
  updateWorksheetInfo,
  updateWorksheetSomeControls,
} from 'worksheet/redux/actions';
import * as sheetviewActions from 'worksheet/redux/actions/sheetview';
import { isHaveCharge } from 'worksheet/redux/actions/util';
import DataFormat from 'src/components/Form/core/DataFormat';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/components/Form/core/enum';
import { openMingoCreateRecord } from 'src/components/Mingo/modules/CreateRecordBot';
import { permitList } from 'src/pages/FormSet/config.js';
import { isOpenPermit } from 'src/pages/FormSet/util.js';
import { putControlByOrder } from 'src/pages/widgetConfig/util';
import { renderBatchSetDialog } from 'src/pages/worksheet/common/ViewConfig/components/BatchSet';
import { NORMAL_SYSTEM_FIELDS_SORT, WORKFLOW_SYSTEM_FIELDS_SORT } from 'src/pages/worksheet/common/ViewConfig/enum';
import { getUserRole } from 'src/pages/worksheet/redux/actions/util';
import type { RootState } from 'src/redux/types';
import { browserIsMobile, emitter, getLRUWorksheetConfig } from 'src/utils/common';
import { controlState } from 'src/utils/control';
import { getAdvanceSetting, getHighAuthControls } from 'src/utils/control';
import { isPseudoControl } from 'src/utils/controlTypes';
import type { ControlValue, FormControl, MaybeSummaryHeadControl, RecordRow } from 'src/utils/controlTypes';
import { addBehaviorLog } from 'src/utils/project';
import { getRecordColorConfig, handleRecordClick } from 'src/utils/record';
import {
  filterButtonBySheetSwitchPermit,
  getFiltersForGroupedView,
  getGroupControlId,
  getOperatesButtonsWidth,
  getSheetOperatesButtons,
  getSheetOperatesButtonsStyle,
} from 'src/utils/worksheet';
import SheetContext from '../common/Sheet/SheetContext';
import ColumnVisibilityControl from './components/ColumnVisibilityControl';
import ToolBar from './HierarchyView/ToolBar';

/**
 * WorksheetTable 回传给各个 render* 回调的格子入参。
 *
 * 字段都写成【必填】而不是可选：这些值由表格组件按格子位置逐个填好再调回来，
 * 运行时一定有。写成可选的话，strictNullChecks 下 columns[columnIndex] 这类
 * 取值立刻变成「undefined 不能当索引」，是拿一类错换另一类错。
 * 索引签名留给表格以后新加的字段，回调按需解构、用不到的不必列。
 */
/** 操作列上的按钮；分组按钮是 group_ref，真正的成员按钮在 buttons 里 */
interface SheetOperateButton {
  btnId: string;
  type?: string;
  buttons?: SheetOperateButton[];
  [key: string]: any;
}

/** checkButtonStatus 回来的「哪些按钮对哪些行可用」 */
interface SheetButtonRowState {
  btnId: string;
  rowIds: string[];
  [key: string]: any;
}

interface TableRenderArgs {
  className: string;
  style: React.CSSProperties;
  rowIndex: number;
  columnIndex: number;
  row: RecordRow;
  control: FormControl;
  data: RecordRow[];
  fixedColumnCount: number;
  getColumnWidth: (index: number) => number;
  /** 调用方会传第三个 rowIndex，handleCellClick 自己用不到 —— 形参少于类型是允许的 */
  onCellClick: (cell: FormControl | undefined, row: RecordRow, rowIndex?: number) => void;
  [key: string]: any;
}

function setRowIndexForSheetView(rows: RecordRow[]) {
  const rowIndexMap: Record<string, number> = {};
  rows.forEach((r: RecordRow) => {
    if (typeof r.allowedit !== 'undefined' && r.groupKey) {
      const newRowIndex = rowIndexMap[r.groupKey] || 1;
      r.rowIndexNumber = newRowIndex;
      rowIndexMap[r.groupKey] = newRowIndex + 1;
    }
  });
  return rows;
}

/** 分组标题格的 props。字段就是下面解构出来的那 22 个。 */
interface GroupTitleCellProps {
  className?: string;
  style?: React.CSSProperties;
  /** 分组行，key 是分组值 */
  row?: { key?: string; [field: string]: ControlValue };
  columnIndex?: number;
  getColumnWidth?: (index: number) => number;
  view?: ControlValue;
  appId?: string;
  worksheetId?: string;
  viewId?: string;
  projectId?: string;
  /** 分组折叠状态：分组 key -> 是否折叠 */
  foldedMap?: Record<string, boolean>;
  updateFolded?: (key: string, folded: boolean) => void;
  sheetViewData?: ControlValue;
  changeWorksheetSheetViewSummaryType?: (...args: ControlValue[]) => void;
  insertToGroupedRow?: (...args: ControlValue[]) => void;
  fixedColumnCount?: number;
  allWorksheetIsSelected?: boolean;
  sheetSelectedRows?: { rowid?: string }[];
  allowAdd?: boolean;
  lineEditable?: boolean;
  columns?: FormControl[];
  rowHeadOnlyNum?: boolean;
}

// 优化的分组标题组件
const GroupTitleCell = React.memo(
  ({
    className,
    style,
    row,
    columnIndex,
    getColumnWidth,
    view,
    appId,
    worksheetId,
    viewId,
    projectId,
    foldedMap,
    updateFolded,
    sheetViewData,
    changeWorksheetSheetViewSummaryType,
    insertToGroupedRow,
    fixedColumnCount,
    allWorksheetIsSelected,
    sheetSelectedRows,
    allowAdd,
    lineEditable,
    columns,
    rowHeadOnlyNum,
  }: GroupTitleCellProps) => {
    // 缓存计算结果
    const groupRows = useMemo(
      () => (sheetViewData.rows || []).filter(({ rowid }: RecordRow) => rowid === 'groupTitle'),
      [sheetViewData.rows],
    );

    const allFolded = useMemo(() => _.every(groupRows, ({ key }) => foldedMap[key]), [groupRows, foldedMap]);

    const rowsOfThisGroup = useMemo(
      () => (sheetViewData.rows || []).filter(({ groupKey }: RecordRow) => groupKey === row.key),
      [sheetViewData.rows, row.key],
    );

    const selectedIds = useMemo(() => sheetSelectedRows.map(r => r.rowid), [sheetSelectedRows]);

    const control = useMemo(
      () =>
        // 裸字面量里 type 会被推成 string，得显式钉成哨兵联合
        ([{ type: 'summaryhead' }] as MaybeSummaryHeadControl[]).concat(columns)[columnIndex],
      [columns, columnIndex],
    );

    // 缓存回调函数
    const handleFold = React.useCallback(
      (value: boolean) => {
        updateFolded(row.key, value);
      },
      [updateFolded, row.key],
    );

    const handleAllFold = React.useCallback(
      (value: boolean) => {
        updateFolded('all', value);
      },
      [updateFolded],
    );

    const handleAdd = React.useCallback(
      (record: RecordRow) => {
        insertToGroupedRow({ ...record, group: row });
      },
      [insertToGroupedRow, row],
    );

    const handleSummaryTypeChange = React.useCallback(
      (args: { controlId?: string; summaryType?: number; [key: string]: any }) => {
        groupRows.forEach((r: RecordRow) => {
          changeWorksheetSheetViewSummaryType({
            ...args,
            groupArgs: {
              groupKey: r.key,
              value: args.value,
              filters: getFiltersForGroupedView(r.control, r.key),
              groupRows,
            },
          });
        });
      },
      [changeWorksheetSheetViewSummaryType, groupRows],
    );

    const newStyle = { ...style, height: 34 };

    if (columnIndex === 0) {
      let newClassName = className;

      if (fixedColumnCount === 0 || fixedColumnCount === 1) {
        newClassName += ' cellRight2px';
      }

      newStyle.width = getColumnWidth(0) + getColumnWidth(1);
      newStyle.backgroundColor = 'var(--color-background-secondary)';
      return (
        <GroupByControl
          view={view}
          allowAdd={allowAdd}
          lineEditable={lineEditable}
          projectId={projectId}
          appId={appId}
          worksheetId={worksheetId}
          viewId={viewId}
          folded={foldedMap[row.key]}
          allFolded={allFolded}
          className={newClassName}
          style={newStyle}
          count={row.count}
          control={row.control}
          groupKey={row.key}
          name={row.name}
          onFold={handleFold}
          onAllFold={handleAllFold}
          onAdd={handleAdd}
        />
      );
    }

    if (columnIndex === 1) {
      return null;
    }

    const newClassName = className + ' noRightBorder';
    const { groupRowsSummary } = sheetViewData;
    const summaryType = control && get(groupRowsSummary, `types.${get(control, 'controlId')}`);
    const summaryValue = control && get(groupRowsSummary, `${row.key}.values.${get(control, 'controlId')}`);
    return (
      <SummaryCell
        className={newClassName}
        isGroupTitle
        rowHeadOnlyNum={rowHeadOnlyNum}
        style={newStyle}
        viewId={viewId}
        summaryType={summaryType}
        summaryValue={summaryValue}
        control={control}
        rows={rowsOfThisGroup}
        selectedIds={selectedIds}
        allWorksheetIsSelected={allWorksheetIsSelected}
        changeWorksheetSheetViewSummaryType={handleSummaryTypeChange}
      />
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，只在关键属性变化时重新渲染
    const keyProps = [
      'row.key',
      'row.count',
      'row.name',
      'columnIndex',
      'foldedMap',
      'sheetViewData.rows',
      'sheetViewData.groupRowsSummary',
      'sheetSelectedRows',
      'allowAdd',
      'lineEditable',
      'columns',
      'view.advancedSetting',
      'style',
    ];

    return keyProps.every(prop => {
      const prevValue = get(prevProps, prop);
      const nextValue = get(nextProps, prop);
      return _.isEqual(prevValue, nextValue);
    });
  },
);

// 优化的行头组件
const MemoizedRowHead = React.memo(
  ({
    className,
    style,
    rowIndex,
    data,
    isCharge,
    isDevAndOps,
    appId,
    view,
    viewId,
    controls,
    worksheetInfo,
    buttons,
    sheetViewData,
    sheetViewConfig,
    tableType,
    numberWidth,
    hasBatch,
    showNumber,
    showOperate,
    readonly,
    rowHeadOnlyNum,
    tableId,
    lineNumberBegin,
    sheetSwitchPermit,
    onSelectAllWorksheet,
    onSelect,
    onReverseSelect,
    updateRows,
    hideRows,
    handleAddSheetRow,
    saveSheetLayout,
    resetSheetLayout,
    setHighLight,
    refreshWorksheetControls,
    onOpenRecord,
    chartId,
    columns,
    isDraft,
    printCharge,
    layoutChangeVisible,
  }) => {
    const { allowAdd, worksheetId, projectId } = worksheetInfo;
    const { allWorksheetIsSelected, sheetSelectedRows } = sheetViewConfig;

    if (_.isEmpty(view) && !chartId) {
      return <span />;
    }

    let isGroupTableView = !!getGroupControlId(view);

    return (
      <RowHead
        isDraft={isDraft}
        printCharge={printCharge}
        tableType={tableType}
        numberWidth={numberWidth}
        hasBatch={hasBatch}
        showNumber={showNumber}
        showOperate={showOperate}
        count={sheetViewData.count}
        readonly={readonly}
        isCharge={isCharge}
        isDevAndOps={isDevAndOps}
        rowHeadOnlyNum={rowHeadOnlyNum}
        tableId={tableId}
        layoutChangeVisible={layoutChangeVisible}
        className={className}
        {...{ appId, viewId, worksheetId }}
        columns={columns}
        controls={controls}
        projectId={projectId}
        allowAdd={allowAdd}
        style={style}
        lineNumberBegin={lineNumberBegin}
        canSelectAll={!!sheetViewData.rows.length}
        allWorksheetIsSelected={allWorksheetIsSelected}
        selectedIds={sheetSelectedRows.map(r => r.rowid)}
        sheetSwitchPermit={sheetSwitchPermit}
        customButtons={buttons}
        view={view}
        worksheetInfo={worksheetInfo}
        onSelectAllWorksheet={onSelectAllWorksheet}
        onSelect={onSelect}
        onReverseSelect={onReverseSelect}
        updateRows={updateRows}
        hideRows={(rowIds: string[]) => {
          hideRows(rowIds);
        }}
        rowIndex={rowIndex}
        data={isGroupTableView ? setRowIndexForSheetView(data) : data}
        handleAddSheetRow={handleAddSheetRow}
        saveSheetLayout={saveSheetLayout}
        resetSheetLayout={resetSheetLayout}
        setHighLight={setHighLight}
        refreshWorksheetControls={refreshWorksheetControls}
        onOpenRecord={onOpenRecord}
      />
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，只在关键属性变化时重新渲染
    const keyProps = [
      'className',
      'layoutChangeVisible',
      'rowIndex',
      'data',
      'style',
      'view.viewId',
      'view.advancedSetting.showno',
      'view.advancedSetting.showquick',
      'view.advancedSetting.layoutupdatetime',
      'view.advancedSetting.layoutUpdateTime',
      'sheetViewData.count',
      'sheetViewData.rows.length',
      'sheetViewConfig.allWorksheetIsSelected',
      'sheetViewConfig.sheetSelectedRows',
      'sheetViewConfig.sheetHiddenColumns',
      'worksheetInfo.allowAdd',
      'isCharge',
      'isDevAndOps',
      'readonly',
      'buttons',
      'controls',
      'columns',
      'hasBatch',
      'showNumber',
      'showOperate',
      'rowHeadOnlyNum',
      'tableType',
      'numberWidth',
    ];

    return keyProps.every(prop => {
      const prevValue = get(prevProps, prop);
      const nextValue = get(nextProps, prop);
      return _.isEqual(prevValue, nextValue);
    });
  },
);

/** getDerivedStateFromProps 里攒出来的 state 增量，键就是下面几处赋值用到的那些。 */
interface SheetViewStatePatch {
  __lastViewId?: string;
  __lastWorksheetId?: string;
  /** sheetViewData.refreshFlag 的上一次取值，用来判断是否需要重置打码字段 */
  __lastRefreshFlag?: string | number;
  /** 自定义按钮的校验状态，切视图时清空 */
  buttonsCheckStatus?: Record<string, boolean>;
  /** 需要打码的字段，刷新时清空 */
  disableMaskDataControls?: Record<string, boolean>;
}

class TableViewBase extends React.Component<any, any> {
  // 这些字段只在构造函数/各方法里 this.x = ... 赋值，TS 不当作字段声明，
  // 不写这几行每次读取都报 TS2339（本文件因此有 26 条）。
  // declare 是纯类型声明，babel 整行擦除，运行时无影响。
  declare tableId: string;
  declare shiftActive: boolean;
  declare shiftActiveRowIndex: number;
  /** 列配置的缓存，与 _lastPropsHash 配对使用（props 未变时直接复用） */
  declare _columnsCache: FormControl[] | null;
  // 不是字符串哈希，是一份「参与列计算的 props 快照」对象，用 isEqual 比对
  declare _lastPropsHash: Record<string, ControlValue> | null;
  /** 未应用个人列设置前的原始列，导出等场景要用 */
  declare columnsNoPersonalSetting: FormControl[];
  declare expandCellAppendWidth: number;
  declare refreshTimer: ReturnType<typeof setTimeout> | null;

  static propTypes = {
    isTreeTableView: bool,
    worksheetInfo: PropTypes.shape({}),
    controls: PropTypes.arrayOf(PropTypes.shape({})),
    sheetFetchParams: PropTypes.shape({}),
    sheetViewData: PropTypes.shape({}),
    sheetViewConfig: PropTypes.shape({}),
    updateDefaultScrollLeft: PropTypes.func,
    updateRows: PropTypes.func,
    hideRows: PropTypes.func,
    clearHighLight: PropTypes.func,
    fetchRows: PropTypes.func,
    setHighLight: PropTypes.func,
    changeWorksheetSheetViewSummaryType: PropTypes.func,
    updateViewPermission: PropTypes.func,
    getWorksheetSheetViewSummary: PropTypes.func,
    updateSheetColumnWidths: PropTypes.func,
    updateWorksheetSomeControls: PropTypes.func,
    initAbortController: PropTypes.func,
    abortRequest: PropTypes.func,
  };

  table = React.createRef();

  static getDerivedStateFromProps(props, state) {
    if (!state.__derivedInited) {
      return {
        __derivedInited: true,
        __lastViewId: props.viewId,
        __lastWorksheetId: props.worksheetId,
        __lastRefreshFlag: get(props, 'sheetViewData.refreshFlag'),
      };
    }

    const patch: SheetViewStatePatch = {};
    const changeView = state.__lastWorksheetId === props.worksheetId && state.__lastViewId !== props.viewId;

    if (changeView) {
      const navGroupData = (get(props, 'worksheetInfo.template.controls') || []).find(
        (o: FormControl) => o.controlId === get(props, 'view.navGroup[0].controlId'),
      );
      const navGroupToSearch =
        !!navGroupData &&
        get(props, 'view.advancedSetting.showallitem') === '1' &&
        !get(props, 'view.navGroup[0].viewId') &&
        (get(props, 'view.navGroup') || []).length > 0;
      const noNavGroup = navGroupToSearch && _.isEmpty(props.navGroupFilters);

      if (!(noNavGroup || get(props, 'view.advancedSetting.clicksearch') === '1')) {
        patch.buttonsCheckStatus = {};
      }
    }

    if (state.__lastViewId !== props.viewId) patch.__lastViewId = props.viewId;
    if (state.__lastWorksheetId !== props.worksheetId) patch.__lastWorksheetId = props.worksheetId;

    const nextRefreshFlag = get(props, 'sheetViewData.refreshFlag');

    if (state.__lastRefreshFlag !== nextRefreshFlag) {
      patch.disableMaskDataControls = {};
      patch.__lastRefreshFlag = nextRefreshFlag;
    }

    return _.isEmpty(patch) ? null : patch;
  }

  constructor(props) {
    super(props);
    this.state = {
      disableMaskDataControls: {},
      buttonsCheckStatus: {},
      operateBtnResetFlag: {},
      columnHeadHeight: 34,
    };
    this.tableId = uuidv4();
    this.shiftActiveRowIndex = 0;
    // 简化的缓存：只缓存最近一次的计算结果
    this._columnsCache = null;
    this._lastPropsHash = null;
    if (isFunction(props.initAbortController)) {
      props.initAbortController();
    }

    this.handlePaste = this.handlePaste.bind(this);
  }

  componentDidMount() {
    const { view, fetchRows, setRowsEmpty, navGroupFilters, noLoadAtDidMount, setViewLayout = () => {} } = this.props;

    if (this.chartId) {
      fetchRows({ isFirst: true });
      this.setState({ buttonsCheckStatus: {} });
    } else if (
      get(view, 'advancedSetting.clicksearch') === '1' ||
      (this.navGroupToSearch() && _.isEmpty(navGroupFilters))
    ) {
      setRowsEmpty();
      setViewLayout(view.viewId);
    } else if (!noLoadAtDidMount) {
      fetchRows({ isFirst: true });
      this.setState({ buttonsCheckStatus: {} });
    }

    document.body?.addEventListener('click', this.outerClickEvent);
    emitter.addListener('RELOAD_RECORD_INFO', this.updateRecordEvent);
    emitter.addListener('RELOAD_SHEET_VIEW', this.props.refresh);
    emitter.addListener('ADD_RECORD_TO_SHEETVIEW', this.addRecordToViewEvent);
    emitter.addListener('RECORD_WORKFLOW_UPDATE', this.recordWorkflowUpdateEvent);
    this.bindShift();
    window[`getTableColumnWidth-${this.props.worksheetId}`] = (control: FormControl) => {
      const width = getTableColumnWidth(
        document.querySelector('.sheetViewTable'),
        _.get(this.props, 'sheetViewData.rows'),
        control,
        _.get(this.props, 'sheetViewConfig.columnStyles'),
        _.get(this.props, 'worksheetId'),
      );
      return width;
    };

    window.addEventListener('paste', this.handlePaste);
  }

  getOperateButtons = props => {
    const { view, sheetButtons, printList } = props;
    let operatesButtons = getSheetOperatesButtons(view, {
      buttons: sheetButtons,
      printList,
    });
    operatesButtons = filterButtonBySheetSwitchPermit(operatesButtons, this.sheetSwitchPermit, view.viewId);
    return operatesButtons;
  };

  getOperateButtonsMaxWidth = ({
    style,
    visibleNum,
    showIcon,
    rows,
  }: {
    style: React.CSSProperties;
    visibleNum: number;
    showIcon: boolean;
    rows: RecordRow[];
  }) => {
    const { view, sheetButtons, printList } = this.props;
    let operatesButtons = getSheetOperatesButtons(view, {
      buttons: sheetButtons,
      printList,
    });

    if (!rows.length || !operatesButtons.length) {
      return 0;
    }

    return Math.max(
      ...rows.map((r: RecordRow) => {
        const buttons = filterButtonBySheetSwitchPermit(operatesButtons, this.sheetSwitchPermit, view.viewId, r);
        return getOperatesButtonsWidth({ buttons, style, visibleNum, showIcon, row: r });
      }),
    );
  };

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const {
        view,
        fetchRows,
        setRowsEmpty,
        changePageIndex,
        refresh,
        navGroupFilters,
        quickFilter,
        setColumnStyles,
        getWorksheetSheetViewSummary,
        abortRequest = () => {},
        setViewLayout = () => {},
      } = this.props;
      const changeView = prevProps.worksheetId === this.props.worksheetId && prevProps.viewId !== this.props.viewId;

      if (!_.isEqual(get(this.props, ['navGroupFilters']), get(prevProps, ['navGroupFilters']))) {
        changePageIndex(1);
      }

      const noNavGroup = this.navGroupToSearch(this.props) && _.isEmpty(navGroupFilters);
      const quickFilterNeedClickToSearch =
        !(this.props.chartId || this.props.chartIdFromUrl) &&
        get(this.props, 'view.advancedSetting.clicksearch') === '1' &&
        _.isEmpty(quickFilter);

      if (changeView) {
        abortRequest();

        if (noNavGroup || get(view, 'advancedSetting.clicksearch') === '1') {
          setRowsEmpty();
          setViewLayout(view.viewId);
        } else {
          fetchRows({
            changeView,
          });
        }
      } else if (
        _.some(
          [
            'sheetFetchParams.pageIndex',
            'sheetFetchParams.sortControls',
            'view.moreSort',
            'view.advancedSetting.clicksearch',
            'view.advancedSetting.enablerules',
            'navGroupFilters',
            'view.navGroup',
            'view.advancedSetting.showallitem',
            'view.advancedSetting.shownullitem',
            'view.advancedSetting.topshow',
            'view.advancedSetting.topfilters',
            'view.advancedSetting.defaultlayer',
            'view.advancedSetting.fastedit',
            'view.advancedSetting.defaultsort',
            'view.advancedSetting.groupsetting',
            'view.advancedSetting.groupfilters',
            'view.advancedSetting.groupshow',
            'view.advancedSetting.groupcustom',
            'view.advancedSetting.groupsorts',
            'view.advancedSetting.groupopen',
            'view.advancedSetting.groupempty',
            'view.viewControl',
          ],
          key => !_.isEqual(get(this.props, key), get(prevProps, key)),
        )
      ) {
        if (noNavGroup || quickFilterNeedClickToSearch) {
          setRowsEmpty();
        } else {
          fetchRows();
        }
      } else if (
        get(prevProps, 'view.advancedSetting.refreshtime') !== get(this.props, 'view.advancedSetting.refreshtime')
      ) {
        console.log('refresh');
      } else if (
        get(prevProps, 'view.advancedSetting.sheettype') !== get(this.props, 'view.advancedSetting.sheettype')
      ) {
        refresh();
      }

      if (
        _.some(['view.advancedSetting.liststyle'], key => !_.isEqual(get(this.props, key), get(prevProps, key))) ||
        _.some(
          ['worksheetInfo.advancedSetting.liststyle'],
          key => !_.isEqual(get(this.props, key), get(prevProps, key)),
        )
      ) {
        setColumnStyles(this.props.view, this.props.worksheetInfo);
        getWorksheetSheetViewSummary({
          reset: true,
        });
      }

      if (
        this.props.operateButtonLoading !== prevProps.operateButtonLoading ||
        this.props.sheetViewData.loading !== prevProps.sheetViewData.loading ||
        !_.isEqual(this.props.sheetViewData.rows, prevProps.sheetViewData.rows) ||
        !_.isEqual(this.getOperateButtons(this.props), this.getOperateButtons(prevProps))
      ) {
        const { pageIndex, pageSize } = this.props.sheetFetchParams;
        const key = `${pageIndex}x${pageSize}`;

        if (
          !this.props.operateButtonLoading &&
          !this.props.sheetViewData.loading &&
          (!get(this, `state.buttonsCheckStatus.${key}`) ||
            !_.isEqual(get(this.props, 'sheetViewData.rows'), get(prevProps, 'sheetViewData.rows')) ||
            !_.isEqual(this.getOperateButtons(this.props), this.getOperateButtons(prevProps)))
        ) {
          const operatesButtons = this.getOperateButtons(this.props);

          if (operatesButtons.length && !_.get(window, 'shareState.shareId')) {
            const rows: RecordRow[] = this.props.sheetViewData.rows;
            const rowIds = rows.map((r: RecordRow) => r.rowid).filter(identity);

            if (_.isEmpty(rowIds)) {
              return;
            }

            worksheetAjax
              .checkWorksheetRowsBtn({
                worksheetId: this.props.worksheetId,
                rowIds,
                // 组内按钮拿不到执行状态时，OperateButtons 里按 status 判定会把分组内按钮全部置灰。
                btnIds: this.getOperateButtonCheckIds(operatesButtons),
              })
              .then(data => {
                const buttonsCheckStatus = {};
                data.forEach((item: SheetButtonRowState) => {
                  item.rowIds.forEach((rowId: string) => {
                    buttonsCheckStatus[`${rowId}-${item.btnId}`] = true;
                  });
                });
                this.setState({
                  buttonsCheckStatus: {
                    [key]: buttonsCheckStatus,
                  },
                });
              });
          }
        }
      }
    }

    const { view } = this.props;

    if (
      !_.isEqual(prevProps.foldedMap, this.props.foldedMap) ||
      (!!getGroupControlId(view) &&
        !_.isEqual(
          prevProps.sheetViewData.rows.filter((r: RecordRow) => r.rowid === 'groupTitle').map((r: RecordRow) => r.count),
          this.props.sheetViewData.rows.filter((r: RecordRow) => r.rowid === 'groupTitle').map((r: RecordRow) => r.count),
        )) ||
      // 操作列「快捷按钮」集合变化（如启用/停用分组内按钮导致空分组显隐）会改变 operatesButtonsWidth，
      // 但 react-window 列宽是缓存的，仅 re-render 传入新宽度不会重测量，需显式 forceUpdate 让其按新宽度重算。
      !_.isEqual(this.getOperateButtons(this.props), this.getOperateButtons(prevProps))
    ) {
      if (_.isFunction(_.get(this.table, 'current.table.refs.forceUpdate'))) {
        this.table.current.table.refs.forceUpdate();
      }
    }
  }

  navGroupToSearch = (props?) => {
    const { view, worksheetInfo } = props || this.props;
    const navGroupData = (get(worksheetInfo, 'template.controls') || []).find(
      (o: FormControl) => o.controlId === get(view, 'navGroup[0].controlId'),
    );
    //设置了筛选列表，且未显示全部，需选择分组后显示
    return (
      !!navGroupData &&
      get(view, 'advancedSetting.showallitem') === '1' &&
      !get(view, 'navGroup[0].viewId') &&
      get(view, 'navGroup').length > 0
    );
  };

  shouldComponentUpdate(nextProps, nextState) {
    return (
      _.some(
        ['recordInfoVisible', 'disableMaskDataControls', 'buttonsCheckStatus'],
        key => !_.isEqual(get(nextState, key), get(this.state, key)),
      ) ||
      _.some(
        [
          'sheetViewData',
          'treeTableViewData',
          'sheetViewConfig',
          'editingControls',
          'controls',
          'view.rowHeight',
          'view.showControls',
          'view.controls',
          'view.moreSort',
          'view.advancedSetting',
          'buttons',
          'printList',
          'worksheetInfo.isRequestingRelationControls',
          'worksheetInfo.advancedSetting.liststyle',
          'operateButtonLoading',
          // 操作列「快捷按钮」依赖 sheetButtons（getOperateButtons 取的就是它）；
          // 启用/停用分组内按钮只改 sheetButtons 的 status，漏听会导致不 re-render、
          // operatesButtonsWidth 不重算 → 快捷按钮列宽度不更新。注意它与 buttons 是两个不同的 prop。
          'sheetButtons',
          'saveViewSetLoading',
          'foldedMap',
          'worksheetId',
          'viewId',
          'sheetFetchParams',
          'navGroupFilters',
          'quickFilter',
          'chartId',
          'chartIdFromUrl',
        ],
        key => !_.isEqual(get(nextProps, key), get(this.props, key)),
      )
    );
  }

  componentWillUnmount() {
    const { abortRequest = () => {} } = this.props;
    document.body?.removeEventListener('click', this.outerClickEvent);
    emitter.removeListener('RELOAD_SHEET_VIEW', this.props.refresh);
    emitter.removeListener('RELOAD_RECORD_INFO', this.updateRecordEvent);
    emitter.removeListener('ADD_RECORD_TO_SHEETVIEW', this.addRecordToViewEvent);
    emitter.removeListener('RECORD_WORKFLOW_UPDATE', this.recordWorkflowUpdateEvent);
    this.unbindShift();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    abortRequest();
    delete window[`getTableColumnWidth-${this.props.worksheetId}`];
    // 清理缓存
    this._columnsCache = null;
    this._lastPropsHash = null;
    window.removeEventListener('paste', this.handlePaste);
  }

  handlePaste(e) {
    if (
      !!document.querySelector('.ant-modal-root') ||
      window.cellisediting ||
      window.cellisfocus ||
      window.newRecordActive ||
      this.state.recordInfoVisible ||
      !this.tableConfig.allowAdd ||
      !isOpenPermit(permitList.createButtonSwitch, this.sheetSwitchPermit) ||
      ['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())
    ) {
      return;
    }

    const text = e.clipboardData.getData('text');
    openMingoCreateRecord(text);
  }

  bindShift() {
    window.addEventListener('keydown', this.activeShift);
    window.addEventListener('keyup', this.deActiveShift);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  unbindShift() {
    window.removeEventListener('keydown', this.activeShift);
    window.removeEventListener('keyup', this.deActiveShift);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  activeShift = (e: KeyboardEvent) => {
    if (e.keyCode === 16) {
      this.shiftActive = true;
      document.querySelector('#worksheetRightContentBox')?.classList.add('noSelect');
    }
  };

  deActiveShift = (e: KeyboardEvent) => {
    if (e.keyCode === 16) {
      this.shiftActive = false;
      document.querySelector('#worksheetRightContentBox')?.classList.remove('noSelect');
    }
  };

  handleWindowBlur = () => {
    this.shiftActive = false;
    document.querySelector('#worksheetRightContentBox')?.classList.remove('noSelect');
  };

  outerClickEvent = e => {
    const { clearHighLight } = this.props;
    if (!e.target.isConnected) return;
    if (
      !$(e.target).closest(
        '.sheetViewTable, .recordInfoCon, .workSheetNewRecord, .createRecordSideMask, .mdModal',
      )[0] ||
      /-grid/.test(e.target.className)
    ) {
      clearHighLight(this.tableId);
      $(`.sheetViewTable.id-${this.tableId}-id .cell`).removeClass('hover');
    }
  };

  updateRecordEvent = ({ worksheetId, recordId }: { worksheetId: string; recordId: string }) => {
    const { viewId, updateRows, hideRows, sheetViewData } = this.props;
    const { rows }: { rows: RecordRow[]; [key: string]: any } = sheetViewData;

    if (worksheetId === this.props.worksheetId && _.find(rows, r => r.rowid === recordId)) {
      getRowDetail({
        checkView: true,
        getType: 1,
        rowId: recordId,
        viewId,
        worksheetId,
      }).then(row => {
        if (row.resultCode === 1 && row.isViewData) {
          updateRows(
            [recordId],
            [
              {
                utime: row.updateTime,
              },
              ...row.formData,
            ].reduce((a = {}, b = {}) => Object.assign(a, { [b.controlId]: b.value })),
          );
        } else {
          hideRows([recordId]);
        }
      });
    }
  };

  // 自定义按钮触发的流程执行结束（成功/失败/未启用）后，解除行内快捷按钮的点击态并重取执行条件。
  // 不能只依赖行数据变化：像「界面推送」这类流程不写记录，utime 不变，
  // OperateButtons 内按 [rowid, utime, refreshFlag] 判定的清理逻辑永远不会触发，按钮会一直灰着。
  recordWorkflowUpdateEvent = ({ recordId, status } = {}) => {
    const { sheetViewData = {} } = this.props;

    // status 1 为执行中，非终态不解除
    if (status === 1) return;

    const rowIds = String(recordId || '')
      .split(',')
      .filter(id => id && _.find(sheetViewData.rows, r => r.rowid === id));

    if (!rowIds.length) return;

    this.setState(prevState => ({
      operateBtnResetFlag: rowIds.reduce(
        (acc, id) => ({ ...acc, [id]: (get(prevState.operateBtnResetFlag, id) || 0) + 1 }),
        prevState.operateBtnResetFlag,
      ),
    }));
    rowIds.forEach(id => this.checkSingleRowBtns(id));
  };

  // 外部（如工作流推送打开记录）提交或新增记录后，将记录加为当前表的最新记录
  addRecordToViewEvent = ({ worksheetId, record } = {}) => {
    const { addRecord, sheetViewData } = this.props;
    const rowId = _.get(record, 'rowid');

    if (worksheetId !== this.props.worksheetId || !rowId || _.find(sheetViewData.rows, r => r.rowid === rowId)) {
      return;
    }

    addRecord(record);
  };

  handleCellClick = (cell: FormControl | undefined, row: RecordRow, rowIndex?: number) => {
    const { allowOpenRecord = true } = this.props;

    if (!row || !row.rowid) {
      return;
    }

    if (get(this, 'props.worksheetInfo.isRequestingRelationControls') || allowOpenRecord === false) {
      return;
    }

    const { worksheetId, view } = this.props;
    handleRecordClick(view, row, () => {
      addBehaviorLog('worksheetRecord', worksheetId, { rowId: row.rowid }); // 埋点
      const newState = {
        recordInfoVisible: row,
        recordId: row.rowid,
      };

      if (cell && cell.type === 29 && cell.enumDefault === 2) {
        newState.activeRelateTableControlIdOfRecord = cell.controlId;
      }

      window.activeTableId = undefined;
      this.setState(newState);
    });
  };

  handleCellMouseDown = ({ rowIndex }: TableRenderArgs) => {
    const { setHighLight } = this.props;
    setHighLight(this.tableId, rowIndex);
  };

  handleColumnHeadHeightUpdate = (height: number) => {
    if (height && height !== this.state.columnHeadHeight) {
      this.setState({ columnHeadHeight: height });
    }
  };

  get levelCount() {
    const levelCount = get(this, 'props.treeTableViewData.levelCount');

    if (levelCount && Number(levelCount) <= 5) {
      return levelCount;
    }

    return 1;
  }

  get showControlStyle() {
    const { view } = this.props;
    return get(view, 'advancedSetting.controlstyle') === '1';
  }

  get tableType() {
    const { view } = this.props;
    return get(view, 'advancedSetting.sheettype') === '1' ? 'classic' : 'simple';
  }

  // 检查关键依赖项是否发生变化
  _shouldRecalculateColumns() {
    const { isTreeTableView, view, treeTableViewData, controls, worksheetInfo = {}, showControlIds } = this.props;

    // 生成选项字段的 options 哈希值，用于检测选项变化
    const optionsHash =
      controls
        ?.filter((control: FormControl) =>
          _.includes([WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT, WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN], control.type),
        )
        ?.map((control: FormControl) => `${control.controlId}:${control.options?.length || 0}`)
        ?.join(',') || '';
    const currentHash = {
      showControlIds,
      sheetHiddenColumns: get(this.props, 'sheetViewConfig.sheetHiddenColumns', []),
      sysids: get(view, 'advancedSetting.sysids'),
      syssort: get(view, 'advancedSetting.syssort'),
      personal_setting: get(view, 'advancedSetting.personal_setting'),
      isTreeTableView,
      viewId: view?.viewId,
      showControlsLength: view?.showControls?.length,
      maxLevel: treeTableViewData?.maxLevel,
      controlsLength: controls?.length,
      optionsHash, // 添加选项字段的哈希值检测
      isManageView: this.isManageView,
      isRequestingRelationControls: worksheetInfo?.isRequestingRelationControls,
    };

    // 简单的浅比较，避免复杂的字符串生成
    if (!this._lastPropsHash) {
      this._lastPropsHash = currentHash;
      return true;
    }

    const hasChanged = Object.keys(currentHash).some(key => currentHash[key] !== this._lastPropsHash[key]);

    if (hasChanged) {
      this._lastPropsHash = currentHash;
    }

    return hasChanged;
  }

  // 计算 columns 的核心逻辑
  _computeColumns() {
    const { isTreeTableView, view, showControlIds = [], treeTableViewData } = this.props;
    const { maxLevel } = treeTableViewData;
    const rows: RecordRow[] = get(this.props, 'sheetViewData.rows') || [];
    const isShowWorkflowSys = isOpenPermit(permitList.sysControlSwitch, this.sheetSwitchPermit);
    const controls: FormControl[] = isShowWorkflowSys
      ? this.props.controls
      : this.props.controls.filter((it: FormControl) => !_.includes(WORKFLOW_SYSTEM_FIELDS_SORT, it.controlId));

    const { sheetHiddenColumns } = this.props.sheetViewConfig;
    let { showControls = [] } = view || {};

    if (showControlIds && showControlIds.length) {
      // 有视图配置(showControls)时按其顺序排列，并保留 showControls 中不存在的选中列(放末尾)；
      // 未关联视图或视图未配置显示列时，尊重传入的 showControlIds 顺序
      const orderedIds = showControls.length
        ? _.uniq([...showControls.filter((cid: FormControl) => showControlIds.includes(cid)), ...showControlIds])
        : showControlIds;
      return orderedIds.map((cid: string) => _.find(controls, { controlId: cid })).filter(_.identity);
    }

    let columns = [];
    const hiddenColumnIds = (this.showColumnControl ? [] : sheetHiddenColumns).concat(view.controls || []); //view.controls 为视图配置的隐藏列，需始终过滤
    let filteredControls = controls
      .map((c: FormControl) => ({ ...c }))
      .filter(
        control =>
          !_.includes(SHEET_VIEW_HIDDEN_TYPES, control.type) &&
          (this.isManageView ||
            (!_.find(hiddenColumnIds, cid => cid === control.controlId) && controlState(control).visible)),
      );
    let { customdisplay = '0', sysids = '[]', syssort = '[]' } = getAdvanceSetting(view); // '0':表格显示列与表单中的字段保持一致 '1':自定义显示列

    if (customdisplay === '1') {
      columns = _.uniq(showControls)
        .map(id => _.find(filteredControls, c => c.controlId === id))
        .filter(_.identity);
    } else {
      try {
        sysids = JSON.parse(sysids);
        syssort = JSON.parse(syssort);
      } catch (err) {
        console.log(err);
        sysids = [];
        syssort = [];
      }

      columns = filteredControls
        .filter(
          c =>
            !_.includes(
              [
                'ownerid',
                'caid',
                'ctime',
                'utime',
                'wfname',
                'wfstatus',
                'wfcuaids',
                'wfrtime',
                'wfftime',
                'wfdtime',
                'wfcaid',
                'wfctime',
                'wfcotime',
                'rowid',
                'uaid',
              ],
              c.controlId,
            ),
        )
        .slice(0);

      columns = _.flatten(putControlByOrder(columns))
        .slice(0, 50)
        .concat(
          syssort
            .filter((ssid: string) => _.includes(sysids, ssid))
            .map((ssid: string) => _.find(filteredControls, { controlId: ssid }))
            .filter(_.identity),
        );
    }

    if (!columns.length) {
      columns = [{}];
    }

    const noSystemColumns = columns.filter(
      it => !_.includes([...WORKFLOW_SYSTEM_FIELDS_SORT, ...NORMAL_SYSTEM_FIELDS_SORT], it.controlId),
    );
    const workflowSysColumns = columns.filter(it => _.includes(WORKFLOW_SYSTEM_FIELDS_SORT, it.controlId));
    const normalSysColumns = columns.filter(it => _.includes(NORMAL_SYSTEM_FIELDS_SORT, it.controlId));
    columns = _.isEmpty(showControls) ? [...workflowSysColumns, ...noSystemColumns, ...normalSysColumns] : columns;
    if (isTreeTableView) {
      let titleControl;
      const newColumns = [];
      columns.forEach(c => {
        if (c.attribute === 1) {
          titleControl = c;
        } else {
          newColumns.push(c);
        }
      });
      columns = (titleControl ? [titleControl] : []).concat(newColumns);
    }

    this.columnsNoPersonalSetting = columns;
    const personalSetting = safeParse(get(view, 'advancedSetting.personal_setting'));

    // 如果有 controls，先过滤出显示的列
    if (typeof personalSetting?.controls !== 'undefined') {
      columns = columns.filter(c => !personalSetting?.controls?.includes(c.controlId));
    }

    // 如果有 controlsSorts controlsSorts 的顺序排序，未在 controlsSorts 中的列保持原顺序
    if (typeof personalSetting?.controlsSorts !== 'undefined' && personalSetting?.controlsSorts?.length > 0) {
      const showControls = _.cloneDeep(columns) || [];
      const controlsSorts = personalSetting?.controlsSorts || [];
      columns = [
        ...controlsSorts.map((id: string) => showControls.find((c: FormControl) => c.controlId === id)).filter((o?: FormControl) => !!o),
        ...showControls.filter((c: FormControl) => !controlsSorts.includes(c.controlId)),
      ];
    }

    if (isTreeTableView && columns[0]) {
      const appendWidth = getTreeExpandCellWidth(maxLevel, rows.length);
      this.expandCellAppendWidth = appendWidth;
      columns[0].appendWidth = appendWidth;
      columns[0].hideFrozen = true;
      columns[0].isTreeExpandCell = true;
    }

    return this.isManageView ? getHighAuthControls(columns) : columns;
  }

  get columns() {
    // 检查是否需要重新计算
    if (this._columnsCache && !this._shouldRecalculateColumns()) {
      return this._columnsCache;
    }

    // 重新计算并缓存结果
    const result = this._computeColumns();
    this._columnsCache = result;

    return result;
  }

  get lineNumberBegin() {
    const { pageIndex, pageSize } = this.props.sheetFetchParams;
    return (pageIndex - 1) * pageSize;
  }

  get chartId() {
    return this.props.chartId || this.props.chartIdFromUrl;
  }
  get readonly() {
    return !!this.chartId || get(window, 'shareState.isPublicView') || get(window, 'shareState.isPublicPage');
  }

  get disabledFunctions() {
    const { chartId } = this;

    if (
      chartId ||
      this.props.isTreeTableView ||
      this.props.hideFilter ||
      !isOpenPermit(permitList.filterSwitch, this.sheetSwitchPermit)
    ) {
      return ['filter'];
    } else {
      return [];
    }
  }

  get rowHeadOnlyNum() {
    return !!this.chartId;
  }

  get showColumnControl() {
    return !get(window, 'shareState.shareId') && md.global.Account.accountId && !this.chartId;
  }

  get highLightRows() {
    try {
      const rows: RecordRow[] = get(this.props, 'sheetViewData.rows');
      const { allWorksheetIsSelected, sheetSelectedRows } = this.props.sheetViewConfig || {};
      return [
        {},
        ...(allWorksheetIsSelected
          ? rows.filter((row: RecordRow) => !_.find(sheetSelectedRows, r => r.rowid === row.rowid)).map(row => row.rowid)
          : sheetSelectedRows.map((row: RecordRow) => row.rowid)),
      ].reduce((a, b) => ({ ...a, [b]: true }));
    } catch (err) {
      console.error(err);
      return {};
    }
  }

  get hideRowHead() {
    const { isTreeTableView, view, viewId } = this.props;
    const { tableType } = this;
    const showOperate = (get(view, 'advancedSetting.showquick') || '1') === '1';
    const showNumber = (get(view, 'advancedSetting.showno') || '1') === '1' && !isTreeTableView;
    const allowBatchEdit = isOpenPermit(permitList.batchEdit, this.sheetSwitchPermit, viewId);
    return tableType !== 'classic' && !showOperate && !allowBatchEdit && !showNumber;
  }

  get hasBatch() {
    return isOpenPermit(permitList.batchGroup, this.sheetSwitchPermit);
  }

  get numberWidth() {
    const { sheetViewData } = this.props;
    const { rows }: { rows: RecordRow[]; [key: string]: any } = sheetViewData;
    const { lineNumberBegin } = this;
    let numberWidth = String(lineNumberBegin + rows.length).length * 8;
    return numberWidth > 14 ? numberWidth : 14;
  }

  get rowHeadWidth() {
    const { view, isTreeTableView } = this.props;
    const { numberWidth } = this;
    const showOperate = (get(view, 'advancedSetting.showquick') || '1') === '1';
    const showNumber = (get(view, 'advancedSetting.showno') || '1') === '1' && !isTreeTableView;

    if (this.rowHeadOnlyNum) {
      return numberWidth + 24;
    }

    let rowHeadWidth = 24 + 24 + 8;

    if (showNumber || this.hasBatch) {
      rowHeadWidth += numberWidth + 8;
    }

    if (this.tableType === 'classic') {
      rowHeadWidth += 24 - 8;
    }

    if (this.tableType !== 'classic' && showOperate && !showNumber && !this.hasBatch) {
      rowHeadWidth -= 18;
    }

    return rowHeadWidth + 8;
  }

  get needClickToSearch() {
    return !this.chartId && get(this.props, 'view.advancedSetting.clicksearch') === '1';
  }

  get sheetSwitchPermit() {
    const { sheetSwitchPermit } = this.props;

    if (this.isManageView) {
      return sheetSwitchPermit.map((l: { type: number; state: boolean; viewIds: string[] }) => ({ ...l, state: true, viewIds: [] }));
    }

    return sheetSwitchPermit;
  }

  get isManageView() {
    const { viewId, worksheetId, appPkg } = this.props;

    return isHaveCharge(appPkg.permissionType) && viewId === worksheetId;
  }

  get tableConfig() {
    const { view, worksheetInfo } = this.props;
    const { allowAdd, isRequestingRelationControls } = worksheetInfo;
    const lineEditable = (get(view, 'advancedSetting.fastedit') || '1') === '1' && !isRequestingRelationControls;
    return {
      allowAdd,
      lineEditable,
    };
  }

  // 缓存分组行，避免重复过滤
  get groupRows() {
    const { sheetViewData = {} } = this.props;
    const { rows = [] }: { rows: RecordRow[]; [key: string]: any } = sheetViewData;
    return rows.filter(({ rowid }) => rowid === 'groupTitle');
  }

  get allowShowGenDataFromMingo() {
    const { appPkg } = this.props;
    const { isOwner, isAdmin, isRunner, isDeveloper } = getUserRole(appPkg.permissionType);
    return isOwner || isDeveloper || isRunner || isAdmin;
  }

  renderSummaryCell = ({ className = '', style, columnIndex }: TableRenderArgs) => {
    const { viewId, sheetViewData, changeWorksheetSheetViewSummaryType, sheetViewConfig } = this.props;
    const { allWorksheetIsSelected, sheetSelectedRows } = sheetViewConfig;
    const { rowsSummary, rows }: { rows: RecordRow[]; [key: string]: any } = sheetViewData;
    const control = [{ type: 'summaryhead' }].concat(this.columns)[columnIndex];
    return (
      <SummaryCell
        className={cx({ alignCenter: className.indexOf('alignCenter') > -1 })}
        rowHeadOnlyNum={this.rowHeadOnlyNum}
        style={style}
        viewId={viewId}
        summaryType={control && rowsSummary.types[control.controlId]}
        summaryValue={control && rowsSummary.values[control.controlId]}
        control={control}
        rows={rows}
        selectedIds={sheetSelectedRows.map(r => r.rowid)}
        allWorksheetIsSelected={allWorksheetIsSelected}
        changeWorksheetSheetViewSummaryType={changeWorksheetSheetViewSummaryType}
      />
    );
  };

  renderColumnHead = ({ control, className, style, columnIndex, fixedColumnCount, ...rest }: TableRenderArgs) => {
    const { tableId } = this;
    const {
      isCharge,
      appId,
      worksheetId,
      viewId,
      view,
      isTreeTableView,
      worksheetInfo,
      sheetViewConfig,
      updateDefaultScrollLeft,
      changePageIndex,
      filters,
      controls,
      quickFilter,
      navGroupFilters,
      refresh,
      clearSelect,
      updateRows,
      getWorksheetSheetViewSummary,
      sheetViewData,
      isDraft,
      updateWorksheetInfo,
      saveView,
      updateColumnStyles,
      saveColumnStylesToLocal,
      fromEmbed,
    } = this.props;
    const { projectId } = worksheetInfo;
    const { allWorksheetIsSelected, sheetSelectedRows } = sheetViewConfig;
    const { disableMaskDataControls } = this.state;

    const isShowWorkflowSys = isOpenPermit(permitList.sysControlSwitch, this.sheetSwitchPermit);

    let param = {};

    if (this.showColumnControl) {
      const { personal_setting } = getAdvanceSetting(view);
      const personalSetting = safeParse(personal_setting || '{}');
      param.sheetHiddenColumns = personalSetting?.controls;
      param.hideColumn = (id: string) => {
        const { personal_setting } = getAdvanceSetting(view);
        const personalSetting = safeParse(personal_setting || '{}');
        saveView(
          viewId,
          {
            controls: _.union(personalSetting?.controls || [], [id]),
            editAttrs: ['personal_setting', 'controls'],
          },
          () => {
            this.forceUpdate();
          },
        );
      };

      param.clearHiddenColumn = () => {
        saveView(viewId, { controls: [], editAttrs: ['personal_setting', 'controls'] }, () => {
          this.forceUpdate();
        });
      };
    }

    return (
      <ColumnHead
        isDraft={isDraft}
        isCharge={isCharge}
        count={sheetViewData.count}
        fromEmbed={fromEmbed}
        worksheetId={worksheetId}
        viewId={viewId}
        className={className}
        style={style}
        control={
          disableMaskDataControls[control.controlId]
            ? {
                ...control,
                advancedSetting: Object.assign({}, control.advancedSetting, {
                  datamask: '0',
                }),
              }
            : control
        }
        columns={this.columns}
        disabledFunctions={this.disabledFunctions}
        readonly={this.readonly}
        disabled={(this.needClickToSearch && _.isEmpty(quickFilter)) || isPseudoControl(control, 'operates')}
        isLast={control.controlId === _.last(this.columns)?.controlId}
        isTreeTableView={isTreeTableView}
        columnIndex={columnIndex}
        fixedColumnCount={fixedColumnCount}
        rowIsSelected={!!(allWorksheetIsSelected || sheetSelectedRows.length)}
        onBatchSetColumns={() => {
          renderBatchSetDialog({
            columns: isShowWorkflowSys
              ? controls
              : controls.filter((it: FormControl) => !_.includes(WORKFLOW_SYSTEM_FIELDS_SORT, it.controlId)),
            view,
            currentSheetInfo: worksheetInfo,
            onClose: () => {},
            visible: true,
            worksheetId,
            appId,
            updateCurrentView: (data: { editAttrs?: string[]; [key: string]: any }, cb?: () => void) => {
              saveView(viewId, pick(data, [...(data.editAttrs || []), 'editAdKeys']), cb);
            },
            updateWorksheetInfo,
            onStyleChange: (newStyles: { cid: string; [key: string]: any }[]) => {
              const changes = newStyles.reduce((a, b) => Object.assign(a, { [b.cid]: _.omit(b, 'cid') }), {} as Record<string, any>);

              if (!get(window, 'shareState.shareId')) {
                saveColumnStylesToLocal(changes);
              }

              updateColumnStyles(changes);
            },
          });
        }}
        canBatchEdit={isOpenPermit(permitList.batchEdit, this.sheetSwitchPermit, viewId)}
        onBatchEdit={() => {
          batchEditRecord({
            appId,
            viewId,
            projectId,
            activeControl: control,
            view,
            worksheetId,
            searchArgs: filters,
            quickFilter,
            clearSelect,
            allWorksheetIsSelected,
            updateRows,
            getWorksheetSheetViewSummary,
            reloadWorksheet: () => {
              changePageIndex(1);
              refresh();
            },
            selectedRows: sheetSelectedRows,
            worksheetInfo,
            navGroupFilters,
          });
        }}
        updateDefaultScrollLeft={() => {
          const scrollX = document.querySelector(`.id-${tableId}-id .scroll-x .scroll-viewport`);

          if (scrollX) {
            updateDefaultScrollLeft(scrollX.scrollLeft);
          }
        }}
        onShowFullValue={() => {
          if (window.shareState.shareId) return;
          addBehaviorLog('worksheetBatchDecode', worksheetId, { controlId: control.controlId });
          this.setState({ disableMaskDataControls: { ...disableMaskDataControls, [control.controlId]: true } });
        }}
        scrollToLeftStart={() => {
          if (_.isFunction(_.get(this.table, 'current.table.refs.setScrollX'))) {
            this.table.current.table.refs.setScrollX(0);
          }

          if (_.isFunction(_.get(this.table, 'current.table.refs.setScroll'))) {
            this.table.current.table.refs.setScroll(0);
          }
        }}
        {...rest}
        {...param}
      />
    );
  };

  renderRowHead = ({ className, style: cellstyle, rowIndex, data }: TableRenderArgs) => {
    const {
      isTreeTableView,
      isCharge,
      isDevAndOps,
      appId,
      view,
      viewId,
      controls,
      worksheetInfo,
      buttons,
      sheetViewData,
      sheetViewConfig,
      getWorksheetSheetViewSummary,
      refreshWorksheetControls,
    } = this.props;
    // functions
    const {
      addRecord,
      selectRows,
      updateRows,
      hideRows,
      saveSheetLayout,
      resetSheetLayout,
      setHighLight,
      isDraft,
      printCharge,
    } = this.props;
    const { allWorksheetIsSelected, sheetSelectedRows, sheetHiddenColumns } = sheetViewConfig;
    const localLayoutUpdateTime = getLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', viewId);
    const showNumber = (get(view, 'advancedSetting.showno') || '1') === '1' && !isTreeTableView;
    const showOperate = (get(view, 'advancedSetting.showquick') || '1') === '1';

    // 缓存回调函数
    const handleSelectAllWorksheet = (value: boolean) => {
      selectRows({
        selectAll: value,
        rows: [],
      });
    };

    const handleSelect = (newSelected: string[], selectRowId: string) => {
      if (allWorksheetIsSelected) {
        selectRows({
          selectAll: false,
          rows: data
            .filter(function (row: RecordRow) {
              return !_.find(newSelected, function (rowid: string) {
                return row.rowid === rowid;
              });
            })
            .filter(_.identity),
        });
      } else {
        const selectIndex = _.findIndex(data, r => r.rowid === selectRowId);

        if (this.shiftActive) {
          let startIndex = Math.min(...[selectIndex, this.shiftActiveRowIndex]);
          let endIndex = Math.max(...[selectIndex, this.shiftActiveRowIndex]);

          if (endIndex > data.length - 1) {
            endIndex = data.length - 1;
          }

          selectRows({
            rows: _.unionBy(data.slice(startIndex, endIndex + 1).concat(sheetSelectedRows), 'rowid'),
          });
        } else {
          this.shiftActiveRowIndex = selectIndex;
          selectRows({
            rows: newSelected.map((rowid: string) => _.find(data, (row: RecordRow) => row.rowid === rowid)).filter(_.identity),
          });
        }
      }
    };

    const handleReverseSelect = () => {
      if (allWorksheetIsSelected) {
        selectRows({
          selectAll: false,
          rows: [],
        });
      } else {
        selectRows({
          rows: data
            .filter(
              (r: RecordRow) =>
                r.rowid !== 'groupTitle' &&
                r.rowid !== 'loadGroupMore' &&
                !_.find(sheetSelectedRows, row => row.rowid === r.rowid),
            )
            .filter(_.identity),
        });
      }
    };

    const handleHideRows = (rowIds: string[]) => {
      hideRows(rowIds);
      getWorksheetSheetViewSummary();
    };

    const handleOpenRecord = () => {
      this.handleCellClick(undefined, data[rowIndex], rowIndex);
      setHighLight(this.tableId, rowIndex);
    };

    return (
      <MemoizedRowHead
        className={className}
        style={cellstyle}
        rowIndex={rowIndex}
        data={data}
        isTreeTableView={isTreeTableView}
        isCharge={isCharge}
        isDevAndOps={isDevAndOps}
        appId={appId}
        view={view}
        viewId={viewId}
        controls={controls}
        worksheetInfo={worksheetInfo}
        buttons={buttons}
        sheetViewData={sheetViewData}
        sheetViewConfig={sheetViewConfig}
        tableType={this.tableType}
        numberWidth={this.numberWidth}
        hasBatch={this.hasBatch}
        showNumber={showNumber}
        showOperate={showOperate}
        readonly={this.readonly}
        rowHeadOnlyNum={this.rowHeadOnlyNum}
        tableId={this.tableId}
        lineNumberBegin={this.lineNumberBegin}
        sheetSwitchPermit={this.sheetSwitchPermit}
        onSelectAllWorksheet={handleSelectAllWorksheet}
        onSelect={handleSelect}
        onReverseSelect={handleReverseSelect}
        updateRows={updateRows}
        hideRows={handleHideRows}
        handleAddSheetRow={addRecord}
        saveSheetLayout={saveSheetLayout}
        resetSheetLayout={resetSheetLayout}
        setHighLight={setHighLight}
        refreshWorksheetControls={refreshWorksheetControls}
        onOpenRecord={handleOpenRecord}
        chartId={this.chartId}
        columns={this.columns}
        isDraft={isDraft}
        printCharge={printCharge}
        layoutChangeVisible={
          isCharge &&
          ((!this.showColumnControl ? !!sheetHiddenColumns.length : false) ||
            Number(localLayoutUpdateTime) >
              Number(view.advancedSetting.layoutupdatetime || view.advancedSetting.layoutUpdateTime || 0) ||
            !!getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', viewId))
        }
      />
    );
  };

  renderOperates = ({ className, style, control, row, rowIndex, onCellClick }: TableRenderArgs) => {
    const {
      view,
      addRecord,
      setHighLight,
      hideRows,
      controls,
      worksheetInfo = {},
      sheetViewData = {},
      updateRows,
    } = this.props;
    const recordId = row.rowid;
    const { buttonsCheckStatus, operateBtnResetFlag } = this.state;
    const status = buttonsCheckStatus ? Object.values(buttonsCheckStatus)[0] || {} : {};
    return (
      <div
        style={style}
        className={className}
        onClick={e => {
          if (
            (e.target.classList.contains('cell') || e.target.parentElement.classList.contains('cell')) &&
            e.target.closest('.viewCon')
          ) {
            onCellClick(control, row, rowIndex);
          } else if (!e.target.closest('.recordOperateDialog')) {
            e.stopPropagation();
          }
        }}
      >
        <OperateButtons
          status={status}
          refreshFlag={sheetViewData.refreshFlag}
          resetFlag={get(operateBtnResetFlag, recordId)}
          row={row}
          rowHeight={ROW_HEIGHT[view.rowHeight] || 34}
          recordId={recordId}
          controls={controls}
          entityName={worksheetInfo.entityName}
          onRefreshButtonStatus={this.checkSingleRowBtns}
          onUpdateRow={(data: RecordRow) => {
            if (!data) return;
            const rowId = data.rowid || recordId;
            updateRows([rowId], _.omit(data, ['allowedit', 'allowdelete']));
          }}
          onCopySuccess={(record: RecordRow, afterRowId: string) => {
            setHighLight(this.tableId, rowIndex + 1);
            addRecord(record ? Object.assign({}, record, { group: row.group }) : {}, afterRowId);
          }}
          onDeleteSuccess={() => {
            hideRows([recordId]);
          }}
        />
      </div>
    );
  };

  renderGroupTitle = ({ className, style, row, columnIndex, getColumnWidth }: TableRenderArgs) => {
    const {
      view,
      appId,
      worksheetId,
      viewId,
      foldedMap,
      updateFolded,
      sheetViewData = {},
      changeWorksheetSheetViewSummaryType,
      insertToGroupedRow,
    } = this.props;
    const { fixedColumnCount, allWorksheetIsSelected, sheetSelectedRows } = this.props.sheetViewConfig;
    const { allowAdd, lineEditable } = this.tableConfig;
    const projectId = get(this, 'props.worksheetInfo.projectId');

    return (
      <GroupTitleCell
        className={className}
        style={style}
        row={row}
        columnIndex={columnIndex}
        getColumnWidth={getColumnWidth}
        view={view}
        appId={appId}
        worksheetId={worksheetId}
        viewId={viewId}
        projectId={projectId}
        foldedMap={foldedMap}
        updateFolded={updateFolded}
        sheetViewData={sheetViewData}
        changeWorksheetSheetViewSummaryType={changeWorksheetSheetViewSummaryType}
        insertToGroupedRow={insertToGroupedRow}
        fixedColumnCount={fixedColumnCount}
        allWorksheetIsSelected={allWorksheetIsSelected}
        sheetSelectedRows={sheetSelectedRows}
        allowAdd={allowAdd}
        lineEditable={lineEditable}
        columns={this.columns}
        rowHeadOnlyNum={this.rowHeadOnlyNum}
      />
    );
  };

  renderGroupMore = ({ className, style, row, columnIndex, getColumnWidth }: TableRenderArgs) => {
    const { loadGroupMore } = this.props;
    const { fixedColumnCount } = this.props.sheetViewConfig;
    let newClassName = className + ' loadMoreCell';

    if (columnIndex === 0) {
      if (fixedColumnCount === 0 || fixedColumnCount === 1) {
        newClassName += ' cellRight2px';
      }

      style.width = getColumnWidth(0) + getColumnWidth(1);
      return (
        <div style={style} className={newClassName}>
          <div
            className="textSecondary Font13 Hand valignWrapper"
            style={{ marginLeft: 40, height: '100%' }}
            onClick={() => {
              if (row.isLoading) {
                return;
              }

              loadGroupMore(row.groupKey);
            }}
          >
            {row.isLoading ? (
              <>
                {_l('加载中')}
                <i className="icon icon-loading_button groupLoading InlineBlock mLeft5 textTertiary Font18"></i>{' '}
              </>
            ) : (
              <span className="hoverColorPrimary">{_l('加载更多')}</span>
            )}
          </div>
        </div>
      );
    }

    if (columnIndex === 1) {
      return null;
    }

    return <div style={style} className={newClassName}></div>;
  };

  // 分组按钮在 operatesButtons 里是 group_ref，其 btnId 是合成的 group:xxx，
  // 真正的成员按钮 id 在 b.buttons 内，校验执行状态时必须展开成员真实 btnId。
  getOperateButtonCheckIds = (operatesButtons: SheetOperateButton[]) =>
    _.flatMap(operatesButtons, (b: SheetOperateButton) =>
      b.type === 'group_ref' && _.isArray(b.buttons) ? b.buttons.map((member: SheetOperateButton) => member.btnId) : [b.btnId],
    );

  checkSingleRowBtns = (rowId: string) => {
    const { worksheetId, sheetFetchParams } = this.props;
    const operatesButtons = this.getOperateButtons(this.props);
    if (!operatesButtons.length || !rowId) return;
    const btnIds = this.getOperateButtonCheckIds(operatesButtons);
    worksheetAjax
      .checkWorksheetRowsBtn({
        worksheetId,
        rowIds: [rowId],
        btnIds,
      })
      .then(data => {
        const { pageIndex, pageSize } = sheetFetchParams;
        const key = `${pageIndex}x${pageSize}`;
        const newBtnCheckStatus = { ...get(this.state.buttonsCheckStatus, key, {}) };
        // 清除之前状态
        btnIds.forEach(btnId => {
          delete newBtnCheckStatus[`${rowId}-${btnId}`];
        });
        // 添加新状态
        data.forEach((item: SheetButtonRowState) => {
          item.rowIds.forEach((rId: string) => {
            if (rId === rowId) {
              newBtnCheckStatus[`${rId}-${item.btnId}`] = true;
            }
          });
        });
        this.setState(prevState => ({
          buttonsCheckStatus: {
            ...prevState.buttonsCheckStatus,
            [key]: newBtnCheckStatus,
          },
        }));
      });
  };

  debounceUpdateControlOfRow(delay = 500) {
    const { updateControlOfRow } = this.props;
    const timers = new Map();

    return function ({
      recordId,
      cell: { controlId: cid, value: newValue },
      rules,
    }: {
      recordId: string;
      cell: { controlId: string; value: ControlValue };
      rules?: any[];
    }) {
      const key = [recordId, cid, newValue].join('-');

      if (timers.has(key)) {
        clearTimeout(timers.get(key));
      }

      timers.set(
        key,
        setTimeout(() => {
          updateControlOfRow({ recordId, cell: { controlId: cid, value: newValue }, rules });
          timers.delete(key);
        }, delay),
      );
    };
  }

  asyncUpdate(row: RecordRow, cell: FormControl, options?: Record<string, any>) {
    const { worksheetInfo, updateControlOfRow, controls, sheetSearchConfig, sheetViewData = {} } = this.props;
    const { rows = [] }: { rows: RecordRow[]; [key: string]: any } = sheetViewData;
    row = _.find(rows, { rowid: row.rowid }) || {};
    const { projectId, rules = [] } = worksheetInfo;
    const asyncUpdateControlOfRow = this.debounceUpdateControlOfRow();

    const asyncUpdateCell = (cid: string, newValue: ControlValue) => {
      if (typeof newValue === 'object' || cid === cell.controlId) {
        return;
      }

      asyncUpdateControlOfRow({ recordId: row.rowid, cell: { controlId: cid, value: newValue }, rules });
    };

    const dataFormat = new DataFormat({
      data: controls.filter((c: FormControl) => c.advancedSetting).map((c: FormControl) => ({ ...c, value: (row || {})[c.controlId] || c.value })),
      projectId,
      rules,
      // masterData,
      searchConfig: sheetSearchConfig,
      onAsyncChange: changes => {
        if (!_.isEmpty(changes.controlIds)) {
          changes.controlIds.forEach((cid: string) => {
            asyncUpdateCell(cid, changes.value);
          });
        } else if (changes.controlId) {
          asyncUpdateCell(changes.controlId, changes.value);
        }
      },
    });
    dataFormat.updateDataSource(cell);
    const data = dataFormat.getDataSource();
    const updatedIds = dataFormat.getUpdateControlIds();
    const updatedCells = data
      .filter(c => _.includes(updatedIds, c.controlId))
      .map(c => _.pick(c, ['controlId', 'controlName', 'type', 'value']));
    updatedCells.forEach(c => {
      if (c.controlId === cell.controlId) {
        c.editType = cell.editType;
      }
    });
    updateControlOfRow(
      { cell, cells: updatedCells, recordId: row.rowid, rules },
      {
        ...options,
        onSuccess: () => {
          this.checkSingleRowBtns(row.rowid);
          if (_.isFunction(options.onSuccess)) {
            options.onSuccess();
          }
        },
      },
    );
  }

  render() {
    const {
      type,
      isCharge,
      fullShowTable,
      minRowCount,
      isTreeTableView,
      treeTableViewData,
      sheetViewData,
      foldedMap,
      sheetViewConfig,
      appId,
      groupId,
      view,
      viewId,
      worksheetInfo,
      maxCount,
      filters,
      quickFilter,
      navGroupFilters,
      controls,
      printCharge,
      operateButtonLoading,
      updateDefaultScrollLeft,
      saveViewSetLoading,
    } = this.props;
    // function
    const {
      addRecord,
      updateRows,
      hideRows,
      getWorksheetSheetViewSummary,
      updateSheetColumnWidths,
      updateWorksheetSomeControls,
      openNewRecord,
      updateTreeNodeExpansion,
      collapseAllTreeTableViewNode,
      expandAllTreeTableViewNode,
      changeTreeTableViewLevelCount,
      isDraft,
      saveView,
    } = this.props;
    const { readonly } = this;
    const { loading } = sheetViewData;
    let rows: RecordRow[] = sheetViewData.rows;
    const operatesButtons = this.getOperateButtons(this.props);
    const operatesButtonsStyle = getSheetOperatesButtonsStyle(view);
    const showOperatesInRow = !!operatesButtons.length && !get(window, 'shareState.shareId');
    const operatesButtonsWidth = this.getOperateButtonsMaxWidth({
      buttons: operatesButtons,
      style: operatesButtonsStyle.style,
      visibleNum: operatesButtonsStyle.visibleNum,
      showIcon: operatesButtonsStyle.showIcon,
      rows: rows.filter((r: RecordRow) => r.rowid !== 'groupTitle' && r.rowid !== 'loadGroupMore'),
    });
    const { sheetSelectedRows = [], sheetColumnWidths, columnStyles, defaultScrollLeft } = sheetViewConfig;
    const { worksheetId, projectId, allowAdd, rules = [], isWorksheetQuery } = worksheetInfo;
    const {
      recordId,
      recordInfoVisible,
      activeRelateTableControlIdOfRecord,
      tempViewIdForRecordInfo,
      disableMaskDataControls,
    } = this.state;
    const { lineNumberBegin, columns } = this;
    const showSummary = (get(view, 'advancedSetting.showsummary') || '1') === '1' && !maxCount && !isTreeTableView;
    const showVerticalLine = (get(view, 'advancedSetting.showvertical') || '1') === '1';
    const showAsZebra = (get(view, 'advancedSetting.alternatecolor') || '0') === '1'; // 斑马颜色
    const wrapControlName = (get(view, 'advancedSetting.titlewrap') || '0') === '1';
    const headTitleCenter = (get(view, 'advancedSetting.rctitlestyle') || '0') === '1';
    const enableRules = (get(view, 'advancedSetting.enablerules') || (this.isManageView ? '0' : '1')) === '1';
    const navGroupData = (get(worksheetInfo, 'template.controls') || []).find(
      (o: FormControl) => o.controlId === get(view, 'navGroup[0].controlId'),
    );
    const { lineEditable } = this.tableConfig;
    const { rowHeadWidth } = this;
    let isGroupTableView = !!getGroupControlId(view);
    let fixedColumnCount = sheetViewConfig.fixedColumnCount;

    if (isTreeTableView) {
      fixedColumnCount = fixedColumnCount + 1;
    } else if (isGroupTableView && fixedColumnCount < 1) {
      fixedColumnCount = 1;
    }

    if (isGroupTableView && !_.isEmpty(foldedMap)) {
      rows = rows.filter(({ groupKey }) => !foldedMap[groupKey]);
    }

    const rowHeights =
      isGroupTableView &&
      rows.map((row: RecordRow) => {
        if (row.rowid === 'groupTitle') {
          return 34;
        }

        return ROW_HEIGHT[view.rowHeight] || 34;
      });
    const getRowHeight = (rowIndex: number) => rowHeights[rowIndex];
    return (
      <React.Fragment>
        {!!recordInfoVisible && (
          <RecordInfo
            enablePayment={worksheetInfo.enablePayment}
            tableType={this.tableType}
            widgetStyle={worksheetInfo.advancedSetting}
            worksheetInfo={worksheetInfo}
            controls={this.isManageView ? getHighAuthControls(controls) : controls}
            sheetSwitchPermit={this.sheetSwitchPermit}
            projectId={projectId}
            showPrevNext
            needUpdateRows
            rules={this.isManageView ? [] : rules}
            isWorksheetQuery={isWorksheetQuery}
            isCharge={isCharge}
            allowAdd={allowAdd}
            appId={appId}
            viewId={tempViewIdForRecordInfo || viewId}
            appSectionId={groupId}
            view={view}
            visible={!!recordInfoVisible}
            hideRecordInfo={(closeId: string) => {
              if (!closeId || closeId === this.state.recordId) {
                this.setState({ recordInfoVisible: false, tempViewIdForRecordInfo: undefined });
              }

              if (this.tableType === 'classic') {
                window.activeTableId = this.tableId;
              }
            }}
            recordId={recordId}
            activeRelateTableControlId={activeRelateTableControlIdOfRecord}
            worksheetId={worksheetId}
            updateWorksheetControls={updateWorksheetSomeControls}
            updateRows={updateRows}
            hideRows={hideRows}
            onDeleteSuccess={() => {
              hideRows([recordId]);
            }}
            getWorksheetSummary={getWorksheetSheetViewSummary}
            currentSheetRows={rows.filter((r: RecordRow) => r.rowid !== 'groupTitle' && r.rowid !== 'loadGroupMore')}
            handleAddSheetRow={addRecord}
            workflowStatus={recordInfoVisible && recordInfoVisible.wfstatus}
            printCharge={printCharge}
          />
        )}
        {loading && (
          <React.Fragment>
            <Skeleton
              style={{ flex: 1 }}
              direction="column"
              widths={['30%', '40%', '90%', '60%']}
              active
              itemStyle={{ marginBottom: '10px' }}
            />
            <Skeleton
              style={{ flex: 1 }}
              direction="column"
              widths={['40%', '55%', '100%', '80%']}
              active
              itemStyle={{ marginBottom: '10px' }}
            />
            <Skeleton
              style={{ flex: 2 }}
              direction="column"
              widths={['45%', '100%', '100%', '100%']}
              active
              itemStyle={{ marginBottom: '10px' }}
            />
          </React.Fragment>
        )}
        {!loading && !(showOperatesInRow && operateButtonLoading) && (
          <>
            {this.showColumnControl && (
              <ColumnVisibilityControl
                columns={(this.columnsNoPersonalSetting || columns).filter(c => !!c.controlId)}
                view={view}
                viewId={viewId}
                appId={appId}
                saveView={saveView}
                disabled={saveViewSetLoading}
                tableId={this.tableId}
                columnHeadHeight={this.state.columnHeadHeight}
              />
            )}
            <WorksheetTable
              isGroupTableView={isGroupTableView}
              isDraft={isDraft}
              inView={true}
              showControlStyle={this.showControlStyle}
              isTreeTableView={isTreeTableView}
              treeTableViewData={treeTableViewData}
              tableType={this.tableType}
              readonly={readonly}
              ref={this.table}
              recordColorConfig={getRecordColorConfig(view)}
              watchHeight={!browserIsMobile()}
              setHeightAsRowCount={fullShowTable}
              minRowCount={isTreeTableView ? rows.length + 2 : minRowCount}
              tableId={this.tableId}
              view={view}
              viewId={viewId}
              appId={appId}
              enableRules={enableRules}
              rules={this.isManageView ? [] : rules}
              isCharge={isCharge}
              worksheetId={worksheetId}
              sheetViewHighlightRows={this.highLightRows}
              showRowHead={!this.hideRowHead}
              lineEditable={lineEditable}
              disableQuickEdit={!isOpenPermit(permitList.quickSwitch, this.sheetSwitchPermit, viewId)}
              fixedColumnCount={fixedColumnCount}
              rightFixedCount={showOperatesInRow ? 1 : 0}
              sheetColumnWidths={sheetColumnWidths}
              columnStyles={columnStyles}
              allowAdd={
                this.isManageView || (isOpenPermit(permitList.createButtonSwitch, this.sheetSwitchPermit) && allowAdd)
              }
              canSelectAll={!!rows.length}
              data={rows}
              {...(ROW_HEIGHT[view.rowHeight] === 34 || !isGroupTableView
                ? {}
                : {
                    getRowHeight,
                  })}
              rowHeight={ROW_HEIGHT[view.rowHeight] || 34}
              rowHeightEnum={view.rowHeight}
              keyWords={filters.keyWords}
              sheetIsFiltered={
                !!(
                  filters.keyWords ||
                  get(filters, 'filterControls.length') ||
                  get(filters, 'filtersGroup.length') ||
                  !_.isEmpty(quickFilter) ||
                  !_.isEmpty(view?.filters)
                )
              }
              showNewRecord={openNewRecord}
              defaultScrollLeft={defaultScrollLeft}
              onScroll={() => {
                if (defaultScrollLeft) {
                  updateDefaultScrollLeft(0);
                }
              }}
              sheetSwitchPermit={this.sheetSwitchPermit}
              noFillRows
              selectedIds={sheetSelectedRows.map(r => r.rowid)}
              lineNumberBegin={lineNumberBegin}
              rowHeadOnlyNum={this.rowHeadOnlyNum}
              rowHeadWidth={rowHeadWidth}
              expandCellAppendWidth={this.expandCellAppendWidth}
              controls={this.isManageView ? getHighAuthControls(controls) : controls}
              columns={columns
                .map((c: FormControl) =>
                  disableMaskDataControls[c.controlId]
                    ? {
                        ...c,
                        advancedSetting: Object.assign({}, c.advancedSetting, {
                          datamask: '0',
                        }),
                      }
                    : c,
                )
                .concat(
                  showOperatesInRow
                    ? [
                        {
                          type: 'operates',
                          controlName: _l('操作'),
                          width: operatesButtonsWidth,
                        },
                      ]
                    : [],
                )}
              projectId={projectId}
              // 表格样式
              wrapControlName={wrapControlName}
              headTitleCenter={headTitleCenter}
              showSummary={
                !this.chartId &&
                showSummary &&
                !(get(window, 'shareState.isPublicView') || get(window, 'shareState.isPublicPage'))
              }
              showGenDataFromMingo={
                this.allowShowGenDataFromMingo &&
                !get(md, 'global.Account.isPortal') &&
                allowAdd &&
                !this.chartId &&
                !isDraft &&
                type !== 'single' &&
                (this.isManageView ||
                  (isOpenPermit(permitList.createButtonSwitch, this.sheetSwitchPermit) && allowAdd)) &&
                !window.isPublicApp
              }
              showVerticalLine={showVerticalLine}
              showAsZebra={showAsZebra && !isGroupTableView}
              onCellClick={this.handleCellClick}
              onCellMouseDown={this.handleCellMouseDown}
              renderFooterCell={this.renderSummaryCell}
              renderColumnHead={this.renderColumnHead}
              renderRowHead={this.renderRowHead}
              renderOperates={(args: TableRenderArgs) => this.renderOperates({ ...args })}
              renderGroupTitle={this.renderGroupTitle}
              renderGroupMore={this.renderGroupMore}
              noRecordAllowAdd={false}
              emptyIcon={
                (this.needClickToSearch && _.isEmpty(quickFilter)) ||
                (this.navGroupToSearch() && _.isEmpty(navGroupFilters)) ? (
                  <span />
                ) : undefined
              }
              showSearchEmpty={
                !(
                  (this.needClickToSearch && _.isEmpty(quickFilter)) ||
                  (this.navGroupToSearch() && _.isEmpty(navGroupFilters))
                )
              }
              emptyText={
                this.needClickToSearch && _.isEmpty(quickFilter) ? (
                  <span className="Font14">{_l('执行查询后显示结果')}</span>
                ) : this.navGroupToSearch() && _.isEmpty(navGroupFilters) ? (
                  <span className="Font14">{_l('请从左侧选择一个%0查看', (navGroupData || {}).controlName)}</span>
                ) : undefined
              }
              updateCell={({ cell, row }: { cell: FormControl; row: RecordRow }, options?: Record<string, any>) => {
                this.asyncUpdate(row, cell, options);
              }}
              onColumnWidthChange={updateSheetColumnWidths}
              onColumnHeadHeightUpdate={this.handleColumnHeadHeightUpdate}
              actions={{ updateTreeNodeExpansion }}
              printCharge={printCharge}
            />
          </>
        )}
        {isTreeTableView && (
          <ToolBar
            currentView={view}
            level={this.levelCount}
            allowAdjustScale={false}
            allowExportAsImage={false}
            customButtons={[
              <span className="mLeft10 mRight20 Hand" onClick={expandAllTreeTableViewNode}>
                {_l('展开全部')}
              </span>,
              <span className="Hand" onClick={collapseAllTreeTableViewNode}>
                {_l('收起全部')}
              </span>,
            ]}
            showLevelData={({ layer }: { layer: number }) => changeTreeTableViewLevelCount(layer)}
          />
        )}
      </React.Fragment>
    );
  }
}

const TableView = autoSize(TableViewBase);

function SheetViewConnecter(props) {
  const {
    view,
    isTreeTableView,
    sheetViewData,
    treeTableViewData = {},
    filters,
    updateRows,
    updateTreeByRowChange,
  } = props;
  const context = useContext(SheetContext);
  const rows: RecordRow[] = useMemo(() => {
    if (!isTreeTableView || !!filters.keyWords) {
      return sheetViewData.rows;
    } else {
      return getSheetViewRows(sheetViewData, treeTableViewData);
    }
  }, [filters.keyWords, isTreeTableView, sheetViewData, treeTableViewData]);
  return (
    <TableView
      {...props}
      fullShowTable={get(context, 'config.fullShowTable') && !isTreeTableView}
      minRowCount={get(context, 'config.minRowCount')}
      isDraft={get(context, 'config.isDraft')}
      printCharge={get(context, 'config.printCharge')}
      fromEmbed={get(context, 'config.fromEmbed')}
      sheetViewData={{ ...sheetViewData, rows }}
      updateRows={(rowIds: string[], value: ControlValue, changedValue: ControlValue) => {
        if (isTreeTableView && !filters.keyWords && view.viewControl && get(changedValue, view.viewControl)) {
          updateTreeByRowChange({ recordId: rowIds[0], changedValue });
          updateRows(rowIds, value);
        } else {
          updateRows(rowIds, value);
        }
      }}
    />
  );
}

SheetViewConnecter.propTypes = {
  view: shape({}),
  isTreeTableView: bool,
  sheetViewData: shape({}),
  groupFetchParams: shape({}),
  treeTableViewData: shape({}),
  updateRows: func,
  updateTreeByRowChange: func,
};

export default connect(
  (state: RootState) => ({
    // worksheet
    isCharge: state.sheet.isCharge,
    worksheetInfo: state.sheet.worksheetInfo,
    filters: state.sheet.filters,
    quickFilter: state.sheet.quickFilter,
    navGroupFilters: state.sheet.navGroupFilters,
    buttons: state.sheet.buttons,
    operateButtonLoading: state.sheet.operateButtonLoading,
    sheetButtons: state.sheet.sheetButtons,
    printList: state.sheet.printList,
    controls: state.sheet.controls,
    sheetSwitchPermit: state.sheet.sheetSwitchPermit || [],
    sheetSearchConfig: state.sheet.sheetSearchConfig || [],
    chartIdFromUrl: get(state, 'sheet.base.chartId'),
    maxCount: get(state, 'sheet.base.maxCount'),
    saveViewSetLoading: state.sheet.saveViewSetLoading,
    // sheetview
    sheetViewData: state.sheet.sheetview.sheetViewData,
    sheetFetchParams: state.sheet.sheetview.sheetFetchParams,
    sheetViewConfig: state.sheet.sheetview.sheetViewConfig,
    treeTableViewData: state.sheet.sheetview.treeTableViewData,
    foldedMap: state.sheet.sheetview.foldedMap,
    groupFetchParams: state.sheet.sheetview.groupFetchParams,
  }),
  dispatch =>
    bindActionCreators(
      {
        ..._.pick(sheetviewActions, [
          'setViewLayout',
          'setRowsEmpty',
          'addRecord',
          'fetchRows',
          'loadGroupMore',
          'updateRows',
          'hideRows',
          'selectRows',
          'clearHighLight',
          'setHighLight',
          'updateDefaultScrollLeft',
          'updateSheetColumnWidths',
          'changeWorksheetSheetViewSummaryType',
          'updateViewPermission',
          'getWorksheetSheetViewSummary',
          'changePageIndex',
          'updateControlOfRow',
          'refresh',
          'clearSelect',
          'saveSheetLayout',
          'resetSheetLayout',
          'updateTreeNodeExpansion',
          'changeTreeTableViewLevelCount',
          'collapseAllTreeTableViewNode',
          'expandAllTreeTableViewNode',
          'updateTreeByRowChange',
          'initAbortController',
          'abortRequest',
          'setColumnStyles',
          'getWorksheetSheetViewSummary',
          'updateColumnStyles',
          'saveColumnStylesToLocal',
          'updateFolded',
          'insertToGroupedRow',
        ]),
        updateWorksheetSomeControls,
        refreshWorksheetControls,
        updateWorksheetInfo,
        saveView,
      },
      dispatch,
    ),
)(SheetViewConnecter);
