import { Component } from 'react';
import type { ChangeEvent } from 'react';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { times } from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import Icon from 'ming-ui/components/Icon';
import PanelSelect from './PanelSelect';
import type { TimePanelProps, TimeUnit } from './types';

// 将布尔值转化为数�
const boolToNumber = (bool: boolean | undefined) => {
  if (bool) {
    return 1;
  }

  return 0;
};

class Panel extends Component<TimePanelProps, { inputValue: string }> {
  declare _panel: HTMLDivElement | null | undefined;
  static defaultProps = {
    onChange: () => {},
  };

  static override propTypes = {
    placeholder: PropTypes.string,
    panelCls: PropTypes.string,
    format: PropTypes.func,
    optionFormatter: PropTypes.func,
    value: PropTypes.object,
    getRef: PropTypes.func,
    defaultOpenValue: PropTypes.object,
    onChange: PropTypes.func,
    onClear: PropTypes.func,
    onClose: PropTypes.func,
    showHour: PropTypes.bool,
    showMinute: PropTypes.bool,
    showSecond: PropTypes.bool,
    disabledHours: PropTypes.func,
    disabledMinutes: PropTypes.func,
    disabledSeconds: PropTypes.func,
  };

  constructor(props: TimePanelProps) {
    super(props);
    const { value, format } = props;
    this.state = {
      inputValue: format(value),
    };
  }

  override componentDidUpdate(prevProps: TimePanelProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { value, format } = this.props;
      this.setState({
        inputValue: format(value),
      });
    }
  }

  handleSelect = (type: TimeUnit, option: number) => {
    const { defaultOpenValue } = this.props;
    const value = moment(this.props.value || defaultOpenValue);

    if (type === 'hour') {
      value.hour(option);
    } else if (type === 'minute') {
      value.minute(option);
    } else if (type === 'second') {
      value.second(option);
    }

    const { showHour, showMinute, showSecond } = this.props;

    if ([showHour, showMinute, showSecond].filter(x => x).length === 1) {
      this.props.onClose?.();
    }

    this.props.onChange?.(value);
  };

  handleIptChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ inputValue: event.target.value });
  };

  handleClear = () => {
    this.props.onClear?.();
  };

  refFunc = (panel: HTMLDivElement | null) => {
    this._panel = panel;
    this.props.getRef?.(panel);
  };

  renderHour = () => {
    const { showHour, defaultOpenValue, disabledHours } = this.props;
    const value = this.props.value || defaultOpenValue;
    const hour = value.hour();
    const hourOptions = times(24).map(
      this.props.optionFormatter ? this.props.optionFormatter : n => String(n).padStart(2, '0'),
    );
    const disabledSelect = disabledHours ? disabledHours() : [];

    if (showHour) {
      return (
        <PanelSelect
          type="hour"
          disabledSelect={disabledSelect}
          selectedIndex={hour}
          onSelect={this.handleSelect}
          options={hourOptions}
        />
      );
    }

    return null;
  };

  renderMinute = () => {
    const { showMinute, defaultOpenValue, disabledMinutes } = this.props;
    const value = this.props.value || defaultOpenValue;
    const minute = value.minute();
    const minuteOptions = times(60).map(
      this.props.optionFormatter ? this.props.optionFormatter : n => String(n).padStart(2, '0'),
    );
    const disabledSelect = disabledMinutes ? disabledMinutes(value.hour()) : [];

    if (showMinute) {
      return (
        <PanelSelect
          type="minute"
          disabledSelect={disabledSelect}
          selectedIndex={minute}
          onSelect={this.handleSelect}
          options={minuteOptions}
        />
      );
    }

    return null;
  };

  renderSecond = () => {
    const { showSecond, defaultOpenValue, disabledSeconds } = this.props;
    const value = this.props.value || defaultOpenValue;
    const second = value.second();
    const secondOptions = times(60).map(
      this.props.optionFormatter ? this.props.optionFormatter : n => String(n).padStart(2, '0'),
    );
    const disabledSelect = disabledSeconds ? disabledSeconds(value.minute()) : [];

    if (showSecond) {
      return (
        <PanelSelect
          type="second"
          disabledSelect={disabledSelect}
          selectedIndex={second}
          onSelect={this.handleSelect}
          options={secondOptions}
        />
      );
    }

    return null;
  };

  override render() {
    const { panelCls, placeholder, showSecond, showMinute, showHour } = this.props;
    const hours = this.renderHour();
    const minutes = this.renderMinute();
    const seconds = this.renderSecond();
    const result = boolToNumber(showSecond) + boolToNumber(showMinute) + boolToNumber(showHour);
    const cls = classNames(
      {
        'TimePicker-panel--large': result === 3,
        'TimePicker-panel--small': result === 1,
      },
      panelCls,
    );
    return (
      <div ref={this.refFunc} className={classNames('ming TimePicker', cls)}>
        <div className="TimePicker-panel-container">
          <span className="TimePicker-panel-input-container">
            <input
              name="timePickerPanel"
              autoComplete="off"
              readOnly
              placeholder={placeholder}
              value={this.state.inputValue}
              onChange={this.handleIptChange}
              className="TimePicker-panel-input"
            />
            <Icon onClick={this.handleClear} className="TimePicker-input-clear" icon="close" />
          </span>

          <div className="TimePicker-panel">
            {hours}
            {minutes}
            {seconds}
          </div>
        </div>
      </div>
    );
  }
}

export default Panel;
