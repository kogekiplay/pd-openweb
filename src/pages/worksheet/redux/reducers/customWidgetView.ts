import type { ReduxAction } from 'src/redux/types';
export function loading(state = true, action: ReduxAction) {
  const { type, value } = action;

  switch (type) {
    case 'UPDATE_CUSTOM_WIDGET_LOADING':
      return value;
    default:
      return state;
  }
}

export function flag(state = 'init', action: ReduxAction) {
  const { type } = action;

  switch (type) {
    case 'REFRESH_CUSTOM_WIDGET_VIEW':
      return Math.random().toString();
    default:
      return state;
  }
}
