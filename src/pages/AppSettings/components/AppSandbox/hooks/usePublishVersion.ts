import { useCallback, useEffect, useRef, useState } from 'react';
import appSandboxAjax from 'src/components/AppSandbox/api';
import type { Request, SandboxVersion } from 'src/components/AppSandbox/types';

/** 提交单应用版本，并保证同一时间最多存在一个发布请求。 */
export default function usePublishVersion({ appId, onSuccess }: { appId: string; onSuccess: () => void }) {
  const [publishing, setPublishing] = useState(false);
  const requestRef = useRef<Request<unknown> | null>(null);

  const publish = useCallback(
    (version: SandboxVersion) => {
      if (!version || requestRef.current) return undefined;

      const request = appSandboxAjax.publish(
        {
          appId,
          versionNo: version.version,
          description: (version.description || '').trim(),
          fileUrl: version.fileUrl || '',
        },
        { silent: true },
      );

      requestRef.current = request;
      setPublishing(true);

      return request
        .then(result => {
          if (requestRef.current !== request || !result) return undefined;

          onSuccess();

          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          if (requestRef.current !== request) return undefined;

          requestRef.current = null;
          setPublishing(false);

          return undefined;
        });
    },
    [appId, onSuccess],
  );

  useEffect(() => {
    return () => {
      const request = requestRef.current;

      requestRef.current = null;
      request?.abort?.();
    };
  }, []);

  return { publish, publishing };
}
