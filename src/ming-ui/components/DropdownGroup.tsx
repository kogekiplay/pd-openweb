import { Component, isValidElement } from 'react';
import type { ReactNode } from 'react';
import PropTypes from 'prop-types';

export interface DropdownGroupProps {
  children?: ReactNode;
  className?: string | undefined;
}

class DropdownGroup extends Component<DropdownGroupProps> {
  static override propTypes = {
    children: PropTypes.any,
    className: PropTypes.string,
  };

  static defaultProps = {
    children: [],
  };

  override render() {
    const children: readonly ReactNode[] = Array.isArray(this.props.children)
      ? this.props.children
      : [this.props.children];
    return (
      <div className={`ming DropdownGroup ${this.props.className}`}>
        {children[0]}
        {children.slice(1).map(dropdown => {
          if (
            isValidElement<{ data?: unknown }>(dropdown) &&
            Array.isArray(dropdown.props.data) &&
            dropdown.props.data.length
          ) {
            return dropdown;
          }

          return null;
        })}
      </div>
    );
  }
}

export default DropdownGroup;
