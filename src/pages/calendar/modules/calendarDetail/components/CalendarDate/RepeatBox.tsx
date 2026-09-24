import { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import DatePicker from 'ming-ui/components/DatePicker';
import Dropdown from 'ming-ui/components/Dropdown';
import { formatRecur } from '../../common';
import { FREQUENCY, RECURLAYERS, RECURTYPE, WEEKDAYS } from '../../constant';

export default class RepeatBox extends Component<any, any> {
  declare untilDateBox: HTMLSpanElement | null | undefined;

  static override propTypes = {
    change: PropTypes.func.isRequired,
  };
  constructor(props) {
    super(props);
  }
  /**
   * eventHandlers
   */
  // 修改重复方式
  changeFrequency(value) {
    this.props.change({
      isRecur: FREQUENCY.NONE !== +value,
      frequency: +value,
    });
  }
  // 修改重复间隔
  changeInterval(event) {
    const value = parseInt(event.target.value, 10);
    this.props.change({
      interval: isNaN(value) || value <= 0 ? 1 : Math.min(value, 99),
    });
  }

  // 修改星期
  changeWeekDay(dayIndex: number) {
    const {
      calendar: { weekDay },
    } = this.props;
    let weekDayArray = weekDay ? weekDay.split(',').sort((a, b) => a - b) : [];
    /* 原先是把 index 写成 <span value={index}>（span 没有 value 属性，React 把它原样
       落成 DOM 属性），点击时再从 event.target 上把这个属性读回来。现在直接传进来。
       转成字符串是因为 weekDayArray 里存的是 weekDay.split(',') 的字符串，
       下面 indexOf / _.without 都靠严格相等比较 —— 原先 DOM 读回来的本来也是字符串。 */
    const value = String(dayIndex);
    const isInArray = weekDayArray.indexOf(value) !== -1;

    if (isInArray) {
      weekDayArray = _.without(weekDayArray, value);
    } else {
      _.chain(weekDayArray)
        .push(value)
        .sort((a, b) => a - b)
        .commit();
    }

    this.props.change({
      weekDay: weekDayArray.join(','),
    });
  }

  // 修改重复日程结束
  changeRecur(value) {
    this.props.change({
      recurType: value,
    });
  }

  // 修改重复次数
  changeRecurCount(event) {
    const value = parseInt(event.target.value, 10);
    this.props.change({
      recurCount: isNaN(value) || value <= 0 ? 1 : Math.min(value, 99),
    });
  }

  /**
   * render functions
   */
  renderFrequency() {
    const {
      calendar: { frequency },
    } = this.props;
    // dropDown props required value is string
    const data = [
      { text: _l('无'), value: FREQUENCY.NONE + '' },
      { text: _l('每天'), value: FREQUENCY.DAY + '' },
      { text: _l('每周'), value: FREQUENCY.WEEK + '' },
      { text: _l('每月'), value: FREQUENCY.MONTH + '' },
      { text: _l('每年'), value: FREQUENCY.YEAR + '' },
    ];
    const dropDownProps = {
      data,
      value: frequency + '',
      onChange: this.changeFrequency.bind(this),
      key: 'frequency-input',
    };
    return (
      <div>
        <div className="LineHeight30">
          <span className="formLabel">{_l('重复:')}</span>
          <Dropdown {...dropDownProps} />
        </div>
        {frequency === FREQUENCY.NONE ? null : this.renderInterval()}
        {frequency === FREQUENCY.NONE ? null : this.renderRecur()}
      </div>
    );
  }

  renderInterval() {
    const {
      calendar: { frequency, interval },
    } = this.props;
    const suffix = RECURLAYERS[frequency - 1];
    return (
      <div className="LineHeight30">
        <span className="formLabel">{_l('频率:')}</span>
        <div className="FormControl">
          {_l('每')}
          <input
            name="calendarDateRepeatBox1"
            autoComplete="off"
            type="text"
            className="intervalBox borderColorPrimary"
            value={interval}
            onChange={this.changeInterval.bind(this)}
          />
          {suffix}
          {this.renderWeekDay(frequency)}
        </div>
      </div>
    );
  }

  renderWeekDay() {
    const {
      calendar: { frequency, weekDay },
    } = this.props;
    const weekDayArray = weekDay ? weekDay.split(',').sort((a, b) => a - b) : [];
    if (frequency !== FREQUENCY.WEEK) return null;
    return (
      <span className="weekDaysContainer">
        {WEEKDAYS.map((day, index) => {
          const isSelected = weekDayArray.indexOf('' + index) !== -1;
          return (
            <span
              className={cx('weekday', { bgColorPrimary: isSelected })}
              onClick={() => this.changeWeekDay(index)}
              key={index}
            >
              {day}
            </span>
          );
        })}
      </span>
    );
  }

  renderRecur() {
    const {
      calendar: { recurType },
    } = this.props;
    // dropDown props required value is string
    const data = [
      { text: _l('永不'), value: RECURTYPE.NONE },
      { text: _l('次数'), value: RECURTYPE.COUNT },
      { text: _l('日期'), value: RECURTYPE.DATE },
    ];
    const dropDownProps = {
      data,
      value: recurType,
    };
    return (
      <div className="LineHeight30">
        <span className="formLabel">{_l('结束:')}</span>
        <Dropdown {...dropDownProps} onChange={this.changeRecur.bind(this)} key="recur-input" />
        {recurType === RECURTYPE.NONE ? null : this.renderRecurEdit()}
      </div>
    );
  }

  renderRecurEdit() {
    const {
      calendar: { end, recurType, recurCount, untilDate },
    } = this.props;

    if (recurType === RECURTYPE.COUNT) {
      return (
        <span className="mLeft10">
          {_l('发生')}
          <input
            name="calendarDateRepeatBox2"
            autoComplete="off"
            type="text"
            className="recurCountBox borderColorPrimary"
            value={recurCount}
            onChange={this.changeRecurCount.bind(this)}
          />
          {_l('次后')}
        </span>
      );
    } else {
      return (
        <span
          className="mLeft10 Relative untilDateBox borderColorPrimary"
          ref={el => {
            this.untilDateBox = el;
          }}
        >
          <DatePicker
            popupParentNode={() => this.untilDateBox}
            format={'YYYY-MM-DD'}
            selectedValue={moment(untilDate)}
            disabledDate={date => {
              if (date.isSameOrBefore(moment(end), 'day')) return true;
              return undefined;
            }}
            onSelect={selectDate => {
              if (selectDate) {
                this.props.change({
                  untilDate: selectDate.format('YYYY-MM-DD'),
                });
              } else {
                this.props.change({
                  untilDate: '0',
                });
              }
            }}
          />
        </span>
      );
    }
  }

  override render() {
    const {
      calendar: { isChildCalendar, frequency },
    } = this.props;
    if (isChildCalendar) return null;
    return (
      <div>
        {this.renderFrequency()}
        {frequency !== FREQUENCY.NONE ? (
          <div className="LineHeight30">
            <span className="formLabel textPrimary">{_l('结果:')}</span>
            {formatRecur(this.props.calendar)}
          </div>
        ) : null}
      </div>
    );
  }
}
