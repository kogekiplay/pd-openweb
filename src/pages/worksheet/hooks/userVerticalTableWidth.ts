import { useCallback } from 'react';
import { getMaxControlNameWidthOfControls } from '../components/BaseColumnHead/getTableColumnWidth';

function getControlWidth(_visibleColumns, i: number, sheetColumnWidths = {}) {
  // const control = visibleColumns[i];
  // if (control && control.width) {
  //   return control.width;
  // }
  // if (i === visibleColumns.length - 2) {
  //   return 60;
  // }
  return sheetColumnWidths[i] || 200;
}

export default function useVerticalTableWidth({ visibleColumns = [], sheetColumnWidths = {} }) {
  const controlColumnWidth = getMaxControlNameWidthOfControls(visibleColumns);
  const getWidth = useCallback(
    (index: number) => (index === 0 ? controlColumnWidth : getControlWidth(visibleColumns, index, sheetColumnWidths)),
    [sheetColumnWidths],
  );
  return getWidth;
}
