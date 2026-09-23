import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './index.less';

export default class TableEmpty extends React.Component<any, any> {
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
