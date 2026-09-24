import type { RecordRow } from 'src/utils/controlTypes';

type MapViewAction =
  | { type: 'CHANGE_MAP_VIEW_DATA'; data: RecordRow[] }
  | { type: 'CHANGE_MAP_VIEW_LOADING'; loading: boolean }
  | { type: 'REFRESH_MAP'; refreshMap: boolean }
  | { type: 'CHANGE_MAP_VIEW_SEARCH_DATA'; data: ApiPayload }
  | { type: 'NAV_GROUP_FILTERS'; navGroupFilters: ApiPayload[] };
const INIT_STATE = {
  mapViewData: [] as RecordRow[],
  mapViewLoading: false,
  refreshMap: false,
  mapViewState: {
    searchData: {} as ApiPayload,
    navGroupFilters: [] as ApiPayload[],
  },
};

export default function boardView(state = INIT_STATE, action: MapViewAction) {
  switch (action.type) {
    case 'CHANGE_MAP_VIEW_DATA':
      return { ...state, mapViewData: action.data };
    case 'CHANGE_MAP_VIEW_LOADING':
      return { ...state, mapViewLoading: action.loading };
    case 'REFRESH_MAP':
      return { ...state, refreshMap: action.refreshMap };
    case 'CHANGE_MAP_VIEW_SEARCH_DATA':
      return { ...state, mapViewState: { ...state.mapViewState, searchData: action.data } };
    case 'NAV_GROUP_FILTERS':
      return { ...state, mapViewState: { ...state.mapViewState, navGroupFilters: action.navGroupFilters } };
    default:
      return state;
  }
}
