import update from 'immutability-helper';
import { isEmpty } from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';
import { FULL_LINE_CONTROL } from '../config';
import { WHOLE_SIZE } from '../config/Drag';
import { getCurrentRowSize, isSheetDisplay } from './index';

// 判断当前行是否有空间可以放置新控件
export const isHaveGap = (row: FormControl[] | null | undefined, widget: FormControl): boolean => {
  if (!row && isEmpty(row)) return true;
  if (!row || widget.size === undefined) return false;
  const rowSize = getCurrentRowSize(row);
  if (rowSize + widget.size <= WHOLE_SIZE) return true;
  return false;
};

// 更新二维数组中的控件
export const updateWidgets = <T extends FormControl>(widgets: T[][], controlId: string, obj: Partial<T>): T[][] => {
  return widgets.map(row => row.map(item => (item.controlId === controlId ? { ...item, ...obj } : item)));
};

export const getPathById = <T extends FormControl>(widgets: T[][], id: string | undefined): [number, number] | [] => {
  for (const [i, row] of widgets.entries()) {
    for (const [j, item] of row.entries()) {
      if (item.controlId === id) return [i, j];
    }
  }

  return [];
};

// 判断是否是需要独占一行的控件
export const isFullLineControl = (data: FormControl | null | undefined): boolean => {
  if (!data) return false;
  const { type, sourceControl } = data;
  if (type !== undefined && FULL_LINE_CONTROL.includes(type)) return true;
  // 成员、部门多选 为整行控件
  // if ([26, 27].includes(type) && enumDefault === 1) return true;

  // 嵌入视图
  if (type === 45 && data.enumDefault === 3) return true;

  // 关联多条 列表和卡片形式为整行
  if (isSheetDisplay(data)) return true;
  // 他表字段使用关联控件
  if (type === 30) {
    return isFullLineControl(sourceControl);
  }

  return false;
};

export const getRowById = <T extends FormControl>(widgets: T[][], controlId: string | undefined) => {
  const [rowIndex] = getPathById(widgets, controlId);
  return { row: rowIndex === undefined ? undefined : widgets[rowIndex], rowIndex };
};

export const changeWidgetSize = <T extends FormControl>(
  widgets: T[][],
  { controlId, size }: { controlId?: string | undefined; size?: number | undefined },
): T[][] => {
  const { rowIndex, row } = getRowById(widgets, controlId);
  if (!row || rowIndex === undefined) throw new TypeError("Cannot read properties of undefined (reading 'length')");
  const remainingSize = size === undefined ? Number.NaN : WHOLE_SIZE - size;

  switch (row.length) {
    case 1:
      return update(widgets, { [rowIndex]: { $apply: (row: T[]) => row.map(item => ({ ...item, size })) } });
    case 2:
    case 3:
      return update(widgets, {
        [rowIndex]: {
          $apply: (row: T[]) =>
            row.map(item => {
              // 改变当前控件宽度，其余控件平分剩下宽度
              if (item.controlId === controlId) return { ...item, size };
              return { ...item, size: remainingSize / (row.length - 1) };
            }),
        },
      });
    default:
      return widgets;
  }
};
