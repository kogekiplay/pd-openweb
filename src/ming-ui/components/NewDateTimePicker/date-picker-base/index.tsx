import { Component } from 'react';
import PropTypes from 'prop-types';
import Calender from 'ming-ui/components/NewDateTimePicker/calender';
import LibCalender from '../lib/calender';
import { datePair, dateValue, sameValue } from '../types';
import type { DateBaseProps, DateView, GridEvent, HeaderAction, HeaderEvent } from '../types';
import Header from './header';
import './style.less';

interface DateBaseState {
  mode: DateView;
  value: Date | readonly [Date, Date];
  cursor: Date;
  step: number;
}

class DatePickerBase extends Component<DateBaseProps, DateBaseState> {
  static defaultProps: Partial<DateBaseProps> = {
    type: 'date',
    range: false,
    part: '',
    firstDayOfWeek: 1,
    min: null,
    max: null,
    prefix: '',
    onChange: () => {},
  };
  constructor(props: DateBaseProps) {
    super(props);

    const state = this.generateState(props);
    /**
     * 范围选择步骤
     * 0 - 第一步
     * 1 - 第二步
     */
    state.step = 1;
    this.state = state;
  }

  override componentDidUpdate(prevProps: DateBaseProps) {
    if (!sameValue(prevProps.value, this.props.value) || prevProps.range !== this.props.range)
      this.setState(this.generateState(this.props));
    else if (prevProps.type !== this.props.type) this.setState({ mode: this.props.type || 'date' });
  }

  generateState = (props: DateBaseProps): DateBaseState => {
    const value = props.range ? datePair(props.value) : dateValue(props.value);
    const state = {
      /**
       * 显示模式
       */
      mode: props.type || 'date',
      /**
       * 当前值
       */
      value,
      /**
       * 当前显示页面的值
       */
      cursor: dateValue(value),
      step: this.state?.step ?? 1,
    };

    return state;
  };

  headerButtonOnClick = (_event: HeaderEvent, action: HeaderAction) => {
    // 头部按钮会改这三样：切换年/月/日视图、挪光标日期、换翻页步长
    const data: Partial<DateBaseState> = {};

    // toggle calender mode
    if (action === 'year' || action === 'month' || action === 'date') {
      data.mode = action;
    }

    // set today
    if (action === 'now') {
      data.cursor = new Date();
    }

    if (this.state.mode === 'date') {
      // update cursor month
      if (action === 'prev') {
        data.cursor = LibCalender.prevMonth(this.state.cursor);
      } else if (action === 'next') {
        data.cursor = LibCalender.nextMonth(this.state.cursor);
      }
    }

    if (this.state.mode === 'month') {
      // update cursor year
      const year = this.state.cursor.getFullYear();

      if (action === 'prev') {
        data.cursor = new Date(this.state.cursor);
        data.cursor.setFullYear(year - 1);
      } else if (action === 'next') {
        data.cursor = new Date(this.state.cursor);
        data.cursor.setFullYear(year + 1);
      }
    }

    if (this.state.mode === 'year') {
      // update cursor year
      const year = this.state.cursor.getFullYear();

      if (action === 'prev') {
        data.cursor = new Date(this.state.cursor);
        data.cursor.setFullYear(year - 10);
      } else if (action === 'next') {
        data.cursor = new Date(this.state.cursor);
        data.cursor.setFullYear(year + 10);
      }
    }

    this.setState(state => ({ ...state, ...data }));
  };

  /**
   * 日历选择事件
   */
  calenderOnPick = (event: GridEvent, type: DateView, value: number, time: Date) => {
    let newValue = new Date(this.state.cursor);
    let changeView = this.state.mode;

    if (type === 'date') {
      newValue = time;
    } else if (type === 'month') {
      newValue.setFullYear(newValue.getFullYear(), value, 1);

      if (this.props.type === 'date') {
        changeView = 'date';
      }
    } else if (type === 'year') {
      newValue.setFullYear(value);

      if (this.props.type === 'date' || this.props.type === 'month') {
        changeView = 'month';
      }
    }

    const newData: DateBaseState = {
      ...this.state,
      mode: changeView,
      cursor: newValue,
    };

    // pick new value
    if (this.props.type === type) {
      // let updateValue = newValue;
      // if (this.props.range) {
      //   newData.step = 1 - this.state.step;

      //   updateValue = (newData.step === 0)
      //       ? [newValue, newValue]
      //       : [this.state.value[0], newValue].sort((a, b) => {
      //         return (a.getTime() - b.getTime());
      //       });
      // }

      newData.value = newValue;

      if (this.props.onChange) {
        this.props.onChange(event, newValue);
      }
    }

    this.setState(newData);
  };

  override render() {
    return (
      <div className="mui-datepickerbase">
        <Header
          view={this.state.mode}
          time={this.state.cursor}
          prefix={this.props.prefix}
          buttonOnClick={(event, action) => {
            this.headerButtonOnClick(event, action);
          }}
        />
        <Calender
          mode={this.state.mode}
          range={this.props.range}
          part={this.props.part}
          firstDayOfWeek={this.props.firstDayOfWeek}
          disabledDate={this.props.disabledDate}
          min={this.props.min}
          max={this.props.max}
          value={this.state.value}
          selectedRange={this.props.selectedRange}
          cursor={this.state.cursor}
          onPick={(event, type, value, time) => {
            this.calenderOnPick(event, type, value, time);
          }}
        />
      </div>
    );
  }
}

DatePickerBase.propTypes = {
  /**
   * 选择模式
   */
  type: PropTypes.oneOf([
    'date', // 日
    'month', // 月
    'year', // 年
  ]),
  /**
   * 是否为范围选择
   */
  range: PropTypes.bool,
  /**
   * 范围的上半部分/下半部分
   */
  part: PropTypes.oneOf([
    '',
    'start', // 上半部分
    'end', // 下半部分
  ]),
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
   * 可选最小值
   */
  min: PropTypes.any,
  /**
   * 可选最大值
   */
  max: PropTypes.any,
  /**
   * 选中值
   */
  value: PropTypes.any,
  /**
   * 已选择的范围
   */
  selectedRange: PropTypes.any,
  /**
   * 标题前缀
   */
  prefix: PropTypes.string,
  /**
   * 值发生改变
   * @param {event} event - 事件
   * @param {date} value - 选中的值
   */
  onChange: PropTypes.func,
};

export default DatePickerBase;
