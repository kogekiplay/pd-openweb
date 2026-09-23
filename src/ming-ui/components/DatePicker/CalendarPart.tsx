import { Component } from 'react';
import type { Moment } from 'moment';
import PropTypes from 'prop-types';
import CalendarHeader from './CalendarHeaderOld';
import DateTable from './DateTable';
import type defaultLocale from './locale/zh_CN';

interface CalendarPartProps {
  prefixCls?: string | undefined;
  value?: Moment | undefined;
  /** 单选时是一个日期，区间时是 [开始, 结束]（DateTBody 按 Array.isArray 分两路） */
  selectedValue?: Moment | Moment[] | undefined;
  direction?: 'left' | 'right' | undefined;
  locale?: typeof defaultLocale | undefined;
  onSelect?: ((value: Moment) => void) | undefined;
  onValueChange?: ((value: Moment) => void) | undefined;
  disabledDate?: ((current: Moment, value: Moment) => boolean) | undefined;
  // CalendarRange 把自己的 props 整个展开进来
  [key: string]: unknown;
}

class CalendarPart extends Component<CalendarPartProps> {
  static override propTypes = {
    prefixCls: PropTypes.string,
    value: PropTypes.any,
    selectedValue: PropTypes.any,
    direction: PropTypes.string,
    locale: PropTypes.any,
    onSelect: PropTypes.func,
    onValueChange: PropTypes.func,
    disabledDate: PropTypes.func,
  };

  override render() {
    const props = this.props;
    const { prefixCls, value, disabledDate, selectedValue, direction, locale } = props;
    const rangeClassName = `${prefixCls}-range`;
    const newProps = {
      locale,
      value,
      prefixCls,
      direction,
    };

    return (
      <div className={`${rangeClassName}-part ${rangeClassName}-${direction}`}>
        <div>
          <CalendarHeader {...newProps} direction={direction} onValueChange={props.onValueChange} />
          <div className={`${prefixCls}-body`}>
            <DateTable
              {...newProps}
              disabledDate={disabledDate}
              selectedValue={selectedValue}
              onSelect={props.onSelect}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default CalendarPart;
