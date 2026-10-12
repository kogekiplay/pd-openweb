import { Component } from 'react';
import PropTypes from 'prop-types';
import SelectItem from './SelectItem';
import type { TimeUnit } from './types';
import { scrollTo } from './utils';

export interface PanelSelectProps {
  options: readonly string[];
  onSelect?: ((type: TimeUnit, value: number) => void) | undefined;
  type: TimeUnit;
  selectedIndex?: number | undefined;
  disabledSelect?: readonly number[] | undefined;
}
class PanelSelect extends Component<PanelSelectProps> {
  declare _select: HTMLUListElement | null | undefined;
  private cancelScroll: (() => void) | undefined;

  static override propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    onSelect: PropTypes.func,
    type: PropTypes.string,
    selectedIndex: PropTypes.number,
    disabledSelect: PropTypes.arrayOf(PropTypes.number),
  };

  override componentDidMount() {
    if (!this._select) return;
    const selectedItem = this._select.querySelector<HTMLElement>('.TimePicker-select-item.actived');

    if (selectedItem) {
      const dis = this._select.scrollTop + (selectedItem.offsetTop - this._select.scrollTop);
      this.cancelScroll = scrollTo(this._select, dis, 0);
    }
  }

  override componentWillUnmount() {
    this.cancelScroll?.();
  }

  handleClick = (value: number, offsetTop: number) => {
    if (this.props.disabledSelect?.includes(value)) return;
    this.cancelScroll?.();
    if (this._select) this.cancelScroll = scrollTo(this._select, offsetTop);
    this.props.onSelect?.(this.props.type, value);
  };

  override render() {
    const { options, selectedIndex, disabledSelect = [] } = this.props;
    return (
      <div className="TimePicker-panel-item">
        <ul
          ref={select => {
            this._select = select;
          }}
          className="TimePicker-select"
        >
          {options.map((option, index: number) => (
            <SelectItem
              key={option}
              value={index}
              active={selectedIndex === index}
              onClick={this.handleClick}
              disabled={disabledSelect.indexOf(index) !== -1}
            >
              {option}
            </SelectItem>
          ))}
          <li className="TimePicker-select-placeholder" />
        </ul>
      </div>
    );
  }
}

export default PanelSelect;
