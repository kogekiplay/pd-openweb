/**
 * `src/pages/chat/redux` 的有限类型
 *
 * 【为什么需要】`RootState.chat` 的多个字段原本推导为 `any`：reducer 形参用默认的
 * `ReduxAction`（其 `{ [key: string]: any }` 索引签名把 `action.result`/`action.id`/
 * `action.data` 等一起拖成 `any`），helper（`filterSessionList`/`sortSession`/
 * `getToolbarConfig`）的形参/返回也未标注。结果是读任何不存在的字段都能编译通过。
 *
 * 【建模依据】字段全部来自**真实生产方/消费方**：
 * - 生产方：`actions.ts` 里的派发点（`resetMessage(id: string, result: any)`、
 *   `addPageMessage(id: string, result: any)` 等）与 `addMessage` 里已写出的消息形状；
 * - 消费方：`src/pages/chat/**` 组件读取的字段（会话读 `id`/`isGroup`/`isPost`/
 *   `accountId`/`project`/`groupId`/`isPushNotice`/`isContact`/`groupMemberCount`/`value`
 *   /`showBadge`/`isSilent`；消息读 `msg`/`type`/`id`/`from`/`time`/`isMine`/
 *   `isGroup`/`waitingId`/`isPrepare`/`card` 等）。
 *
 * 【不做什么】不把消息/会话整体换成 `Record<string, unknown>`；已消费的字段逐个声明，
 * 真正按消息种类扩展的元数据保留 `unknown` 索引签名（并注明理由）。
 */

/**
 * 会话对象（`sessionList` / `currentSessionList` / `currentInboxList` 的元素）。
 *
 * 【字段来源】消费方实际读取的字段（计数见上）。全部可选：生产方是接口返回，
 * 不同会话类型（单聊/群聊/动态/通讯录）字段并不齐备，**不能假定始终存在**。
 */
export interface ChatSession {
  /** 会话 id；`REMOVE_SESSION`/`REMOVE_CURRENT_SESSION` 按它过滤 */
  id?: string | undefined;
  /** `filterSessionList` 按 `value` 去重（lodash `groupBy('value')`） */
  value?: string | undefined;
  isGroup?: boolean | undefined;
  isPost?: boolean | undefined;
  isContact?: boolean | undefined;
  isPushNotice?: boolean | undefined;
  isSilent?: boolean | undefined;
  accountId?: string | undefined;
  groupId?: string | undefined;
  /** `project.companyName` 被 ChatPanelHeader 读取 */
  project?: { companyName?: string | undefined; [key: string]: unknown } | undefined;
  groupMemberCount?: number | undefined;
  /** SessionItem 里 `showBadge ? … : 0` 当作可计数/可布尔使用 */
  showBadge?: number | boolean | undefined;
  /** 排序键：`sortSession` 用 `_.orderBy(sessions, ['sendMsg'])` */
  sendMsg?: number | string | undefined;
  /** `atlist`：被 @ 的成员列表（`actions.ts:1618/1647/1648` 读取并 filter） */
  atlist?: string[] | undefined;
  /** `isSession`：是否会话（`actions.ts:683`） */
  isSession?: boolean | undefined;
  /** `commonGroup`/`top_info` 等会话扩展字段（`actions.ts:496` 读取 `top_info`） */
  /** `actions.ts:494-496` 读写 `top_info.isTop` */
  top_info?: { isTop?: boolean | undefined; [key: string]: unknown } | undefined;
  /**
   * 其余字段按会话类型扩展（群成员、部门、状态等）。
   * 保留 `unknown` 索引签名：这些是**真正随类型变化的扩展元数据**，
   * 已消费的字段都在上面显式声明，不是"整对象塞索引"的逃生口。
   */
  [key: string]: unknown;
  /** `count`：未读计数（`actions.ts:575` 读 `currentSession.count`） */
  /** SessionList/ChatPanel 里当数字用（`count : 0`） */
  count?: number | undefined;
  /** `isRender`：渲染标记（`actions.ts:970` 写 `currentSession.isRender`） */
  isRender?: boolean | undefined;
  /** `refer`/`reflist`：引用相关（`actions.ts:1658/1668` 读 `session.refer`/`session.reflist`） */
  /** `actions.ts:1658` 只做真值判断 */
  refer?: unknown;
  reflist?: unknown[] | undefined;

}

/**
 * 一条聊天消息。
 *
 * 【形状来源】`actions.ts:1045-1060` 的 `addMessage` 里**已写出**的消息字面量类型
 * （`waitingId`/`from`/`fromAccount`/`msg`/`to`/`type`/`time`/`iswd`/`sendMsg`/
 * `isMineMessage` + 事后补的 `sysType`/`refer`/`card`/`isPrepare`），
 * 加上消费方读取的字段（`id`/`isMine`/`isGroup`/`isDuplicated`/`logo`/`uname`/`msgid`…）。
 */
export interface ChatMessage {
  /** 消息 id；`MessageView` 用 `item.id || item.waitingId` 作 key */
  id?: string | undefined;
  /** 预发送消息的临时 id；`REMOVE_MESSAGE` 按 `waitingId` 过滤 */
  waitingId?: string | undefined;
  from?: string | undefined;
  /** 接收方（`socketEvent` 里有 `to : message.from` 的比较） */
  to?: unknown;
  /** 消息类型（数值枚举，消费方按数字比较） */
  type?: number | undefined;
  /** 消息时间（消费方直接展示/比较） */
  time?: number | string | undefined;
  /** 消息正文容器：`{ con, files }` */
  msg?: { con?: unknown; files?: unknown } | undefined;
  fromAccount?: {
    email?: string | undefined;
    id?: string | undefined;
    logo?: string | undefined;
    name?: string | undefined;
  } | undefined;
  iswd?: boolean | undefined;
  sendMsg?: number | string | undefined;
  isMineMessage?: boolean | undefined;
  isMine?: boolean | undefined;
  isGroup?: boolean | undefined;
  isDuplicated?: boolean | undefined;
  /** 按消息种类**事后补上**的字段 */
  /** 系统消息类型（按数值比较） */
  sysType?: number | undefined;
  /** 卡片消息体：`ChatPanelSession` 读 `card.title` */
  card?: { title?: string | undefined; [key: string]: unknown } | undefined;
  isPrepare?: boolean | undefined;
  /** `atlist`：被 @ 的成员列表（`actions.ts` 读取并 filter） */
  atlist?: string[] | undefined;
  /** `refer`/`reflist`：引用与引用列表（`actions.ts:1658/1668`） */
  /** 其余按消息种类扩展的元数据 */
  [key: string]: unknown;
}

/** `messages` 切片：**以会话 id 为键**的字典（业务本身就是字典语义） */
export interface ChatMessagesState {
  [sessionId: string]: ChatMessage[] | undefined;
}

/** `referMessage` 切片：会话 id → 被引用的消息 */
export interface ChatReferMessageState {
  [sessionId: string]: ChatMessage | undefined;
}

/**
 * `gotoMessage` 切片：会话 id → 要定位到的消息 id。
 * 生产方传 `messageId`，故值是 id 字符串而非消息对象。
 */
export interface ChatGotoMessageState {
  [sessionId: string]: string | undefined;
}

/**
 * `bottomUnreadMessage` 切片。
 *
 * 【生产方不一致，如实建模】`SET_BOTTOM_UNREAD_MESSAGE` 写入的是 `[action.message]`（**数组**），
 * 而 `UPDATE_BOTTOM_UNREAD_MESSAGE` 写入的是 `action.message`（**单值**）。
 * 因此值类型是 `ChatMessage[] | ChatMessage`，不能强行统一成一种。
 */
export interface ChatBottomUnreadMessageState {
  [sessionId: string]: ChatMessage[] | ChatMessage | undefined;
}

/**
 * `toolbarConfig` 切片。
 *
 * 【生产方】`utils.getToolbarConfig()` 的返回，形状固定（6 个布尔），
 * 依据是 `localStorage` 里的 4 个开关。因此可以精确声明。
 */
export interface ChatToolbarConfig {
  /** 以下 6 个由 `utils.getToolbarConfig()` 依据 localStorage 生成 */
  mingoVisible: boolean;
  mingoFixing: boolean;
  sessionListVisible: boolean;
  sessionListFixing: boolean;
  favoriteVisible: boolean;
  favoriteFixing: boolean;
  /**
   * 消息列表展示类型。**不是** `getToolbarConfig()` 的返回，而是：
   * - 生产方：`setToolbarConfig(config)` 可写入任意键；
   * - 消费方：`actions.ts:17/29/170` 读它传给 `utils.sortSession(sessions, value, messageListShowType)`，
   *   `sortSession` 里 `if (messageListShowType === 1)` 分支。
   * 因为初始值里没有它，如实标为**可选**。
   */
  messageListShowType?: number | undefined;
  /** 以下为 `setToolbarConfig` 的真实调用点写入的开关（Apps/FavoriteDrawer 等） */
  hideOpenCommonApp?: boolean | undefined;
  isOpenCommonApp?: boolean | undefined;
  /** 其余按功能扩展的 UI 开关 */
  [key: string]: unknown;
}

/** 整个 `chat` 切片 */
export interface ChatState {
  /** 会话列表 */
  sessionList: ChatSession[];
  toolbarConfig: ChatToolbarConfig;
  /** 当前会话信息（生产方 `SET_CURRENT_SESSION` 传 `Object.assign({}, action.result)`） */
  currentSession: ChatSession;
  /** 当前聊过天的会话 */
  currentSessionList: ChatSession[];
  /** 当前 inbox 的会话 */
  currentInboxList: ChatSession[];
  messages: ChatMessagesState;
  referMessage: ChatReferMessageState;
  gotoMessage: ChatGotoMessageState;
  /** 底部未读消息（生产方写入数组或单值，见 `ChatBottomUnreadMessageState`） */
  bottomUnreadMessage: ChatBottomUnreadMessageState;
  /** 是否在新标签页聊天（原已是 boolean） */
  isWindow: boolean;
  /** 是否显示通讯录 */
  showAddressBook: boolean;
  /** socket 状态（0 正常 / 1 正在重连 / 2 重连失败；原已是 number） */
  socketState: number;
}
