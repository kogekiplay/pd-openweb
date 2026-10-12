import { Component } from 'react';
import type { Ref } from 'react';
import { shallowEqual } from 'react-redux';
import moment from 'moment';
import PropTypes from 'prop-types';
import DateTimeRangePicker from 'ming-ui/components/NewDateTimePicker/date-time-range-picker';
import PositionContainer from 'ming-ui/components/PositionContainer';
import LibCalender from '../lib/calender';
import { decodeDate, displayDate } from '../types';
import type {
  DateTimeRangeProps,
  HalfPair,
  HeaderEvent,
  MomentRange,
  NullableDatePair,
  PickerMode,
  PublicRangeState,
  RangeConfig,
} from '../types';
import './style.less';

class DateTimeRange extends Component<DateTimeRangeProps, PublicRangeState> {
  static defaultProps: Partial<DateTimeRangeProps> = {
    mode: 'date',
    timePicker: false,
    timeMode: 'minute',
    halfData: ['AM', 'PM'],
    allowClear: true,
    firstDayOfWeek: 1,
    selectedValue: null,
    min: null,
    max: null,
    defaultVisible: false,
    disabled: false,
    placeholder: _l('请选择'),
    offset: {
      top: 0,
      left: 0,
    },
    onOk: () => {},
    onClear: () => {},
    onSelect: () => {},
    onVisibleChange: () => {},
    autoFillEndTime: 0,
  };
  declare _picker: HTMLSpanElement | null | undefined;

  constructor(props: DateTimeRangeProps) {
    super(props);

    this.state = this.generateState(props);
  }

  override componentDidMount() {
    if (this.props.defaultVisible) {
      this.showMenu();
    }
  }

  override componentDidUpdate(prevProps: DateTimeRangeProps) {
    if (shallowEqual(prevProps, this.props)) return;
    if (prevProps.selectedValue !== this.props.selectedValue) {
      const next = this.generateState(this.props);
      this.setState({ value: next.value, label: next.label, config: next.config });
    } else {
      this.setState({ label: this.getRangeLabel(this.state.value, this.state.config, this.props) });
    }
    if (this.props.disabled && this.state.menuOpened) this.hideMenu();
  }
  generateState = (props: DateTimeRangeProps): PublicRangeState => {
    const value: NullableDatePair = [decodeDate(props.selectedValue?.[0]), decodeDate(props.selectedValue?.[1])];
    const config = { start: !!value[0], end: !!value[1] };
    return { value, config, label: this.getRangeLabel(value, config, props), menuOpened: false, bounding: null };
  };
  getRangeLabel = (
    value: readonly [Date | null, Date | null] | null,
    config: RangeConfig,
    props: DateTimeRangeProps,
  ): string => {
    const mode = props.timePicker ? 'datetime' : props.mode;
    const partial = props.mode === 'task';
    const start =
      value?.[0] && (!partial || config.start)
        ? (displayDate(value[0], mode, props.timeMode, props) ?? LibCalender.formatTime(value[0], mode, props.timeMode))
        : '';
    const end =
      value?.[1] && (!partial || config.end)
        ? (displayDate(value[1], mode, props.timeMode, props) ?? LibCalender.formatTime(value[1], mode, props.timeMode))
        : '';
    return start || end ? [start, end].join(props.separator ?? ' ~ ') : props.placeholder || '';
  };
  onOk = (value: MomentRange, halves: HalfPair | null) => {
    const props = this.props;
    if (props.mode === 'task') props.onOk?.(value, halves);
    else if (value[0] && value[1]) props.onOk?.([value[0], value[1]], halves);
  };

  showMenu = () => {
    if (this.props.disabled || !this._picker) return;
    this.setState({
      menuOpened: true,
      bounding: this._picker.getBoundingClientRect(),
    });
    this.props.onVisibleChange?.(true);
  };

  hideMenu = () => {
    this.setState({
      menuOpened: false,
    });
    this.props.onVisibleChange?.(false);
  };

  toggleMenuOpened = () => {
    if (this.props.disabled || !this._picker) {
      return;
    }

    const menuOpened = !this.state.menuOpened;
    this.setState({
      menuOpened,
      bounding: this._picker.getBoundingClientRect(),
    });
    this.props.onVisibleChange?.(menuOpened);
  };

  onChange = (_event: HeaderEvent, value: readonly [Date, Date] | null, config: RangeConfig) => {
    let newValue: NullableDatePair | null = null;
    let label = this.props.placeholder || '';

    if (value) {
      newValue = [new Date(value[0]), new Date(value[1])];
      label = this.getRangeLabel(value, config, this.props);
    }

    this.setState({
      value: newValue,
      label,
      config,
      menuOpened: false,
    });
    this.props.onVisibleChange?.(false);
  };

  override render() {
    const min = decodeDate(this.props.min);
    const max = decodeDate(this.props.max);

    let mode: PickerMode | 'half' = 'date';

    if (this.props.timePicker || this.props.mode === 'task') {
      mode = 'datetime';
    } else {
      mode = this.props.mode || 'date';
    }

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

    const picker = (
      <DateTimeRangePicker
        type={mode}
        timeType={this.props.timeMode}
        partial={this.props.mode === 'task'}
        allowClear={this.props.allowClear}
        config={this.state.config}
        firstDayOfWeek={this.props.firstDayOfWeek}
        disabledDate={this.props.disabledDate ? date => this.props.disabledDate?.(moment(date)) : undefined}
        min={min}
        max={max}
        value={this.state.value}
        halfStart={this.props.halfData?.[0]}
        halfEnd={this.props.halfData?.[1]}
        onChange={(event, value, config) => {
          this.onChange(event, value, config);
        }}
        onOk={this.onOk}
        onClear={this.props.onClear}
        onSelect={this.props.onSelect}
        autoFillEndTime={this.props.autoFillEndTime}
      />
    );

    const content = (
      <div
        className={['mui-datetimerange-base', this.props.className].filter(Boolean).join(' ')}
        style={this.props.style}
      >
        {button}
        <PositionContainer
          popupParentNode={this.props.popupParentNode}
          onClickAwayExceptions={[this._picker]}
          placement="bottom"
          offset={this.props.offset}
          bounding={this.state.bounding}
          visible={this.state.menuOpened}
          onHide={this.hideMenu}
        >
          {picker}
        </PositionContainer>
      </div>
    );

    return content;
  }
}

DateTimeRange.propTypes = {
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
    'task', // 任务
    'half', // 半天 AM|PM
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
  halfData: PropTypes.any,
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
   * 最小值
   */
  min: PropTypes.any,
  /**
   * 最大值
   */
  max: PropTypes.any,
  /**
   * 初始是否可见
   */
  defaultVisible: PropTypes.bool,
  /**
   * 是否禁用
   */
  disabled: PropTypes.bool,
  /**
   * 未选择时的文字
   */
  placeholder: PropTypes.string,
  /**
   * 指定弹层创建的位置，默认是body下
   */
  popupParentNode: PropTypes.func,
  /**
   * 指定弹层创建的位置偏移值
   */
  offset: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
  }),
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
  /**
   * 可见状态变更
   */
  onVisibleChange: PropTypes.func,
  /**
   * 结束小时数随开始时间改自动加大区间
   */
  autoFillEndTime: PropTypes.number,
};

export { DateTimeRange };
// Keep task mode required at the public boundary; class defaultProps would make it optional in JSX.
export default function RangePicker(props: DateTimeRangeProps & { ref?: Ref<DateTimeRange> | undefined }) {
  return <DateTimeRange {...props} />;
}
