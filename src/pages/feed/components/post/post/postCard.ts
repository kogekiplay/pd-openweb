import React from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';

export interface PostCardState {
  leaving: boolean;
}

/**
 * 动态基础卡片样式
 */
class PostCard extends React.Component<any, PostCardState> {
  static override propTypes = {
    component: PropTypes.any,
    className: PropTypes.string,
    children: PropTypes.any,
    leavingAnimation: PropTypes.oneOfType([
      PropTypes.shape({
        css: PropTypes.string,
        timeout: PropTypes.number,
      }),
      PropTypes.bool,
    ]),
  };

  override state = { leaving: false };

  override componentDidMount() {
    this.bindComponentWillLeave();
  }

  override componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      this.bindComponentWillLeave();
    }
  }

  bindComponentWillLeave = () => {
    if (this.props.leavingAnimation) {
      const timeout = this.props.leavingAnimation.timeout;

      this.componentWillLeave = cb => {
        this.setState({ leaving: true });
        setTimeout(cb, timeout || 400);
      };

      this.leavingCss = this.props.leavingAnimation.css;
    } else {
      this.componentWillLeave = undefined;
      this.leavingCss = undefined;
    }
  };

  override render() {
    const props = _.assign({}, this.props);
    props.className = cx(
      'card postCard clearfix',
      this.props.className,
      this.state.leaving ? this.leavingCss : undefined,
    );
    const component = props.component || 'div';
    delete props.component;
    delete props.leavingAnimation;
    return React.createElement(component, props, this.props.children);
  }
}

export default PostCard;
