import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import appSandboxAjax from 'src/components/AppSandbox/api';
import type { Request, SandboxVersion } from 'src/components/AppSandbox/types';
import { VERSION_STATUS } from 'src/components/AppSandbox/version/constants';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import { normalizeReviewVersionResponse } from '../model/reviewVersion';

const UPGRADE_POLL_INTERVAL = 3000;

const hasUpgradingVersion = (versions: SandboxVersion[]) =>
  versions.some(version => version.status === VERSION_STATUS.PENDING_UPDATE && version.upgrading);

/**
 * 获取组织审核版本列表，并在当前页存在升级中版本时复用列表接口轮询。
 * 查询条件变化会生成新的 queryKey，旧请求即使晚返回也不会覆盖当前页。
 */
export default function useReviewVersions({
  enabled,
  projectId,
  appIds,
  createAccountIds,
  status,
  order,
  pageIndex,
  pageSize,
}: {
  enabled: boolean;
  projectId: string | undefined;
  appIds: string[];
  createAccountIds: string[];
  status: number | string;
  order: number;
  pageIndex: number;
  pageSize: number;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<{ queryKey: string; items: SandboxVersion[]; total: number }>({
    queryKey: '',
    items: [],
    total: 0,
  });
  const listRequestRef = useRef<Request<unknown> | null>(null);
  const appIdsKey = appIds.join(',');
  const createAccountIdsKey = createAccountIds.join(',');
  const queryKey = [
    enabled ? 1 : 0,
    projectId,
    appIdsKey,
    createAccountIdsKey,
    status,
    order,
    pageIndex,
    pageSize,
    refreshKey,
  ].join('|');
  const requestParams = useMemo(
    () => ({
      projectId,
      statuses: status === '' ? [] : [status],
      createAccountIds: createAccountIdsKey ? createAccountIdsKey.split(',') : [],
      appIds: appIdsKey ? appIdsKey.split(',') : [],
      order,
      pageIndex,
      pageSize,
    }),
    [appIdsKey, createAccountIdsKey, order, pageIndex, pageSize, projectId, status],
  );
  const currentState = state.queryKey === queryKey ? state : { queryKey, items: [], total: 0 };
  const loading = Boolean(enabled && projectId && state.queryKey !== queryKey);
  const polling = !loading && hasUpgradingVersion(currentState.items);
  const refresh = useCallback(() => setRefreshKey(current => current + 1), []);

  // 查询条件和刷新标识变化后获取当前页，清理阶段取消旧列表请求。
  useEffect(() => {
    if (!enabled || !projectId) return undefined;

    const request = appSandboxAjax.getByProjectId(requestParams, { silent: true });
    listRequestRef.current = request;

    request
      .then(result => {
        if (listRequestRef.current !== request) return undefined;

        const { items, total } = normalizeReviewVersionResponse(result);

        listRequestRef.current = null;
        setState({ queryKey, items, total });

        return undefined;
      })
      .catch(_requestError => {
        if (listRequestRef.current !== request) return undefined;

        listRequestRef.current = null;
        setState({ queryKey, items: [], total: 0 });
        alertIfNotUnauthorized(_requestError, _l('获取审核与升级列表失败，请稍后重试'), 2);

        return undefined;
      });

    return () => {
      if (listRequestRef.current !== request) return undefined;

      listRequestRef.current = null;
      request?.abort?.();

      return undefined;
    };
  }, [enabled, projectId, queryKey, requestParams]);

  // 仅轮询当前 queryKey 对应的页面；完成、切换条件或卸载时统一关闭定时器和请求。
  useEffect(() => {
    if (!enabled || !projectId || !polling) return undefined;

    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let request: ReturnType<typeof appSandboxAjax.getByProjectId> | null = null;

    const scheduleNext = () => {
      if (canceled) return undefined;

      timer = setTimeout(pollCurrentPage, UPGRADE_POLL_INTERVAL);

      return undefined;
    };

    const pollCurrentPage = () => {
      if (canceled || request) return undefined;

      request = appSandboxAjax.getByProjectId(requestParams, { silent: true });
      const currentRequest = request;

      currentRequest
        .then(result => {
          if (canceled || request !== currentRequest) return undefined;

          const { items: nextItems, total } = normalizeReviewVersionResponse(result);

          setState({ queryKey, items: nextItems, total });
          if (hasUpgradingVersion(nextItems)) scheduleNext();

          return undefined;
        })
        .catch(scheduleNext)
        .finally(() => {
          if (request === currentRequest) request = null;
        });

      return undefined;
    };

    scheduleNext();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
      request?.abort?.();
      timer = null;
      request = null;
    };
  }, [enabled, polling, projectId, queryKey, requestParams]);

  return {
    items: currentState.items,
    total: currentState.total,
    loading,
    refresh,
  };
}
