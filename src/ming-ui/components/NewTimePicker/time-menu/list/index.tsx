import React, { Component } from 'react';
import type { RefObject } from 'react';
import PropTypes from 'prop-types';
import type { ClockEvent, TimeItem, TimeListProps } from '../../types';
import './style.less';

class List extends Component<TimeListProps> {
  declare timeRef: RefObject<HTMLUListElement | null>;
  static defaultProps = { data: [], onPick: () => {} };
  override componentDidUpdate(prevProps: TimeListProps) {
    if (prevProps.data !== this.props.data) this.scrollToVisibleRange();
  }
  constructor(props: TimeListProps) {
    super(props);
    this.timeRef = React.createRef<HTMLUListElement>();
  }

  override componentDidMount() {
    this.scrollToVisibleRange();
  }

  scrollToVisibleRange = () => {
    const data = this.props.data || [];
    const index = data.findIndex(value => value.current);
    const current = this.timeRef.current;
    const parent = current?.parentElement;
    if (index < 0 || !current || !parent || !data.length) return;
    parent.scrollTop = Math.max(
      0,
      Math.floor(current.offsetHeight * (index / data.length)) - Math.floor(parent.offsetHeight / 2),
    );
  };

  itemOnClick = (event: ClockEvent, item: TimeItem) => {
    if (item.disabled) {
      return;
    }

    if (this.props.onPick) {
      this.props.onPick(event, item.value);
    }
  };

  override render() {
    const items = (this.props.data || []).map(item => {
      const classList = [];

      if (item.disabled) {
        classList.push('disabled');
      }

      if (item.current) {
        classList.push('current');
        classList.push('bgColorPrimary');
      }

      const classNames = classList.join(' ');

      return (
        <li
          key={item.value}
          className={classNames}
          onClick={event => {
            this.itemOnClick(event, item);
          }}
        >
          {item.label}
        </li>
      );
    });
    return (
      <ul className="mui-timemenu-list" ref={this.timeRef}>
        {items}
      </ul>
    );
  }
}

List.propTypes = {
  /**
   * 数据列表
   */
  data: PropTypes.any,
  /**
   * 选择
   * @param {event} event - 事件
   * @param {any} value - 选中的值
   */
  onPick: PropTypes.func,
};

export default List;
