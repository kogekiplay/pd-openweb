import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import moment from 'moment';
import PropTypes from 'prop-types';
import CalendarPart from './CalendarPart';
import type { HalfDay } from './footerTypes';
import defaultLocale from './locale/zh_CN';
import RangeFooter from './RangeFooter';
import TaskHeader from './TaskHeader';
import { copyRange } from './types';
import type {
  CalendarRangeProps,
  DateRangeInput,
  DateRangeValue,
  DateSelectCause,
  DateValue,
  HalfDayRange,
  MutableDateRange,
  RangeTarget,
} from './types';
import '../less/dateRangePicker.less';

function noop() {}

function getNow() {
  return moment();
}

function syncTime(from: moment.Moment, to: moment.Moment) {
  to.hour(from.hour());
  to.minute(from.minute());
  to.second(from.second());
}
function normalizeRange(input: DateRangeInput = []): MutableDateRange {
  const normalize = (value: moment.MomentInput): DateValue => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return moment(value);
  };
  return input.length === 0
    ? []
    : input.length === 1
      ? [normalize(input[0])]
      : [normalize(input[0]), normalize(input[1])];
}
function getValueFromSelectedValue(value: DateRangeInput = []): [moment.Moment, moment.Moment] {
  return [moment(value[0] ?? getNow()), moment(value[1] ?? getNow())];
}
function halfValues(input?: HalfDayRange): [HalfDay | undefined, HalfDay | undefined] {
  return input ? [input[0], input[1]] : ['AM', 'PM'];
}
interface CalendarRangeState {
  value: [moment.Moment, moment.Moment];
  selectedValue: MutableDateRange;
  rememberedValue: MutableDateRange;
  halfData: [HalfDay | undefined, HalfDay | undefined];
  waingAble: boolean;
}

class CalendarRange extends Component<CalendarRangeProps, CalendarRangeState> {
  declare _root: HTMLDivElement | null | undefined;

  static override propTypes = {
    prefixCls: PropTypes.string,
    timePicker: PropTypes.bool,
    /**
     * 模式
     * default - 默认
     * task - 任务
     */
    mode: PropTypes.oneOf(['default', 'task', 'halfday']),
    halfData: PropTypes.any,
    defaultValue: PropTypes.any,
    selectedValue: PropTypes.array,
    onOk: PropTypes.func,
    locale: PropTypes.object,
    onChange: PropTypes.func,
    onSelect: PropTypes.func,
    format: PropTypes.string,
    onClear: PropTypes.func,
    popupParentNode: PropTypes.func,
  };

  static defaultProps: Partial<CalendarRangeProps> = {
    locale: defaultLocale,
    prefixCls: 'Calendar',
    defaultValue: [],
    halfData: ['AM', 'PM'],
    mode: 'default',
    onOk: noop,
    onClear: noop,
    onChange: noop,
    onSelect: noop,
  };

  constructor(props: CalendarRangeProps) {
    super(props);

    const selectedValue = normalizeRange(props.selectedValue);
    const value = getValueFromSelectedValue(
      props.value || (props.defaultValue?.length ? props.defaultValue : props.selectedValue),
    );
    this.state = {
      value,
      selectedValue,
      rememberedValue: copyRange(selectedValue),
      halfData: halfValues(props.halfData),
      waingAble: false,
    };
  }

  override componentDidUpdate(prevProps: CalendarRangeProps) {
    if (shallowEqual(prevProps, this.props)) return;
    const next: Partial<CalendarRangeState> = {};
    if ('selectedValue' in this.props) {
      next.selectedValue = normalizeRange(this.props.selectedValue);
      next.rememberedValue = [
        next.selectedValue[0] || this.state.rememberedValue[0],
        next.selectedValue[1] || this.state.rememberedValue[1],
      ];
    }
    if ('value' in this.props) next.value = getValueFromSelectedValue(this.props.value);
    if (prevProps.halfData !== this.props.halfData) next.halfData = halfValues(this.props.halfData);
    this.setState(state => ({ ...state, ...next }));
  }

  onDateSelect(index: 0 | 1, value: DateValue, options?: DateSelectCause) {
    const selectedValue = copyRange(this.state.selectedValue);
    const rememberedValue = copyRange(this.state.rememberedValue);
    selectedValue[index] = value;
    rememberedValue[index] = selectedValue[index] || rememberedValue[index];
    if (!('selectedValue' in this.props)) {
      this.setState({ selectedValue });
    }

    this.setState({ rememberedValue, waingAble: false });
    this.props.onSelect?.(selectedValue, options);
  }

  onStartTimeSelect = (leftValue: DateValue) => {
    this.onDateSelect(0, leftValue, { source: 'timePicker' });
  };

  onEndTimeSelect = (rightValue: DateValue) => {
    this.onDateSelect(1, rightValue, { source: 'timePicker' });
  };

  onStartDateSelect = (leftValue: DateValue) => {
    this.onDateSelect(0, leftValue);
  };

  onEndDateSelect = (rightValue: DateValue) => {
    this.onDateSelect(1, rightValue);
  };

  onOk = () => {
    const selectedValue = this.state.selectedValue;

    if (selectedValue[0] && selectedValue[1] && selectedValue[0].isAfter(selectedValue[1], 'second')) {
      alert(_l('结束时间不能早于开始时间'));
      this.setState({ waingAble: true });
      return;
    }

    this.setState({ waingAble: false });
    this.props.onOk?.(selectedValue, this.state.halfData);
  };

  onStartValueChange = (leftValue: moment.Moment) => {
    const state = this.state;
    const value: [moment.Moment, moment.Moment] = [state.value[0], state.value[1]];
    value[0] = leftValue;
    return this.fireValueChange(value);
  };

  onEndValueChange = (rightValue: moment.Moment) => {
    const state = this.state;
    const value: [moment.Moment, moment.Moment] = [state.value[0], state.value[1]];
    value[1] = rightValue;
    return this.fireValueChange(value);
  };

  getStartValue = () => {
    let startValue = this.state.value[0].clone();
    const selectedValue = this.state.selectedValue;

    if (this.props.mode === 'task') {
      startValue = moment(startValue).startOf('day').add(9, 'hour');
    }

    if (selectedValue[0] && this.props.timePicker) {
      syncTime(selectedValue[0], startValue);
    }

    return startValue;
  };

  getEndValue = () => {
    let endValue = this.state.value[1].clone();
    const selectedValue = this.state.selectedValue;

    if (this.props.mode === 'task') {
      endValue = moment(endValue).startOf('day').add(18, 'hour');
    }

    if (selectedValue[1] && this.props.timePicker) {
      syncTime(selectedValue[1], endValue);
    }

    return endValue;
  };

  compare = (v1: moment.Moment, v2: moment.Moment) => {
    if (this.props.timePicker) {
      return v1.diff(v2);
    }

    return v1.diff(v2, 'days');
  };

  fireSelectValueChange = (selection: DateRangeValue, direct: boolean) => {
    const selectedValue = copyRange(selection);
    if (!('selectedValue' in this.props)) {
      this.setState({
        selectedValue,
      });
    }

    if (!this.state.selectedValue[0] || !this.state.selectedValue[1]) {
      const startValue = selectedValue[0] || getNow();
      const endValue = selectedValue[1] || startValue.clone();
      this.setState({
        selectedValue,
        value: getValueFromSelectedValue([startValue, endValue]),
      });
    }

    this.props.onChange?.(selectedValue);
    if (direct || (selectedValue[0] && selectedValue[1])) {
      this.props.onSelect?.(selectedValue);
    }
  };

  fireValueChange = (value: [moment.Moment, moment.Moment]) => {
    const props = this.props;

    if (!('value' in props)) {
      this.setState({
        value,
      });
    }
  };

  clear = () => {
    this.fireSelectValueChange([], true);
    this.props.onClear?.();
  };

  /**
   * 任务模式，切换开始和结束的选中状态
   */
  toggleValue = (type: RangeTarget, checked: boolean) => {
    const value = checked ? moment(this.state.rememberedValue[type === 'start' ? 0 : 1] || new Date()) : null;

    if (type === 'start') {
      this.onStartDateSelect(value);
    } else if (type === 'end') {
      this.onEndDateSelect(value);
    }
  };

  halfOnChange = (value: HalfDay | undefined, target: RangeTarget) => {
    const halfData: [HalfDay | undefined, HalfDay | undefined] = [this.state.halfData[0], this.state.halfData[1]];
    halfData[target === 'start' ? 0 : 1] = value;
    this.setState({ halfData });
    this.props.onSelect?.(this.state.selectedValue, {}, halfData);
  };

  override render() {
    const props = this.props;
    const state = this.state;
    const { prefixCls = 'Calendar', timePicker, className, locale = defaultLocale } = props;
    const { selectedValue } = state;
    const classes = classNames(className, {
      [prefixCls]: true,
      [`${prefixCls}-range`]: true,
      [`${prefixCls}-waingAble`]: state.waingAble,
    });

    const startValue = this.getStartValue();
    const endValue = this.getEndValue();

    let taskHeader: React.JSX.Element | null = null;

    if (this.props.mode === 'task') {
      let startChecked = false;

      if (this.state.selectedValue[0]) {
        startChecked = true;
      }

      let endChecked = false;

      if (this.state.selectedValue[1]) {
        endChecked = true;
      }

      taskHeader = (
        <TaskHeader
          startChecked={startChecked}
          endChecked={endChecked}
          toggle={(type, checked: boolean) => {
            this.toggleValue(type, checked);
          }}
        />
      );
    }

    return (
      <div
        className={classes}
        ref={root => {
          this._root = root;
        }}
      >
        {taskHeader}
        <div className={`${prefixCls}-panel`}>
          <div className={`${prefixCls}-date-panel`}>
            <CalendarPart
              {...props}
              value={startValue}
              direction="left"
              onSelect={this.onStartDateSelect}
              selectedValue={selectedValue}
              onValueChange={this.onStartValueChange}
            />
            <span className={`${prefixCls}-range-middle`} />
            <CalendarPart
              {...props}
              value={endValue}
              direction="right"
              waingAble={state.waingAble}
              onSelect={this.onEndDateSelect}
              selectedValue={selectedValue}
              onValueChange={this.onEndValueChange}
            />
          </div>
        </div>
        <RangeFooter
          locale={locale}
          prefixCls={prefixCls}
          timePicker={timePicker}
          mode={this.props.mode}
          onOk={this.onOk}
          onClear={this.clear}
          startValue={selectedValue[0]}
          endValue={selectedValue[1]}
          halfStart={this.state.halfData[0]}
          halfEnd={this.state.halfData[1]}
          halfOnChange={(value, target) => {
            this.halfOnChange(value, target);
          }}
          onStartTimeSelect={this.onStartTimeSelect}
          onEndTimeSelect={this.onEndTimeSelect}
          popupParentNode={props.popupParentNode}
        />
      </div>
    );
  }
}

export default CalendarRange;
