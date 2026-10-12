import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import moment from 'moment';
import PropTypes from 'prop-types';
import Button from '../../Button';
import Checkbox from '../../Checkbox';
import Dropdown from '../../Dropdown';
import Time from '../../NewTimePicker/index';
import type { ClockTime } from '../../NewTimePicker/types';
import DatePickerBase from '../date-picker-base/index';
import LibCalender from '../lib/calender';
import { clockData, clockOf, dateAllowed, dateValue, roundedDate, sameDate } from '../types';
import type {
  DateBounds,
  DatePair,
  GridEvent,
  HalfDay,
  HeaderEvent,
  MomentRange,
  PickerEvent,
  RangePanelProps,
  TimeData,
} from '../types';
import './style.less';

interface RangePanelState {
  value: DatePair;
  startTime: TimeData;
  endTime: TimeData;
  partialStart: boolean;
  partialEnd: boolean;
  halfData: [HalfDay | undefined, HalfDay | undefined];
}

class DateTimeRangeDoublePicker extends Component<RangePanelProps, RangePanelState> {
  static defaultProps: Partial<RangePanelProps> = {
    show: false,
    type: 'date',
    timeType: 'minute',
    halfStart: 'AM',
    halfEnd: 'PM',
    allowClear: true,
    partial: false,
    config: {
      start: true,
      end: true,
    },
    firstDayOfWeek: 1,
    min: null,
    max: null,
    onChange: () => {},
    onOk: () => {},
    onClear: () => {},
    onSelect: () => {},
  };
  constructor(props: RangePanelProps) {
    super(props);

    this.state = this.generateState(props);
  }

  override componentDidUpdate(prevProps: RangePanelProps) {
    if (shallowEqual(prevProps, this.props)) return;
    const changed =
      !sameDate(prevProps.value?.[0], this.props.value?.[0]) || !sameDate(prevProps.value?.[1], this.props.value?.[1]);
    const configChanged =
      prevProps.config?.start !== this.props.config?.start || prevProps.config?.end !== this.props.config?.end;
    const boundsChanged = !sameDate(prevProps.min, this.props.min) || !sameDate(prevProps.max, this.props.max);
    if (
      changed ||
      configChanged ||
      boundsChanged ||
      prevProps.halfStart !== this.props.halfStart ||
      prevProps.halfEnd !== this.props.halfEnd ||
      prevProps.type !== this.props.type ||
      prevProps.timeType !== this.props.timeType
    )
      this.setState(
        this.generateState(
          this.props,
          changed,
          configChanged,
          prevProps.halfStart !== this.props.halfStart ||
            prevProps.halfEnd !== this.props.halfEnd ||
            prevProps.type !== this.props.type,
        ),
      );
  }
  generateState = (props: RangePanelProps, reset = true, resetConfig = true, resetHalf = true): RangePanelState => {
    const today = new Date();
    const startDefault = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9);
    const endDefault = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18);
    const value: DatePair = [
      dateValue((reset ? props.value?.[0] : null) || this.state?.value?.[0] || startDefault),
      dateValue((reset ? props.value?.[1] : null) || this.state?.value?.[1] || endDefault),
    ];
    const halfData: [HalfDay | undefined, HalfDay | undefined] =
      props.type === 'half' && resetHalf
        ? [props.halfStart, props.halfEnd]
        : this.state?.halfData
          ? [...this.state.halfData]
          : ['AM', 'PM'];
    return {
      value,
      startTime: this.getTimeData(clockOf(value[0]), props, value[0]),
      endTime: this.getTimeData(clockOf(value[1]), props, value[1]),
      partialStart: resetConfig ? (props.config?.start ?? true) : this.state.partialStart,
      partialEnd: resetConfig ? (props.config?.end ?? true) : this.state.partialEnd,
      halfData,
    };
  };
  getTimeData = (value: ClockTime, props: DateBounds, time: Date) => clockData(value, props, time);

  onPick = (event: GridEvent, value: Date, i: 0 | 1) => {
    const range: DatePair = [this.state.value[0], this.state.value[1]];
    range[i] = value;

    this.dateOnChange(event, range, i);
  };

  dateOnChange = (_event: GridEvent, value: readonly [Date, Date], i: 0 | 1) => {
    const start = new Date(this.state.value[0]);

    start.setFullYear(value[0].getFullYear(), value[0].getMonth(), value[0].getDate());

    const startTime = {
      hour: start.getHours(),
      minute: start.getMinutes(),
      second: start.getSeconds(),
    };

    const end = new Date(this.state.value[1]);

    end.setFullYear(value[1].getFullYear(), value[1].getMonth(), value[1].getDate());

    const endTime = {
      hour: end.getHours(),
      minute: end.getMinutes(),
      second: end.getSeconds(),
    };

    const startTimeData = this.getTimeData(startTime, this.props, start);
    const endTimeData = this.getTimeData(endTime, this.props, end);

    // check is time in range
    if (this.props.type === 'datetime') {
      // check start.min
      if (
        startTimeData.min &&
        LibCalender.isSameDate(start, this.props.min) &&
        LibCalender.isTimeEarly(startTime, startTimeData.min)
      ) {
        start.setHours(startTimeData.min.hour);
        start.setMinutes(startTimeData.min.minute);
        start.setSeconds(startTimeData.min.second);

        startTimeData.value = startTimeData.min;
      }

      // check start.max
      if (
        startTimeData.max &&
        LibCalender.isSameDate(start, this.props.max) &&
        LibCalender.isTimeLater(startTime, startTimeData.max)
      ) {
        start.setHours(startTimeData.max.hour);
        start.setMinutes(startTimeData.max.minute);
        start.setSeconds(startTimeData.max.second);

        startTimeData.value = startTimeData.max;
      }

      // check end.min
      if (
        endTimeData.min &&
        LibCalender.isSameDate(end, this.props.min) &&
        LibCalender.isTimeEarly(endTime, endTimeData.min)
      ) {
        end.setHours(endTimeData.min.hour);
        end.setMinutes(endTimeData.min.minute);
        end.setSeconds(endTimeData.min.second);

        endTimeData.value = endTimeData.min;
      }

      // check end.max
      if (
        endTimeData.max &&
        LibCalender.isSameDate(end, this.props.max) &&
        LibCalender.isTimeLater(endTime, endTimeData.max)
      ) {
        end.setHours(endTimeData.max.hour);
        end.setMinutes(endTimeData.max.minute);
        end.setSeconds(endTimeData.max.second);

        endTimeData.value = endTimeData.max;
      }
    }

    this.setState(
      {
        value: [start, end],
        startTime: startTimeData,
        endTime: endTimeData,
        partialStart: !this.state.partialStart && i === 0 ? true : this.state.partialStart,
        partialEnd: !this.state.partialEnd && i === 1 ? true : this.state.partialEnd,
      },
      () => {
        if (this.props.onSelect) {
          this.props.onSelect([this.state.partialStart ? moment(start) : '', this.state.partialEnd ? moment(end) : '']);
        }
      },
    );
  };

  timeOnChange = (
    _event: PickerEvent,
    value: ClockTime,
    index: 0 | 1,
    halfData?: [HalfDay | undefined, HalfDay | undefined],
  ) => {
    const newValue = new Date(this.state.value[index]);

    newValue.setHours(value.hour);
    newValue.setMinutes(value.minute);
    newValue.setSeconds(value.second);

    const list: DatePair = [new Date(this.state.value[0]), new Date(this.state.value[1])];
    list[index] = newValue;

    let startTime = this.state.startTime;
    let endTime = this.state.endTime;

    if (index === 1) {
      endTime = this.getTimeData(value, this.props, this.state.value[1]);
    } else {
      startTime = this.getTimeData(value, this.props, this.state.value[0]);
    }

    if (
      this.props.autoFillEndTime &&
      index === 0 &&
      moment(list[0]).format('YYYY-MM-DD') === moment(list[1]).format('YYYY-MM-DD')
    ) {
      list[1] = moment(list[0]).add(this.props.autoFillEndTime, 'h').toDate();
      endTime = this.getTimeData(clockOf(list[1]), this.props, list[1]);
    }

    this.setState(
      {
        value: list,
        startTime,
        endTime,
        partialStart: !this.state.partialStart && index === 0 ? true : this.state.partialStart,
        partialEnd: !this.state.partialEnd && index === 1 ? true : this.state.partialEnd,
        halfData: halfData || this.state.halfData,
      },
      () => {
        if (this.props.onSelect) {
          this.props.onSelect([
            this.state.partialStart ? moment(list[0]) : '',
            this.state.partialEnd ? moment(list[1]) : '',
          ]);
        }
      },
    );
  };

  buttonOnClick = (event: HeaderEvent, action: 'ok' | 'clear') => {
    if (action === 'clear') {
      this.props.onChange?.(event, null, { start: false, end: false });
      this.props.onClear?.();
      return;
    }
    const bounds = this.props.type === 'datetime' ? this.props : undefined;
    const start = roundedDate(this.state.value[0], this.props.timeType, bounds);
    const end = roundedDate(this.state.value[1], this.props.timeType, bounds);
    if (
      !start ||
      !end ||
      ((!this.props.partial || this.state.partialStart) && !dateAllowed(start, this.props.type, this.props)) ||
      ((!this.props.partial || this.state.partialEnd) && !dateAllowed(end, this.props.type, this.props))
    ) {
      alert(_l('该范围内没有可选时间'));
      return;
    }
    if (
      this.props.type === 'half' &&
      LibCalender.isSameDate(start, end) &&
      this.state.halfData[0] === 'PM' &&
      this.state.halfData[1] === 'AM'
    ) {
      alert(_l('结束时间不能早于开始时间'), 3);
      return;
    }
    if (
      start.getTime() > end.getTime() &&
      (!this.props.partial || (this.state.partialStart && this.state.partialEnd))
    ) {
      alert(_l('结束时间不能早于开始时间'), 3);
      return;
    }
    const config = this.props.partial
      ? { start: this.state.partialStart, end: this.state.partialEnd }
      : { start: true, end: true };
    const returned: MomentRange = [config.start ? moment(start) : null, config.end ? moment(end) : null];
    this.props.onChange?.(event, [start, end], config);
    this.props.onOk?.(returned, this.props.type === 'half' ? [...this.state.halfData] : null);
  };
  checkboxOnChange = (target: 'partialStart' | 'partialEnd') => {
    this.setState(state => ({ ...state, [target]: !state[target] }));
  };

  // 半天选择
  halfOnChange = (value: HalfDay | undefined, target: 'start' | 'end') => {
    const halfData: [HalfDay | undefined, HalfDay | undefined] = [...this.state.halfData];
    let time = {
      hour: 0,
      minute: 0,
      second: 0,
    };
    let index: 0 | 1 = 0;

    if (target === 'start') {
      halfData[0] = value;
      if (value === 'PM') {
        time = {
          hour: 12,
          minute: 0,
          second: 0,
        };
      }
    } else {
      halfData[1] = value;
      index = 1;
      if (value === 'AM') {
        time = {
          hour: 12,
          minute: 0,
          second: 0,
        };
      } else {
        time = {
          hour: 23,
          minute: 59,
          second: 59,
        };
      }
    }

    this.timeOnChange(null, time, index, halfData);
  };

  override render() {
    const classList = ['mui-datetimerangepicker'];

    if (this.props.show) {
      classList.push('show');
    }

    const classNames = classList.join(' ');

    const dateType = this.props.type === 'datetime' || this.props.type === 'half' ? 'date' : this.props.type;

    let partialToolbar: React.JSX.Element | null = null;

    if (this.props.partial) {
      partialToolbar = (
        <div className="mui-datetimerangepicker-row partial">
          <div className="mui-datetimerangepicker-col">
            <Checkbox
              checked={this.state.partialStart}
              onClick={() => {
                this.checkboxOnChange('partialStart');
              }}
            >
              {_l('开始时间')}
            </Checkbox>
          </div>
          <div className="mui-datetimerangepicker-col">
            <Checkbox
              checked={this.state.partialEnd}
              onClick={() => {
                this.checkboxOnChange('partialEnd');
              }}
            >
              {_l('结束时间')}
            </Checkbox>
          </div>
        </div>
      );
    }

    let startTimePicker: React.JSX.Element | null = null;
    let endTimePicker: React.JSX.Element | null = null;
    const halfOptions: { value: HalfDay; text: string }[] = [
      {
        value: 'AM',
        text: 'AM',
      },
      {
        value: 'PM',
        text: 'PM',
      },
    ];

    if (this.props.type === 'datetime') {
      startTimePicker = (
        <div className="timePickerGroup">
          <span className="label">{_l('时间')}</span>
          <Time
            type={this.props.timeType}
            min={this.state.startTime.min}
            max={this.state.startTime.max}
            value={this.state.startTime.value}
            onChange={(event, value) => {
              this.timeOnChange(event, value, 0);
            }}
          />
        </div>
      );
      endTimePicker = (
        <div className="timePickerGroup">
          <span className="label">{_l('时间')}</span>
          <Time
            type={this.props.timeType}
            min={this.state.endTime.min}
            max={this.state.endTime.max}
            value={this.state.endTime.value}
            onChange={(event, value) => {
              this.timeOnChange(event, value, 1);
            }}
          />
        </div>
      );
    } else if (this.props.type === 'half') {
      startTimePicker = (
        <Dropdown
          value={this.state.halfData[0]}
          data={halfOptions}
          onChange={value => {
            this.halfOnChange(value, 'start');
          }}
        />
      );
      endTimePicker = (
        <Dropdown
          value={this.state.halfData[1]}
          data={halfOptions}
          onChange={value => {
            this.halfOnChange(value, 'end');
          }}
        />
      );
    }

    const clearText = _l('清空');
    const okText = _l('确定');
    let clearBtn: React.JSX.Element | null = null;

    if (this.props.allowClear) {
      clearBtn = (
        <Button
          type="link"
          size="small"
          title={clearText}
          onClick={event => {
            this.buttonOnClick(event, 'clear');
          }}
        >
          {clearText}
        </Button>
      );
    }

    const actionButtons = (
      <div className="toolbarActions">
        {clearBtn}
        <Button
          type="primary"
          size="small"
          title={okText}
          onClick={event => {
            this.buttonOnClick(event, 'ok');
          }}
        >
          {okText}
        </Button>
      </div>
    );

    return (
      <div className={classNames}>
        {partialToolbar}
        <div className="mui-datetimerangepicker-row">
          <div className="mui-datetimerangepicker-col">
            <DatePickerBase
              type={dateType}
              part="start"
              firstDayOfWeek={this.props.firstDayOfWeek}
              disabledDate={this.props.disabledDate}
              min={this.props.min}
              max={this.props.max}
              value={this.state.value[0]}
              selectedRange={this.state.value}
              prefix={_l('开始:')}
              onChange={(event, value) => {
                this.onPick(event, value, 0);
              }}
            />
          </div>
          <div className="mui-datetimerangepicker-col">
            <DatePickerBase
              type={dateType}
              part="end"
              firstDayOfWeek={this.props.firstDayOfWeek}
              disabledDate={this.props.disabledDate}
              min={this.props.min}
              max={this.props.max}
              value={this.state.value[1]}
              selectedRange={this.state.value}
              prefix={_l('结束:')}
              onChange={(event, value) => {
                this.onPick(event, value, 1);
              }}
            />
          </div>
        </div>
        <div className="mui-datetimerangepicker-row toolbar">
          <div className="mui-datetimerangepicker-col">{startTimePicker}</div>
          <div className="mui-datetimerangepicker-col">
            {endTimePicker}
            {actionButtons}
          </div>
        </div>
      </div>
    );
  }
}

DateTimeRangeDoublePicker.propTypes = {
  /**
   * 是否显示
   */
  show: PropTypes.bool,
  /**
   * 选择类型
   */
  type: PropTypes.oneOf([
    'year', // 年
    'month', // 月
    'date', // 日
    'datetime', // YYYY-MM-DD HH:mm:ss
    'half', // 半天 AM|PM
  ]),
  /**
   * 时间类型
   */
  timeType: PropTypes.oneOf([
    'hour', // HH
    'minute', // HH:mm
    'second', // HH:mm:ss
  ]),
  halfStart: PropTypes.oneOf(['AM', 'PM']),
  halfEnd: PropTypes.oneOf(['AM', 'PM']),
  /**
   * 是否支持部分返回
   */
  partial: PropTypes.bool,
  /**
   * 部分选择
   */
  config: PropTypes.any,
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
  value: PropTypes.any,
  /**
   * 最小值
   */
  min: PropTypes.any,
  /**
   * 最大值
   */
  max: PropTypes.any,
  /**
   * 值发生改变
   * @param {event} event - 触发事件
   * @param {object} time - 选中的时间
   */
  onChange: PropTypes.func,
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

export default DateTimeRangeDoublePicker;
