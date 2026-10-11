import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { ROW_ID_CONTROL } from 'src/pages/widgetConfig/config/widget';
import { addConditionWidgetType } from './detailBoundary';
import type { AddConditionProps, AddConditionState } from './detailTypes';
import SelectControls from './SelectControls';

export type { AddConditionProps } from './detailTypes';

export default class AddCondition extends Component<AddConditionProps, AddConditionState> {
  declare box: HTMLDivElement | null | undefined;

  static override propTypes = {
    defaultVisible: PropTypes.bool,
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    onAdd: PropTypes.func,
    from: PropTypes.string, // 来源
  };
  constructor(props: AddConditionProps) {
    super(props);
    this.state = {
      columnListVisible: _.isUndefined(props.defaultVisible) ? false : props.defaultVisible,
    };
  }

  override componentDidUpdate(prevProps: AddConditionProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (
        this.props.from === 'fastFilter' &&
        this.props.defaultVisible !== this.state.columnListVisible &&
        !_.isUndefined(this.props.defaultVisible)
      ) {
        this.setState({
          columnListVisible: this.props.defaultVisible,
        });
      }
    }
  }

  override render() {
    let {
      disabled,
      from,
      doNotCloseMenuWhenAdd,
      columns = [],
      isAppendToBody,
      onAdd,
      children,
      renderInParent,
      conditionCount,
      filterColumnClassName,
      widgetControlData = {},
    } = this.props;
    const { columnListVisible } = this.state;

    // 关联记录、查询记录（非聚合表）支持rowId,查询工作表也只支持rowid
    if (
      from === 'relateSheet' &&
      !_.find(columns, { controlId: 'rowid' }) &&
      (_.isEmpty(widgetControlData) ||
        (_.includes([29, 35, 51], addConditionWidgetType(widgetControlData)) &&
          _.get(widgetControlData, 'advancedSetting.querytype') !== '1'))
    ) {
      columns = columns.concat(ROW_ID_CONTROL);
    }

    if (md.global.Account.isPortal) {
      columns = columns.filter(item => !_.includes(['ownerid', 'caid', 'uaid'], item.controlId));
    }

    return (
      <div className={cx('Hand addFilterCondition', { nodata: !conditionCount, active: columnListVisible })}>
        <Trigger
          action={['click']}
          popupVisible={columnListVisible}
          popup={
            <SelectControls
              style={this.props.style}
              controls={columns}
              className={this.props.classNamePopup}
              filterColumnClassName={filterColumnClassName}
              visible={columnListVisible}
              onAdd={control => {
                onAdd(control);
                if (from !== 'fastFilter' && !doNotCloseMenuWhenAdd) {
                  this.setState({ columnListVisible: false });
                }
              }}
              onClose={() => {
                this.setState({ columnListVisible: false });
              }}
            />
          }
          getPopupContainer={target => (renderInParent && !isAppendToBody ? this.box || target : document.body)}
          popupAlign={
            this.props.popupAlign || {
              points: ['tl', 'bl'],
              offset: this.props.offset ? this.props.offset : [0, 12],
              overflow: {
                adjustX: true,
                adjustY: true,
              },
            }
          }
        >
          <div
            ref={con => {
              this.box = con;
            }}
            onClick={() => {
              if (disabled) {
                return;
              }

              this.setState({ columnListVisible: true });
            }}
          >
            {children ||
              (this.props.comp ? (
                this.props.comp()
              ) : (
                <React.Fragment>
                  <i className="icon icon-add"></i>
                  {_l('添加筛选条件')}
                </React.Fragment>
              ))}
          </div>
        </Trigger>
      </div>
    );
  }
}
