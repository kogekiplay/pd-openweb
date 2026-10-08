import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { Select } from 'ming-ui/antd-components';
import type { SandboxAccount } from 'src/components/AppSandbox/types';
import VersionActionButton, {
  VERSION_ACTION_BUTTON_VARIANT,
} from 'src/components/AppSandbox/version/components/VersionActionButton';
import {
  getVersionActionLabel,
  getVersionActions,
  getVersionStatusOptions,
  VERSION_ACTION,
  VERSION_ACTION_SCENE,
  VERSION_DETAIL_FROM,
} from 'src/components/AppSandbox/version/constants';
import SelectApp from 'src/pages/Admin/components/SelectApp';
import SelectUser from 'src/pages/Admin/components/SelectUser';

const ToolbarWrap = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: 36px;

  .appSelect,
  .applicantSelect {
    width: 180px;
  }

  .statusSelect {
    width: 120px;
  }
`;

const BatchActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
`;

const SelectedCount = styled.span`
  margin-right: var(--space-2);
  color: var(--color-text-primary);

  .count {
    color: var(--color-primary);
  }
`;

export default function Toolbar({
  projectId,
  appId,
  applicants,
  status,
  selectedStatus,
  selectedCount,
  canBatchAction,
  onAppChange,
  onApplicantsChange,
  onStatusChange,
  onApprove,
  onReject,
  onUpgrade,
}: {
  projectId: string;
  appId: string;
  applicants: SandboxAccount[];
  status: number | string;
  selectedStatus: number | undefined;
  selectedCount: number;
  canBatchAction: boolean;
  onAppChange: (id: string) => void;
  onApplicantsChange: (accounts: SandboxAccount[]) => void;
  onStatusChange: (status: number | string) => void;
  onApprove: () => void;
  onReject: () => void;
  onUpgrade: () => void;
}) {
  const statusOptions = [{ value: '', label: _l('全部状态') }, ...getVersionStatusOptions()];
  const batchActions = getVersionActions({
    from: VERSION_DETAIL_FROM.ORGANIZATION_MANAGEMENT,
    status: selectedStatus ?? -1,
    scene: VERSION_ACTION_SCENE.LIST,
  });
  const actionHandlers = {
    [VERSION_ACTION.APPROVE]: onApprove,
    [VERSION_ACTION.REJECT]: onReject,
    [VERSION_ACTION.UPGRADE]: onUpgrade,
  };

  return (
    <ToolbarWrap>
      <SelectApp className="appSelect" projectId={projectId} value={appId} onChange={onAppChange} />
      <SelectUser
        className="applicantSelect"
        projectId={projectId}
        userInfo={applicants}
        placeholder={_l('搜索')}
        isAdmin
        changeData={onApplicantsChange}
      />
      <Select
        className="mdAntSelect statusSelect"
        value={status}
        options={statusOptions}
        suffixIcon={<Icon icon="arrow-down-border Font14" />}
        onChange={onStatusChange}
      />
      {Boolean(batchActions.length) && (
        <BatchActions>
          <SelectedCount>
            {_l('已选择')}&nbsp;<span className="count">{selectedCount}</span>&nbsp;{_l('项')}
          </SelectedCount>
          {batchActions.map(action => (
            <VersionActionButton
              key={action}
              action={action}
              variant={VERSION_ACTION_BUTTON_VARIANT.PILL}
              disabled={!canBatchAction}
              onClick={actionHandlers[action]}
            >
              {getVersionActionLabel(action)}
            </VersionActionButton>
          ))}
        </BatchActions>
      )}
    </ToolbarWrap>
  );
}
