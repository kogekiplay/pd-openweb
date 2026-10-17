import { combineReducers } from 'redux';
import _ from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';
import type { HidedControlId, PublicWorksheetAction, PublicWorksheetInfo, PublicWorksheetSettings } from './types';

export type { PublicWorksheetAction } from './types';

export function loading(state = true, action: PublicWorksheetAction): boolean {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return false;
    case 'PUBLICWORKSHEET_CLEAR':
      return true;
    default:
      return state;
  }
}

export function shareUrl(state = '', action: PublicWorksheetAction): string {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return action.url || '';
    case 'PUBLICWORKSHEET_UPDATE_URL':
      return action.url || '';
    case 'PUBLICWORKSHEET_CLEAR':
      return '';
    default:
      return state;
  }
}

export function worksheetSettings(
  state: PublicWorksheetSettings = {},
  action: PublicWorksheetAction,
): PublicWorksheetSettings {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return action.worksheetSettings;
    case 'PUBLICWORKSHEET_UPDATE_SETTINGS':
      return _.assign({}, state, action.value);
    case 'PUBLICWORKSHEET_CLEAR':
      return {};
    default:
      return state;
  }
}

export function worksheetInfo(state: PublicWorksheetInfo = {}, action: PublicWorksheetAction): PublicWorksheetInfo {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return action.worksheetInfo;
    case 'PUBLICWORKSHEET_UPDATE_INFO':
      return _.assign({}, state, action.value);
    case 'PUBLICWORKSHEET_CLEAR':
      return {};
    default:
      return state;
  }
}

export function originalControls(state: FormControl[] = [], action: PublicWorksheetAction): FormControl[] {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return action.originalControls;
    case 'PUBLICWORKSHEET_ADD_CONTROL':
      return state.concat(action.control);
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

export function controls(state: FormControl[] = [], action: PublicWorksheetAction): FormControl[] | undefined {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
    case 'PUBLICWORKSHEET_UPDATE_CONTROLS':
      return action.controls;
    case 'WORKSHEET_SHOW_CONTROL':
      return state.concat(action.controls);
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

export function hidedControlIds(state: HidedControlId[] = [], action: PublicWorksheetAction): HidedControlId[] {
  switch (action.type) {
    case 'PUBLICWORKSHEET_LOAD_SUCCESS':
      return action.hidedControlIds;
    case 'WORKSHEET_HIDE_CONTROL':
      return _.uniqBy(state.concat(action.controlId), controlId => controlId);
    case 'WORKSHEET_SHOW_CONTROL':
      return state.filter(controlId => !action.controlIds.includes(controlId));
    case 'PUBLICWORKSHEET_CLEAR':
      return [];
    default:
      return state;
  }
}

export default combineReducers({
  loading,
  shareUrl,
  worksheetInfo,
  worksheetSettings,
  originalControls,
  controls,
  hidedControlIds,
});
