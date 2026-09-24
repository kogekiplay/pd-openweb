import type { ReduxAction } from 'src/redux/types';
import type { RecordRow } from 'src/utils/controlTypes';

export function detailViewRows(state: RecordRow[] = [], action: ReduxAction<{ list: RecordRow[] }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_DETAIL_VIEW_ROWS':
      return action.list;
    default:
      return state;
  }
}

export function detailViewRowsCount(state = 0, action: ReduxAction<{ count: number }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_DETAIL_VIEW_ROWS_COUNT':
      return action.count;
    default:
      return state;
  }
}

export function noMoreRows(state = false, action: ReduxAction<{ noMore: boolean }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_DETAIL_VIEW_NO_MORE_ROWS':
      return action.noMore;
    default:
      return state;
  }
}

export function detailViewLoading(state = false, action: ReduxAction<{ loading: boolean }>) {
  switch (action.type) {
    case 'CHANGE_DETAIL_VIEW_LOADING':
      return action.loading;
    default:
      return state;
  }
}

export function detailPageIndex(state = 1, action: ReduxAction<{ pageIndex: number }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_DETAIL_VIEW_PAGE_INDEX':
      return action.pageIndex;
    default:
      return state;
  }
}

export function detailKeyWords(state = '', action: ReduxAction<{ keyWords?: string }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_DETAIL_VIEW_KEYWORDS':
      return action.keyWords || '';
    default:
      return state;
  }
}
