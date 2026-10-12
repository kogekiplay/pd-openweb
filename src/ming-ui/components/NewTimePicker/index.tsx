import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import { getDomNode } from '../ClickAway';
import TimeMenu from './time-menu';
import { normalizeClock } from './types';
import type { ClockEvent, ClockTime, TimeProps } from './types';
import './style.less';

interface TimeState {
  value: ClockTime;
  label: string;
  menuOpened: boolean;
}

class Time extends Component<TimeProps, TimeState> {
  static defaultProps: Partial<TimeProps> = {
    type: 'minute',
    min: null,
    max: null,
    disabled: false,
    onChange: () => {},
  };
  declare button: HTMLButtonElement | null;
  declare root: HTMLDivElement | null;

  constructor(props: TimeProps) {
    super(props);

    const value = normalizeClock(props.value);

    this.state = {
      /**
       * 当前值
       */
      value,
      /**
       * 显示文本
       */
      label: this.getTimeLabel(value),
      /**
       * 菜单是否展开
       */
      menuOpened: false,
    };

    this.button = null;
    this.root = null;
  }

  override componentDidMount() {
    window.addEventListener('mousedown', this.clickListener, false);

    window.addEventListener('keydown', this.keyDownListener, false);
  }

  override componentDidUpdate(prevProps: TimeProps) {
    if (shallowEqual(prevProps, this.props)) return;
    const value = prevProps.value !== this.props.value ? normalizeClock(this.props.value) : this.state.value;
    const label = this.getTimeLabel(value);
    this.setState({ value, label, menuOpened: this.props.disabled ? false : this.state.menuOpened });
  }

  override componentWillUnmount() {
    window.removeEventListener('mousedown', this.clickListener, false);

    window.removeEventListener('keydown', this.keyDownListener, false);
  }

  padZero = (value: number) => {
    return value < 10 ? `0${value}` : value.toString();
  };

  getTimeLabel = (time: Readonly<ClockTime>) => {
    let data =
      this.props.type === 'hour' ? [this.padZero(time.hour)] : [this.padZero(time.hour), this.padZero(time.minute)];

    if (this.props.type === 'second') {
      data = [this.padZero(time.hour), this.padZero(time.minute), this.padZero(time.second)];
    }

    return data.join(':');
  };

  clickListener = (e: MouseEvent) => {
    const target = getDomNode(e.target);
    const node = this.root;

    if (node && (node === target || (target && !node.contains(target))) && this.state.menuOpened) {
      this.hideMenu();
    }
  };

  keyDownListener = (e: KeyboardEvent) => {
    if (
      e.keyCode === 27 && // ESC
      this.state.menuOpened
    ) {
      this.hideMenu();
    }
  };

  showMenu() {
    if (this.props.disabled) return;
    this.setState({
      menuOpened: true,
    });
  }

  hideMenu() {
    this.setState({
      menuOpened: false,
    });
  }

  toggleMenuOpened = () => {
    if (this.props.disabled) return;
    this.setState({
      menuOpened: !this.state.menuOpened,
    });
  };

  onPick = (event: ClockEvent, picked: ClockTime) => {
    if (this.props.disabled) return;
    const value = normalizeClock(picked);
    const label = this.getTimeLabel(value);

    this.setState({
      value,
      label,
    });

    if (this.props.onChange) {
      this.props.onChange(event, value, label);
    }
  };

  override render() {
    const classList = ['mui-time'];

    if (this.state.menuOpened && this.button) {
      const rect = this.button.getBoundingClientRect();

      if (window.innerHeight - rect.top < rect.height + 162) {
        classList.push('bottom-edge');
      }

      if (window.innerWidth - rect.left < 122 - rect.width) {
        classList.push('right-edge');
      }
    }

    const classNames = classList.join(' ');

    return (
      <div
        className={classNames}
        ref={root => {
          this.root = root;
        }}
      >
        <button
          ref={button => {
            this.button = button;
          }}
          className="mui-forminput"
          disabled={this.props.disabled}
          onClick={this.toggleMenuOpened}
        >
          <span>{this.state.label}</span>
        </button>
        <TimeMenu
          show={this.state.menuOpened}
          mode={this.props.type}
          value={this.state.value}
          min={this.props.min}
          max={this.props.max}
          onPick={(event, value) => {
            this.onPick(event, value);
          }}
        />
      </div>
    );
  }
}

Time.propTypes = {
  /**
   * 选择模式
   */
  type: PropTypes.oneOf([
    'hour', // HH
    'minute', // HH:mm
    'second', // HH:mm:ss
  ]),
  /**
   * 最小值
   */
  min: PropTypes.any,
  /**
   * 最大值
   */
  max: PropTypes.any,
  /**
   * 选中的值
   */
  value: PropTypes.any,
  /**
   * 是否禁用
   */
  disabled: PropTypes.bool,
  /**
   * 值发生改变
   * @param {event} event - 触发事件
   * @param {object} time - 选中的时间
   * @param {string} label - 时间的展示文本
   */
  onChange: PropTypes.func,
};

export default Time;
export type { ClockTime, TimeMode, TimeProps } from './types';
