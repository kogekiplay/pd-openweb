import { enumWidgetType, genWidgetRowAndCol, getDefaultSizeByData } from '.';
import { filter, flatten, head, includes, isEmpty } from 'lodash';
import _ from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';
import { DRAG_ITEMS, WHOLE_SIZE } from '../config/Drag';
import { isFullLineControl } from './widgets';

type WidgetGrid = FormControl[][];
type WidgetPath = number[];
export interface WidgetDragItem {
  path?: number[] | undefined;
  id?: string | undefined;
  widgetType?: number | undefined;
  type?: string | undefined;
  enumType?: string | undefined;
  data?: FormControl | undefined;
}
interface InsertNewLineParams {
  widgets: WidgetGrid;
  srcItem: FormControl;
  targetIndex: number;
  srcPath?: WidgetPath | undefined;
}
interface ResetDisplayParams extends InsertNewLineParams {
  srcPath: WidgetPath;
}
type InsertToRowEndParams = ResetDisplayParams;
interface InsertToColParams {
  widgets: WidgetGrid;
  srcItem: FormControl;
  srcPath: WidgetPath;
  dropPath: WidgetPath;
  location?: string | undefined;
}
interface InsertSameLineParams extends Omit<InsertToColParams, 'srcPath'> {
  srcPath?: WidgetPath | undefined;
}

const isDropPath = (widgets: WidgetGrid, path: WidgetPath): boolean => {
  const [row, col] = path;
  return (
    row !== undefined &&
    col !== undefined &&
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row <= widgets.length &&
    col >= 0
  );
};

const removeEmptyRow = (widgets: WidgetGrid): WidgetGrid => {
  return filter(widgets, row => !isEmpty(row));
};

// 从原有位置删除拖拽元素
const removeSrcItem = (widgets: WidgetGrid, srcPath: WidgetPath): WidgetGrid => {
  const [row, col] = srcPath;
  if (row === undefined || col === undefined || !widgets[row]?.[col]) return widgets;
  const next = widgets.map(items => items.slice());
  const rowItems = next[row] || [];
  rowItems.splice(col, 1);
  next[row] =
    rowItems.length === 1
      ? rowItems.map(item => ({ ...item, size: getDefaultSizeByData(head(rowItems)) }))
      : rowItems.map(item => ({ ...item, size: WHOLE_SIZE / rowItems.length }));
  return next;
};

// 获取批量操作涉及的控件合集
const getDealWidgets = (widgets: WidgetGrid, data: FormControl): WidgetGrid => {
  const dealWidgets: WidgetGrid = [];

  for (const [i, rowItem] of widgets.entries()) {
    for (const item of rowItem) {
      if (item.controlId === data.controlId) {
        dealWidgets.unshift([data]);
      }

      if (item.sectionId === data.controlId) {
        dealWidgets[i] = (dealWidgets[i] || []).concat(item);
      }
    }
  }

  return dealWidgets.filter(_.identity);
};

// 从原有位置删除拖拽元素,批量操作
const removeSrcItems = (widgets: WidgetGrid, dealWidgets: FormControl[] = []): WidgetGrid => {
  const ids = dealWidgets.map(item => item.controlId);
  return widgets.map(row => row.filter(item => !includes(ids, item.controlId)));
};

// 批量删除
export const batchRemoveItems = (widgets: WidgetGrid, deleteItems: FormControl[] = []): WidgetGrid => {
  return removeEmptyRow(removeSrcItems(widgets, deleteItems));
};

// 添加新行
export const insertNewLine = ({ widgets, srcItem, targetIndex }: InsertNewLineParams): WidgetGrid => {
  const dealWidgets = getDealWidgets(widgets, srcItem);
  const removedSrcItems = removeSrcItems(widgets, flatten(dealWidgets));
  const next = removedSrcItems.slice();

  dealWidgets.forEach((item, index) => next.splice(targetIndex + index, 0, item));
  return removeEmptyRow(next);
};

// 列表类型切换时，重新布局
export const resetDisplay = ({ widgets, srcPath, srcItem, targetIndex }: ResetDisplayParams): WidgetGrid => {
  const [row, col] = srcPath;
  if (row === undefined || col === undefined || !widgets[row]?.[col]) return widgets;
  const removedSrcItem = removeSrcItem(widgets, srcPath);
  // Remove the emptied source row before inserting the replacement row. This keeps the
  // saved row numbers continuous when the source row contained only this control.
  const newWidgets = removeEmptyRow(removedSrcItem).slice();
  const [sourceRow] = srcPath;
  const insertionIndex = sourceRow !== undefined && sourceRow < targetIndex ? targetIndex - 1 : targetIndex;
  newWidgets.splice(insertionIndex, 0, [srcItem]);
  return genWidgetRowAndCol(newWidgets);
};

// 在当前行最后插入元素
export const insertToRowEnd = ({ widgets, srcPath, srcItem, targetIndex }: InsertToRowEndParams): WidgetGrid => {
  const [row, col] = srcPath;
  if (row === undefined || col === undefined || !widgets[row]?.[col]) return widgets;
  const removedSrcItem = removeSrcItem(widgets, srcPath);
  const next = removedSrcItem.map(row => row.slice());
  const safeRow = next[targetIndex] || [];
  next[targetIndex] = safeRow.concat(srcItem).map(item => ({ ...item, size: WHOLE_SIZE / (safeRow.length + 1) }));
  return removeEmptyRow(next);
};

export const insertControlInSameLine = ({
  widgets,
  srcItem,
  srcPath,
  dropPath,
  location,
}: InsertSameLineParams): WidgetGrid => {
  const [rowIndex, colIndex] = dropPath;
  if (!isDropPath(widgets, dropPath) || rowIndex === undefined || colIndex === undefined) return widgets;
  const [startRowIndex, startColIndex] = srcPath || [];
  const next = widgets.map(row => row.slice());
  const row = next[rowIndex] || [];

  // 如果放在第一个的左边
  if (colIndex === 0 && location === 'left') {
    next[rowIndex] = [srcItem].concat(row).map(item => ({ ...item, size: WHOLE_SIZE / (row.length + 1) }));
    return next;
  }

  // 如果放在最后一个的右边
  if (colIndex === row.length && location === 'right') {
    next[rowIndex] = row.concat(srcItem).map(item => ({ ...item, size: WHOLE_SIZE / (row.length + 1) }));
    return next;
  }

  const insertIndex =
    startRowIndex === rowIndex && startColIndex !== undefined && startColIndex < colIndex
      ? location === 'left'
        ? colIndex - 1
        : colIndex
      : location === 'left'
        ? colIndex
        : colIndex + 1;
  const nextRow = row.slice();
  nextRow.splice(insertIndex, 0, srcItem);
  next[rowIndex] = nextRow.map(item => ({ ...item, size: WHOLE_SIZE / nextRow.length }));
  return next;
};

export const insertToCol = ({ widgets, srcPath, ...rest }: InsertToColParams): WidgetGrid => {
  if (!isDropPath(widgets, rest.dropPath)) return widgets;
  const [row, col] = srcPath;
  if (row === undefined || col === undefined || !widgets[row]?.[col]) return widgets;
  const removedSrcItem = removeSrcItem(widgets, srcPath);
  return removeEmptyRow(insertControlInSameLine({ widgets: removedSrcItem, srcPath, ...rest }));
};

export const isFullLineDragItem = (item: WidgetDragItem): boolean => {
  const { type, data, enumType } = item;

  if (includes([DRAG_ITEMS.DISPLAY_ITEM, DRAG_ITEMS.DISPLAY_TAB, DRAG_ITEMS.DISPLAY_LIST_TAB], type)) {
    return isFullLineControl(data);
  }

  if (includes([DRAG_ITEMS.LIST_ITEM, DRAG_ITEMS.LIST_TAB], type)) {
    const type: unknown = enumType === undefined ? undefined : enumWidgetType[enumType];
    return isFullLineControl(typeof type === 'number' ? { type } : undefined);
  }

  return false;
};
