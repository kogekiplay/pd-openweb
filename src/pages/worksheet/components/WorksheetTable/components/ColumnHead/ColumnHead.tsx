import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _, { get, isUndefined } from 'lodash';
import PropTypes from 'prop-types';
import { Dialog, Icon, Input, Menu, MenuItem } from 'ming-ui';
import SheetContext from 'worksheet/common/Sheet/SheetContext';
import { CONTROL_FILTER_WHITELIST } from 'worksheet/common/WorkSheetFilter/enum';
import { redefineComplexControl } from 'worksheet/common/WorkSheetFilter/util';
import BaseColumnHead from 'worksheet/components/BaseColumnHead';
import getTableColumnWidth from 'worksheet/components/BaseColumnHead/getTableColumnWidth';
import { CONTROL_EDITABLE_WHITELIST, WORKSHEET_ALLOW_SET_ALIGN_CONTROLS } from 'worksheet/constants/enum';
import {
  clearHiddenColumn,
  frozenColumn,
  hideColumn,
  saveColumnStylesToLocal,
  sortByControl,
  updateColumnStyles,
} from 'worksheet/redux/actions/sheetview';
import { SYS } from 'src/pages/widgetConfig/config/widget.js';
import { isOtherShowFeild } from 'src/pages/widgetConfig/util';
import { showTypeData } from 'src/pages/worksheet/common/ViewConfig/components/BatchSet';
import { COVER_DISPLAY_FILL } from 'src/pages/worksheet/common/ViewConfig/config.js';
import type { AppDispatch, RootState } from 'src/redux/types';
import { saveLRUWorksheetConfig } from 'src/utils/common';
import { controlState } from 'src/utils/control';
import { checkIsTextControl, controlIsNumber, fieldCanSort, getSortData } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import type { SheetColumnStyle, SheetColumnStyles } from 'src/utils/worksheetTypes';
import { WIDGETS_TO_API_TYPE_ENUM } from '../../../../../widgetConfig/config/widget';
import { publishFilterControl } from '../../../../common/WorkSheetFilter/filterControlEvents';
import { headerContext } from '../../../../common/WorkSheetFilter/filterPanelBoundary';
import type {
  ColumnMenuContext,
  ColumnWidthUpdate,
  WorksheetFilterColumnProps,
} from '../../../../common/WorkSheetFilter/filterPanelTypes';
import './ColumnHead.less';

function getShowTypeData(control: FormControl) {
  if (control.type === WIDGETS_TO_API_TYPE_ENUM.ATTACHMENT) {
    return showTypeData.filter(a => [4, 5, 6].includes(a.value));
  } else if (
    control.type === WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU ||
    control.type === WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN
  ) {
    return showTypeData.filter(a => [0, 1, 2, 3, 7].includes(a.value));
  } else if (control.type === WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT) {
    return showTypeData.filter(a => [0, 7].includes(a.value));
  }
  return undefined;
}

export class ColumnHead extends Component<WorksheetFilterColumnProps> {
  declare context: unknown;
  declare head: EventTarget | undefined;
  static override contextType = SheetContext;
  static override propTypes = {
    rowIsSelected: PropTypes.bool,
    readonly: PropTypes.bool,
    disabledFunctions: PropTypes.arrayOf(PropTypes.string),
    sortControls: PropTypes.arrayOf(PropTypes.shape({})),
    sheetHiddenColumns: PropTypes.arrayOf(PropTypes.string), // 外部传入的视图配置中的隐藏列
    control: PropTypes.shape({}),
    className: PropTypes.string,
    controlId: PropTypes.string,
    viewId: PropTypes.string,
    type: PropTypes.number,
    columnIndex: PropTypes.number,
    fixedColumnCount: PropTypes.number,
    sourceControlType: PropTypes.number,
    hideColumn: PropTypes.func, // 外部传入的隐藏列方法
    clearHiddenColumn: PropTypes.func, // 外部传入的清除隐藏列方法
    frozenColumn: PropTypes.func,
    updateSheetColumnWidths: PropTypes.func,
    onBatchEdit: PropTypes.func,
    sortByControl: PropTypes.func,
    // Redux 中的方法（重命名避免冲突）
    reduxHideColumn: PropTypes.func,
    reduxClearHiddenColumn: PropTypes.func,
    reduxSheetHiddenColumns: PropTypes.arrayOf(PropTypes.string),
  };

  get isAsc() {
    const { control, sortControls } = this.props;
    const sortControl = _.find(sortControls, sort => sort.controlId === control.controlId);
    return sortControl && sortControl.isAsc;
  }

  // 必须写明泛型：createRef() 不带类型参数时 current 是 {}，
  // 而 rc-trigger 5 给 getPopupContainer 补上了准确签名
  // ((node: HTMLElement) => HTMLElement)，四处 `() => this.conRef.current`
  // 就都成了 TS2740。2.6.5 那边这个 prop 是无类型的，所以看不出来。
  conRef = React.createRef<HTMLElement>();

  getType(control: Pick<FormControl, 'type' | 'sourceControlType'>) {
    const { type, sourceControlType } = control;
    let itemType = type;

    if (type === 30) {
      itemType = sourceControlType;
    }

    if (itemType === 38) {
      itemType = 6;
    }

    return itemType;
  }

  changeSortType(controlId: string | undefined, isAsc: boolean | undefined, type: number | undefined) {
    const { sortByControl } = this.props;
    sortByControl({
      controlId,
      datatype: type,
      isAsc,
    });
  }

  handleColumnWidthLRUSave(
    controlId: string | undefined,
    value?: number,
    changes?: Record<string, number | undefined>,
  ) {
    const { readonly, saveColumnStylesToLocal, updateColumnStyles } = this.props;

    if (readonly) return;

    if (changes) {
      const newChanges: SheetColumnStyles = _.reduce<Record<string, number | undefined>, SheetColumnStyles>(
        changes,
        (acc, width, controlId) => {
          acc[controlId] = { width };
          return acc;
        },
        {},
      );
      saveColumnStylesToLocal(newChanges);
      updateColumnStyles(newChanges);
      return;
    }

    saveColumnStylesToLocal({ [String(controlId)]: { width: value } });
    updateColumnStyles({ [String(controlId)]: { width: value } });
  }

  changeSort = (newIsAsc?: boolean) => {
    const { updateDefaultScrollLeft } = this.props;
    const { controlId, sourceControlType, type } = this.props.control;
    this.changeSortType(controlId, newIsAsc, this.getType({ sourceControlType, type }));
    updateDefaultScrollLeft();
  };

  frozen(index: number) {
    const { isTreeTableView, readonly, viewId, frozenColumn } = this.props;

    if (isTreeTableView && index > 0) {
      index = index - 1;
    }

    frozenColumn(index);
    if (readonly) return;
    saveLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', viewId, new Date().getTime());
    saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', viewId, index);
  }

  updateColumnWidth = ({ controlId, value }: ColumnWidthUpdate) => {
    const { updateSheetColumnWidths } = this.props;
    this.handleColumnWidthLRUSave(controlId, value);
    updateSheetColumnWidths({ controlId, value });
  };

  updateColumnStyle = ({
    controlId,
    key,
    value,
  }: {
    controlId?: string | undefined;
    key: 'direction' | 'showtype' | 'coverFillType';
    value: number;
  }) => {
    const { saveColumnStylesToLocal, updateColumnStyles } = this.props;

    if (!get(window, 'shareState.shareId')) {
      saveColumnStylesToLocal({ [String(controlId)]: { [key]: value } });
    }

    updateColumnStyles({ [String(controlId)]: { [key]: value } });
  };

  getPopupContainer = (): HTMLElement => {
    const element = this.conRef.current;
    if (!element) throw new TypeError('Missing worksheet column menu container');
    return element;
  };

  override render() {
    const {
      className,
      type = '',
      worksheetId = '',
      viewId = '',
      disabled,
      showRequired,
      count,
      style,
      isLast,
      isCharge,
      allWorksheetIsSelected,
      sheetSelectedRows = [],
      disabledFunctions = [],
      rowIsSelected,
      columnIndex,
      fixedColumnCount,
      sheetHiddenColumns = [], // 外部传入的视图配置中的隐藏列
      hideColumn, // 外部传入的隐藏列方法
      clearHiddenColumn, // 外部传入的清除隐藏列方法
      onBatchEdit,
      canBatchEdit = true,
      columnStyles = {},
      fromEmbed,
      rows = [],
      columns = [],
      updateSheetColumnWidths,
      onShowFullValue = () => {},
      onBatchSetColumns = () => {},
      scrollToLeftStart = () => {},
      // Redux 中的方法
      reduxHideColumn = () => {},
      reduxClearHiddenColumn = () => {},
      reduxSheetHiddenColumns = [],
    } = this.props;

    // 判断是否是对外分享状态

    // 如果是分享模式，强制使用 redux 中的方法和数据  否则，优先使用外部传入的方法，没有则使用 redux 中的方法
    const finalHideColumn =
      hideColumn ||
      ((id: string | undefined) => {
        if (id === undefined) throw new TypeError('Missing column hide ID');
        return reduxHideColumn(id);
      });
    const finalClearHiddenColumn = clearHiddenColumn || reduxClearHiddenColumn;
    const finalSheetHiddenColumns = hideColumn && clearHiddenColumn ? sheetHiddenColumns : reduxSheetHiddenColumns;
    const { hideColumnFilter, isSingleView } = headerContext(this.context);
    let control: WorksheetFilterColumnProps['control'] = { ...this.props.control };
    const columnStyle: SheetColumnStyle = columnStyles[String(control.controlId)] || {};
    const direction = isUndefined(columnStyle.direction) ? (controlIsNumber(control) ? 2 : 0) : columnStyle.direction;
    const showtype = !isUndefined(columnStyle.showtype)
      ? columnStyle.showtype
      : (control.type === 30 ? control.sourceControlType : control.type) === WIDGETS_TO_API_TYPE_ENUM.ATTACHMENT
        ? 6
        : _.get(control, 'advancedSetting.showtype') === '2'
          ? 2
          : 0;
    const coverFillType = !isUndefined(columnStyle.coverFillType) ? columnStyle.coverFillType : 0;
    const isShowOtherField = isOtherShowFeild(control);
    const itemType = this.getType(control);
    const canSort = fieldCanSort(itemType, control);
    const canEdit =
      _.includes(CONTROL_EDITABLE_WHITELIST, control.type) &&
      controlState(control).editable &&
      canBatchEdit &&
      !SYS.filter(o => o !== 'ownerid').some(id => id === control.controlId); //系统字段(除了拥有者字段)，不可编辑
    const filterWhiteKeys = _.flatten(Object.values(CONTROL_FILTER_WHITELIST).map(group => group.keys));
    let canFilter =
      _.includes(filterWhiteKeys, itemType) &&
      !_.includes(disabledFunctions, 'filter') &&
      !window.hideColumnHeadFilter &&
      !fromEmbed;

    if (control.type === 30 && control.strDefault === '10') {
      canFilter = false;
    }

    const maskData =
      !(
        _.get(window, 'shareState.isPublicView') ||
        _.get(window, 'shareState.isPublicPage') ||
        _.get(window, 'shareState.isPublicRecord')
      ) &&
      _.get(control, 'advancedSetting.datamask') === '1' &&
      _.get(control, 'advancedSetting.isdecrypt') === '1';
    control = redefineComplexControl(control);
    const allowSetAlign = WORKSHEET_ALLOW_SET_ALIGN_CONTROLS.some(type => type === control.type);
    return (
      <BaseColumnHead
        showRequired={showRequired}
        rows={rows}
        worksheetId={worksheetId}
        disabled={disabled}
        columnIndex={columnIndex}
        className={className}
        style={style}
        control={control}
        showDropdown={!!control.controlId}
        isLast={isLast}
        isAsc={this.isAsc}
        columnStyle={columnStyle}
        changeSort={this.changeSort}
        updateSheetColumnWidths={this.updateColumnWidth}
        renderPopup={({ closeMenu }: ColumnMenuContext) => (
          <Menu
            className="worksheetColumnHeadMenu"
            style={{ width: 180 }}
            specialFilter={(target: EventTarget | null) => target === this.head}
            onClickAway={closeMenu}
            setRef={this.conRef}
          >
            {canSort &&
              !isShowOtherField &&
              getSortData(itemType, control).map(item => (
                <MenuItem
                  key={item.value}
                  onClick={() => {
                    this.changeSort(item.value === 2);
                    closeMenu();
                  }}
                >
                  <i className={cx('icon', item.value === 1 ? 'icon-descending-order2' : 'icon-ascending-order2')}></i>
                  {item.text}
                </MenuItem>
              ))}
            {canEdit && rowIsSelected && (
              <MenuItem
                onClick={() => {
                  if (window.isPublicApp) {
                    alert(_l('预览模式下，不能操作'), 3);
                    return;
                  }

                  const selectedLength = allWorksheetIsSelected
                    ? count - sheetSelectedRows.length
                    : sheetSelectedRows.length;

                  if (selectedLength > 1000) {
                    Dialog.confirm({
                      title: (
                        <span style={{ fontWeight: 500, lineHeight: '1.5em' }}>
                          {_l('最大支持批量执行1000行记录，是否只选中并执行前1000行数据？')}
                        </span>
                      ),
                      onOk: () => onBatchEdit(control),
                    });
                  } else {
                    onBatchEdit(control);
                  }

                  closeMenu();
                }}
              >
                <i className="icon icon-hr_edit"></i>
                {_l('编辑选中记录')}
              </MenuItem>
            )}
            {canFilter && !rowIsSelected && !isShowOtherField && !hideColumnFilter && (
              <MenuItem
                onClick={() => {
                  publishFilterControl(
                    'FILTER_ADD_FROM_COLUMNHEAD' + worksheetId + type + (isSingleView ? viewId : ''),
                    control,
                  );
                  closeMenu();
                }}
              >
                <i className="icon icon-worksheet_filter"></i>
                {_l('筛选')}
              </MenuItem>
            )}
            {maskData && (
              <MenuItem onClick={onShowFullValue}>
                <i className="icon icon-eye_off"></i>
                {_l('解码')}
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                if (window.isPublicApp) {
                  alert(_l('预览模式下，不能操作'), 3);
                  return;
                }

                finalHideColumn(control.controlId);
                closeMenu();
              }}
            >
              <i className="icon icon-visibility_off"></i>
              {_l('隐藏')}
            </MenuItem>
            {!!finalSheetHiddenColumns?.length && (
              <MenuItem
                onClick={() => {
                  finalClearHiddenColumn();
                  closeMenu();
                }}
              >
                <i className="icon icon-eye"></i>
                {_l('显示所有列')}
              </MenuItem>
            )}
            {columnIndex !== undefined &&
              columnIndex < 11 &&
              !control.hideFrozen &&
              fixedColumnCount !== columnIndex + 1 && (
                <MenuItem
                  onClick={() => {
                    if (window.isPublicApp) {
                      alert(_l('预览模式下，不能操作'), 3);
                      return;
                    }

                    this.frozen(columnIndex);
                    closeMenu();
                  }}
                >
                  <i className="icon icon-lock"></i>
                  {_l('冻结')}
                </MenuItem>
              )}
            {fixedColumnCount !== undefined && columnIndex === fixedColumnCount - 1 && !control.hideFrozen && (
              <MenuItem
                onClick={() => {
                  this.frozen(0);
                  closeMenu();
                }}
              >
                <i className="icon icon-task-new-no-locked"></i>
                {_l('解冻')}
              </MenuItem>
            )}
            {(isCharge || checkIsTextControl(control.type)) && <hr />}
            {isCharge && (
              <Trigger
                getPopupContainer={this.getPopupContainer}
                popupClassName="Relative"
                action={['hover']}
                popupPlacement="bottom"
                popupAlign={{
                  points: isLast ? ['tr', 'tl'] : ['tl', 'tr'],
                  offset: [0, -6],
                  overflow: { adjustX: true, adjustY: true },
                }}
                popup={
                  <Menu className="columnHeadChangeAlign">
                    {(allowSetAlign
                      ? [
                          {
                            name: _l('左对齐'),
                            value: 0,
                          },
                          {
                            name: _l('居中'),
                            value: 1,
                          },
                          {
                            name: _l('右对齐'),
                            value: 2,
                          },
                        ]
                      : [
                          {
                            name: _l('左对齐'),
                            value: 0,
                          },
                          {
                            name: _l('居中'),
                            value: 1,
                          },
                        ]
                    ).map(({ value, name }, index) => (
                      <MenuItem
                        key={index}
                        className={cx({ active: direction === value })}
                        onClick={() => {
                          this.updateColumnStyle({ controlId: control.controlId, key: 'direction', value });
                          closeMenu();
                        }}
                      >
                        <div className="flexRow">
                          {name}
                          {!allowSetAlign && value === 1 && <span className="sec">{_l('(仅字段名称)')}</span>}
                          <div className="flex"></div>
                          {direction === value && <Icon icon="done" className="mRight12 Relative" />}
                        </div>
                      </MenuItem>
                    ))}
                  </Menu>
                }
              >
                <MenuItem
                  onClick={() => {
                    closeMenu();
                  }}
                >
                  <i className="icon icon-format_align_left"></i>
                  {_l('对齐')}
                  <i
                    className="icon icon-arrow-right-tip Right"
                    style={{
                      fontSize: 12,
                      marginTop: 12,
                      marginRight: -8,
                    }}
                  ></i>
                </MenuItem>
              </Trigger>
            )}
            {isCharge &&
              [
                WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU,
                WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN,
                WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT,
                WIDGETS_TO_API_TYPE_ENUM.ATTACHMENT,
              ].some(type => type === control.type) && (
                <Trigger
                  getPopupContainer={this.getPopupContainer}
                  popupClassName="Relative"
                  action={['hover']}
                  popupPlacement="bottom"
                  popupAlign={{
                    points: isLast ? ['tr', 'tl'] : ['tl', 'tr'],
                    offset: [0, -6],
                    overflow: { adjustX: true, adjustY: true },
                  }}
                  popup={
                    <Menu className="columnHeadChangeAlign Relative">
                      {requiredShowTypeData(control).map(({ value, text }, index) => (
                        <MenuItem
                          key={index}
                          className={cx({ active: showtype === value })}
                          onClick={() => {
                            this.updateColumnStyle({ controlId: control.controlId, key: 'showtype', value });
                            closeMenu();
                          }}
                        >
                          <div className="flexRow">
                            <div className="flex">{text}</div>
                            {showtype === value && <Icon icon="done" className="mRight12 Relative" />}
                          </div>
                        </MenuItem>
                      ))}
                      {control.type === 14 && showtype !== 6 && (
                        <Trigger
                          getPopupContainer={this.getPopupContainer}
                          popupClassName="Relative"
                          action={['hover']}
                          popupPlacement="bottom"
                          popupAlign={{
                            points: isLast ? ['tr', 'tl'] : ['tl', 'tr'],
                            offset: [0, -6],
                            overflow: { adjustX: true, adjustY: true },
                          }}
                          popup={
                            <Menu className="columnHeadChangeAlign" style={{ width: 220 }}>
                              {COVER_DISPLAY_FILL.map(({ text, value }, index) => (
                                <MenuItem
                                  key={index}
                                  className={cx({ active: coverFillType === value })}
                                  onClick={() => {
                                    this.updateColumnStyle({
                                      controlId: control.controlId,
                                      key: 'coverFillType',
                                      value,
                                    });
                                    closeMenu();
                                  }}
                                >
                                  <div className="flexRow">
                                    <div className="flex">{text}</div>
                                    {coverFillType === value && <Icon icon="done" className="mRight12 Relative" />}
                                  </div>
                                </MenuItem>
                              ))}
                            </Menu>
                          }
                        >
                          <MenuItem
                            onClick={() => {
                              closeMenu();
                            }}
                          >
                            {_l('图片填充方式')}
                            <i
                              className="icon icon-arrow-right-tip Right"
                              style={{
                                fontSize: 12,
                                marginTop: 12,
                                marginRight: -8,
                              }}
                            ></i>
                          </MenuItem>
                        </Trigger>
                      )}
                    </Menu>
                  }
                >
                  <MenuItem
                    onClick={() => {
                      closeMenu();
                    }}
                  >
                    <i className="icon icon-task-color"></i>
                    {_l('样式')}
                    <i
                      className="icon icon-arrow-right-tip Right"
                      style={{
                        fontSize: 12,
                        marginTop: 12,
                        marginRight: -8,
                      }}
                    ></i>
                  </MenuItem>
                </Trigger>
              )}
            <Trigger
              getPopupContainer={this.getPopupContainer}
              action={['hover']}
              popupPlacement="bottom"
              popupAlign={{
                points: ['tl', 'tr'],
                offset: [0, -6],
                overflow: { adjustX: true, adjustY: true },
              }}
              autoDestroy={true}
              popup={
                <div className="changeColumnWidthPanel">
                  <MenuItem
                    onClick={() => {
                      const width = getTableColumnWidth(
                        document.querySelector('.sheetViewTable'),
                        rows,
                        control,
                        columnStyle,
                        worksheetId,
                      );
                      this.updateColumnWidth({ controlId: control.controlId, value: width });
                      closeMenu();
                    }}
                  >
                    {_l('适合内容（当前列）')}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      const changes: Record<string, number | undefined> = {};
                      columns.forEach(o => {
                        const width = getTableColumnWidth(
                          document.querySelector('.sheetViewTable'),
                          rows,
                          o,
                          columnStyle,
                          worksheetId,
                        );
                        changes[String(o.controlId)] = width;
                      });
                      this.handleColumnWidthLRUSave(undefined, undefined, changes);
                      updateSheetColumnWidths({ changes });
                      setTimeout(() => {
                        scrollToLeftStart();
                      }, 100);
                      closeMenu();
                    }}
                  >
                    {_l('适合内容（所有列）')}
                  </MenuItem>
                  <div className="customInputWrap">
                    <div className="customInputTitle">{_l('指定列宽')}</div>
                    <Input
                      className="w100"
                      defaultValue={requiredColumnStyle(style).width}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        let newWidth = Number(e.target.value);

                        if (isNaN(newWidth)) {
                          return;
                        }

                        if (newWidth < 60) {
                          newWidth = 60;
                        }

                        if (newWidth > 600) {
                          newWidth = 600;
                        }

                        this.updateColumnWidth({ controlId: control.controlId, value: newWidth });
                        closeMenu();
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          let newWidth = Number(e.currentTarget.value);

                          if (isNaN(newWidth)) {
                            return;
                          }

                          if (newWidth < 60) {
                            newWidth = 60;
                          }

                          if (newWidth > 600) {
                            newWidth = 600;
                          }

                          this.updateColumnWidth({ controlId: control.controlId, value: newWidth });
                          closeMenu();
                        }
                      }}
                    />
                    <div className="px">px</div>
                  </div>
                </div>
              }
            >
              <MenuItem>
                <i className="icon icon-sheets_rtl"></i>
                {_l('列宽')}
                <i
                  className="icon icon-arrow-right-tip Right"
                  style={{
                    fontSize: 12,
                    marginTop: 12,
                    marginRight: -8,
                  }}
                ></i>
              </MenuItem>
            </Trigger>
            {isCharge && (
              <MenuItem
                onClick={() => {
                  onBatchSetColumns();
                  closeMenu();
                }}
              >
                <i className="icon icon-align_setting"></i>
                {_l('批量设置')}
              </MenuItem>
            )}
          </Menu>
        )}
      />
    );
  }
}

function requiredColumnStyle(style: React.CSSProperties | undefined) {
  if (!style) throw new TypeError('Missing worksheet column style');
  return style;
}
function requiredShowTypeData(control: FormControl) {
  const values = getShowTypeData(control);
  if (!values) throw new TypeError('Unsupported worksheet column style');
  return values;
}

const mapStateToProps = (state: RootState) => ({
  reduxSheetHiddenColumns: state.sheet.sheetview.sheetViewConfig.sheetHiddenColumns,
  sortControls: state.sheet.sheetview.sheetFetchParams.sortControls,
  allWorksheetIsSelected: state.sheet.sheetview.sheetViewConfig.allWorksheetIsSelected,
  sheetSelectedRows: state.sheet.sheetview.sheetViewConfig.sheetSelectedRows,
  columnStyles: state.sheet.sheetview.sheetViewConfig.columnStyles,
  rows: state.sheet.sheetview.sheetViewData.rows,
  worksheetInfo: state.sheet.worksheetInfo,
});

const mapDispatchToProps = (dispatch: AppDispatch) =>
  bindActionCreators(
    {
      reduxHideColumn: hideColumn,
      reduxClearHiddenColumn: clearHiddenColumn,
      frozenColumn,
      sortByControl,
      updateColumnStyles,
      saveColumnStylesToLocal,
    },
    dispatch,
  );

export default connect(mapStateToProps, mapDispatchToProps)(ColumnHead);
