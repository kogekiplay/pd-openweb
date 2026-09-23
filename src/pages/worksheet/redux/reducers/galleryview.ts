import type { WorksheetView } from 'src/pages/worksheet/types';
import type { DataAction, ReduxAction } from 'src/redux/types';

/** 画廊卡片的布局状态 */
export interface GalleryViewCard {
  needUpdate: boolean;
  height: number;
}
export function view(state: WorksheetView = {}, action: DataAction<WorksheetView | undefined>) {
  switch (action.type) {
    case 'CHANGE_GALLERY_VIEW':
      return action.data || {};
    default:
      return state;
  }
}

export function galleryGroupLoading(state = false, action: ReduxAction<{ loading: boolean }>) {
  switch (action.type) {
    case 'CHANGE_GALLERY_VIEW_GROUP_LOADING':
      return action.loading;
    default:
      return state;
  }
}

export function galleryViewLoading(state = false, action: ReduxAction<{ loading: boolean }>) {
  switch (action.type) {
    case 'CHANGE_GALLERY_VIEW_LOADING':
      return action.loading;
    default:
      return state;
  }
}

export function galleryLoading(state = false, action: ReduxAction<{ loading: boolean }>) {
  switch (action.type) {
    case 'CHANGE_GALLERY_LOADING':
      return action.loading;
    default:
      return state;
  }
}

export function galleryViewRecordCount(state = 0, action: ReduxAction<{ count: number }>) {
  const { type } = action;

  switch (type) {
    case 'GALLERY_VIEW_RECORD_COUNT':
      return action.count;
    default:
      return state;
  }
}

// 不分组时元素是行；分组时是 { key, rows: [行的 JSON 串…], ... } 这样的分组对象（见 actions/galleryview 的 updateRow）
export function gallery(state: ApiPayload[] = [], action: ReduxAction<{ list: ApiPayload[] }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_GALLERY_VIEW_DATA':
      return action.list;
    default:
      return state;
  }
}

export function galleryIndex(state = 0, action: ReduxAction<{ pageIndex: number }>) {
  const { type } = action;

  switch (type) {
    case 'CHANGE_GALLERY_VIEW_INDEX':
      return action.pageIndex;
    default:
      return state;
  }
}

export function galleryViewCard(
  state: GalleryViewCard = { needUpdate: true, height: 0 },
  action: DataAction<Partial<GalleryViewCard>>,
) {
  const { type } = action;

  switch (type) {
    case 'UPDATE_GALLERY_VIEW_CARD':
      return {
        ...state,
        ...action.data,
      };
    default:
      return state;
  }
}
