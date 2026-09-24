import { combineReducers } from 'redux';
import { isEmpty } from 'lodash';
import _ from 'lodash';
import type { AppPkgData, WorksheetBase } from 'src/pages/worksheet/types';
import type { ReduxAction } from 'src/redux/types';
import { browserIsMobile } from 'src/utils/common';
import boardView from './boardView';
import * as calendarview from './calendarview';
import * as customWidgetView from './customWidgetView';
import * as detailView from './detailView';
import * as excelCreateAppAndSheet from './excelCreateAppAndSheet';
import * as galleryview from './galleryview';
import * as gunterView from './gunterview';
import * as hierarchyView from './hierarchyView';
import mapView from './mapView';
import * as resourceView from './resourceview';
import * as sheetview from './sheetview';
import * as worksheet from './worksheet';

function base(state: WorksheetBase = {}, action: ReduxAction): WorksheetBase {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_BASE':
      return { ...state, ...action.base };
    case 'WORKSHEET_UPDATE_FILTERS':
      return { ...state, ...(location.search.indexOf('chartId=') > -1 ? { chartId: undefined } : {}) };
    case 'WORKSHEET_INIT':
      if ((state.viewId && /^[0-9a-z]{24}$/.test(state.viewId)) || state.chartId) {
        return state;
      }

      // 自定义页面没有视图
      if (isEmpty(action.value.views)) return state;
      if (state.worksheetId === action.value.worksheetId) {
        const showViews = action.value.views.filter(view => {
          const showhide = _.get(view, 'advancedSetting.showhide') || '';

          if (browserIsMobile()) {
            return !showhide.includes('spc&happ') && !showhide.includes('hide');
          }

          return !showhide.includes('hpc') && !showhide.includes('hide');
        });
        return {
          ...state,
          viewId: _.get((showViews.length ? showViews : action.value.views)[0], 'viewId'),
        };
      }

      return state;
    default:
      return state;
  }
}

function isCharge(state = false, action: ReduxAction<{ isCharge: boolean }>) {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_IS_CHARGE':
      return action.isCharge;
    default:
      return state;
  }
}

// 初值原来是 false，实际存的是 { appRoleType, isLock }（两处写入都走 updateAppPkgData：AppGroup、actions/sheetList）；
// 读的地方只读这两个字段、没有按真假判断的，false 和 {} 上读属性都是 undefined，所以初值改成 {} 行为不变
function appPkgData(state: AppPkgData = {}, action: ReduxAction<{ appPkgData: AppPkgData }>): AppPkgData {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_APPPKGDATA':
      return action.appPkgData;
    default:
      return state;
  }
}

// 值是取行接口（GetFilterRows 等）的 resultCode
function activeViewStatus(state = 1, action: ReduxAction<{ resultCode?: number | undefined }>): number {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_ACTIVE_VIEW_STATUS':
    case 'WORKSHEET_SHEETVIEW_FETCH_ROWS':
    case 'CHANGE_CALENDARLIST':
    case 'CHANGE_GALLERY_VIEW_DATA':
      return action.resultCode || state;
    case 'WORKSHEET_FETCH_START':
    case 'WORKSHEET_UPDATE_BASE':
      return 1;
    default:
      return state;
  }
}

// 卡片上默认显示前几个字段。值数字、字符串都有：视图配置 advancedSetting.showcount 和 localStorage 里的是字符串，
// 滑块 onChange 给的是数字。读的地方（BaseCard 的 slice、ViewControl 跟 localStorage 的 !== 比较）都按原值用，
// 这里不做归一 —— 归成数字会让 ViewControl 那次比较永远不等、每次切视图多派发一次
type FieldShowCount = number | string;
function fieldShowCount(
  state: FieldShowCount = 0,
  action: ReduxAction<{ showcount?: FieldShowCount | null | undefined }>,
): FieldShowCount {
  switch (action.type) {
    case 'VIEW_UPDATE_SHOW_COUNT':
      return action.showcount || 0;
    default:
      return state;
  }
}

function saveViewSetLoading(state = false, action: ReduxAction<{ saveViewSetLoading: boolean }>) {
  switch (action.type) {
    case 'VIEW_UPDATE_VIEW_SET_LOADING':
      return action.saveViewSetLoading || false;
    default:
      return state;
  }
}

// 各视图的取数 loading 汇到这一个切片；各 action 放 loading 的字段名不统一，按 type 分开写
type ViewRowsLoadingAction =
  | { type: 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING'; value: boolean }
  | {
      type:
        | 'CHANGE_BOARD_VIEW_LOADING'
        | 'CHANGE_GALLERY_VIEW_LOADING'
        | 'CHANGE_DETAIL_VIEW_LOADING'
        | 'CHANGE_MAP_VIEW_LOADING';
      loading: boolean;
    }
  | { type: 'CHANGE_CALENDAR_LOADING' | 'CHANGE_GUNTER_LOADINNG' | 'CHANGE_RESOURCE_LOADING'; data: boolean }
  /** 层级视图这个 action 的 data 是一包状态（loading / pageIndex…），这里只取 loading */
  | { type: 'CHANGE_HIERARCHY_DATA_STATUS'; data: { loading?: boolean | undefined } };
function viewRowsLoading(state = false, action: ViewRowsLoadingAction): boolean {
  switch (action.type) {
    case 'WORKSHEET_VIEW_UPDATE_ROWS_LOADING':
      return action.value;
    case 'CHANGE_BOARD_VIEW_LOADING':
    case 'CHANGE_GALLERY_VIEW_LOADING':
    case 'CHANGE_DETAIL_VIEW_LOADING':
    case 'CHANGE_MAP_VIEW_LOADING':
      return action.loading;
    case 'CHANGE_CALENDAR_LOADING':
    case 'CHANGE_GUNTER_LOADINNG':
    case 'CHANGE_RESOURCE_LOADING':
      return action.data;
    case 'CHANGE_HIERARCHY_DATA_STATUS':
      return typeof action?.data?.loading === 'boolean' ? action?.data?.loading : state;
    default:
      return state;
  }
}

export default combineReducers({
  base,
  isCharge,
  appPkgData,
  activeViewStatus,
  fieldShowCount,
  ...worksheet,
  viewRowsLoading,
  boardView,
  hierarchyView: combineReducers(hierarchyView),
  sheetview: combineReducers(sheetview),
  galleryview: combineReducers(galleryview),
  calendarview: combineReducers(calendarview),
  gunterView: combineReducers(gunterView),
  excelCreateAppAndSheet: combineReducers(excelCreateAppAndSheet),
  detailView: combineReducers(detailView),
  customWidgetView: combineReducers(customWidgetView),
  mapView,
  resourceview: combineReducers(resourceView),
  saveViewSetLoading,
});
