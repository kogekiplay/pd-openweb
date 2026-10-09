import _ from 'lodash';
import type {
  HierarchyChild,
  HierarchyPath,
  HierarchyPropertyPath,
  HierarchyRecord,
  HierarchyState,
} from './hierarchyTypes';

// 获取完整路径
export const dealPath = (path: HierarchyPath): HierarchyPropertyPath => {
  const wholePath = path.reduce<HierarchyPropertyPath>((p, c) => p.concat([c, 'children']), []);
  wholePath.pop();
  return wholePath;
};

// 处理children为数组形式
export const dealChildren = (children: string | HierarchyChild[] | null | undefined): HierarchyChild[] => {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  if (typeof children === 'string') {
    try {
      return JSON.parse(children) as HierarchyChild[];
    } catch (error) {
      console.log(error);
    }
  }

  return [];
};

// 初始化状态树
export const initState = ({
  data,
  path = [],
  pathId = [],
  baseIndex = 0,
  visible = false,
}: {
  data?: HierarchyRecord | HierarchyRecord[] | null | undefined;
  path?: HierarchyPath | undefined;
  pathId?: string[] | undefined;
  baseIndex?: number | undefined;
  visible?: boolean | undefined;
}): HierarchyState => {
  baseIndex = baseIndex < 0 ? 0 : baseIndex;
  if (!data || !_.isArray(data) || _.isEmpty(data)) return [];
  return data.map((item, index) => ({
    rowId: item.rowid,
    visible,
    display: true,
    path: path.concat([baseIndex + index]),
    pathId: pathId.concat([item.rowid]),
    children: dealChildren(item.childrenids),
  }));
};
