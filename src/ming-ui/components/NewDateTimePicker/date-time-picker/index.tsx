import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import moment from 'moment';
import PropTypes from 'prop-types';
import Button from 'ming-ui/components/Button';
import DatePickerBase from 'ming-ui/components/NewDateTimePicker/date-picker-base';
import Time from 'ming-ui/components/NewTimePicker';
import type { ClockEvent, ClockTime } from '../../NewTimePicker/types';
import LibCalender from '../lib/calender';
import { clockData, clockOf, dateAllowed, dateValue, roundedDate, sameDate } from '../types';
import type { DateBounds, GridEvent, HeaderEvent, PanelProps, TimeData } from '../types';
import './style.less';

interface PanelState {
  value: Date;
  time: TimeData;
}

class DateTimePicker extends Component<PanelProps, PanelState> {
  static defaultProps: Partial<PanelProps> = {
    show: false,
    type: 'date',
    timeType: 'minute',
    allowClear: true,
    firstDayOfWeek: 1,
    min: null,
    max: null,
    onChange: () => {},
    onOk: () => {},
    onClear: () => {},
    onSelect: () => {},
  };
  constructor(props: PanelProps) {
    super(props);

    const value = dateValue(props.value);
    this.state = {
      /**
       * 当前选中的值
       */
      value,
      /**
       * 当前时间
       */
      time: this.getTimeData(
        {
          hour: value.getHours(),
          minute: value.getMinutes(),
          second: value.getSeconds(),
        },
        props,
        value,
      ),
    };
  }

  override componentDidUpdate(prevProps: PanelProps) {
    if (shallowEqual(prevProps, this.props)) return;
    if (
      !sameDate(prevProps.value, this.props.value) ||
      !sameDate(prevProps.min, this.props.min) ||
      !sameDate(prevProps.max, this.props.max) ||
      prevProps.timeType !== this.props.timeType
    ) {
      const value = !sameDate(prevProps.value, this.props.value) ? dateValue(this.props.value) : this.state.value;
      this.setState({ value, time: this.getTimeData(clockOf(value), this.props, value) });
    }
  }
  getTimeData = (value: ClockTime, props: DateBounds, time: Date) => clockData(value, props, time);

  dateOnChange = (_event: GridEvent, value: Date) => {
    const newValue = new Date(this.state.value);

    newValue.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());

    const time = {
      hour: newValue.getHours(),
      minute: newValue.getMinutes(),
      second: newValue.getSeconds(),
    };

    const timeData = this.getTimeData(time, this.props, newValue);

    // check is time in range
    if (this.props.type === 'datetime') {
      // check min
      if (
        timeData.min &&
        LibCalender.isSameDate(newValue, this.props.min) &&
        LibCalender.isTimeEarly(time, timeData.min)
      ) {
        newValue.setHours(timeData.min.hour);
        newValue.setMinutes(timeData.min.minute);
        newValue.setSeconds(timeData.min.second);

        timeData.value = timeData.min;
      }

      // check max
      if (
        timeData.max &&
        LibCalender.isSameDate(newValue, this.props.max) &&
        LibCalender.isTimeLater(time, timeData.max)
      ) {
        newValue.setHours(timeData.max.hour);
        newValue.setMinutes(timeData.max.minute);
        newValue.setSeconds(timeData.max.second);

        timeData.value = timeData.max;
      }
    }

    this.setState(
      {
        value: newValue,
        time: timeData,
      },
      () => {
        if (this.props.onSelect) {
          this.props.onSelect(moment(newValue));
        }
      },
    );
  };

  timeOnChange = (_event: ClockEvent, value: ClockTime) => {
    const newValue = new Date(this.state.value);

    newValue.setHours(value.hour);
    newValue.setMinutes(value.minute);
    newValue.setSeconds(value.second);

    this.setState(
      {
        value: newValue,
        time: this.getTimeData(value, this.props, newValue),
      },
      () => {
        if (this.props.onSelect) {
          this.props.onSelect(moment(newValue));
        }
      },
    );
  };

  buttonOnClick = (event: HeaderEvent, action: 'ok' | 'clear') => {
    if (action === 'clear') {
      this.props.onChange?.(event, null);
      this.props.onClear?.();
      return;
    }
    const value = roundedDate(
      this.state.value,
      this.props.timeType,
      this.props.type === 'datetime' ? this.props : undefined,
    );
    if (!value || !dateAllowed(value, this.props.type, this.props)) {
      alert(_l('该范围内没有可选时间'));
      return;
    }
    this.props.onChange?.(event, value);
    this.props.onOk?.(moment(value));
  };

  override render() {
    const dateType = this.props.type === 'datetime' ? 'date' : this.props.type;

    let timePicker: React.JSX.Element | null = null;

    if (this.props.type === 'datetime') {
      timePicker = (
        <Time
          type={this.props.timeType}
          min={this.state.time.min}
          max={this.state.time.max}
          value={this.state.time.value}
          onChange={(event, value) => {
            this.timeOnChange(event, value);
          }}
        />
      );
    }

    let clearBtn: React.JSX.Element | null = null;

    if (this.props.allowClear) {
      clearBtn = (
        <Button
          type="link"
          size="small"
          onClick={event => {
            this.buttonOnClick(event, 'clear');
          }}
        >
          {_l('清空')}
        </Button>
      );
    }

    return (
      <div className="mui-datetimepicker">
        <div>
          <DatePickerBase
            type={dateType}
            firstDayOfWeek={this.props.firstDayOfWeek}
            disabledDate={this.props.disabledDate}
            min={this.props.min}
            max={this.props.max}
            value={this.state.value}
            onChange={(event, value) => {
              this.dateOnChange(event, value);
            }}
          />
        </div>
        <div className="mui-datetime-toolbar">
          {timePicker}
          {clearBtn}
          <Button
            type="primary"
            size="small"
            onClick={event => {
              this.buttonOnClick(event, 'ok');
            }}
          >
            {_l('确定')}
          </Button>
        </div>
      </div>
    );
  }
}

DateTimePicker.propTypes = {
  /**
   * 选择类型
   */
  type: PropTypes.oneOf([
    'year', // 年
    'month', // 月
    'date', // 日
    'datetime', // YYYY-MM-DD HH:mm:ss
  ]),
  /**
   * 时间类型
   */
  timeType: PropTypes.oneOf([
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

export default DateTimePicker;
