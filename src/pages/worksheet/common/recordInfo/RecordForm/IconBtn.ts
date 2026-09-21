import styled from 'styled-components';

const IconBtn = styled.span`
  color: var(--color-text-secondary);
  height: 28px;
  font-size: 22px;
  line-height: 28px;
  padding: 0 var(--space-1);
  margin: var(--space-3) 0 var(--space-3) var(--space-2);
  border-radius: var(--radius-sm);
  &:hover {
    background: var(--color-background-hover);
  }
`;
export default IconBtn;
