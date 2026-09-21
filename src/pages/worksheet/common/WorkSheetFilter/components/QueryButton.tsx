import React from 'react';
import cx from 'classnames';
import { noop } from 'lodash';
import styled from 'styled-components';

const Con = styled.div`
  display: flex;
  flex-direction: row;
  height: 32px;
  background: var(--color-background-primary);
  border-radius: 16px;
  color: var(--color-white);
  font-weight: bold;
  font-size: var(--font-sm);
  background: #2f88e1;
  padding: 0 var(--space-4);
  margin-left: var(--space-4);
  cursor: pointer;
  line-height: 32px;
  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export default function QueryButton(props) {
  const { num, hasQuery, onClick } = props;
  const text = hasQuery ? _l('已查询') : _l('查询(%0)', num);
  return (
    <Con className={cx({ disabled: hasQuery })} onClick={hasQuery ? noop : onClick}>
      {text}
    </Con>
  );
}
