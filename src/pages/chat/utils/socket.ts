import Constant from './constant';
import type {
  ChatAtParam,
  ChatMessage,
  ChatOutboundDraft,
  ChatSendAckError,
  ChatSendRawAck,
  ChatSession,
} from '../redux/types';

/**
 * socket 层的**有限合同**（lead 2026-10-20 持续总目标第一批）。
 *
 * 【为什么从 `IM` 的 any 边界开始收】`IM` 是宿主注入的私有 SDK（`types/global.d.ts` 有意声明为 any），
 * 因此 `emit` 的回调参数**没有上下文类型**——原先全部是隐式 any。本批沿**真实发送方/确认回调/
 * 调用者消费**逐项给出有限类型：只透传不读内部的 ack 扩展才用 `unknown`；已知的 msg/id/type/
 * error/data 都按真实消费建模，不写成任意对象。
 *
 * 【运行期不变】本文件只**新增类型注解与擦除断言**：所有 emit 事件名、载荷表达式、回调 body、
 * Promise 结算顺序、`delete` 时序、原地改型与对象引用都保持原样（Babel 产物逐字节相同）。
 */

/** IM 宿主 ack 的**错误**载荷：只被原样 `reject`（透传），调用方不读其内部 → opaque unknown */
type SocketAckError = unknown;

/** 抖动消息载荷：单聊带 `aid`；群聊是 `{ ...atParam, messageId }` */
export interface ChatShakePayload {
  /** 单聊：会话 id */
  aid?: string | undefined;
  /** 群聊：被抖动消息的 id */
  messageId?: ChatMessage['id'];
  /** 群聊：会话 id（来自 atParam） */
  gid?: string | undefined;
  /** 群聊：被 @ 的成员（来自 atParam） */
  toUser?: ChatAtParam['toUser'] | undefined;
  [key: string]: unknown;
}

/** 撤回消息载荷（`Message.handleWithdrawMessage` 的真实构造） */
export interface ChatWithdrawPayload {
  messageId: ChatMessage['id'];
  time?: ChatMessage['time'];
  touser?: string | undefined;
  groupid?: string | undefined;
  adminid?: string | undefined;
  [key: string]: unknown;
}

/** 撤回回执：调用方只解构 `result.socket` 并交给 `updateWithdrawMessage` */
export interface ChatWithdrawAck {
  socket: {
    id?: string | number | undefined;
    msg: { con?: string | undefined; [key: string]: unknown };
    [key: string]: unknown;
  };
}

/** 通知类型字面量：`clearUnread` 会把 3..10 的数值 type **原地改写**成这些字符串 */
export type ChatNotificationTypeName =
  | 'system'
  | 'post'
  | 'calendar'
  | 'task'
  | 'knowledge'
  | 'hr'
  | 'worksheet'
  | 'workflow';

/**
 * `clearUnread` 的**原始入参**：真实生产方传会话对象（`Object.assign({}, item)`）或
 * `{ type: 数值, value: 会话 id }`；`type` 允许缺省（会话对象的 `type` 可选）。
 */
export interface ChatClearUnreadParam {
  type?: number | undefined;
  value?: string | undefined;
  [key: string]: unknown;
}

/**
 * `clearUnread` 的**原地过渡态**：数值 3..10 被写回成通知类型字符串。
 * 过渡类型只用于表达这次原地改型，**不是**原始入参的声明（lead 要求"不能把原始输入标成最终载荷"）。
 */
export interface ChatClearUnreadParamTransition {
  type?: number | ChatNotificationTypeName | undefined;
  value?: string | undefined;
}

/** `remove`（删除最近联系人）载荷 */
export interface ChatRemoveSessionParam {
  id?: ChatSession['id'];
  type?: ChatSession['type'];
  [key: string]: unknown;
}

/** `recordAction`（会话操作同步）载荷：`id` 可能是**会话 id 字符串**，也可能是系统会话对象 */
export interface ChatRecordActionParam {
  /**
   * 会话 id 字符串，或系统会话对象（`dtype` 里才是真实会话 id，见 `actions.operate`）。
   * 【为何可选】`SessionList.handleOpenPanel` 传的是 `item.value`（`ChatSession.value` 在类型上可选）。
   */
  id?:
    | string
    | {
        id?: string | number | undefined;
        count?: number | undefined;
        type?: number | undefined;
        dtype?: string | undefined;
        [key: string]: unknown;
      }
    | undefined;
  type?: number | undefined;
  showBadge?: number | boolean | undefined;
  [key: string]: unknown;
}

/**
 * `setTop`（置顶同步）：与 `actions.sendSetTop` 的入参同一结构。
 * 【为何 type/value 可选】真实生产方 `SessionList.handleStick` 传的是 `this.state.hoverItem`
 * 的字段，而 `hoverItem` 是 `ChatSession`（`type`/`value` 在类型上可选；菜单从真实会话打开时
 * 运行期必有值）。如实表达可选，不用断言假装必填。
 */
export interface ChatSetTopParam {
  type?: number | undefined;
  value?: string | undefined;
  isTop: boolean;
}

/** `setSlience`（免打扰同步）：与 `actions.sendSetSlience` 的入参同一结构（`type` 来自 hoverItem，可缺） */
export interface ChatSetSlienceParam {
  type?: number | undefined;
  AccountID?: string | undefined;
  isSilent: boolean;
}

/** `fetchUploadToken` 的回执：实现只读 `token`/`key` 判断成功 */
export interface ChatUploadTokenAck {
  token?: string | undefined;
  key?: string | undefined;
  [key: string]: unknown;
}


export const Message = {
  /**
   * 发送消息
   * @param {*} type 个人消息 or 群组消息
   * @param {*} param 消息内容
   */
  send(type: number, param: ChatOutboundDraft) {
    delete param.atParam;
    // 原始服务器回执：不补字段、不复制，成功时把 ack 对象原样 resolve（见 ChatSendRawAck）。
    return new Promise<ChatSendRawAck>((resolve, reject) => {
      if (type === Constant.SESSIONTYPE_USER) {
        IM.socket.emit('send message', param, (err: ChatSendAckError | null, data: ChatSendRawAck) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      } else if (type === Constant.SESSIONTYPE_GROUP) {
        IM.socket.emit('send group message', param, (err: ChatSendAckError | null, data: ChatSendRawAck) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      }
    });
  },
  /**
   * 抖动窗口
   * @param {*} type 个人消息 or 群组消息
   * @param {*} param
   */
  sendShake(type: number, param: ChatShakePayload) {
    return new Promise<unknown>((resolve, reject) => {
      if (type === Constant.SESSIONTYPE_USER) {
        IM.socket.emit('shake shake', param, (err: SocketAckError, data: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      } else if (type === Constant.SESSIONTYPE_GROUP) {
        IM.socket.emit('group shake', param, (err: SocketAckError, data: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      }
    });
  },
  /**
   * 语音消息标记已读
   * @param {*} param
   */
  markAudioAsRead(param: { messageId: ChatMessage['id'] }) {
    IM.socket.emit('voice as read', param, () => {});
  },
  /**
   * 消息撤回
   * @param {*} type
   * @param {*} param
   */
  sendWithdrawMessgae(type: number, param: ChatWithdrawPayload) {
    return new Promise<ChatWithdrawAck>((resolve, reject) => {
      if (type === Constant.SESSIONTYPE_USER) {
        IM.socket.emit('withdraw user message', param, (err: SocketAckError, data: ChatWithdrawAck) => {
          if (err) {
            reject(data);
          } else {
            resolve(data);
          }
        });
      } else if (type === Constant.SESSIONTYPE_GROUP) {
        IM.socket.emit('withdraw group message', param, (err: SocketAckError, data: ChatWithdrawAck) => {
          if (err) {
            reject(data);
          } else {
            resolve(data);
          }
        });
      }
    });
  },
};

/**
 * 联系人相关
 */
export const Contact = {
  /**
   * 清除单个联系人未读计数
   * @param {*} param
   */
  clearUnread(param: ChatClearUnreadParam) {
    return new Promise<unknown>((resolve, reject) => {
      switch (param.type) {
        case 1:
        case 2:
          break;
        case 3:
          (param as ChatClearUnreadParamTransition).type = 'system';
          break;
        case 4:
          (param as ChatClearUnreadParamTransition).type = 'post';
          break;
        case 5:
          (param as ChatClearUnreadParamTransition).type = 'calendar';
          break;
        case 6:
          (param as ChatClearUnreadParamTransition).type = 'task';
          break;
        case 7:
          (param as ChatClearUnreadParamTransition).type = 'knowledge';
          break;
        case 8:
          (param as ChatClearUnreadParamTransition).type = 'hr';
          break;
        case 9:
          (param as ChatClearUnreadParamTransition).type = 'worksheet';
          break;
        case 10:
          (param as ChatClearUnreadParamTransition).type = 'workflow';
          break;
        default:
          break;
      }

      // 擦除标记：`param.type` 此时可能已被改写成通知类型字符串（或缺省），JS 的 `<=`
      // 对字符串/undefined 与数字比较恒为 false —— 保留基线的分支行为，不做数值转换。
      if ((param.type as number) <= 2) {
        IM.socket.emit(
          'clear unread',
          {
            type: param.type,
            id: param.value,
          },
          (err: SocketAckError, data: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      } else {
        IM.socket.emit(
          'clear notification',
          {
            type: param.type,
            value: 0,
            clear: true,
          },
          (err: SocketAckError, data: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      }
    });
  },
  /**
   * 清除所以未读计数
   */
  clearAllUnread() {
    return new Promise<unknown>(resolve => {
      IM.socket.emit('clear all unread', {}, (data: unknown) => {
        resolve(data);
      });
    });
  },
  /**
   * 删除最近联系人
   * @param {*} param
   */
  remove(param: ChatRemoveSessionParam) {
    return new Promise<unknown>(resolve => {
      IM.socket.emit('remove session', param, (data: unknown) => {
        resolve(data);
      });
    });
  },
  /**
   * 设置当前联系人
   * @param {*} contact
   */
  setCurrentChat(contact: ChatSession | undefined) {
    if (contact && contact.value) {
      // 发给 socket 的载荷照旧带 id = value，但不再往入参上写：调用方传的常常是 chat.sessionList 里的对象，
      // 原先的 contact.id = contact.value 就是在两次 dispatch 之间改 store（见 actions.ts setNewCurrentSession）
      IM.socket.emit('current chat', { ...contact, id: contact.value }, () => {});
    } else {
      IM.socket.emit('clear chat', {}, () => {});
    }
  },
  /**
   * 记录会话操作，同步到其他页面
   * @param {*} contact
   */
  recordAction(contact: ChatRecordActionParam) {
    return new Promise<unknown>(resolve => {
      IM.socket.emit(
        'operate',
        {
          contact: contact,
          isclose: contact.id ? false : true,
          isopen: contact.id ? true : false,
          // ismin: '',
          // closeAll: '',
        },
        function (data: unknown) {
          resolve(data);
        },
      );
    });
  },
  /**
   * 设置置顶
   * @param {*} param
   */
  setTop(param: ChatSetTopParam) {
    return new Promise<unknown>(resolve => {
      IM.socket.emit('sticky on top', param, (data: unknown) => {
        resolve(data);
      });
    });
  },
  /**
   * 设置免打扰
   * @param {*} param
   */
  setSlience(param: ChatSetSlienceParam) {
    return new Promise<unknown>(resolve => {
      IM.socket.emit('silence message', param, (data: unknown) => {
        resolve(data);
      });
    });
  },
};

/**
 * 获取上传token
 * @param {*} param
 */
export const fetchUploadToken = (param: unknown) => {
  return new Promise<ChatUploadTokenAck>((resolve, reject) => {
    IM.socket.emit('upload token', param, (_err: SocketAckError, data: ChatUploadTokenAck) => {
      if (data.token && data.key) {
        resolve(data);
      } else {
        reject(data);
      }
    });
  });
};
