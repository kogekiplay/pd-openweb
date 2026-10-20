import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import { mdNotification } from 'ming-ui/functions';
import userAJAX from 'src/api/user';
import type { AppDispatch, RootState } from 'src/redux/types';
import { setCaretPosition } from 'src/utils/common';
import CardToolbar from '../../components/CardToolbar';
import MessageSendText from '../../components/MessageSendText';
import SendToolbar from '../../components/SendToolbar';
import type { EmotionPicMessage, FileMessage } from '../../components/SendToolbar';
import Textarea from '../../components/Textarea';
import * as actions from '../../redux/actions';
import * as utils from '../../utils';
import Constant from '../../utils/constant';
import * as socket from '../../utils/socket';
import type {
  ChatAtParam,
  ChatMessage,
  ChatSendAckError,
  ChatMessagesState,
  ChatOutboundDraft,
  ChatReferMessageState,
  ChatSession,
} from '../../redux/types';
import ChatPanelHeader from '../ChatPanelHeader';
import ChatPanelSessionInfo from '../ChatPanelSessionInfo';
import MessageView from '../MessageView';
import type { MentionsInputElement } from 'src/components/MentionsInput';

const WarnBox = styled.div`
  height: 40px;
  padding: 0 var(--space-3);
  display: flex;
  align-items: center;
  font-size: var(--font-sm);
  font-weight: bold;
  color: var(--color-error);
  background: rgba(244, 67, 54, 0.1);
`;


/** 宿主 window 上本组件读写的私有字段（`Window` 带 `[key: string]: any`，点访问会触发 TS4111） */
type ChatPanelSessionWindow = Window & {
  /** 表情/光标操作维护的当前光标位置（原实现直接在 window 上读写） */
  currentCursortPosition: number;
};

/** 卡片消息（`CardToolbar.onSendCardMsg` 的 `result`，至少含 card） */
interface CardMessage {
  card: NonNullable<ChatMessage['card']>;
  [key: string]: unknown;
}

/** `connect` 注入的 props + 容器传入的 `session` */
interface ChatPanelSessionProps {
  dispatch: AppDispatch;
  session: ChatSession;
  currentSession: ChatSession;
  messages: ChatMessagesState;
  referMessage: ChatReferMessageState;
  currentSessionList: ChatSession[];
  isWindow: boolean;
  socketState: number;
}

interface ChatPanelSessionState {
  value: string;
  infoVisible: boolean;
  searchText: string;
  isOpenFile: boolean;
  /** `isContact in session ? session.isContact : true` 的结果（真实可能缺省） */
  isContact: boolean | undefined;
  isSecured: boolean;
}

interface ChatPanelWrapperProps {
  session: ChatSession;
  currentSession: ChatSession;
}

class ChatPanelSession extends Component<ChatPanelSessionProps, ChatPanelSessionState> {
  declare currentHeight: number;
  declare isFocus: boolean;

  constructor(props: ChatPanelSessionProps) {
    super(props);
    const { session } = this.props;
    const { id, isGroup } = session;
    this.currentHeight = 0;
    this.isFocus = true;
    this.state = {
      value: localStorage.getItem(`textareaValue${id}`) || '',
      infoVisible: isGroup ? !localStorage.getItem('chatInfoHidden') : false,
      searchText: '',
      isOpenFile: false,
      // 擦除式收窄：`in` 之后该属性会落到索引签名（unknown）；真实 wire 上是 boolean。
      isContact: 'isContact' in session ? (session as { isContact?: boolean }).isContact : true,
      isSecured: true,
    };
    window[`onChangeChatValue-${id}`] = this.handleChange;

    if (this.state.isContact && !isGroup && !window.platformENV.isOverseas && !window.platformENV.isLocal) {
      this.checkAccountSecured();
    }
  }
  override shouldComponentUpdate(nextProps: ChatPanelSessionProps) {
    const { session } = this.props;

    if (nextProps.currentSession.value === session.id) {
      return true;
    }

    return false;
  }
  override componentWillUnmount() {
    const { session } = this.props;
    delete window[`onChangeChatValue-${session.id}`];
  }

  /**
   * 获取是否是风险账号
   */
  /**
   * 获取是否是风险账号
   */

  override componentDidUpdate(prevProps: ChatPanelSessionProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const value = this.props.currentSession.value;
      value && this.focus(value);
    }
  }

  /**
   * 获取是否是风险账号
   */
  checkAccountSecured() {
    const { session } = this.props;

    // 排除文件传输助手
    if (session.accountId === 'file-transfer') return;

    userAJAX.checkAccountSecured({ accountId: session.accountId }).then(isSecured => {
      this.setState({ isSecured });
    });
  }

  focus(id: string) {
    if (typeof id !== 'string') return;
    $(`#ChatPanel-${id} .ChatPanel-Textarea`).find('.Textarea').focus();
  }
  jointMessageText(value: string, emotionText: string) {
    // 双击断言仅用于跨过 `Window` 索引签名的收窄（`currentCursortPosition` 由本目录代码维护）；
    // 编译后仍是 `window.currentCursortPosition`，运行期不变。
    const { currentCursortPosition } = window as unknown as ChatPanelSessionWindow;
    const start = value.slice(0, currentCursortPosition);
    const end = value.slice(currentCursortPosition, value.length);
    (window as unknown as ChatPanelSessionWindow).currentCursortPosition = currentCursortPosition + emotionText.length;
    return {
      length: start.length + emotionText.length,
      msg: `${start}${emotionText}${end}`,
    };
  }
  handleSetInfoVisible(visible: boolean) {
    const { isGroup } = this.props.session;

    if (isGroup) {
      visible ? localStorage.removeItem('chatInfoHidden') : safeLocalStorageSetItem('chatInfoHidden', String(true));
    }

    this.setState({
      infoVisible: visible,
      isOpenFile: false,
    });
  }
  handleSearchText(searchText: string) {
    const { session } = this.props;
    const { infoVisible, isOpenFile } = this.state;
    this.setState({
      searchText,
      infoVisible: searchText ? true : session.isGroup ? infoVisible : false,
      isOpenFile: searchText ? false : isOpenFile,
    });
  }
  handleOpenFile(isOpenFile: boolean) {
    const { session } = this.props;
    const { infoVisible } = this.state;
    this.setState({
      isOpenFile,
      infoVisible: isOpenFile ? true : session.isGroup ? infoVisible : false,
      searchText: '',
    });
  }
  handlePrepareUpload(temporaryMessage: FileMessage) {
    const { session, messages } = this.props;
    // 擦除标记：真实会话必有 id（容器按 session.id 渲染 `#ChatPanel-${id}`）；缺 id 时行为与基线一致。
    const currentMessages = messages[session.id as string] || [];
    const sendMsg: ChatOutboundDraft = {
      ...temporaryMessage,
      waitingid: temporaryMessage.file.id,
      isPrepare: true,
    };

    if (session.isGroup) {
      sendMsg.togroup = session.id;
    } else {
      sendMsg.touser = session.id;
    }

    this.props.dispatch(actions.addMessage(sendMsg, currentMessages[currentMessages.length - 1]));
  }
  handleSendEmotionTextMsg(emotionText: string) {
    const { value } = this.state;
    const { currentSession } = this.props;
    const { msg, length } = this.jointMessageText(value, emotionText);
    const textarea = $(`#ChatPanel-${currentSession.value}`).find('.ChatPanel-textarea textarea');
    this.setState({
      value: msg,
    });
    setCaretPosition(textarea.get(0), length);
  }
  handleBlur(value: string) {
    // 草稿
    if (document.visibilityState === 'visible') {
      const { id } = this.props.session;
      this.props.dispatch(
        actions.updateSessionList({
          id,
          sendMsg: _.trim(value) ? value : '',
        }),
      );
    }

    this.updateValue(value);
  }
  handleChange = (value: string) => {
    this.updateValue(value);
    (window as unknown as ChatPanelSessionWindow).currentCursortPosition = value.length;
  };
  updateValue(value: string) {
    const { session, isWindow } = this.props;
    const { id } = session;
    const draftValue = _.trim(value) ? value : '';

    if (document.visibilityState === 'visible') {
      if (draftValue) {
        safeLocalStorageSetItem(`textareaValue${id}`, draftValue);
      } else {
        localStorage.removeItem(`textareaValue${id}`);
        this.props.dispatch(
          actions.updateSessionList({
            id,
            sendMsg: '',
          }),
        );
      }
    }

    this.setState({
      value,
    });
    if (!value || value === '@') {
      const { currentSession } = this.props;
      const textarea = document.querySelector<MentionsInputElement>(
        `#ChatPanel-${currentSession.value} .ChatPanel-textarea textarea`,
      );
      textarea && textarea.reset && textarea.reset();
    }

    try {
      if (isWindow && window.opener && window.opener.updateChatSessionList) {
        window.opener.updateChatSessionList(id, draftValue);
      }
    } catch (error) {
      console.log(error);
    }
  }
  handleSelectedUser() {
    const { session } = this.props;
    const textarea = $(`#ChatPanel-${session.id}`).find('.ChatPanel-textarea textarea');
    // 擦除标记：`val()` 的声明返回是 string | number | string[] | undefined；原实现原样存入 state。
    const value = textarea.val() as string;
    this.setState({
      value,
    });
  }
  /**
   * 取消引用消息
   */
  handleRemoveReferMessage() {
    const { session } = this.props;
    // 擦除标记：同上，真实会话必有 id。
    this.props.dispatch(actions.removeReferMessage(session.id as string));
  }
  /**
   * 文字消息
   */
  handleSendMsg(value?: string) {
    if ((window.config.SocketPolling && !IM.socket.connected) || this.props.socketState !== 0) {
      return;
    }

    if (IM.socket.connected) {
      const sendMsg = {
        type: 1,
        msg: value || this.state.value,
      };
      this.sendMessage(sendMsg);
      this.handleRemoveReferMessage();
      this.updateValue('');
    } else {
      mdNotification.error({
        title: _l('连接失败，请重新刷新页面'),
        key: 'connectedError',
        duration: null,
        btnList: [
          {
            text: _l('刷新'),
            onClick: () => {
              location.reload();
            },
          },
        ],
      });
      alert(_l('消息无法发送，请刷新页面重新连接'), 2);
    }
  }
  /**
   * 卡片消息
   */
  handleSendCardMsg(card: CardMessage) {
    if ((window.config.SocketPolling && !IM.socket.connected) || this.props.socketState !== 0) {
      return;
    }

    const cardSender = utils.cardDisposeName(card.card);
    const value = `[${cardSender.name}] ${card.card.title}`;
    const sendMsg = {
      msg: value,
      ...card,
    };
    this.sendMessage(sendMsg);
  }
  /**
   * 表情图片消息
   */
  handleSendEmotionPicMsg(pic: EmotionPicMessage) {
    if ((window.config.SocketPolling && !IM.socket.connected) || this.props.socketState !== 0) {
      return;
    }

    const sendMsg = {
      msg: pic.file.name,
      ...pic,
    };
    this.sendMessage(sendMsg);
  }
  /**
   * 图片&附件消息
   */
  handleSendFileMsg(file: FileMessage, msg: string) {
    if ((window.config.SocketPolling && !IM.socket.connected) || this.props.socketState !== 0) {
      return;
    }

    const { session } = this.props;
    const sendMsg = {
      waitingid: utils.getUUID(),
      msg,
      ...file,
    };
    // 擦除标记：会话与上传文件在发送链路上必然有 id（原实现 direct 传 any）；缺 id 时行为与基线一致。
    this.props.dispatch(actions.removeMessage(session.id as string, file.file.id as string));
    this.sendMessage(sendMsg);
    !this.state.value && this.handleRemoveReferMessage();
  }
  /**
   * 个人发送抖动消息
   */
  handleShake() {
    if ((window.config.SocketPolling && !IM.socket.connected) || this.props.socketState !== 0) {
      return;
    }

    const { session, messages } = this.props;
    // 擦除标记：真实会话必有 id（容器按 session.id 渲染 DOM）；运行期不变。
    const currentMessages = messages[session.id as string] || [];
    socket.Message.sendShake(Constant.SESSIONTYPE_USER, {
      aid: session.id,
    }).then(() => {
      const sendMsg = {
        waitingid: utils.getUUID(),
        msg: _l('你发送了一个抖动'),
        sysType: Constant.MSGTYPE_SYSTEM_SUCCESS,
        touser: session.id,
      };
      utils.shake(session.id);
      this.props.dispatch(actions.addMessage(sendMsg, currentMessages[currentMessages.length - 1]));
    });
  }
  /**
   * 发送消息
   */
  sendMessage(param: ChatOutboundDraft) {
    const { session, messages, referMessage } = this.props;
    // 擦除标记：真实会话必有 id；索引取值运行期不变。
    const currentMessages = messages[session.id as string] || [];
    const currentReferMessage = referMessage[session.id as string];
    const messageType = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    const atParam = session.isGroup ? this.getAtParam(session.id as string) : false;
    const sendMsg: ChatOutboundDraft = {
      ...param,
      atParam,
    };
    sendMsg.waitingid = param.waitingid ? param.waitingid : utils.getUUID();
    if (session.isGroup) {
      sendMsg.togroup = session.id;
    } else {
      sendMsg.touser = session.id;
    }

    if (currentReferMessage && currentReferMessage.id) {
      sendMsg.referMessage = currentReferMessage;
      sendMsg.refer = {
        msgid: currentReferMessage.id,
      };
    }

    this.props.dispatch(actions.addMessage(sendMsg, currentMessages[currentMessages.length - 1]));
    this.props.dispatch(
      actions.updateSessionList({
        id: session.id,
        addMsg: `${_l('我')}: ${sendMsg.msg}`,
      }),
    );
    socket.Message.send(messageType, Object.assign({}, sendMsg)).then(
      result => {
        this.props.dispatch(
          actions.updateMessage({
            to: session.id as string,
            referMessage: sendMsg.referMessage,
            // 原始 ack 缺 to 时保留注入值，自有 to（含显式 undefined/getter）按原顺序覆盖。
            ...result,
          }),
        );
        // this.props.dispatch(actions.updateMessage(message));
        // 包含 at 消息
        if (atParam) {
          socket.Message.sendShake(Constant.SESSIONTYPE_GROUP, {
            ...atParam,
            messageId: result.id,
          });
        }
      },
      // 有限失败消费边界，保留同步 emit 异常与原生解构行为。
      (result: ChatSendAckError) => {
        const { error } = result;

        if (error === 'not my contract') {
          this.setState({
            isContact: false,
          });
          this.props.dispatch(
            actions.updateMessage({
              to: session.id as string,
              waitingid: sendMsg.waitingid,
              id: sendMsg.waitingid,
              isContact: false,
            }),
          );
          this.props.dispatch(
            actions.updateSessionList({
              id: session.id,
              isContact: false,
            }),
          );
        }
      },
    );
  }
  getAtParam(id: string): ChatAtParam | false {
    const textarea = $(`#ChatPanel-${id}`).find('.ChatPanel-textarea textarea');
    const textareaEl = textarea.get(0) as MentionsInputElement;
    let atList: string[] | 'all' = [];

    if (textareaEl?.getMentions) {
      textareaEl.getMentions(users => {
        for (let i = 0; i < users.length; i++) {
          if (users[i].id === 'all') {
            atList = 'all';
            break;
          }

          // 擦除标记：此处 atList 仍是数组（`'all'` 分支已 break）；原实现直接 push。
          (atList as string[]).push(users[i].id);
        }
      });
    }

    if (atList.length || (atList as string[] | 'all') === 'all') {
      return {
        gid: id,
        toUser: atList,
      };
    } else {
      return false;
    }
  }
  override render() {
    const { value, infoVisible, searchText, isOpenFile, isSecured } = this.state;
    const { session, referMessage, socketState } = this.props;
    const hideChat = md.global.SysSettings.forbidSuites.includes('6');
    const isContact = this.state.isContact && !hideChat;
    const { id, isCertificated = true } = session;

    return (
      <div>
        <ChatPanelHeader
          session={session}
          searchText={searchText}
          isOpenFile={isOpenFile}
          infoVisible={infoVisible}
          onSetInfoVisible={this.handleSetInfoVisible.bind(this)}
          onSearchText={this.handleSearchText.bind(this)}
          onOpenFile={this.handleOpenFile.bind(this)}
        />
        <div className="ChatPanel-body minHeight0">
          <div className="ChatPanel-sessionWrapper">
            {(!isSecured || !isCertificated) && (
              <WarnBox>
                <i className="Font20 icon-error1 mRight10" />
                <div className="flex">{_l('本平台仅用于企业协作，警惕交友、投资、刷单等各类诈骗！')}</div>
                <a
                  href={`https://d557778d685be9b5.share.mingdao.net/public/form/9877cd6f85d447fc9bc630129d523814?source=${session.isGroup ? _.get(session, 'groupUsers[0].accountId') : session.accountId}`}
                  target="_blank"
                  className="mLeft5"
                >
                  {_l('我要举报')}
                </a>
              </WarnBox>
            )}
            <MessageView session={session} />
            <div className="ChatPanel-textarea">
              <div className={cx('sessionTextarea', { disable: !isContact })}>
                {isContact ? null : <div className="mask"></div>}
                <CardToolbar session={session} onSendCardMsg={this.handleSendCardMsg.bind(this)} />
                <Textarea
                  disabled={!isContact}
                  value={value}
                  session={session}
                  placeholder={isContact ? _l('说点什么…') : hideChat ? _l('聊天功能已关闭') : ''}
                  referMessage={referMessage[id as string]}
                  onSendMsg={this.handleSendMsg.bind(this)}
                  onBlur={this.handleBlur.bind(this)}
                  onChange={this.handleChange.bind(this)}
                  onRemoveReferMessage={this.handleRemoveReferMessage.bind(this)}
                />
                <SendToolbar
                  socketState={socketState}
                  session={session}
                  onSendEmotionTextMsg={this.handleSendEmotionTextMsg.bind(this)}
                  onSendEmotionPicMsg={this.handleSendEmotionPicMsg.bind(this)}
                  onSendFileMsg={this.handleSendFileMsg.bind(this)}
                  onPrepareUpload={this.handlePrepareUpload.bind(this)}
                  onSelectedUser={this.handleSelectedUser.bind(this)}
                  onShake={this.handleShake.bind(this)}
                  onChangeValue={this.handleChange.bind(this)}
                />
              </div>
              <MessageSendText value={value} socketState={socketState} onSendMsg={this.handleSendMsg.bind(this)} />
            </div>
          </div>
          <ChatPanelSessionInfo
            session={session}
            searchText={searchText}
            isOpenFile={isOpenFile}
            infoVisible={infoVisible}
          />
        </div>
      </div>
    );
  }
}

const ChatPanelSessionConnect = connect((state: RootState) => {
  const { currentSession, messages, referMessage, currentSessionList, isWindow, socketState } = state.chat;

  return {
    currentSession,
    messages,
    referMessage,
    currentSessionList,
    isWindow,
    socketState,
  };
})(ErrorBoundary.wrap(ChatPanelSession));

class ChatPanelWrapper extends Component<ChatPanelWrapperProps, Record<string, never>> {
  constructor(props: ChatPanelWrapperProps) {
    super(props);
  }
  override render() {
    const { session, currentSession } = this.props;
    const { id } = session;
    return (
      <div id={`ChatPanel-${id}`} className={cx('ChatPanel', { 'ChatPanel-active': currentSession.value === id })}>
        <ChatPanelSessionConnect session={session} />
      </div>
    );
  }
}

export default connect((state: RootState) => {
  const { currentSession } = state.chat;
  return {
    currentSession,
  };
})(ChatPanelWrapper);
