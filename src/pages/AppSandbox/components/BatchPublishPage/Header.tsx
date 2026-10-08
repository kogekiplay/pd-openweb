import styled from 'styled-components';
import { Icon } from 'ming-ui';

const HeaderWrap = styled.header`
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-secondary);
  background-color: var(--color-background-primary);
  flex-shrink: 0;
`;

const BackIcon = styled(Icon)`
  color: var(--color-text-primary);
  font-size: var(--font-2xl);
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
  }
`;

const Title = styled.span`
  margin-left: var(--space-4);
  color: var(--color-text-primary);
  font-size: var(--font-lg);
  font-weight: 600;
`;

const noop = () => {};

export default function Header({ onClose = noop }: { onClose?: () => void }) {
  return (
    <HeaderWrap>
      <BackIcon icon="arrow_back" onClick={onClose} />
      <Title>{_l('发布新版本')}</Title>
    </HeaderWrap>
  );
}
