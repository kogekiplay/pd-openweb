import type { ReduxAction } from 'src/redux/types';
export const myAppData = (state = {}, actions) => {
  switch (actions.type) {
    case 'UPDATE_MYAPPLIST':
      return actions.data;
    default:
      return state;
  }
};

export const isHomeLoading = (state = true, action: ReduxAction) => {
  switch (action.type) {
    case 'MOBILE_FETCHHOMELIST_START':
      return true;
    case 'MOBILE_FETCHHOMELIST_SUCCESS':
      return false;
    default:
      return state;
  }
};

export const platformSetting = (state = {}, action: ReduxAction) => {
  switch (action.type) {
    case 'PLATE_FORM_SETTING':
      return action.data;
    default:
      return state;
  }
};

export const myPlatformData = (state = {}, action: ReduxAction) => {
  switch (action.type) {
    case 'PLATE_FORM_DATA':
      return action.data;
    default:
      return state;
  }
};

export const myPlatformLang = (state = {}, action: ReduxAction) => {
  switch (action.type) {
    case 'PLATE_FORM_LANG':
      return action.data;
    default:
      return state;
  }
};

export const collectRecords = (state = [], action: ReduxAction) => {
  switch (action.type) {
    case 'COLLECT_RECORDS':
      return action.data;
    default:
      return state;
  }
};

export const collectCharts = (state = [], action: ReduxAction) => {
  switch (action.type) {
    case 'COLLECT_CHARTS':
      return action.data;
    default:
      return state;
  }
};

export const projectGroupsNameLang = (state = {}, action: ReduxAction) => {
  switch (action.type) {
    case 'PROJECT_GROUPS_NAME_LANG':
      return action.data;
    default:
      return state;
  }
};

export const appHomeScrollY = (state = 0, action: ReduxAction) => {
  switch (action.type) {
    case 'APP_HOME_SCROLL_Y':
      return action.data;
    default:
      return state;
  }
};
