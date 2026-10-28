import { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import type { RootState } from 'src/redux/types';
import * as actions from '../../redux/actions';
import * as socket from '../../utils/socketEvent';
import Apps from '../Apps';
import SessionList from '../SessionList';
import Mingo from './Mingo';
import Toolbar from './Toolbar';
import ToolbarDrawer from './Toolbar/Drawer';
import type { AppDispatch } from 'src/redux/types';
import './index.less';

/**
 * 真实注入 props：只有两个键，全部来自 canonical 来源。
 * - dispatch：connect 注入的 AppDispatch（socketEvent 的 .call(this) 也要求 this.props.dispatch 存在，
 *   SocketEventHost 就是 { props: { dispatch: AppDispatch } }）；
 * - toolbarConfig：RootState['chat']['toolbarConfig']。
 * 原来 Component<{ dispatch; [key: string]: any }, any> 的宽索引在这里被替换成有限两键，
 * 并非"参数投影后仍把类留在 any"。
 */
interface ChatProps {
  dispatch: AppDispatch;
  toolbarConfig: RootState['chat']['toolbarConfig'];
}

// connect 包过、会收到 dispatch；socketEvent 里的函数用 .call(this) 调，要求 this.props.dispatch 存在
class Chat extends Component<ChatProps> {
  constructor(props: ChatProps) {
    super(props);
  }
  override componentDidMount() {
    if (location.href.includes('chat_window')) return;

    // 注册事件
    socket.socketInitEvent.call(this);
    // 回复窗口
    // 字面量 bracket 与点访问是同一个 [[Set]]；这里只纠正 opaque index 的语法，不认证 Window 字段含义
    window['reloadChatPanel'] = _.debounce((id, isGroup) => {
      if (isGroup) {
        this.props.dispatch(actions.addGroupSession(id));
      } else {
        this.props.dispatch(actions.addUserSession(id));
      }
    });
    // 更新草稿
    window['updateChatSessionList'] = _.debounce((id, value) => {
      this.props.dispatch(
        actions.updateSessionList({
          id,
          sendMsg: value,
        }),
      );
    });
    // 获取新消息通知配置
    const { Account } = md.global;
    const settings = {
      isOpenMessageSound: Account.isOpenMessageSound,
      isOpenMessageTwinkle: Account.isOpenMessageTwinkle,
      backHomepageWay: Account.backHomepageWay || 1,
    };
    Object.assign(window, settings);
    // 获取工具栏配置
    const {
      isOpenMingoAI = true,
      isOpenMessage = true,
      isOpenSearch = true,
      isOpenFavorite = true,
      isShowToolName = false,
      isOpenMessageList = true,
      isOpenCommonApp = true,
      commonAppShowType = 2,
      commonAppOpenType = 1,
      messageListShowType = 1,
    } = Account;
    this.props.dispatch(
      actions.setToolbarConfig({
        isOpenMingoAI,
        isOpenMessage,
        isOpenSearch,
        isOpenFavorite,
        isShowToolName,
        isOpenMessageList,
        isOpenCommonApp,
        commonAppShowType,
        commonAppOpenType,
        messageListShowType,
      }),
    );
  }
  onCloseSessionList = () => {
    const { toolbarConfig } = this.props;
    const { sessionListVisible, isOpenCommonApp } = toolbarConfig;

    if (sessionListVisible && !isOpenCommonApp) {
      this.props.dispatch(
        actions.setToolbarConfig({
          sessionListVisible: false,
        }),
      );
    }
  };
  override render() {
    const { toolbarConfig } = this.props;
    const { isOpenMessageList, isOpenCommonApp, sessionListVisible, hideOpenCommonApp } = toolbarConfig;
    const showMingo = !md.global.SysSettings.hideAIBasicFun;

    return (
      <Fragment>
        <ToolbarDrawer />
        <div className="ChatList-wrapper">
          <Toolbar />
          <div className="divider" />
          <div className="flexColumn flex minHeight0" onClick={this.onCloseSessionList}>
            {isOpenMessageList && (
              <div className={cx('flexColumn flex minHeight0 mTop12 mBottom14', { hide: sessionListVisible })}>
                <SessionList visible={false} />
              </div>
            )}
            {isOpenMessageList && isOpenCommonApp && !sessionListVisible && (
              <div className={cx('divider', { hide: hideOpenCommonApp })} />
            )}
            {isOpenCommonApp && (
              <div
                className={cx('flexColumn alignItemsCenter mTop14 mBottom8', { hide: hideOpenCommonApp })}
                style={{ height: isOpenMessageList && !sessionListVisible ? '30%' : '100%' }}
              >
                <Apps />
              </div>
            )}
          </div>
          <div className={cx({ Hidden: !showMingo })}>
            <div className="divider" />
            <Mingo />
          </div>
        </div>
      </Fragment>
    );
  }
}

/**
 * 仅类型导出：把真实 **class 构造器** 的 typeof 暴露给类型层探针，
 * 以便从 ConstructorParameters<ChatListConstructor>[0] 验证实例 props（不导出运行期值）。
 */
export type ChatListConstructor = typeof Chat;

export default connect((state: RootState) => {
  const { toolbarConfig } = state.chat;
  return {
    toolbarConfig,
  };
})(Chat);
