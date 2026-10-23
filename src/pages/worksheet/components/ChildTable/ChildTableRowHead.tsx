import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Checkbox } from 'ming-ui';
import ChangeSheetLayout from 'worksheet/components/ChangeSheetLayout';
import RecordOperate from 'worksheet/components/RecordOperate';
import type { RecordRow } from 'src/utils/controlTypes';

interface RowHeadProps {
  useUserPermission?: boolean | undefined;
  row?: RecordRow;
  allowOpenRecord?: boolean | undefined;
  allowCopy?: boolean | undefined;
  changeSheetLayoutVisible?: boolean | undefined;
  disabled?: boolean | undefined;
  allowAdd?: boolean | undefined;
  allowCancel?: boolean | undefined;
  className?: string | undefined;
  style: React.CSSProperties;
  isSelectAll?: boolean | undefined;
  rowIndex: number;
  recordId?: string | undefined;
  showCheckbox?: boolean | undefined;
  selectedRowIds: string[];
  showNumber?: boolean | undefined;
  lineNumberBegin?: number | undefined;
  onOpen?: (rowIndex: number) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  saveSheetLayout?: () => void;
  resetSheetLayout?: () => void;
  onSelect?: (rowId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

const Con = styled.span`
  padding: 0 !important;
  line-height: 34px;
  .rowIndex {
    display: inline-block;
    width: 44px;
    text-align: center;
    .num {
      font-size: var(--font-sm);
      color: var(--color-text-tertiary);
    }
    .Checkbox-box {
      margin-right: -2px !important;
    }
  }
  .moreOperate {
    margin: 5px var(--space-2) 0 var(--space-3);
  }
  .open,
  .operateBtn,
  .moreOperate {
    display: none;
  }
  .operateBtn {
    margin: 0 13px;
    min-width: 18px;
  }
  .operateBtn,
  .open .icon {
    font-size: var(--font-xl);
    color: var(--color-text-tertiary);
    cursor: pointer;
    top: 2px;
    position: relative;
    &.delete:hover {
      color: var(--color-error);
    }
  }
  .delete {
    display: none;
  }
  &.hover {
    .open {
      display: inline-block;
    }
  }
  &.isNew {
    &::before {
      content: '';
      position: absolute;
      z-index: 3;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--color-primary);
    }
  }
  &:not(.disabled).hover {
    .delete,
    .open,
    .operateBtn,
    .moreOperate {
      display: inline-block;
    }
    .rowIndex {
      display: none;
    }
    &.oneColumn {
      display: flex;
      justify-content: center;
      .moreOperate {
        margin-left: 0px;
        margin-right: 0px;
      }
    }
  }
  &.showCheckbox {
    .rowIndex {
      position: absolute;
      display: inline-block !important;
      z-index: 2;
    }
  }
  /* 批量编辑态行头只展示 checkbox，hover 时不再叠加显示更多操作 icon */
  &.showCheckbox.hover {
    .delete,
    .open,
    .operateBtn,
    .moreOperate {
      display: none;
    }
  }
  &.disabled:not(.showNumber) {
    text-align: center;
    .rowIndex {
      display: none;
    }
  }
`;

export default function RowHead(props: RowHeadProps) {
  const {
    useUserPermission,
    row = {},
    allowOpenRecord,
    allowCopy,
    changeSheetLayoutVisible,
    disabled,
    allowAdd,
    allowCancel,
    className,
    style = { width: 0 },
    isSelectAll,
    rowIndex,
    recordId,
    showCheckbox,
    selectedRowIds,
    showNumber = true,
    lineNumberBegin = 0,
    onOpen = () => {},
    onDelete = () => {},
    onCopy = () => {},
    saveSheetLayout = () => {},
    resetSheetLayout = () => {},
    onSelect = () => {},
    onSelectAll = () => {},
  } = props;
  const rowid = row.rowid ?? '';
  const isSavedData = !/^temp/.test(rowid);
  const hideOperate = disabled || (isSavedData && (!allowAdd || !allowCancel));

  if (rowIndex === -1) {
    return showCheckbox ? (
      <Con as="div" className={cx(className, 'noRightBorder showCheckbox')} style={style}>
        <span className="rowIndex">
          <Checkbox
            size="small"
            clearselected={!isSelectAll && !!selectedRowIds.length}
            // disabled={!data.length}
            checked={isSelectAll}
            onClick={() => {
              onSelectAll(!selectedRowIds.length);
            }}
          />
        </span>
      </Con>
    ) : (
      <div className={cx(className, 'noRightBorder')} style={style}>
        {changeSheetLayoutVisible && (
          <ChangeSheetLayout
            description={_l('保存当前表格的列宽、列冻结配置，并应用给所有用户')}
            onSave={saveSheetLayout}
            onCancel={resetSheetLayout}
          />
        )}
      </div>
    );
  }

  if (!rowid || rowid.startsWith('empty')) {
    return <Con className={cx(className, 'noRightBorder placeholder')} style={style} />;
  }

  return (
    <Con
      className={cx(className, 'noRightBorder', {
        disabled: disabled || (isSavedData && (!allowAdd || !allowCopy) && !allowCancel),
        showNumber,
        showCheckbox,
        isNew: !isSavedData,
        oneColumn: Number(style.width || 0) < 50,
      })}
      style={style}
    >
      <span className="rowIndex">
        {showNumber && !showCheckbox && <span className={cx('num')}>{lineNumberBegin + rowIndex + 1}</span>}

        {showCheckbox && (
          <Checkbox
            checked={_.includes(selectedRowIds, row.rowid)}
            size="small"
            onClick={() => {
              onSelect(rowid, !_.includes(selectedRowIds, rowid));
            }}
          />
        )}
      </span>
      {!hideOperate && (
        <RecordOperate
          action={['hover']}
          popupAlign={{
            offset: [-12, 0],
            points: ['tl', 'bl'],
          }}
          isSubList
          mouseEnterDelay={0.5}
          defaultCustomButtons={[]}
          allowCopy={allowCopy}
          shows={['copy']}
          allowDelete={useUserPermission && !!recordId ? row['allowdelete'] : true}
          showTask={false}
          showHr={false}
          onDelete={onDelete}
          onCopy={onCopy}
        />
      )}
      {!disabled && isSavedData && allowAdd && !allowCancel && allowCopy && (
        <i className="operateBtn icon icon-copy hand hoverColorPrimary" onClick={onCopy}></i>
      )}
      {!disabled &&
        isSavedData &&
        allowCancel &&
        !allowAdd &&
        ((useUserPermission ? row['allowdelete'] : true) ? (
          <i className="operateBtn delete icon icon-trash hand" onClick={onDelete}></i>
        ) : (
          <span className="operateBtn"></span>
        ))}
      {allowOpenRecord && (
        <span className="open" onClick={() => onOpen(rowIndex)}>
          <i className="icon icon-worksheet_enlarge hoverColorPrimary"></i>
        </span>
      )}
    </Con>
  );
}

//

RowHead.propTypes = {
  className: PropTypes.string,
  showCheckbox: PropTypes.bool,
  showNumber: PropTypes.bool,
  isSelectAll: PropTypes.bool,
  selectedRowIds: PropTypes.arrayOf(PropTypes.string),
  row: PropTypes.shape({}),
  allowAdd: PropTypes.bool,
  allowCancel: PropTypes.bool,
  disabled: PropTypes.bool,
  rowIndex: PropTypes.number,
  style: PropTypes.shape({}),
  onOpen: PropTypes.func,
  onDelete: PropTypes.func,
  onCopy: PropTypes.func,
  saveSheetLayout: PropTypes.func,
  resetSheetLayout: PropTypes.func,
  onSelect: PropTypes.func,
  onSelectAll: PropTypes.func,
};
