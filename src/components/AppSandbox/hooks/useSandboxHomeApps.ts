import { useEffect, useState } from 'react';
import homeAppAjax from 'src/api/homeApp';
import type { SandboxApp } from 'src/components/AppSandbox/types';

const EMPTY_APPS: SandboxApp[] = [];

/** 加载当前组织在沙盒首页可访问的应用，并隔离组织切换期间的过期响应。 */
export const useSandboxHomeApps = (projectId: string | undefined) => {
  const [appsState, setAppsState] = useState<{ projectId: string | undefined; apps: SandboxApp[] }>({
    projectId: undefined,
    apps: EMPTY_APPS,
  });
  const isCurrentProject = appsState.projectId === projectId;

  useEffect(() => {
    if (!projectId) return undefined;

    let active = true;
    const request = homeAppAjax.getMyApp({ projectId, containsLinks: true });

    Promise.resolve(request).then(
      data => {
        if (active)
          setAppsState({
            projectId,
            apps: (data?.apps || []).map(app => ({
              ...app,
              appId: app.id,
              appName: app.name,
              name: app.name || '',
            })) as SandboxApp[],
          });
      },
      () => {
        if (active) setAppsState({ projectId, apps: EMPTY_APPS });
      },
    );

    return () => {
      active = false;
      request?.abort?.();
    };
  }, [projectId]);

  return {
    apps: isCurrentProject ? appsState.apps : EMPTY_APPS,
    loading: Boolean(projectId) && !isCurrentProject,
  };
};
