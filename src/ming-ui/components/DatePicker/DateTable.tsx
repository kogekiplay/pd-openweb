import React, { Component } from 'react';
import DateTBody from './DateTBody';
import DateTHead from './DateTHead';

export default class DateTable extends Component<any, any> {
  render() {
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
