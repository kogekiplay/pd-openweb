import React from 'react';
import Trigger from '@rc-component/trigger';
import styled from 'styled-components';
import { CUSTOM_ILLUSTRATION } from '../../config';

const GuildWrap = styled.div`
  width: 280px;
  background: var(--color-background-card);
  box-shadow: var(--shadow-lg);
  border-radius: 3px;
  left: 100%;
  justify-content: space-between;
  padding-top: 20px;
  box-sizing: border-box;
  overflow: hidden;
  .top {
    text-align: left;
    padding: 0 16px;
    .guildTitle {
      line-height: 14px;
    }
  }
`;

function IllustrationTrigger(props) {
  const { type, children } = props;

  return (
    <Trigger
      popup={
        <GuildWrap>
          <div className="top">
            <div className="Font14 Bold">{CUSTOM_ILLUSTRATION[type].title}</div>
            <div className="mTop8 textSecondary LineHeight20 Font13">{CUSTOM_ILLUSTRATION[type].desc}</div>
          </div>
          <div className="bottom">
            <img className="w100" src={CUSTOM_ILLUSTRATION[type].image} />
          </div>
        </GuildWrap>
      }
      // 这里【不要】加 popupMotion。rc-trigger 5 时代写的是
      // popupTransitionName="Tooltip-move-top"，但那套 CSS 类名（-enter/-leave 等）
      // 全仓从来就不存在，所以迁移前本就没有动画、纯属无效属性。
      // 迁移时照搬成 popupMotion={{ motionName: 'Tooltip-move-top' }} 会出事：
      // rc-motion 会等 animationend/transitionend 才结束离场，而没有 CSS 就永远等不到，
      // 弹层留在页面上不卸载（autoDestroy 也要等离场结束才生效）。
      // 表现：鼠标依次划过几个视图类型，右侧预览一个个堆叠、全都不消失。
      autoDestroy
      action={['hover']}
      popupAlign={{
        points: ['tl', 'tr'],
        offset: [5, 0],
        overflow: { adjustX: true, adjustY: true },
      }}
    >
      {children}
    </Trigger>
  );
}

export default IllustrationTrigger;
