import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { Icon, LoadDiv } from 'ming-ui';
import { Button, Modal, Radio } from 'ming-ui/antd-components';
import { getCloseSandboxAppDescription } from 'src/components/AppSandbox/sandboxDescriptions';
import type { SandboxVersion } from 'src/components/AppSandbox/types';
import { SANDBOX_VERSION_DETAIL_MODE } from 'src/components/AppSandbox/version/constants';
import VersionDetailPage from 'src/components/AppSandbox/version/detail/VersionDetailPage';
import { isSandboxEnvironment, openPeerEnvironment } from 'src/utils/domain/app/sandbox';
import { ENVIRONMENT_CONFIG, OVERVIEW_DIALOG_TYPE, REVIEW_MODE, REVIEW_RULE_CONFIG } from '../constants';
import useOverview from '../hooks/useOverview';
import usePublishVersion from '../hooks/usePublishVersion';
import { createReleaseDraft } from '../version';

const getDisplayValue = (value: unknown) => String(value || '-');

const Card = styled.section`
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background-color: var(--color-background-primary);
`;

const EnvironmentCard = styled(Card)`
  padding: var(--space-8);
  flex-shrink: 0;
`;

const AppInfo = styled.div`
  display: flex;
  align-items: center;

  .appIcon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    background-color: var(--color-background-hover);
    color: var(--color-text-secondary);

    .Icon {
      font-size: 22px;
    }
  }

  .appContent {
    margin-left: 14px;
  }

  .appName {
    color: var(--color-text-primary);
    font-size: var(--font-xl);
    font-weight: 600;
  }

  .description {
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
  }
`;

const EnvironmentInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-6);

  .infoItem {
    min-width: 0;
    padding: var(--space-4);
    border-radius: 8px;
    background-color: var(--color-background-tertiary);
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    line-height: 20px;
  }

  .value {
    margin-top: var(--space-1);
    color: var(--color-text-primary);
    font-size: var(--font-sm);
    font-weight: 600;
    line-height: 20px;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-8);

  .productionAction {
    width: 140px;
  }

  .sandboxAction {
    width: 150px;
  }
`;

const ReviewRuleContent = styled.div`
  .reviewRuleOption {
    display: flex;
    align-items: center;
    width: 100%;
    height: 64px;
    padding: var(--space-2) var(--space-5);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    background-color: var(--color-background-primary);
    text-align: left;
    cursor: pointer;

    & + .reviewRuleOption {
      margin-top: var(--space-4);
    }

    .reviewRuleText {
      margin-left: 10px;
    }

    .title {
      color: var(--color-text-primary);
      font-size: var(--font-sm);
      font-weight: 600;
      line-height: 18px;
    }

    .description {
      margin-top: 1px;
      color: var(--color-text-tertiary);
      font-size: var(--font-xs);
      line-height: 17px;
    }
  }
`;

const DEFAULT_APP_NAME = _l('应用');

export default function Overview({
  appId,
  appName = DEFAULT_APP_NAME,
  latestVersionNo,
  publishDisabled,
  onChangeData,
  onVersionPublished,
}: {
  appId: string;
  appName?: string;
  latestVersionNo: string;
  publishDisabled: boolean;
  onChangeData: (value: { sandboxStatus: number; sandboxRecordId: string }) => void;
  onVersionPublished: () => void;
}) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [releaseDraft, setReleaseDraft] = useState<SandboxVersion | null>(null);
  const [selectedReviewRule, setSelectedReviewRule] = useState(REVIEW_MODE.ADMIN);
  const sandboxEnvironment = isSandboxEnvironment();
  const isReviewRuleDialog = activeDialog === OVERVIEW_DIALOG_TYPE.REVIEW_RULE;
  const handleDisabled = useCallback(() => {
    onChangeData({ sandboxStatus: 0, sandboxRecordId: '' });
  }, [onChangeData]);
  const { loading, reviewRule, summary, submitting, submit } = useOverview({
    appId,
    loadSummary: !sandboxEnvironment,
    onDisabled: handleDisabled,
  });
  const reviewRuleText = (REVIEW_RULE_CONFIG[reviewRule] || REVIEW_RULE_CONFIG[REVIEW_MODE.ADMIN])?.label || '';
  const environmentConfig = sandboxEnvironment ? ENVIRONMENT_CONFIG.SANDBOX : ENVIRONMENT_CONFIG.PRODUCTION;
  const handlePublishSuccess = useCallback(() => {
    setReleaseDraft(null);
    onVersionPublished();
  }, [onVersionPublished]);
  const { publish, publishing } = usePublishVersion({
    appId,
    onSuccess: handlePublishSuccess,
  });

  if (loading) {
    return (
      <EnvironmentCard>
        <LoadDiv className="mTop20" />
      </EnvironmentCard>
    );
  }

  const submitDialog = async () => {
    const success = await submit({
      type: activeDialog || '',
      reviewMode: selectedReviewRule,
    });

    if (success) setActiveDialog(null);
  };

  return (
    <>
      <EnvironmentCard>
        <AppInfo>
          <div className="appIcon">
            <Icon icon={environmentConfig.icon} />
          </div>
          <div className="appContent">
            <div className="appName">{appName}</div>
            <div className="description">{environmentConfig.description}</div>
          </div>
        </AppInfo>
        {!sandboxEnvironment && (
          <EnvironmentInfo>
            <div className="infoItem">
              <div className="label">{_l('当前运行版本')}</div>
              <div className="value">{getDisplayValue(summary.currentVersionNo)}</div>
            </div>
            <div className="infoItem">
              <div className="label">{_l('最近更新时间')}</div>
              <div className="value">{getDisplayValue(summary.upgradeTime)}</div>
            </div>
            <div className="infoItem">
              <div className="label">{_l('审核规则')}</div>
              <div className="value">{reviewRuleText}</div>
            </div>
          </EnvironmentInfo>
        )}

        <Actions>
          {sandboxEnvironment ? (
            <Button
              className="sandboxAction"
              color="var(--color-warning)"
              variant="solid"
              size="large"
              disabled={publishDisabled}
              icon={<Icon icon="arrow_forward" />}
              onClick={
                publishDisabled
                  ? undefined
                  : () => setReleaseDraft(createReleaseDraft({ minimumVersion: latestVersionNo }))
              }
            >
              {_l('发布新版本')}
            </Button>
          ) : (
            <>
              <Button
                className="productionAction"
                size="large"
                icon={<Icon icon="arrow_forward" />}
                onClick={() => openPeerEnvironment(`/app/${appId}`)}
              >
                {_l('访问沙盒')}
              </Button>
              <Button
                className="productionAction"
                size="large"
                icon={<Icon icon="assignment" />}
                onClick={() => {
                  setSelectedReviewRule(reviewRule);
                  setActiveDialog(OVERVIEW_DIALOG_TYPE.REVIEW_RULE);
                }}
              >
                {_l('设置审核规则')}
              </Button>
              <Button
                danger
                className="productionAction closeSandbox"
                size="large"
                icon={<Icon icon="cancel_line" />}
                onClick={() => setActiveDialog(OVERVIEW_DIALOG_TYPE.CLOSE)}
              >
                {_l('关闭沙盒')}
              </Button>
            </>
          )}
        </Actions>
      </EnvironmentCard>

      <Modal
        open={Boolean(activeDialog)}
        keyboard
        focusable={{ focusTriggerAfterClose: false }}
        width={isReviewRuleDialog ? 480 : 560}
        title={isReviewRuleDialog ? _l('审核规则') : _l('关闭沙盒')}
        cancelText={_l('取消')}
        okText={isReviewRuleDialog ? _l('确定') : _l('确认关闭')}
        confirmLoading={submitting}
        onOk={submitDialog}
        onCancel={() => {
          if (!submitting) setActiveDialog(null);
        }}
      >
        {isReviewRuleDialog ? (
          <ReviewRuleContent>
            {Object.values(REVIEW_RULE_CONFIG).map(item => (
              <button
                key={item.value}
                type="button"
                className="reviewRuleOption"
                onClick={() => setSelectedReviewRule(item.value)}
              >
                <Radio checked={selectedReviewRule === item.value} />
                <div className="reviewRuleText">
                  <div className="title">{item.label}</div>
                  <div className="description">{item.description}</div>
                </div>
              </button>
            ))}
          </ReviewRuleContent>
        ) : (
          <div className="textPrimary">{getCloseSandboxAppDescription()}</div>
        )}
      </Modal>
      {releaseDraft && (
        <VersionDetailPage
          open
          appId={appId}
          version={releaseDraft}
          mode={SANDBOX_VERSION_DETAIL_MODE.RELEASE}
          submitting={publishing}
          onClose={() => !publishing && setReleaseDraft(null)}
          onSubmit={publish}
        />
      )}
    </>
  );
}
