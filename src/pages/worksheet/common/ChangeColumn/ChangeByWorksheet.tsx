import React, { useState } from 'react';
import Trigger from '@rc-component/trigger';
import styled from 'styled-components';
import { Button, Icon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';

const PopupCon = styled.div`
  width: 360px;
  border-radius: 2px;
  padding: 20px;
  box-shadow: var(--shadow-lg);
  background-color: var(--color-background-card);
  .title {
    font-size: 15px;
    color: var(--color-text-title);
    font-weight: 500;
  }
  .description {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.8em;
    margin: 10px 0 26px;
  }
  .buttons {
    text-align: right;
    .Button {
      margin-left: 16px;
    }
  }
`;

export default function ChangedIcon(props) {
  const { onOk = () => {}, skipConfirm = false } = props;
  // 必须给初值 false：不给的话状态类型被推成 undefined，setX(true/false) 全是 TS2345。
  // 运行时等价——每个传 popupVisible 的站点都把 onPopupVisibleChange 接回了 state
  // （否则 undefined→false 会把 Trigger 从非受控切成受控、弹层再也打不开）。
  // rc-trigger 5 给回调补上准确类型之后才暴露出来。
  const [popupVisible, setPopupVisible] = useState(false);
  return (
    <button className="iconButton textTertiary hoverColorPrimary" onClick={skipConfirm ? onOk : undefined}>
      <Trigger
        popupVisible={popupVisible}
        onPopupVisibleChange={newvisible => {
          setPopupVisible(newvisible);
        }}
        popup={
          <PopupCon>
            <div className="title">{_l('你确定重置显示列吗？')}</div>
            <div className="description">{_l('显示顺序与表单字段保持一致（显示前50个）')}</div>
            <div className="buttons">
              <Button size="mdnormal" type="ghostgray" onClick={() => setPopupVisible(false)}>
                {_l('取消')}
              </Button>
              <Button
                size="mdnormal"
                onClick={() => {
                  onOk();
                  setPopupVisible(false);
                }}
              >
                {_l('确定')}
              </Button>
            </div>
          </PopupCon>
        }
        action={skipConfirm ? [] : ['click']}
        popupAlign={{
          points: ['tl', 'bl'],
          offset: [-13, 8],
          overflow: { adjustX: true, adjustY: true },
        }}
      >
        <Tooltip title={_l('重置')} placement="bottom">
          <Icon icon="loop" className="Font20" />
        </Tooltip>
      </Trigger>
    </button>
  );
}
