import { Component } from 'react';
import PropTypes from 'prop-types';

export default function wrapDisableClick(Comp) {
  return class extends Component<any, any> {
    static override propTypes = {
      disabled: PropTypes.bool,
      onClick: PropTypes.func,
    };
    override render() {
      const { disabled, onClick } = this.props;
      return <Comp {...Object.assign({}, this.props, { onClick: disabled ? () => {} : onClick })} />;
    }
  };
}
