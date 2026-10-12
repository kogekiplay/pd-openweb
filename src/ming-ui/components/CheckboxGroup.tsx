import { Component } from 'react';
import type { ReactNode } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { default as Checkbox, SIZE_LIST } from './Checkbox';
import type { CheckboxProps } from './Checkbox';
import './less/CheckboxGroup.less';

export type CheckboxGroupItem<V = unknown> = Omit<CheckboxProps<V>, 'onClick'>;

export interface CheckboxGroupProps<V = unknown> {
  data?: readonly CheckboxGroupItem<V>[] | null | undefined;
  defaultCheckedValues?: readonly (V | undefined)[] | null | undefined;
  checkedValues?: readonly (V | undefined)[] | null | undefined;
  onChange?: ((value: V | undefined) => void) | undefined;
  size?: (typeof SIZE_LIST)[number] | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  vertical?: boolean | undefined;
  /** Legacy caller metadata retained without forwarding it to label elements. */
  name?: string | undefined;
  children?: ReactNode;
}

interface CheckboxGroupState<V> {
  data: CheckboxGroupItem<V>[];
}

class CheckboxGroup<V = unknown> extends Component<CheckboxGroupProps<V>, CheckboxGroupState<V>> {
  data: CheckboxGroupItem<V>[];
  static override propTypes = {
    data: PropTypes.arrayOf(
      PropTypes.shape({
        text: PropTypes.any, // Raio显示的名称
        value: PropTypes.any, // 不参与渲染的泛型值，原样返回给 onChange
      }),
    ), // 数据
    defaultCheckedValues: PropTypes.array, // 默认选中
    checkedValues: PropTypes.array, // 传入checkedName之后，将只根据checkId来判断选中
    onChange: PropTypes.func, // 回调， onClick(value)
    size: PropTypes.oneOf(SIZE_LIST), // 大小 默认default
    children: PropTypes.any, // 子元素
    disabled: PropTypes.bool, // 是否禁用
    name: PropTypes.string, // 表单item名字
    className: PropTypes.string,
    /**
     * 是否垂直排列，默认为false
     */
    vertical: PropTypes.bool,
  };

  static defaultProps = {
    vertical: false,
  };

  constructor(props: CheckboxGroupProps<V>) {
    super(props);
    const checkedValues = props.checkedValues || props.defaultCheckedValues || [];
    this.state = {
      data: this.getCheckedData(props.data || [], checkedValues),
    };
    this.data = this.getCheckedData(this.state.data, checkedValues);
  }

  override componentDidUpdate(prevProps: CheckboxGroupProps<V>) {
    if (this.props.data === prevProps.data && this.props.checkedValues === prevProps.checkedValues) return;
    const selected = this.props.checkedValues || this.state.data.filter(item => item.checked).map(item => item.value);
    this.data = this.getCheckedData(this.props.data || [], selected);
    this.setState({ data: this.data });
  }

  handleClick(checked: boolean, value: V | undefined) {
    const { onChange } = this.props;

    if (this.props.checkedValues === undefined || this.props.checkedValues === null) {
      const selected = this.state.data.filter(item => item.checked).map(item => item.value);
      this.checkedArraytoData(checked ? selected.filter(item => item !== value) : [...selected, value]);
    }

    if (onChange) {
      onChange(value);
    }
  }

  getCheckedData(
    data: readonly CheckboxGroupItem<V>[],
    checkedArray: readonly (V | undefined)[] | null | undefined,
  ): CheckboxGroupItem<V>[] {
    // Clone presentation metadata while keeping the opaque value's identity.
    const nextData = data.map(item => ({ ..._.cloneDeep(item), value: item.value }));
    if (!checkedArray) return nextData;
    return nextData.map(item => {
      if (checkedArray.indexOf(item.value) >= 0) {
        item.checked = true;
      } else {
        item.checked = false;
      }

      return item;
    });
  }

  checkedArraytoData(checkedArray: readonly (V | undefined)[] | null | undefined) {
    if (!checkedArray) return;
    this.data = this.getCheckedData(this.data, checkedArray);
    this.setState({
      data: this.data,
    });
  }

  override render() {
    const { className, vertical } = this.props;
    const cls = cx('ming CheckboxGroup', className, {
      'CheckboxGroup--vertical': vertical,
    });
    return (
      <div className={cls}>
        {this.state.data.map((props, index: number) => (
          <Checkbox
            {...props}
            onClick={(checked, value) => this.handleClick(checked, value)}
            key={index}
            size={this.props.size}
            disabled={this.props.disabled || props.disabled}
          />
        ))}
      </div>
    );
  }
}

export default CheckboxGroup;
