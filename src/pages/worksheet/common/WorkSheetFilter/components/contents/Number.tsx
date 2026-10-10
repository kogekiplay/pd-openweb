import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { FILTER_CONDITION_TYPE } from '../../enum';
import type { NumberFilterProps, NumberFilterValues, PrimitiveValue } from '../../primitiveTypes';

export default class Number extends Component<NumberFilterProps, NumberFilterValues> {
  static override propTypes = {
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
    value: PropTypes.number,
    maxValue: PropTypes.number,
    minValue: PropTypes.number,
    type: PropTypes.number,
  };
  constructor(props: NumberFilterProps) {
    super(props);
    this.state = {
      value: props.value,
      minValue: props.minValue,
      maxValue: props.maxValue,
    };
  }

  override componentDidUpdate(prevProps: NumberFilterProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (
        this.props.value !== prevProps.value ||
        this.props.minValue !== prevProps.minValue ||
        this.props.maxValue !== prevProps.maxValue
      ) {
        this.setState(
          Object.assign(this.state, {
            value: this.props.value,
            minValue: this.props.minValue,
            maxValue: this.props.maxValue,
          }),
        );
      }
    }
  }

  handleChange = () => {
    const { onChange } = this.props;
    let { value, maxValue, minValue } = this.state;

    function isEmpty(v: PrimitiveValue) {
      return _.isUndefined(v) || v === '';
    }

    const changes: NumberFilterValues = {};

    if (isEmpty(value) && isEmpty(minValue) && isEmpty(maxValue)) {
      return;
    }

    if (minValue && maxValue && parseFloat(String(maxValue)) < parseFloat(String(minValue))) {
      changes.minValue = maxValue;
      changes.maxValue = minValue;
      this.setState({
        minValue: maxValue,
        maxValue: minValue,
      });
    } else {
      changes.maxValue = maxValue;
      changes.minValue = minValue;
      changes.value = value;
    }

    if (value !== this.props.value || minValue !== this.props.minValue || maxValue !== this.props.maxValue) {
      onChange(changes);
    }
  };

  setValue = (key: keyof NumberFilterValues, value: string) => {
    const newValues = {
      value: this.state.value,
      minValue: this.state.minValue,
      maxValue: this.state.maxValue,
    };
    value = value.trim().replace(/[^-\d.]/g, '');
    newValues[key] = value;
    this.setState(newValues);
  };
  override render() {
    const { type, disabled } = this.props;
    const { value = '', maxValue = '', minValue = '' } = this.state;
    return (
      <div className="worksheetFilterNumberCondition">
        {type === FILTER_CONDITION_TYPE.BETWEEN || type === FILTER_CONDITION_TYPE.NBETWEEN ? (
          <div className="numberRange flexRow">
            <div className="flex">
              <input
                name="contentsNumber1"
                autoComplete="off"
                disabled={disabled}
                type="text"
                className="ming Input"
                value={minValue === null ? undefined : minValue}
                placeholder={_l('最小值')}
                onChange={e => this.setValue('minValue', e.target.value)}
                onBlur={this.handleChange}
                maxLength={18}
              />
            </div>
            <span className="split">-</span>
            <div className="flex">
              <input
                name="contentsNumber2"
                autoComplete="off"
                disabled={disabled}
                type="text"
                className="ming Input"
                value={maxValue === null ? undefined : maxValue}
                placeholder={_l('最大值')}
                onChange={e => this.setValue('maxValue', e.target.value)}
                onBlur={this.handleChange}
                maxLength={18}
              />
            </div>
          </div>
        ) : (
          <input
            name="contentsNumber3"
            autoComplete="off"
            disabled={disabled}
            type="text"
            className="ming Input w100"
            value={value === null ? undefined : value}
            placeholder={_l('请输入数值')}
            onChange={e => this.setValue('value', e.target.value)}
            onBlur={this.handleChange}
            maxLength={18}
          />
        )}
      </div>
    );
  }
}
