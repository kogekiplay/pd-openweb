import moment from 'moment';

/** 已销毁（过期）的专属算力实例状态；官方 3da 用同一个字面量。 */
const DESTROYED_COMPUTING_INSTANCE_STATUS = 8;

/** 历史工作流列表的一行：只声明本目录真实读到的字段。 */
export interface HistoryWorkflowItem {
  id: string;
  name: string;
  startAppType?: string | number | undefined;
  child?: boolean | undefined;
  app?: { id: string; name: string } | undefined;
  addedTime?: string | undefined;
  addedBy?: { accountId: string; avatar: string; fullName: string } | undefined;
}

/** 专属算力实例快照里本目录用到的字段。 */
export interface ComputingInstanceSnapshot {
  id?: string | undefined;
  name?: string | undefined;
  resourceId?: string | undefined;
  workflowCount?: number | undefined;
  expirationDatetime?: string | undefined;
  status?: number | undefined;
}

/** 历史工作流接口的原始响应（分页）。 */
export interface HistoryWorkflowResponse {
  instance?: ComputingInstanceSnapshot | undefined;
  workflows?: HistoryWorkflowItem[] | undefined;
  totalCount?: number | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
}

/** 规范化后的分页结果。 */
export interface HistoryWorkflowPage {
  instance?: ComputingInstanceSnapshot | undefined;
  list: HistoryWorkflowItem[];
  count: number;
  pageIndex: number;
  pageSize: number;
}

export interface HistoryWorkflowFilters {
  apkId?: string | undefined;
  workflowType?: string | number | undefined;
  search?: string | undefined;
  pageIndex?: number | undefined;
}

/** 历史工作流列表请求参数（与 api/project.getComputingInstanceHistoryWorkflows 的真实入参一致）。 */
export interface HistoryWorkflowRequestParams {
  projectId: string;
  id: string;
  appId: string;
  processListType: string | number;
  keyword: string;
  pageIndex: number;
  pageSize: number;
}

export type HistoryWorkflowRequest = (params: HistoryWorkflowRequestParams) => Promise<HistoryWorkflowResponse>;

/** 冲突检查接口返回的扁平行；这里只声明映射用到的字段。 */
export interface HistoryWorkflowConflictRow {
  id: string;
  name: string;
  resourceId: string;
  resourceName?: string | undefined;
  startAppType?: string | number | undefined;
  child?: boolean | undefined;
  app: { id: string; name: string };
}

/** 冲突弹层使用的一行：冲突资源 + 工作流自身信息。 */
export interface HistoryWorkflowConflict extends HistoryWorkflowConflictRow {
  process: { name: string; startAppType?: string | number | undefined; child?: boolean | undefined };
}

export interface HistoryConflictRequestParams {
  projectId: string;
  id: string;
  targetResourceId: string;
  workflowIds: string[];
}

export type HistoryConflictRequest = (params: HistoryConflictRequestParams) => Promise<HistoryWorkflowConflictRow[]>;

export interface HistoryWorkflowMoveIdsParams {
  workflowIds?: string[] | undefined;
  conflictIds?: string[] | undefined;
  checkedConflictIds?: string[] | undefined;
}

export const canViewComputingInstanceHistory = (status?: number | undefined): boolean =>
  status === DESTROYED_COMPUTING_INSTANCE_STATUS;

export const canManageComputingInstance = (status?: number | undefined): boolean =>
  status !== DESTROYED_COMPUTING_INSTANCE_STATUS;

export const canShowComputingInstanceHistory = (
  isHistoryMode: boolean,
  instance?: ComputingInstanceSnapshot | undefined,
): boolean => isHistoryMode && !!instance;

// 算力在到期日当天仍然有效，到期日结束后才进入过期状态。
export const isComputingInstanceExpired = (expirationDatetime?: string | undefined): boolean =>
  !!expirationDatetime && moment(expirationDatetime).add(1, 'd').isBefore();

// 真实 writer 用 moment.diff 算出 number（可能是 NaN）；参数按 number 标注，body 与上游逐字一致。
export const shouldShowComputingInstanceWorkflowCount = (remainingDays: number): boolean => !(remainingDays < 1);

// 真实 writer 是 ExplanList 的 listRequestIdRef = useRef(0) 递增计数器（number），不是字符串。
export const isLatestComputingInstanceRequest = (requestId?: number, latestRequestId?: number): boolean =>
  requestId === latestRequestId;

export const getComputingHistoryPath = ({ projectId, id }: { projectId: string; id: string }): string =>
  `/admin/computing/${projectId}/${id}?mode=history`;

export const isHistoryComputingRoute = (search?: string | undefined): boolean =>
  new URLSearchParams(search || '').get('mode') === 'history';

export const getHistoryWorkflowRequestParams = ({
  projectId,
  id,
  filters = {},
  pageSize,
}: {
  projectId: string;
  id: string;
  filters?: HistoryWorkflowFilters | undefined;
  pageSize: number;
}): HistoryWorkflowRequestParams => ({
  projectId,
  id,
  appId: filters.apkId || '',
  processListType: filters.workflowType || 0,
  keyword: filters.search || '',
  pageIndex: filters.pageIndex || 1,
  pageSize,
});

export const normalizeHistoryWorkflowResult = (
  result?: HistoryWorkflowResponse | undefined,
): HistoryWorkflowPage => {
  // 与原实现一致：先 result || {} 落成一个对象，再逐字段读，避免 optional chain 改变取值路径。
  const data: HistoryWorkflowResponse = result || {};

  return {
    instance: data.instance,
    list: Array.isArray(data.workflows) ? data.workflows : [],
    count: data.totalCount || 0,
    pageIndex: data.pageIndex || 1,
    pageSize: data.pageSize || 0,
  };
};

// 历史工作流接口有分页限制，迁移前需要加载全部页面并对工作流 ID 去重。
export const getAllHistoryWorkflowIds = async ({
  request,
  projectId,
  id,
  pageSize = 100,
}: {
  request: HistoryWorkflowRequest;
  projectId: string;
  id: string;
  pageSize?: number | undefined;
}): Promise<string[]> => {
  const getPage = (pageIndex: number): Promise<HistoryWorkflowPage> =>
    request(
      getHistoryWorkflowRequestParams({
        projectId,
        id,
        filters: { pageIndex },
        pageSize,
      }),
    ).then(normalizeHistoryWorkflowResult);
  const firstPage = await getPage(1);
  const pageCount = Math.ceil(firstPage.count / pageSize);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) => getPage(index + 2)),
  );

  return Array.from(
    new Set(
      [firstPage]
        .concat(remainingPages)
        .flatMap(page => page.list.filter(item => item && item.id).map(item => item.id)),
    ),
  );
};

// 冲突检查返回扁平字段，这里转换成共享冲突弹层使用的 process/name 结构。
export const checkHistoryWorkflowConflicts = ({
  request,
  projectId,
  id,
  targetResourceId,
  workflowIds,
}: {
  request: HistoryConflictRequest;
  projectId: string;
  id: string;
  targetResourceId: string;
  workflowIds: string[];
}): Promise<HistoryWorkflowConflict[]> =>
  request({
    projectId,
    id,
    targetResourceId,
    workflowIds,
  })
    .then(result => {
      if (!Array.isArray(result)) {
        throw new TypeError('Invalid history workflow conflict response');
      }

      return result.map(item => ({
        ...item,
        name: item.resourceName || item.resourceId,
        process: {
          name: item.name,
          startAppType: item.startAppType,
          child: item.child,
        },
      }));
    });

// 未冲突的工作流默认迁移；发生冲突的工作流只迁移用户在确认层里勾选的部分。
export const getHistoryWorkflowMoveIds = ({
  workflowIds = [],
  conflictIds = [],
  checkedConflictIds = [],
}: HistoryWorkflowMoveIdsParams): string[] => {
  const conflictIdSet = new Set(conflictIds);
  const checkedConflictIdSet = new Set(checkedConflictIds);

  return workflowIds.filter(id => !conflictIdSet.has(id) || checkedConflictIdSet.has(id));
};
