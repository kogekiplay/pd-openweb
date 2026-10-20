import type {
  ChatBottomUnreadMessageState,
  ChatGotoMessageState,
  ChatMessage,
  ChatMessagesState,
  ChatSession,
} from '../../redux/types';
import { Component } from 'react';
import type { MouseEvent } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { ScrollView } from 'ming-ui';
import type { AppDispatch, RootState } from 'src/redux/types';
import type { ScrollViewHandle } from 'ming-ui/components/ScrollView';
import type { ScrollInfo } from 'ming-ui/components/ScrollView/types';
import * as actions from '../../redux/actions';
import * as utils from '../../utils';
import * as ajax from '../../utils/ajax';
import config from '../../utils/config';
import Constant from '../../utils/constant';
import { addGroupMembers } from '../../utils/group';
import Message from '../Message';
import './index.less';


/**
 * `ajax.getMessage` 的三种真实入参：首屏（`type/id/num`）、向上翻页（`sincetime/type/id`）、
 * 向下翻页（再多一个 `direction: 1`）。它同时被记入 state 的 `errorParam` 供重试。
 */
interface GetMessageParam {
  type: number;
  id?: string | undefined;
  num?: number | undefined;
  sincetime?: number | string | undefined;
  direction?: number | undefined;
}

type LoadDirection = 'up' | 'down';

/** `connect` 注入的 props + 容器传入的 `session` */
interface MessageViewProps {
  dispatch: AppDispatch;
  session: ChatSession;
  currentSession: ChatSession;
  messages: ChatMessagesState;
  sessionList: ChatSession[];
  gotoMessage: ChatGotoMessageState;
  bottomUnreadMessage: ChatBottomUnreadMessageState;
}

interface MessageViewState {
  isMore: boolean;
  loading: boolean;
  isBottom: boolean;
  topUnread: number;
  /** 待定位的消息 id（`componentDidUpdate` 里读、`handleGotoMessage` 写） */
  gotoMessageId: string | number;
  isDownLoadingMessage: boolean;
  direction: LoadDirection;
  /** 上一次失败的加载参数；false 表示没有错误 */
  errorParam: GetMessageParam | false;
}

class MessageView extends Component<MessageViewProps, MessageViewState> {
  declare lastScrollHeight: number;
  /** ScrollView 实例（ref 注入；首屏渲染前为 undefined） */
  declare scrollView: ScrollViewHandle | null | undefined;

  constructor(props: MessageViewProps) {
    super(props);
    this.lastScrollHeight = 0;
    this.state = {
      isMore: true,
      loading: true,
      isBottom: true,
      topUnread: 0,
      gotoMessageId: '',
      isDownLoadingMessage: false,
      direction: 'up',
      errorParam: false,
    };
  }
  override shouldComponentUpdate(nextProps: MessageViewProps) {
    const { session } = this.props;

    if (session.id === nextProps.currentSession.value) {
      return true;
    }

    return false;
  }
  override componentDidMount() {
    const { session, sessionList } = this.props;
    const topUnread = sessionList.filter((item: ChatSession) => item.value == session.id)[0];
    const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    window[`scrollView-${session.id}`] = this.scrollView;
    if (!topUnread) return;
    const unreadCount = topUnread.messageCount || topUnread.count;
    this.getMessage(
      {
        type,
        id: session.id,
        // 擦除标记：`||` 兜底在缺值时给 undefined，原比较 `undefined > n` 为 false（不改变分支）。
        num: topUnread ? ((unreadCount as number) > config.MSG_LENGTH_MORE ? (unreadCount as number) : 0) : 0,
      },
      'up',
    ).then(res => {
      res = _.isArray(res) ? res.reverse() : [];
      const isAddUnreadLine = topUnread && unreadCount;

      if (isAddUnreadLine && res[res.length - unreadCount]) {
        // 擦除标记（零运行时）：同一索引表达式在上面的 if 里已判真；此处保留基线的
        // 原生行为（若真的越界为 undefined，属性写入仍抛 TypeError），不改成守卫/默认值。
        res[res.length - (unreadCount as number)]!.unreadLine = true;
      }

      if (session.accountId && !session.isContact) {
        const remind: ChatMessage = Object.assign({}, res[res.length - 1]);
        remind.id = Date.now();
        remind.isContact = false;
        remind.sysType = Constant.MSGTYPE_SYSTEM_ERROR;
        res.push(remind);
      }

      this.props.dispatch(actions.setMessage(session.id as string, utils.formatMessages(res)));
    });
  }
  override componentWillUnmount() {
    const { session } = this.props;
    delete window[`scrollView-${session.id}`];
  }

  override componentDidUpdate(prevProps: MessageViewProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { session, sessionList, currentSession, gotoMessage } = this.props;
      // 擦除标记：真实会话必有 id（容器按 session.id 渲染）；缺 id 时行为与基线一致。
    const gotoMessageId = gotoMessage[session.id as string]; // 右侧点击了搜索消息

      // 右侧点击了搜索消息
      if (gotoMessageId) {
        this.handleGotoMessage(gotoMessageId);
        prevProps.dispatch(actions.removeGotoMessage(session.id as string));
      } // 打开聊天框时，有10条以上的未读消息

      // 打开聊天框时，有10条以上的未读消息
      if (currentSession && currentSession.value) {
        const topUnread = sessionList.filter((item: ChatSession) => item.value == session.id)[0] || {};

        if (topUnread.messageCount) {
          this.setState({
            topUnread: topUnread.messageCount > config.MSG_LENGTH_MORE ? topUnread.messageCount : 0,
          });
        }
      }
    }

    const { session, messages, sessionList } = prevProps;
    const { id } = session;
    const prevMessage = messages[id as string];
    // 擦除标记：同一会话的消息切片由同一 reducer 维护；`prevMessage` 已是数组说明消息已加载，
    // 此处若真为 undefined，`.length` 仍抛原生 TypeError（与基线 any 行为一致）。
    const newMessages = this.props.messages[id as string]!;
    const topUnread = sessionList.filter((item: ChatSession) => item.value == id)[0] || {};
    const { direction, isDownLoadingMessage } = this.state; // 加载完新消息，存在需要查询的消息

    if (this.state.gotoMessageId) {
      this.handleGotoMessage(this.state.gotoMessageId);
      return;
    }

    // 刚加载完第一页的数据
    if (!_.isArray(prevMessage)) {
      this.handleScrollEnd();
      return;
    } // 加载一页

    if (newMessages.length - prevMessage.length >= config.MSG_LENGTH_MORE && direction == 'up') {
      setTimeout(() => {
        if (!this.scrollView) return;
        const { scrollTo, getScrollInfo } = this.scrollView;
        const { scrollHeight } = getScrollInfo()! as ScrollInfo;
        scrollTo({
          top: scrollHeight - this.lastScrollHeight,
        });
      }, 0);
      return;
    } // 刚发送的消息 & 收到新消息

    if (newMessages.length - prevMessage.length === 1) {
      // 擦除标记：本分支只在消息数 +1 时进入，末元素必存在；缺元素时原实现直接抛 TypeError。
      const message = newMessages[newMessages.length - 1]!;

      if (message.isMine) {
        isDownLoadingMessage ? this.handleBottomEnd() : this.handleScrollEnd();
      }
    } // 已经打开的窗口，有新消息

    if (newMessages.length === prevMessage.length) {
      if (topUnread.count) {
        this.handleScrollEnd();
      } else {
        const endMessage = newMessages[newMessages.length - 1] || {};
        const { type, card, isMine, id } = endMessage;

        if (isMine && type === Constant.MSGTYPE_FILE && typeof id === 'number') {
          this.handleScrollEnd();
        }

        if (
          isMine &&
          type === Constant.MSGTYPE_CARD &&
          // 擦除标记：`type === MSGTYPE_CARD` 时 card 必存在（基线 any；缺 card 仍抛原生 TypeError）。
          ((card as NonNullable<ChatMessage['card']>).md === 'worksheet' || (card as NonNullable<ChatMessage['card']>).md === 'kcfile') &&
          typeof id === 'number'
        ) {
          this.handleScrollEnd();
        }
      }
    }

    if (newMessages.length - prevMessage.length >= 1 && direction == 'up') {
      this.handleScrollEnd();
    }
  }
  handleScrollEnd() {
    const { session } = this.props;
    utils.scrollEnd(session.id, true);
  }
  /**
   * 拉取一页消息。
   * 【为什么在这里补类型】本方法体是 `new Promise(resolve => { ajax.getMessage(param).then(...) })`，
   * 未给 `Promise` 类型参数时推出 `Promise<unknown>`，于是调用处 `.then(res => ...)` 的
   * `res` 是 `unknown`，再交给 `utils.formatMessages(res)` 就会报 TS2345（71/261/340）。
   * 按 lead 授权，仅补**该同函数**的有限消息类型，不改组件其他部分。
   * `ajax.getMessage` 会落空返回 undefined，故这里对空值做与原先一致的容忍（resolve 空数组）。
   */
  getMessage(param: GetMessageParam, direction: LoadDirection): Promise<ChatMessage[]> {
    this.setState({
      loading: true,
      errorParam: false,
      direction,
    });
    return new Promise<ChatMessage[]>(resolve => {
      ajax
        .getMessage(param)!
        // 非空断言： 在未匹配 type 时返回 undefined，
        // 原实现在该情形下  会抛 TypeError；用非空断言**零运行时**地保持原失败路径，
        // 不用  把抛错改成静默跳过。
        .then(res => {
          this.setState({
            loading: false,
            isMore: !(res.length < config.MSG_LENGTH_MORE),
          });
          resolve(res);
        })
        .catch(() => {
          this.setState({
            errorParam: param,
          });
        });
    });
  }
  handleGotoMessage(id: string | number) {
    const { session, messages } = this.props;
    const currentMessage = messages[session.id as string] || [];
    const message = _.find(currentMessage, { id });

    if (message && message.id) {
      const { gotoMessageId } = this.state;
      const messageEl = $(`#Message-${message.id}`);
      // 擦除标记：调用链只在消息列表已渲染（ScrollView ref 已注入）后进入；
      // 若真为 undefined，解构仍抛原生 TypeError（与基线 any 一致）。
      const { scrollTo, getScrollInfo } = this.scrollView!;
      const { clientHeight, scrollTop } = getScrollInfo()! as ScrollInfo;

      if (gotoMessageId) {
        this.setState({ gotoMessageId: '', isDownLoadingMessage: true });
      }

      // 指定的消息在不在可视区
      scrollTo({
        // 擦除标记：Selector 命中的消息节点必有布局盒（jQuery v4 类型把 position()/height() 标成可空）；
        // 运行期表达式与基线完全相同。
        top: scrollTop + (messageEl.position() as { top: number }).top - (clientHeight - (messageEl.height() as number)) / 2,
      });
      utils.highlightMessage(id);
    } else {
      const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
      ajax
        .getMessageById({
          msgid: id,
          type,
          id: session.id,
          num: config.MSG_LENGTH_MORE,
        })
        .then((res: ChatMessage[]) => {
          this.props.dispatch(actions.resetMessage(session.id as string, utils.formatMessages(res)));
          this.setState({
            gotoMessageId: id,
          });
        });
    }
  }
  handleScroll = (event: { scrollTop: number }) => {
    if (!this.scrollView) return;
    const { scrollTop } = event;
    const { getScrollInfo } = this.scrollView;
    const { clientHeight, maxScrollTop, scrollHeight } = getScrollInfo()! as ScrollInfo;
    const { loading, isMore, topUnread, isDownLoadingMessage } = this.state;
    const { session, messages, bottomUnreadMessage } = this.props;
    const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    const messageList = messages[session.id as string] || [];
    const $ChatPanel = $(`#ChatPanel-${session.id}`);
    const isBottom = $ChatPanel.data('isBottom') == undefined ? true : $ChatPanel.data('isBottom');
    const bottomUnread = bottomUnreadMessage[session.id as string] || [];
    const diff = maxScrollTop - scrollTop;

    if (scrollTop === 0 && isMore) {
      const { time } = messageList[0] || {};

      if (loading || !time) {
        return;
      }

      this.lastScrollHeight = scrollHeight;
      this.getMessage(
        {
          sincetime: time,
          type,
          id: session.id,
        },
        'up',
      ).then(res => {
        res = _.isArray(res) ? res.reverse() : [];
        this.props.dispatch(actions.addPageMessage(session.id as string, utils.formatMessages(res)));
      });
    } else if (Math.ceil(scrollTop) === maxScrollTop && isDownLoadingMessage) {
      const { time } = messageList[messageList.length - 1] || {};

      if (loading || !time) {
        return;
      }

      this.setState({
        loading: true,
        direction: 'down',
      });
      ajax
        .getMessage({
          sincetime: time,
          type,
          id: session.id,
          direction: 1,
        })! // 擦除标记（零运行时）：同上，保留 `getMessage` 落空时 `.then` 的原生 TypeError。
        .then((res: ChatMessage[]) => {
          this.setState({
            loading: false,
          });
          if (res.length) {
            this.props.dispatch(actions.pushPageMessage(session.id as string, utils.formatMessages(res)));
          } else {
            this.setState({
              isDownLoadingMessage: false,
            });
            this.props.dispatch(actions.removeBottomUnreadMessage(session.id as string));
          }
        });
    }

    if (maxScrollTop - scrollTop > clientHeight) {
      if (topUnread) {
        this.setState({
          topUnread: 0,
        });
        this.props.dispatch(
          actions.updateSessionList({
            id: session.id,
            messageCount: 0,
          }),
        );
      }

      if (isBottom) {
        $ChatPanel.data('isBottom', false);
        $ChatPanel.find('.ChatPanel-iconBottom').removeClass('hidden');
      }
    } else if (!isBottom && !isDownLoadingMessage) {
      $ChatPanel.data('isBottom', true);
      $ChatPanel.find('.ChatPanel-iconBottom').addClass('hidden');
    }

    if (diff <= 1 && bottomUnread.length && !isDownLoadingMessage) {
      this.props.dispatch(actions.removeBottomUnreadMessage(session.id as string));
      this.props.dispatch(actions.pushPageMessage(session.id as string, utils.formatMessages(bottomUnread)));
      this.handleScrollEnd();
    }
  };
  handleBottomEnd() {
    const { isDownLoadingMessage } = this.state;

    if (isDownLoadingMessage) {
      const { session } = this.props;
      const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
      this.setState({ isDownLoadingMessage: false });
      this.props.dispatch(actions.removeBottomUnreadMessage(session.id as string));
      this.getMessage(
        {
          type,
          id: session.id,
        },
        'up',
      ).then(res => {
        res = _.isArray(res) ? res.reverse() : [];
        this.props.dispatch(actions.resetMessage(session.id as string, utils.formatMessages(res)));
      });
    } else {
      this.handleScrollEnd();
    }
  }
  handleTopUnreadScroll() {
    const { topUnread } = this.state;
    const { session, messages, sessionList } = this.props;
    const messageList = messages[session.id as string] || [];
    const message: Partial<ChatMessage> = messageList[messageList.length - topUnread] || {};
    const unreadMessage = sessionList.filter((item: ChatSession) => item.value == session.id)[0] || {};
    const atId =
      unreadMessage.messageAtlist && unreadMessage.messageAtlist.length ? unreadMessage.messageAtlist[0] : false;
    const id = atId || message.id;
    const messageEl = $(`#Message-${id}`);
    // 擦除标记：同 handleGotoMessage，ScrollView ref 已注入后才会有未读条点击。
    const { scrollTo, getScrollInfo } = this.scrollView!;
    const { maxScrollTop } = getScrollInfo()! as ScrollInfo;
    const top = messageEl.position() ? (messageEl.position() as { top: number }).top : 0;
    const scrollTop = maxScrollTop - Math.abs(top);

    // 指定的消息在不在可视区
    if (top + (messageEl.height() as number) <= (messageEl.height() as number)) {
      scrollTo({
        top: scrollTop,
      });
    }

    this.setState({
      topUnread: 0,
    });
    this.props.dispatch(
      actions.updateSessionList({
        id: session.id,
        messageCount: 0,
      }),
    );
    utils.highlightMessage(id);
  }
  handleRemoveTopUnread(event: MouseEvent) {
    event.stopPropagation();
    const { session } = this.props;
    this.setState({
      topUnread: 0,
    });
    this.props.dispatch(
      actions.updateSessionList({
        id: session.id,
        messageCount: 0,
      }),
    );
  }
  handleBottomUnreadScroll() {
    const { isDownLoadingMessage } = this.state;

    if (isDownLoadingMessage) {
      this.handleBottomEnd();
    } else {
      this.handleScrollEnd();
    }
  }
  handleAddMembers = (event: MouseEvent<HTMLDivElement>) => {
    // 擦除标记：React 合成事件 target 即被点击的节点（原 any 直接读 classList）。
    if ((event.target as HTMLElement).classList.contains('addMember')) {
      const { session } = this.props;
      const { isForbidInvite, isAdmin } = session;

      if (isAdmin || !isForbidInvite) {
        addGroupMembers({
          id: session.id,
          type: Constant.SESSIONTYPE_GROUP,
        });
      } else {
        alert(_l('当前仅允许群主及管理员邀请新成员'), 2);
        return false;
      }
    }
    return undefined;
  };
  renderInviteMessage() {
    const { session } = this.props;
    const targetText = session.isPost ? _l('群组') : _l('聊天');
    const inviteText = _l('邀请好友');
    const hideChat = md.global.SysSettings.forbidSuites.includes('6');
    return (
      <div className="ChatPanel-InviteMessage">
        <div className="InviteMessage-icon">
          <div className="InviteMessage-iconImg" />
        </div>
        <div className="InviteMessage-title">{_l('%0创建成功', targetText)}</div>
        {!hideChat && (
          <div
            className="InviteMessage-content"
            onClick={this.handleAddMembers}
            dangerouslySetInnerHTML={{
              __html: _l('快去%0加入当前%1吧', `<span class="addMember colorPrimary">${inviteText}</span>`, targetText),
            }}
          ></div>
        )}
      </div>
    );
  }
  handleLoadMore(direction: LoadDirection) {
    const { session, messages } = this.props;
    const { loading, errorParam } = this.state;
    const messageList = messages[session.id as string] || [];

    if (errorParam && direction === 'up') {
      this.getMessage(errorParam, 'up').then(res => {
        res = _.isArray(res) ? res.reverse() : [];
        if (messageList.length) {
          this.props.dispatch(actions.addPageMessage(session.id as string, utils.formatMessages(res)));
        } else {
          this.props.dispatch(actions.setMessage(session.id as string, utils.formatMessages(res)));
        }
      });
    } else {
      if (loading) return;
      if (direction === 'up') {
        this.handleScroll({
          scrollTop: 0,
        });
      } else {
        this.handleScrollEnd();
      }
    }
  }
  renderTopInfo() {
    const { session } = this.props;
    return (
      <div>
        {session.isGroup ? (
          this.renderInviteMessage()
        ) : (
          <div className="ChatPanel-messageInfo">{_l('没有更早的历史消息了')}</div>
        )}
      </div>
    );
  }
  renderLoading(direction: LoadDirection) {
    const { loading, errorParam } = this.state;
    return (
      <div
        className="ChatPanel-messageInfo ChatPanel-messageLoading colorPrimary"
        onClick={this.handleLoadMore.bind(this, direction)}
      >
        {loading ? (errorParam ? _l('加载失败，点击重新加载') : _l('加载中...')) : _l('加载更多')}
      </div>
    );
  }
  renderTopUnread() {
    const { session, sessionList } = this.props;
    const { topUnread } = this.state;
    const unreadMessage = sessionList.filter((item: ChatSession) => item.value == session.id)[0] || {};
    // 值域：@ 消息 id / false（无 @）/ null（清空标记）
    let atId: string | false | null | undefined =
      unreadMessage.messageAtlist && unreadMessage.messageAtlist.length ? unreadMessage.messageAtlist[0] : false;
    const messageEl = $(`#Message-${atId}`);

    if (messageEl?.length) {
      // at 消息在可视区就清除掉
      if ((messageEl.position() as { top: number }).top + (messageEl.height() as number) >= (messageEl.height() as number)) {
        atId = null;
      }
    }

    return (
      <div
        className={cx('ChatPanel-unreadTop', { hidden: !topUnread })}
        onClick={this.handleTopUnreadScroll.bind(this)}
      >
        <span className="ChatPanel-unreadTop-content colorPrimary">
          {atId ? _l('有人@了你') : _l('%0条未读消息', topUnread)}
        </span>
        <i className="icon-delete" onClick={this.handleRemoveTopUnread.bind(this)} />
      </div>
    );
  }
  renderBottomUnread() {
    const { session, bottomUnreadMessage } = this.props;
    const bottomUnread = bottomUnreadMessage[session.id as string] || [];
    // 擦除标记：该分支只在 `bottomUnread.length` 为真时渲染，末元素必存在；
    // 若真为空，`.sysType` 仍抛原生 TypeError（与基线 any 一致）。
    const message = bottomUnread[bottomUnread.length - 1]!;
    const { sysType } = message;
    return (
      <div className="ChatPanel-unreadBottom bgColorPrimary" onClick={this.handleBottomUnreadScroll.bind(this)}>
        {sysType ? undefined : (
          <div className="userAvatar">
            <img
              src={
                'logo' in message ? message.logo : `${window.config.AttrPath}default.png?imageView2/1/w/100/h/100/q/100`
              }
            />
          </div>
        )}
        <div className="content">{sysType ? message.msg!.con : `${message.fromAccount!.name}: ${message.msg!.con}`}</div>
        <div className="count">{_l('%0条新消息', bottomUnread.length)}</div>
      </div>
    );
  }
  renderIconBottom() {
    return (
      <div className="ChatPanel-iconBottom icon-bottom colorPrimary hidden" onClick={this.handleBottomEnd.bind(this)} />
    );
  }
  override render() {
    const { isMore, isDownLoadingMessage } = this.state;
    const { session, messages, bottomUnreadMessage } = this.props;
    const bottomUnread = bottomUnreadMessage[session.id as string] || [];
    const { id } = session;
    const messageList = (messages[id as string] || []).filter(item => _.isObject(item));
    return (
      <div className="ChatPanel-sessionList">
        {this.renderTopUnread()}
        <ScrollView
          onScroll={this.handleScroll}
          ref={scrollView => {
            this.scrollView = scrollView;
          }}
        >
          {isMore ? this.renderLoading('up') : this.renderTopInfo()}
          {messageList.map((item, index: number) => (
            <Message
              key={item.id || item.waitingId}
              message={item}
              nextMessage={messageList[index - 1] || {}}
              session={session}
              onGotoMessage={this.handleGotoMessage.bind(this)}
            />
          ))}
          {isMore && isDownLoadingMessage ? this.renderLoading('down') : undefined}
        </ScrollView>
        {bottomUnread.length ? this.renderBottomUnread() : undefined}
        {this.renderIconBottom()}
      </div>
    );
  }
}

export default connect((state: RootState) => {
  const { currentSession, messages, sessionList, gotoMessage, bottomUnreadMessage } = state.chat;

  return {
    currentSession,
    messages,
    sessionList,
    gotoMessage,
    bottomUnreadMessage,
  };
})(MessageView);
