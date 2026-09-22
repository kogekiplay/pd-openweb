import React from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { getOptionChipStyle } from 'src/utils/optionColor';

const Wrap = styled.span`
  padding: 5px var(--space-2);
  border-radius: 18px;
`;

export default function (props) {
  let style = {};
  const data = props.controlInfo.options.find(o => o.key === props.item) || {};

  if (_.get(props, 'controlInfo.enumDefault2') === 1) {
    // 配色交给 getOptionChipStyle（浅底 + 同色深字），见 src/utils/optionColor.ts
    style = getOptionChipStyle(data.color);
  }

  return (
    <Wrap style={style} className="Font13">
      {data.isDeleted ? _l('已删除') : data.value}
    </Wrap>
  );
}
