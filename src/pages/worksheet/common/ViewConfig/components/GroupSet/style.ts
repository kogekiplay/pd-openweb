import styled from 'styled-components';
import { FlexCenter } from 'worksheet/styled';

export const Wrap = styled.div`
  .hasData {
    .icon-rename_input {
      color: var(--color-text-tertiary);
      padding-right: 10px;
      &:hover {
        color: var(--color-primary);
      }
    }
    .cancle {
      color: var(--color-text-tertiary);
      cursor: pointer;
      &:hover {
        color: var(--color-text-secondary);
      }
    }
    .Dropdown {
      width: 100%;
      display: flex;
      line-height: 36px;
      height: 36px;
      opacity: 1;
      background: var(--color-background-primary);
      border-radius: var(--radius-sm);
      margin: var(--space-2) 0;
      box-sizing: border-box;
      &.mTop0 {
        margin: 0 var(--space-2) 0 0;
      }
      .actionIcon {
        width: 13px;
      }
      & > div {
        flex: 1;
      }
      .Dropdown--input {
        padding: 0 var(--space-3) 0 var(--space-3);
        width: 100%;
        display: flex;
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-sm);
        height: 36px;
        &.active {
          border: 1px solid var(--color-primary);
        }
        .value,
        .Dropdown--placeholder {
          flex: 1;
          max-width: 100%;
        }
        .Icon {
          line-height: 34px;
        }
        .List {
          width: 100%;
          top: 104% !important;
        }
      }
    }
    .inputBox {
      width: 100%;
      display: flex;
      line-height: 36px;
      height: 36px;
      opacity: 1;
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-sm);
      padding: 0 var(--space-3) 0 var(--space-3);
      .icon {
        line-height: 35px;
      }
      .itemText {
        text-align: left;
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
    .checkBox {
      vertical-align: middle;
    }
    .ming.Checkbox.Checkbox--disabled {
      color: var(--color-text-title);
    }
    .iconWrap {
      display: inline-block;
      vertical-align: middle;
      margin-left: var(--space-2);
    }
  }
  .noData {
    .cover {
      padding-top: 60px;
      img {
        width: 100%;
        display: block;
      }
    }
    h6 {
      font-size: var(--font-2xl);
      font-weight: 500;
      color: var(--color-text-title);
      text-align: center;
      padding: 0;
      padding-top: var(--space-8);
      margin: 0;
    }
    .text {
      font-weight: 400;
      text-align: center;
      color: var(--color-text-tertiary);
      line-height: 20px;
      font-size: var(--font-sm);
      width: 80%;
      margin: var(--space-6) auto 0;
    }
    .addFilterCondition {
      width: 100% !important;
      position: relative;
      width: auto !important;
      height: auto !important;
      border: 0px !important;
      line-height: 1 !important;
      text-align: center;
      &.nodata {
        margin: var(--space-8) auto 0 !important;
      }
      & > span {
        width: 100% !important;
        display: block !important;
        padding: 0 0 !important;
      }
      span.addIcon {
        position: relative;
        background: var(--color-primary-solid);
        border-radius: var(--radius-sm);
        color: var(--color-white);
        display: inline-block;
        padding: var(--space-3) var(--space-8);
        cursor: pointer;
        font-weight: bold;
        .icon {
          font-size: var(--font-2xl);
        }
        &:hover {
          background: var(--color-primary-dark);
        }
      }
    }
  }
  .RelateRecordDropdown-selected {
    height: auto;
  }
`;

const DisplayControlOption = styled(FlexCenter)`
  .icon {
    font-size: var(--font-lg);
    color: var(--color-text-secondary);
    margin-right: var(--space-1);
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: var(--space-1);
  }
`;

export const SelectValue = styled(DisplayControlOption)`
  &：hover {
    .icon {
      color: var(--color-primary);
    }
  }
`;
