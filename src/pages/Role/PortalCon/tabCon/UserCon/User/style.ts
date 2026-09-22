import styled from 'styled-components';

export const Wrap = styled.div(
  ({ len }) => `
  .toRole {
    color: var(--color-text-title);
    &:hover {
      color: var(--color-primary-text);
    }
  }
  padding: var(--space-4) 10px 0 10px;
  .wrapTr .Dropdown--input {
    padding: 0 !important;
  }
  .wrapTr:not(.checkBoxTr):not(.optionWrapTr) {
    width: calc(calc(100% - 70px - 38px) / ${len - 1});
  }
  .wrapTr.nameWrapTr {
    width: calc(calc(100% - 70px - 38px) / ${len - 1}); !important;
    overflow: hidden;
  }
  .moreop {
    color: var(--color-text-tertiary);
  }
  .topAct {
    padding-right: 22px;
    min-height: 54px;
    padding-bottom: var(--space-4);
    display: flex;
    justify-content: right;
    .act {
      .topActDrop {
        width: 180px;
        height: 36px;
        background: var(--color-background-primary);
        border: 1px solid var(--color-border-secondary);
        border-radius: var(--radius-sm);
        .Dropdown--input {
          display: flex;
          line-height: 36px;
          padding: 0 10px !important;
          .value {
            flex: 1;
          }
          i {
            &::before {
              line-height: 36px;
            }
          }
        }
      }
    }
    .toRole {
      border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border-primary);
      line-height: 32px;
      display: inline-block;
      &:hover {
        border: 1px solid var(--color-primary);
        color: var(--color-primary-text);
      }
    }
    .addUser {
      height: 32px;
      overflow: hidden;
      vertical-align: top;
      line-height: 32px;
      border-radius: var(--radius-sm);
      color: var(--color-white);
      background: var(--color-primary-solid);
      i::before {
        line-height: 32px;
        color: var(--color-white);
      }
      .lAdd {
        padding-left: var(--space-3);
        padding-right: 10px;
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
      }
      .rAdd {
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        padding-right: 6px;
      }
      .rAdd,
      .lAdd {
        cursor: pointer;
        height: 32px;
        display: inline-block;
        background: var(--color-primary);
        &:hover {
          background: var(--color-primary);
        }
      }
    }
    .changeRole,
    .del,
    .download {
      padding: 0 var(--space-4);
      height: 32px;
      border-radius: var(--radius-sm);
      line-height: 32px;
      text-align: center;
      background: var(--color-primary-transparent);
      color: var(--color-primary-text);
      &:hover {
        background: var(--color-primary-transparent);
      }
    }
    .disabledAction {
      background: var(--color-background-primary) !important;
      color: var(--color-text-disabled) !important;
      border: 1px solid var(--color-border-secondary) !important;
      cursor: not-allowed!important;
      pointer-events: none;
    }
    .del {
      background: rgba(244, 67, 54, 0.1);
      color: rgba(244, 67, 54, 1);
      &:hover {
        background: var(--color-error-bg);
      }
    }
  }
  .isCurmemberType {
    color: var(--color-primary-text);
  }
  .topActDrop .Dropdown--input {
    display: flex;
    align-items: center;
    & > span.value {
      display: inline-block;
      flex: 1;
    }
    .icon {
      display: block;
    }
  }
`,
);
export const WrapPop = styled.div`
  &.uploadUser {
    padding: 6px 0;
    background: var(--color-background-primary);
    box-shadow: var(--shadow-lg);
    opacity: 1;
    border-radius: var(--radius-sm);
    .Item {
      .Item-content {
        padding-left: var(--space-8);
      }
    }

    .icon {
      color: var(--color-text-tertiary);
    }
    span {
      line-height: 36px;
      display: inline-block;
      vertical-align: top;
    }
  }
`;
