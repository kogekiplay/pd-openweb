import React, { useState } from 'react';
import Trigger from '@rc-component/trigger';
import styled from 'styled-components';
import { Menu, MenuItem, VCenterIconText } from 'ming-ui';
import IconText from 'worksheet/components/IconText';

const Con = styled.div`
  display: inline-block;
  .dropIcon {
  }
`;

export default function SubButton(props) {
  const { text, icon, children, popupAlign, list = [], ...rest } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  return (
    <Con {...rest}>
      <Trigger
        popupVisible={popupVisible}
        action={['click']}
        popupAlign={
          popupAlign || {
            points: ['tl', 'bl'],
            overflow: { adjustX: true, adjustY: true },
          }
        }
        popup={
          <Menu className="Relative" style={{ width: 140 }} onClickAway={() => setPopupVisible(false)}>
            {list.map((item, key) => (
              <MenuItem
                key={key}
                onClick={() => {
                  item.onClick();
                  setPopupVisible(false);
                }}
              >
                <VCenterIconText icon={item.icon} iconSize={18} text={item.text} textSize={13} />
              </MenuItem>
            ))}
          </Menu>
        }
        // 原来这里写的是 onPopupVisible={setPopupVisible}（正确名是 onPopupVisibleChange），
        // rc-trigger 从来不认，一直是死的。删掉而不改名：关闭本来就由上面 Menu 的
        // onClickAway 和各 MenuItem 负责，改名会多一条回调路径，属于行为变更。
      >
        <div
          onClick={() => {
            setPopupVisible(true);
          }}
        >
          {children || (
            <IconText
              icon={icon}
              text={
                <span>
                  {text} <i className="dropIcon icon-arrow-down-border" />
                </span>
              }
            />
          )}
        </div>
      </Trigger>
    </Con>
  );
}
