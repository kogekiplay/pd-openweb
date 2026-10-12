import { Component } from 'react';
import type { MouseEvent } from 'react';
import PropTypes from 'prop-types';
import type { NumericTableProps } from './types';

class YearTable extends Component<NumericTableProps> {
  static defaultProps = { value: null, page: null, onChange: () => {} };
  /**
   * 渲染列表
   */
  renderList = () => {
    const list = [];
    const value = this.props.value ?? new Date().getFullYear();

    let page = this.props.page;

    if (page == null) {
      page = value % 16 ? 16 * Math.floor(value / 16) + 1 : 16 * (Math.floor(value / 16) - 1) + 1;
    }

    for (let i = 0; i < 16; i++) {
      const item = page + i;
      let className = '';

      if (this.props.value !== undefined && item === this.props.value) {
        className = 'active';
      }

      list.push(
        <li
          className={className}
          key={item}
          onClick={event => {
            this.itemOnClick(event, item);
          }}
        >
          {item}
        </li>,
      );
    }

    return list;
  };

  /**
   * 选择年
   */
  itemOnClick = (event: MouseEvent<HTMLLIElement>, year: number) => {
    if (year !== this.props.value && this.props.onChange) {
      this.props.onChange(event, year, {
        prevValue: this.props.value,
      });
    }
  };

  override render() {
    // list items
    const list = this.renderList();

    return <ul className="calendar-year-table">{list}</ul>;
  }
}

YearTable.propTypes = {
  /**
   * 当前年份
   */
  value: PropTypes.number,
  /**
   * 起始年份（每页 16 年）
   */
  page: PropTypes.number,
  /**
   * 【回调】年份改变
   * @param {Event} event - 点击事件
   * @param {number} value - 选中的年份
   * @param {Object} data - 其他数据
   * data.prevValue {number} - 改变前的年份
   */
  onChange: PropTypes.func,
};

export default YearTable;
