import { Component } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import DragMask from 'worksheet/common/DragMask';
import 'src/pages/chat/containers/ChatList/index.less';
import ChatPanel from 'src/pages/chat/containers/ChatPanel';
import SessionListDrawer from 'src/pages/chat/containers/SessionListDrawer';
import * as socket from 'src/pages/chat/utils/socketEvent';
import globalEvents from 'src/router/globalEvents';
import type { AppDispatch } from 'src/redux/types';

const Wrap = styled.div`
  .sessionListWrap {
    border-right: 1px solid var(--color-border-primary);
  }
  .ChatPanel-header .icon-maximizing_a {
    display: none;
  }
  .ChatPanel-sessionInfo {
    width: 320px;
  }
  .SessionList-item:first-child {
    margin-top: 0;
  }
  .personalStatus,
  .personalStatus .remark {
    flex: 1;
    min-width: 0;
  }
`;
const Drag = styled.div(
  ({ left }) => `
  position: absolute;
  z-index: 99;
  left: ${left}px;
  width: 2px;
  height: 100%;
  cursor: ew-resize;
  &:hover {
    border-left: 1px solid var(--color-border-primary);
  }
`,
);
// connect 包过、会收到 dispatch；socketEvent 里的函数用 .call(this) 调，要求 this.props.dispatch 存在
const WindowChat = class WindowChat extends Component<{ dispatch: AppDispatch; [key: string]: any }, any> {
  constructor(props) {
    super(props);
    this.state = {
      sessionListWidth: Number(localStorage.getItem(`windowChatSessionListWidth`)) || 280,
      dragMaskVisible: false,
    };
  }

  override componentDidMount() {
    globalEvents();
    socket.socketInitEvent.call(this);
    document.body.addEventListener('keydown', this.closeChatPanel);
  }

  override componentWillUnmount() {
    document.body.removeEventListener('keydown', this.closeChatPanel);
  }

  closeChatPanel = (e: KeyboardEvent) => {
    if ((e.key === 'Escape' || e.keyCode === 26) && _.isEmpty(window.closeFns)) {
      const closeEl = document.querySelector('.ChatPanel .icon-close');
      closeEl && closeEl.click();
    }
  };

  override render() {
    const { sessionListWidth, dragMaskVisible } = this.state;
    return (
      <Wrap className="flexRow w100 h100 overflowHidden">
        <DocumentTitle title={_l('消息')} />
        <div
          className="flexRow sessionListWrap"
          style={{
            width: sessionListWidth,
          }}
        >
          <SessionListDrawer embed={true} />
        </div>
        {dragMaskVisible && (
          <DragMask
            value={sessionListWidth}
            min={280}
            max={580}
            onChange={value => {
              localStorage.setItem(`windowChatSessionListWidth`, value);
              this.setState({
                sessionListWidth: value,
                dragMaskVisible: false,
              });
            }}
          />
        )}
        <Drag
          left={sessionListWidth}
          onMouseDown={() => {
            this.setState({
              dragMaskVisible: true,
            });
          }}
        />
        <div className="flex bgSecondary Relative">
          <ChatPanel embed={true} />
          <div className="flexRow alignItemsCenter justifyContentCenter h100">
            <Icon
              icon="chat-full"
              className="textDisabled"
              style={{
                fontSize: 100,
              }}
            />
          </div>
        </div>
      </Wrap>
    );
  }
};
/* 原先是 let WindowChat 再重新赋值成 connect()(WindowChat) 后导出：运行时导出的是 connect 过的组件，
   但 TS 按 let 的声明类型（原始类）看导出，于是认为使用方要自己传 dispatch。直接导出 connect 的结果，
   运行时导出的仍是同一个东西。 */
export default connect()(WindowChat);
