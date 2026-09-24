import { Component } from 'react';
import type { ReactNode } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import { isFunction } from 'lodash';
import PropTypes from 'prop-types';
import './less/RadioGroup.less';

export const SIZE_LIST = ['small', 'default', 'middle'] as const;
export type RadioSize = (typeof SIZE_LIST)[number];

export interface RadioProps<V = any> {
  /** 去掉右边距 */
  noMargin?: boolean | undefined;
  /** 显示的名称 */
  text?: ReactNode;
  /** 点击时原样交给 onClick */
  value?: V;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  /** 点击（禁用时不触发），参数是 value */
  onClick?: ((value: V) => void) | undefined;
  disabled?: boolean | undefined;
  /** 跟在 text 后面 */
  children?: ReactNode;
  size?: RadioSize | undefined;
  className?: string | undefined;
  /** 悬停提示，不给就用 text（text 是字符串或数字时） */
  title?: string | undefined;
  /** 不显示悬停提示 */
  disableTitle?: boolean | undefined;
  /** 文字前的图标，写图标类名，如 icon-edit */
  icon?: string | undefined;
}

class Radio<V = any> extends Component<RadioProps<V>, { checked: boolean | undefined }> {
  static override propTypes = {
    /**
     * 是否没有margin
     */
    noMargin: PropTypes.bool,
    /**
     * Raio显示的名称
     */
    text: PropTypes.any,
    /**
     * 在回调中作为第二个参数返回
     */
    value: PropTypes.any,
    /**
     * 选中
     */
    checked: PropTypes.bool,
    /**
     * 默认选中
     */
    defaultChecked: PropTypes.bool,
    /**
     * 点击
     */
    onClick: PropTypes.func,
    /**
     * 是否禁用
     */
    disabled: PropTypes.bool,
    /**
     * 子节点
     */
    children: PropTypes.any,
    /**
     * 尺寸大小
     */
    size: PropTypes.oneOf(SIZE_LIST),
    /**
     * 类名
     */
    className: PropTypes.string,
    /**
     * 不显示 title
     */
    disableTitle: PropTypes.bool,
  };

  override state = {
    checked: this.props.checked || this.props.defaultChecked,
  };

  override componentDidUpdate(prevProps: RadioProps<V>) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState({
        checked: this.props.checked,
      });
    }
  }

  handleClick = () => {
    const { onClick, value, disabled } = this.props;
    if (disabled) return;
    if (isFunction(onClick)) {
      // value 是可选属性：没传时回调收到 undefined，和原来一样
      onClick(value as V);
    }
  };

  override render() {
    const { checked } = this.state;
    const { disabled, className, size, icon, text, children, title, disableTitle, noMargin } = this.props;
    // 原来是 title={!disableTitle && (title || text)}：disableTitle 时给 <label> 传 false，
    // React 在开发环境逐个报「Received `false` for a non-boolean attribute `title`」；
    // text 是 JSX 时悬停提示会显示成 [object Object]。只拿字符串、数字的 text 兜底
    const hint = title || (typeof text === 'string' || typeof text === 'number' ? String(text) : undefined);

    return (
      <label
        // 原来还有 checked={checked}：<label> 没有这个属性，React 不会把它写进 DOM，也没有样式或代码读它
        className={cx('ming Radio', { 'Radio--disabled': disabled, checked }, className)}
        onClick={this.handleClick}
        title={disableTitle ? undefined : hint}
        style={noMargin ? { marginRight: 0 } : {}}
      >
        <span
          className={cx(size && SIZE_LIST.includes(size) ? 'Radio-box--' + size : '', 'Radio-box')}
          style={noMargin ? { marginRight: 0 } : {}}
        >
          <span className="Radio-box-round" />
        </span>
        <span className="Radio-text">
          {icon && <i className={cx('icon', icon)} />}
          {text}
          {children}
        </span>
      </label>
    );
  }
}

export default Radio;
