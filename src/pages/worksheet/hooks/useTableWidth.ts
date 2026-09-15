import { useCallback, useMemo } from 'react';
import { sum } from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';

function getDefaultWidth(control: FormControl) {
  if ((control.type === 2 || control.type === 1) && control.attribute === 1) {
    return 350;
  }

  return 150;
}

export default function useTableWidth(props) {
  const { width, xIsScroll, visibleControls = [], sheetColumnWidths = {} }: { visibleControls: FormControl[]; [key: string]: any } = props;
  const sumControlWidth = useCallback(
    controls =>
      sum(
        controls.map(
          (control: FormControl) =>
            (sheetColumnWidths[control.controlId] ||
              control.width ||
              ((control.type === 2 || control.type === 1) && control.attribute === 1 && 350) ||
              0) + (control.appendWidth || 0),
        ),
      ),
    [sheetColumnWidths],
  );
  const summedWidth = useMemo(
    () => sumControlWidth(visibleControls.map((c: FormControl) => ({ ...c, width: c.width || getDefaultWidth(c) }))),
    [visibleControls, sheetColumnWidths],
  );
  const averageWidth = useMemo(
    () =>
      summedWidth < width &&
      Math.floor(
        (width - sumControlWidth(visibleControls)) /
          visibleControls.filter(
            (c: FormControl) => !(sheetColumnWidths[c.controlId] || c.width || ((c.type === 2 || c.type === 1) && c.attribute === 1)),
          ).length,
      ),
    [width, summedWidth],
  );
  const getWidth = useCallback(
    index => {
      const control = visibleControls[index] || {};
      return (
        (control.width ||
          sheetColumnWidths[control.controlId] ||
          ((control.type === 2 || control.type === 1) && control.attribute === 1 && 350) ||
          (!xIsScroll && averageWidth) ||
          getDefaultWidth(control)) + (control.appendWidth || 0)
      );
    },
    [visibleControls, sheetColumnWidths, averageWidth],
  );
  return getWidth;
}
