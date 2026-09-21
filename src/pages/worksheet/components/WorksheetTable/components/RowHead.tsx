import React, { Fragment, useState } from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import { find, get, isEmpty } from 'lodash';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Checkbox, Menu, MenuItem } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import addRecord from 'worksheet/common/newRecord/addRecord';
import { updateRecordLockStatus } from 'worksheet/common/recordInfo/crtl';
import { FlexCenter } from 'worksheet/components/Basics';
import ChangeSheetLayout from 'worksheet/components/ChangeSheetLayout';
import RecordOperate from 'worksheet/components/RecordOperate';
import { VIEW_CONFIG_RECORD_CLICK_ACTION } from 'worksheet/constants/enum';
import type { WorksheetView } from 'src/pages/worksheet/types';
import { getHighAuthControls } from 'src/utils/control';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import { handleRowData } from 'src/utils/record';
import type { SheetSwitchPermitItem } from 'src/utils/worksheet';

const Con = styled.div`
  user-select: none;
  padding-left: 2px;
  padding-top: 0px !important;
  padding-bottom: 0px !important;
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  padding: 0px !important;
  align-items: center;
  > * {
    flex: 0 0 auto;
  }
  /* 【序号/复选框排在最左，⋯ 排到它右边】
     原来顺序是 [⋯][序号]，于是序号被 ⋯ 那 24px 顶到 42px 处浮在列中间，
     而表头那行是 [占位24][复选框][下拉]，数据行是 [⋯][序号]，
     两者从不共存、宽度却按叠加算 —— 88px 里有 35px 是空的。
     改成 ⋯ 排在序号右边之后，序号与表头复选框对齐到同一个左起点，
     列宽由「序号 + ⋯」决定，宽度见 SheetView 的 rowHeadWidth。 */
  .numberCon {
    display: inline-block;
    text-align: center;
    order: 1;
    margin-left: var(--space-3) !important;
  }
  .moreOperate {
    order: 2;
    margin-left: var(--space-1);
    visibility: hidden;
  }
  .topCheckbox {
    order: 1;
  }
  .openRecord {
    order: 3;
  }
  .checkbox {
    margin-top: 5px;
    display: none;
    .Checkbox-box {
      margin: 0px;
    }
  }
  .openRecord {
    visibility: hidden;
  }
  .topCheckbox {
    position: absolute;
    text-align: center;
    /* 【绝对定位不吃 flex 的 order，得显式给 left】
       表头这个全选框要和数据行的序号对齐到同一个中心：
       序号是 left:12 宽 16（中心 20），所以这里也给 left:12、宽 16。
       不给的话它落在静态位置上，中心会偏右 8px。 */
    left: 12px;
    width: 16px;
    .checkboxCon {
      position: relative;
      display: inline-block;
      .Checkbox-box {
        margin: 0px;
      }
    }
  }
  .number {
    display: inline-block;
  }
  .showMore:hover {
    color: var(--color-text-secondary);
  }
  &.rowHadFocus {
    .openRecord {
      visibility: visible;
    }
  }
  &.hover {
    .openRecord {
      visibility: visible;
    }
  }
  &.cell.noRightBorder {
    border-right: none !important;
  }
  &.hideNumber {
    .number {
      display: none;
    }
  }
  &.hover.hasBatch.recordOperateVisible,
  &.hover.hasBatch.showCheckbox,
  &.selected.hasBatch {
    .number {
      display: none;
    }
    .checkbox {
      display: inline-block;
    }
  }
  &.hideNumber {
    .number {
      display: none;
    }
    .checkbox {
      display: inline-block;
    }
  }
  &.hover {
    .moreOperate {
      visibility: visible;
    }
  }
`;

const OpenRecordBtn = styled(FlexCenter)`
  margin-left: var(--space-2);
  font-size: var(--font-lg);
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  &:hover {
    background: var(--color-background-hover);
  }
`;

function getApplyToAllChecked(worksheetInfo, viewId: string) {
  const view = find(worksheetInfo.views, o => o.viewId === viewId);

  if (!view) {
    return false;
  }

  const viewListStyle = safeParse(get(view, 'advancedSetting.liststyle'));
  const worksheetInfoListStyle = safeParse(get(worksheetInfo, 'advancedSetting.liststyle'));
  return worksheetInfoListStyle.time > viewListStyle.time;
}

export default function RowHead(props) {
  /**
   * 行头（每行最左边那一格：序号 / 勾选框 / 操作入口）的 props。
   *
   * 【把 `[key: string]: any` 兜底拆开的实验】字段类型是按本文件里的实际用法定的：
   * tableType 只和 'classic' 比、data 是当页的行、selectedIds 是选中的 rowid…
   * 拆开之后写错字段名或用错类型会当场报错，而不是被索引签名默默吃掉。
   */
  interface RowHeadProps {
    /** 'classic' 时行头更宽（46 vs 30） */
    tableType?: string;
    hasBatch?: boolean;
    showNumber?: boolean;
    showOperate?: boolean;
    numberWidth?: number;
    readonly?: boolean;
    isTrash?: boolean;
    isDraft?: boolean;
    isDraftTable?: boolean;
    /** 只显示序号，不显示勾选框和操作 */
    rowHeadOnlyNum?: boolean;
    isCharge?: boolean;
    isDevAndOps?: boolean;
    tableId?: string;
    layoutChangeVisible?: boolean;
    style?: React.CSSProperties;
    /** 已勾选的 rowid */
    selectedIds?: string[];
    canSelectAll?: boolean;
    allWorksheetIsSelected?: boolean;
    allowAdd?: boolean;
    appId?: string;
    viewId?: string;
    worksheetId?: string;
    view?: WorksheetView;
    projectId?: string;
    controls: FormControl[];
    /** 当页的行数据 */
    data?: RecordRow[];
    lineNumberBegin?: number;
    rowIndex?: number;
    updateRows?: (rowIds: string[], changes: Record<string, unknown>) => void;
    sheetSwitchPermit?: SheetSwitchPermitItem[];
    hideRows?: (rowIds: string[], options?: unknown) => void;
    /** (勾选后的全部 rowid, 本次点的那一行) */
    onSelect?: (rowIds: string[], rowId?: string) => void;
    onSelectAllWorksheet?: (selected: boolean) => void;
    handleAddSheetRow?: (...args: unknown[]) => void;
    onReverseSelect?: () => void;
    saveSheetLayout?: (options: { closePopup?: () => void }) => void;
    resetSheetLayout?: () => void;
    worksheetInfo?: {
      views?: WorksheetView[];
      roleType?: number;
      entityName?: string;
      template?: { controls?: FormControl[] };
      rules?: unknown[];
    };
    /** (tableId, 第几行) —— 行号从 1 开始 */
    /** (tableId, 第几行) —— 行号从 1 开始；个别调用点只传行号 */
    setHighLight?: (tableId?: string, rowIndex?: number) => void;
    refreshWorksheetControls?: () => void;
    onOpenRecord?: (...args: unknown[]) => void;
    printCharge?: boolean;
    className?: string;
  }

  const {
    tableType,
    hasBatch = true,
    showNumber = true,
    showOperate = true,
    numberWidth,
    readonly,
    isTrash,
    isDraft,
    isDraftTable,
    rowHeadOnlyNum,
    isCharge,
    isDevAndOps,
    tableId,
    layoutChangeVisible,
    style,
    selectedIds,
    canSelectAll,
    allWorksheetIsSelected,
    allowAdd,
    appId,
    viewId,
    worksheetId,
    view,
    projectId,
    controls = [],
    data,
    lineNumberBegin,
    rowIndex,
    updateRows,
    sheetSwitchPermit,
    hideRows,
    onSelect,
    onSelectAllWorksheet,
    handleAddSheetRow = () => {},
    onReverseSelect = () => {},
    saveSheetLayout,
    resetSheetLayout,
    worksheetInfo = {},
    setHighLight = () => {},
    refreshWorksheetControls = () => {},
    onOpenRecord = () => {},
    printCharge,
  }: RowHeadProps = props;
  let { className } = props;
  // 必须给初值 false：不给的话状态类型被推成 undefined，三处 setSelectAllPanelVisible(true/false) 全是 TS2345。
  // 运行时等价（undefined 本来也是假值），rc-trigger 5 给 onPopupVisibleChange
  // 补上了准确的 (visible: boolean) 类型之后才把这个既有问题暴露出来。
  const [selectAllPanelVisible, setSelectAllPanelVisible] = useState(false);
  const row = data[rowIndex] || {};
  const groups = data.filter(r => r.rowid === 'groupTitle').map(r => _.omit(r, ['rows']));
  const selected =
    canSelectAll && allWorksheetIsSelected ? !_.includes(selectedIds, row.rowid) : _.includes(selectedIds, row.rowid);
  const recordOperateVisible = showOperate && !readonly && !isTrash && !isDraftTable;
  const dataLength = data.filter(r => r.rowid !== 'groupTitle').length;

  function handleCheckAll(force?) {
    if (canSelectAll && allWorksheetIsSelected) {
      onSelectAllWorksheet(false);
      if (force) {
        onSelect(data.map(item => item.rowid).filter(r => r !== 'groupTitle' && r !== 'loadGroupMore'));
      }

      return;
    }

    if (selectedIds.length > 0 && !force) {
      onSelect([]);
    } else {
      onSelect(data.map(item => item.rowid).filter(r => r !== 'groupTitle' && r !== 'loadGroupMore'));
    }
  }

  if (isEmpty(row) && rowIndex > -1) {
    return <Con className={cx(className, 'noRightBorder', { selected })} style={style} />;
  }

  return (
    <Con
      tableType={tableType}
      rowHeadOnlyNum={rowHeadOnlyNum}
      showOperate={showOperate}
      className={cx(className, 'flexRow noRightBorder', {
        selected,
        hideNumber: !showNumber,
        hasBatch,
        recordOperateVisible,
        showCheckbox: !readonly && hasBatch,
      })}
      style={style}
      readonly={readonly || !hasBatch}
      onClick={e => {
        if (e.target.classList.contains('control-rowHead')) {
          onOpenRecord();
        }
      }}
    >
      {rowIndex !== -1 && (
        <React.Fragment>
          {recordOperateVisible ? (
            <RecordOperate
              {...{
                appId,
                viewId,
                worksheetId,
                recordId: row.rowid,
                groupControl: row.group?.control,
                currentGroupKey: row.group?.key,
                groups,
                projectId,
                isCharge,
                isDevAndOps,
                isDraft,
                printCharge,
                view,
              }}
              formdata={controls.map((c: FormControl) => ({ ...c, value: row[c.controlId] }))}
              shows={['share', 'print', 'copy', 'copyId', 'openinnew', 'recreate', 'fav', 'lock']}
              allowCopy={allowAdd && row.allowedit}
              allowEdit={row.allowedit}
              allowDelete={row.allowdelete}
              allowRecreate={allowAdd}
              isAdmin={worksheetInfo.roleType === 2}
              entityName={worksheetInfo.entityName}
              sheetSwitchPermit={sheetSwitchPermit}
              popupAlign={{
                offset: [0, 4],
                points: ['tl', 'bl'],
              }}
              isRecordLock={row.sys_lock}
              updateRecordLock={() => {
                updateRecordLockStatus(
                  {
                    appId,
                    viewId,
                    worksheetId,
                    recordId: row.rowid,
                    updateType: row.sys_lock ? 42 : 41,
                  },
                  (err, resdata) => {
                    if (resdata.isviewdata) {
                      updateRows([row.rowid], {
                        ...resdata,
                        allowedit: row.allowedit,
                        allowdelete: row.allowdelete,
                      });
                      alert(
                        resdata.sys_lock
                          ? _l('%0锁定成功', worksheetInfo.entityName)
                          : _l('%0已解锁', worksheetInfo.entityName),
                      );
                    } else {
                      hideRows([row.rowid]);
                    }
                  },
                );
              }}
              onUpdate={(rowdata, newRow, updatedControls) => {
                if (!newRow) {
                  newRow = rowdata;
                }

                if (_.find(updatedControls, item => _.includes([10, 11], item.type) && /color/.test(item.value))) {
                  refreshWorksheetControls();
                }

                if (rowdata.isviewdata) {
                  updateRows([newRow.rowid], _.omit(rowdata, ['allowedit', 'allowdelete']));
                } else {
                  hideRows([newRow.rowid]);
                }
              }}
              onCopySuccess={(...args) => {
                setHighLight(tableId, rowIndex + 1);
                handleAddSheetRow(...args);
              }}
              onDeleteSuccess={() => {
                hideRows([row.rowid]);
              }}
              onPopupVisibleChange={value => {
                if (value) {
                  setHighLight(tableId, rowIndex);
                }
              }}
              onRecreate={({ group }: { group?: string } = {}) => {
                handleRowData({
                  rowId: row.rowid,
                  worksheetId: worksheetId,
                  columns: controls,
                }).then(res => {
                  const { defaultData, defcontrols } = res;
                  const isManageView = isCharge && viewId === worksheetId;

                  if (isManageView) {
                    worksheetInfo.template.controls = getHighAuthControls(_.get(worksheetInfo, 'template.controls'));
                    worksheetInfo.rules = [];
                  }

                  addRecord({
                    worksheetId,
                    appId,
                    viewId,
                    defaultFormData: defaultData,
                    defaultFormDataEditable: true,
                    directAdd: false,
                    writeControls: defcontrols,
                    worksheetInfo,
                    isDraft,
                    onAdd: record => {
                      setHighLight(tableId, rowIndex + 1);
                      handleAddSheetRow({ ...record, group }, row.rowid);
                      alert(_l('创建成功'));
                    },
                  });
                });
              }}
            />
          ) : (
            <span className="moreOperate" style={{ width: rowHeadOnlyNum ? 0 : 24 }} />
          )}
          {(hasBatch || showNumber) && (
            <div className="numberCon" style={{ marginLeft: 10, width: numberWidth }}>
              {showNumber && <div className="number">{lineNumberBegin + (row.rowIndexNumber || rowIndex + 1)}</div>}
              {!readonly && hasBatch && (
                <div className="checkbox">
                  <Checkbox
                    checked={selected}
                    size="small"
                    onClick={() => {
                      if (selectedIds.indexOf(row.rowid) > -1) {
                        onSelect(
                          selectedIds.filter(s => s !== row.rowid),
                          row.rowid,
                        );
                      } else {
                        onSelect(_.uniqBy(selectedIds.concat(row.rowid)), row.rowid);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </React.Fragment>
      )}
      {!readonly && rowIndex === -1 && (
        <Fragment>
          {layoutChangeVisible && (
            /* 【排到行首最右，不能用它自带的 left:12】那个位置现在是全选框的
               —— 全选框要和数据行的序号对齐到同一个左起点（见 Con 里的 .topCheckbox）。
               两个都 absolute 到 left:12 就是纯重叠，张奇拖完列宽实测到的现象。
               行首宽度由 SheetView 的 rowHeadWidth 为它多留了 16+6。 */
            <ChangeSheetLayout
              isSheetView
              style={{ left: 'auto', right: 6 }}
              onSave={saveSheetLayout}
              onCancel={resetSheetLayout}
              applyToAllChecked={getApplyToAllChecked(worksheetInfo, viewId)}
            />
          )}
          {/* 不再传 right：Con 里给了 left:12，同时给 left 和 right 属于过约束，
              浏览器会丢掉 right，留着只会让人以为它还在起作用。 */}
          <div className="topCheckbox" style={{ width: numberWidth }}>
            {hasBatch && (
              <div className="checkboxCon mTop3">
                <Checkbox
                  size="small"
                  clearselected={!!(dataLength && selectedIds.length && selectedIds.length !== dataLength)}
                  disabled={!dataLength}
                  checked={
                    canSelectAll && allWorksheetIsSelected
                      ? !selectedIds.length
                      : !!dataLength && selectedIds.length === dataLength
                  }
                  onClick={(checked: boolean, value, e) => {
                    e.stopPropagation();
                    handleCheckAll();
                  }}
                />
                {canSelectAll && (
                  <Trigger
                    popupVisible={selectAllPanelVisible}
                    onPopupVisibleChange={visible => {
                      setSelectAllPanelVisible(visible);
                    }}
                    popupAlign={{
                      points: ['tl', 'bl'],
                      offset: [2, 10],
                    }}
                    action={['hover']}
                    popup={
                      <Menu>
                        <MenuItem
                          onClick={e => {
                            e.stopPropagation();
                            setSelectAllPanelVisible(false);
                            onSelectAllWorksheet(true);
                          }}
                        >
                          {_l('选择所有')}
                        </MenuItem>
                        <MenuItem
                          onClick={e => {
                            e.stopPropagation();
                            setSelectAllPanelVisible(false);
                            onReverseSelect();
                          }}
                        >
                          {_l('反选本页')}
                        </MenuItem>
                      </Menu>
                    }
                  >
                    <i
                      className="icon icon-expand_more Hand Font20 showMore"
                      style={{ position: 'absolute', top: 2, right: -22 }}
                    ></i>
                  </Trigger>
                )}
              </div>
            )}
          </div>
        </Fragment>
      )}
      {tableType === 'classic' &&
        (_.get(view, 'advancedSetting.clicktype') || VIEW_CONFIG_RECORD_CLICK_ACTION.OPEN_RECORD) ===
          VIEW_CONFIG_RECORD_CLICK_ACTION.OPEN_RECORD &&
        (() => {
          const btn = (
            <OpenRecordBtn className="openRecord" onClick={() => onOpenRecord()}>
              <i className="icon icon-worksheet_enlarge Hand hoverColorPrimary" />
            </OpenRecordBtn>
          );

          return localStorage.getItem('row_head_no_show_tip') !== '1' ? (
            <Tooltip
              placement="bottom"
              title={() => (document.querySelector('.cell.focus') ? _l('打开记录（空格）') : _l('打开记录'))}
              onOpenChange={visible => {
                if (visible) {
                  setTimeout(() => localStorage.setItem('row_head_no_show_tip', '1'), 1000);
                }
              }}
            >
              {btn}
            </Tooltip>
          ) : (
            btn
          );
        })()}
    </Con>
  );
}

RowHead.propTypes = {
  readonly: PropTypes.bool,
  isTrash: PropTypes.bool,
  isDraft: PropTypes.bool,
  style: PropTypes.shape({}),
  allWorksheetIsSelected: PropTypes.bool,
  appId: PropTypes.string,
  viewId: PropTypes.string,
  worksheetId: PropTypes.string,
  projectId: PropTypes.string,
  controls: PropTypes.arrayOf(PropTypes.shape({})),
  canSelectAll: PropTypes.bool,
  className: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.shape({})),
  hideRows: PropTypes.func,
  lineNumberBegin: PropTypes.number,
  onSelect: PropTypes.func,
  onSelectAllWorksheet: PropTypes.func,
  rowIndex: PropTypes.number,
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  sheetSwitchPermit: PropTypes.arrayOf(PropTypes.shape({})),
  updateRows: PropTypes.func,
  handleAddSheetRow: PropTypes.func,
  setHighLight: PropTypes.func,
  refreshWorksheetControls: PropTypes.func,
};
