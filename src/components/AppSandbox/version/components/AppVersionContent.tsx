import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { Collapse } from 'ming-ui/antd-components';
import type { SandboxVersion } from 'src/components/AppSandbox/types';
import { SANDBOX_VERSION_DETAIL_MODE, VERSION_STATUS } from '../constants';
import ChangeDetailPanel from '../contrast/components/ChangeDetailPanel';
import { getVersionChangeGroups } from '../contrast/model/changeSummary';
import { isVersionComplete, normalizeVersion } from '../versionNumber';
import VersionNumber from './VersionNumber';
import VersionStatus from './VersionStatus';

const AppVersionContentWrap = styled.div`
  min-width: 0;
  flex: 1;
`;

const SectionCollapse = styled(Collapse)`
  &.hap-collapse {
    background-color: var(--color-background-primary) !important;
  }

  > .hap-collapse-item {
    > .hap-collapse-header {
      align-items: center;
      color: var(--color-text-primary) !important;
      font-size: 15px !important;
    }
  }
`;

const ExpandIcon = styled(Icon)`
  display: inline-block;
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  transform: rotate(${({ $isActive }) => ($isActive ? 90 : 0)}deg);
  transition: transform 0.2s;
`;

const FormContent = styled.div`
  padding: 0 var(--space-5);
`;

const FormLabel = styled.div`
  margin-bottom: 10px;
  color: var(--color-text-primary);
  font-size: var(--font-sm);
  font-weight: 500;
  line-height: 20px;

  &.required::before {
    margin-right: 2px;
    color: var(--color-error);
    content: '*';
  }
`;

const EmptyChanges = styled.div`
  padding: var(--space-6) 0;
  color: var(--color-text-tertiary);
  text-align: center;
`;

const VersionField = styled.div`
  margin-bottom: var(--space-5);
`;

const SectionTitle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const ApprovalInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-6);
  padding: var(--space-5) var(--space-6);
  border-radius: 4px;
  background-color: var(--color-background-secondary);
`;

const ApprovalInfoGroup = styled.div`
  display: flex;
  margin-bottom: var(--space-5);
  flex-direction: column;
  gap: 10px;
`;

const RejectReason = styled.div`
  display: flex;
  padding: 10px var(--space-3);
  border-left: 2px solid var(--color-error);
  border-radius: 4px;
  background-color: var(--color-error-bg);
  color: var(--color-text-primary);
  font-size: var(--font-sm);
  line-height: 20px;
  align-items: flex-start;

  .label {
    margin-right: var(--space-3);
    color: var(--color-error);
    flex-shrink: 0;
  }

  .reason {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

const ApprovalInfoItem = styled.div`
  min-width: 0;

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    line-height: 20px;
  }

  .value {
    margin-top: 10px;
    overflow: hidden;
    color: var(--color-text-primary);
    font-size: var(--font-md);
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ReleaseDescriptionInput = styled.textarea`
  width: 100%;
  min-height: 140px;
  padding: 10px var(--space-3);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 4px;
  box-sizing: border-box;
  background-color: var(--color-background-input);
  color: var(--color-text-primary);
  font-size: var(--font-sm);
  line-height: 20px;
  resize: none;

  &:not(:disabled):hover {
    border-color: var(--color-text-disabled);
  }

  &:not(:disabled):focus {
    border-color: var(--color-primary);
  }

  &:disabled {
    border-color: transparent;
    background-color: var(--color-background-secondary);
    color: var(--color-text-secondary);
    cursor: not-allowed;
  }
`;

const renderExpandIcon = ({ isActive }: { isActive: boolean }) => (
  <ExpandIcon icon="arrow-right" $isActive={isActive} />
);

const noop = () => {};

export default function AppVersionContent({
  appId,
  version,
  mode = SANDBOX_VERSION_DETAIL_MODE.VIEW,
  onVersionChange = noop,
  onDescriptionChange = noop,
}: {
  appId: string;
  version: SandboxVersion;
  mode?: string;
  onVersionChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
}) {
  const isRelease = mode === SANDBOX_VERSION_DETAIL_MODE.RELEASE;
  // 发布草稿使用可编辑的 version，历史版本使用后端定义的 versionNo。
  const versionNumber = isRelease ? version.version : version.versionNo;
  const minimumVersionTip =
    isRelease && isVersionComplete(version.minimumVersion)
      ? _l('版本号必须大于：%0', normalizeVersion(version.minimumVersion))
      : null;
  const creator = version.creator;
  const reviewer = version.reviewer;
  const approvalInfo = [
    { label: _l('申请者'), value: creator?.fullname || creator?.fullName || '—' },
    { label: _l('申请时间'), value: version.createTime || '—' },
    { label: _l('审核者'), value: reviewer?.fullname || reviewer?.fullName || '—' },
    { label: _l('审核时间'), value: version.reviewTime || '—' },
  ];
  const changeGroups = getVersionChangeGroups(version);
  const versionInfoItems = [
    {
      key: 'versionInfo',
      label: (
        <SectionTitle>
          <span className="Bold">{_l('版本信息')}</span>
          {!isRelease && version.status !== undefined && version.status !== null && (
            <VersionStatus status={version.status} remark={version.remark} showRejectReasonIcon={false} />
          )}
        </SectionTitle>
      ),
      children: (
        <FormContent>
          <FormLabel className="required">{_l('版本号')}</FormLabel>
          <VersionField>
            <VersionNumber
              value={versionNumber || ''}
              disabled={!isRelease}
              minimumVersion={version.minimumVersion}
              tip={minimumVersionTip}
              onChange={onVersionChange}
            />
          </VersionField>
          {!isRelease && (
            <ApprovalInfoGroup>
              <ApprovalInfo>
                {approvalInfo.map(item => (
                  <ApprovalInfoItem key={item.label} title={item.value}>
                    <div className="label">{item.label}</div>
                    <div className="value">{item.value}</div>
                  </ApprovalInfoItem>
                ))}
              </ApprovalInfo>
              {version.status === VERSION_STATUS.REJECTED && (
                <RejectReason>
                  <span className="label">{_l('驳回原因：')}</span>
                  <span className="reason">{version.remark || _l('暂无驳回原因')}</span>
                </RejectReason>
              )}
            </ApprovalInfoGroup>
          )}
          <FormLabel className="required">{_l('发布说明')}</FormLabel>
          <ReleaseDescriptionInput
            value={version.description || ''}
            disabled={!isRelease}
            maxLength={500}
            rows={6}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(event.target.value)}
          />
        </FormContent>
      ),
    },
  ];
  const changeDetailItems = [
    {
      key: 'changeDetails',
      label: <span className="Bold">{_l('变更详情')}</span>,
      children: (
        <FormContent>
          {changeGroups.length ? (
            <ChangeDetailPanel
              key={version.contrastId}
              appId={appId}
              contrastId={version.contrastId}
              groups={changeGroups}
            />
          ) : (
            <EmptyChanges>{_l('暂无变更')}</EmptyChanges>
          )}
        </FormContent>
      ),
    },
  ];

  return (
    <AppVersionContentWrap>
      <SectionCollapse
        bordered={false}
        defaultActiveKey="versionInfo"
        expandIcon={renderExpandIcon}
        items={versionInfoItems}
      />

      <SectionCollapse
        bordered={false}
        defaultActiveKey="changeDetails"
        expandIcon={renderExpandIcon}
        items={changeDetailItems}
      />
    </AppVersionContentWrap>
  );
}
