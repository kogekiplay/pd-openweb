import React, { Fragment } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { getPathById } from '../../util/widgets';
import BottomDragPointer from '../components/BottomDragPointer';
import DisplayItem from '../displayItem';

const DisplayTabWrap = styled.div`
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.08) 0px 4px 16px 1px;
  box-sizing: border-box;
  background: var(--color-background-primary);
  display: flex;
  flex-direction: column;
  margin-top: 12px;
`;

export default function DisplayTab(props) {
  const { tabWidgets = [], widgets = [] } = props;

  return (
    <Fragment>
      {tabWidgets.map(data => {
        const row = _.head(getPathById(widgets, data.controlId));
        return (
          // key 原先挂在里面的 DisplayItem 上 —— 它不在数组里，挂了没用；
          // 需要 key 的是 map 直接返回的 DisplayTabWrap。
          <DisplayTabWrap key={data.controlId} className="displayRow tabItemWrap">
            <DisplayItem {...props} data={data} displayItemType="tab" path={[row, 0]} />
          </DisplayTabWrap>
        );
      })}
      <BottomDragPointer displayItemType="tab" rowIndex={widgets.length} />
    </Fragment>
  );
}
