import update from 'immutability-helper';
import { includes, isEmpty, noop } from 'lodash';
import _ from 'lodash';
import { uniqBy } from 'lodash/array';
import sheetAjax from 'src/api/worksheet';
import worksheetAjax from 'src/api/worksheet';
import {
  formatFilterValues,
  formatFilterValuesToServer,
  handleConditionsDefault,
  validate,
} from 'worksheet/common/Sheet/QuickFilter/utils';
import type { QuickFilterDisplayValue, WorksheetFilterCondition, WorksheetView } from 'src/pages/worksheet/types';
import type { AppDispatch, GetState, RootState } from 'src/redux/types';
import { getTranslateInfo } from 'src/utils/app';
import { getFilledRequestParams } from 'src/utils/common';
import type { FormControl } from 'src/utils/controlTypes';
import { formatQuickFilter } from 'src/utils/filter';
import { readBoardGroups } from '../reducers/boardViewApi';
import type {
  BoardAddRecordPayload,
  BoardGroup,
  BoardMultiSelectPayload,
  BoardRecord,
  BoardRecordCountDelta,
  BoardRecordCounts,
  BoardRecordLocation,
  BoardRowsRequest,
  BoardSortRequest,
  BoardTitlePayload,
  BoardUpdateRecordPayload,
  BoardViewAction,
  BoardViewCardState,
  BoardViewPageState,
} from '../reducers/boardViewTypes';
import { getBoardItemKey, getCurrentView } from '../util';
import { updateNavGroup } from './navFilter.js';
import { getParaIds, sortDataByCustomItems } from './util';
import { wrapAjax } from './util';

let boardPromiseObj: ReturnType<typeof worksheetAjax.getFilterRows> | undefined;
let boardPromiseViewIds: Array<string | undefined> = [];

const wrappedGetFilterRows = wrapAjax(worksheetAjax.getFilterRows);

function getQuickFilterForRequest({
  quickFilter = [],
  view = {},
  controls = [],
  chartId,
}: {
  quickFilter?: RootState['sheet']['quickFilter'];
  view?: WorksheetView;
  controls?: RootState['sheet']['controls'];
  chartId?: string | undefined;
}) {
  if (!_.isEmpty(quickFilter) || chartId || _.get(view, 'advancedSetting.clicksearch') === '1') {
    return quickFilter;
  }

  const newFastFilters = handleConditionsDefault(view.fastFilters || [], controls) as WorksheetFilterCondition[];

  if (!_.some(newFastFilters, validate)) {
    return quickFilter;
  }

  return newFastFilters.filter(validate).map(condition => ({
    ...condition,
    filterType: condition.dataType === 29 && condition.filterType === 2 ? 24 : condition.filterType || 2,
    spliceType: condition.spliceType || 1,
    values: (formatFilterValuesToServer as (type: number | undefined, values: QuickFilterDisplayValue[]) => string[])(
      condition.dataType,
      (formatFilterValues as (type: number | undefined, values?: string[] | undefined) => QuickFilterDisplayValue[])(
        condition.dataType,
        condition.values,
      ),
    ),
    ...(condition.dataType === 36 ? { value: 1 } : {}),
  }));
}

export function updateBoardViewRecordCount(
  data: BoardRecordCountDelta,
): Extract<BoardViewAction, { type: 'UPDATE_BOARD_VIEW_RECORD_COUNT' }> {
  return { type: 'UPDATE_BOARD_VIEW_RECORD_COUNT', data };
}

export function initBoardViewRecordCount(
  data: BoardRecordCounts,
): Extract<BoardViewAction, { type: 'INIT_BOARD_VIEW_RECORD_COUNT' }> {
  return { type: 'INIT_BOARD_VIEW_RECORD_COUNT', data };
}

export function changeBoardViewData(
  data: BoardGroup[],
): Extract<BoardViewAction, { type: 'CHANGE_BOARD_VIEW_DATA' | 'UPDATE_BOARD_VIEW_DATA' }> {
  return {
    type: 'CHANGE_BOARD_VIEW_DATA',
    data,
  };
}

export function delBoardViewRecord(data: BoardRecordLocation) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    sheetAjax.deleteWorksheetRows({ rowIds: [data.rowId], ...getParaIds(sheet) }).then(res => {
      if (res.isSuccess) {
        dispatch({ type: 'DEL_BOARD_VIEW_RECORD_COUNT', data } satisfies BoardViewAction);
        dispatch(updateBoardViewRecordCount([data.key, -1]));
        dispatch(updateNavGroup());
      }
    });
  };
}

export function addRecord(data: BoardAddRecordPayload) {
  return (dispatch: AppDispatch) => {
    const { item, key } = data;
    dispatch({ type: 'ADD_BOARD_VIEW_RECORD', data: { item, key } } satisfies BoardViewAction);
    dispatch(updateBoardViewRecordCount([key, 1]));
    dispatch(updateNavGroup());
  };
}

export function onCopySuccess(data: BoardAddRecordPayload) {
  return (dispatch: AppDispatch) => {
    const { item, key } = data;
    dispatch({ type: 'ADD_BOARD_VIEW_RECORD', data: { item, key } } satisfies BoardViewAction);
    dispatch(updateBoardViewRecordCount([key, 1]));
  };
}

export function updateBoardViewRecord(data: BoardUpdateRecordPayload) {
  return (dispatch: AppDispatch) => {
    dispatch({ type: 'UPDATE_BOARD_VIEW_RECORD', data } satisfies BoardViewAction);
    if (data.target) {
      let targetKey = getBoardItemKey(data.target) as string;
      // 一级分组字段为【拥有者】，值为未指定时，对应的key为-1
      if (targetKey === 'user-undefined') targetKey = '-1';
      if (targetKey !== data.key) {
        dispatch({ type: 'UPDATE_BOARD_VIEW_RECORD_COUNT', data: [data.key, -1] } satisfies BoardViewAction);
        dispatch({ type: 'UPDATE_BOARD_VIEW_RECORD_COUNT', data: [targetKey, 1] } satisfies BoardViewAction);
      }
    }
  };
}

const getBoardViewPara = (sheet: RootState['sheet'], view?: WorksheetView): BoardRowsRequest | undefined => {
  const { base, controls, navGroupFilters = [], quickFilter = [] } = sheet;
  const { viewId, appId, chartId, type } = base;
  view = view || (getCurrentView(sheet) as WorksheetView);
  const { worksheetId, viewControl } = view;

  if (!viewControl) {
    return undefined;
  }

  let relationWorksheetId;
  const selectControl = _.find(controls, item => item.controlId === viewControl);

  if (selectControl && selectControl.type === 29) {
    relationWorksheetId = selectControl.dataSource;
  }

  const quickFilterForRequest = getQuickFilterForRequest({ quickFilter, view, controls, chartId });
  let para: BoardRowsRequest = {
    type,
    appId,
    worksheetId,
    viewId,
    reportId: chartId || undefined,
    kanbanSize: 50,
    kanbanIndex: 1,
    pageSize: 20,
    navGroupFilters,
    ...sheet.filters,
    fastFilters: formatQuickFilter(quickFilterForRequest),
    langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
  };

  if (relationWorksheetId) {
    // para = { ...para, relationWorksheetId, kanbanSize: advancedSetting && advancedSetting.navshow === '1' ? 50 : 20 };
    para = { ...para, relationWorksheetId };
  }

  return para;
};

const dealBoardViewRecordCount = (data: BoardGroup[] | undefined): BoardRecordCounts => {
  if (!data || !_.isArray(data)) return {};
  return data.map(item => ({ [item.key]: item.totalNum })).reduce((p, c) => ({ ...p, ...c }), {});
};

export function initBoardViewData(view?: WorksheetView, hasSecondGroup?: boolean | string) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const para = getBoardViewPara(sheet, view);

    if (!para) return;
    if (hasSecondGroup) {
      para.kanbanSize = 50;
    }
    dispatch({
      type: 'CHANGE_BOARD_VIEW_LOADING',
      loading: true,
    } satisfies BoardViewAction);
    dispatch({
      type: 'CHANGE_BOARD_VIEW_STATE',
      payload: { kanbanIndex: 1, hasMoreData: true },
    } satisfies BoardViewAction);

    getBoardViewDataFillPage({ para, dispatch, view: view || getCurrentView(sheet), controls: sheet.controls });
  };
}

// 拉取看板数据以填满页面
function getBoardViewDataFillPage({
  para,
  dispatch,
  view,
  controls,
}: {
  para: BoardRowsRequest;
  dispatch: AppDispatch;
  view: WorksheetView;
  controls: FormControl[];
}) {
  if (boardPromiseObj && boardPromiseObj.abort && _.includes(boardPromiseViewIds, view.viewId)) {
    boardPromiseObj.abort();
  }

  boardPromiseViewIds.push(view.viewId);

  boardPromiseObj = (para.type === 'single' ? worksheetAjax.getFilterRows : wrappedGetFilterRows)(
    getFilledRequestParams(para),
  );

  boardPromiseObj.then(({ data: rawData, resultCode }) => {
    const data = readBoardGroups(rawData);
    boardPromiseViewIds = boardPromiseViewIds.filter(o => o !== view.viewId);
    if (resultCode !== 1) {
      dispatch({
        type: 'WORKSHEET_UPDATE_ACTIVE_VIEW_STATUS',
        resultCode,
      });
      dispatch({
        type: 'CHANGE_BOARD_VIEW_LOADING',
        loading: false,
      } satisfies BoardViewAction);
    }

    const translateInfo = getTranslateInfo(para.appId!, para.worksheetId, view.viewControl) as Record<
      string,
      string | undefined
    >;
    const formatData = sortDataByCustomItems(data, view, controls);
    const groupControl = _.find(controls, { controlId: view.viewControl });
    dispatch(
      changeBoardViewData(
        formatData.map(data => {
          const name = translateInfo[data.key] || data.name;

          if (_.get(groupControl, 'options.length')) {
            return {
              ...data,
              name: _.get(_.find(groupControl!.options, { key: data.key }), 'value') || name,
            };
          }

          return {
            ...data,
            name,
          };
        }),
      ),
    );
    dispatch(initBoardViewRecordCount(dealBoardViewRecordCount(data)));

    dispatch({
      type: 'CHANGE_BOARD_VIEW_LOADING',
      loading: false,
    } satisfies BoardViewAction);
    dispatch({
      type: 'CHANGE_BOARD_VIEW_STATE',
      payload: { kanbanIndex: para.kanbanIndex, hasMoreData: !(data.length < 50) },
    } satisfies BoardViewAction);
  });
}

export function getBoardViewPageData({ alwaysCallback = noop }: { alwaysCallback?: () => void }) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { boardView } = sheet;
    const { boardViewState, boardViewRecordCount, boardData } = boardView;
    const { hasMoreData, kanbanIndex } = boardViewState;
    const para = getBoardViewPara(sheet);
    const { relationWorksheetId, kanbanSize } = para || {};
    // 关联看板隐藏无数据看板，开启不允许拉取数据，关闭时允许
    const isRelateHide = relationWorksheetId && kanbanSize === 50;

    if (isRelateHide || !hasMoreData || !para) {
      alwaysCallback();
      return;
    }

    wrappedGetFilterRows(getFilledRequestParams({ ...para, kanbanIndex: kanbanIndex + 1 }))
      .then(({ data: rawData }) => {
        const data = readBoardGroups(rawData);
        // 将已经存在的看板过滤掉
        const existedKeys = boardData.map(item => item.key);
        const filterData = data
          .filter(item => !includes(existedKeys, item.key))
          .map((item, index: number) => ({ ...item, sort: existedKeys.length + index + 1 }));
        dispatch(changeBoardViewData(boardData.concat(filterData)));
        dispatch(initBoardViewRecordCount({ ...boardViewRecordCount, ...dealBoardViewRecordCount(filterData) }));
        let nextState: Partial<BoardViewPageState> = { kanbanIndex: kanbanIndex + 1 };
        if (data.length < 50) nextState = { ...nextState, hasMoreData: false };
        dispatch({ type: 'CHANGE_BOARD_VIEW_STATE', payload: nextState } satisfies BoardViewAction);
      })
      .finally(() => {
        alwaysCallback();
      });
  };
}

function mergeUniqBoardData(boardViewData: string[], currentData: string[]) {
  return uniqBy(boardViewData.concat(currentData), value => {
    return _.get(JSON.parse(value), 'rowid');
  });
}

// 分页获取单个看板数据
export function getSingleBoardPageData({
  pageIndex,
  kanbanKey,
  alwaysCallback,
  checkIsMore,
}: {
  pageIndex?: number;
  kanbanKey: string;
  alwaysCallback: () => void;
  checkIsMore: (isMore: boolean) => void;
}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { boardView } = sheet;
    const { boardData } = boardView;
    const para = getBoardViewPara(sheet);

    if (!para) {
      alwaysCallback();
      return;
    }

    wrappedGetFilterRows(getFilledRequestParams({ ...para, pageIndex, kanbanKey }))
      .then(({ data: rawData }) => {
        const data = readBoardGroups(rawData);
        dispatch({ type: 'CHANGE_BOARD_VIEW_LOADING', loading: false } satisfies BoardViewAction);
        const boardViewIndex = _.findIndex(boardData, item => item.key === kanbanKey);
        const nextData =
          _.get(
            _.find(data, item => item.key === kanbanKey),
            'rows',
          ) || [];
        if (pageIndex !== 1 && !boardData[boardViewIndex]) {
          checkIsMore(false);
          return;
        }
        dispatch({
          type: 'CHANGE_BOARD_VIEW_DATA',
          data:
            pageIndex === 1
              ? data
              : update(boardData, {
                  // 分页更新对应key下的记录数据
                  [boardViewIndex]: {
                    rows: {
                      $set: mergeUniqBoardData(boardData[boardViewIndex]!.rows, nextData),
                    },
                  },
                }),
        } satisfies BoardViewAction);
        dispatch(initBoardViewRecordCount(dealBoardViewRecordCount(data)));
        checkIsMore((nextData || []).length >= para.pageSize);
      })
      .finally(() => {
        alwaysCallback();
      });
  };
}

export function sortBoardRecord({
  srcKey,
  targetKey,
  value,
  firstGroupChange,
  secondGroupChange,
  secondGroupValue,
  firstGroupControlId,
  secondGroupControlId,
  ...para
}: BoardSortRequest) {
  return (dispatch: AppDispatch) => {
    const { rowId } = para;
    worksheetAjax.updateWorksheetRow(para).then((res: { data: BoardRecord }) => {
      if (!isEmpty(res.data)) {
        dispatch({
          type: 'SORT_BOARD_VIEW_RECORD',
          data: {
            rowId,
            key: srcKey,
            targetKey,
            value: res.data[firstGroupControlId] || value,
            firstGroupChange,
            firstGroupControlId,
            secondGroupValue: res.data[secondGroupControlId!] || secondGroupValue,
            secondGroupChange,
            secondGroupControlId,
          },
        } satisfies BoardViewAction);
        dispatch(updateBoardViewRecordCount([srcKey, -1]));
        dispatch(updateBoardViewRecordCount([targetKey, 1]));
      } else {
        alert(_l('拖拽更新失败!'), 2);
      }
    });
  };
}

export function updateTitleData(
  data: BoardTitlePayload,
): Extract<BoardViewAction, { type: 'UPDATE_BOARD_TITLE_DATA' }> {
  return { type: 'UPDATE_BOARD_TITLE_DATA', data };
}

// 更新多选看板
export const updateMultiSelectBoard = (
  data: BoardMultiSelectPayload,
): Extract<BoardViewAction, { type: 'UPDATE_MULTI_SELECT_BOARD' }> => ({ type: 'UPDATE_MULTI_SELECT_BOARD', data });

export const clearBoardView = () => {
  return (dispatch: AppDispatch) => {
    dispatch({ type: 'CLEAR_BOARD_VIEW', data: [] } satisfies BoardViewAction);
  };
};

export const updateBoardViewCard = (data: Partial<BoardViewCardState>) => {
  return (dispatch: AppDispatch) => {
    dispatch({ type: 'UPDATE_BOARD_VIEW_CARD', data } satisfies BoardViewAction);
  };
};

export const updateBoardViewSortedOptionKeys = (data: string[]) => {
  return (dispatch: AppDispatch) => {
    dispatch({ type: 'UPDATE_BOARD_VIEW_SORTED_OPTION_KEYS', data } satisfies BoardViewAction);
  };
};
