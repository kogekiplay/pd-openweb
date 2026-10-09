import update from 'immutability-helper';
import _, { get, isEmpty, isFunction } from 'lodash';
import sheetAjax from 'src/api/worksheet';
import type { WorksheetFilters, WorksheetRowsRequest, WorksheetView } from 'src/pages/worksheet/types';
import type { AppDispatch, GetState, RootState } from 'src/redux/types';
import { getFilledRequestParams } from 'src/utils/common';
import type { FormControl } from 'src/utils/controlTypes';
import { formatQuickFilter } from 'src/utils/filter';
import type {
  AddHierarchyChildPayload,
  HierarchyCellValue,
  HierarchyControlsAction,
  HierarchyControlsPayload,
  HierarchyDataItem,
  HierarchyDataMap,
  HierarchyMovePayload,
  HierarchyNode,
  HierarchyPath,
  HierarchyRecord,
  HierarchyStateAction,
  HierarchyTextTitle,
  HierarchyViewData,
} from '../reducers/hierarchyTypes';
import { updateNavGroup } from './navFilter.js';
import { getCurrentView } from './util';
import { dealData, getHierarchyViewIds, getItemByRowId, getParaIds } from './util';

const MULTI_RELATE_MAX_PAGE_SIZE = 500;
let hierarchyPromiseObj: ApiResultOf<HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetRowsResult> | undefined;
let hierarchyPromiseViewIds: Array<string | undefined> = [];

// GetFilterRows is a generic JSON endpoint. Validate the fields the hierarchy algorithms consume
// before its untyped cell dictionary becomes hierarchy state; malformed successful responses throw.
function isCellValue(value: unknown): value is HierarchyCellValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    (Array.isArray(value)
      ? value.every(isCellValue)
      : typeof value === 'object' && Object.values(value).every(isCellValue))
  );
}
function decodeHierarchyLevel(serialized: string | null): number | string | undefined {
  const parsed: unknown = safeParse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError('Invalid hierarchy view configuration');
  const level = 'level' in parsed ? parsed.level : undefined;
  if (isHierarchyLevel(level)) return level;
  throw new TypeError('Invalid hierarchy expansion level');
}
function isHierarchyLevel(value: unknown): value is number | string | undefined {
  return value === undefined || typeof value === 'number' || typeof value === 'string';
}
function decodeOperationSuccess(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid hierarchy operation result');
  const success = 'isSuccess' in value ? value.isSuccess : undefined;
  if (success === undefined) return false;
  if (typeof success !== 'boolean') throw new TypeError('Invalid hierarchy operation success state');
  return success;
}
function isRelationControl(control: unknown): control is FormControl {
  if (!control || typeof control !== 'object' || Array.isArray(control)) return false;
  return (
    (!('controlId' in control) || control.controlId === undefined || typeof control.controlId === 'string') &&
    (!('viewId' in control) || control.viewId === undefined || typeof control.viewId === 'string') &&
    (!('type' in control) || control.type === undefined || typeof control.type === 'number') &&
    isCellValue(control)
  );
}
function decodeRelationControls(data: unknown): FormControl[][] {
  if (!Array.isArray(data)) throw new TypeError('Invalid hierarchy worksheet controls');
  return data.map(template => {
    if (!template || typeof template !== 'object' || Array.isArray(template))
      throw new TypeError('Invalid hierarchy worksheet template');
    const controls: unknown = 'controls' in template ? template.controls : undefined;
    if (controls === undefined) throw new TypeError('Hierarchy control fields are missing');
    if (!Array.isArray(controls) || !controls.every(isRelationControl))
      throw new TypeError('Invalid hierarchy control fields');
    return controls;
  });
}
function isHierarchyRecord(value: unknown): value is HierarchyRecord {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('rowid' in value) ||
    typeof value.rowid !== 'string'
  )
    return false;
  if ('allowDelete' in value && value.allowDelete !== undefined && typeof value.allowDelete !== 'boolean') return false;
  if ('pid' in value && value.pid !== undefined && typeof value.pid !== 'string') return false;
  if (
    'childrenids' in value &&
    value.childrenids !== undefined &&
    typeof value.childrenids !== 'string' &&
    !(Array.isArray(value.childrenids) && value.childrenids.every(id => typeof id === 'string'))
  )
    return false;
  if (
    'controls' in value &&
    value.controls !== undefined &&
    !(Array.isArray(value.controls) && value.controls.every(isRelationControl))
  )
    return false;
  return Object.values(value).every(isCellValue);
}
function decodeHierarchyRows(data: unknown): HierarchyRecord[] {
  if (!Array.isArray(data) || !data.every(isHierarchyRecord)) throw new TypeError('Invalid hierarchy worksheet rows');
  return data;
}

function isSavedRecord(row: HierarchyDataItem): row is HierarchyRecord {
  return typeof row.rowid === 'string';
}
function getSavedHierarchyMap(data: HierarchyViewData): HierarchyDataMap {
  if (Array.isArray(data)) throw new TypeError('Hierarchy data has not been initialized');
  return data;
}
function getSavedHierarchyRecord(data: HierarchyViewData, rowId: string): HierarchyRecord {
  const row = getSavedHierarchyMap(data)[rowId];
  if (!row || !isSavedRecord(row)) throw new TypeError('Hierarchy record is missing');
  return row;
}
type RawTotalItem = HierarchyRecord | (string & { rowid?: never; childrenids?: never });
const getTotalDataIds = (
  hierarchyViewData: HierarchyRecord[] | Record<string, RawTotalItem> | string | string[] = {},
  total = 0,
): Array<string | undefined> => {
  let totalIds: Array<string | undefined> = [];
  Object.values(hierarchyViewData).forEach((item: RawTotalItem) => {
    if (item) totalIds.push(item.rowid);
    if ((get(item, 'childrenids.length') || 0) > 0) {
      // Preserve the existing counter's discarded recursion result; changing its paging policy is separate.
      totalIds.concat(getTotalDataIds(item.childrenids!, total));
    }
  });
  return _.uniq(totalIds);
};

// 展开多级数据
export function expandedMultiLevelHierarchyData(
  args: Omit<WorksheetRowsRequest, 'layer'> & { layer: number | string },
  changeFilters?: boolean,
) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { quickFilter, navGroupFilters } = sheet;
    const { searchType, ...rest } = sheet.filters || {};
    const params = getParaIds(sheet);
    const { pageSize = 50 } = sheet.hierarchyView.hierarchyDataStatus;

    if (
      changeFilters &&
      hierarchyPromiseObj &&
      hierarchyPromiseObj.abort &&
      _.includes(hierarchyPromiseViewIds, params.viewId)
    ) {
      hierarchyPromiseObj.abort();
    }

    hierarchyPromiseViewIds.push(params.viewId);

    hierarchyPromiseObj = sheetAjax.getFilterRows(
      getFilledRequestParams({
        ...args,
        ...rest,
        ...params,
        pageSize,
        searchType: searchType || 1,
        fastFilters: formatQuickFilter(quickFilter),
        navGroupFilters,
        langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
      }),
    );

    hierarchyPromiseObj.then(({ data: rawData, count, resultCode }) => {
      const data = resultCode === 1 ? decodeHierarchyRows(rawData) : [];
      hierarchyPromiseViewIds = hierarchyPromiseViewIds.filter(o => o !== params.viewId);
      if (resultCode === 1) {
        const treeData = dealData(data);
        const totalDataOver = getTotalDataIds(data).length;
        // 第一次调用少于1000条，加载全量数据
        const needGetOne =
          ((totalDataOver < 1000 && pageSize === 50) || (totalDataOver > 1000 && pageSize === 1000)) &&
          sheet.hierarchyView.hierarchyTopLevelDataCount === 0;
        dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: treeData });
        dispatch({
          type: 'CHANGE_HIERARCHY_DATA_STATUS',
          data: {
            loading: needGetOne,
            pageIndex: 1,
            ...(needGetOne ? { pageSize: totalDataOver > 1000 ? 50 : 1000 } : {}),
          },
        });
        dispatch({
          type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT',
          count: count,
        });
        dispatch({
          type: 'EXPAND_HIERARCHY_VIEW_STATE',
          data: {
            treeData,
            data,
            level: needGetOne ? (totalDataOver > 1000 ? '1' : '5') : +args.layer,
          },
        });

        if (needGetOne) {
          dispatch(getDefaultHierarchyData());
        }
      }
    });
  };
}

function genKanbanKeyByData(data: HierarchyRecord[]) {
  return data.map(item => item.rowid).join(',');
}

// 递归获取多级关联的层级视图数据
interface HierarchyRecursionParams {
  dispatch: AppDispatch;
  getState: GetState;
  viewControls: NonNullable<WorksheetView['viewControls']>;
  level: number | string;
  filters: WorksheetFilters;
  viewId?: string | undefined;
  worksheetId?: string | undefined;
}
function getHierarchyDataRecursion({
  worksheet,
  records,
  kanbanKey,
  index,
  para,
}: {
  worksheet: RootState['sheet'];
  records: HierarchyRecord[];
  kanbanKey: string;
  index: number;
  para: HierarchyRecursionParams;
}) {
  const { dispatch, getState, viewControls, level, filters, ...rest } = para;
  // 筛选条件异步加载，重新获取数据时暂停上一次递归请求
  const { sheet } = getState();
  if (!_.isEqual(_.get(filters, 'filtersGroup') || [], _.get(sheet, 'filters.filtersGroup') || [])) return;

  if (records.length >= 1000 || index > (level as number) || index > viewControls.length) {
    const treeData = dealData(records);
    dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: treeData });
    dispatch({
      type: 'EXPAND_HIERARCHY_VIEW_STATE',
      data: { treeData, data: records, level },
    });
    dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false } });
    return;
  }

  const { worksheetId: relationWorksheetId, controlId } = viewControls[index - 1]!;
  sheetAjax
    .getFilterRows(
      getFilledRequestParams({
        ...rest,
        ...filters,
        relationWorksheetId,
        controlId,
        kanbanKey,
        pageSize: MULTI_RELATE_MAX_PAGE_SIZE,
        langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
      }),
    )
    .then(({ data: rawData }) => {
      const data = decodeHierarchyRows(rawData);
      if (data.length < 1) {
        const treeData = dealData(records);
        dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: treeData });
        dispatch({
          type: 'EXPAND_HIERARCHY_VIEW_STATE',
          data: { treeData, data: records, level },
        });
        dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false } });
        return;
      }

      getHierarchyDataRecursion({
        worksheet,
        records: records.concat(data),
        kanbanKey: genKanbanKeyByData(data),
        index: index + 1,
        para,
      });
    });
}

export const expandMultiLevelHierarchyDataOfMultiRelate = (level: number | string) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { worksheetInfo = {}, filters } = sheet;
    const { worksheetId } = worksheetInfo;
    const { viewControls, viewId } = getCurrentView(sheet);
    sheetAjax
      .getFilterRows(
        getFilledRequestParams({
          worksheetId,
          viewId,
          pageSize: 50,
          ...filters,
          langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
        }),
      )
      .then(({ data: rawData, count }) => {
        const data = decodeHierarchyRows(rawData);
        const kanbanKey = genKanbanKeyByData(data);
        dispatch({
          type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT',
          count: count,
        });
        dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false, pageIndex: 1 } });
        if (!kanbanKey || (level as number) <= 1) {
          const treeData = dealData(data);
          dispatch({
            type: 'EXPAND_HIERARCHY_VIEW_STATE',
            data: { treeData, data, level: 1 },
          });
          dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: treeData });
          dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false } });
          return;
        }

        const para = {
          viewControls: viewControls!,
          level,
          viewId,
          dispatch,
          getState,
          worksheetId,
          filters,
        };
        getHierarchyDataRecursion({
          worksheet: sheet,
          records: data,
          kanbanKey,
          index: 2,
          para,
        });
      });
  };
};

export const addHierarchyRecord =
  (args: AddHierarchyChildPayload & { reGetData?: boolean | undefined }) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { path, pathId, data, reGetData = false } = args;
    dispatch({
      type: 'CHANGE_HIERARCHY_VIEW_DATA',
      data: dealData([data]),
    });
    // 添加子记录
    if (isEmpty(path)) {
      // 添加顶级记录
      dispatch({ type: 'ADD_TOP_LEVEL_STATE', data: [data] });
    } else {
      const { sheet } = getState();
      const { hierarchyView } = sheet;
      const { hierarchyViewState = [] } = hierarchyView || {};
      const recordIndex = path[0]!;

      // 分页数据
      if (reGetData && recordIndex >= 50) {
        const curRecord = hierarchyViewState[recordIndex]!;
        const children = curRecord.children || [];

        // 只有未展开且没有展开过的时候才处理
        if (children?.length && typeof children[0] === 'string') {
          dispatch({
            type: 'ADD_RECORD_CHILDREN_WITH_ONLY_PAGINATION',
            data: { index: recordIndex, rowId: data.rowid },
          });
          return;
        }
      }

      dispatch(addHierarchyChildrenRecord({ data, path, pathId }));
    }
  };

export function onCopySuccess(data: { path: HierarchyPath; pathId: string[]; item: HierarchyRecord }) {
  return (dispatch: AppDispatch) => {
    const { path, pathId, item } = data;

    if (path.length === 1) {
      // 添加顶级记录
      dispatch({ type: 'ADD_TOP_LEVEL_STATE', data: item });
    } else {
      dispatch(addHierarchyChildrenRecord({ data: item, path: path.slice(0, -1), pathId: pathId.slice(0, -1) }));
    }
  };
}

export function addHierarchyChildrenRecord(
  data: AddHierarchyChildPayload,
): Extract<HierarchyStateAction, { type: 'ADD_HIERARCHY_CHILDREN_RECORD_STATE' }> {
  return { type: 'ADD_HIERARCHY_CHILDREN_RECORD_STATE', data };
}

export const getTopLevelHierarchyData = (args: WorksheetRowsRequest) => (dispatch: AppDispatch) => {
  dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: true } });
  args.langType = window.shareState.shareId ? getCurrentLangCode() : undefined;
  sheetAjax.getFilterRows(getFilledRequestParams(args)).then(({ data: rawData, resultCode, count }) => {
    const data = resultCode === 1 ? decodeHierarchyRows(rawData) : [];
    if (resultCode === 1) {
      const treeData = dealData(data);
      dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: treeData });
      dispatch({ type: 'INIT_HIERARCHY_VIEW_STATE', data });
      dispatch({ type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT', count });
      dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false } });
    }
  });
};

// 删除层级记录
export function deleteHierarchyRecord({
  rows,
  path,
  pathId,
  ...rest
}: WorksheetRowsRequest & { rows: HierarchyRecord[]; path: HierarchyPath; pathId: string[] }) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { hierarchyView } = sheet;
    let { hierarchyViewData } = hierarchyView;
    const rowIds = rows.filter((item: HierarchyRecord) => !!item.allowDelete).map(item => item.rowid);
    sheetAjax.deleteWorksheetRows({ rowIds, ...getHierarchyViewIds(sheet, path), ...rest }).then((data: unknown) => {
      const id = rowIds[0]!;

      if (decodeOperationSuccess(data)) {
        const pathLen = pathId.length;

        if (pathLen === 1) {
          dispatch(expandedMultiLevelHierarchyData({ layer: 3 }));
        } else {
          dispatch(
            getAssignChildren(
              {
                path: path.slice(0, -1),
                pathId: pathId.slice(0, -1),
                kanbanKey: pathId[pathLen - 2],
              },
              true,
            ),
          );
        }

        dispatch({
          type: 'CHANGE_HIERARCHY_VIEW_DATA',
          data: update(hierarchyViewData, { $unset: [id] }),
        });
        dispatch(updateNavGroup());
      }
    });
  };
}

export const hideHierarchyRecord =
  (id: string, path: HierarchyPath, pathId: string[]) => (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { hierarchyView } = sheet;
    let { hierarchyViewData } = hierarchyView;
    const pathLen = pathId.length;

    if (pathLen === 1) {
      dispatch(expandedMultiLevelHierarchyData({ layer: 3 }));
    } else {
      dispatch(
        getAssignChildren(
          {
            path: path.slice(0, -1),
            pathId: pathId.slice(0, -1),
            kanbanKey: pathId[pathLen - 2],
          },
          true,
        ),
      );
    }

    dispatch({
      type: 'CHANGE_HIERARCHY_VIEW_DATA',
      data: update(hierarchyViewData, { $unset: [id] }),
    });
  };

// 判断是否是祖先元素
const isAncestor = (src: HierarchyPath, target: HierarchyPath) => {
  for (let i = 0; i < target.length; i++) {
    if (src[i] !== target[i]) return false;
  }

  return true;
};

const isSibling = (src: HierarchyPath, target: HierarchyPath) => {
  if (!Array.isArray(src) || !Array.isArray(target)) return undefined;
  return JSON.stringify(src.slice(0, -1)) === JSON.stringify(target.slice(0, -1));
};

export function updateMovedRecord(args: HierarchyMovePayload & WorksheetRowsRequest) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { src, target, ...rest } = args;
    const { sheet } = getState();
    const { controls } = sheet;
    const { viewControl } = getCurrentView(sheet);
    const control = _.find(controls, item => item.controlId === viewControl);
    const newOldControl = [
      {
        ..._.pick(control, ['type', 'controlId', 'controlName']),
        value: JSON.stringify([{ sid: target.rowId }]),
      },
    ];
    sheetAjax
      .updateWorksheetRow({
        newOldControl,
        rowId: src.rowId,
        ...getParaIds(sheet),
        ...rest,
      })
      .then(() => {
        // 如果拖拽的是顶级记录则重新拉取所有记录
        if (src.path.length === 1) {
          dispatch(expandedMultiLevelHierarchyData({ layer: 3 }));
          return;
        }

        // 如果是拖到兄弟元素上则只需要拉取父级元素
        if (isSibling(src.path, target.path)) {
          dispatch(
            getAssignChildren(
              {
                path: src.path.slice(0, -1),
                pathId: src.pathId.slice(0, -1),
                kanbanKey: src.pathId[src.pathId.length - 2],
              },
              true,
            ),
          );
          return;
        }

        // 如果拖动祖先元素中 则只拉取祖先元素的数据即可
        if (isAncestor(src.path, target.path)) {
          dispatch(
            getAssignChildren(
              {
                ..._.pick(target, ['path', 'pathId']),
                kanbanKey: target.rowId,
              },
              true,
            ),
          );
          return;
        }

        dispatch(getAssignChildren({ ..._.pick(target, ['path', 'pathId']), kanbanKey: target.rowId }, true));
        dispatch(
          getAssignChildren(
            {
              path: src.path.slice(0, -1),
              pathId: src.pathId.slice(0, -1),
              kanbanKey: src.pathId[src.pathId.length - 2],
            },
            true,
          ),
        );
      });
  };
}

export function moveMultiSheetRecord(args: HierarchyMovePayload) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sheet } = getState();
    const { src, target } = args;
    const { viewControls } = getCurrentView(sheet);
    const { worksheetId } = viewControls![target.path.length - 1]!;
    const { controlId, worksheetId: relationWorksheetId } = viewControls![target.path.length]!;
    const { hierarchyView } = sheet;
    const { pid: fromRowId, controls } = getSavedHierarchyRecord(hierarchyView.hierarchyViewData, src.rowId);
    if (!controls) throw new TypeError('Hierarchy record controls are missing');
    const { viewId } = _.find(controls, item => item.controlId === controlId) || {};

    const targetControl = _.find(sheet.controls || [], item => item.controlId === controlId) || {};
    const targetRowData: Partial<HierarchyNode> =
      _.find(hierarchyView.hierarchyViewState || [], { rowId: target.rowId }) || {};

    // 如果是单条且已有值，则返回
    if (targetControl.enumDefault === 1 && targetRowData.children?.length) {
      alert(_l('已存在一条关联记录，修改失败！'), 2);
      return;
    }

    sheetAjax
      .replaceRowRelationRows({
        worksheetId,
        fromRowId: fromRowId,
        toRowId: target.rowId,
        rowIds: [src.rowId],
        controlId,
        viewId,
      })
      .then((response: unknown) => {
        if (decodeOperationSuccess(response)) {
          dispatch({ type: 'MULTI_RELATE_MOVE_RECORD', data: { src, target } });
          // 重新拉取目标节点数据
          dispatch(
            getAssignChildren({
              path: target.path,
              pathId: target.pathId,
              kanbanKey: target.rowId,
              controlId,
              relationWorksheetId,
            }),
          );
          // 重新拉取当前父节点数据
          dispatch(
            getAssignChildren({
              path: src.path.slice(0, -1),
              pathId: src.pathId.slice(0, -1),
              kanbanKey: fromRowId,
              controlId,
              relationWorksheetId,
            }),
          );
        } else {
          alert(_l('调整关联关系失败! 请稍后重试'), 2);
        }
      });
  };
}

// 关联多表层级视图获取子级数据
export function multiRelateGetChildren(para: WorksheetRowsRequest & { path: HierarchyPath; pathId: string[] }) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sheet } = getState();
    const { viewControls = [] } = getCurrentView(sheet);
    const layerInfo = viewControls[para.path.length];
    if (!layerInfo) return;
    const { controlId, worksheetId: relationWorksheetId } = layerInfo;

    dispatch(
      getAssignChildren({
        ...para,
        controlId,
        relationWorksheetId,
      }),
    );
  };
}

export function getAssignChildren(
  {
    path = [],
    pathId = [],
    callback,
    ...args
  }: WorksheetRowsRequest & {
    path?: number[] | undefined;
    pathId?: string[] | undefined;
    callback?: (() => void) | undefined;
  },
  onlyUpdateChildren = false,
) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sheet } = getState();
    const { filters, quickFilter, navGroupFilters } = sheet;
    const { viewType, childType, viewControls = [] } = getCurrentView(sheet);

    const getDefaultPara = () => {
      if (viewType === 2 && childType === 2) {
        const level = path.length;
        const { controlId, worksheetId: relationWorksheetId } = viewControls[level] || {};
        return {
          controlId,
          relationWorksheetId,
          pageSize: 1000,
        };
      }
      return undefined;
    };

    args = {
      ...getDefaultPara(),
      ...getParaIds(sheet),
      ...filters,
      ...args,
      fastFilters: formatQuickFilter(quickFilter),
      navGroupFilters,
      langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
    };

    sheetAjax.getFilterRows(getFilledRequestParams(args)).then(({ data: rawData, resultCode }) => {
      if (resultCode !== 1) {
        return;
      }
      const data = decodeHierarchyRows(rawData);

      dispatch({
        type: 'CHANGE_HIERARCHY_VIEW_DATA',
        data: dealData(data),
      });
      // 只更新children
      if (onlyUpdateChildren) {
        dispatch({
          type: 'UPDATE_HIERARCHY_CHILDREN',
          data: { data, path, pathId },
        });
        return;
      }

      dispatch({
        type: 'EXPAND_CHILDREN_STATE',
        data: { data, path, pathId },
      });
      if (_.isFunction(callback)) {
        callback();
      }
    });
  };
}

// 切换子记录的显隐
export const changeHierarchyChildrenVisible = (data: {
  path: number[];
  visible?: boolean | undefined;
}): Extract<HierarchyStateAction, { type: 'TOGGLE_HIERARCHY_VISIBLE' }> => {
  return { type: 'TOGGLE_HIERARCHY_VISIBLE', data };
};

// 成为顶级记录
export function becomeTopLevelRecord(data: HierarchyNode) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();

    const { hierarchyView, controls } = sheet;
    const { hierarchyViewState } = hierarchyView;
    const { rowId, path, pathId } = data;
    // 如果更新了父记录 则重新拉取父记录的子记录
    const args = {
      kanbanKey: pathId[pathId.length - 2],
      ...getParaIds(sheet),
      ...sheet.filters,
      path: path.slice(0, -1),
      pathId: pathId.slice(0, -1),
    };
    const { viewControl } = getCurrentView(sheet);
    const control = _.find(controls, item => item.controlId === viewControl);
    const newOldControl = [
      {
        ..._.pick(control, ['type', 'controlId', 'controlName']),
        value: JSON.stringify([]),
      },
    ];
    sheetAjax.updateWorksheetRow({ newOldControl, rowId, ...getParaIds(sheet) }).then((res: { data?: unknown }) => {
      if (res && res.data) {
        const savedRecord = decodeHierarchyRows([res.data])[0]!;
        dispatch(getAssignChildren(args, true));
        dispatch({ type: 'ADD_TOP_LEVEL_STATE', data: [savedRecord] });
        if (data.children && data.children.length) {
          dispatch(
            getAssignChildren(
              {
                kanbanKey: rowId,
                path: [hierarchyViewState.length],
                pathId: [rowId],
                ...getParaIds(sheet),
                ...sheet.filters,
              },
              true,
            ),
          );
        }
      }
    });
  };
}

export const addTopLevelStateFromTemp = (
  data: HierarchyRecord,
): Extract<HierarchyStateAction, { type: 'ADD_TOP_LEVEL_STATE_FROM_TEMP' }> => {
  return { type: 'ADD_TOP_LEVEL_STATE_FROM_TEMP', data };
};

// 更新层级记录数据
export function updateHierarchyData({
  recordId,
  value,
  path,
  pathId,
  relateSheet,
}: {
  recordId: string;
  value: Partial<HierarchyRecord>;
  path: HierarchyPath;
  pathId: string[];
  relateSheet?: boolean | undefined;
}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { hierarchyView } = sheet;
    const { hierarchyViewData } = hierarchyView;
    const { viewControl, childType } = getCurrentView(sheet);
    const updateKeys = Object.keys(value);
    // 父记录更新有值，手动刷新，否则作为顶级处理
    const hasValue = value[viewControl!] && !_.isEmpty(safeParse(value[viewControl!] || '[]'));

    if (_.includes(updateKeys, viewControl) && hasValue) {
      dispatch(getDefaultHierarchyData());
      return;
    }

    // 如果更新了父记录 则重新拉取父记录的子记录
    if (_.includes(updateKeys, viewControl)) {
      const args = {
        kanbanKey: pathId[pathId.length - 2],
        ...getParaIds(sheet),
        ...sheet.filters,
        path: path.slice(0, -1),
        pathId: pathId.slice(0, -1),
      };
      dispatch(getAssignChildren(args, true));
      dispatch({
        type: 'ADD_TOP_LEVEL_STATE',
        data: [getSavedHierarchyRecord(hierarchyViewData, recordId)],
      });
      return;
    }

    if (!_.isEmpty(value)) {
      dispatch({
        type: 'CHANGE_HIERARCHY_VIEW_DATA',
        data: update(getSavedHierarchyMap(hierarchyViewData), {
          [recordId]: {
            $apply: (item: HierarchyDataItem): HierarchyRecord => {
              if (!isSavedRecord(item)) throw new TypeError('Hierarchy record is missing');
              return { ...item, ...value };
            },
          },
        }),
      });
    }

    // 如果在记录详情里编辑了关联记录 则重新拉取这个记录下的子记录
    if (relateSheet) {
      if (String(childType) === '2') {
        dispatch(multiRelateGetChildren({ path, pathId, kanbanKey: recordId }));
        return;
      }

      const args = {
        kanbanKey: recordId,
        ...getParaIds(sheet),
        ...sheet.filters,
        path,
        pathId,
      };
      dispatch(getAssignChildren(args, true));
    }
  };
}

// 拖拽移动记录
export function moveRecord(
  data: HierarchyMovePayload,
): Extract<HierarchyStateAction, { type: 'MOVE_RECORD' | 'MULTI_RELATE_MOVE_RECORD' }> {
  return { type: 'MOVE_RECORD', data };
}

export function getHierarchyRecord(args: WorksheetRowsRequest, cb?: (rows: HierarchyRecord[] | undefined) => void) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sheet } = getState();
    args = {
      ...getParaIds(sheet),
      ...sheet.filters,
      ...args,
      langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
    };
    sheetAjax.getFilterRows(getFilledRequestParams(args)).then(({ data: rawData, resultCode, count }) => {
      const data = rawData === undefined ? undefined : decodeHierarchyRows(rawData);
      if (isFunction(cb)) {
        cb(data);
      }

      if (resultCode !== 1 || !data!.length) {
        return;
      }

      dispatch({ type: 'CHANGE_HIERARCHY_VIEW_DATA', data: dealData(data!) });
      dispatch({ type: 'CHANGE_HIERARCHY_DATA_STATUS', data: { loading: false, pageIndex: args.pageIndex || 1 } });
      dispatch({ type: 'ADD_TOP_LEVEL_STATE', data });
      dispatch({ type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT', count });
    });
  };
}

// 更新标题控件数据
export function updateTitleData({ data, rowId }: { rowId: string; data: Partial<HierarchyRecord> }) {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sheet } = getState();
    const originData = getSavedHierarchyRecord(sheet.hierarchyView.hierarchyViewData, rowId);
    dispatch({ type: 'UPDATE_HIERARCHY_VIEW_DATA', data: { [rowId]: { ...originData, ...data } } });
  };
}

export function addTextTitleRecord(
  data: HierarchyTextTitle,
): Extract<HierarchyStateAction, { type: 'ADD_TEXT_TITLE_RECORD' }> {
  return { type: 'ADD_TEXT_TITLE_RECORD', data };
}

export function removeHierarchyTempItem(
  data: Pick<HierarchyTextTitle, 'rowId' | 'path'>,
): Extract<HierarchyStateAction, { type: 'REMOVE_HIERARCHY_TEMP_ITEM' }> {
  return { type: 'REMOVE_HIERARCHY_TEMP_ITEM', data };
}

export function addHierarchyRelateSheetControls(payload: HierarchyControlsPayload): HierarchyControlsAction {
  return { type: 'ADD_HIERARCHY_RELATE_SHEET_CONTROLS', payload };
}

export function initHierarchyRelateSheetControls(payload: HierarchyControlsPayload): HierarchyControlsAction {
  return { type: 'INIT_HIERARCHY_RELATE_SHEET_CONTROLS', payload };
}

export function getDefaultHierarchyData(
  view?: WorksheetView,
  { changeFilters }: { changeFilters?: boolean | undefined } = {},
) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const { viewId, viewControl, viewControls, childType } = isEmpty(view) ? getCurrentView(sheet) : view!;
    const pageSize =
      Number(childType) === 2
        ? 50
        : _.get(sheet, 'hierarchyView.hierarchyTopLevelDataCount')
          ? _.get(sheet, 'hierarchyView.hierarchyDataStatus.pageSize')
          : 1000;
    if (!viewControl && isEmpty(viewControls)) return;
    // 层级视图刷新(本表小于1000条加载全量数据)
    dispatch({
      type: 'CHANGE_HIERARCHY_DATA_STATUS',
      data: { loading: true, pageSize: pageSize },
    });
    if (_.includes(['1', '0'], String(childType))) {
      const level = decodeHierarchyLevel(localStorage.getItem(`hierarchyConfig-${viewId}`));
      dispatch(
        expandedMultiLevelHierarchyData(
          {
            layer: level || (pageSize === 1000 ? '5' : '1'),
          },
          changeFilters,
        ),
      );
    } else {
      const level = decodeHierarchyLevel(localStorage.getItem(`hierarchyConfig-${viewId}`));
      // 多表关联层级视图获取多级数据 默认加载3级
      dispatch(expandMultiLevelHierarchyDataOfMultiRelate(level || 3));
    }
  };
}

export function hierarchyViewRefresh() {
  getDefaultHierarchyData();
}

export function addMultiRelateHierarchyControls(ids: string[]) {
  return (dispatch: AppDispatch) => {
    sheetAjax.getWorksheetsControls({ worksheetIds: ids }).then(({ code, data }) => {
      if (code === 1) {
        const relateControls = decodeRelationControls(data);
        dispatch(addHierarchyRelateSheetControls({ ids, controls: relateControls }));
      }
    });
  };
}

export const updateHierarchySearchRecord = (record: Pick<HierarchyRecord, 'rowid'> | null) => {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { sheet } = getState();
    const count = sheet.hierarchyView.hierarchyTopLevelDataCount || 0;

    if (count < 1000) {
      if (record) {
        //向上展开所有层级
        const currentItem = getItemByRowId(record.rowid, sheet.hierarchyView.hierarchyViewState);

        if (currentItem) {
          dispatch({ type: 'CHANGE_HIERARCHY_DATA_VISIBLE', data: currentItem });
          //定位到可视区域
          setTimeout(() => {
            const searchEl = document.getElementById(`${record.rowid}`);

            if (searchEl) {
              searchEl.scrollIntoView({
                inline: 'center',
                block: 'center',
              });
            }
          }, 100);
        }
      }

      //搜索命中
      dispatch({ type: 'CHANGE_HIERARCHY_SEARCH_RECORD_ID', data: record ? record.rowid : null });
    } else {
      //打开记录详情
      dispatch({ type: 'CHANGE_HIERARCHY_RECORD_INFO_ID', data: record ? record.rowid : null });
    }
  };
};

export const resetHierarchyViewData = () => {
  return (dispatch: AppDispatch) => {
    dispatch({ type: 'INIT_HIERARCHY_VIEW_DATA', data: [] });
    dispatch({
      type: 'CHANGE_HIERARCHY_DATA_STATUS',
      data: { loading: true, hasMoreData: true, pageIndex: 1, pageSize: 50 },
    });
    dispatch({
      type: 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT',
      count: 0,
    });
  };
};
