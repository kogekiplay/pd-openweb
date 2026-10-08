import { useEffect, useState } from 'react';
import appSandboxAjax from 'src/components/AppSandbox/api';
import type { ChangeSections, DetailResult, SnapshotDetail } from 'src/components/AppSandbox/types';
import { isSandboxEnvironment } from 'src/utils/domain/app/sandbox';
import { normalizePageContrastDetail } from '../model/pageContrast';
import { normalizeProcessContrastDetail } from '../model/processContrast';

interface CacheEntry {
  data?: ChangeSections;
  promise?: Promise<ChangeSections>;
}
const EMPTY_RESULT: DetailResult<ChangeSections> = { requestKey: '', data: null, error: null };

/** A failed snapshot is evicted so reopening the resource can retry. Successful and pending snapshots are shared. */
export default function useSnapshotContrastDetail({
  type,
  appId,
  contrastId,
  resourceId,
  enabled,
}: {
  type: 'page' | 'process';
  appId: string;
  contrastId: string | undefined;
  resourceId: string | undefined;
  enabled: boolean;
}) {
  const [snapshotCache] = useState(() => new Map<string, CacheEntry>());
  const requestKey = appId && contrastId && resourceId ? `${type}:${appId}:${contrastId}:${resourceId}` : '';
  const [result, setResult] = useState(EMPTY_RESULT);
  const currentResult = result.requestKey === requestKey ? result : EMPTY_RESULT;
  const loading = Boolean(enabled && requestKey && result.requestKey !== requestKey);

  useEffect(() => {
    if (!enabled || !requestKey) return undefined;
    let canceled = false;
    const errorMessage =
      type === 'page' ? _l('获取自定义页面变更详情失败，请稍后重试') : _l('获取工作流变更详情失败，请稍后重试');
    const cached = snapshotCache.get(requestKey);
    const promise =
      cached?.promise ||
      (cached?.data
        ? Promise.resolve(cached.data)
        : (type === 'page'
            ? appSandboxAjax.getPageCompare({ appId, pageId: resourceId, contrastId }, { silent: true })
            : appSandboxAjax.getProcessCompare({ appId, processId: resourceId, contrastId }, { silent: true })
          )
            .then(response => {
              const detail: SnapshotDetail =
                response.data && typeof response.data === 'object' ? response.data : response;
              if (!detail.data && !detail.originalData) throw new Error(errorMessage);
              const options = { reverse: !isSandboxEnvironment() };
              const data =
                type === 'page'
                  ? normalizePageContrastDetail(detail, options)
                  : normalizeProcessContrastDetail(detail, options);
              snapshotCache.set(requestKey, { data });
              return data;
            })
            .catch((error: unknown) => {
              snapshotCache.delete(requestKey);
              throw error;
            }));
    if (!cached) snapshotCache.set(requestKey, { promise });
    promise
      .then(data => {
        if (!canceled) setResult({ requestKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (!canceled) setResult({ requestKey, data: null, error });
      });
    return () => {
      canceled = true;
    };
  }, [appId, contrastId, enabled, requestKey, resourceId, snapshotCache, type]);
  return { data: currentResult.data, error: currentResult.error, loading };
}
