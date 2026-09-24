import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';

export interface FilterNavState {
  currentIndex: number;
}

export default class FilterNav extends Component<any, FilterNavState> {
  constructor(props) {
    super(props);
    let currentIndex = 0;

    props.data.forEach((item, index: number) => {
      if (item.value.type === (props.checked || {}).type) {
        currentIndex = index;
      }
    });

    this.state = {
      currentIndex,
    };
  }

  override componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(this.props.data, prevProps.data)) {
        this.state = {
          currentIndex: 0,
        };
      }
    }
  }
  override render() {
    const { data } = this.props;
    const { currentIndex } = this.state;
    return (
      <div className="filterNav flexRow valignWrapper">
        {data.map((item, index: number) => (
          <div
            key={index}
            className={cx('item', { active: currentIndex === index })}
            onClick={() => {
              this.setState({ currentIndex: index });
              this.props.onChange(item.value);
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  }
}
