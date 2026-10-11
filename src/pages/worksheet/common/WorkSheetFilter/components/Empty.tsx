import styled from 'src/utils/typedStyled';
import type { EmptyProps } from './detailTypes';
import emptyPng from './empty.png';
import SelectControls from './SelectControls';

const Con = styled.div`
  text-align: center;
  padding: 10px 0 var(--space-2);
  img {
    height: 160px;
  }
  .tip {
    color: var(--color-text-tertiary);
    margin-top: -2px;
  }
  .addFilter {
    border-radius: 36px !important;
    padding: 0 var(--space-4) !important;
    background-color: var(--color-primary);
    &:hover {
      background-color: var(--color-primary-dark);
    }
  }
`;

export default function Empty(props: EmptyProps) {
  const { isNew, maxHeight, controls, onAdd = () => {} } = props;
  if (isNew && !controls) throw new TypeError('Missing new-filter field choices');
  return isNew ? (
    <SelectControls
      maxHeight={maxHeight}
      style={{
        boxShadow: 'none',
      }}
      className="inEmpty"
      controls={controls || []}
      onAdd={onAdd}
    />
  ) : (
    <Con>
      <img src={emptyPng} />
      <div className="tip">{_l('没有保存的筛选器')}</div>
    </Con>
  );
}
