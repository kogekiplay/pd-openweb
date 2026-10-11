import { Component } from 'react';
import type { ComponentType, MouseEventHandler } from 'react';
import PropTypes from 'prop-types';

export default function wrapDisableClick<
  P extends { disabled?: boolean | undefined; onClick?: MouseEventHandler<HTMLElement> | undefined },
>(Comp: ComponentType<P>) {
  return class extends Component<P> {
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
