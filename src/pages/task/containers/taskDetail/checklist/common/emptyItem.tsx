import React, { Component } from 'react';
// react-dnd v14 删除了 DragSource / DropTarget 装饰器且没有官方替代，
// 这里用 v16 的 hooks 重建了一份语义一致的（含 spec 第三参 component）。
// 为什么走兼容层而不是逐个改写成 hooks，见 src/components/dnd/legacyDecorators.tsx 文件头。
import { DropTarget } from 'src/components/dnd/legacyDecorators';
import PropTypes from 'prop-types';
import config from './config';

const cardTarget = {
  hover(props, monitor) {
    if (
      !monitor.isOver({
        shallow: true,
      })
    ) {
      props.checklistItemHover(props.index, props.topIndex);
    }
  },
};
let EmptyItem: any = class EmptyItem extends Component<any, any> {
  static propTypes = {
    connectDropTarget: PropTypes.func.isRequired,
    index: PropTypes.number.isRequired,
    topIndex: PropTypes.number.isRequired,
    // 上一级的index
    checklistItemHover: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
  }

  render() {
    return this.props.connectDropTarget(<div className="emptyItem" />);
  }
};
EmptyItem = DropTarget(config.CHECKLIST_ITEM, cardTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
}))(EmptyItem);
export default EmptyItem;
