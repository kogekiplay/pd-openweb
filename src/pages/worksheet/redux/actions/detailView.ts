import _ from 'lodash';
import worksheetApi from 'src/api/worksheet';
import type { AppDispatch, GetState } from 'src/redux/types';
import { getFilledRequestParams } from 'src/utils/common';
import { formatQuickFilter } from 'src/utils/filter';

let detailRowsRequest: ApiResult | null = null;

export const fetchRows = (pageIndex: number, keyWords: string, { keepDetails = false } = {}) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { base, filters, detailView, quickFilter, navGroupFilters } = getState().sheet;
    const { appId, viewId, worksheetId } = base;
    let { detailViewRows } = detailView;

    detailRowsRequest?.abort?.();

    dispatch({ type: 'CHANGE_DETAIL_VIEW_PAGE_INDEX', pageIndex });
    dispatch({ type: 'CHANGE_DETAIL_VIEW_LOADING', loading: true, keepDetails });
    dispatch({ type: 'CHANGE_DETAIL_VIEW_KEYWORDS', keyWords });

    const args = {
      appId,
      viewId,
      worksheetId,
      pageIndex,
      pageSize: 50,
      status: 1,
      ...{ ...filters, keyWords: keyWords || filters.keyWords },
      fastFilters: formatQuickFilter(quickFilter),
      navGroupFilters,
      langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
    };
    const request = worksheetApi.getFilterRows(getFilledRequestParams(args));
    detailRowsRequest = request;

    const finish = () => {
      if (detailRowsRequest !== request) return;

      detailRowsRequest = null;
      dispatch({ type: 'CHANGE_DETAIL_VIEW_LOADING', loading: false });
    };

    request
      .then(res => {
        if (detailRowsRequest !== request) return;

        const rows = res.data ?? [];
        dispatch({
          type: 'CHANGE_DETAIL_VIEW_ROWS',
          list: pageIndex > 1 ? detailViewRows.concat(rows) : rows,
          resultCode: res.resultCode,
        });
        dispatch({ type: 'CHANGE_DETAIL_VIEW_ROWS_COUNT', count: res.count });
        dispatch({ type: 'CHANGE_DETAIL_VIEW_NO_MORE_ROWS', noMore: rows.length < 50 });
      })
      .finally(finish)
      .catch(() => {});
  };
};

export const refresh = () => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { detailView } = getState().sheet;
    let { detailKeyWords } = detailView;
    dispatch(fetchRows(1, detailKeyWords));
  };
};

export const clearData = () => {
  return dispatch => {
    dispatch({ type: 'CHANGE_DETAIL_VIEW_ROWS', list: [] });
    dispatch({ type: 'CHANGE_DETAIL_VIEW_KEYWORDS', keyWords: '' });
  };
};

//add | update
export const updateRow = data => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { detailView } = getState().sheet;
    let { detailViewRows } = detailView;
    const row = detailViewRows.find(o => o.rowid === data.rowid);

    if (!row) {
      dispatch({
        type: 'CHANGE_DETAIL_VIEW_ROWS',
        list: [data].concat(detailViewRows),
      });
      dispatch({ type: 'CHANGE_DETAIL_VIEW_ROWS_COUNT', count: detailView.detailViewRowsCount + 1 });
    } else {
      dispatch({
        type: 'CHANGE_DETAIL_VIEW_ROWS',
        list: detailViewRows.map(o => {
          if (o.rowid === data.rowid) {
            return { ...data, ..._.pick(o, ['allowedit', 'allowdelete']) }; //接口返回'allowedit', 'allowdelete' 不对，沿用更改前
          } else {
            return o;
          }
        }),
      });
    }
  };
};

//删除
export const deleteRow = id => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { detailView } = getState().sheet;
    let { detailViewRows } = detailView;
    const newList = detailViewRows.filter(o => o.rowid !== id);
    dispatch({
      type: 'CHANGE_DETAIL_VIEW_ROWS',
      list: newList,
    });
    dispatch({ type: 'CHANGE_DETAIL_VIEW_ROWS_COUNT', count: detailView.detailViewRowsCount - 1 });
  };
};
