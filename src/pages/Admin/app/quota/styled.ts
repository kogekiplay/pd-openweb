import styled from 'styled-components';

/** 额度设置页样式边界，统一约束列表、操作区、滚动区和快捷额度弹层样式。 */
export const ContentWrap = styled.div`
  --quota-scrollbar-offset: 32px;
  --quota-footer-safe-space: 32px;
  display: flex;
  flex-direction: column;
  padding-bottom: 66px !important;
  .quotaContentScroll {
    flex: 1;
    min-height: 0;
    margin-right: calc(-1 * var(--quota-scrollbar-offset));
    padding-right: var(--quota-scrollbar-offset);
  }
  .limitWrap {
    min-height: 40px;
    padding: 10px var(--space-3);
    background: var(--color-primary-transparent);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-6);
  }
  input {
    width: 120px;
    &.overLimit {
      border: 1px solid var(--color-error);
    }
  }
  .appName {
    width: 262px;
  }
  .appIcon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-xs);
    margin-right: var(--space-2);
    text-align: center;
  }
  .size {
    margin-right: 70px;
  }
  .action {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
  .footer {
    left: 0;
    right: 0;
    height: 66px;
    padding: 15px var(--quota-footer-safe-space);
    position: absolute;
    bottom: 0;
    background-color: var(--color-background-primary);
    align-items: center;
    justify-content: space-between;
  }
  .footerActions {
    flex-shrink: 0;
    gap: var(--space-5);
  }
  .listCount {
    flex: 1;
    min-width: 0;
    line-height: 36px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text-secondary);
  }
  .addAndFilterWrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    .filterWrap {
      justify-content: flex-end;
      flex: 1;
      min-width: 0;
      margin-left: var(--space-5);
    }
    .add {
      color: var(--color-link-hover);
      border: 1px solid var(--color-link-hover);
      line-height: 34px;
      cursor: pointer;
      padding: 0 var(--space-5);
      border-radius: var(--radius-sm);
      &:hover {
        color: var(--color-white);
        border: 1px solid var(--color-link-hover);
        background-color: var(--color-link-hover);
      }
    }
    .w200 {
      width: 200px;
    }
  }
  .header {
    border-bottom: 1px solid var(--color-border-secondary);
    padding: var(--space-3) 0;
  }
  .list {
    min-height: 0;
  }
  .checkColumn {
    width: 40px;
    flex-shrink: 0;
  }
  .sortHeader {
    cursor: pointer;
    .sorter {
      color: var(--color-text-disabled);
      margin-left: 3px;
      transform: scale(0.8);
      .icon-arrow-down {
        margin-top: -4px;
      }
    }
  }
  .batchActions {
    line-height: 36px;
    .batchAction {
      margin-left: var(--space-6);
      color: var(--color-primary);
      cursor: pointer;
      &:hover {
        color: var(--color-link-hover);
      }
      &.disabled {
        color: var(--color-text-disabled);
        cursor: not-allowed;
      }
    }
  }
  .limitModeTrigger {
    display: inline-flex;
    align-items: center;
    height: 36px;
    cursor: pointer;
    .ming.Icon {
      margin-left: 6px;
      color: var(--color-text-disabled);
    }
    &.unlimited {
      min-width: 90px;
    }
  }
  .draftTag {
    flex-shrink: 0;
    height: 24px;
    line-height: 24px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-xs);
    color: var(--color-text-secondary);
    background: var(--color-background-tertiary);
  }
`;
