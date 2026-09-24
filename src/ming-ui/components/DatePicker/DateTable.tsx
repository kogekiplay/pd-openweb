import { Component } from 'react';
import DateTBody from './DateTBody';
import DateTHead from './DateTHead';

interface DateTableProps {
  prefixCls?: string | undefined;
  // 其余属性原样透传给 DateTHead / DateTBody
  [key: string]: unknown;
}

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
