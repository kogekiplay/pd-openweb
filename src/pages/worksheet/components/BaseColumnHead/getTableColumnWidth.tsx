import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import _ from 'lodash';
import CellControl from 'worksheet/components/CellControls';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import type { SheetColumnStyle } from 'src/utils/worksheetTypes';

export default function getTableColumnWidth(
  tableDom = document.querySelector('.sheetViewTable'),
  rows: readonly RecordRow[],
  control: FormControl,
  columnStyle: SheetColumnStyle | undefined,
  worksheetId: string | undefined,
): number {
  try {
    let result = 60;

    function getValueWidthOfRow(row: RecordRow): number | undefined {
      const conForRender = document.createElement('div');
      conForRender.style.zIndex = '-1';
      conForRender.style.display = 'inline-block';
      conForRender.style.position = 'absolute';
      conForRender.style.top = '-10000px';
      conForRender.style.left = '-10000px';
      if (_.includes([29], control.type)) {
        conForRender.style.width = '200px';
      } else {
        conForRender.style.maxWidth = '600px';
        conForRender.style.display = 'inline-block';
      }

      conForRender.style.position = 'relative';
      conForRender.style.zIndex = '999';
      conForRender.style.backgroundColor = '#fff';
      conForRender.style.top = '0px';
      conForRender.style.left = '0px';
      flushSync(() => {
        createRoot(conForRender).render(
          <CellControl
            cell={{ ...control, value: row[control.controlId === undefined ? 'undefined' : control.controlId] }}
            columnStyle={columnStyle}
            worksheetId={worksheetId}
            row={row}
            isCharge={false}
          />,
        );
      });
      (tableDom || document.body).appendChild(conForRender);
      if (!conForRender.children[0]) {
        conForRender.remove();
        return 150;
      }

      const child = conForRender.children[0];
      const measured = child instanceof HTMLElement ? child.offsetWidth : undefined;
      conForRender.remove();
      if (measured === undefined) return undefined;
      let width = measured;
      if (width < 60) {
        width = 60;
      }

      if (width > 600) {
        width = 600;
      }

      return width;
    }

    rows.forEach((row: RecordRow) => {
      const width = getValueWidthOfRow(row);

      if (width !== undefined && width > result) {
        result = width;
      }
    });
    return Math.ceil(result) + 15;
  } catch (err) {
    console.log(err);
    return 150;
  }
}

export function getMaxControlNameWidthOfControls(controls: readonly FormControl[]): number {
  function getControlNameWidth(control: FormControl): number {
    if (!document.body) {
      return 60;
    }
    const conForRender = document.createElement('div');
    conForRender.style.zIndex = '-1';
    conForRender.style.display = 'inline-block';
    conForRender.style.position = 'absolute';
    conForRender.style.top = '-10000px';
    conForRender.style.left = '-10000px';
    conForRender.style.maxWidth = '320px';
    conForRender.style.backgroundColor = '#fff';
    conForRender.style.fontWeight = 'bold';
    conForRender.style.fontSize = '13';
    conForRender.innerText = String(control.controlName);
    document.body.appendChild(conForRender);
    let width = conForRender.offsetWidth;
    conForRender.remove();
    if (width < 60) {
      width = 60;
    }

    width = width + 12 * 2 + 15;
    if (width > 320) {
      width = 320;
    }

    return width;
  }

  let result = 60;
  controls.forEach((control: FormControl) => {
    const widthOfControl = getControlNameWidth(control);

    if (widthOfControl > result) {
      result = widthOfControl;
    }
  });
  return result;
}
