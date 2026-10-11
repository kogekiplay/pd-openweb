import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
import type { WorkSheetFilterHandle, WorkSheetFilterProps } from './filterPanelTypes';
import FiltersPopup from './FiltersPopup';
import { createActions, createReducer, initialState } from './model';

const WorkSheetFilter = forwardRef<WorkSheetFilterHandle, WorkSheetFilterProps>((props, ref) => {
  const [state = {}, dispatch] = useReducer(createReducer, {
    ...initialState,
    loading: props.showSavedFilters !== false,
  });
  const lifecycle = useRef({ active: true, epoch: 0 });
  const lifetime = useRef({
    capture() {
      const snapshot = lifecycle.current.epoch;
      return () => lifecycle.current.active && lifecycle.current.epoch === snapshot;
    },
  });
  const popupHandleRef = useRef<Pick<WorkSheetFilterHandle, 'handleWorksheetHeadAddFilter'> | null>(null);
  useEffect(() => {
    lifecycle.current.active = true;
    return () => {
      lifecycle.current.active = false;
      lifecycle.current.epoch++;
    };
  }, []);
  const actions = createActions(dispatch, state, lifetime.current);
  useImperativeHandle(ref, () => ({
    reset: actions.reset,
    handleWorksheetHeadAddFilter(control) {
      const handle = popupHandleRef.current;
      if (!handle) throw new TypeError('Worksheet filter popup is unavailable');
      handle.handleWorksheetHeadAddFilter(control);
    },
  }));
  return <FiltersPopup {...props} state={state} actions={actions} popupHandleRef={popupHandleRef} />;
});

export default WorkSheetFilter;
