import { Component } from 'react';
import type { ChangeEvent, InputHTMLAttributes, Ref } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { formatNumberFromInput } from 'src/utils/control';
import './less/Input.less';

const SIZE_LIST = ['small', 'default'];

// 本组件自己处理的几项之外，其余属性原样落到 <input> 上（onBlur / onKeyDown 拿到的就是原生事件）
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  /** 参数是输入框里的值（经过 valueFilter 之后），【不是事件】 */
  onChange?: ((value: string) => void) | undefined;
  /** 同 onChange，老接口 */
  onChangeText?: ((value: string) => void) | undefined;
  /** 在 onChange 之前改写输入值，比如只留数字 */
  valueFilter?: ((value: string) => string) | undefined;
  size?: 'small' | 'default' | undefined;
  /** 拿到里面的原生 input */
  manualRef?: Ref<HTMLInputElement> | undefined;
}

interface NumberInputProps extends Omit<InputProps, 'onChange' | 'onBlur'> {
  /** 参数是整理过的数字串（去掉非数字、只留一个小数点和开头的负号） */
  onChange?: ((value: string) => void) | undefined;
  /** 参数是数值；只输了一个 '-' 时是空串 */
  onBlur?: ((value: number | '') => void) | undefined;
}

class Input extends Component<InputProps, { value: InputProps['value'] }> {
  /**
   * 只收数字的输入框（ming-ui README 里有用法）。
   * 【原来一输入就抛 TypeError】写的是 onChange={e => onChange(formatNumberFromInput(e.target.value))}，
   * 可 Input 的 onChange 给的是值不是事件（见上面 InputProps）；全仓没有调用方，所以一直没被发现。
   * onBlur 原来也是不给就抛，现在可选。
   */
  static NumberInput = function NumberInput(props: NumberInputProps) {
    const { value, onChange, onBlur, ...rest } = props;
    return (
      <Input
        {...rest}
        value={value}
        onBlur={e => {
          onBlur?.(e.target.value === '-' ? '' : parseFloat(e.target.value));
        }}
        onChange={inputValue => {
          onChange?.(formatNumberFromInput(inputValue));
        }}
      />
    );
  };

  static override propTypes = {
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
  constructor(props: InputProps) {
    super(props);
    let value: InputProps['value'] = '';

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

  onChange(event: ChangeEvent<HTMLInputElement>) {
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

  override render() {
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


export default Input;
