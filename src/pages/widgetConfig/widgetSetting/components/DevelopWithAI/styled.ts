import styled from 'styled-components';

export const Icon = styled.i`
  font-size: ${props => props.size || '18'}px;
  color: ${props => props.color || 'var(--color-text-primary)'};
`;

export const IconButton = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  .icon {
    margin-right: var(--space-1);
  }
  .text {
    font-size: var(--font-sm);
    color: ${props => props.textColor || 'var(--color-text-primary)'};
  }
  &.disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;
