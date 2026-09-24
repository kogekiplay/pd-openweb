const state = {
  chartScrollLocked: false,
  groupingScrollLocked: false,
  recordDragging: false,
};

export const setChartScrollLock = (locked: boolean) => {
  state.chartScrollLocked = locked;
};

export const setGroupingScrollLock = (locked: boolean) => {
  state.groupingScrollLocked = locked;
};

export const isChartScrollLocked = () => state.chartScrollLocked;

export const isGroupingScrollLocked = () => state.groupingScrollLocked;

export const setRecordDragging = (dragging: boolean) => {
  state.recordDragging = dragging;
};

export const isRecordDragging = () => state.recordDragging;
