import React, { Component } from 'react';
import PropTypes from 'prop-types';

interface DialogHeaderProps {
  title?: React.ReactNode;
}

class DialogHeader extends Component<DialogHeaderProps> {
  override render() {
    if (!this.props.title) {
      return null;
    }

    return <div className="mui-dialog-default-title">{this.props.title}</div>;
  }
}

DialogHeader.propTypes = {
  title: PropTypes.node,
};

export default DialogHeader;
