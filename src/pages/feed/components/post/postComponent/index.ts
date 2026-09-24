import React from 'react';
import PropTypes from 'prop-types';
import getSpecificComponent from './factory';

interface PostComponentProps {
  /** 动态（接口原样值） */
  postItem?: ApiPayload;
  isReshare?: boolean;
  [key: string]: unknown;
}

class PostComponent extends React.Component<PostComponentProps> {
  static override propTypes = {
    postItem: PropTypes.object,
    isReshare: PropTypes.bool,
  };

  override render() {
    return getSpecificComponent(this.props.postItem, this.props.isReshare);
  }
}

export default PostComponent;
