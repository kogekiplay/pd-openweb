import { useCallback, useEffect, useRef, useState } from 'react';
import appSandboxAjax from 'src/components/AppSandbox/api';
import type { SandboxVersion } from 'src/components/AppSandbox/types';
import { SANDBOX_LIST_ORDER } from 'src/utils/domain/app/sandbox';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import { VERSION_LIST_PAGE_SIZE } from '../constants';

const noop = () => {};

const UPGRADE_POLL_INTERVAL = 3000;

/** 分页加载当前应用的版本，并保留接口原始字段供列表和详情使用。 */
export default function useVersions({
  appId,
  onChange = noop,
}: {
  appId: string;
  onChange?: (versions: SandboxVersion[]) => void;
}) {
  const [versions, setVersions] = useState<SandboxVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const versionsRef = useRef<SandboxVersion[]>([]);
  const loadingRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const upgradingVersionId = versions[0]?.upgrading ? versions[0].versionId : undefined;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** 同步列表及其外部派生状态。 */
  const updateVersions = useCallback((nextVersions: SandboxVersion[]) => {
    versionsRef.current = nextVersions;
    setVersions(nextVersions);
    onChangeRef.current(nextVersions);
  }, []);

  const updateVersionPollingStatus = useCallback(
    (versionId: string, { upgrading, status }: Partial<SandboxVersion>) => {
      const nextVersions = versionsRef.current.map(version =>
        version.versionId === versionId
          ? { ...version, upgrading: Boolean(upgrading), status: status ?? version.status }
          : version,
      );

      updateVersions(nextVersions);
    },
    [updateVersions],
  );
  const refresh = useCallback(() => {
    versionsRef.current = [];
    loadingRef.current = true;
    setVersions([]);
    setTotal(0);
    setLoadFailed(false);
    setLoading(true);
    setPageIndex(1);
    setRefreshKey(current => current + 1);
  }, []);
  const loadMore = useCallback(() => {
    if (loadingRef.current || (!loadFailed && versionsRef.current.length >= total)) return undefined;

    loadingRef.current = true;
    setLoading(true);
    if (loadFailed) {
      setLoadFailed(false);
      setRefreshKey(current => current + 1);
      return undefined;
    }

    setPageIndex(current => current + 1);

    return undefined;
  }, [loadFailed, total]);

  useEffect(() => {
    let canceled = false;
    const request = appSandboxAjax.getByAppId(
      {
        appId,
        statuses: [],
        createAccountIds: [],
        order: SANDBOX_LIST_ORDER.DESC,
        pageIndex,
        pageSize: VERSION_LIST_PAGE_SIZE,
      },
      { silent: true },
    );

    request
      .then(result => {
        if (canceled) return undefined;

        const pageVersions = result?.data || [];
        const loadedVersions = pageIndex === 1 ? [] : versionsRef.current;
        const versionMap = new Map(loadedVersions.map(version => [version.versionId, version]));

        pageVersions.forEach(version => versionMap.set(version.versionId, version));
        const nextVersions = [...versionMap.values()];

        updateVersions(nextVersions);
        setTotal(result?.total || 0);
        setLoadFailed(false);
        loadingRef.current = false;
        setLoading(false);

        return undefined;
      })
      .catch(_requestError => {
        if (canceled) return undefined;

        loadingRef.current = false;
        setLoading(false);
        setLoadFailed(true);
        alertIfNotUnauthorized(_requestError, _l('获取沙盒版本失败，请稍后重试'), 2);

        return undefined;
      });

    return () => {
      canceled = true;
      request?.abort?.();
    };
  }, [appId, pageIndex, refreshKey, updateVersions]);

  // GetByAppId 标记升级中的版本后，按版本轮询 Get，仅同步该行的 upgrading 和 status 字段。
  useEffect(() => {
    if (!upgradingVersionId) return undefined;

    let canceled = false;
    let request: ReturnType<typeof appSandboxAjax.get> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (canceled) return undefined;

      timer = setTimeout(pollVersion, UPGRADE_POLL_INTERVAL);

      return undefined;
    };

    const pollVersion = () => {
      if (canceled || request) return undefined;

      request = appSandboxAjax.get({ versionId: upgradingVersionId }, { silent: true });

      const currentRequest = request;

      currentRequest
        .then(result => {
          if (canceled || request !== currentRequest) return undefined;

          const nextVersion = result?.data || result;

          if (!nextVersion?.versionId) {
            scheduleNext();
            return undefined;
          }

          updateVersionPollingStatus(upgradingVersionId, nextVersion);
          if (nextVersion.upgrading) {
            scheduleNext();
          }

          return undefined;
        })
        .catch(scheduleNext)
        .finally(() => {
          if (request === currentRequest) {
            request = null;
          }
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
  }, [updateVersionPollingStatus, upgradingVersionId]);

  return {
    versions,
    loading,
    loadMore,
    refresh,
  };
}
