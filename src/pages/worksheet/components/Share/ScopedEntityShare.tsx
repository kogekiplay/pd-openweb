import { useEffect, useRef, useState } from 'react';
import copy from 'copy-to-clipboard';
import { Button, Input, Modal, Radio, Select, Switch } from 'ming-ui/antd-components';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import { getPublicShare, SHARE_SCOPE, updatePublicShareStatus } from './controller';
import type { ScopedShareProps, ShareResult } from './types';
import Validity from './Validity';

/** Scope changes create the agent entity before registering its source id in the main-site share registry. */
export default function ScopedEntityShare({
  from,
  title,
  params = {},
  onClose,
  isCharge = true,
  supportProjectScope = false,
  autoEnable = false,
}: ScopedShareProps) {
  const [share, setShare] = useState<ShareResult>({});
  const [scope, setScope] = useState(SHARE_SCOPE.PUBLIC);
  const [projectId, setProjectId] = useState(params.projectId || localStorage.getItem('currentProjectId') || '');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const alive = useRef(true);
  const projects = md.global.Account.projects as Array<{ projectId: string; companyName: string }>;
  const enabled = Boolean(share.shareLink);

  useEffect(() => {
    alive.current = true;
    getPublicShare({ from, ...params })
      .then(async current => {
        if (!alive.current) return;
        setShare(current);
        setScope(current.scope ?? SHARE_SCOPE.PUBLIC);
        if (autoEnable && !current.shareLink) await changeShare(true, current.scope ?? SHARE_SCOPE.PUBLIC);
      })
      .catch((error: unknown) => alertIfNotUnauthorized(error, _l('获取分享失败'), 2))
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  async function changeShare(
    nextEnabled: boolean,
    nextScope = scope,
    changes: Partial<ShareResult> = {},
  ): Promise<void> {
    if (lock.current || !isCharge) return;
    if (nextEnabled && nextScope === SHARE_SCOPE.PROJECT && !projectId) {
      alert(_l('请选择组织'), 3);
      return;
    }
    lock.current = true;
    setPending(true);
    try {
      const result = await updatePublicShareStatus({
        from,
        ...params,
        ...changes,
        isPublic: nextEnabled,
        scope: supportProjectScope ? nextScope : undefined,
        projectId,
        sourceId: share.sourceId || params.sourceId,
        reuseShareSource: enabled && nextScope === scope,
        pageTitle: changes.pageTitle || share.pageTitle || params.title,
      });
      if (!alive.current) return;
      const entity = result.appEntityShare || result;
      setShare({
        ...entity,
        sourceId: result.shareSourceId || entity.sourceId || share.sourceId || params.sourceId,
        shareLink: nextEnabled ? result.shareLink : undefined,
      });
      setScope(nextScope);
    } catch (error) {
      if (alive.current) alertIfNotUnauthorized(error, _l('分享失败'), 2);
    } finally {
      lock.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <Modal open title={title || _l('分享对话')} width={640} footer={null} onCancel={() => onClose?.()}>
      <div className="flexRow alignItemsCenter mBottom20">
        <span className="flex Font15 Bold">{_l('开启分享')}</span>
        <Switch
          disabled={loading || pending || !isCharge}
          checked={enabled}
          onChange={checked => {
            void changeShare(checked);
          }}
        />
      </div>
      {supportProjectScope && (
        <>
          <Radio.Group
            value={scope}
            disabled={pending || !isCharge}
            onChange={event => {
              const nextScope = Number(event.target.value);
              if (enabled) void changeShare(true, nextScope);
              else setScope(nextScope);
            }}
            options={[
              { label: _l('获得链接的所有人'), value: SHARE_SCOPE.PUBLIC },
              { label: _l('仅本网络内成员'), value: SHARE_SCOPE.PROJECT },
            ]}
          />
          {scope === SHARE_SCOPE.PROJECT && (
            <Select
              className="w100 mTop15"
              value={projectId}
              disabled={enabled || pending}
              options={projects.map(project => ({ value: project.projectId, label: project.companyName }))}
              onChange={setProjectId}
            />
          )}
        </>
      )}
      {enabled && (
        <>
          <div className="flexRow mTop20">
            <Input readOnly value={share.shareLink || ''} />
            <Button
              className="mLeft10"
              onClick={() => {
                copy(share.shareLink || '');
                alert(_l('链接已复制'));
              }}
            >
              {_l('复制')}
            </Button>
          </div>
          <Input
            className="mTop15"
            value={share.pageTitle || ''}
            maxLength={200}
            placeholder={_l('分享标题')}
            disabled={pending || !isCharge}
            onChange={event => setShare(current => ({ ...current, pageTitle: event.target.value }))}
            onBlur={() => {
              void changeShare(true, scope, { pageTitle: share.pageTitle });
            }}
          />
          <Validity
            data={share}
            onChange={(changes: ShareResult) => {
              void changeShare(true, scope, changes);
            }}
          />
        </>
      )}
    </Modal>
  );
}
