import React from 'react';
import styled from 'styled-components';

const TableWrap = styled.div`
  .mHeight200 {
    min-height: 200px;
  }
  .editableTable {
    width: 100%;
    border-collapse: collapse;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-secondary);
    table-layout: fixed;
    border-bottom: none;
    th,
    td {
      padding: var(--space-2) var(--space-3);
      text-align: left;
      border-bottom: 1px solid var(--color-border-secondary);
      border-right: 1px solid var(--color-border-secondary);
      vertical-align: middle;

      &:last-child {
        border-right: none;
      }

      &.editMode {
        padding: var(--space-1) var(--space-2);
      }
    }

    th {
      background-color: var(--color-background-secondary);
      font-weight: 500;
      color: #262626;
    }

    tr:hover {
      background-color: var(--color-background-secondary);
    }
    .flex1 {
      flex: 1;
    }
    .flex2 {
      flex: 2;
    }
    .flex3 {
      flex: 3;
    }
    .flex4 {
      flex: 4;
    }
  }

  .priceInput {
    width: 120px;
    text-align: right;
    height: 28px;
    line-height: 28px;

    .ant-input-number-input {
      height: 26px;
      line-height: 26px;
    }
  }

  .unitText {
    margin-left: var(--space-2);
    color: var(--color-text-secondary);
  }

  .lastUpdateTime {
    margin-top: var(--space-4);
    text-align: right;
    color: var(--color-text-secondary);
    font-size: var(--font-xs);
  }
`;

const EditableTable = ({ children, className }: { className?: string; [key: string]: any }) => {
  return <TableWrap className={className}>{children}</TableWrap>;
};

export default EditableTable;
