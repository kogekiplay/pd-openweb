import styled from 'styled-components';

export const Wrap = styled.div`
  .header {
    background-color: var(--color-background-tertiary);
  }
  .horizontalPadding {
    padding: 0 var(--space-3);
  }
  .content {
    flex: 1;
    background-color: var(--color-background-card);
  }
  .footer {
    padding: var(--space-6) 10px;
    background-color: var(--color-background-card);
  }
  .divider {
    width: 100%;
    height: 1px;
    background-color: var(--color-border-secondary);
  }
  .itemWrap {
    padding: 7px var(--space-5);
    &.notHover:hover {
      background-color: initial;
    }
    &:hover {
      background-color: var(--color-background-hover);
    }
  }
  .logout:hover {
    color: var(--color-error) !important;
  }
  .myAccount {
    padding: 3px var(--space-2);
    border-radius: var(--radius-sm);
    &:hover {
      background-color: var(--color-border-secondary);
    }
  }
  .accountStatus {
    height: 32px;
    background-color: var(--color-background-primary);
    border-radius: 16px;
    padding: 10px var(--space-3);
    cursor: pointer;
    margin: var(--space-4) var(--space-5) 0;
    width: calc(100% - 24px);
    max-width: unset !important;
    &:hover {
      box-shadow: var(--shadow-md);
    }
  }
  .shortcutKey {
    padding: 0px 5px;
    margin-right: -5px;
    text-align: center;
    border-radius: var(--radius-sm);
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-border-primary);
    font-family: -apple-system、Segoe UI Variable Display、Segoe UI-MONOSPACE;
  }
`;

export const PopoverWrap = styled.div`
  width: 280px;
  .horizontalPadding {
    padding: 7px var(--space-5);
  }
  .itemWrap {
    padding: 7px var(--space-5);
    &:hover,
    &.active {
      background-color: var(--color-background-hover);
    }
    .trial {
      color: var(--color-warning-text) !important;
    }
    .free {
      color: var(--color-success) !important;
    }
  }
`;
