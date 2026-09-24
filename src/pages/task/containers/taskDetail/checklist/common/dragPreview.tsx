import { Component } from 'react';

export default class DragPreview extends Component<any, any> {
  constructor(props) {
    super(props);
  }

  override render() {
    return (
      <div
        className="taskDetailDragPreview"
        dangerouslySetInnerHTML={{ __html: this.props.preview }}
        style={{ width: this.props.width }}
      />
    );
  }
}
