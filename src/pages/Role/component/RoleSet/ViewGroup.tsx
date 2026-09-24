import { PureComponent } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';

export interface ViewGroupProps {
  hasViews: boolean;
  className: string;
  children: React.ReactNode;
}

export default class ViewGroup extends PureComponent<ViewGroupProps, any> {
  declare list: HTMLDivElement | null | undefined;

  static override propTypes = {
    hasViews: PropTypes.bool,
    className: PropTypes.string,
    children: PropTypes.any,
  };

  componentWillEnter(callback) {
    const { hasViews } = this.props;

    if (this.list && hasViews) {
      $(this.list).stop().slideDown(300, callback);
    }
  }

  componentWillLeave(callback) {
    const { hasViews } = this.props;

    if (this.list && hasViews) {
      $(this.list).stop().slideUp(300, callback);
    }
  }

  override render() {
    const { className } = this.props;
    return (
      <div
        ref={el => {
          this.list = el;
        }}
        className={cx(className)}
      >
        {this.props.children}
      </div>
    );
  }
}
