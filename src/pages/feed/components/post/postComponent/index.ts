import React from 'react';
import PropTypes from 'prop-types';
import getSpecificComponent from './factory';

class PostComponent extends React.Component<any, any> {
  static override propTypes = {
    postItem: PropTypes.object,
    isReshare: PropTypes.bool,
  };

  override render() {
    return getSpecificComponent(this.props.postItem, this.props.isReshare);
  }
}

export default PostComponent;
