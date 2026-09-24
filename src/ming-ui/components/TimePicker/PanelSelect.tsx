import { Component } from 'react';
import PropTypes from 'prop-types';
import SelectItem from './SelectItem';
import { scrollTo } from './utils';

class PanelSelect extends Component<any, any> {
  declare _select: HTMLUListElement | null | undefined;

  static override propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    onSelect: PropTypes.func,
    type: PropTypes.string,
    selectedIndex: PropTypes.number,
    disabledSelect: PropTypes.arrayOf(PropTypes.number),
  };

  override componentDidMount() {
    const selectedItem = this._select.querySelector<HTMLElement>('.TimePicker-select-item.actived');

    if (selectedItem) {
      const dis = this._select.scrollTop + (selectedItem.offsetTop - this._select.scrollTop);
      scrollTo(this._select, dis, 0);
    }
  }

  handleClick = (value, offsetTop) => {
    const dis = this._select.scrollTop + (offsetTop - this._select.scrollTop);
    scrollTo(this._select, dis);
    this.props.onSelect(this.props.type, value);
  };

  override render() {
    const { options, selectedIndex, disabledSelect } = this.props;
    return (
      <div className="TimePicker-panel-item">
        <ul ref={select => { this._select = select; }} className="TimePicker-select">
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
