import update from 'immutability-helper';
import { isArray, isEmpty } from 'lodash';
import _ from 'lodash';
import type {
  AddHierarchyChildPayload,
  ExpandedHierarchyPayload,
  HierarchyChild,
  HierarchyControlsAction,
  HierarchyControlsMap,
  HierarchyControlsPayload,
  HierarchyCountAction,
  HierarchyDataAction,
  HierarchyDataMap,
  HierarchyDataStatus,
  HierarchyMovePayload,
  HierarchyNode,
  HierarchyPath,
  HierarchyRecord,
  HierarchyRecordInfoAction,
  HierarchySearchAction,
  HierarchyState,
  HierarchyStateAction,
  HierarchyStatusAction,
  HierarchyTextTitle,
  HierarchyViewData,
} from './hierarchyTypes';
import { dealChildren, dealPath, initState } from './util';

// 按已有顺序排序
const sortChildIds = (
  treeData: HierarchyDataMap,
  rowId: string,
  childrenids: HierarchyRecord['childrenids'],
): string[] => {
  const sortIds = Object.values(treeData).filter(i => i.pid === rowId);
  const idByOrder = new Map(sortIds.map((t, i) => [t.rowid, i]));
  // 未指定固定第一项
  return _.sortBy(dealChildren(childrenids) as string[], o => idByOrder.get(o));
};

// 更新记录
const updateHierarchyRecord = ({
  state,
  path,
  updater,
}: {
  state: HierarchyState;
  path: HierarchyPath;
  updater: Partial<HierarchyNode>;
}): HierarchyState => {
  if (!path.length) return state;
  if (path.length === 1) {
    return update(state, {
      [path[0]!]: { $apply: (item: HierarchyNode) => ({ ...item, ...updater }) },
    });
  }

  const temp = _.cloneDeep(state);
  const wholePath = dealPath(path);
  // Paths are supplied by existing state nodes. These annotations describe that protocol;
  // they do not validate an arbitrary path or decoded server response at runtime.
  const prevValue = _.get(state, wholePath) as HierarchyNode | undefined;
  if (_.isEmpty(prevValue)) return temp;
  _.set(temp, wholePath, { ...prevValue, ...updater });
  return temp;
};

// 展开多级 递归生成状态树
const genTree = (
  {
    data = [],
    treeData = {},
    path = [],
    pathId = [],
    level,
  }: {
    data?: Array<string | HierarchyRecord>;
    treeData?: HierarchyDataMap;
    path?: HierarchyPath;
    pathId?: string[];
    level?: number | string;
  } = {
    data: [],
    treeData: {},
    path: [],
    pathId: [],
    level: 0,
  },
): HierarchyState => {
  if ((level as number) < 0) return [];
  level = (level as number) - 1;
  const children: HierarchyState = [];

  for (let i = 0; i < data.length; i++) {
    const rowId = _.isString(data[i]) ? (data[i] as string) : (data[i]! as HierarchyRecord).rowid;
    const node: Pick<HierarchyRecord, 'childrenids'> = treeData[rowId] || {};
    const currentPath = path.concat([i]);
    const currentPathId = pathId.concat([rowId]);
    children.push({
      rowId,
      path: currentPath,
      pathId: currentPathId,
      display: true,
      visible: level > 0,
      children: genTree({
        data: sortChildIds(treeData, rowId, node.childrenids),
        treeData,
        path: currentPath,
        pathId: currentPathId,
        level,
      }),
    });
  }

  return children;
};

//向上展开全部记录
const updateHierarchyVisible = ({
  state = [],
  currentItem,
}: {
  state?: HierarchyState;
  currentItem: Pick<HierarchyNode, 'pathId' | 'rowId'>;
}): HierarchyState => {
  const { pathId = [], rowId } = currentItem;
  //本身不展开
  const filterPathId = pathId.filter(id => id !== rowId);
  const index = _.findIndex(state, da => _.includes(filterPathId, da.rowId));

  if (index > -1) {
    // The existing traversal returns the first element and discards recursive return values.
    // Its caller supplies one known node; the overload describes that result without changing the traversal.
    const treeChange = ((tree: HierarchyChild[]): HierarchyChild | HierarchyChild[] => {
      for (const item of tree) {
        if (item.children && item.children.length > 0) {
          treeChange(item.children);
        }

        return _.includes(filterPathId, item.rowId) ? { ...(item as HierarchyNode), visible: true } : item;
      }

      return tree;
    }) as {
      (tree: [HierarchyNode, ...HierarchyChild[]]): HierarchyNode;
      (tree: HierarchyChild[]): HierarchyChild | HierarchyChild[];
    };

    const newData = treeChange([state[index]!]);
    return update(state, { $splice: [[index, 1, newData]] });
  } else {
    return state;
  }
};

// 展开多级记录
const expandedHierarchyView = ({ data, treeData, level }: ExpandedHierarchyPayload): HierarchyState => {
  const parents = _.filter(data, item => !item.pid);
  return genTree({ data: parents, treeData, level });
};

// 添加顶级记录
const addTopLevelRecordState = ({
  state,
  data,
}: {
  state: HierarchyState;
  data: HierarchyRecord | HierarchyRecord[];
}): HierarchyState => {
  const count = state.length;
  if (!isArray(data) && !isEmpty(data)) data = [data];
  return update(state, {
    $push: initState({ data, baseIndex: count, visible: true }),
  });
};

// 添加子记录
const addChildrenRecordState = ({
  state,
  data,
  path,
  pathId,
  spliceTempRecord = false,
}: { state: HierarchyState } & AddHierarchyChildPayload): HierarchyState => {
  if (!path.length) return state;
  const getNextChildren = (children: HierarchyChild[]): HierarchyChild[] => {
    const actualChildren = children.filter(item => typeof item !== 'string');

    if (spliceTempRecord) {
      return update(children, {
        $splice: [
          [
            children.length - 1,
            0,
            ...initState({
              data: [data],
              path,
              pathId,
              baseIndex: Math.max(0, actualChildren.length),
            }),
          ],
        ],
      });
    }

    return update(children, {
      $push: initState({
        data: [data],
        path,
        pathId,
        baseIndex: actualChildren.length,
      }),
    });
  };

  if (path.length === 1) {
    return update(state, {
      [path[0]!]: { children: { $apply: (item: HierarchyChild[]) => getNextChildren(item) } },
    });
  }

  const temp = _.cloneDeep(state);
  const wholePath = dealPath(path);
  const prevValue = _.get(state, wholePath) as HierarchyNode;

  _.set(temp, wholePath, {
    ...prevValue,
    visible: true,
    children: getNextChildren(prevValue.children),
  });
  return temp;
};

function multiRelateMoveRecord({
  state,
  src,
  target,
}: { state: HierarchyState } & HierarchyMovePayload): HierarchyState {
  const { rowId: currentRowId, path: srcPath } = src;
  const { path: targetPath } = target;
  const temp = _.cloneDeep(state);

  const isCurrent = (item: HierarchyChild): boolean => {
    if (_.isObject(item)) return item.rowId === currentRowId;
    return item === currentRowId;
  };

  // 当前记录完整路径
  // const currentWholePath = dealPath(srcPath);
  // 当前记录父记录完整路径
  const currentParentWholePath = dealPath(srcPath.slice(0, -1));
  // 目标记录完成路径
  const targetWholePath = dealPath(targetPath);

  // const currentRecord = _.get(temp, currentWholePath);
  const currentParentRecord = _.get(temp, currentParentWholePath) as HierarchyNode;
  const targetRecord = _.get(temp, targetWholePath) as HierarchyNode;
  const currentIndex = _.findIndex(currentParentRecord.children, isCurrent);

  // const nextRecord = update(currentRecord, {
  //   pathId: { $apply: () => [...targetRecord.pathId, currentRowId] },
  //   path: { $apply: () => [...targetRecord.path, targetRecord.children.length] },
  // });
  const nextParentRecord = update(currentParentRecord, {
    children: { $splice: [[currentIndex, 1]] },
  });
  const nextTargetRecord = update(targetRecord, {
    children: { $push: [currentRowId] },
  });

  // _.set(temp, currentWholePath, nextRecord);
  _.set(temp, currentParentWholePath, nextParentRecord);
  _.set(temp, targetWholePath, nextTargetRecord);
  return temp;
}

// 移动记录卡片，分别更新原纪录的path和pathId 并将其放入目标记录的children中
const moveRecord = ({ state, target, src }: { state: HierarchyState } & HierarchyMovePayload): HierarchyState => {
  const { path: targetPath } = target;
  const { rowId: srcId, path: srcPath } = src;
  if (_.isEmpty(targetPath) || _.isEmpty(srcPath)) return state;
  if (_.findIndex(target.children, item => item.rowId === srcId) > -1) return state;
  const temp = _.cloneDeep(state);
  const targetWholePath = dealPath(targetPath);
  const srcWholePath = dealPath(srcPath);
  const targetRecord = _.get(temp, targetWholePath) as HierarchyNode;
  const srcRecord = _.get(temp, srcWholePath) as HierarchyNode;
  if (!srcRecord || !targetRecord) return state;
  // 顶级记录移动
  if (srcWholePath.length === 1) {
    const index = srcWholePath[0] as number;
    const next = update(temp, { $splice: [[index, 1]] });
    const nextTarget = update(targetRecord, {
      children: { $push: [temp[index]!] },
    });
    _.set(next, targetWholePath, nextTarget);
    return next;
  }

  const srcParentPath = dealPath(srcPath.slice(0, -1));
  const srcParent = _.get(temp, srcParentPath) as HierarchyNode;
  const srcIndex = _.findIndex(srcParent.children, item => item.rowId === srcId);
  const nextSrcParent = update(srcParent, {
    children: { $splice: [[srcIndex, 1]] },
  });
  const nextSrcRecord = update(srcRecord, {
    pathId: { $apply: () => [...targetRecord.pathId, srcId] },
    path: { $apply: (item: HierarchyPath) => [...targetRecord.path, _.last(item)!] },
  });
  _.set(temp, srcParentPath, nextSrcParent);
  const nextTarget = nextSrcRecord ? update(targetRecord, { children: { $push: [nextSrcRecord] } }) : targetRecord;
  _.set(temp, targetWholePath, nextTarget);
  return temp;
};

function addTextTitleRecord({ state, data }: { state: HierarchyState; data: HierarchyTextTitle }): HierarchyState {
  const { path } = data;

  // 添加顶级记录
  if (_.isEmpty(path)) {
    return update(state, {
      $push: [{ ...data, visible: true, display: true, children: [] }],
    });
  }

  const temp = _.cloneDeep(state);
  const node = _.get(temp, dealPath(path)) as HierarchyNode;
  return _.set(temp, dealPath(path), update(node, { children: { $push: [data.rowId] } }));
}

function removeHierarchyTempItem({
  state,
  data,
}: {
  state: HierarchyState;
  data: Pick<HierarchyTextTitle, 'rowId' | 'path'>;
}): HierarchyState {
  const { path } = data;

  // 如果是只有一个顶级记录 则直接清空
  if (state.length === 1 && _.isEmpty(state[0]!.children)) return [];

  if (_.isEmpty(path)) {
    const index = state.findIndex(item => item.rowId === data.rowId);
    return update(state, { $splice: [[index, 1]] });
  }

  const temp = _.cloneDeep(state);
  const node = _.get(temp, dealPath(path)) as HierarchyNode;
  return _.set(
    temp,
    dealPath(path),
    update(node, {
      children: {
        $apply: (item: HierarchyChild[]) => {
          return (item || []).filter(i => typeof i === 'object');
        },
      },
    }),
  );
}

// 更新层级记录状态树
export function hierarchyViewState(state: HierarchyState = [], action: HierarchyStateAction): HierarchyState {
  const { type, data } = action;

  switch (type) {
    // 初始化顶级记录
    case 'INIT_HIERARCHY_VIEW_STATE':
      return initState({ data });
    // 切换记录显隐
    case 'TOGGLE_HIERARCHY_VISIBLE':
      return updateHierarchyRecord({
        state,
        path: data.path,
        updater: { visible: data.visible || false },
      });
    // 展开指定记录的子记录
    case 'EXPAND_CHILDREN_STATE':
      return updateHierarchyRecord({
        state,
        path: data.path,
        updater: {
          visible: true,
          children: initState({
            data: data.data,
            path: data.path,
            pathId: data.pathId,
          }),
        },
      });
    // 更新记录的内容
    case 'UPDATE_HIERARCHY_CHILDREN':
      return updateHierarchyRecord({
        state,
        path: data.path,
        updater: {
          children: initState({
            data: data.data,
            path: data.path,
            pathId: data.pathId,
          }),
        },
      });
    // 展开指定层级的所有记录
    case 'EXPAND_HIERARCHY_VIEW_STATE':
      return expandedHierarchyView(data);
    // 添加子记录
    case 'ADD_HIERARCHY_CHILDREN_RECORD_STATE':
      return addChildrenRecordState({ state, ...data });
    // 分页未展开记录时，直接更新数量
    case 'ADD_RECORD_CHILDREN_WITH_ONLY_PAGINATION':
      return update(state, {
        [data.index]: {
          children: { $push: [data.rowId] },
        },
      });
    // 添加顶级记录
    case 'ADD_TOP_LEVEL_STATE':
      return addTopLevelRecordState({ state, data });
    case 'ADD_TOP_LEVEL_STATE_FROM_TEMP':
      const hasEmptyPath = _.findIndex(state || [], st => _.isEmpty(st.path)) > -1;
      const currentLength = hasEmptyPath ? state.length - 1 : state.length;
      return update(state, {
        $splice: [
          [
            currentLength,
            0,
            ...initState({
              data: [data],
              baseIndex: Math.max(0, currentLength),
              visible: true,
            }),
          ],
        ],
      });
    // 拖拽更新记录
    case 'MOVE_RECORD':
      return moveRecord({ state, ...data });
    // 拖拽更新多表关联记录
    case 'MULTI_RELATE_MOVE_RECORD':
      return multiRelateMoveRecord({ state, ...data });

    case 'ADD_TEXT_TITLE_RECORD':
      return addTextTitleRecord({ state, data });
    case 'REMOVE_HIERARCHY_TEMP_ITEM':
      return removeHierarchyTempItem({ state, data });
    case 'CHANGE_HIERARCHY_DATA_VISIBLE':
      return updateHierarchyVisible({ state, currentItem: data });
    default:
      return state;
  }
}

export function hierarchyViewData(state: HierarchyViewData = {}, action: HierarchyDataAction): HierarchyViewData {
  const { type, data } = action;

  switch (type) {
    case 'INIT_HIERARCHY_VIEW_DATA':
      return data;
    case 'CHANGE_HIERARCHY_VIEW_DATA':
    case 'UPDATE_HIERARCHY_VIEW_DATA':
      return { ...state, ...data };
    case 'ADD_HIERARCHY_CHILDREN_RECORD_STATE':
      return update(state, { $merge: { [data.data.rowid]: data.data } });
    case 'ADD_TEXT_TITLE_RECORD':
      return { ...state, [data.rowId]: { type: 'textTitle', ...data } };
    case 'REMOVE_HIERARCHY_TEMP_ITEM':
      return update(state, { $unset: [data.rowId] });
    case 'ADD_TOP_LEVEL_STATE':
      if (_.isArray(data)) {
        const newItems = data.reduce<HierarchyDataMap>((acc, item) => {
          acc[item.rowid] = item;
          return acc;
        }, {});
        return { ...state, ...newItems };
      } else {
        return { ...state, [data.rowid]: data };
      }

    case 'ADD_TOP_LEVEL_STATE_FROM_TEMP':
      return { ...state, [data.rowid]: data };
    default:
      return state;
  }
}

export function hierarchyDataStatus(
  state: HierarchyDataStatus = { loading: false, hasMoreData: true, pageIndex: 1, pageSize: 50 },
  action: HierarchyStatusAction,
): HierarchyDataStatus {
  const { type, data } = action;

  switch (type) {
    case 'CHANGE_HIERARCHY_DATA_STATUS':
      return { ...state, ...data };
    default:
      return state;
  }
}

export function hierarchyTopLevelDataCount(state = 0, action: HierarchyCountAction) {
  switch (action.type) {
    case 'CHANGE_HIERARCHY_TOP_LEVEL_DATA_COUNT':
      return action.count;
    default:
      return state;
  }
}

const addRelateControls = (
  state: HierarchyControlsMap,
  { ids, controls }: HierarchyControlsPayload,
): HierarchyControlsMap => {
  const newControls = ids.reduce<HierarchyControlsMap>((p, c, index: number) => {
    p[c] = controls[index];
    return p;
  }, {});
  return { ...state, ...newControls };
};

export function hierarchyRelateSheetControls(
  state: HierarchyControlsMap = {},
  action: HierarchyControlsAction,
): HierarchyControlsMap {
  const { type, payload = {} as HierarchyControlsPayload } = action;
  const { ids = [], controls = [] } = payload;

  switch (type) {
    case 'INIT_HIERARCHY_RELATE_SHEET_CONTROLS':
      return ids.reduce<HierarchyControlsMap>((p, c, index: number) => {
        p[c] = controls[index];
        return p;
      }, {});
    case 'ADD_HIERARCHY_RELATE_SHEET_CONTROLS':
      return addRelateControls(state, payload);
    default:
      return state;
  }
}

export function searchRecordId(state: string | null = null, action: HierarchySearchAction): string | null {
  switch (action.type) {
    case 'CHANGE_HIERARCHY_SEARCH_RECORD_ID':
      return action.data;
    default:
      return state;
  }
}

export function recordInfoId(state: string | null = null, action: HierarchyRecordInfoAction): string | null {
  switch (action.type) {
    case 'CHANGE_HIERARCHY_RECORD_INFO_ID':
      return action.data;
    default:
      return state;
  }
}
