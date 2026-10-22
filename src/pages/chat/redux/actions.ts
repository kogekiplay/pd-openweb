import { sessionPropertyKey } from '../utils/sessionPropertyKey';
import _ from 'lodash';
import type { AppDispatch, GetState } from 'src/redux/types';
import type {
  ChatGroupMessageEvent,
  ChatMessage,
  ChatMessageReceiptWire,
  ChatNewMessageWire,
  ChatNewUserMessageEvent,
  ChatNotifyMessageEvent,
  ChatOutboundDraft,
  ChatPendingMessage,
  ChatRawMessageWire,
  ChatRawSessionWire,
  ChatSession,
  ChatSessionFormatInput,
  ChatSessionPatch,
  ChatToolbarConfig,
} from './types';
import type { ChatAction } from './reducers';
import { dateConvertToUserZone } from 'src/utils/project';
import * as utils from '../utils';
import * as ajax from '../utils/ajax';
import Constant from '../utils/constant';
import * as socket from '../utils/socket';

/**
 * 设置会话列表
 * @param {*} result
 */
export const setSessionList = (result: ChatSessionFormatInput[]) => (dispatch: AppDispatch, getState: GetState) => {
  const { toolbarConfig } = getState().chat;
  dispatch({
    type: 'SET_SESSION_LIST',
    result: utils.sortSession(utils.formatSessionList(result), '', toolbarConfig.messageListShowType),
  });
};

/**
 * 添加更多的会话
 * @param {*} result
 */
export const addSessionList = (result: ChatRawSessionWire[]) => (dispatch: AppDispatch, getState: GetState) => {
  const { toolbarConfig } = getState().chat;
  dispatch({
    type: 'ADD_SESSION_LIST',
    result: utils.sortSession(utils.formatSessionList(result), '', toolbarConfig.messageListShowType),
  });
};

/**
 * 更新会话列表数据
 * @param {*} result
 */
export const updateSessionList = (result: ChatSessionPatch) => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList, currentSessionList, toolbarConfig } = getState().chat;
  const newSessionList = _.cloneDeep(sessionList);
  const { id } = result;
  const adjust: ChatSession[] = [];
  let hasClearCount = false;

  newSessionList.forEach(item => {
    if (item.value === id) {
      // 草稿
      if ('sendMsg' in result) {
        item.sendMsg = result.sendMsg ? result.sendMsg : null;
        if (result.sendMsg) {
          adjust.push(item);
        }
      }

      // 计数
      if ('count' in result) {
        item.count = 'weak' in result ? item.count : (item.count || 0) + result.count!;
        item.time = utils.formatMsgDate(dateConvertToUserZone(result.time || utils.getCurrentTime()));
        item.msg!.con = result.msg;
        item.id = result.msgId;
        item.isPush = result.isPush;
        adjust.push(item);
        // 日程弱消息
        if ('weak' in result) {
          if (result.weak) {
            item.weak_count = result.count;
            item.isPush = item.count ? true : false;
          } else {
            item.count = item.count! + result.count!;
            item.isPush = true;
          }
        }
      }

      // 清除计数
      if ('clearCount' in result) {
        item.count = 0;
        item.messageCount = result.clearCount;
        hasClearCount = true;
        if ('weak_count' in item) {
          item.weak_count = 0;
        }
      }

      // 清除未读消息计数
      if ('messageCount' in result) {
        item.messageCount = 0;
        item.messageAtlist = [];
      }

      // 添加会话
      if ('addMsg' in result) {
        item.time = utils.formatMsgDate(dateConvertToUserZone(result.time || utils.getCurrentTime()));
        item.msg!.con = result.addMsg;
        adjust.push(item);
        delete item.isSession;
        let isSetTop = false;
        const newCurrentSessionList = currentSessionList.map(n => {
          if (n.id === item.value && 'isSession' in n) {
            isSetTop = true;
            n.isTop = false;
            delete n.isSession;
          }

          return n;
        });

        if (isSetTop) {
          dispatch({
            type: 'UPDATE_CURRENT_SESSION',
            result: newCurrentSessionList,
          });
        }
      }

      // 设置 @ 消息
      if ('atlist' in result) {
        // 【擦除式合同（lead 15:29 允许）】`'atlist' in result` 不证明值一定是数组，
        // 故类型上保留 `| undefined`；`.length` 处用非空断言**仅擦除类型**（零运行时），
        // 若值确为 undefined，仍由原生 "Cannot read properties of undefined" 失败 —— 原行为保留。
        item.atlist = result.atlist;
        if (result.atlist!.length) {
          item.messageAtlist = result.atlist;
        } else if (result.isWithdraw) {
          // 如果是撤回的，必须得清空
          item.messageAtlist = [];
        }

        if (result.at_msg) {
          item.at_msg = result.at_msg;
        }
      }

      // 回复我
      if ('refer' in result) {
        item.refer = result.refer;
      }

      if ('reflist' in result) {
        item.reflist = result.reflist;
      }

      // 置顶
      if ('isTop' in result) {
        item.top_info = {
          isTop: result.isTop,
          time: result.time,
        };
        adjust.push(item);
      }

      // 标记非好友，不能聊天
      if ('isContact' in result) {
        item.isContact = result.isContact;
      }

      // 系统消息
      if ('showBadge' in result) {
        item.showBadge = result.showBadge;
      }
    }
  });

  if (hasClearCount) {
    utils.removeFlashTitle('', newSessionList);
  }

  // 新的计数会话排到第一个位置
  if (adjust.length) {
    const { value } = adjust[0]!;
    const list = newSessionList.filter(item => value !== item.value);
    dispatch({
      type: 'SET_SESSION_LIST',
      result: utils.sortSession(adjust.concat(list), value, toolbarConfig.messageListShowType),
    });
  } else {
    dispatch({
      type: 'SET_SESSION_LIST',
      result: newSessionList,
    });
  }
};

/**
 * 删除会话
 * @param {*} result
 */
export const removeSession = (id: string) => {
  return {
    type: 'REMOVE_SESSION',
    id,
  } satisfies ChatAction;
};

/**
 * 添加会话
 * @param {*} result
 */
export const addSession = (result: ChatRawMessageWire, id?: string) => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;

  // 兼容连续消息
  if (id) {
    const session = sessionList.filter(item => item.value === id)[0];
    const isSelf = md.global.Account.accountId === result.from;
    const name = isSelf ? _l('我') : result.uname;
    const msg = {
      count: 0,
      id,
      // 【局部窄化（lead 13:23 允许）】此处 `msg` 是 socket 的**对象**形态（`{ con }`），
      // 不是系统消息那种字符串；`isPush` 在 wire 上未单列，按索引取值后断言为布尔。
      msg: `${name}: ${(result.msg as { con?: unknown }).con}`,
      isPush: result.isPush,
    };

    if (session) {
      dispatch(updateSessionList(msg));
      return;
    }
  }

  // 【三层合同】入参是原始 wire；`formatNewSession` 就地改型并返回**同一对象**，
  // 归一化结果用独立局部承接，使进入 action 的载荷类型与真实值一致（`ChatSession`）。
  const session = utils.formatNewSession(result);
  if (!session.id) {
    session.isSession = false;
  }

  dispatch({
    type: 'ADD_SESSION',
    result: [session],
  });
};

/**
 * 添加群组会话
 * @param {*} groupId
 * @param {*} msg
 */
export const addGroupSession =
  (groupId: string, msg: ChatRawMessageWire = {} as ChatRawMessageWire, isOpen = true) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { sessionList } = getState().chat;
    // if (utils.chatWindow.is(groupId)) {
    //   return;
    // }
    const session = sessionList.filter(item => item.value == groupId)[0];

    if (session) {
      isOpen && dispatch(setCurrentSessionId(groupId));
    } else {
      if (msg['avatar']) {
        const message = Object.assign(
          {
            count: 0,
            isGroup: true,
            sysType: 1,
          },
          msg,
        );
        dispatch(addSession(message));
        if (isOpen) {
          dispatch(setCurrentSessionId(groupId));
          socket.Contact.recordAction({
            id: groupId,
            type: 2,
          });
        }
      } else {
        ajax
          .chatSessionItem({
            type: Constant.SESSIONTYPE_GROUP,
            value: groupId,
          })
          ?.then(group => {
            const message = Object.assign(
              {
                isGroup: true,
                count: 0,
                to: groupId,
                avatar: group!.avatar,
                groupname: group!.name,
                msg: { con: '' },
                sysType: 1,
              },
              msg,
            );
            dispatch(addSession(message, groupId));
            if (isOpen) {
              dispatch(setCurrentSessionId(groupId));
              socket.Contact.recordAction({
                id: groupId,
                type: 2,
              });
            }
          });
      }
    }
  };

/**
 * 添加个人会话
 * @param {*} id
 * @param {*} msg
 * @param {*} isOpen
 * @param {*} cb
 */
export const addUserSession =
  (id: string | undefined, msg: ChatRawMessageWire = {}, isOpen = true, cb?: (() => void) | undefined) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { sessionList } = getState().chat;
    // if (utils.chatWindow.is(id)) {
    //   return;
    // }
    const session = sessionList.filter(item => item.value === id)[0];

    if (session) {
      if (!_.get(session, 'top_info.isTop')) {
        const list = sessionList.filter(item => item.value !== id);
        const topIndex = _.findLastIndex(list, item => _.get(item, 'top_info.isTop') === true) + 1;

        list.splice(topIndex, 0, session);

        dispatch({
          type: 'UPDATE_SESSION_LIST',
          result: list,
        });
      }

      isOpen && dispatch(setCurrentSessionId(id));
      cb && cb();
    } else {
      if (msg['logo']) {
        const message = Object.assign(
          {
            count: 0,
            from: id,
            msg: { con: '' },
            isGroup: false,
          },
          msg,
        );
        dispatch(addSession(message));
        if (isOpen) {
          dispatch(setCurrentSessionId(id));
          socket.Contact.recordAction({
            id: id,
            type: 1,
          });
        }

        cb && cb();
      } else {
        ajax
          .chatSessionItem({
            type: Constant.SESSIONTYPE_USER,
            value: id,
          })
          ?.then(user => {
            const message = Object.assign(
              {
                count: 0,
                from: id,
                logo: user!.avatar,
                uname: user!.fullname,
                msg: { con: '' },
                isGroup: false,
                sysType: 1,
                isPush: true,
              },
              msg,
            );
            dispatch(addSession(message, id));
            if (isOpen) {
              dispatch(setCurrentSessionId(id));
              socket.Contact.recordAction({
                id: id,
                type: 1,
              });
            }

            cb && cb();
          });
      }
    }
  };

/**
 * 添加系统消息
 * @param {*} id
 * @param {*} msg
 */
export const addSysSession =
  /**
   * 新增系统会话。
   * 【有限声明依据】函数体只做 `dispatch(addSession(msg))` —— `addSession` 的入参
   * 已收敛为 `ChatRawMessageWire`，故这里同步用它；默认空对象仍保留（原行为）。
   */
  (id: string, msg: ChatRawMessageWire = {} as ChatRawMessageWire) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { sessionList } = getState().chat;
    const session = sessionList.filter(item => item.value == id)[0];

    if (session) {
      dispatch(setCurrentSessionId(id));
    } else {
      dispatch(addSession(msg));
      dispatch(setCurrentSessionId(id));
    }
  };

/**
 * 窗口同步
 * @param {*} status
 */
/**
 * `operate` 的 socket 载荷（`socket.ts` 的 `recordAction(contact)` 发出）。
 * `contact.id` 有两种真实形态：
 *   ① 普通会话：字符串（`recordAction({ id: groupId/id/'', type: 1|2 })`）
 *   ② 系统会话：`SessionList.addInbox` 传 `{ count, id, type, dtype }`，
 *      **`dtype` 里才是真正的会话 id**（`else` 分支的 `id.dtype` 就取它）。
 * 因此这里建联合，读取 `.dtype` 处用**擦除式断言**（零运行时、保留原表达式）。
 */
export const operate = (
  status: {
    contact: {
      id: string | { count?: number; id?: string; type?: number; dtype?: string };
      type: number;
      showBadge?: boolean;
    };
    isclose: boolean;
    isopen: boolean;
  },
) => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;
  const { contact, isclose, isopen } = status;
  const session = sessionList.filter(item => item.value === (contact.id as string))[0];
  const contactType = Number(contact.type);

  if (session && 'showBadge' in contact) {
    session.showBadge = contact.showBadge;
  }

  if (isclose) {
    // 关闭窗口
    dispatch(setNewCurrentSession({}));
  } else if (isopen) {
    // 开启窗口
    if (session) {
      dispatch(setNewCurrentSession(session));
    } else {
      if (contactType === Constant.SESSIONTYPE_USER) {
        dispatch(
          addUserSession(contact.id as string, {
            msg: { con: '' },
            sysType: 1,
          }),
        );
      } else if (contactType === Constant.SESSIONTYPE_GROUP) {
        dispatch(addGroupSession(contact.id as string));
      } else {
        const { id } = contact;
        // 系统会话路径：`id` 是 `{ count, id, type, dtype }`，`dtype` 才是会话 id。
        // 用擦除式断言读取（零运行时）：普通会话的字符串不会走到这里（已按 contactType 分流）。
        dispatch(addSysSession((id as { dtype?: string }).dtype as string, id as ChatRawMessageWire));
      }
    }
  }
};

/**
 * 发送设置置顶的会话
 * @param {*} message
 */
/**
 * 发送置顶请求。
 * 【有限声明依据】三个调用方（`SessionList` / `ChatPanelHeader` / `Inbox/components/inboxHeader`）
 * 传的都是同一形状：`{ type, value, isTop }`。
 */
export const sendSetTop = (message: { type?: number | undefined; value?: string | undefined; isTop: boolean }) => (_dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;
  const { isTop } = message;

  const count = sessionList.reduce((count: number, item) => {
    const { top_info } = item;
    const n = top_info ? (top_info.isTop ? 1 : 0) : 0;
    return count + n;
  }, 0);

  if (count >= 10 && isTop) {
    alert(_l('置顶数最多10条'), 3);
  } else {
    socket.Contact.setTop(message);
  }
};

/**
 * 设置置顶
 * @param {*} message
 */
export const setTop = (message: {
  value: string;
  top_info?: { isTop?: boolean | undefined; time?: number | string | undefined; [key: string]: unknown } | undefined;
}) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, sessionList, currentSession } = getState().chat;
  const session = sessionList.filter(item => item.value === message.value)[0];
  const isTop = message.top_info ? message.top_info.isTop : false;
  const time = message.top_info ? message.top_info.time : '';

  if (session) {
    const newCurrentSessionList = currentSessionList.map(item => {
      if (item.id === message.value) {
        item.isTop = isTop;
        delete item.isSession;
      }

      return item;
    });
    dispatch({
      type: 'UPDATE_CURRENT_SESSION',
      result: newCurrentSessionList,
    });
    dispatch(
      updateSessionList({
        id: message.value,
        isTop,
        time,
      }),
    );

    if (message.value === currentSession.value) {
      // 【擦除标记】`find` 的返回在类型上是 `ChatSession | undefined`，而原实现在此处
      // 直接 spread 并读 `.top_info`（缺项时由**原生**抛 reading 'top_info'）。
      // 用非空断言把"类型上的可空"擦掉：非空断言**零运行时**，原表达式逐字不变，
      // 也不手写 TypeError 模拟原生异常。
      let _current = sessionList.find(l => l.value === message.value)!;

      dispatch(
        setNewCurrentSession({
          ..._current,
          top_info: {
            ..._current.top_info,
            isTop: isTop,
          },
        }),
      );
    }
  }
};

/**
 * 同步删除会话
 * @param {*} message
 */
export const sessionRemoved = (message: { id: string; type: number }) => (dispatch: AppDispatch, getState: GetState) => {
  const { id, type } = message;
  const { currentSession, sessionList } = getState().chat;
  const value = type > 2 ? utils.getInboxId(type) : id;
  dispatch(removeSession(value));
  dispatch(removeCurrentSession(value));
  dispatch(removeCurrentInbox(value));
  dispatch(removeMessages(value));
  if (value === currentSession.value) {
    dispatch(setNewCurrentSession({}));
  }

  utils.removeFlashTitle(value, sessionList);
};

/**
 * 清除会话未读消息计数
 * @param {*} message
 */
export const clearUnread = (message: { id: string }) => (dispatch: AppDispatch) => {
  const { id } = message;
  dispatch(updateSessionList({ id, atlist: [] }));
  dispatch(updateSessionList({ id, reflist: [] }));
  dispatch(updateSessionList({ id, refer: null }));
  dispatch(updateSessionList({ id, clearCount: 0 }));
};

/**
 * 清除所有计数
 */
export const clearAllUnread = () => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;
  const newSessionList = _.cloneDeep(sessionList).map(item => {
    if (item.count) {
      item.count = 0;
    }

    if (item.atlist && item.atlist.length) {
      item.atlist = [];
    }

    if (item.reflist && item.reflist.length) {
      item.reflist = [];
    }

    if (item.refer) {
      item.refer = null;
    }

    return item;
  });
  utils.removeFlashTitle('', newSessionList);
  dispatch({
    type: 'UPDATE_SESSION_LIST',
    result: newSessionList,
  });
};

/**
 * 清除 inbox 的未读计数
 * @param {*} message
 */
export const clearNotification = (message: { type: string }) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession } = getState().chat;
  const { type } = message;
  dispatch(updateSessionList({ id: type, clearCount: 0 }));
  if (currentSession.id === type && currentSession.count) {
    dispatch({
      type: 'SET_CURRENT_SESSION',
      // 【不能用 Object.assign(currentSession, ...)】第一个参数是 store 里的对象，
      // 那样是原地改写，redux-toolkit 的 immutableStateInvariant 会抛
      //   A state mutation was detected between dispatches, in the path 'chat.currentSession.count'
      result: { ...currentSession, count: 0 },
    });
  }
};

/**
 * 删除群组
 * @param {*} data
 */
export const removedFromGroup = (data: { id: string }) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession } = getState().chat;
  const { id } = data;

  if (currentSession.value === id) {
    dispatch(setNewCurrentSession({}));
  }

  dispatch(removeCurrentSession(id));
  dispatch(removeSession(id));
  dispatch(removeMessages(id));
};

/**
 * 关闭聊天
 */
export const closeSessionPanel = () => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession } = getState().chat;

  if (currentSession.value) {
    dispatch(setNewCurrentSession({}));
    socket.Contact.recordAction({ id: '' });
  }
};

/**
 * 设置一个新的会话信息
 * @param {*} result
 */
/**
 * 打开/设置当前会话。
 * 【入参为何保留 `| undefined`（lead 2026-10-20 派发检查）】真实生产方确有
 * `setNewCurrentSession(newSessionList.find(...))` 这种可能为 `undefined` 的调用；
 * 动作 `SET_CURRENT_SESSION` 已**如实**允许 `undefined`（reducer 的
 * `Object.assign({}, action.result)` 对 undefined 源返回 `{}`，与基线运行一致）。
 * 函数体里的 `if (result && result.value)` 是**既有运行表达式**，原样保留。
 */
export const setNewCurrentSession = (result: ChatSession | undefined) => (dispatch: AppDispatch) => {
  /* 【点会话列表时 dev 下报 A state mutation was detected ... 'chat.sessionList.N.id'】
     result 常常直接是 chat.sessionList 里的对象（SessionList.handleOpenPanel 只在带 showBadge 时才拷一份），
     原先 setCurrentChat 在它身上写 id = value，RTK 的不可变检查在 dev 下抛错、会话面板打不开；生产没有这个检查，
     但 sessionList 元素上的 id（updateSessionList 写进去的最后一条消息 id）会被悄悄覆盖成会话 id。
     下游读 currentSession.id 的地方（SessionList 的切换判断、新窗口地址等）拿到的一直是 value，这里拷一份补上，行为不变。 */
  if (result && result.value) {
    result = { ...result, id: result.value };
  }

  socket.Contact.setCurrentChat(result);
  dispatch({
    type: 'SET_CURRENT_SESSION',
    result,
  });
  if (result!.value !== 'workflow') {
    dispatch({
      type: 'REMOVE_INBOX_SESSION',
      id: 'workflow',
    });
  }
};

/**
 * 设置会话信息
 * @param {*} id
 * @param {*} message
 */
export const setCurrentSessionId =
  /**
   * @param id 会话 id
   * @param message 叠加到该会话上的**局部覆盖**（`{ ...session, ...message }` 后派发为
   * `SET_CURRENT_SESSION.result`，其类型是 `ChatSession`）
   */
  (id: string | undefined, message: Partial<ChatSession> = {}) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { sessionList } = getState().chat;
    const found = sessionList.filter(item => item.value === id)[0];
    // 同上：session 取自 sessionList（store 里的对象），不能原地 assign；id = value 原先是 setCurrentChat 顺手写上的
    const session = found && found.value ? { ...found, id: found.value } : found;
    socket.Contact.setCurrentChat(session);
    dispatch({
      type: 'SET_CURRENT_SESSION',
      result: { ...session, ...message },
    });
  };

/**
 * 添加聊过的会话消息
 * @param {*} result
 */
export const addCurrentSession = (result: ChatSession) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, sessionList } = getState().chat;
  // 【先拷一份再改】调用方经常直接把 sessionList 里的那个对象传进来，
  // 在它身上写 isGroup / id / isTop 就是在改 store，会被 immutableStateInvariant 抓到：
  //   A state mutation was detected between dispatches, in the path 'chat.sessionList.N.id'
  result = { ...result };
  result.isGroup = !!result.groupId;
  result.id = result.isGroup ? result.groupId : result.accountId;
  if (currentSessionList.length >= 2) {
    // 【擦除标记】`[0]` 在 `noUncheckedIndexedAccess` 下是 `ChatSession | undefined`。
    // 用非空断言擦除（零运行时），原解构语句不变；缺项时仍由**原生**抛错。
    const { id } = currentSessionList[0]!;
    dispatch(removeCurrentSession(id));
    dispatch(removeMessages(id));
  }

  const session = _.filter(sessionList, { value: result.id })[0] || {};
  const isTop: boolean = _.get(session, 'top_info.isTop', false) as boolean;
  result.isTop = isTop;
  if ('isSession' in session) {
    result.isSession = session.isSession;
  }

  dispatch({
    type: 'ADD_CURRENT_SESSION',
    result,
  });
};

/**
 * 添加打开过 inbox 消息
 * @param {*} result
 */
export const addCurrentInbox = (result: ChatSession) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentInboxList = [] } = getState().chat;

  if (currentInboxList.length >= 3) {
    // 同 currentSessionList：非空断言擦除，原解构不变。
    const { id } = currentInboxList[0]!;
    dispatch(removeCurrentInbox(id));
  }

  // 原来是 result.requestNow = Date.now()，而 result 是调用方直接从 redux 里取出来的
  // 会话对象（ChatPanel.inboxSessionItem 传的 session），等于在 dispatch 之前改 store。
  // redux 3 的 createStore 不检查，迁到 RTK configureStore 后默认带
  // immutableStateInvariantMiddleware，它【抛错】不是警告：
  //   A state mutation was detected between dispatches, in the path 'chat.currentSession.requestNow'
  // 于是点右侧栏的工作流入口整页被 ErrorBoundary 接住，变成「程序错误，请刷新页面重试」。
  // 这两个检查只在非 production 生效，线上构建不受影响，坏的只有本地 dev。
  // 改成带上 requestNow 复制一份：reducer 是 state.concat(action.result)，存进去的就是
  // 这个副本；唯一的调用方 dispatch 之后不再用原对象，行为不变。
  dispatch({
    type: 'ADD_INBOX_SESSION',
    result: { ...result, requestNow: Date.now() },
  });
};

/**
 * 更新 inbox 时间
 * @param {*} result
 */
export const updateInoxRequestNow = (id: string | undefined) => {
  return {
    type: 'UPDATE_INBOX_SESSION',
    id,
    data: {
      requestNow: Date.now(),
    },
  } satisfies ChatAction;
};

/**
 * 删除聊过的会话信息
 * @param {*} result
 */
// 【形参放宽为 string | undefined】调用方 `removeCurrentSessionList` 从
// `currentSessionList[0]` 取 id，而 `formatSession` 不保证会话一定有 id。
// 放宽形参**不改变任何运行时行为**（原实现同样接收并透传 undefined），
// 只是让类型如实表达既有调用。
export const removeCurrentSession = (id: string | undefined) => {
  return {
    type: 'REMOVE_CURRENT_SESSION',
    id,
  } satisfies ChatAction;
};

/**
 * 删除打开过的 inbox 信息
 * @param {*} result
 */
// 同 removeCurrentSession：调用方从 currentInboxList[0] 取 id，可能缺失。
export const removeCurrentInbox = (id: string | undefined) => {
  return {
    type: 'REMOVE_INBOX_SESSION',
    id,
  } satisfies ChatAction;
};

/**
 * 修改群名称
 * @param {*} id
 * @param {*} name
 */
export const resetGroupName = (groupId: string | undefined, name: string | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, sessionList } = getState().chat;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.name = name;
    }

    return item;
  });
  const newSessionList = sessionList.map(item => {
    if (item.value === groupId) {
      item.name = name;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
  dispatch({
    type: 'UPDATE_SESSION_LIST',
    result: newSessionList,
  });
};

/**
 * 讨论转换成群组
 * @param {*} id
 * @param {*} name
 */
export const resetGroupIsPost = (groupId: string | undefined, projectId: string | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, sessionList } = getState().chat;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.isPost = true;
      item.project = projectId ? _.find(md.global.Account.projects, { projectId }) : undefined;
    }

    return item;
  });
  const newSessionList = sessionList.map(item => {
    if (item.value === groupId) {
      item.isPost = true;
      item.project = projectId ? _.find(md.global.Account.projects, { projectId }) : undefined;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
  dispatch({
    type: 'UPDATE_SESSION_LIST',
    result: newSessionList,
  });
};

/**
 * 修改群头像
 * @param {*} groupId
 * @param {*} name
 */
export const updateGroupAvatar = (groupId: string | undefined, avatar: string | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;
  const newSessionList = sessionList.map(item => {
    if (item.value === groupId) {
      item.logo = avatar;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_SESSION_LIST',
    result: newSessionList,
  });
};

/**
 * 修改群公告
 * @param {*} groupId
 * @param {*} about
 */
export const updateGroupAbout = (groupId: string | undefined, about: string | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList } = getState().chat;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.about = about;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
};

/**
 * 消息免打扰
 * @param {*} groupId
 * @param {*} isPushNotice
 */
export const updateGroupPushNotice =
  (groupId: string | undefined, isPushNotice: boolean | undefined) => (dispatch: AppDispatch, getState: GetState) => {
    const { currentSessionList, sessionList } = getState().chat;
    const newCurrentSessionList = currentSessionList.map(item => {
      if (item.id === groupId) {
        item.isPushNotice = isPushNotice;
      }

      return item;
    });
    const newSessionList = sessionList.map(item => {
      if (item.value === groupId) {
        item.isPush = isPushNotice;
      }

      return item;
    });

    dispatch({
      type: 'UPDATE_CURRENT_SESSION',
      result: newCurrentSessionList,
    });
    dispatch({
      type: 'UPDATE_SESSION_LIST',
      result: newSessionList,
    });
  };

/**
 * 仅允许群主及管理员邀请新成员
 * @param {*} groupId
 * @param {*} isForbidInvite
 */
export const updateForbIdInvite =
  (groupId: string, isForbidInvite: boolean) => (dispatch: AppDispatch, getState: GetState) => {
    const { currentSessionList } = getState().chat;
    const newCurrentSessionList = currentSessionList.map(item => {
      if (item.id === groupId) {
        item.isForbidInvite = isForbidInvite;
      }

      return item;
    });
    dispatch({
      type: 'UPDATE_CURRENT_SESSION',
      result: newCurrentSessionList,
    });
  };

/**
 * 设为官方群组
 * @param {*} groupId
 * @param {*} isVerified
 */
export const updateVerify = (groupId: string | undefined, isVerified: boolean | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList } = getState().chat;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.isVerified = isVerified;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
};

/**
 * 更改管理员
 * @param {*} groupId
 * @param {*} isAdmin
 */
export const updateAdmin = (groupId: string, isAdmin: boolean) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList } = getState().chat;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.isAdmin = isAdmin;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
};

/**
 * 更新成员人数
 * @param {*} groupId
 * @param {*} count
 */
export const updateMember = (groupId: string, count: number) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, currentSession } = getState().chat;
  const { iconType } = currentSession;
  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.id === groupId) {
      item.groupMemberCount! = item.groupMemberCount! + count;
    }

    return item;
  });

  if (iconType) {
    currentSession.isRender = false;
    dispatch({
      type: 'SET_CURRENT_SESSION',
      result: currentSession,
    });
  }

  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
};

/**
 * 获取聊天的消息列表
 * @param {*} result
 */
/**
 * 整体设置某会话的消息列表。
 * 【有限声明依据】与 `resetMessage`/`addPageMessage`/`pushPageMessage` 同型：
 * 调用点传的都是 `utils.formatMessages(...)` 的结果（`ChatMessage[]`），
 * 对应 `SET_MESSAGE.result` 的数组契约。
 */
export const setMessage = (id: string, result: ChatMessage[]) => (dispatch: AppDispatch, getState: GetState) => {
  const { messages } = getState().chat;
  dispatch({
    type: messages[id] ? 'ADD_PAGE_MESSAGE' : 'SET_MESSAGE',
    id,
    result,
  });
};

/**
 * 重新填充聊天记录
 * @param {*} id
 * @param {*} result
 */
/**
 * 重新填充聊天记录。
 * 【有限声明依据】调用点都在 `MessageView` 里（`resetMessage` 两处），传的是 `utils.formatMessages(res)`（数组）。
 */
export const resetMessage = (id: string, result: ChatMessage[]) => {
  return {
    type: 'SET_MESSAGE',
    id,
    result,
  } satisfies ChatAction;
};

/**
 * 向上加载一页的数据
 * @param {*} id
 * @param {*} result
 */
/**
 * 向上加载一页（前插）。
 * 【有限声明依据】`MessageView` 里两处 `addPageMessage` 都传 `utils.formatMessages(res)`（数组）。
 */
export const addPageMessage = (id: string, result: ChatMessage[]) => {
  return {
    type: 'ADD_PAGE_MESSAGE',
    id,
    result,
  } satisfies ChatAction;
};

/**
 * 向下加载一页的数据
 * @param {*} id
 * @param {*} result
 */
/**
 * 向下补齐一页（后接）。
 * 【有限声明依据】`MessageView` 里两处 `pushPageMessage`：一处传 `formatMessages(res)`、另一处传 `formatMessages(bottomUnread)`（均为数组）。
 */
export const pushPageMessage = (id: string, result: ChatMessage[]) => {
  return {
    type: 'PUSH_PAGE_MESSAGE',
    id,
    result,
  } satisfies ChatAction;
};

/**
 * 发送新消息
 * @param {*} newMessage
 * @param {*} prevMessage
 */
/**
 * 发送一条新消息（先构造待发消息，再交给 `formatMessage`）。
 * 【有限声明依据】
 * - `newMessage` 是**出站草稿** `ChatOutboundDraft`：`sendMsg: newMessage` 原样保存便于重发；
 *   它读取的 `waitingid`/`msg`/`togroup`/`touser`/`type`/`sysType`/`refer`/`referMessage`/
 *   `card`/`file`/`isPrepare` 均已在该接口上显式声明。
 * - `prevMessage` 是列表里上一条 `ChatMessage`（`formatMessage(message, prevMessage)` 的第二参）。
 * 【本函数内部那条 `message` 字面量仍是手写形状】它的 `refer` 是**出站摘要**
 * （`{ msg, type, user.full_name }`），与 `ChatMessage.refer`（`{ msgid, iswd, user.account_id }`）
 * **形状本就不同**，不能直接改成 `ChatMessage`；该处在下批单独建模。
 */
export const addMessage = (newMessage: ChatOutboundDraft, prevMessage?: ChatMessage) => (dispatch: AppDispatch) => {
  const { Account: account } = md.global;
  // sysType / refer / card / isPrepare 是按消息种类【后面才补上】的
  //（系统消息 / 引用 / 卡片 / 预发送），所以要在这里写出形状。
  // 原先 md.global 是 any，这个字面量的推断类型跟着变宽，事后加属性不报错。
  const message: ChatPendingMessage = {
    waitingId: newMessage.waitingid,
    // id: newMessage.waitingid,
    from: account.accountId,
    fromAccount: {
      email: account.email,
      id: account.accountId,
      logo: account.avatar,
      name: account.fullname,
    },
    msg: {
      con: newMessage.msg,
    },
    to: newMessage.togroup || newMessage.touser,
    type: newMessage.type,
    time: utils.getCurrentTime(),
    iswd: false,
    sendMsg: newMessage, // 保留发给后端的消息数据，便于重发
    isMineMessage: true,
  };

  // 系统消息
  if (newMessage.sysType) {
    message.sysType = newMessage.sysType;
  }

  // 包含引用消息
  if (newMessage.refer) {
    const { referMessage } = newMessage;
    message.refer = {
      msg: referMessage!.msg!.con,
      type: referMessage!.type,
      user: {
        full_name: referMessage!.fromAccount!.name,
      },
    };
  }

  if (newMessage.type === Constant.MSGTYPE_CARD) {
    // 卡片消息
    message.card = newMessage.card;
  } else if (newMessage.type === Constant.MSGTYPE_PIC) {
    // 图片消息
    newMessage.file!.url = window.config!.FilePath! + newMessage.file!.key!;
    message.msg.files = newMessage.file;
    message.isPrepare = newMessage.isPrepare || false;
  } else if (newMessage.type === Constant.MSGTYPE_FILE || newMessage.type === Constant.MSGTYPE_APP_VIDEO) {
    // 附件消息
    message.msg.files = newMessage.file;
    message.isPrepare = newMessage.isPrepare || false;
  }

  // 【依据既有守卫收窄（lead 2026-10-20）】`id` 取自 togroup/touser，可能为 `undefined`；
  // 下面的 `_.isEmpty(id)` 守卫会把空值/缺项提前 return，因此进入派发时它必定是非空字符串。
  // TS 无法内建 lodash 的 isEmpty 语义，故用**擦除式断言**把该守卫证据接到 `id: string` 上
  // （零运行时，`as` 被编译器完全擦除，运行表达式不变）。
  const id = (newMessage.togroup || newMessage.touser) as string;

  if (_.isEmpty(id)) return;

  if (prevMessage) {
    dispatch({
      type: 'ADD_MESSAGE',
      id,
      result: utils.formatMessage(message, prevMessage),
    });
  } else {
    dispatch({
      type: 'SET_MESSAGE',
      id,
      result: [utils.formatMessage(message, prevMessage)],
    });
  }
};

/**
 * 删除单个消息
 * @param {*} id
 * @param {*} messageId
 */
export const removeMessage = (id: string, messageId: string) => {
  return {
    type: 'REMOVE_MESSAGE',
    id,
    messageId,
  } satisfies ChatAction;
};

/**
 * 删除消息列表
 * @param {*} id
 */
// 同 removeCurrentSession：调用方透传会话 id，可能缺失。
export const removeMessages = (id: string | undefined) => {
  return {
    type: 'REMOVE_MESSAGES',
    id,
  } satisfies ChatAction;
};

/**
 * 更新某个消息
 * @param {*} message
 */
export const updateMessage = (message: ChatMessageReceiptWire) => (dispatch: AppDispatch, getState: GetState) => {
  const { messages } = getState().chat;
  const { to, waitingid, socket } = message;
  // 擦除标记：`to` 类型上可为 undefined（原始 ack 显式覆盖）；原实现直接 `messages[to]`，
  // JS 属性键语义下 undefined 会变成键 "undefined"，这里保留完全相同的索引行为。
  const currentMessage = messages[to as string] || [];
  const newCurrentMessage = currentMessage
    .filter(item => item)
    .map(item => {
      if (item!.waitingId === waitingid) {
        // item 是 chat.messages 里的对象（store 里的）：先拷一份再改，嵌套的 msg 也一样，
        // 否则 dev 下发消息收到回执时会被 RTK 的不可变检查拦下（生产得到的结果值与原先相同）
        item = { ...item, msg: item!.msg && { ...item!.msg } };
        item.id = message.id;
        // 替换成服务器的时间
        if (socket && socket!.time) {
          item.timestamp = utils.formatMsgDate(dateConvertToUserZone(socket!.time));
        }

        // 引用消息
        if (item.refer) {
          const { referMessage } = message;
          item.refer = {
            msgid: referMessage!.id,
            msg: referMessage!.msg!.con,
            msgdetail: socket!.refer!.msgdetail,
            type: referMessage!.type,
            time: referMessage!.time,
            iswd: referMessage!.iswd,
            user: {
              account_id: referMessage!.fromAccount!.id,
              full_name: referMessage!.fromAccount!.name,
              avatar: referMessage!.fromAccount!.logo,
            },
          };
          // item.refer = message.refer;
        }

        // 转成系统消息
        if ('isContact' in message) {
          item.sysType = Constant.MSGTYPE_SYSTEM_ERROR;
          item.msg = { con: '' };
          item.isContact = false;
        }

        // 图片消息，替换 url
        if (socket && socket!.msg!.files) {
          item.msg!.files = socket!.msg!.files;
        }
      }

      return item;
    });
  dispatch({
    type: 'SET_MESSAGE',
    id: to,
    result: newCurrentMessage,
  } satisfies ChatAction);
};

/**
 * 将卡片类型的知识文件更新成附件类型
 * @param {*} message
 */
/**
 * 用新消息替换列表里同 id 的那条（上传完成后回填）。
 * 【有限声明依据】函数体里 `return newMessage;` 直接作为 `messages` 数组的元素，
 * 因此它就是一条 `ChatMessage`（原实现靠 `any` 隐式满足该契约）。
 */
export const updateFileMessage = (newMessage: ChatMessage, to: string | undefined) => (dispatch: AppDispatch, getState: GetState) => {
  const { messages } = getState().chat;
  const { id } = newMessage;
  const currentMessage = messages[sessionPropertyKey(to)];
  if (currentMessage === undefined) return;
  const newCurrentMessage = currentMessage.map(item => {
    if (item && item.id === id) {
      return newMessage;
    }

    return item;
  });
  dispatch({
    type: 'SET_MESSAGE',
    id: to,
    result: newCurrentMessage,
  });
};

/**
 * 将消息改为已经撤回的消息
 * @param {*} newMessage
 */
/**
 * 把消息改为"已撤回"。
 * 【有限声明依据】函数体只解构 `{ id: messageId, msg }`，且仅使用 `msg.con`
 * （两处 `item.msg!.con = msg.con`）。三处调用方传的都是 socket/API 的 any 载荷，
 * 因此这里按**实际读取**建模，不臆造更多字段。
 */
export const updateWithdrawMessage = (
  id: string,
  newMessage: { id?: string | number | undefined; msg: { con?: string | undefined; [key: string]: unknown } },
) => (dispatch: AppDispatch, getState: GetState) => {
  const { messages, referMessage, bottomUnreadMessage } = getState().chat;
  const { id: messageId, msg } = newMessage;
  const currentMessage = messages[id];
  const bottomUnread = bottomUnreadMessage[id] || [];

  if (!currentMessage) {
    return;
  }

  currentMessage.forEach((item, index) => {
    if (item!.id == messageId) {
      const nextMessage = currentMessage[index + 1];
      item!.iswd = true;
      if (item!.from === md.global.Account.accountId && !item!.msg!.oldCon) {
        item!.msg!.oldCon = item!.msg!.con;
      }

      item!.msg!.con = msg.con;
      if (nextMessage) {
        nextMessage.isDuplicated = false;
      }
    }

    // 引用的消息被撤回了
    if (item!.refer && item!.refer.msgid == messageId) {
      item!.refer.iswd = true;
    }
  });

  bottomUnread.forEach((item, index) => {
    if (item.id == messageId) {
      const nextMessage = bottomUnread[index + 1];
      item.iswd = true;
      item.msg!.con = msg.con;
      if (nextMessage) {
        nextMessage.isDuplicated = false;
      }
    }

    // 引用的消息被撤回了
    if (item.refer && item.refer.msgid == messageId) {
      item.refer.iswd = true;
    }
  });

  if (referMessage[id] && referMessage[id].id == messageId) {
    dispatch(removeReferMessage(id));
  }

  dispatch({
    type: 'UPDATE_BOTTOM_UNREAD_MESSAGE',
    id,
    message: bottomUnread,
  });
  dispatch({
    type: 'SET_MESSAGE',
    id,
    result: currentMessage,
  });
};

/**
 * 收到新消息
 * @param {*} message
 */
export const receiveMessage = (id: string, message: ChatNewMessageWire) => (dispatch: AppDispatch, getState: GetState) => {
  const { messages } = getState().chat;
  const currentMessage = messages[id];
  const unnecessary = _.findIndex(currentMessage, { id: message.id }) === -1 ? false : true;

  if (currentMessage && !unnecessary) {
    const prevMessage = currentMessage[currentMessage.length - 1];
    // 【三层合同（lead 2026-10-20）】入参是**原始 wire**（`ChatNewMessageWire`）；
    // `formatNewMessage` 会把同一对象就地改型并返回 `ChatMessage`，故用独立局部承接，
    // 后续读取与派发都用**归一化后**的类型，不再需要逐处 `as ChatMessage`。
    // 运行期仍是同一个对象引用，表达式求值顺序不变。
    const normalized = utils.formatNewMessage(message, prevMessage);
    if (
      prevMessage &&
      prevMessage.isMineMessage &&
      prevMessage.from === normalized.from &&
      _.get(prevMessage, 'msg.con') === _.get(normalized, 'msg.con')
    ) {
      return;
    }

    const isGroup = 'groupname' in normalized;
    const sessionId = isGroup ? normalized.to : normalized.isMine ? normalized.to : normalized.from;
    const bottom = $(`#ChatPanel-${sessionId}`).data('isBottom');
    const isBottom = bottom == undefined ? true : bottom;

    if (!normalized.isMine && !isBottom) {
      // 擦除式断言：`sessionId` 由 from/to 组成，此处与基线一样按字符串拼容器 id 使用。
      dispatch(addBottomUnreadMessage(sessionId as string, normalized));
      return;
    } else {
      setTimeout(() => {
        utils.scrollEnd(normalized.to as string, true);
      }, 100);
    }

    dispatch({
      type: 'ADD_MESSAGE',
      id,
      result: normalized,
    });
  }
};

/**
 * 系统消息
 * @param {*} message
 */
export const newNotifyMessage = (message: ChatNotifyMessageEvent) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession, sessionList } = getState().chat;
  const showBadge = [0, 1].includes(message.type) ? message.type + 1 : 0;

  switch (message.dtype) {
    case 0:
      message.id = 'post';
      message.type = Constant.SESSIONTYPE_POST;
      break;
    case 1:
      message.id = 'system';
      message.type = Constant.SESSIONTYPE_SYSTEM;
      break;
    case 2:
      message.id = 'calendar';
      message.type = Constant.SESSIONTYPE_CALENDAR;
      break;
    case 3:
      message.id = 'task';
      message.type = Constant.SESSIONTYPE_TASK;
      break;
    case 4:
      message.id = 'knowledge';
      message.type = Constant.SESSIONTYPE_KNOWLEDGE;
      break;
    case 5:
      message.id = 'hr';
      message.type = Constant.SESSIONTYPE_HR;
      break;
    case 6:
      message.id = 'worksheet';
      message.type = Constant.SESSIONTYPE_WORKSHEET;
      break;
    case 7:
      message.id = 'workflow';
      message.type = Constant.SESSIONTYPE_WORKFLOW;
      break;
    default:
      break;
  }

  if (message.name) {
    message.msg = `${message.name}: ${message.msg}`;
  }

  const result = sessionList.filter(item => item.value === message.id);

  if (result.length) {
    dispatch(
      updateSessionList({
        id: message.id,
        count: 1,
        time: utils.getCurrentTime(),
        msg: message.msg,
        isPush: !message.weak,
        weak: message.weak,
        showBadge: showBadge,
      }),
    );
    if (currentSession.value !== message.id) {
      dispatch(removeCurrentInbox(message.id));
    }
  } else {
    message.count = 1;
    dispatch(addSession(message));
  }

  if ('isSilent' in message ? (!message.isSilent || [1, 2].includes(showBadge)) && !message.weak : !message.weak) {
    utils.flashTitle();
    utils.playSystemNewMsgAudio();
  }
};

/**
 * 个人信息
 * @param {*} message
 */
export const newUserMessage = (message: ChatNewUserMessageEvent) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession, sessionList, isWindow } = getState().chat;
  const id = md.global.Account.accountId === message.from ? message.to : message.from;
  const isSelf = md.global.Account.accountId === message.from;
  const result = sessionList.filter(item => item.value === id);
  const isWindowSession = utils.chatWindow.is(id);

  if (isWindow && !result.length) {
    return;
  }

  if (result.length) {
    const name = isSelf ? _l('我') : message.uname;
    const count = isWindowSession ? 0 : currentSession.value === id || isSelf ? 0 : 1;
    dispatch(receiveMessage(id!, message));
    dispatch(
      updateSessionList({
        id,
        count,
        time: message.time,
        msg: `${name}: ${message.msg.con}`,
        msgId: message.id,
        isPush: true,
      }),
    );
    if (count) {
      utils.flashTitle();
      utils.playSessionNewMsgAudio();
      utils.sessionListScrollTop();
    }
  } else {
    // 如果是自己，打开多个页面需要消息同步
    if (isSelf) {
      dispatch(
        addUserSession(
          id!,
          {
            sysType: 0,
            msg: message.msg,
            from: message.from,
            to: message.to,
            id: message.id,
          },
          false,
        ),
      );
    } else {
      message.count = isWindowSession ? 0 : 1;
      message.isGroup = false;
      dispatch(addSession(message, id!));
      if (message.count) {
        utils.flashTitle();
        utils.playSessionNewMsgAudio();
        utils.sessionListScrollTop();
      }
    }
  }
};

/**
 * 个人抖动消息
 * @param {*} message
 */
export const userShake = (message: { aid: string }) => (dispatch: AppDispatch, getState: GetState) => {
  const addShakeMessage = () => {
    const { currentSession, messages } = getState().chat;

    if (currentSession.value === message.aid) {
      const currentMessages = messages[message.aid] || [];
      const sendMsg = {
        waitingid: utils.getUUID(),
        msg: _l('你收到了一个抖动'),
        sysType: Constant.MSGTYPE_SYSTEM_SUCCESS,
        touser: message.aid,
      };
      utils.shake(message.aid);
      socket.Contact.clearUnread({
        type: 1,
        value: message.aid,
      }).then(() => {
        dispatch(updateSessionList({ id: message.aid, clearCount: 0 }));
      });
      dispatch(addMessage(sendMsg, currentMessages[currentMessages.length - 1]));
      return;
    }
  };

  dispatch(
    addUserSession(message.aid, {}, true, () => {
      const { currentSessionList } = getState().chat;
      const session = currentSessionList.filter(item => item.id == message.aid)[0];

      if (session) {
        addShakeMessage();
      } else {
        setTimeout(addShakeMessage, 1000);
      }
    }),
  );
};

/**
 * 创建群组
 * @param {*} message
 */
/**
 * 新建群组事件。
 * 【有限声明依据】读取 `message.{id,logo,name,isPost,isPush}`、解构 `{ admins }`，
 * 并把这些字段组成 `addGroupSession` 的第二参（其类型为 `ChatRawMessageWire`）。
 */
export const newGroup = (message: {
  id: string;
  logo?: string | undefined;
  name?: string | undefined;
  isPost?: boolean | undefined;
  isPush?: boolean | undefined;
  admins?: Array<{ aid?: string | undefined; [key: string]: unknown }> | undefined;
}) => (dispatch: AppDispatch) => {
  const { admins } = message;
  const index = _.findIndex(admins, { aid: md.global.Account.accountId });
  const isSelf = index === -1 ? false : true;
  const s = !!$('#easyDialogBoxMDUpdater_container').length;
  // message.uCount 1 -> 群组
  // message.uCount 2 -> 聊天
  dispatch(
    addGroupSession(
      message.id,
      {
        to: message.id,
        avatar: message.logo,
        groupname: message.name,
        isPost: message.isPost,
        isPush: message.isPush,
        msg: { con: `${_l('我')}：${_l('群组创建成功')}` },
      },
      s ? false : isSelf,
    ),
  );
};

/**
 * 收到群组信息
 * @param {*} message
 */
export const newGroupMessage = (message: ChatGroupMessageEvent) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession, sessionList, isWindow } = getState().chat;
  const result = sessionList.filter(item => item.value === message.to);
  const isWindowSession = utils.chatWindow.is(message.to);

  // 全局聊天下，不是当前的聊天消息过来过滤掉
  if (isWindow && !result.length) {
    return;
  }

  if (result.length) {
    const isSelf = md.global.Account.accountId === message.from;
    const name = isSelf ? _l('我') : message.uname;
    const count = isWindowSession ? 0 : currentSession.value === message.to || isSelf ? 0 : 1;
    dispatch(receiveMessage(message.to, message));
    dispatch(
      updateSessionList({
        id: message.to,
        count: message.sysType ? 0 : count,
        time: message.time,
        msg: message.sysType ? message.msg.con : `${name}: ${message.msg.con}`,
        msgId: message.id,
        isPush: message.isPush,
        refer: currentSession.value === message.to ? null : message.refer,
      }),
    );
    if (message.isPush && count && !('sysType' in message)) {
      utils.flashTitle();
      utils.playSessionNewMsgAudio();
      utils.sessionListScrollTop();
    }
  } else {
    message.count = message.sysType ? 0 : isWindowSession ? 0 : 1;
    message.isGroup = true;
    message.isPush = message.sysType ? true : message.isPush;
    dispatch(addSession(message, message.to));
    if (message.isPush && message.count && !('sysType' in message)) {
      utils.flashTitle();
      utils.playSessionNewMsgAudio();
      utils.sessionListScrollTop();
    }
  }
};

/**
 * 收到群组 @ 消息
 * @param {*} message
 */
/**
 * 群组抖动事件。
 * 【有限声明依据】读取 `message.gid` 与 `msg.{msgid,time}`（`const { msg } = message`），
 * 且 `atlist.concat(msg.msgid)` 要求 `msgid` 是字符串。
 */
export const groupShake = (message: {
  gid: string;
  /** 也被读取：`atId !== message.id` 过滤 atlist */
  id?: string | undefined;
  msg: { msgid: string; time?: number | string | undefined };
}) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession, sessionList } = getState().chat;
  const session = sessionList.filter(item => item.value === message.gid)[0];
  const isWindowSession = utils.chatWindow.is(message.gid);
  const { msg } = message;

  if (currentSession.value === message.gid) {
    utils.shake(message.gid);
  } else {
    // 【擦除标记】`session` 来自 `filter(...)[0]`，类型上可为 undefined。
    // 非空断言擦除（零运行时），原 `session.atlist` 读取不变，缺项由**原生**报错。
    const atlist = session!.atlist ? session!.atlist.filter((atId: string) => atId !== message.id) : [];
    const listMsg = {
      id: message.gid,
      atlist: isWindowSession ? [] : atlist.concat(msg.msgid),
      at_msg: {
        time: msg.time,
        message_id: msg.msgid,
        msgid: msg.msgid,
      },
    };
    dispatch(updateSessionList(listMsg));
  }
};

/**
 * 收到群组撤回消息
 * @param {*} message
 */
export const newWithdrawGroupMessage = (message: { gid: string; id?: string | number | undefined; msg: { con?: string | undefined } }) => (dispatch: AppDispatch, getState: GetState) => {
  const { sessionList } = getState().chat;
  const session = sessionList.filter(item => item.value === message.gid)[0];
  dispatch(updateWithdrawMessage(message.gid, message));
  dispatch(
    updateSessionList({
      id: message.gid,
      addMsg: message.msg.con,
    }),
  );

  if (session && session.atlist) {
    const atlist = session.atlist.filter((atId: string) => atId !== message.id);
    dispatch(
      updateSessionList({
        id: message.gid,
        atlist,
        isWithdraw: true,
      }),
    );
  }

  if (session && session.refer) {
    dispatch(
      updateSessionList({
        id: message.gid,
        refer: null,
        isWithdraw: true,
      }),
    );
  }

  if (session && session.reflist) {
    dispatch(
      updateSessionList({
        id: message.gid,
        reflist: [],
        isWithdraw: true,
      }),
    );
  }
};

/**
 * 设置引用消息
 * @param {*} id
 * @param {*} message
 */
/**
 * 设置引用消息。
 * 【有限声明依据】唯一调用点 `Message` 组件里传的是组件 props 的 `message`，
 * 即当前列表里的一条 `ChatMessage`；与 `ChatAction` 里 `SET_REFER_MESSAGE.message` 同型。
 */
export const setReferMessage = (id: string, message: ChatMessage) => {
  return {
    type: 'SET_REFER_MESSAGE',
    id,
    message,
  } satisfies ChatAction;
};

/**
 * 添加未读消息
 * @param {*} id
 * @param {*} message
 */
/**
 * 追加一条"底部未读"消息。
 * 【有限声明依据】`message` 被直接作为 `ADD_BOTTOM_UNREAD_MESSAGE.message` 与
 * `SET_BOTTOM_UNREAD_MESSAGE.message` 的载荷派发，二者在 `ChatAction` 里都是 `ChatMessage`。
 */
export const addBottomUnreadMessage = (id: string, message: ChatMessage) => (dispatch: AppDispatch, getState: GetState) => {
  const { bottomUnreadMessage } = getState().chat;
  const currentMessage = bottomUnreadMessage[id];

  if (currentMessage) {
    dispatch({
      type: 'ADD_BOTTOM_UNREAD_MESSAGE',
      id,
      message,
    });
  } else {
    dispatch({
      type: 'SET_BOTTOM_UNREAD_MESSAGE',
      id,
      message,
    });
  }
};

export const removeBottomUnreadMessage = (id: string) => {
  return {
    type: 'REMOVE_BOTTOM_UNREAD_MESSAGE',
    id,
  } satisfies ChatAction;
};

/**
 * 删除引用消息
 * @param {*} id
 */
export const removeReferMessage = (id: string) => {
  return {
    type: 'REMOVE_REFER_MESSAGE',
    id,
  } satisfies ChatAction;
};

/**
 * 设置需要滚动到指定的消息
 * @param {*} id
 * @param {*} messageId
 */
export const setGotoMessage = (id: string | undefined, messageId: ChatMessage['id']) => {
  return {
    type: 'SET_GOTO_MESSAGE',
    id,
    messageId,
  } satisfies ChatAction;
};

/**
 * 删除指定的消息
 * @param {*} id
 */
export const removeGotoMessage = (id: string | undefined) => {
  return {
    type: 'REMOVE_GOTO_MESSAGE',
    id,
  } satisfies ChatAction;
};

/**
 * 更新是否在标签页聊天的状态
 * @param {*} isWindow
 */
export const setIsWindow = (isWindow: boolean) => {
  return {
    type: 'UPDATE_IS_WINDOW',
    result: isWindow,
  } satisfies ChatAction;
};

/**
 * 更新通讯录的显示
 * @param {*} isShowAddressBook
 */
export const setShowAddressBook = (isShowAddressBook: boolean) => (dispatch: AppDispatch) => {
  dispatch({
    type: 'UPDATE_SHOW_ADD_RESSBOOK',
    result: isShowAddressBook,
  });
};

/**
 * 重连后重置聊天状态
 */
export const refresh = () => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSession, currentInboxList, currentSessionList } = getState().chat;
  const { id } = currentSession;
  ajax
    .chatSessionList({
      pageIndex: 1,
      pageSize: 30,
    })
    .then((res: ChatRawSessionWire[]) => {
      if (id) {
        res.forEach(item => {
          if (item && item.value == id) {
            item.count = 0;
          }
        });
        dispatch(setSessionList(res));
        currentInboxList.forEach(inbox => {
          if (inbox.id !== id) {
            dispatch(removeCurrentInbox(inbox.id));
          }
        });
        const newCurrentSessionList = currentSessionList.filter(item => item.id === id)[0];

        if (!newCurrentSessionList) {
          return;
        }

        const { isGroup } = newCurrentSessionList;
        ajax
          .getMessage({
            id,
            type: isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER,
          })!
          // `getMessage` 在未匹配的 `conf.type` 下返回 undefined（既有行为），
          // 原实现在该情形下 `.then` 会**抛 TypeError**。为**不改变运行行为**，
          // 这里用非空断言擦除类型可空（零运行时），保持原 `.then` 调用与失败路径。
          .then(res => {
            res = _.isArray(res) ? res.reverse() : [];
            const newMessages = {
              [id]: utils.formatMessages(res),
            };
            dispatch({
              type: 'UPDATE_CURRENT_SESSION',
              result: [newCurrentSessionList],
            });
            dispatch({
              type: 'UPDATE_MESSAGE',
              result: newMessages,
            });
          });
      } else {
        dispatch(setSessionList(res));
        dispatch({
          type: 'UPDATE_CURRENT_SESSION',
          result: [],
        });
        dispatch({
          type: 'SET_CURRENT_SESSION',
          result: {},
        });
        dispatch({
          type: 'UPDATE_MESSAGE',
          result: {},
        });
        dispatch({
          type: 'REMOVE_ALL_INBOX_SESSION',
        });
      }
    });
};

/**
 * 发送设置免打扰
 * @param {*} message
 */
/**
 * 发送免打扰设置请求。
 * 【有限声明依据】两个调用点（`inboxHeader`、`SessionList`）传的都是
 * `{ type, AccountID, isSilent }` —— **与 `setSlience`（入站事件）形状不同**，
 * 不要合并成一个类型。
 */
export const sendSetSlience = (message: { type?: number | undefined; AccountID?: string | undefined; isSilent: boolean }) => () => {
  socket.Contact.setSlience(message);
};

/**
 * 设置免打扰
 * @param {*} message
 */
export const setSlience = (message: { value: string; isSilent?: boolean | undefined; showBadge?: number | boolean | undefined }) => (dispatch: AppDispatch, getState: GetState) => {
  const { currentSessionList, sessionList, currentSession } = getState().chat;
  const isSilent = message.isSilent ? message.isSilent : false;
  const showBadge = message.showBadge ? message.showBadge : 0;

  const newCurrentSessionList = currentSessionList.map(item => {
    if (item.value === message.value) {
      item.isSilent = isSilent;
      item.showBadge = showBadge;
    }

    return item;
  });
  const newSessionList = sessionList.map(item => {
    if (item.value === message.value) {
      item.isSilent = isSilent;
      item.showBadge = showBadge;
    }

    return item;
  });
  dispatch({
    type: 'UPDATE_CURRENT_SESSION',
    result: newCurrentSessionList,
  });
  dispatch({
    type: 'UPDATE_SESSION_LIST',
    result: newSessionList,
  });
  if (message.value === currentSession.value) {
    let _current = newSessionList.find(l => l.value === message.value);
    dispatch(setNewCurrentSession(_current));
  }
};

/**
 * 更新 socket 状态
 * @param {*} state
 */
export const setSocketState = (state: number) => {
  return {
    type: 'UPDATE_SOCKET_STATE',
    result: state,
  } satisfies ChatAction;
};

/**
 * 更新 toolbarConfig 配置
 * @param {*} config
 */
/**
 * 局部更新 toolbar 配置。
 * 【有限声明依据】真实调用点传的都是**部分配置**：
 * `Apps` 的 `index.tsx` 里 `{ hideOpenCommonApp: ... }`、
 * `SettingDrawer` 的 `index.tsx` 里账号设置补丁（`{ ...values, ...param }` 形态）。
 * 与 `ChatAction` 里 `SET_TOOLBAR_CONFIG.result` 的 `Partial<ChatToolbarConfig>` 同型。
 */
export const setToolbarConfig = (config: Partial<ChatToolbarConfig>) => {
  return {
    type: 'SET_TOOLBAR_CONFIG',
    result: config,
  } satisfies ChatAction;
};
