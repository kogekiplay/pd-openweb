import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import LibCalender from '../../NewDateTimePicker/lib/calender';
import { normalizeClock } from '../types';
import type { ClockEvent, TimeItem, TimeMenuProps, TimeMode } from '../types';
import List from './list';
import './style.less';

interface TimeMenuState {
  hourList: TimeItem[];
  minuteList: TimeItem[];
  secondList: TimeItem[];
}

class TimeMenu extends Component<TimeMenuProps, TimeMenuState> {
  static defaultProps: Partial<TimeMenuProps> = { show: false, mode: 'second', min: null, max: null, onPick: () => {} };
  constructor(props: TimeMenuProps) {
    super(props);

    this.state = this.init(props);
  }

  override componentDidUpdate(prevProps: TimeMenuProps) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState(this.init(this.props));
    }
  }

  init = (props: TimeMenuProps) => {
    const state = {
      /**
       * 小时列表
       */
      hourList: this.generateHourList(props),
      /**
       * 分钟列表
       */
      minuteList: this.generateMinuteList(props),
      /**
       * 秒列表
       */
      secondList: this.generateSecondList(props),
    };

    return state;
  };

  generateHourList = (props: TimeMenuProps) => {
    const value = normalizeClock(props.value);
    const list: TimeItem[] = [];

    let i = 0;

    while (i < 24) {
      let disabled = false;

      if ((props.min && i < props.min.hour) || (props.max && i > props.max.hour)) {
        disabled = true;
      }

      let label = i < 10 ? `0${i}:00` : `${i.toString()}:00`;

      if (props.mode !== 'hour') {
        label = i < 10 ? `0${i}` : `${i.toString()}`;
      }

      list.push({
        value: i,
        label,
        disabled,
        current: i === value.hour,
      });

      i = i + 1;
    }

    return list;
  };

  generateMinuteList = (props: TimeMenuProps) => {
    const value = normalizeClock(props.value);
    const list: TimeItem[] = [];

    let i = 0;

    while (i < 60) {
      list.push({
        value: i,
        label: i < 10 ? `0${i}` : i.toString(),
        disabled: !LibCalender.minuteInRange(
          {
            hour: value.hour,
            minute: i,
          },
          props.min,
          props.max,
        ),
        current: i === value.minute,
      });

      i = i + 1;
    }

    return list;
  };

  generateSecondList = (props: TimeMenuProps) => {
    const value = normalizeClock(props.value);
    const list: TimeItem[] = [];

    let i = 0;

    while (i < 60) {
      list.push({
        value: i,
        label: i < 10 ? `0${i}` : i.toString(),
        disabled: !LibCalender.secondInRange(
          {
            hour: value.hour,
            minute: value.minute,
            second: i,
          },
          props.min,
          props.max,
        ),
        current: i === value.second,
      });

      i = i + 1;
    }

    return list;
  };

  onPick = (event: ClockEvent, type: TimeMode, value: number) => {
    if (this.props.onPick) {
      let time = {
        hour: normalizeClock(this.props.value).hour,
        minute: normalizeClock(this.props.value).minute,
        second: normalizeClock(this.props.value).second,
      };

      time[type] = value;

      // check min
      let min = false;

      if (this.props.min) {
        if (time.hour < this.props.min.hour) {
          min = true;
        } else if (time.hour === this.props.min.hour) {
          if (time.minute < this.props.min.minute) {
            min = true;
          } else if (time.minute === this.props.min.minute && time.second < this.props.min.second) {
            min = true;
          }
        }
      }

      if (min) {
        time = normalizeClock(this.props.min);
      }

      // check max
      let max = false;

      if (this.props.max) {
        if (time.hour > this.props.max.hour) {
          max = true;
        } else if (time.hour === this.props.max.hour) {
          if (time.minute > this.props.max.minute) {
            max = true;
          } else if (time.minute === this.props.max.minute && time.second > this.props.max.second) {
            max = true;
          }
        }
      }

      if (max) {
        time = normalizeClock(this.props.max);
      }

      this.props.onPick(event, time);
    }
  };

  override render() {
    const classList = ['mui-timemenu'];

    if (this.props.show) {
      classList.push('show');
    }

    if (this.props.mode === 'hour') {
      classList.push('col-1');
    } else if (this.props.mode === 'minute') {
      classList.push('col-2');
    } else if (this.props.mode === 'second') {
      classList.push('col-3');
    }

    const classNames = classList.join(' ');

    const content = [
      <div key="hour-menu" className="mui-timemenu-col">
        <List
          data={this.state.hourList}
          onPick={(event, value) => {
            this.onPick(event, 'hour', value);
          }}
        />
      </div>,
    ];

    if (this.props.mode === 'minute' || this.props.mode === 'second') {
      content.push(
        <div key="minute-menu" className="mui-timemenu-col">
          <List
            data={this.state.minuteList}
            onPick={(event, value) => {
              this.onPick(event, 'minute', value);
            }}
          />
        </div>,
      );
    }

    if (this.props.mode === 'second') {
      content.push(
        <div key="second-menu" className="mui-timemenu-col">
          <List
            data={this.state.secondList}
            onPick={(event, value) => {
              this.onPick(event, 'second', value);
            }}
          />
        </div>,
      );
    }

    return <div className={classNames}>{content}</div>;
  }
}

TimeMenu.propTypes = {
  /**
   * 是否显示
   */
  show: PropTypes.bool,
  /**
   * 选择模式
   */
  mode: PropTypes.oneOf([
    'hour', // hh
    'minute', // hh:MM
    'second', // hh:MM:ss
  ]),
  /**
   * 最小值
   */
  min: PropTypes.any,
  /**
   * 最大值
   */
  max: PropTypes.any,
  /**
   * 当前值
   */
  value: PropTypes.any,
  /**
   * 选择
   * @param {event} event - 事件
   * @param {object} time - 选择的时间
   */
  onPick: PropTypes.func,
};

export default TimeMenu;
