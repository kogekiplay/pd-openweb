import { useCallback, useEffect, useRef, useState } from 'react';
import appSandboxAjax from 'src/components/AppSandbox/api';
import type { Request, SandboxApp } from 'src/components/AppSandbox/types';
import { objectValue } from 'src/components/AppSandbox/types';
import type { SandboxAppSettings } from 'src/utils/domain/app/sandbox';
import { buildSandboxEnableParams } from 'src/utils/domain/app/sandbox';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import { normalizeSandboxApps } from '../model/sandboxApp';

/** 模块内写操作共用的防重、取消和状态回收能力。 */
const useSandboxMutation = () => {
  const requestRef = useRef<Request<unknown> | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    return () => {
      const request = requestRef.current;

      requestRef.current = null;
      request?.abort?.();
    };
  }, []);

  const execute = useCallback(
    (
      createRequest: () => Request<{ code?: number | undefined }>,
      {
        isSuccess,
        getErrorMessage,
      }: {
        isSuccess: (result: { code?: number | undefined }) => boolean;
        getErrorMessage: (error?: unknown) => string;
      },
    ) => {
      if (requestRef.current) return Promise.resolve(false);

      const request = createRequest();
      if (!request) return Promise.resolve(false);

      requestRef.current = request;
      setPending(true);

      return request
        .then(result => {
          if (requestRef.current !== request) return false;

          const success = isSuccess(result);
          if (!success) alert(getErrorMessage(), 2);
          return success;
        })
        .catch(error => {
          if (requestRef.current !== request) return false;

          alertIfNotUnauthorized(error, getErrorMessage(error), 2);
          return false;
        })
        .finally(() => {
          if (requestRef.current !== request) return undefined;

          requestRef.current = null;
          setPending(false);

          return undefined;
        });
    },
    [],
  );

  return { pending, execute };
};

export const useSandboxApps = ({
  projectId,
  appIds,
  createAccountIds,
  order,
  pageIndex,
  pageSize,
  refreshKey = 0,
}: {
  projectId: string | undefined;
  appIds: string[];
  createAccountIds: string[];
  order: number;
  pageIndex: number;
  pageSize: number;
  refreshKey?: number | undefined;
}) => {
  const requestRef = useRef<Request<unknown> | null>(null);
  const [state, setState] = useState<{ queryKey: string; apps: SandboxApp[]; total: number }>({
    queryKey: '',
    apps: [],
    total: 0,
  });
  const appIdsKey = appIds.join(',');
  const createAccountIdsKey = createAccountIds.join(',');
  const queryKey = [projectId, appIdsKey, createAccountIdsKey, order, pageIndex, pageSize, refreshKey].join('|');

  useEffect(() => {
    if (!projectId) return undefined;

    requestRef.current?.abort?.();

    const request = appSandboxAjax.getSandboxApps(
      {
        projectId,
        appIds: appIdsKey ? appIdsKey.split(',') : [],
        createAccountIds: createAccountIdsKey ? createAccountIdsKey.split(',') : [],
        order,
        pageIndex,
        pageSize,
      },
      { silent: true },
    );

    requestRef.current = request;
    request
      .then(({ data = [], total = 0 }) => {
        if (requestRef.current !== request) return undefined;

        requestRef.current = null;
        setState({ queryKey, apps: normalizeSandboxApps(data), total });

        return undefined;
      })
      .catch(_requestError => {
        if (requestRef.current !== request) return undefined;

        requestRef.current = null;
        setState({ queryKey, apps: [], total: 0 });
        alertIfNotUnauthorized(_requestError, _l('获取沙盒应用失败，请稍后重试'), 2);

        return undefined;
      });

    return () => {
      if (requestRef.current !== request) return undefined;

      requestRef.current = null;
      request?.abort?.();

      return undefined;
    };
  }, [appIdsKey, createAccountIdsKey, order, pageIndex, pageSize, projectId, queryKey]);

  return { apps: state.apps, total: state.total, loading: Boolean(projectId) && state.queryKey !== queryKey };
};

/** 批量开启组织下的应用沙盒。 */
export const useBatchEnableSandboxApps = (projectId: string | undefined) => {
  const { pending: enabling, execute } = useSandboxMutation();

  const batchEnable = useCallback(
    (settingsList: SandboxAppSettings[]) => {
      if (!projectId) return Promise.resolve(false);

      return execute(
        () =>
          appSandboxAjax.batchEnable(
            { projectId, appConfigs: settingsList.map(buildSandboxEnableParams) },
            { silent: true },
          ),
        {
          isSuccess: result => result?.code === 1,
          getErrorMessage: () => _l('批量开启应用沙盒失败，请稍后重试'),
        },
      );
    },
    [execute, projectId],
  );

  return { enabling, batchEnable };
};

/** 批量关闭组织下已选择的应用沙盒。 */
export const useBatchDisableSandboxApps = (projectId: string | undefined) => {
  const { pending: disabling, execute } = useSandboxMutation();

  const batchDisable = useCallback(
    (appIds: string[]) => {
      if (!projectId || !appIds.length) return Promise.resolve(false);

      return execute(() => appSandboxAjax.batchDisable({ projectId, appIds }, { silent: true }), {
        isSuccess: result => result?.code === 1,
        getErrorMessage: error => String(objectValue(error)['errorMessage'] || _l('批量关闭应用沙盒失败，请稍后重试')),
      });
    },
    [execute, projectId],
  );

  return { disabling, batchDisable };
};
