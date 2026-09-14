import { combineReducers } from 'redux';
import type { ReduxAction } from 'src/redux/types';

function data(state = [], action: ReduxAction) {
  switch (action.type) {
    case 'SHEET_LIST':
      return action.data;
    case 'ADD_LEFT_ITEM':
      return state.concat(action.data);
    case 'ADD_LEFT_SUB_ITEM':
      const { id, data } = action.data;
      return state.map(item => {
        if (item.workSheetId === id) {
          item.items = item.items.concat(data);
          return item;
        } else {
          return item;
        }
      });
    default:
      return state;
  }
}

function appSectionDetail(state = [], action: ReduxAction) {
  switch (action.type) {
    case 'SHEET_ALL_LIST':
      return action.data;
    default:
      return state;
  }
}

function loading(state = true, action: ReduxAction) {
  switch (action.type) {
    case 'SHEET_LIST_UPDATE_LOADING':
      return action.loading;
    default:
      return state;
  }
}

function isCharge(state = false, action: ReduxAction) {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_IS_CHARGE':
      return action.isCharge;
    default:
      return state;
  }
}

function appPkgData(state = false, action: ReduxAction) {
  switch (action.type) {
    case 'WORKSHEET_UPDATE_APPPKGDATA':
      return action.appPkgData;
    default:
      return state;
  }
}

function isUnfold(state = !(localStorage.getItem('sheetListIsUnfold') === 'false'), action: ReduxAction) {
  switch (action.type) {
    case 'SHEET_LIST_UPDATE_IS_UNFOLD':
      return action.isUnfold;
    default:
      return state;
  }
}

function isValidAppSectionId(state = true, action: ReduxAction) {
  switch (action.type) {
    case 'WORKSHEET_APP_SECTION_VALID':
      return true;
    case 'WORKSHEET_APP_SECTION_FAILURE':
      return false;
    default:
      return state;
  }
}

export default combineReducers({
  data,
  appSectionDetail,
  loading,
  isCharge,
  isUnfold,
  isValidAppSectionId,
  appPkgData,
});
