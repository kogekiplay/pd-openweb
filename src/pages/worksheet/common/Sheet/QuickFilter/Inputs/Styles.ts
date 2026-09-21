import styled from 'styled-components';

export const BaseSelectedItem = styled.div`
  display: inline-block;
  margin-right: 10px;
  padding: 0 10px;
  height: 24px;
  line-height: 24px;
  border-radius: 24px;
  background: var(--color-border-secondary);
  max-width: 100%;
  font-size: var(--font-sm);
  .name {
    display: inline-block;
    width: calc(100% - 17px);
  }
  .icon {
    margin-left: var(--space-1);
  }
`;
