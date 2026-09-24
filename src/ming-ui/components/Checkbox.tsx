import React from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import PropTypes from 'prop-types';
import Icon from './Icon';
import './less/Checkbox.less';

export const SIZE_LIST = ['small', 'default'] as const;

export interface CheckboxProps<V = any> {
  /** 复选框旁的文字 */
  text?: ReactNode;
  /** 去掉方框的右边距 */
  noMargin?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  /** 给了就是受控：只显示它，点击不会自己翻转 */
  checked?: boolean | undefined;
  /**
   * 点击（禁用时不触发）。第一个参数的含义随受控与否不同：
   * 受控（传了 checked）时是【点击前】的 checked，调用方自己取反；不受控时是翻转【之后】的值
   */
  onClick?: ((checked: boolean, value: V, event: MouseEvent<HTMLLabelElement>) => void) | undefined;
  /** 原样作为 onClick 的第二个参数 */
  value?: V;
  size?: (typeof SIZE_LIST)[number] | undefined;
  /** 跟在方框和文字后面 */
  children?: ReactNode;
  disabled?: boolean | undefined;
  /** 部分选中：方框里不打勾，显示成实心方块 */
  indeterminate?: boolean | undefined;
  /** 部分选中：方框里显示横线 */
  clearselected?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  title?: string | undefined;
  styleType?: 'light' | 'default' | undefined;
  textPosition?: 'left' | 'right' | undefined;
}

class Checkbox<V = any> extends React.Component<CheckboxProps<V>, { checked: boolean }> {
  static override propTypes = {
    /**
     * checkbox显示的元素
     */
    text: PropTypes.any,
    /**
     * 是否没有margin
     */
    noMargin: PropTypes.bool,
    /**
     * 默认是否选中
     */
    defaultChecked: PropTypes.bool,
    /**
     * 选中
     */
    checked: PropTypes.bool,
    /**
     * 回调， onClick(checked, value)
     */
    onClick: PropTypes.func.isRequired,
    /**
     * 在回调中作为第二个参数返回
     */
    value: PropTypes.any,
    /**
     *  大小 默认default
     */
    size: PropTypes.oneOf(['small', 'default']),
    /**
     * 子元素
     */
    children: PropTypes.any,
    /**
     * 是否禁用
     */
    disabled: PropTypes.bool,
    /**
     * 表单item名字
     */
    name: PropTypes.string,
    /**
     * 是否为复选框组
     */
    isGroup: PropTypes.bool,
    /**
     * 多选时，部分选择 中间显示方块
     */
    indeterminate: PropTypes.bool,
    /**
     * 多选时，部分选择 中间显示横线
     */
    clearselected: PropTypes.bool,
    /**
     * 类名
     */
    className: PropTypes.string,
    /**
     * 样式风格
     */
    styleType: PropTypes.oneOf(['light', 'default']),
    /**
     * 文字位置
     */
    textPosition: PropTypes.oneOf(['left', 'right']),
  };

  static defaultProps = {
    onClick: () => {},
    indeterminate: false,
    textPosition: 'right',
  };

  constructor(props: CheckboxProps<V>) {
    super(props);
    const checked = props.checked || props.defaultChecked;
    this.state = {
      checked: !!checked,
    };
  }

  override componentDidUpdate(prevProps: CheckboxProps<V>) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.checked !== undefined) {
        this.setState({
          checked: this.props.checked,
        });
      }
    }
  }

  handleClick(event: MouseEvent<HTMLLabelElement>) {
    // onClick 运行时一定有（defaultProps 给了空函数），?. 只是因为类型上它是可选属性。
    // value 是可选属性：没传时回调收到 undefined，和原来一样
    const { onClick, value } = this.props;
    if (this.props.disabled) return false;
    if (this.props.checked !== undefined) {
      onClick?.(this.props.checked, value as V, event);
    } else {
      const checked = !this.state.checked;
      this.setState({
        checked,
      });
      onClick?.(checked, value as V, event);
    }
    return undefined;
  }

  override render() {
    const {
      text,
      children,
      disabled,
      className,
      size,
      indeterminate,
      clearselected,
      title,
      style,
      noMargin,
      styleType = '',
      textPosition = 'left',
    } = this.props;
    let icon: React.JSX.Element | null = null;

    if (!indeterminate && this.state.checked) {
      icon = <Icon icon="ok" />;
    }

    if (clearselected) {
      icon = <Icon icon="minus" />;
    }

    return (
      <label
        style={style}
        // 原来还有 checked={this.state.checked}：<label> 没有这个属性，React 不会把它写进 DOM，也没有样式或代码读它
        className={cx(
          disabled ? 'Checkbox--disabled' : '',
          styleType === 'light' ? 'Checkbox--light' : '',
          'ming Checkbox overflow_ellipsis',
          {
            checked: !indeterminate && this.state.checked,
            indeterminate,
            clearselected,
          },
          className,
        )}
        onClick={event => {
          event.nativeEvent.stopImmediatePropagation();
          this.handleClick(event);
        }}
        title={title}
      >
        {textPosition === 'left' && <span className="Font13 Checkbox-text">{text}</span>}
        <span
          className={cx(size && SIZE_LIST.includes(size) ? 'Checkbox-box--' + size : '', 'Checkbox-box')}
          style={noMargin ? { marginRight: 0 } : {}}
        >
          {icon}
        </span>
        {textPosition === 'right' && <span className="Font13 Checkbox-text">{text}</span>}
        {children}
      </label>
    );
  }
}

export default Checkbox;
