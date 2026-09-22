import styled from 'styled-components';

export const Wrap = styled.div`
  .line {
    border-top: 1px solid var(--color-border-secondary);
    margin-top: var(--space-6);
  }
`;

export const AnimationWrap = styled.div`
  display: flex;
  padding: 2px;
  background: var(--color-background-tertiary);
  border-radius: var(--radius-sm);
  .animaItem {
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: bold;
    color: var(--color-text-secondary);
    flex: 1;
    margin-left: 2px;
    &:first-child {
      margin-left: 0;
    }
    &:hover {
      color: var(--color-primary-text);
      i {
        color: var(--color-primary-text);
      }
    }
    i {
      color: var(--color-text-secondary);
    }
    &.active {
      background: var(--color-background-primary);
      color: var(--color-primary-text);
      i {
        color: var(--color-primary-text);
      }
    }
    &.disabled {
      color: var(--color-text-disabled) !important;
      cursor: not-allowed;
    }
  }
`;

export const WrapCount = styled.div`
  .showCount {
    width: 80px;
    .text {
      right: 10px;
      top: 0px;
      line-height: 36px;
    }
  }
`;

export const WrapPopover = styled.div`
  width: 437px;
  font-weight: 400;
  padding: var(--space-3) 6px;
  .btn {
    padding: 0 var(--space-4);
    height: 36px;
    line-height: 36px;
    border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
    &.first {
      color: var(--color-white);
      background: var(--color-success-solid);
      border: 1px solid var(--color-success);
    }
    i {
      color: var(--color-text-secondary);
      &.del {
        color: var(--color-error);
      }
      &.first {
        color: var(--color-white);
      }
    }
  }
`;
