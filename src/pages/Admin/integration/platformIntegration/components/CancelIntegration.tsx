import Trigger from '@rc-component/trigger';
import styled from 'styled-components';

const Wrap = styled.div`
  width: 174px;
  height: 48px;
  line-height: 48px;
  color: var(--color-error);
  padding-left: var(--space-5);
  background-color: var(--color-background-card);
  box-shadow: var(--shadow-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
`;

export interface CancelIntegrationProps {
  clickCancel?: (() => void) | undefined;
}

export default function CancelIntegration(props: CancelIntegrationProps) {
  const { clickCancel = () => {} } = props;

  return (
    <Trigger
      action={['hover']}
      popup={<Wrap onClick={clickCancel}>{_l('取消集成')}</Wrap>}
      popupAlign={{
        points: ['tr', 'br'],
        offset: [5, 5],
        overflow: { adjustX: true, adjustY: true },
      }}
    >
      <i className="icon-moreop Font18 textTertiary" />
    </Trigger>
  );
}
