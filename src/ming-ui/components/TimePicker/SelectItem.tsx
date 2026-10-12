import { Component } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

interface SelectItemProps {
  value: number;
  onClick?: ((value: number, offsetTop: number) => void) | undefined;
  children?: ReactNode;
  active?: boolean | undefined;
  disabled?: boolean | undefined;
}
class SelectItem extends Component<SelectItemProps> {
  declare _selectitem: HTMLLIElement | null | undefined;

  static override propTypes = {
    onClick: PropTypes.func,
    value: PropTypes.number,
    children: PropTypes.string,
    active: PropTypes.bool,
    disabled: PropTypes.bool,
  };

  handleClick = (event: MouseEvent<HTMLLIElement>) => {
    if (!this.props.disabled) this.props.onClick?.(this.props.value, event.currentTarget.offsetTop);
  };

  override render() {
    const { disabled, active } = this.props;
    const optionEvent = {
      onClick: !disabled ? this.handleClick : undefined,
    };
    const optCls = classNames('TimePicker-select-item', {
      actived: active,
      disabled,
    });
    return (
      <li
        ref={ref => {
          this._selectitem = ref;
        }}
        className={optCls}
        {...optionEvent}
      >
        {this.props.children}
      </li>
    );
  }
}

export default SelectItem;
