import sessionNewMsgAudio from 'src/pages/chat/lib/mp3player/sessionNewMsgAudio.html';
import systemNewMsgAudio from 'src/pages/chat/lib/mp3player/systemNewMsgAudio.html';
import { navigateToLogin } from 'src/router/navigateTo';
import { getPssId } from 'src/utils/pssId';
import * as actions from '../redux/actions';
import { removeFlashTitle } from './index';
import type { AppDispatch } from 'src/redux/types';
import type { ChatGroupMessageEvent, ChatNewUserMessageEvent, ChatNotifyMessageEvent } from '../redux/types';

/** 这些函数都是在聊天组件（ChatList / ChatWindow）里用 xxx.call(this) 调的，
 *  this 就是那个 React 组件实例。整个文件只从它身上取了 props.dispatch。 */
type SocketEventHost = { props: { dispatch: AppDispatch } };

/**
 * 事件里与 action **真实入参同源**的字段类型：直接从 action 的参数元组取，不复制第二份真相。
 * （多实参 action 的事件载荷只在这些字段上派生，其余字段见下方各事件的读数依据。）
 */
type MemberGroupId = Parameters<typeof actions.updateMember>[0];
type InviteGroupId = Parameters<typeof actions.updateForbIdInvite>[0];
type AdminGroupId = Parameters<typeof actions.updateAdmin>[0];
type PushNoticeGroupId = Parameters<typeof actions.updateGroupPushNotice>[0];
type PushNoticeFlag = Parameters<typeof actions.updateGroupPushNotice>[1];

/**
 * `logout message`：handler 只读 `sessionId`，与 `getPssId() || ''`（`string | null`）比较相等。
 * 【为什么可选】没有 wire/后端证据证明该字段必在，原实现也只读这一个字段；
 * 按"如实允许缺项"声明，不硬签必填。
 */
export interface LogoutMessageEvent {
  sessionId?: string | undefined;
}

/**
 * `group member added`：handler 读 `id` 与 `users.length`，只把**长度**交给
 * `updateMember(groupId, count)` 作成员数增量。
 * 【元素形状不认】成员对象从不被读取，故按 opaque `unknown` 保留，不假签成某个成员 DTO。
 * 【形态证据】`containers/ChatWindow/chatWindow.spec.ts` 里真实 handler 夹具传 `{ id, users: ['a','b'] }`，
 * 且增量算法（原 3 → 5）只在 `length` 上成立。
 */
export interface GroupMemberAddedEvent {
  id: MemberGroupId;
  users: unknown[];
}

/** `group member removed`：只读 `id`，增量固定 -1 交给 `updateMember`。 */
export interface GroupMemberRemovedEvent {
  id: MemberGroupId;
}

/**
 * `can add member`：读 `gid`/`can`，交给 `updateForbIdInvite(gid, !can)`。
 * 【`can` 为什么是 opaque `unknown`】全仓唯一的消费形态就是 `!can`（真值取反），
 * 没有任何 wire/后端证据证明它是布尔：`can: 0`/`''`/对象与 `can: false` 在这里**行为不同**
 * （前者取反为 true），所以把它签成 `boolean` 等于替服务端保证它不会送其它真值。
 * 声明成 `unknown` 后 `!can` 的语义、编译结果与原表达式完全一致，且不会把真值域认证掉。
 */
export interface CanAddMemberEvent {
  gid: InviteGroupId;
  /** 只被 `!can` 消费的真值角色；wire 布尔域无证据，故不认证为 boolean。 */
  can: unknown;
}

/** `group admin added`：读 `gid` 与被添加成员 id，和本人 `md.global.Account.accountId`（string）比较。 */
export interface GroupAdminAddedEvent {
  gid: AdminGroupId;
  addAid: string;
}

/** `group admin removed`：同上，被移除成员 id。 */
export interface GroupAdminRemovedEvent {
  gid: AdminGroupId;
  removedAid: string;
}

/**
 * `set group notice`：读 `gid`/`isPush`，交给 `updateGroupPushNotice(groupId, isPushNotice)`，
 * 并按 `isPush` 决定弹"关闭/开启免打扰"哪一个。两个字段类型直接取该 action 的入参元组。
 * 【为什么两个都是可选】action 本身接受 `string | undefined` / `boolean | undefined`，
 * 而事件是否**必有**这两个键没有 wire 证据 —— 按"未证不硬签必填"保留可选
 * （值为 `undefined` 时走 alert 的 else 分支，与原实现一致）。
 */
export interface SetGroupNoticeEvent {
  gid?: PushNoticeGroupId;
  isPush?: PushNoticeFlag;
}

/**
 * `error`：socket.io 客户端错误对象，handler 只读 `code` 与 `'parser error'` 比较。
 * 【为什么 `null` / `undefined` 都在域里】原实现先判 `error &&`（对 null 与 undefined 都成立）；
 * 本仓没有 socket.io-client 的真实类型（`types/socket.io-client.d.ts` 是本地桩、`IM` 是宿主的 `any`），
 * 无证据证明该回调必有对象，故不把假值从域里删掉。详见 `ChatSocketInboundPayloads['error']` 的说明。
 */
export interface SocketErrorEvent {
  code?: string | undefined;
}

/**
 * 本文件订阅的**全部入站事件 → 载荷类型**（23 个，逐条对应下面 `IM.socket.on(...)` 的注解放）。
 *
 * 直通事件的载荷**就是** action 自己的入参 `Parameters<typeof actions.X>[0]`，不是手抄的"相似形状"：
 * 只要有人把它抄成第二份真相，extern 探针里的
 * `Equal<ChatSocketInboundPayloads['x'], Parameters<typeof actions.x>[0]>` 就会失败
 * （这是可被公开验证的反漂移锚点，不是同名同义的自我声明）。
 * `IM` 是 `any` 宿主 SDK，但本表每一项都是有限对象/有限联合，没有任何一项退化成 `any`。
 */
export interface ChatSocketInboundPayloads {
  'logout message': LogoutMessageEvent;
  'new group': Parameters<typeof actions.newGroup>[0];
  'new group message': ChatGroupMessageEvent;
  'group shake': Parameters<typeof actions.groupShake>[0];
  'group member added': GroupMemberAddedEvent;
  'group member removed': GroupMemberRemovedEvent;
  'removed from group': Parameters<typeof actions.removedFromGroup>[0];
  'can add member': CanAddMemberEvent;
  'group admin added': GroupAdminAddedEvent;
  'group admin removed': GroupAdminRemovedEvent;
  'new withdraw groupmessage': Parameters<typeof actions.newWithdrawGroupMessage>[0];
  'set group notice': SetGroupNoticeEvent;
  'new message': ChatNewUserMessageEvent;
  'shake shake': Parameters<typeof actions.userShake>[0];
  /**
   * `new withdraw usermessage`：撤回事件带完整消息体，与 `new message` 同用唯一模型
   * `ChatNewUserMessageEvent`（`from` 是字符串、`msg` 是对象）。handler 额外读 `to` 算会话 id；
   * 该字段在该模型里已是 `string | undefined`（无 wire 证据证明必在），不另立"必须有 to"的交叉类型。
   */
  'new withdraw usermessage': ChatNewUserMessageEvent;
  'new notify': ChatNotifyMessageEvent;
  /**
   * socket.io 客户端错误对象，handler 只读 `code`。
   * 【为什么 `null | undefined` 都留】原实现先判 `error &&`，说明作者见过/预期假值；
   * 本仓 `IM` 是宿主 SDK（node_modules 里没有 socket.io-client，`types/socket.io-client.d.ts` 只是本地桩），
   * 没有 SDK 层证据能证明该回调**必有**对象，因此不把 `undefined` 从域里删掉
   * （删掉不是守卫，是替宿主签字）。
   */
  'error': SocketErrorEvent | null | undefined;
  'session removed': Parameters<typeof actions.sessionRemoved>[0];
  'clear unread': Parameters<typeof actions.clearUnread>[0];
  'clear notification': Parameters<typeof actions.clearNotification>[0];
  'operate': Parameters<typeof actions.operate>[0];
  'new sticky on top': Parameters<typeof actions.setTop>[0];
  'new silence message': Parameters<typeof actions.setSlience>[0];
}

/** 别名只为让每处注解读起来是"事件名"，唯一真相仍在上面那张表。 */
type InboundPayload<K extends keyof ChatSocketInboundPayloads> = ChatSocketInboundPayloads[K];

export const socketInitEvent = function (this: SocketEventHost) {
  $(sessionNewMsgAudio).appendTo('html > body');
  $(systemNewMsgAudio).appendTo('html > body');

  stateInit.call(this);

  userInit.call(this);

  groupInit.call(this);

  notifyInit.call(this);

  sync.call(this);

  IM.socket.on('logout message', ({ sessionId }: InboundPayload<'logout message'>) => {
    if ((getPssId() || '') === sessionId) {
      setTimeout(() => {
        if (!window.currentLeave) {
          navigateToLogin({ needSecondCheck: true });
        }
      }, 200);
    }
  });
};

export const groupInit = function (this: SocketEventHost) {
  // 创建群组
  IM.socket.on('new group', (message: InboundPayload<'new group'>) => {
    this.props.dispatch(actions.newGroup(message));
  });

  // 新的群组信息
  IM.socket.on('new group message', (message: InboundPayload<'new group message'>) => {
    this.props.dispatch(actions.newGroupMessage(message));
  });

  // 群组收到 @ 消息
  IM.socket.on('group shake', (message: InboundPayload<'group shake'>) => {
    this.props.dispatch(actions.groupShake(message));
  });

  // 添加群组成员
  IM.socket.on('group member added', (data: InboundPayload<'group member added'>) => {
    const { id, users } = data;
    this.props.dispatch(actions.updateMember(id, users.length));
  });

  // 群组成员被移除
  IM.socket.on('group member removed', (data: InboundPayload<'group member removed'>) => {
    const { id } = data;
    this.props.dispatch(actions.updateMember(id, -1));
  });

  // 自己被移除出群组 或者是关闭群组 解散群组
  IM.socket.on('removed from group', (data: InboundPayload<'removed from group'>) => {
    this.props.dispatch(actions.removedFromGroup(data));
  });

  // 仅允许群主及管理员邀请新成员
  IM.socket.on('can add member', (data: InboundPayload<'can add member'>) => {
    const { gid, can } = data;
    this.props.dispatch(actions.updateForbIdInvite(gid, !can));
  });

  // 群组添加管理
  IM.socket.on('group admin added', (data: InboundPayload<'group admin added'>) => {
    const { gid, addAid } = data;
    const { accountId } = md.global.Account;

    if (accountId === addAid) {
      this.props.dispatch(actions.updateAdmin(gid, true));
    }
  });

  // 群组移除管理
  IM.socket.on('group admin removed', (data: InboundPayload<'group admin removed'>) => {
    const { gid, removedAid } = data;
    const { accountId } = md.global.Account;

    if (accountId === removedAid) {
      this.props.dispatch(actions.updateAdmin(gid, false));
    }
  });

  // 收到群组撤回的消息
  IM.socket.on('new withdraw groupmessage', (message: InboundPayload<'new withdraw groupmessage'>) => {
    this.props.dispatch(actions.newWithdrawGroupMessage(message));
  });

  // 同步设置群组消息免打扰
  IM.socket.on('set group notice', (message: InboundPayload<'set group notice'>) => {
    const { isPush, gid } = message;
    this.props.dispatch(actions.updateGroupPushNotice(gid, isPush));
    isPush ? alert(_l('已关闭消息免打扰')) : alert(_l('已开启消息免打扰'));
  });
};

export const userInit = function (this: SocketEventHost) {
  // 新的个人信息
  IM.socket.on('new message', (message: InboundPayload<'new message'>) => {
    this.props.dispatch(actions.newUserMessage(message));
  });

  // 个人收到抖动消息
  IM.socket.on('shake shake', (message: InboundPayload<'shake shake'>) => {
    this.props.dispatch(actions.userShake(message));
  });

  // 收到个人撤回消息
  IM.socket.on('new withdraw usermessage', (message: InboundPayload<'new withdraw usermessage'>) => {
    const id = md.global.Account.accountId === message.from ? message.to : message.from;
    this.props.dispatch(actions.updateWithdrawMessage(id, message));
    this.props.dispatch(
      actions.updateSessionList({
        id,
        addMsg: message.msg.con,
      }),
    );
  });
};

export const notifyInit = function (this: SocketEventHost) {
  // 新的系统消息
  IM.socket.on('new notify', (message: InboundPayload<'new notify'>) => {
    this.props.dispatch(actions.newNotifyMessage(message));
  });
};

export const stateInit = function (this: SocketEventHost) {
  const reconnectDelayTime = 10000;
  let disconnectTime = 0;
  let isOpen = true;
  let reconnectCount = 1;

  const reconnectFn = () => {
    this.props.dispatch(actions.setSocketState(0));
    IM.socket.off('reconnect', reconnectFn);
    IM.socket.off('reconnect_failed', reconnectFailedFn);
  };

  const reconnectFailedFn = () => {
    this.props.dispatch(actions.setSocketState(2));
    IM.socket.off('reconnect', reconnectFn);
    IM.socket.off('reconnect_failed', reconnectFailedFn);
  };

  const notificationInit = () => {
    this.props.dispatch(actions.setSocketState(1));
    IM.socket.on('reconnect', reconnectFn);
    IM.socket.on('reconnect_failed', reconnectFailedFn);
  };

  /**
   * 断线重连定时器句柄（**保持原声明与原调用**）。
   * 【存量债务】终点配置下 `clearTimeout` 的合并重载里没有接受 `null` 的一支
   * （实报：Argument of type 'Timeout | null' is not assignable to parameter of type 'number | undefined'），
   * 所以 `clearTimeout(reconnectTime)` 仍是本文件唯一剩下的一条 TS2769。
   * 这是全仓同类真实存量：baseline 里同一条报错共 69 处，已接收的
   * `FormExtend/PublicWorksheetConfig/CountDown.tsx` 就是按同一口径保全的（保留 null sentinel + 原调用）。
   * 去掉它必须先决定"没有活定时器"用 null 还是 undefined 表达（改 sentinel / 加 guard / 断言
   * 都会动运行时行为或擦类型），属行为决定，不在本类型切片内。
   */
  let reconnectTime: NodeJS.Timeout | null = null;

  window.addEventListener('online', () => {
    if (!IM.socket.connected) {
      IM.socket.connect();
    }
  });

  IM.socket.on('error', (error: InboundPayload<'error'>) => {
    if (error && error.code === 'parser error') {
      return;
    }

    if (isOpen) {
      isOpen = false;
      notificationInit();
    }
  });

  IM.socket.on('disconnect', () => {
    disconnectTime = Date.now();
    reconnectTime = setTimeout(() => {
      if (isOpen) {
        isOpen = false;
        notificationInit();
      }

      removeFlashTitle('', []);
    }, reconnectDelayTime);
  });

  IM.socket.on('reconnecting', () => {
    if (reconnectCount <= 1) {
      reconnectCount++;
    }

    this.props.dispatch(actions.setSocketState(navigator.onLine ? 1 : 2));

    if (window.localStorage.getItem('websocket') == 'polling') {
      IM.socket.io.opts.transports = ['polling'];
    }
  });

  IM.socket.on('reconnect', () => {
    if (Date.now() - disconnectTime < reconnectDelayTime) {
      clearTimeout(reconnectTime);
    }

    if (reconnectCount > 1) {
      isOpen = true;
      this.props.dispatch(actions.refresh());
    }

    this.props.dispatch(actions.setSocketState(0));
  });
};

export const sync = function (this: SocketEventHost) {
  // 清除单个会话 其他页面接收到推送
  IM.socket.on('session removed', (message: InboundPayload<'session removed'>) => {
    this.props.dispatch(actions.sessionRemoved(message));
  });

  // 清除会话（个人和群组）的未读消息计数
  IM.socket.on('clear unread', (message: InboundPayload<'clear unread'>) => {
    this.props.dispatch(actions.clearUnread(message));
  });

  // 清除 inbox 的未读计数
  IM.socket.on('clear notification', (message: InboundPayload<'clear notification'>) => {
    this.props.dispatch(actions.clearNotification(message));
  });

  // 操作状态更改时，在Chat上操作
  IM.socket.on('operate', (status: InboundPayload<'operate'>) => {
    this.props.dispatch(actions.operate(status));
  });

  IM.socket.on('new sticky on top', (status: InboundPayload<'new sticky on top'>) => {
    this.props.dispatch(actions.setTop(status));
  });

  IM.socket.on('clear all unread', () => {
    this.props.dispatch(actions.clearAllUnread());
  });

  IM.socket.on('new silence message', (status: InboundPayload<'new silence message'>) => {
    const { isSilent } = status;
    this.props.dispatch(actions.setSlience(status));
    isSilent ? alert(_l('已开启消息免打扰')) : alert(_l('已关闭消息免打扰'));
  });
};
