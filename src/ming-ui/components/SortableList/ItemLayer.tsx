import { useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDragLayer } from 'react-dnd';
import type { DragLayerMonitor } from 'react-dnd';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import type { SortableListProps } from './index';

const ItemLayer = styled.div`
  position: fixed;
  pointer-events: none;
  z-index: 99999;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  .itemLayer {
    cursor: grabbing;
    opacity: 1;
    z-index: 999;
    position: relative;
    > * {
      background: var(--color-background-card);
    }
  }
`;

type ListItemLayerProps<T> = Pick<
  SortableListProps<T>,
  'helperClass' | 'itemClassName' | 'useDragHandle' | 'renderBody' | 'renderItem'
> & { dragging: boolean };

/** 拖动中 react-dnd 里的那份数据（见 index.tsx 的 DragObject） */
interface LayerDragObject<T> {
  type: string;
  index: number;
  item: T;
}

function ListItemLayer<T>(props: ListItemLayerProps<T>) {
  const { dragging, helperClass, itemClassName, useDragHandle = false, renderBody, renderItem } = props;
  // 最近一次拖起时的数据：松手后 item 变成 null，浮层还要靠它渲染完最后一帧
  const $init = useRef<{ initialClientOffset: unknown; item: LayerDragObject<T> } | null>(null);

  const { isDragging, item, itemType, initialClientOffset, currentOffset, initialSourceClientOffset } = useDragLayer(
    (monitor: DragLayerMonitor<LayerDragObject<T> | null>) => {
      const data = {
        isDragging: monitor.isDragging(),
        // 拖动开始时鼠标位置
        initialClientOffset: monitor.getInitialClientOffset(),
        // 拖动进行时鼠标位置
        currentOffset: monitor.getClientOffset(),
        itemType: monitor.getItemType(),
        item: monitor.getItem(),
        // 拖到开始时组件位置
        initialSourceClientOffset: monitor.getInitialSourceClientOffset(),
      };

      return data;
    },
  );

  if (item) {
    $init.current = { initialClientOffset, item };
  }

  const DragHandle = ({ children }: { children?: ReactNode }) => <span style={{ cursor: 'move' }}>{children}</span>;

  const renderContent = () => {
    // 有 item 时上面已经写进 $init，所以只看 $init
    if (!$init.current) return null;

    return renderItem({ ...$init.current.item, DragHandle, isLayer: true });
  };

  const getItemStyle = () => {
    if (!initialClientOffset || !currentOffset || !initialSourceClientOffset || !item) {
      return {
        display: 'none !important',
      };
    }

    const { x, y } = currentOffset;
    const offsetX = initialClientOffset.x - initialSourceClientOffset.x;
    const offsetY = useDragHandle
      ? (_.get(window.MD_DRAG_ITEM, 'height') || 0) / 2
      : initialClientOffset.y - initialSourceClientOffset.y;

    const transform = `translate(${x - offsetX}px, ${y - offsetY}px) `;

    return {
      transform: transform,
      WebkitTransform: transform,
      width: _.get(window.MD_DRAG_ITEM, 'width') || '100%',
    };
  };

  if (!itemType || !isDragging || !dragging) return null;

  const content = (
    <ItemLayer key={`item-layer-${item ? item.type : null}`}>
      <div className={cx('itemLayer', itemClassName, helperClass)} style={getItemStyle()}>
        {renderContent()}
      </div>
    </ItemLayer>
  );

  return renderBody ? createPortal(content, document.body) : content;
}

export default ListItemLayer;
