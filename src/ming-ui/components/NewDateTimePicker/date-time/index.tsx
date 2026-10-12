import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import moment from 'moment';
import PropTypes from 'prop-types';
import DateTimePicker from 'ming-ui/components/NewDateTimePicker/date-time-picker';
import PositionContainer from 'ming-ui/components/PositionContainer';
import LibCalender from '../lib/calender';
import { decodeDate, displayDate } from '../types';
import type { DateTimeProps, HeaderEvent, PublicDateState } from '../types';
import './style.less';

export interface DateTimeState extends PublicDateState {}

class DateTime extends Component<DateTimeProps, DateTimeState> {
  static defaultProps: Partial<DateTimeProps> = {
    mode: 'date',
    timePicker: false,
    timeMode: 'minute',
    allowClear: true,
    firstDayOfWeek: 1,
    selectedValue: null,
    min: null,
    max: null,
    defaultVisible: false,
    disabled: false,
    placement: 'bottom',
    onOk: () => {},
    onClear: () => {},
    onSelect: () => {},
  };
  declare _picker: HTMLSpanElement | null | undefined;

  constructor(props: DateTimeProps) {
    super(props);

    const mode = props.timePicker ? 'datetime' : props.mode;

    const selectedValue = decodeDate(props.selectedValue);

    this.state = {
      /**
       * 当前值
       */
      value: selectedValue,
      /**
       * 显示文本
       */
      label: selectedValue
        ? (displayDate(selectedValue, mode, props.timeMode, props) ??
          LibCalender.formatTime(selectedValue, mode, props.timeMode))
        : props.placeholder || '',
      /**
       * 菜单是否展开
       */
      menuOpened: false,
      bounding: null,
    };
  }

  override componentDidMount() {
    if (this.props.defaultVisible) {
      this.showMenu();
    }
  }

  override componentDidUpdate(prevProps: DateTimeProps) {
    if (shallowEqual(prevProps, this.props)) return;
    const value =
      prevProps.selectedValue !== this.props.selectedValue ? decodeDate(this.props.selectedValue) : this.state.value;
    const mode = this.props.timePicker ? 'datetime' : this.props.mode;
    this.setState({
      value,
      label: value
        ? (displayDate(value, mode, this.props.timeMode, this.props) ??
          LibCalender.formatTime(value, mode, this.props.timeMode))
        : this.props.placeholder || '',
    });
    if (this.props.disabled && this.state.menuOpened) this.hideMenu();
  }

  showMenu = () => {
    if (this.props.disabled || !this._picker) return;
    this.setState({
      menuOpened: true,
      bounding: this._picker.getBoundingClientRect(),
    });
  };

  hideMenu = () => {
    this.setState({
      menuOpened: false,
    });
  };

  toggleMenuOpened = () => {
    if (this.props.disabled || !this._picker) {
      return;
    }

    this.setState({
      menuOpened: !this.state.menuOpened,
      bounding: this._picker.getBoundingClientRect(),
    });
  };

  onChange = (_event: HeaderEvent, value: Date | null) => {
    let newValue = null;
    let label = this.props.placeholder || '';
    const mode = this.props.timePicker ? 'datetime' : this.props.mode;

    if (value) {
      newValue = new Date(value);
      label =
        displayDate(value, mode, this.props.timeMode, this.props) ??
        LibCalender.formatTime(value, mode, this.props.timeMode);
    }

    this.setState({
      value: newValue,
      label,
      menuOpened: false,
    });
  };

  override render() {
    const min = decodeDate(this.props.min);
    const max = decodeDate(this.props.max);

    const mode = this.props.timePicker ? 'datetime' : this.props.mode;

    const pickerClassList = ['mui-datetime-picker'];

    if (this.props.disabled) {
      pickerClassList.push('disabled');
    }

    const pickerClassNames = pickerClassList.join(' ');
    let button = (
      <span
        ref={picker => {
          this._picker = picker;
        }}
        className={pickerClassNames}
        aria-disabled={this.props.disabled}
        onClick={this.toggleMenuOpened}
      >
        <span>{this.state.label}</span>
      </span>
    );

    if (this.props.children) {
      button = (
        <span
          ref={picker => {
            this._picker = picker;
          }}
          className={pickerClassNames}
          aria-disabled={this.props.disabled}
          onClick={this.toggleMenuOpened}
        >
          {this.props.children}
        </span>
      );
    }

    return (
      <div className={['mui-datetime-base', this.props.className].filter(Boolean).join(' ')} style={this.props.style}>
        {button}
        <PositionContainer
          popupParentNode={this.props.popupParentNode}
          onClickAwayExceptions={[this._picker]}
          placement={this.props.placement || 'bottom'}
          bounding={this.state.bounding}
          visible={this.state.menuOpened}
          offset={this.props.offset}
          onHide={() => {
            this.hideMenu();
          }}
        >
          <DateTimePicker
            type={mode}
            timeType={this.props.timeMode}
            allowClear={this.props.allowClear}
            firstDayOfWeek={this.props.firstDayOfWeek}
            disabledDate={this.props.disabledDate ? date => this.props.disabledDate?.(moment(date)) : undefined}
            min={min}
            max={max}
            value={this.state.value}
            onChange={(event, value) => {
              this.onChange(event, value);
            }}
            onOk={this.props.onOk}
            onClear={this.props.onClear}
            onSelect={this.props.onSelect}
          />
        </PositionContainer>
      </div>
    );
  }
}

DateTime.propTypes = {
  /**
   * 出现的位置，上 下
   */
  placement: PropTypes.oneOf(['top', 'bottom']),
  /**
   * 替换元素
   */
  children: PropTypes.any,
  /**
   * 选择类型
   */
  mode: PropTypes.oneOf([
    'year', // 年
    'month', // 月
    'date', // 日
    'datetime', // YYYY-MM-DD HH:mm:ss
  ]),
  /**
   * 是否显示时间选择
   * = mode="datetime"
   */
  timePicker: PropTypes.bool,
  /**
   * 时间类型
   */
  timeMode: PropTypes.oneOf([
    'hour', // HH
    'minute', // HH:mm
    'second', // HH:mm:ss
  ]),
  /**
   * 是否允许清除
   */
  allowClear: PropTypes.bool,
  /**
   * 每周的第一天
   */
  firstDayOfWeek: PropTypes.oneOf([
    0, // 周日
    1, // 周一
    2,
    3,
    4,
    5,
    6, // 周六
  ]),
  /**
   * 当前值
   */
  selectedValue: PropTypes.any,
  /**
   * 初始是否可见
   */
  defaultVisible: PropTypes.bool,
  /**
   * 是否禁用
   */
  disabled: PropTypes.bool,
  /**
   * 偏移
   */
  offset: PropTypes.shape({}),
  /**
   * 指定弹层创建的位置，默认是body下
   */
  popupParentNode: PropTypes.func,
  /**
   * 确定选择
   * @param {object} time - 选中的时间
   */
  onOk: PropTypes.func,
  /**
   * 清除选择
   */
  onClear: PropTypes.func,
  /**
   * 值发生改变
   * @param {object} time - 选中的时间
   */
  onSelect: PropTypes.func,
};

export default DateTime;
