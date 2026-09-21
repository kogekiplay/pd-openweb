import styled from 'styled-components';

export const List = styled.div`
  padding: var(--space-2) 0;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-secondary);
  .sortItem {
    display: flex;
    align-items: center;
    padding: 0 var(--space-2);
    height: 40px;
    background: var(--color-background-primary);
    &:hover {
      background: var(--color-background-hover);
    }
  }
`;

export const Wrap = styled.div`
  overflow: hidden;
  height: 100%;
`;
