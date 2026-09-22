import React, { Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { formatNumberFromInput } from 'src/utils/control';
import './less/Input.less';

const SIZE_LIST = ['small', 'default'];

class Input extends Component<any, any> {
  static propTypes = {
    type: PropTypes.string,
    defaultValue: PropTypes.string,
    value: PropTypes.string,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    onChange: PropTypes.func,
    onChangeText: PropTypes.func,
    size: PropTypes.oneOf(SIZE_LIST),
    name: PropTypes.string, // 表单item名字
    manualRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  };
  static defaultProps = {
    type: 'text',
  };
  constructor(props) {
    super(props);
    let value = '';

    if ('defaultValue' in props) {
      value = props.defaultValue;
    }

    if ('value' in props) {
      value = props.value;
    }

    this.state = {
      value,
    };
  }

  onChange(event) {
    let value = event.target.value;

    if (this.props.valueFilter) {
      value = this.props.valueFilter(value);
    }

    if (this.props.value === undefined) {
      this.setState({
        value,
      });
    }

    if (this.props.onChange) {
      this.props.onChange(value);
    }

    if (this.props.onChangeText) {
      this.props.onChangeText(value);
    }
  }

  render() {
    /* 【这些是本组件自己的 props，绝不能跟着 ...others 落到 <input> 上】
       原先只摘了 size/type/manualRef/value，于是控制台每次都报两条：
       · valueFilter -> "React does not recognize the `valueFilter` prop on a DOM element"
       · defaultValue -> "contains an input with both value and defaultValue"
         （构造函数里已经用它做过初始值了，再透传给 DOM 就成了受控+非受控并存）
       onChange / onChangeText 同理：onChange 虽然被下面显式的那个覆盖掉、
       不会真的出错，但留在 others 里纯属误导。 */
    const { size, type, manualRef, value, defaultValue, valueFilter, onChange, onChangeText, ...others } = this.props;
    const inputValue = value === undefined ? this.state.value : value;

    return (
      <input
        name="input"
        autoComplete="off"
        {...others}
        type={type}
        ref={manualRef}
        value={inputValue}
        className={cx(SIZE_LIST.indexOf(size) >= 0 ? 'Input--' + size : '', 'ming Input', this.props.className)}
        onChange={event => this.onChange(event)}
      />
    );
  }
}

Input.NumberInput = function (props) {
  const { value, onChange, onBlur, ...rest } = props;
  return (
    <Input
      {...rest}
      value={value}
      onBlur={e => {
        onBlur(e.target.value === '-' ? '' : parseFloat(e.target.value));
      }}
      onChange={e => {
        onChange(formatNumberFromInput(e.target.value));
      }}
    />
  );
};

export default Input;
