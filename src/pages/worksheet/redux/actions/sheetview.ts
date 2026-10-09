import _, {
  assign,
  find,
  findKey,
  forEach,
  get,
  identity,
  includes,
  isArray,
  isEmpty,
  isMatch,
  mapValues,
  pick,
  pickBy,
  sum,
  uniq,
} from 'lodash';
import worksheetAjax from 'src/api/worksheet';
import { getRowDetail } from 'worksheet/api';
import { treeDataUpdater, type TreeMap } from 'worksheet/common/TreeTableHelper';
import { handleUpdateTreeNodeExpansion } from 'worksheet/common/TreeTableHelper/index.js';
import { getRuleErrorInfo } from 'src/components/Form/core/formUtils';
import {
  SYSTEM_CONTROL_WITH_UAID,
  WIDGETS_TO_API_TYPE_ENUM,
  WORKFLOW_SYSTEM_CONTROL,
} from 'src/pages/widgetConfig/config/widget';
import type {
  WorksheetFilterCondition,
  WorksheetFilters,
  WorksheetInfo,
  WorksheetRowsRequest,
  WorksheetView,
} from 'src/pages/worksheet/types';
import type { AppDispatch, GetState, RootState } from 'src/redux/types';
import { getFilledRequestParams } from 'src/utils/common';
import { clearLRUWorksheetConfig, getLRUWorksheetConfig, saveLRUWorksheetConfig } from 'src/utils/common';
import type { ControlOption, FormControl, RecordRow } from 'src/utils/controlTypes';
import { formatQuickFilter } from 'src/utils/filter';
import { handleRecordError } from 'src/utils/record';
import { replaceControlsTranslateInfo } from 'src/utils/translate';
import {
  getFiltersForGroupedView,
  getGroupControlId,
  getListStyle,
  getSheetColumnWidthsMap,
} from 'src/utils/worksheet';
import type {
  SheetColumnStyles,
  SheetColumnWidthActionCreator,
  SheetColumnWidths,
  SheetSortControl,
  SheetSummaryTypes,
  SheetViewActionOf,
} from '../reducers/sheetviewTypes';
import { updateNavGroup } from './navFilter.js';
import { sortDataByGroupItems } from './util.js';

interface SheetRowGroup {
  key: string;
  [key: string]: unknown;
}
interface SheetGroup {
  key: string;
  name?: string | undefined;
  totalNum: number;
  type?: number | undefined;
  rows: Array<string | RecordRow>;
  control?: FormControl | undefined;
  sort?: number | undefined;
}
interface SheetRow {
  rowid?: string | undefined;
  pid?: string | undefined;
  childrenids?: string | undefined;
  name?: string | undefined;
  groupKey?: string | undefined;
  controlType?: number | undefined;
  isLoading?: boolean | undefined;
  [controlId: string]: unknown;
  key?: string | undefined;
  count?: number | undefined;
  control?: FormControl | undefined;
  group?: SheetRowGroup | undefined;
  allowedit?: boolean | undefined;
  allowdelete?: boolean | undefined;
}
interface SummaryGroupArgs {
  groupKey?: string | undefined;
  filters?: WorksheetFilterCondition[] | WorksheetFilterCondition | undefined;
}
interface SummarySavedConfig {
  types?: SheetSummaryTypes | undefined;
  groupRows?: Array<{ key: string; controlType: number; controlId: string }> | undefined;
}
interface ColumnStyleSnapshot {
  time?: number | undefined;
  styles?: SheetColumnStyles | undefined;
}
interface RefreshOptions {
  resetPageIndex?: boolean | undefined;
  changeFilters?: boolean | undefined;
  noLoading?: boolean | undefined;
  isAutoRefresh?: boolean | undefined;
  noClearSelected?: boolean | undefined;
  updateWorksheetControls?: boolean | undefined;
}
interface EditedCell {
  controlId?: string | undefined;
  value?: unknown;
  editType?: number | undefined;
}
interface UpdateCellOptions {
  callback?: ((row: SheetRow) => void) | undefined;
  updateSuccessCb?: ((row: SheetRow) => void) | undefined;
  row?: RecordRow | undefined;
  cell?: FormControl | undefined;
  onSuccess?: (() => void) | undefined;
}
interface SaveViewLayoutRequest {
  appId: string | undefined;
  worksheetId: string | undefined;
  viewId: string | undefined;
  editAttrs: string[];
  advancedSetting?:
    | {
        fixedcolumncount: number;
        layoutupdatetime: number;
        liststyle?: string | undefined;
        customdisplay?: string | undefined;
      }
    | undefined;
  showControls?: Array<string | undefined> | undefined;
  editAdKeys?: string[] | undefined;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return _.isPlainObject(value) ? (value as Record<string, unknown>) : undefined;
}
function isSheetRow(value: unknown): value is SheetRow {
  const row = plainRecord(value);
  return (
    !!row &&
    ['rowid', 'pid', 'childrenids', 'key', 'groupKey', 'name'].every(
      key => row[key] === undefined || typeof row[key] === 'string',
    ) &&
    (row['count'] === undefined || typeof row['count'] === 'number') &&
    (row['group'] === undefined || typeof plainRecord(row['group'])?.['key'] === 'string')
  );
}
function isSheetGroup(value: unknown): value is SheetGroup {
  const group = plainRecord(value);
  return (
    !!group &&
    typeof group['key'] === 'string' &&
    typeof group['totalNum'] === 'number' &&
    (group['type'] === undefined || typeof group['type'] === 'number') &&
    (group['name'] === undefined || typeof group['name'] === 'string') &&
    Array.isArray(group['rows']) &&
    group['rows'].every((row: unknown) => typeof row === 'string' || isSheetRow(row))
  );
}
function isRowUpdate(
  value: unknown,
): value is { resultCode: number; data?: SheetRow | undefined; badData?: string[] | undefined } {
  const result = plainRecord(value);
  return (
    !!result &&
    typeof result['resultCode'] === 'number' &&
    (result['data'] === undefined || isSheetRow(result['data'])) &&
    (result['badData'] === undefined ||
      (Array.isArray(result['badData']) && result['badData'].every((item: unknown) => typeof item === 'string')))
  );
}

function isControlOption(value: unknown): value is ControlOption {
  const option = plainRecord(value);
  return (
    !!option &&
    typeof option['key'] === 'string' &&
    ['value', 'color'].every(key => option[key] === undefined || typeof option[key] === 'string') &&
    ['index', 'score'].every(key => option[key] === undefined || typeof option[key] === 'number') &&
    (option['isDeleted'] === undefined || typeof option['isDeleted'] === 'boolean')
  );
}

const DEFAULT_PAGESIZE = 50;
const DEFAULT_GROUP_PAGESIZE = 20;

function getGroupPageSize(maxCount: number | string | undefined) {
  const pageSize = (parseInt as (value: string | number | undefined, radix: number) => number)(maxCount, 10);

  return pageSize > 0 ? pageSize : DEFAULT_GROUP_PAGESIZE;
}

function checkIsTreeTableView(state: RootState) {
  const { base, views } = state.sheet;
  const view = find(views, { viewId: base.viewId });
  return view && view.viewType === 2 && get(view, 'advancedSetting.hierarchyViewType') === '3';
}

function flatRowsFromGroups(
  groups: SheetGroup[],
  groupControl: FormControl,
  view: WorksheetView | undefined,
  controls: FormControl[],
) {
  let result: SheetRow[] = [];
  const newGroups = sortDataByGroupItems(groups, view, controls);
  newGroups.forEach((group: SheetGroup) => {
    if (_.get(groupControl, 'options.length')) {
      group.name = _.get(_.find(groupControl.options, { key: group.key }), 'value') || group.name;
    }

    const groupRow = {
      rowid: 'groupTitle',
      key: group.key,
      name: group.name,
      count: group.totalNum,
      controlType: group.type,
      control: groupControl,
    };
    result.push(groupRow);
    result.push(
      ...group.rows.map((rowStr: string | RecordRow) => ({
        ...safeParse(rowStr),
        groupKey: group.key,
        group: {
          ...group,
          control: groupControl,
        },
      })),
    );
    if (group.rows.length < group.totalNum) {
      result.push({
        rowid: 'loadGroupMore',
        groupKey: group.key,
      });
    }
  });
  return result;
}

export function updateTreeNodeExpansion(
  row: RecordRow = {},
  { expandAll, forceUpdate, runTimes = 0 }: { expandAll?: boolean; forceUpdate?: boolean; runTimes?: number } = {},
) {
  return (dispatch: AppDispatch, getState: GetState) => {
    // sheet.sheetview 这一层的 reducer 初值就是 {}，解构默认值又把它钉成 {}，
    // 所以下面读 treeTableViewData / sheetViewData 拿不到类型。先取出来再按需读。
    const { base = {}, navGroupFilters, filters: { filtersGroup } = {} } = getState().sheet;
    const sheetview: Partial<RootState['sheet']['sheetview']> = getState().sheet.sheetview || {};
    const { appId, viewId, worksheetId } = base;
    const { treeMap, maxLevel } = sheetview.treeTableViewData || {};
    const { rows = [] }: { rows?: SheetRow[] | undefined } = sheetview.sheetViewData || {};

    if (runTimes > 20) {
      return;
    }

    dispatch(
      handleUpdateTreeNodeExpansion(row, {
        runTimes,
        expandAll,
        forceUpdate,
        navGroupFilters,
        appId,
        viewId,
        worksheetId,
        treeMap,
        maxLevel,
        rows,
        updateRows: (...args: Parameters<typeof updateRows>) => dispatch(updateRows(...args)),
        updateTreeNodeExpansion,
        getNewRows: () =>
          worksheetAjax
            .getFilterRows({
              appId,
              worksheetId,
              viewId,
              searchType: 1,
              filterControls: [],
              kanbanKey: row.rowid,
              navGroupFilters,
              filtersGroup,
            })
            .then(res => res.data),
      }),
    );
  };
}

export const initGroupFolded = (
  view: WorksheetView | undefined,
  groups: SheetGroup[],
  controls: FormControl[],
): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_FOLDED'> => {
  const value: Record<string, boolean> = {};
  const groupKeys: string[] = _.map(sortDataByGroupItems(groups, view, controls), 'key');
  const groupFoldedType = _.get(view, 'advancedSetting.groupopen') || '2';

  if (groupFoldedType !== '2') {
    groupKeys.forEach((key, index) => {
      if (groupFoldedType === '1' && index === 0) {
        value[key] = false;
      } else {
        value[key] = true;
      }
    });
  }

  return {
    type: 'WORKSHEET_SHEETVIEW_UPDATE_FOLDED',
    value,
  };
};

export const fetchRows = ({
  levelCount,
  isFirst,
  changeView,
  noLoading,
  noClearSelected,
  updateWorksheetControls,
}: {
  /** 树形表格：要展开到第几层 */
  levelCount?: number | undefined;
  isFirst?: boolean | undefined;
  changeView?: boolean | undefined;
  noLoading?: boolean | undefined;
  noClearSelected?: boolean | undefined;
  updateWorksheetControls?: boolean | undefined;
} = {}) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base, filters, views, sheetview, quickFilter, navGroupFilters } = getState().sheet;
    const { appId, viewId, worksheetId, forcePageSize, maxCount, chartId, showAsSheetView } = base;
    let controls: FormControl[] = getState().sheet.controls;
    const view = _.find(views, { viewId });
    const isGroupedView = !!getGroupControlId(view);
    const abortController = sheetview.abortController;
    let savedPageSize: number | undefined = parseInt(getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', worksheetId), 10);

    if (_.isNaN(savedPageSize)) {
      savedPageSize = undefined;
    }

    let { pageIndex, sortControls } = sheetview.sheetFetchParams;

    if (changeView) {
      pageIndex = 1;
      dispatch(resetView());
    }

    const isTreeTableView = checkIsTreeTableView(getState()) && !filters.keyWords;

    if (isTreeTableView && !levelCount) {
      const { level } = safeParse(localStorage.getItem(`hierarchyConfig-${viewId}`));

      if (level) {
        levelCount = Number(level);
      }

      if ((isNaN as (value: number | undefined) => boolean)(levelCount)) {
        levelCount = 1;
      }

      dispatch({
        type: 'UPDATE_TREE_TABLE_VIEW_ITEM',
        value: {
          levelCount,
        },
      });
    }

    let pageSize = isTreeTableView ? 1000 : savedPageSize || DEFAULT_PAGESIZE;

    if (isGroupedView && !chartId) {
      pageSize = getGroupPageSize(maxCount);
    }

    const args: WorksheetRowsRequest & { pageIndex: number } = {
      worksheetId,
      pageSize,
      pageIndex,
      status: 1,
      appId,
      viewId,
      reportId: chartId || undefined,
      sortControls,
      notGetTotal: true,
      ...filters,
      fastFilters: formatQuickFilter(quickFilter),
      navGroupFilters,
      isGetWorksheet: updateWorksheetControls,
      langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
      ...(showAsSheetView || chartId ? { getType: 0 } : {}),
    };
    const groupControlId = !chartId && getGroupControlId(view);
    const groupControl = _.find(controls, control => isMatch(control, { controlId: groupControlId }));

    if (groupControl) {
      args.kanbanIndex = 1;
      args.kanbanSize = 50;
    }

    if (!!groupControl && groupControl.type === 29) {
      args.relationWorksheetId = groupControl.dataSource;
    }

    if (isTreeTableView) {
      args.layer = levelCount;
    }

    if (maxCount) {
      args.pageIndex = 1;
      args.pageSize = maxCount;
    }

    if (forcePageSize && view?.viewType === 0 && !groupControlId) {
      savedPageSize = undefined;
      args.pageSize = forcePageSize;
      dispatch({ type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGESIZE', pageSize: forcePageSize, pageIndex: args.pageIndex });
    }

    if (changeView || isFirst) {
      dispatch(setViewLayout(viewId));
    }

    if (savedPageSize && savedPageSize !== DEFAULT_PAGESIZE) {
      dispatch(changePageSize(savedPageSize, args.pageIndex, { refetch: false }));
    }

    dispatch({
      type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS_START',
      value: {
        noLoading,
        noClearSelected,
      },
    });
    dispatch({ type: 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING', value: true });
    dispatch(getWorksheetSheetViewSummary());
    const fetchRowsAjax = worksheetAjax.getFilterRows(getFilledRequestParams(args, filters.requestParams), {
      abortController,
    });
    fetchRowsAjax
      .then(res => {
        const responseData: unknown = res.data;
        let rows: SheetRow[] = [];
        let groups: SheetGroup[] | undefined;
        if (groupControl && !isTreeTableView) {
          if (!Array.isArray(responseData) || !responseData.every(isSheetGroup))
            throw new Error('Invalid grouped worksheet rows');
          groups = responseData;
        } else {
          if (!Array.isArray(responseData) || !responseData.every(isSheetRow))
            throw new Error('Invalid worksheet rows');
          rows = responseData;
        }
        if (updateWorksheetControls && res.template?.controls) {
          const newControls: FormControl[] = res.template.controls.filter(
            c =>
              c.controlId?.length === 24 ||
              _.includes(
                SYSTEM_CONTROL_WITH_UAID.concat(WORKFLOW_SYSTEM_CONTROL).map(c => c.controlId),
                c.controlId,
              ),
          );
          controls = (
            replaceControlsTranslateInfo as (
              appId: string | undefined,
              worksheetId: string | undefined,
              controls: FormControl[],
            ) => FormControl[]
          )(appId, worksheetId, newControls);
          try {
            dispatch({ type: 'WORKSHEET_UPDATE_CONTROLS', controls });
          } catch (err) {
            console.log(err);
          }
          dispatch(setViewLayout(viewId));
        }

        if (groups && groupControl) {
          rows = flatRowsFromGroups(groups, groupControl, view, controls);
          dispatch(initGroupFolded(view, groups, controls));
        }

        dispatch({
          type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS',
          rows,
          resultCode: res.resultCode,
        });
        if (isGroupedView) {
          dispatch({
            type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
            count: sum(rows.filter((r: SheetRow) => r.rowid === 'groupTitle').map(r => r.count)),
          });
        }

        dispatch({ type: 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING', value: false });
        if (isTreeTableView) {
          const { treeMap, maxLevel } = treeDataUpdater(
            {},
            { rootRows: rows.filter(r => !r.pid), rows, levelLimit: Number(args.layer) },
          );
          dispatch({
            type: 'UPDATE_TREE_TABLE_VIEW_DATA',
            value: { maxLevel, treeMap },
          });
        }

        if (chartId) {
          dispatch({
            type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
            count: res.count,
          });
        }
      })
      .catch((err: unknown) => {
        if (abortController.signal.aborted) return;
        if (plainRecord(err)?.['errorCode'] === 300016) {
          dispatch({ type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS', rows: [], resultCode: 300016 });
        } else {
          dispatch({ type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS', rows: sheetview.sheetViewData.rows });
          if (err instanceof Error) alert(_l('获取记录失败，请稍后重试'), 2);
        }
        dispatch({ type: 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING', value: false });
      });
    if (pageIndex === 1 && !chartId && !isGroupedView) {
      const fetchRowsNumAjax = worksheetAjax.getFilterRowsTotalNum(getFilledRequestParams(args), { abortController });
      fetchRowsNumAjax.then((data: unknown) => {
        if (!data || data === '-1') {
          dispatch({
            type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT_ABNORMAL',
          });
        } else {
          if (typeof data !== 'string' && typeof data !== 'number') {
            dispatch({ type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT_ABNORMAL' });
            return;
          }
          const count = (parseInt as (value: string | number, radix: number) => number)(data, 10);

          if (!_.isNaN(count)) {
            dispatch({
              type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
              count,
            });
          }
        }
      });
    }
  };
};

export const loadGroupMore = (groupKey: string) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base, filters, sheetview, quickFilter, navGroupFilters } = getState().sheet;
    const { appId, viewId, worksheetId, maxCount } = base;
    const abortController = sheetview.abortController;
    let { sortControls } = sheetview.sheetFetchParams;
    const currentRows: SheetRow[] = get(sheetview, 'sheetViewData.rows', []);
    const loadMoreRow = find(currentRows, r => r.groupKey === groupKey && r.rowid === 'loadGroupMore');
    const rows: SheetRow[] = currentRows.filter(r => !(r.groupKey === groupKey && r.rowid === 'loadGroupMore'));
    const groupFetchParams = sheetview.groupFetchParams;
    // Group keys can contain dots; select the exact group before resolving its pageIndex.
    const prevPageIndex = get(groupFetchParams[groupKey], 'pageIndex', 1);
    const nextPageIndex = prevPageIndex + 1;

    if (loadMoreRow?.isLoading) {
      return;
    }

    const args = {
      worksheetId,
      pageSize: getGroupPageSize(maxCount),
      pageIndex: nextPageIndex,
      status: 1,
      appId,
      viewId,
      sortControls,
      notGetTotal: true,
      kanbanKey: groupKey,
      ...filters,
      fastFilters: formatQuickFilter(quickFilter),
      navGroupFilters,
    };
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS',
      rows: currentRows.map(row =>
        row.groupKey === groupKey && row.rowid === 'loadGroupMore' ? { ...row, isLoading: true } : row,
      ),
    });

    worksheetAjax
      .getFilterRows(getFilledRequestParams(args, filters.requestParams), {
        abortController,
      })
      .then(res => {
        let lastRowIndex = _.findLastIndex(rows, r => r.groupKey === groupKey);
        const newRowsOfGroup = get(find(res.data, { key: groupKey }), 'rows', []).map((rowStr: string | RecordRow) => ({
          ...safeParse(rowStr),
          groupKey,
        }));
        let newRows: SheetRow[] = rows;

        if (!isEmpty(newRowsOfGroup)) {
          newRows = [...rows.slice(0, lastRowIndex + 1), ...newRowsOfGroup, ...rows.slice(lastRowIndex + 1)];
          const rowsOfGroup = newRows.filter((r: SheetRow) => r.groupKey === groupKey);
          const group = find(newRows, r => r.rowid === 'groupTitle' && r.key === groupKey);

          if (group && typeof group.count === 'number' && rowsOfGroup.length < group.count) {
            lastRowIndex = _.findLastIndex(newRows, r => r.groupKey === groupKey);
            newRows = [
              ...newRows.slice(0, lastRowIndex + 1),
              {
                rowid: 'loadGroupMore',
                groupKey: group.key,
              },
              ...newRows.slice(lastRowIndex + 1),
            ];
          }
        }

        dispatch({
          type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS',
          rows: newRows,
        });
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_CHANGE_GROUP_FETCH_PARAMS',
          groupKey,
          changes: {
            pageIndex: nextPageIndex,
          },
        });
      })
      .catch(() => {
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS',
          rows: currentRows,
        });
      });
  };
};

export const setRowsEmpty = () => (dispatch: AppDispatch) => {
  dispatch({
    type: 'WORKSHEET_SHEETVIEW_FETCH_ROWS',
    rows: [],
  });
  dispatch({
    type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
    count: 0,
  });
};

export const sortByControl = (
  sortControl?: SheetSortControl,
): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_SORTS'> => ({
  type: 'WORKSHEET_SHEETVIEW_UPDATE_SORTS',
  sortControl,
});

export function updateViewPermission(param?: {
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base } = getState().sheet;
    const { appId, viewId, worksheetId } = base;
    worksheetAjax
      .getViewPermission(
        !_.isEmpty(param)
          ? param
          : {
              appId,
              worksheetId,
              viewId,
            },
      )
      .then(data => {
        if (data.view) {
          dispatch({
            type: 'WORKSHEET_SHEETVIEW_UPDATE_PERMISSION',
            viewId: _.get(param, 'viewId') || viewId,
            value: data.view,
          });
        }
      });
  };
}

export function updateControlOfRow(
  {
    cell = {},
    cells = [],
    recordId,
    rules,
  }: {
    cell?: EditedCell | undefined;
    cells?: EditedCell[] | undefined;
    recordId?: string | undefined;
    rules?: Parameters<typeof getRuleErrorInfo>[0] | undefined;
  },
  options: UpdateCellOptions = {},
) {
  return (dispatch: AppDispatch, getState: GetState) => {
    if (!_.isEmpty(cell) && _.isEmpty(cells)) {
      cells = [cell];
    }

    const { base, controls } = getState().sheet;
    const { appId, viewId, worksheetId } = base;
    const { controlId, value } = cell;
    const control = _.find(controls, { controlId });
    const newOldControl = cells
      .map(cell => {
        const { controlId, editType } = cell;
        let { value } = cell;
        const control = _.find(controls, { controlId });

        if (control && control.type === 29 && typeof value === 'string') {
          try {
            if (value === 'deleteRowIds: all') {
              value = '[]';
            } else {
              const parsedValue = JSON.parse(value);

              if (_.isArray(parsedValue) && !_.isEmpty(parsedValue) && parsedValue[0].sourcevalue) {
                value = JSON.stringify(parsedValue.map(v => _.omit(v, 'sourcevalue')));
              }
            }
          } catch (err) {
            console.log(err);
          }
        }

        return (
          control && {
            ..._.pick(control, ['controlId', 'type', 'controlName', 'dot']),
            editType,
            value,
          }
        );
      })
      .filter(_.identity);

    if (_.isEmpty(newOldControl)) {
      return;
    }

    worksheetAjax
      .updateWorksheetRow({
        appId,
        viewId,
        worksheetId,
        rowId: recordId,
        newOldControl,
      })
      .then((response: unknown) => {
        if (!isRowUpdate(response) || (response.resultCode === 1 && !response.data)) {
          alert(_l('编辑失败！'), 3);
          return;
        }
        const res = response;
        if (res.resultCode === 1 && res.data) {
          dispatch(updateNavGroup());
          if (_.isFunction(options.callback)) {
            options.callback(res.data);
          }

          dispatch(updateRows([recordId], _.omit(res.data, ['allowedit', 'allowdelete'])));
          if (_.isFunction(options.updateSuccessCb)) {
            options.updateSuccessCb(res.data);
          }

          dispatch(getWorksheetSheetViewSummary());
          // 处理新增自定义选项
          if (
            _.includes([WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT, WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN], control?.type) &&
            control &&
            control.options &&
            controlId &&
            typeof value === 'string' &&
            /{/.test(value)
          ) {
            const storedValues: unknown =
              typeof res.data[controlId] === 'string' ? JSON.parse(res.data[controlId]) : undefined;
            const submittedValues: unknown = JSON.parse(value);
            const lastStoredValue: unknown = Array.isArray(storedValues) ? _.last(storedValues) : undefined;
            const lastSubmittedValue: unknown = Array.isArray(submittedValues) ? _.last(submittedValues) : undefined;
            const submittedOption =
              typeof lastSubmittedValue === 'string' ? plainRecord(JSON.parse(lastSubmittedValue)) : undefined;
            const newoption = {
              index: control.options.length + 1,
              isDeleted: false,
              key: lastStoredValue,
              ...submittedOption,
            };
            if (isControlOption(newoption)) {
              const option: ControlOption = newoption;
              const newcontrol = { ...control, options: [...control.options, option] };
              dispatch({ type: 'WORKSHEET_UPDATE_CONTROL', control: newcontrol });
            }
          }
        } else if (res.resultCode === 11) {
          if (options.row) {
            if (controlId) dispatch(updateRows([recordId], { [controlId]: value }));
            dispatch(updateRows([recordId], _.omit(options.row, ['allowedit', 'allowdelete'])));
          }

          handleRecordError(res.resultCode, options.cell);
        } else if (res.resultCode === 32) {
          const errorResult = getRuleErrorInfo(rules, res.badData);

          const firstError = errorResult[0]?.errorInfo[0];
          if (firstError) {
            alert(_l('编辑失败，%0', firstError.errorMessage || ''), 2);
          }
        } else {
          handleRecordError(res.resultCode);
        }
      })
      .catch(() => {
        alert(_l('编辑失败！'), 3);
      });
  };
}

export function insertToGroupedRow(newRow: SheetRow) {
  return (dispatch: AppDispatch, getState: GetState) => {
    if (!newRow.group) {
      return;
    }
    const group = newRow.group;

    const { sheetview } = getState().sheet;
    const { rows, count }: { rows: SheetRow[]; count: number } = sheetview.sheetViewData;
    let lastRowIndexOfGroup = _.findLastIndex(rows, r => r.groupKey === group.key && r.rowid !== 'loadGroupMore');

    if (lastRowIndexOfGroup === -1) {
      const groupIndex = _.findIndex(rows, r => r.key === group.key);

      if (groupIndex === -1) {
        return;
      }

      lastRowIndexOfGroup = groupIndex;
    }

    let newRows: SheetRow[] = [
      ...rows.slice(0, lastRowIndexOfGroup + 1),
      { ...newRow, groupKey: group.key, group: newRow.group },
      ...rows.slice(lastRowIndexOfGroup + 1),
    ];
    newRows = newRows.map((row: SheetRow) => {
      if (row.rowid === 'groupTitle' && row.key === newRow?.group?.key && typeof row.count === 'number') {
        row = {
          ...row,
          count: row.count + 1,
        };
      }

      return row;
    });
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
      count: count + 1,
    });
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
      rows: newRows,
    });
  };
}

export function updateRows(rowIds: Array<string | undefined>, value: SheetRow) {
  return (dispatch: AppDispatch, getState: GetState) => {
    if (value.group) {
      const group = value.group;
      let rows: SheetRow[] = get(getState().sheet.sheetview.sheetViewData, 'rows', []);
      const prevRow = find(rows, r => r.rowid === value.rowid);
      rows = rows.filter((row: SheetRow) => row.rowid !== value.rowid);
      const groupOldRow = find(rows, r => r.rowid === 'groupTitle' && r.key === prevRow?.groupKey);
      const lastRowIndexOfGroup = _.findLastIndex(rows, r => r.groupKey === group.key);

      if (lastRowIndexOfGroup === -1) {
        return;
      }

      const oldRow = rows[lastRowIndexOfGroup];
      let newRows: SheetRow[] = [
        ...rows.slice(0, lastRowIndexOfGroup + 1),
        { ...pick(oldRow, ['allowedit', 'allowdelete']), ...value, groupKey: group.key, group: value.group },
        ...rows.slice(lastRowIndexOfGroup + 1),
      ];
      newRows = newRows.map((row: SheetRow) => {
        if (row.rowid === 'groupTitle' && typeof row.count === 'number') {
          let count = row.count;

          if (groupOldRow && row.key === groupOldRow.key) {
            count = count - 1;
          } else if (row.rowid === 'groupTitle' && row.key === group.key) {
            count = count + 1;
          }

          row = {
            ...row,
            count,
          };
        }

        return row;
      });
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
        rows: newRows,
      });
      return;
    }

    dispatch({
      type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS_BY_ROWIDS',
      rowIds,
      rowUpdatedValue: value,
    });
    dispatch(updateNavGroup());
  };
}

export function refresh({
  resetPageIndex,
  changeFilters,
  noLoading,
  isAutoRefresh,
  noClearSelected,
  updateWorksheetControls,
}: RefreshOptions = {}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const {
      sheetview,
      filters,
      quickFilter,
      navGroupFilters,
      views,
      base: { chartId, viewId },
    } = getState().sheet;
    const { allWorksheetIsSelected, sheetSelectedRows = [] } = sheetview.sheetViewConfig;
    if (isAutoRefresh && (allWorksheetIsSelected || sheetSelectedRows.length)) return;
    const view = _.find(views, { viewId });
    const needClickToSearch = !chartId && _.get(view, 'advancedSetting.clicksearch') === '1';
    //设置了筛选列表，且不显示全部，需手动选择分组后展示数据
    const navGroupToSearch =
      !chartId &&
      _.get(view, 'advancedSetting.showallitem') === '1' &&
      !_.get(view, 'navGroup[0].viewId') &&
      (_.get(view, 'navGroup') || []).length > 0;

    if (filters.keyWords || resetPageIndex || changeFilters) {
      dispatch(changePageIndex(1));
    }

    // clicksearch 仅拦截“无任何快速筛选条件”的初始态；
    // 若默认值已写入 quickFilter，则应按条件自动查询。
    if ((needClickToSearch && _.isEmpty(quickFilter)) || (navGroupToSearch && _.isEmpty(navGroupFilters))) {
      dispatch(setRowsEmpty());
    } else {
      dispatch(abortRequest());
      dispatch(fetchRows({ noLoading, noClearSelected, updateWorksheetControls }));
    }

    dispatch({ type: 'WORKSHEET_SHEETVIEW_REFRESH' });
  };
}

export const clearHighLight = (tableId?: string) => {
  return () => {
    $(`.sheetViewTable.id-${tableId}-id .cell`).removeClass('highlight');
    delete window[`sheetTableHighlightRow${tableId}`];
  };
};

export const setHighLight = (tableId: string | undefined, rowIndex?: number) => {
  return (dispatch: AppDispatch) => {
    dispatch(clearHighLight(tableId));
    $(`.sheetViewTable.id-${tableId}-id .cell.row-${rowIndex}`).addClass('highlight');
    window[`sheetTableHighlightRow${tableId}`] = rowIndex;
  };
};

export const setHighLightOfRows = (rowIds: string[], tableId?: string) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview } = getState().sheet;
    const { rows }: { rows: SheetRow[] } = sheetview.sheetViewData;
    dispatch(clearHighLight(tableId));
    rowIds.forEach((rowId: string | undefined) => {
      let rowIndex = _.findIndex(rows, row => row.rowid === rowId);

      if (_.isUndefined(rowIndex)) {
        return;
      }

      setTimeout(() => {
        $(`${tableId ? `.sheetViewTable.id-${tableId}-id` : '.sheetViewTable'} .cell.row-id-${rowId}`).addClass(
          'highlight',
        );
      }, 100);
      window[`sheetTableHighlightRow${tableId}`] = rowIndex;
    });
  };
};

export const clearSelect = (): SheetViewActionOf<'WORKSHEET_SHEETVIEW_CLEAR_SELECT'> => ({
  type: 'WORKSHEET_SHEETVIEW_CLEAR_SELECT',
});

export function hideRows(rowIds: Array<string | undefined>) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview, views, base = {} } = getState().sheet;
    const view = _.find(views, v => v.viewId === base.viewId);
    const { rows }: { rows: SheetRow[] } = sheetview.sheetViewData;
    rowIds = rowIds.filter((rowId: string | undefined) => _.find(rows, r => rowId === r.rowid));
    if (rowIds.length) {
      dispatch(clearSelect());
      if (getGroupControlId(view)) {
        const newRows: SheetRow[] = rows.map((groupRow: SheetRow) => {
          if (groupRow.rowid === 'groupTitle' && typeof groupRow.count === 'number') {
            const deletedRowsLengthOfGroup = rowIds.filter((rowId: string | undefined) => {
              const row = rows.find((r: SheetRow) => r.rowid === rowId);
              return row && row.groupKey === groupRow.key;
            }).length;
            return { ...groupRow, count: groupRow.count - deletedRowsLengthOfGroup };
          }

          return groupRow;
        });
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
          rows: newRows,
        });
      }

      dispatch({
        type: 'WORKSHEET_SHEETVIEW_HIDE_ROWS',
        rowIds,
      });
      if (checkIsTreeTableView(getState())) {
        rowIds.forEach((rowId: string | undefined) => {
          rows.forEach((row: SheetRow) => {
            if (row.pid === rowId || includes(row.childrenids, rowId)) {
              // pid 置 undefined = 把这行从父节点下摘出来；childrenids 是 JSON 串
              const changes: { pid?: string | undefined; childrenids?: string | undefined } = {};

              if (row.pid === rowId) {
                changes.pid = undefined;
              }

              if (includes(row.childrenids, rowId)) {
                changes.childrenids = JSON.stringify(
                  safeParse(row.childrenids, 'array').filter((id: string) => id !== rowId),
                );
              }

              dispatch(updateRows([row.rowid], changes));
            }
          });
        });
        dispatch(refreshTreeOfTreeTableView());
      }
    }

    dispatch(updateNavGroup());
  };
}

export function selectRows({
  rows = [],
  selectAll,
}: {
  rows?: RecordRow[] | undefined;
  selectAll?: boolean | undefined;
}): SheetViewActionOf<'WORKSHEET_SHEETVIEW_SELECT_ALL' | 'WORKSHEET_SHEETVIEW_SELECT_ROWS'> {
  if (selectAll) {
    return {
      type: 'WORKSHEET_SHEETVIEW_SELECT_ALL',
      value: true,
    };
  } else {
    return {
      type: 'WORKSHEET_SHEETVIEW_SELECT_ROWS',
      rows,
    };
  }
}

export function changeToSelectCurrentPageFromSelectAll() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview } = getState().sheet;
    const { rows = [] } = sheetview.sheetViewData;
    dispatch(clearSelect());
    dispatch(
      selectRows({ rows: rows.filter((r: SheetRow) => r.rowid !== 'groupTitle' && r.rowid !== 'loadGroupMore') }),
    );
  };
}

// The overload checks single/batch argument combinations; this object forwards those same four fields.
export const updateSheetColumnWidths: SheetColumnWidthActionCreator = (controlId, value, changes) =>
  ({
    type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH',
    controlId,
    value,
    changes,
  }) as SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_WIDTH'>;

export const hideColumn = (controlId: string): SheetViewActionOf<'WORKSHEET_SHEETVIEW_HIDE_COLUMN'> => ({
  type: 'WORKSHEET_SHEETVIEW_HIDE_COLUMN',
  controlId,
});

export const clearHiddenColumn = (): SheetViewActionOf<'WORKSHEET_SHEETVIEW_CLEAR_HIDDEN_COLUMN'> => ({
  type: 'WORKSHEET_SHEETVIEW_CLEAR_HIDDEN_COLUMN',
});

export function frozenColumn(columnIndex: number): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_FIXED_COLUMN_COUNT'> {
  return { type: 'WORKSHEET_SHEETVIEW_UPDATE_FIXED_COLUMN_COUNT', value: columnIndex };
}

export function saveSheetLayout({
  isApplyAll,
  closePopup = () => {},
}: {
  isApplyAll?: boolean | undefined;
  closePopup?: (() => void) | undefined;
}) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { base, controls, views, sheetview, worksheetInfo } = getState().sheet;
    const { appId, worksheetId, viewId } = base;
    const { fixedColumnCount, sheetHiddenColumns, columnStyles, sheetColumnWidths } = sheetview.sheetViewConfig;
    const view = _.find(views, v => v.viewId === viewId);

    if (!view) {
      return;
    }

    const hadNewConfig = get(worksheetInfo, 'advancedSetting.liststyle') || get(view, 'advancedSetting.liststyle');
    const updates: SaveViewLayoutRequest = {
      appId,
      worksheetId,
      viewId,
      editAttrs: ['AdvancedSetting'],
    };
    const listStyleStr = JSON.stringify({
      time: Date.now(),
      styles: uniq(Object.keys(columnStyles).concat(!hadNewConfig ? Object.keys(sheetColumnWidths) : [])).map(cid => ({
        cid,
        ...(!hadNewConfig ? { width: sheetColumnWidths[cid] } : {}),
        ...(columnStyles[cid] || {}),
      })),
    });
    updates.advancedSetting = {
      fixedcolumncount: fixedColumnCount,
      layoutupdatetime: new Date().getTime(),
    };
    if (!isApplyAll) {
      updates.advancedSetting.liststyle = listStyleStr;
    }

    if (sheetHiddenColumns.length) {
      updates.editAttrs = updates.editAttrs.concat('ShowControls');
      if (view.advancedSetting?.customdisplay === '1' && view.showControls?.length) {
        // showControls 里是字段 id（原来标成 cid: FormControl 是错的，下面就是拿它和 id 比）
        updates.showControls = view.showControls.filter(
          (cid: string) => !_.find(sheetHiddenColumns, hcid => hcid === cid),
        );
      } else {
        updates.advancedSetting.customdisplay = '1';
        updates.showControls = controls
          .filter(
            (c: FormControl) =>
              /^\w{24}$/.test(c.controlId || '') ||
              _.includes(safeParse(view.advancedSetting?.sysids, 'array'), c.controlId),
          )
          .sort((a, b) => ((a.row ?? NaN) * 10 + (a.col ?? NaN) > (b.row ?? NaN) * 10 + (b.col ?? NaN) ? 1 : -1))
          .filter(c => (isEmpty(view.showControls) ? true : includes(view.showControls, c.controlId)))
          .filter(c => !_.find(sheetHiddenColumns, hcid => hcid === c.controlId))
          .map(c => c.controlId);
      }
    }

    updates.editAdKeys = Object.keys(updates.advancedSetting);
    dispatch(clearHiddenColumn());
    dispatch({
      type: 'WORKSHEET_UPDATE_VIEW',
      view: {
        ...view,
        ...updates,
        advancedSetting: {
          ...view.advancedSetting,
          ...updates.advancedSetting,
        },
      },
    });
    closePopup();
    worksheetAjax
      .saveWorksheetView(updates)
      .then(() => {})
      .catch(err => {
        alert(_l('保存表格外观失败！'), 3);
        console.log(err);
      });
    if (isApplyAll) {
      worksheetAjax
        .editWorksheetSetting({
          appId,
          worksheetId,
          editAdKeys: ['liststyle'],
          advancedSetting: {
            liststyle: listStyleStr,
          },
        })
        .then(() => {
          dispatch({
            type: 'WORKSHEET_UPDATE_WORKSHEETINFO',
            info: {
              advancedSetting: {
                ...worksheetInfo.advancedSetting,
                liststyle: listStyleStr,
              },
            },
          });
          clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', viewId);
        });
    }
  };
}

export function resetSheetLayout() {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { base, views, worksheetInfo } = getState().sheet;
    const { viewId } = base;
    const view = _.find(views, v => v.viewId === viewId);

    if (!view) {
      return;
    }

    const { advancedSetting = {} } = view;
    dispatch(clearHiddenColumn());
    dispatch(frozenColumn(Number(advancedSetting.fixedcolumncount || 0)));
    saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', viewId, advancedSetting.fixedcolumncount || 0);
    clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_WIDTH', viewId);
    clearLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', viewId);
    const { map: sheetColumnWidthsMap } = getSheetColumnWidthsMap(view, worksheetInfo);
    dispatch({ type: 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH', value: sheetColumnWidthsMap || {} });
    clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', viewId);
    dispatch(setColumnStyles(view, worksheetInfo));
  };
}

export const updateDefaultScrollLeft = (
  value?: number,
): SheetViewActionOf<'WORKSHEET_SHEETVIEW_UPDATE_SCROLL_LEFT'> => ({
  type: 'WORKSHEET_SHEETVIEW_UPDATE_SCROLL_LEFT',
  value,
});

// 更新每页数量
export function changePageSize(pageSize: number, pageIndex: number, { refetch = true } = {}) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { base } = getState().sheet;
    saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', base.worksheetId, pageSize);
    dispatch({ type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGESIZE', pageSize, pageIndex });
    if (refetch) {
      dispatch(fetchRows());
    }
  };
}

// 分页
export function changePageIndex(pageIndex: number, sleep?: number) {
  return function (dispatch: AppDispatch) {
    if (sleep) {
      setTimeout(() => {
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGEINDEX',
          pageIndex,
        });
      }, sleep);
    } else {
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGEINDEX',
        pageIndex,
      });
    }
  };
}

function resetView() {
  return (dispatch: AppDispatch) => {
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_CLEAR',
    });
  };
}

/**
 * 整理逻辑，重写这里
 * 列冻结，列隐藏，列宽，对齐方式
 * 老配置-本地：列冻结 fixedcolumncount，列宽 sheetcolumnwidths，更新时间 layoutupdatetime
 * 新配置-本地：列宽(和对齐方式) - liststyle，列冻结 fixedcolumncount，更新时间 layoutupdatetime
 */

export function setViewLayout(viewId: string | undefined) {
  // pageSize 更新逻辑
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base = {}, views, worksheetInfo } = getState().sheet;
    let view = _.find(views, { viewId });

    if (base.chartId && !view) {
      view = views.filter(v => get(v, 'advancedSetting.liststyle'))[0];
      if (view) {
        view = {
          ...view,
          advancedSetting: {
            liststyle: get(view, 'advancedSetting.liststyle'),
          },
        };
      }
    }

    if ((!view || view.viewType !== 0) && !checkIsTreeTableView(getState())) {
      return;
    }

    dispatch(setColumnStyles(view, worksheetInfo, { updateWidths: false }));
    const { advancedSetting = {} } = view || {};
    let sheetColumnWidths: SheetColumnWidths = {};
    const localLayoutUpdateTime = getLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', viewId);
    const pageSize = parseInt(getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', worksheetInfo.worksheetId), 10);
    let frozonIndex = getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', viewId);

    /**
     * sheetColumnWidths 逻辑
     * 1. 老表，取本地 width
     * 2. 新表本地新，取本地 styles
     * 3. 新表配置新，取配置 styles
     */
    try {
      // 默认给了旧配置本地
      sheetColumnWidths = safeParse(getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_WIDTH', viewId));
    } catch (err) {
      console.log(err);
    }

    // advancedSetting 内属性名需为全小写 兼容老数据
    if (advancedSetting.layoutUpdateTime) advancedSetting.layoutupdatetime = advancedSetting.layoutUpdateTime;
    if (advancedSetting.fixedColumnCount) advancedSetting.fixedcolumncount = advancedSetting.fixedColumnCount;
    if (advancedSetting.sheetColumnWidths) advancedSetting.sheetcolumnwidths = advancedSetting.sheetColumnWidths;

    const { time: listStyleUpdateTime, map: sheetColumnWidthsMap } = getSheetColumnWidthsMap(view, worksheetInfo);
    const localColumnStyles: ColumnStyleSnapshot = JSON.parse(
      (view && getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', view.viewId)) || '{}',
    );

    // sheetColumnWidthsMap 是配置的数据，view 和 worksheet 取最新的那个
    if ((localColumnStyles && (localColumnStyles.time ?? NaN) > Number(listStyleUpdateTime)) || !listStyleUpdateTime) {
      // 本地样式配置时间比配置里的新
      sheetColumnWidths = mapValues(localColumnStyles.styles, 'width');
    } else {
      sheetColumnWidths = sheetColumnWidthsMap || {};
    }

    if (
      localColumnStyles.time &&
      listStyleUpdateTime &&
      Number(listStyleUpdateTime) > (localColumnStyles.time ?? NaN)
    ) {
      clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', view?.viewId);
    }

    // 兼容老数据
    if (
      advancedSetting.layoutupdatetime &&
      (!localLayoutUpdateTime || Number(advancedSetting.layoutupdatetime) > Number(localLayoutUpdateTime))
    ) {
      if (advancedSetting.fixedcolumncount) {
        frozonIndex = Number(advancedSetting.fixedcolumncount);
        clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', viewId);
      }

      if (
        !sheetColumnWidthsMap &&
        !(localColumnStyles && localColumnStyles.time) &&
        advancedSetting.sheetcolumnwidths
      ) {
        try {
          sheetColumnWidths = { ...sheetColumnWidths, ...JSON.parse(advancedSetting.sheetcolumnwidths) };
          saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_WIDTH', viewId, JSON.stringify(sheetColumnWidths));
        } catch (err) {
          console.log(err);
        }
      }
    }

    if (!_.isEmpty(sheetColumnWidths)) {
      dispatch({ type: 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH', value: sheetColumnWidths });
    }

    if (_.isNumber(pageSize) && !_.isNaN(pageSize)) {
      dispatch({ type: 'WORKSHEET_SHEETVIEW_CHANGE_PAGESIZE', pageSize });
    }

    if (_.isNumber(parseInt(frozonIndex, 10)) && !_.isNaN(parseInt(frozonIndex, 10))) {
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_FIXED_COLUMN_COUNT',
        value: parseInt(frozonIndex, 10),
      });
    }
  };
}

function columnStylesMergeChanges(columnStyles: SheetColumnStyles = {}, changes: SheetColumnStyles = {}) {
  const newChanges = { ...changes };
  Object.keys(changes).forEach(cid => {
    if (columnStyles[cid]) {
      newChanges[cid] = assign({}, columnStyles[cid], changes[cid]);
    }
  });
  return assign({}, columnStyles, newChanges);
}

export function setColumnStyles(view: WorksheetView = {}, worksheetInfo: WorksheetInfo, { updateWidths = true } = {}) {
  return (dispatch: AppDispatch) => {
    try {
      const listStyleStrOfWorksheet = get(worksheetInfo, 'advancedSetting.liststyle');
      const listStyleStrOfView = get(view, 'advancedSetting.liststyle');
      const viewId = get(view, 'viewId');
      const localColumnStyles: ColumnStyleSnapshot = JSON.parse(
        getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', viewId) || '{}',
      );

      if (!listStyleStrOfView && !listStyleStrOfWorksheet && !localColumnStyles) {
        const sheetcolumnwidths = get(view, 'advancedSetting.sheetcolumnwidths');

        if (sheetcolumnwidths && updateWidths) {
          try {
            const sheetColumnWidths = JSON.parse(sheetcolumnwidths);
            dispatch({ type: 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH', value: sheetColumnWidths });
          } catch (err) {
            console.log(err);
          }
        }

        return;
      }

      const { time, styles = [] } = getListStyle(listStyleStrOfView, listStyleStrOfWorksheet);
      let columnStyles = styles.reduce(
        (a: SheetColumnStyles, b: SheetColumnStyles[string]) =>
          Object.assign({}, a, { [b.cid === undefined ? 'undefined' : b.cid]: b }),
        {},
      );

      if ((localColumnStyles.time && localColumnStyles.time > Number(time)) || !time) {
        columnStyles = assign({}, columnStyles, localColumnStyles.styles);
      } else if (Number(time) > (localColumnStyles.time ?? NaN)) {
        clearLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', viewId);
      }

      if (updateWidths) {
        const sheetColumnWidths = _.mapValues(columnStyles, item => item.width);
        dispatch({ type: 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH', value: sheetColumnWidths });
      }

      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_STYLES',
        value: columnStyles,
      });
    } catch (err) {
      console.error(err);
    }
  };
}

export function updateColumnStyles(changes: SheetColumnStyles) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview } = getState().sheet;
    const { columnStyles } = sheetview.sheetViewConfig;
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_UPDATE_COLUMN_STYLES',
      value: columnStylesMergeChanges(columnStyles, changes),
    });
  };
}

export function saveColumnStylesToLocal(changes: SheetColumnStyles) {
  return (_dispatch: AppDispatch, getState: GetState) => {
    const { sheetview, base } = getState().sheet;
    const viewId = get(base, 'viewId');

    if (viewId) {
      const columnStyles = get(sheetview, 'sheetViewConfig.columnStyles');
      const newColumnStyles = columnStylesMergeChanges(columnStyles, changes);
      saveLRUWorksheetConfig(
        'WORKSHEET_VIEW_COLUMN_STYLES',
        viewId,
        JSON.stringify({
          time: Date.now(),
          styles: newColumnStyles,
        }),
      );
    }
  };
}

function triggerGroupedSummary() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base } = getState().sheet;
    const { viewId } = base;
    const groupedSavedData: SummarySavedConfig = safeParse(
      getLRUWorksheetConfig('GROUPED_WORKSHEET_VIEW_SUMMARY_TYPES', viewId),
    );

    if (isArray(get(groupedSavedData, 'groupRows'))) {
      get(groupedSavedData, 'groupRows', []).forEach((r: { key: string; controlType: number; controlId: string }) => {
        dispatch(
          getWorksheetSheetViewSummary({
            groupArgs: {
              groupKey: r.key,
              filters: getFiltersForGroupedView({ type: r.controlType, controlId: r.controlId }, r.key),
            },
          }),
        );
      });
    }
  };
}

export function getWorksheetSheetViewSummary({
  reset = false,
  groupArgs = {},
}: { reset?: boolean | undefined; groupArgs?: SummaryGroupArgs | undefined } = {}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base, sheetview, filters, quickFilter, navGroupFilters, views = [] } = getState().sheet;
    const { appId, viewId, worksheetId, chartId } = base;
    const { rowsSummary } = sheetview.sheetViewData;
    const configData = mapValues(sheetview.sheetViewConfig.columnStyles, 'report');
    let savedData: SheetSummaryTypes | undefined = {};

    try {
      if (!groupArgs.groupKey) {
        savedData = safeParse(getLRUWorksheetConfig('WORKSHEET_VIEW_SUMMARY_TYPES', viewId));
      } else {
        const groupedSavedData: SummarySavedConfig = JSON.parse(
          getLRUWorksheetConfig('GROUPED_WORKSHEET_VIEW_SUMMARY_TYPES', viewId),
        );
        savedData = groupedSavedData.types;
      }
    } catch (err) {
      console.log(err);
    }

    let types = Object.assign(
      {},
      savedData,
      !isEmpty(pickBy(configData, identity)) && reset ? configData : pickBy(configData, identity),
      reset || groupArgs.groupKey ? {} : rowsSummary.types,
    );

    if (reset) {
      types = mapValues(types, v => v || 0);
    }

    const columnRpts = Object.keys(types).map(controlId => ({
      controlId,
      // parseInt coerces numeric summary settings at runtime; this annotation preserves that call.
      rptType: (parseInt as (value: string | number | undefined, radix?: number) => number)(types[controlId], 10),
    }));
    const view = find(views, { viewId });

    if (!groupArgs.groupKey && !!getGroupControlId(view)) {
      dispatch(triggerGroupedSummary());
    }

    if (!columnRpts.length) {
      return;
    }

    worksheetAjax
      .getFilterRowsReport(
        getFilledRequestParams({
          appId,
          viewId,
          worksheetId,
          reportId: chartId || undefined,
          columnRpts,
          filterControls: [],
          keyWords: '',
          searchType: 1,
          ...(filters as Partial<WorksheetFilters>),
          fastFilters: quickFilter
            .concat(groupArgs.filters || [])
            .map(f =>
              _.pick(f, [
                'controlId',
                'dataType',
                'spliceType',
                'filterType',
                'dateRange',
                'value',
                'values',
                'minValue',
                'maxValue',
              ]),
            ),
          navGroupFilters,
        }),
      )
      .then((data: unknown) => {
        if (
          !Array.isArray(data) ||
          !data.every(
            (item: unknown): item is { controlId: string; value?: unknown } =>
              typeof plainRecord(item)?.['controlId'] === 'string',
          )
        ) {
          alert(_l('获取统计失败，请稍后重试'), 2);
          return;
        }
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS',
          types: groupArgs.groupKey ? savedData : types,
          values: data.length
            ? [{}, ...data].reduce<Record<string, unknown>>(
                (a, b: { controlId?: string; value?: unknown }) =>
                  Object.assign({}, a, { [b.controlId === undefined ? 'undefined' : b.controlId]: b.value }),
                {},
              )
            : {},
          groupKey: groupArgs.groupKey,
        });
      });
  };
}

export function changeWorksheetSheetViewSummaryType({
  controlId,
  value,
  groupArgs = {},
}: {
  controlId: string;
  value: number;
  groupArgs?: SummaryGroupArgs | undefined;
}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview, base } = getState().sheet;
    const {
      rows = [],
      rowsSummary,
      groupRowsSummary,
    }: {
      rows: SheetRow[];
      rowsSummary: RootState['sheet']['sheetview']['sheetViewData']['rowsSummary'];
      groupRowsSummary: RootState['sheet']['sheetview']['sheetViewData']['groupRowsSummary'];
    } = sheetview.sheetViewData;
    const { viewId } = base;
    let newTypes = {};
    const groupRows = rows.filter((row: SheetRow) => row.rowid === 'groupTitle');

    if (!groupArgs.groupKey) {
      newTypes = Object.assign({}, rowsSummary.types, { [controlId]: value });
      saveLRUWorksheetConfig('WORKSHEET_VIEW_SUMMARY_TYPES', viewId, JSON.stringify(newTypes));
    } else {
      newTypes = Object.assign({}, groupRowsSummary.types, { [controlId]: value });
    }

    if (groupRows.length) {
      saveLRUWorksheetConfig(
        'GROUPED_WORKSHEET_VIEW_SUMMARY_TYPES',
        viewId,
        JSON.stringify({
          groupRows: groupRows.map(r => ({
            key: r.key,
            controlType: r.controlType,
            controlId: get(r, 'control.controlId'),
          })),
          types: newTypes,
        }),
      );
    }

    if (value === 0) {
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS',
        types: newTypes,
        groupKey: groupArgs.groupKey,
      });
      return;
    }

    dispatch({
      type: 'WORKSHEET_SHEETVIEW_FETCH_REPORT_SUCCESS',
      types: newTypes,
      values: {},
      groupKey: groupArgs.groupKey,
    });
    if (!_.isEmpty(groupArgs)) {
      dispatch(getWorksheetSheetViewSummary({ groupArgs }));
    } else {
      dispatch(getWorksheetSheetViewSummary());
    }
  };
}

export function addRecord(records: SheetRow | SheetRow[], afterRowId?: string) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const { sheetview, base = {}, views = [], controls = [] } = state.sheet;
    const { worksheetId, viewId } = base;
    const { rows, count }: { rows: SheetRow[]; count: number } = sheetview.sheetViewData;

    if (!_.isArray(records)) {
      if (records.group) {
        dispatch(insertToGroupedRow(records));
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
          count: count + 1,
        });
        return;
      }

      records = [records];
    }

    const normalizedRecords = records as SheetRow[];
    dispatch({
      type: 'WORKSHEET_SHEETVIEW_UPDATE_COUNT',
      count: count + records.length,
    });
    dispatch(getWorksheetSheetViewSummary());
    if (afterRowId) {
      const afterRowIndex = _.findIndex(rows, row => row.rowid === afterRowId);
      const newRows: SheetRow[] = _.isUndefined(afterRowId)
        ? [...normalizedRecords, ...rows]
        : [...rows.slice(0, afterRowIndex + 1), ...normalizedRecords, ...rows.slice(afterRowIndex + 1)];
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
        rows: newRows,
        count: count + 1,
      });
    } else {
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
        rows: [...normalizedRecords, ...rows],
        count: count + 1,
      });
    }

    const view = find(views, { viewId });
    const viewControl = view?.viewControl;

    function expand() {
      const childrenControl = find(controls, c => c.sourceControlId === viewControl);
      dispatch(
        refreshTreeOfTreeTableView(({ treeMap = {} }) => {
          const keyOfRow = findKey(treeMap, value => _.get(value, 'rowid') === get(records, '0.rowid'));

          if (childrenControl && get(records, '0.' + childrenControl.controlId) && normalizedRecords[0]) {
            dispatch(
              updateTreeNodeExpansion(Object.assign(normalizedRecords[0], { key: keyOfRow }), { forceUpdate: true }),
            );
          }
        }),
      );
    }

    if (checkIsTreeTableView(getState())) {
      try {
        const parentRecordId = get(safeParse(get(records, '0.' + viewControl)), '0.sid');

        if (parentRecordId && !find(rows, { rowid: parentRecordId })) {
          getRowDetail({
            worksheetId,
            getType: 1,
            rowId: parentRecordId,
          }).then(data => {
            dispatch({
              type: 'WORKSHEET_SHEETVIEW_UPDATE_ROWS',
              rows: [safeParse(data.rowData), ...normalizedRecords, ...rows],
              count: count + 2,
            });
            expand();
          });
        } else {
          expand();
        }
      } catch (err) {
        console.log(err);
      }
    }
  };
}

/**
 * 修改树形表格展开层级
 * @param {number} levelCount
 * @returns
 */
export function changeTreeTableViewLevelCount(levelCount: number) {
  return (dispatch: AppDispatch) => {
    dispatch(fetchRows({ levelCount }));
    dispatch({
      type: 'UPDATE_TREE_TABLE_VIEW_ITEM',
      value: {
        levelCount,
      },
    });
  };
}

/**
 * 展开所有节点
 */
export function expandAllTreeTableViewNode() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview = {} }: { sheetview?: Partial<RootState['sheet']['sheetview']> | undefined } = getState().sheet;
    const { rows = [] }: { rows?: SheetRow[] | undefined } = sheetview.sheetViewData || {};
    const { treeMap = {} } = sheetview.treeTableViewData || {};
    const needLoadNodes = Object.keys(treeMap)
      .filter(key => treeMap[key]?.folded)
      .map(key => treeMap[key])
      .filter((node): node is NonNullable<typeof node> => node !== undefined);
    needLoadNodes.forEach(needLoadNode => {
      const row = find(rows, { rowid: needLoadNode.rowid });

      if (row) {
        dispatch(updateTreeNodeExpansion({ ...row, key: needLoadNode.key }, { expandAll: true }));
      }
    });
  };
}

/**
 * 收起所有节点
 */
export function collapseAllTreeTableViewNode() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview = {} }: { sheetview?: Partial<RootState['sheet']['sheetview']> | undefined } = getState().sheet;
    const { treeMap = {} } = sheetview.treeTableViewData || {};
    dispatch({
      type: 'UPDATE_TREE_TABLE_VIEW_ITEM',
      value: {
        treeMap: _.mapValues(treeMap, function (value) {
          return { ...value, folded: true };
        }),
      },
    });
  };
}

/**
 * 重新渲染树
 */
export function refreshTreeOfTreeTableView(cb: (result: { treeMap: TreeMap }) => void = () => {}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheetview = {} }: { sheetview?: Partial<RootState['sheet']['sheetview']> | undefined } = getState().sheet;
    const oldTreeMap = get(sheetview, 'treeTableViewData.treeMap');
    const { rows = [] }: { rows?: SheetRow[] | undefined } = sheetview.sheetViewData || {};
    const { treeMap, maxLevel } = treeDataUpdater({}, { rootRows: rows.filter((r: SheetRow) => !r.pid), rows });
    dispatch({
      type: 'UPDATE_TREE_TABLE_VIEW_DATA',
      value: {
        maxLevel,
        treeMap: forEach(treeMap, (_value, key) => {
          try {
            const node = treeMap[key];
            if (node) node.folded = get(oldTreeMap?.[key], 'folded');
          } catch (err) {
            console.log(err);
          }
        }),
      },
    });
    cb({ treeMap });
  };
}

export function updateTreeByRowChange({
  recordId,
  changedValue = {},
}: { recordId?: string | undefined; changedValue?: RecordRow | undefined } = {}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const {
      base,
      views,
      sheetview = {},
    }: {
      base: RootState['sheet']['base'];
      views: RootState['sheet']['views'];
      sheetview?: Partial<RootState['sheet']['sheetview']> | undefined;
    } = getState().sheet;
    const { rows = [] }: { rows?: SheetRow[] | undefined } = sheetview.sheetViewData || {};
    const { treeMap = {} } = sheetview.treeTableViewData || {};
    const { viewId } = base;
    const view = find(views, v => v.viewId === viewId) || {};
    const treeBaseControl = view.viewControl;

    if (!treeBaseControl) {
      return;
    }

    const row = find(rows, { rowid: recordId });
    const oldParentRecordId = get(safeParse(get(row, treeBaseControl)), '0.sid');
    const newParentRecordId = get(safeParse(get(changedValue, treeBaseControl)), '0.sid');
    const oldParentRow = find(rows, { rowid: oldParentRecordId });
    const newParentRow = find(rows, { rowid: newParentRecordId });
    dispatch(
      updateRows([recordId], {
        pid: newParentRecordId,
      }),
    );
    if (oldParentRow) {
      Object.keys(treeMap)
        .filter(key => new RegExp(oldParentRecordId + '$').test(key))
        .forEach(key => {
          dispatch(updateTreeNodeExpansion({ ...oldParentRow, key }, { forceUpdate: true }));
        });
    } else {
      dispatch(hideRows([recordId]));
    }

    if (newParentRow) {
      Object.keys(treeMap)
        .filter(key => new RegExp(newParentRecordId + '$').test(key))
        .forEach(key => {
          dispatch(updateTreeNodeExpansion({ ...newParentRow, key }, { forceUpdate: true }));
        });
    }
  };
}

export const initAbortController = (): SheetViewActionOf<'WORKSHEET_SHEETVIEW_INIT_ABORT_CONTROLLER'> => ({
  type: 'WORKSHEET_SHEETVIEW_INIT_ABORT_CONTROLLER',
});

export function abortRequest() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const abortController = get(getState(), 'sheet.sheetview.abortController');

    if (abortController) {
      abortController.abort();
      dispatch(initAbortController());
    }
  };
}

export function updateFolded(key: string, value: boolean) {
  return (dispatch: AppDispatch, getState: GetState) => {
    if (key === 'all') {
      if (value) {
        const { sheetview = {} }: { sheetview?: Partial<RootState['sheet']['sheetview']> | undefined } =
          getState().sheet;
        const { rows = [] }: { rows?: SheetRow[] | undefined } = sheetview.sheetViewData || {};
        const groupRows = rows.filter((row: SheetRow) => row.rowid === 'groupTitle');
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_UPDATE_FOLDED',
          value: groupRows.reduce((a, b) => ({ ...a, [b.key === undefined ? 'undefined' : b.key]: value }), {}),
        });
      } else {
        dispatch({
          type: 'WORKSHEET_SHEETVIEW_CLEAR_FOLDED',
        });
      }
    } else {
      dispatch({
        type: 'WORKSHEET_SHEETVIEW_UPDATE_FOLDED',
        value: {
          [key]: value,
        },
      });
    }
  };
}
