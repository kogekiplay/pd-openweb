import { Component } from 'react';
import type { CSSProperties } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { default as Radio, SIZE_LIST } from './Radio';
import type { RadioProps, RadioSize } from './Radio';

export { Radio, SIZE_LIST };

/** 一个选项：整个展开到 <Radio> 上，所以 Radio 的属性（title、icon、disabled…）都能写在项里 */
export type RadioGroupItem<V = any> = Omit<RadioProps<V>, 'onClick'>;

interface RadioGroupProps<V> {
  data?: readonly RadioGroupItem<V>[] | undefined;
  /** 选中项的值，每次变化都会重新按它标出选中项 */
  checkedValue?: V | null | undefined;
  /** 只在挂载时用一次，优先于 checkedValue */
  defaultCheckedValue?: V | null | undefined;
  /** 点选某项，参数是那一项的 value */
  onChange?: ((value: V) => void) | undefined;
  size?: RadioSize | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** 竖排 */
  vertical?: boolean | undefined;
  /** 给每个选项的 className */
  radioItemClassName?: string | undefined;
  disableTitle?: boolean | undefined;
  /** 挂载时把 checkedValue 当作点了一次，触发 onChange */
  needDefaultUpdate?: boolean | undefined;
}

function formatData<V>(value: V | null | undefined, data: readonly RadioGroupItem<V>[] | undefined) {
  if (value === null || value === undefined || value === '') {
    return data;
  } else {
    return (data || []).map(item => {
      item.checked = item.value === value;
      return item;
    });
  }
}

class RadioGroup<V = any> extends Component<RadioGroupProps<V>, { data: readonly RadioGroupItem<V>[] | undefined }> {
  static override propTypes = {
    data: PropTypes.arrayOf(
      PropTypes.shape({
        text: PropTypes.any, // Raio显示的名称
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
      }),
    ), // 数据
    checked: PropTypes.string, // 选中
    defaultCheckedValue: PropTypes.string, // 默认选中
    checkedValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // 传入checkedValue之后，将只根据checkId来判断选中
    onChange: PropTypes.func, // 回调， onClick(value)
    size: PropTypes.oneOf(SIZE_LIST), // 大小 默认default
    children: PropTypes.node, // 子元素
    disabled: PropTypes.bool, // 是否禁用
    name: PropTypes.string, // 表单item名字
    className: PropTypes.string,
    vertical: PropTypes.bool, // 是否垂直展示
    radioItemClassName: PropTypes.string,
  };

  constructor(props: RadioGroupProps<V>) {
    super(props);

    // const checkedValue = this.props.defaultCheckedValue || this.props.checkedValue || null;
    const checkedValue =
      this.props.defaultCheckedValue !== undefined
        ? this.props.defaultCheckedValue
        : this.props.checkedValue !== undefined
          ? this.props.checkedValue
          : null;

    this.state = {
      data: formatData(checkedValue, this.props.data),
    };
  }

  override componentDidMount() {
    const { needDefaultUpdate, checkedValue } = this.props;
    // 原来只排除 undefined；唯一用 needDefaultUpdate 的 DeleteReconfirm 不传 checkedValue，null 这一支从来走不到
    if (needDefaultUpdate && checkedValue !== undefined && checkedValue !== null) {
      this.handleClick(checkedValue);
    }
  }

  override componentDidUpdate(prevProps: RadioGroupProps<V>) {
    if (!shallowEqual(prevProps, this.props)) {
      this.refreshId(this.props.checkedValue, this.props.data);
    }
  }

  handleClick(value: V) {
    const { onChange } = this.props;

    this.refreshId(value, this.state.data);

    if (onChange) {
      onChange(value);
    }
  }

  refreshId(value: V | null | undefined, data: readonly RadioGroupItem<V>[] | undefined) {
    this.setState({
      data: formatData(value, data),
    });
  }

  override render() {
    const { className, vertical, style, radioItemClassName } = this.props;
    const cls = cx('ming RadioGroup', className, {
      'RadioGroup--vertical': vertical,
    });
    return (
      <div style={style} className={cls}>
        {(this.state.data || []).map((item, index: number) => (
          <Radio
            {...this.props}
            {...item}
            className={radioItemClassName}
            onClick={value => this.handleClick(value)}
            key={index}
            disabled={this.props.disabled || item.disabled}
          />
        ))}
      </div>
    );
  }
}

export default RadioGroup;
