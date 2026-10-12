import React, { Component } from 'react';
import type { ReactElement, ReactNode } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import Menu from 'ming-ui/components/Menu';
import MenuItem from 'ming-ui/components/MenuItem';
import PositionContainer from 'ming-ui/components/PositionContainer';
import { getDomNode } from '../ClickAway';
import type { PositionBounding } from '../PositionContainer';
import type { TimeTriggerProps } from '../TimePicker/types';
import CalendarRange from './CalendarRange';
import locale from './locale/zh_CN';
import type { CalendarRangeProps, DateRangeValue } from './types';
import '../less/DateDropdDown.less';

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

export interface DateMenuOption<V> {
  value: V;
  text: ReactNode;
  disabled?: boolean | undefined;
}
interface MenuCalendarProps extends Pick<CalendarRangeProps, 'locale' | 'timePicker'> {
  onOk?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  onSelect?: ((value: DateRangeValue) => void) | undefined;
}
export interface DateDropdDownProps<V> {
  data?: readonly DateMenuOption<V>[] | undefined;
  calendarProps?: MenuCalendarProps | undefined;
  defaultActiveKey?: V | 'customDate' | undefined;
  children?: ReactElement<TimeTriggerProps> | undefined;
  disabled?: boolean | undefined;
  popupParentNode?: CalendarRangeProps['popupParentNode'];
  onChange?: ((value: V | 'customDate') => void) | undefined;
}
interface DateDropdDownState<V> {
  dateValue: DateRangeValue;
  bounding: PositionBounding | null;
  visibleMenu: boolean;
  visibleRange: boolean;
  activeKey: V | 'customDate' | undefined;
}
class DateDropdDown<V = unknown> extends Component<DateDropdDownProps<V>, DateDropdDownState<V>> {
  declare _picker: Element | null | undefined;
  static override propTypes = {
    /**
     * 日历属性
     */
    calendarProps: PropTypes.objectOf(
      PropTypes.shape({
        /**
         * 选中时间触发的回调
         */
        onSelect: PropTypes.func,
        /**
         * 点击确定按钮触发的回调
         */
        onOk: PropTypes.func,
        /**
         * 点击清除触发的回调
         */
        onClear: PropTypes.func,
        /**
         * 点击清除触发的回调
         */
        timePicker: PropTypes.bool,
      }),
    ),
    /**
     * 默认激活项
     */
    defaultActiveKey: PropTypes.node,
    /**
     * 触发元素
     */
    children: PropTypes.node,
    /**
     * 是否禁用
     */
    disabled: PropTypes.bool,
    /**
     * 指定弹层创建的位置，默认是body下
     */
    popupParentNode: PropTypes.func,
    /**
     * 下拉菜单的数据
     */
    data: PropTypes.arrayOf(
      PropTypes.shape({
        /**
         * 文本
         */
        text: PropTypes.node,
        /**
         * 接收任何类型，并返回原始值
         */
        value: PropTypes.any,
        /**
         * 是否禁用
         */
        disabled: PropTypes.bool,
      }),
    ),
    /**
     * 回调，参数为选中item的value值
     */
    onChange: PropTypes.func,
  };

  static defaultProps = {
    data: [],
    onChange: () => {},
    children: <span>{_l('请选择')}</span>,
    calendarProps: { locale, onOk: () => {}, onSelect: () => {}, onClear: () => {}, timePicker: false },
  };

  constructor(props: DateDropdDownProps<V>) {
    super(props);

    this.state = {
      dateValue: [],
      bounding: null,
      visibleMenu: false,
      visibleRange: false,
      activeKey: props.defaultActiveKey,
    };
  }

  getChildrenElement = () => {
    const props = this.props;
    return React.cloneElement(props.children || <span>{_l('请选择')}</span>, {
      onClick: !props.disabled ? this.handleClick : undefined,
      ref: (picker: unknown) => {
        const node = getDomNode(picker);
        this._picker = node && isElement(node) ? node : null;
      },
    });
  };

  getMenuElement = () => {
    const props = this.props;
    const state = this.state;

    const menuItems = (props.data || []).map((item, index: number) => {
      const cls = classNames({
        active: item.value === state.activeKey,
      });
      return (
        <MenuItem
          disabled={item.disabled}
          value={typeof item.value === 'string' || typeof item.value === 'number' ? item.value : undefined}
          key={index}
          className={cls}
          data-value={item.value}
          onClick={this.handleChange.bind(this, item.value)}
        >
          <div>{item.text}</div>
        </MenuItem>
      );
    });

    menuItems.push(
      <MenuItem
        key="customDate"
        data-value="customDate"
        onClick={this.handleSelectRange}
        className={classNames({ active: state.activeKey === 'customDate' })}
      >
        {_l('自定义日期')}
      </MenuItem>,
    );

    return (
      <div className="DateDropDown">
        <Menu className="DateDropDown-menu">{menuItems}</Menu>
      </div>
    );
  };

  getCalendarElement = () => {
    const props = this.props;
    const state = this.state;
    const { timePicker } = props.calendarProps || {};
    return (
      <CalendarRange
        prefixCls="Calendar"
        locale={locale}
        timePicker={timePicker}
        selectedValue={state.dateValue}
        defaultValue={state.dateValue}
        onOk={this.handleCalendarOk}
        onClear={this.handleCalendarClear}
        onSelect={this.handleCalendarSelect}
      />
    );
  };

  handleChange = (value: V) => {
    if (this.props.disabled || this.props.data?.some(item => Object.is(item.value, value) && item.disabled)) return;
    this.setState({
      activeKey: value,
      visibleMenu: false,
    });
    this.props.onChange?.(value);
  };

  handleSelectRange = () => {
    if (this.props.disabled) return;
    this.setState({
      visibleRange: true,
      visibleMenu: false,
      activeKey: 'customDate',
    });
    this.props.onChange?.('customDate');
  };

  handleClick = () => {
    if (this.props['disabled'] || !this._picker) return;
    this.setState({
      visibleMenu: true,
      bounding: this._picker.getBoundingClientRect(),
    });
  };

  handleCloseMenu = () => {
    this.setState({ visibleMenu: false });
  };

  handleCloseRange = () => {
    this.setState({ visibleRange: false });
  };

  handleCalendarOk = () => {
    const calendarProps = this.props.calendarProps;

    if (calendarProps && calendarProps.onOk) {
      calendarProps.onOk();
    }

    this.handleCloseRange();
  };

  handleCalendarClear = () => {
    const calendarProps = this.props.calendarProps;

    if (calendarProps && calendarProps.onClear) {
      calendarProps.onClear();
    }

    this.handleCloseRange();
  };

  handleCalendarSelect = (dateValue: DateRangeValue) => {
    this.setState({ dateValue, visibleRange: true });
    const calendarProps = this.props.calendarProps;

    if (calendarProps && calendarProps.onSelect) {
      calendarProps.onSelect(dateValue);
    }
  };

  override render() {
    const props = this.props;
    const state = this.state;

    return (
      <span className="DateDropDown DateDropDown-input">
        {this.getChildrenElement()}
        <PositionContainer
          key="dropdown"
          placement="bottom"
          onHide={this.handleCloseMenu}
          visible={state.visibleMenu}
          bounding={state.bounding}
          popupParentNode={props.popupParentNode}
          onClickAwayExceptions={[this._picker]}
        >
          {this.getMenuElement()}
        </PositionContainer>
        <PositionContainer
          key="daterange"
          placement="bottom"
          onHide={this.handleCloseRange}
          visible={state.visibleRange}
          bounding={state.bounding}
          popupParentNode={props.popupParentNode}
          onClickAwayExceptions={[this._picker]}
        >
          {this.getCalendarElement()}
        </PositionContainer>
      </span>
    );
  }
}

export default DateDropdDown;
