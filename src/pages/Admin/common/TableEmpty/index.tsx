import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './index.less';

interface TableEmptyProps {
  detail: {
    /** 图标类名，如 icon-aggregate_table */
    icon?: string | undefined;
    desc?: React.ReactNode;
    /** 给了就不画默认图标 */
    customIcon?: React.ReactNode;
    descClassName?: string | undefined;
  };
  className?: string | undefined;
}

export default class TableEmpty extends React.Component<TableEmptyProps> {
  static override propTypes = {
    detail: PropTypes.object,
  };

  override render() {
    const { icon, desc, customIcon, descClassName } = this.props.detail;
    const { className } = this.props;

    return (
      <div className={`tableEmptyBox ${className}`}>
        {customIcon ? (
          customIcon
        ) : (
          <div className="emptyIcon">
            <span className={cx('Font40', icon)} />
          </div>
        )}
        <span className={`Bold Font15 mTop20 desc ${descClassName}`}>{desc}</span>
      </div>
    );
  }
}
