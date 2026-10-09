import { find } from 'lodash';
import _ from 'lodash';
import { APP_ROLE_TYPE } from 'src/pages/worksheet/constants/enum';
import type { WorksheetBase, WorksheetView } from 'src/pages/worksheet/types';
import type { FormControl } from 'src/utils/controlTypes';
import type { HierarchyChild, HierarchyNode } from '../reducers/hierarchyTypes';

export const dealData = <T extends { rowid: string }>(data: T[]): Record<string, T> => {
  const res: Record<string, T> = {};
  data.forEach(item => {
    res[item.rowid] = item;
  });
  return res;
};

export const getParaIds = (worksheet: { base: WorksheetBase }) => {
  const { appId, worksheetId, viewId } = _.get(worksheet, 'base');
  return { appId, worksheetId, viewId };
};

export const getCurrentView = (sheet: { base: WorksheetBase; views: WorksheetView[] }): WorksheetView => {
  const { base, views } = sheet;
  return find(views, item => item.viewId === base.viewId) || {};
};

export const getHierarchyViewIds = (
  worksheet: { base: WorksheetBase; views: WorksheetView[] },
  path: number[] = [],
) => {
  const { appId, worksheetId, viewId } = _.get(worksheet, 'base');
  const { childType, viewControls } = getCurrentView(worksheet);

  if (childType === 2 && path.length > 0) {
    const currentSheet = viewControls![path.length - 1]!;
    return { appId, worksheetId: currentSheet.worksheetId };
  }

  return { appId, worksheetId, viewId };
};

//当前角色是否具有管理员权限
export const isHaveCharge = (type?: number | string | null, isLock?: boolean) => {
  const { isAdmin, isOwner } = getUserRole(type, isLock);
  return !!isAdmin || !!isOwner;
};

//获取当前用户对应角色
export const getUserRole = (type?: number | string | null, isLock?: boolean) => {
  // 这条记录对当前用户开放哪些身份能力；isLock 为真时一律关掉
  let data: { isOwner?: boolean; isAdmin?: boolean; isDeveloper?: boolean; isRunner?: boolean } = {};

  if (type === APP_ROLE_TYPE.POSSESS_ROLE) {
    data.isOwner = !isLock;
  }

  if (type === APP_ROLE_TYPE.MAP_OWNER) {
    data.isOwner = true;
  }

  if (type === APP_ROLE_TYPE.ADMIN_ROLE) {
    data.isAdmin = !isLock;
  }

  if (type === APP_ROLE_TYPE.DEVELOPERS_ROLE) {
    data.isDeveloper = !isLock;
  }

  if (type === APP_ROLE_TYPE.RUNNER_ROLE) {
    data.isRunner = !isLock;
  }

  if (type === APP_ROLE_TYPE.RUNNER_DEVELOPERS_ROLE) {
    //即是开发者又是运营者
    data.isRunner = !isLock;
    data.isDeveloper = !isLock;
  }

  return data;
};

//可以编辑应用、拥有应用搭建权限(管理员，拥有者，开发者)
export const canEditApp = (type?: number | string | null, isLock?: boolean) => {
  const { isAdmin, isOwner, isDeveloper } = getUserRole(type, isLock);
  return !!isAdmin || !!isOwner || !!isDeveloper;
};

//可以管理应用下所有数据权限(管理员，拥有者，运营者)
export const canEditData = (type?: number | string | null) => {
  const { isAdmin, isOwner, isRunner } = getUserRole(type);
  return !!isAdmin || !!isOwner || !!isRunner;
};

export function wrapAjax<A extends unknown[], R extends { abort: () => void }>(func: (...args: A) => R) {
  const cache: Record<string, R | undefined> = {};

  return (...args: A): R => {
    if (cache[func.name]) {
      cache[func.name]!.abort();
    }

    cache[func.name] = func(...args);
    return cache[func.name]!;
  };
}

export function getItemByRowId(
  rowId: string | null = null,
  data: HierarchyChild[] = [],
): HierarchyNode | null | undefined {
  if (rowId) {
    const treeFind = (tree: HierarchyChild[]): HierarchyNode | null => {
      for (const item of tree) {
        if (item.rowId === rowId) return item as HierarchyNode;
        if (item.children && item.children.length > 0) {
          const res = treeFind(item.children);
          if (res) return res;
        }
      }

      return null;
    };

    return treeFind(data);
  }
  return undefined;
}

type CustomSortId = string | number;
function isCustomSortId(value: unknown): value is CustomSortId | undefined {
  return value === undefined || typeof value === 'string' || typeof value === 'number';
}
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
function decodeCustomSortItems(serialized: string | undefined): CustomSortId[] {
  const parsed: unknown = safeParse(serialized, 'array');
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string' || typeof item === 'number')) {
    throw new TypeError('Invalid worksheet custom sort items');
  }
  return parsed;
}
function decodeStructuredSortId(serialized: CustomSortId): CustomSortId | undefined {
  const parsed: unknown = safeParse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError('Invalid worksheet custom sort entity');
  const id = 'id' in parsed ? parsed.id : undefined;
  const accountId = 'accountId' in parsed ? parsed.accountId : undefined;
  if (!isCustomSortId(id)) throw new TypeError('Invalid worksheet custom sort id');
  if (!isCustomSortId(accountId)) throw new TypeError('Invalid worksheet custom sort account id');
  return id || accountId;
}

function decodeGroupControlId(serialized: string | undefined): string | undefined {
  const parsed: unknown = safeParse(serialized, 'array');
  const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
  if (!first || typeof first !== 'object' || Array.isArray(first))
    throw new TypeError('Invalid worksheet group settings');
  const id = 'controlId' in first ? first.controlId : undefined;
  if (!isOptionalString(id)) throw new TypeError('Invalid worksheet group control id');
  return id;
}

export interface SortableGroup {
  key?: string | number | undefined;
  sort?: number | undefined;
}
export function sortDataByCustomItems<T extends object>(
  data: T[],
  view: WorksheetView = {},
  controls: FormControl[] = [],
  firstNotSpecified = true,
) {
  let customItems = decodeCustomSortItems(_.get(view, 'advancedSetting.customitems'));

  if (_.get(view, 'advancedSetting.navshow') === '2') {
    customItems = decodeCustomSortItems(_.get(view, 'advancedSetting.navfilters'));
  }

  const viewControls = _.find(controls, c => c.controlId === view.viewControl);

  if (!_.isEmpty(customItems) && viewControls) {
    const sortIds = customItems.map(i => {
      const type = viewControls.type === 30 ? viewControls.sourceControlType : viewControls.type;

      if (_.includes([9, 10, 11, 28], type)) {
        return i;
      } else {
        return decodeStructuredSortId(i);
      }
    });
    const keyByOrder = new Map<string | number | undefined, number>(sortIds.map((t, i) => [t, i]));
    const sortOriginData = _.sortBy(data, 'sort');
    let sortData = _.sortBy(sortOriginData, o =>
      (o as SortableGroup).key === '-1' ? -999 : keyByOrder.get((o as SortableGroup).key),
    );

    // 未指定固定第一项
    if (!firstNotSpecified) {
      const [specialItems, regularItems] = _.partition(sortData, item => (item as SortableGroup).key === '-1');

      if (specialItems.length > 0) {
        sortData = [...regularItems, ...specialItems];
      }
    }

    return sortData.map((item, idx) => ({ ...item, sort: idx + 1 }));
  }

  return data;
}

//根据视图下的分组配置，处理视图呈现数据的顺序，以及是否呈现未分组数据
export function sortDataByGroupItems<T extends SortableGroup>(
  list: T[] = [],
  currentView: WorksheetView = {},
  controls: FormControl[] = [],
) {
  const sortedData = sortDataByCustomItems(
    list.sort((a, b) => {
      if (a.sort === -1) return 1;
      if (b.sort === -1) return -1;
      return a.sort! - b.sort!;
    }),
    {
      ...currentView,
      advancedSetting: {
        ...currentView.advancedSetting,
        customitems: _.get(currentView, 'advancedSetting.groupcustom'),
        navfilters: _.get(currentView, 'advancedSetting.groupfilters'),
        navshow: _.get(currentView, 'advancedSetting.groupshow'),
      },
      viewControl: decodeGroupControlId(_.get(currentView, 'advancedSetting.groupsetting')),
    },
    controls,
    false,
  );
  const nonNegativeOneItems = sortedData.filter(item => item.key !== '-1');

  if (_.get(currentView, 'advancedSetting.groupempty') !== '1') {
    return nonNegativeOneItems;
  }

  const negativeOneItems = sortedData.filter(item => item.key == '-1');
  // 将key为-1的项移到数组最后
  return [...nonNegativeOneItems, ...negativeOneItems];
}
