import React from 'react';
import { useDrop } from 'react-dnd';
import cx from 'classnames';
import { get } from 'lodash';
import { ITEM_TYPE } from '../config';
import { AddRecord } from '../styled';

export default function LeftBoundary(props) {
  const { becomeTopLevelRecord, showAdd, onClick } = props;

  const [{ isOver, canDrop }, drop] = useDrop<any, any, any>({
    accept: ITEM_TYPE.ITEM,
    canDrop(_, monitor) {
      const data = monitor.getItem();
      const $wrap = document.querySelector('.hierarchyViewWrap');
      return (get(data, 'path') || []).length > 1 && $wrap.scrollLeft === 0;
    },
    drop(item, monitor) {
      const data = monitor.getItem();
      if (!data) return;
      if (data.path.length > 1) {
        becomeTopLevelRecord(data);
      }
    },
    collect(monitor) {
      return { isOver: monitor.isOver(), canDrop: monitor.canDrop() };
    },
  });

  return (
    <div ref={el => { drop(el); }} className={cx('hierarchyViewLeftBoundary pointer', { isOver: isOver && canDrop })}>
      {showAdd && (
        <AddRecord size={30} onClick={onClick}>
          <i className="icon icon-add" />
        </AddRecord>
      )}
    </div>
  );
}
