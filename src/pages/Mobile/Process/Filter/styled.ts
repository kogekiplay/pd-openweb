import styled from 'styled-components';

export const OptionWrap = styled.div`
  cursor: pointer;
  font-size: var(--font-xs);
  display: inline-block;
  margin: 0 var(--space-3) var(--space-3) 0;
  color: var(--color-text-title);
  padding: var(--space-1) var(--space-3);
  border-radius: 28px;
  max-width: 200px;
  user-select: none;
  background-color: var(--color-background-secondary);
  &.checked {
    color: var(--color-on-primary);
    border-color: var(--color-primary);
    background-color: var(--color-primary);
  }
`;

export const SidebarWrap = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  background: var(--color-background-primary);
  width: 100%;
  height: calc(100% - 45px);
  padding: var(--space-5) var(--space-5) 0;
  .overflowY {
    overflow-y: auto;
    margin-right: -10px;
  }
`;
