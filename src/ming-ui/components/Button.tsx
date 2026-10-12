import { Component } from 'react';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import Icon from './Icon';
import './less/Button.less';

export const BUTTON_TYPE_LIST = [
  'primary',
  'secondary',
  'success',
  'danger',
  'ghost',
  'link',
  'ghostgray',
  'danger-gray',
];
export const BUTTON_SIZE_LIST = ['tiny', 'small', 'medium', 'large', 'mdnormal', 'mdbig']; // 'mini', 'huge', 'massive'

export interface ButtonState {
  loading: boolean;
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  /** Visual class variants also support application-specific Button-- classes. */
  type?: string | undefined;
  size?: string | undefined;
  radius?: boolean | undefined;
  fullWidth?: boolean | undefined;
  loading?: boolean | undefined;
  loadingClassName?: string | undefined;
  icon?: string | null | undefined;
  action?: ((this: Button, event: MouseEvent<HTMLButtonElement>) => unknown) | undefined;
  onClick?: ((this: Button, event: MouseEvent<HTMLButtonElement>) => unknown) | undefined;
}

export default class Button extends Component<ButtonProps, ButtonState> {
  declare width: number | undefined;
  mounted = false;
  declare button: HTMLButtonElement | null | undefined;
  declare promise: unknown;
  private actionGeneration = 0;
  private measurementTimer: ReturnType<typeof setTimeout> | undefined;

  static override propTypes = {
    /**
     * 按钮子节点
     */
    children: PropTypes.node,
    /**
     * 按钮点击后调用异步action
     */
    action: PropTypes.func,
    /**
     * 是否禁用
     */
    disabled: PropTypes.bool,
    /**
     * 按钮是否处于载入状态
     */
    loading: PropTypes.bool,
    /**
     * 按钮类型
     */
    type: PropTypes.oneOf(BUTTON_TYPE_LIST),
    /**
     * 按钮尺寸大小
     */
    size: PropTypes.oneOf(BUTTON_SIZE_LIST),
    /**
     * 是否撑满容器
     */
    fullWidth: PropTypes.bool,
    /**
     * 按钮类名
     */
    className: PropTypes.string,
    /**
     * 按钮的图标类型
     */
    icon: PropTypes.string,
    /**
     * 点击按钮触发的回调
     */
    onClick: PropTypes.func,
    /**
     * 点击按钮触发的回调
     */
    style: PropTypes.object,
    /**
     * 是否是圆角
     */
    radius: PropTypes.bool,
  };

  static defaultProps = {
    type: 'primary',
    size: 'medium',
    radius: false,
  };

  override state = {
    loading: false,
  };

  override componentDidMount() {
    this.mounted = true;
    // A revived lifecycle no longer owns the action invalidated at unmount.
    if (this.state.loading) this.setState({ loading: false });
    if (!this.props.loading && !this.state.loading) {
      this.measurementTimer = setTimeout(() => {
        this.measurementTimer = undefined;
        if (this.mounted) this.computeWidth();
      }, 0);
    }
  }

  override componentDidUpdate(prevProps: ButtonProps, prevState: ButtonState) {
    if (
      this.props.children !== prevProps.children ||
      ((this.props.loading || this.state.loading) && !(prevProps.loading || prevState.loading))
    ) {
      this.computeWidth();
    }
  }

  override componentWillUnmount() {
    this.mounted = false;
    ++this.actionGeneration;
    if (this.measurementTimer !== undefined) clearTimeout(this.measurementTimer);
    this.measurementTimer = undefined;
  }

  computeWidth() {
    // loading 的时候保持宽度不变
    if (!(this.button instanceof Element)) return;

    this.width = this.button.getBoundingClientRect().width;
  }

  handleClick(...args: [MouseEvent<HTMLButtonElement>]) {
    const { action, onClick } = this.props;

    if (action) {
      const generation = ++this.actionGeneration;
      try {
        this.promise = action.apply(this, args);
        this.setState({ loading: true });
        const stopLoading = () => {
          if (this.mounted && generation === this.actionGeneration) this.setState({ loading: false });
        };

        // Preserve the actual receiver when a custom thenable supplies a getter.
        const then: unknown = this.promise ? Reflect.get(Object(this.promise), 'then', this.promise) : undefined;
        if (typeof then === 'function') {
          Reflect.apply(then, this.promise, [stopLoading, stopLoading]);
        } else if (then !== undefined && then !== null) {
          throw new TypeError('Invalid button action promise');
        } else {
          stopLoading();
        }
      } catch (e) {
        if (this.mounted && generation === this.actionGeneration) this.setState({ loading: false });
        console.error(e);
      }
    }

    if (onClick) onClick.apply(this, args);
  }

  override render() {
    const loading = this.props.loading || this.state.loading;
    const {
      disabled,
      type,
      radius,
      size,
      icon,
      fullWidth,
      children,
      className,
      style,
      loadingClassName,
      loading: _loading,
      action: _action,
      onClick: _onClick,
      ...otherProps
    } = this.props;

    const content = loading ? (
      <div className={cx(loadingClassName, 'Button-loadingCircle')} />
    ) : typeof children === 'string' ? (
      <span>{children}</span>
    ) : (
      children
    );

    const btnCls = cx(
      'ming',
      {
        'Button--disabled': disabled,
        'Button--loading': loading,
        ['Button--' + size]: size,
        ['Button--' + type]: type,
        ['Button--circle']: radius,
      },
      'Button',
      className,
    );

    const btnStyle = Object.assign(
      {},
      {
        width: fullWidth ? '100%' : loading ? this.width : 'auto',
      },
      style,
    );
    const clickHandler =
      disabled || loading ? undefined : (event: MouseEvent<HTMLButtonElement>) => this.handleClick(event);

    return (
      <button
        {...otherProps}
        type="button"
        ref={button => {
          this.button = button;
        }}
        style={btnStyle}
        disabled={disabled || loading}
        className={btnCls}
        onClick={clickHandler}
        onKeyDown={e => {
          e.preventDefault();
        }}
      >
        {!loading && icon && <Icon icon={icon} />}
        {content}
      </button>
    );
  }
}
