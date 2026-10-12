import { Component } from 'react';
import DateTBody from './DateTBody';
import DateTHead from './DateTHead';
import type { DateTableProps } from './types';

export default class DateTable extends Component<DateTableProps> {
  override render() {
    const props = this.props;
    const prefixCls = props.prefixCls;
    return (
      <div className={`${prefixCls}-table`}>
        <DateTHead {...props} />
        <DateTBody {...props} />
      </div>
    );
  }
}
