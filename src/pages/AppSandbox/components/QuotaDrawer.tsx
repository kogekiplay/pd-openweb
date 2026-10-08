import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';
import { Drawer, Progress } from 'ming-ui/antd-components';
import type { SandboxQuota } from 'src/components/AppSandbox/types';
import { getSandboxQuotas } from '../core/quota';

const DRAWER_STYLES = { body: { padding: 'var(--space-5) var(--space-6)' } };

const Description = styled.div`
  margin-bottom: 28px;
  padding: 14px var(--space-3);
  border-radius: 6px;
  background: var(--color-background-secondary);
`;

const DescriptionTitle = styled.div`
  color: var(--color-text-primary);
  font-size: var(--font-md);
  font-weight: 600;
  line-height: 20px;
`;

const DescriptionText = styled.div`
  margin-top: var(--space-1);
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  line-height: 18px;
`;

const QuotaItem = styled.div`
  & + & {
    margin-top: var(--space-6);
    padding-top: var(--space-6);
    border-top: 1px solid var(--color-border-secondary);
  }
`;

const QuotaHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-primary);
  font-size: var(--font-md);
  font-weight: 600;
  line-height: 20px;
`;

const UsedText = styled.div`
  margin-top: var(--space-1);
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  line-height: 18px;
`;

const QuotaProgress = styled(Progress)`
  margin: var(--space-2) 0 5px;
  line-height: 4px;

  .ant-progress-inner {
    vertical-align: top;
  }
`;

const QuotaUsage = styled.div`
  display: flex;
  justify-content: space-between;
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  line-height: 18px;
`;

const LoadFailed = styled.div`
  padding-top: 40px;
  color: var(--color-text-tertiary);
  text-align: center;
`;

export default function QuotaDrawer({
  open,
  data,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  data: SandboxQuota | null;
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  const quotas = getSandboxQuotas(data);

  return (
    <Drawer open={open} width={420} mask={false} title={_l('额度')} styles={DRAWER_STYLES} onClose={onClose}>
      <Description>
        <DescriptionTitle>{_l('沙盒环境')}</DescriptionTitle>
        <DescriptionText>{_l('额度独立计算，仅统计当前沙盒环境资源用量，不影响正式环境。')}</DescriptionText>
      </Description>
      {loading ? (
        <LoadDiv className="mTop30" />
      ) : error ? (
        <LoadFailed>{_l('额度加载失败，请稍后重试')}</LoadFailed>
      ) : (
        quotas.map(item => (
          <QuotaItem key={item.key}>
            <QuotaHeader>
              <span className="overflow_ellipsis">{item.name}</span>
            </QuotaHeader>
            <UsedText>{item.usedText}</UsedText>
            <QuotaProgress
              showInfo={false}
              railColor="var(--color-border-secondary)"
              strokeColor="var(--color-primary)"
              size={[-1, 4]}
              percent={item.percent}
            />
            <QuotaUsage>
              <span>{item.percent}%</span>
              <span>
                {_l('总额度')} {item.limitText}
              </span>
            </QuotaUsage>
          </QuotaItem>
        ))
      )}
    </Drawer>
  );
}
