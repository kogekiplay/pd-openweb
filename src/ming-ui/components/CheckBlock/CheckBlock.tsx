import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './CheckBlock.less';

export default class CheckBlock extends React.Component<any, any> {
  static override propTypes = {
    data: PropTypes.arrayOf(
      PropTypes.shape({
        text: PropTypes.string,
        value: PropTypes.number,
      }),
    ),
    value: PropTypes.number,
    onChange: PropTypes.func,
  };

  static defaultProps = {
    onChange: () => {},
  };

  override render() {
    const { data, value, onChange } = this.props;
    return (
      <div className="checkBlock">
        {data.map((item, index) => (
          <div
            key={index}
            className={cx('block', { active: item.value === value })}
            onClick={() => onChange(item.value)}
          >
            {item.text}
          </div>
        ))}
      </div>
    );
  }
}
