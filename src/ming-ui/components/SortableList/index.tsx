import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { getEmptyImage, HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import _ from 'lodash';
import { array, bool, func, string } from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import ListItemLayer from './ItemLayer';

/** 拖拽手柄：包住的那部分才能拖（useDragHandle 时） */
export type SortableDragHandle = (props: { children?: ReactNode; className?: string | undefined }) => ReactElement;

/** renderItem 收到的参数 */
export interface SortableRenderItemOptions<T> {
  item: T;
  index: number;
  /** 列表里：useDragHandle 时是手柄组件，否则 null；拖动中的浮层里：总是一个只改光标的 span */
  DragHandle: SortableDragHandle | null;
  /** 以下两项只有列表里的渲染才有 */
  items?: T[] | undefined;
  dragging?: boolean | undefined;
  /** 拖动中跟着鼠标走的那一份（ListItemLayer 渲染）才有，为 true */
  isLayer?: boolean | undefined;
}

export interface SortableListProps<T> {
  /** 列表数据 */
  items: T[];
  renderItem: (options: SortableRenderItemOptions<T>) => ReactNode;
  /** 每项唯一标识的取值路径（lodash get）；items 是字符串时不用给 */
  itemKey?: string | undefined;
  /** 拖完且顺序有变化时：排好序的整个列表、放下的位置、拖起的位置 */
  onSortEnd?: ((items: T[], newIndex: number, oldIndex: number | undefined) => void) | undefined;
  /** 只有拖拽手柄能拖（renderItem 里把手柄渲染出来） */
  useDragHandle?: boolean | undefined;
  /** 整体开关；单项可以用项上的 canDrag 覆盖 */
  canDrag?: boolean | undefined;
  itemClassName?: string | undefined;
  /** 拖动中浮层的类名 */
  helperClass?: string | undefined;
  /** 用浏览器原生的拖拽预览图，不画跟随浮层 */
  dragPreviewImage?: boolean | undefined;
  /** 浮层渲染到 body 上（在弹窗、抽屉里用） */
  renderBody?: boolean | undefined;
  /** vertical：鼠标越过目标项一半才交换位置，避免上下来回闪 */
  direction?: 'vertical' | 'horizontal' | undefined;
  /** 变化时按 items 重新同步列表 */
  flag?: unknown;
  /** 拖动中每次交换位置时调用 */
  moveItem?: (() => void) | undefined;
}

/** 拖动中 react-dnd 里的那份数据 */
interface DragObject<T> {
  type: string;
  index: number;
  item: T;
}

interface DragItemProps<T> extends Omit<SortableListProps<T>, 'moveItem'> {
  item: T;
  index: number;
  dragType: string;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  onDragEnd: (newIndex: number, oldIndex: number | undefined) => void;
  setDragging: (dragging: boolean) => void;
}

let dragging = false;
let oldIndex: number | undefined = undefined;

function DragItem<T>(props: DragItemProps<T>) {
  const {
    items,
    useDragHandle,
    canDrag = true,
    itemClassName = '',
    item,
    dragType,
    index,
    dragPreviewImage,
    direction,
    moveItem,
    onDragEnd,
    setDragging,
    renderItem,
  } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.ondrop = function (event) {
      event.preventDefault();
      event.stopPropagation();
    };
  }, []);

  useEffect(() => {
    setDragging(dragging);
  }, [dragging]);

  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute('draggable', canDrag.toString());
    }
  }, [canDrag]);

  const [, drop] = useDrop<DragObject<T>>({
    accept: dragType,
    hover: (draggedItem, monitor) => {
      if (draggedItem.index === index || !ref.current) {
        return;
      }

      if (direction) {
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();

        // hover 期间一定有鼠标位置，这里只是让类型知道它不是 null
        if (!clientOffset) return;

        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        if (
          direction === 'vertical' &&
          ((draggedItem.index < index && hoverClientY < hoverMiddleY) ||
            (draggedItem.index > index && hoverClientY > hoverMiddleY))
        ) {
          return;
        }
      }

      moveItem(draggedItem.index, index);
      draggedItem.index = index;
    },
  });

  const [{ isDragging }, drag, dragPreview] = useDrag<DragObject<T>, unknown, { isDragging: boolean }>({
    type: dragType,
    // v11 的 begin 只有副作用、不返回值，v16 里等价物是函数形式的 item：
    // 同样在拖拽开始时调用，返回值即拖拽 item，所以把原来的对象原样 return 回去。
    item: () => {
      dragging = true;
      oldIndex = index;
      // 能拖起来说明已经挂上了 DOM（ref 在 drag(drop(ref)) 里连着），?. 只是给类型看的
      window.MD_DRAG_ITEM = {
        width: ref.current?.offsetWidth ?? 0,
        height: ref.current?.offsetHeight ?? 0,
      };

      return { type: dragType, index, item: item };
    },
    // 项上写了 canDrag 就以项为准
    canDrag: _.has(item, 'canDrag') ? (item as { canDrag?: boolean | undefined }).canDrag : canDrag,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      window.MD_DRAG_ITEM = undefined;
      dragging = false;
      onDragEnd(index, oldIndex);
      oldIndex = undefined;
    },
  });

  // 使用拖拽手柄
  const DragHandle: SortableDragHandle | null = useDragHandle
    ? ({ children, className = '' }) => (
        <span className={className} ref={el => { drag(el); }} style={{ cursor: 'move' }}>
          {children}
        </span>
      )
    : null;

  if (dragPreviewImage) {
    dragPreview(useDragHandle ? drop(ref) : drag(drop(ref)));
  } else {
    useDragHandle ? drop(ref) : drag(drop(ref));
    dragPreview(getEmptyImage());
  }

  return (
    <div ref={ref} className={itemClassName} style={{ opacity: isDragging ? 0 : 1 }}>
      {renderItem({ item, index, DragHandle, items, dragging })}
    </div>
  );
};

function SortableComponent<T = any>(props: SortableListProps<T> & { setDragging: (dragging: boolean) => void }) {
  const { items, flag, onSortEnd = () => {}, itemKey, setDragging } = props;
  const [listItems, setListItems] = useState<T[]>([]);
  const dragType = useMemo(() => `dragType_${uuidv4()}`, []);

  useEffect(() => {
    if (!_.isEqual(items, listItems)) {
      setListItems(items);
    }
  }, [flag, items]);

  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    if (props.moveItem && _.isFunction(props.moveItem)) {
      props.moveItem();
    }

    setListItems(listItems => {
      const newItems = [...listItems];
      //需要移动的元素
      const [dragItem] = newItems.splice(dragIndex, 1);

      // dragIndex 来自列表本身，一定取得到；原来越界时会插进一个 undefined
      if (dragItem !== undefined) newItems.splice(hoverIndex, 0, dragItem);

      return newItems;
    });
  }, []);

  const renderDraggableItem = ({ item, index }: { item: T; index: number }) => {
    return (
      <DragItem
        {...props}
        key={typeof item === 'string' ? item : itemKey ? _.get(item, itemKey) : undefined}
        index={index}
        item={item}
        dragType={dragType}
        moveItem={moveItem}
        onDragEnd={(newIndex, oldIndex) => {
          if (!_.isEqual(items, listItems)) {
            onSortEnd(listItems, newIndex, oldIndex);
          }

          dragging = false;
          setDragging(false);
        }}
      />
    );
  };

  return listItems.map((item, index) => renderDraggableItem({ item, index }));
}

// T 推不出来（items 是 any）时退回 any 而不是 unknown，免得 renderItem 里的 item 全变成 unknown
export default function SortableList<T = any>(props: SortableListProps<T>) {
  const { helperClass, itemClassName, useDragHandle, dragPreviewImage = false, renderBody = false, renderItem } = props;
  const [dragging, setDragging] = useState(false);

  return (
    <DndProvider backend={HTML5Backend} context={window}>
      {!dragPreviewImage && (
        <ListItemLayer
          renderBody={renderBody}
          dragging={dragging}
          itemClassName={itemClassName}
          helperClass={helperClass}
          useDragHandle={useDragHandle}
          renderItem={renderItem}
        />
      )}
      <SortableComponent {...props} setDragging={setDragging} />
    </DndProvider>
  );
}

SortableList.prototypes = {
  items: array, // 列表数据
  renderItem: func, // 列表item渲染
  itemKey: string, // item的唯一标识key, 必传 特殊：items里面是字符串可不传
  itemClassName: string, // item元素类名
  onSortEnd: func, // 拖拽完成回调
  useDragHandle: bool, // 是否使用拖拽手柄拖拽
  canDrag: bool, // 是否允许拖拽
  flag: string, // 强制刷新
  vertical: string, // 方向 vertical 垂直 处理闪烁问题 horizontal
  helperClass: string, // 拖动时样式
  dragPreviewImage: bool, // 拖图片
  renderBody: bool, //是否render到body上 在dialog、drawer等里面渲染需要用
};
