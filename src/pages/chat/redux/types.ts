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
  /**
   * 会话列表里的草稿**文本**。
   * 【真实生产方】`utils/index.ts:197` `item.sendMsg = localStorage.getItem(...)`，
   * 而 `localStorage.getItem` 返回 `string | null` —— 故这里是 `string | null`，
   * 与 `ChatMessage.sendMsg`（完整出站对象）是**两种不同业务**，不可混同。
   */
  sendMsg?: string | null;
  /** `atlist`：被 @ 的成员列表（`actions.ts:1618/1647/1648` 读取并 filter） */
  atlist?: string[] | undefined;
  /** `isSession`：是否会话（`actions.ts:683`） */
  isSession?: boolean | undefined;
  /** `commonGroup`/`top_info` 等会话扩展字段（`actions.ts:496` 读取 `top_info`） */
  /** `actions.ts:494-496` 读写 `top_info.isTop` */
  top_info?: { isTop?: boolean | undefined; [key: string]: unknown } | undefined;
  /* ── 以下为消费方**实际读取**的字段（按 `src/pages/chat/**` 用频取证）── */
  /** 会话/群/联系人显示名（`detail.tsx`、`ChatWindow` 读，25 处） */
  name?: string | undefined;
  /** 会话类型（数值枚举，`SessionList`/`Apps` 读，18 处） */
  type?: number | undefined;
  /** 最近一条消息（`ChatPanelSession` 模板串、`Message` 读 `.msg.con`，13 处） */
  /**
   * 最近一条消息的预览。
   * 【真实生产方】`utils/index.ts` `formatSession` 里
   * `item.msg.con = con`（**字符串拼接结果**）、随后 `htmlDecodeReg(item.msg.con)`。
   */
  msg?: {
    /** 预览正文：`formatSession` 末尾 `item.msg.con = htmlDecodeReg(item.msg.con)`，产出恒为 string */
    con: string;
    files?: unknown;
    [key: string]: unknown;
  } | undefined;
  /** 图标类型（`ChatPanel` 读；`utils` 里赋 `'system'` 等字符串，11 处） */
  iconType?: string | undefined;
  /** 创建者账号 id（`createAccount.accountId` 比较，11 处） */
  createAccount?: { accountId?: string | undefined; [key: string]: unknown } | undefined;
  /** 个人状态 id（`MyStatus` 索引，10 处） */
  statusId?: string | undefined;
  /** 图标标识（`ChatPanel` 渲染，9 处） */
  icon?: string | undefined;
  /** 是否推送类会话（真值判断，8 处） */
  isPush?: boolean | undefined;
  /** 部门 id（8 处） */
  departmentId?: string | undefined;
  /** 时间（`Message`/`utils` 读，7 处） */
  time?: number | string | undefined;
  /** 项目 id（`Apps` 读，7 处） */
  projectId?: string | undefined;
  /** 头像（`ChatWindow` 读，7 处） */
  avatar?: string | undefined;
  /* ── 以下为消费方**解构**读取的字段（`const { x } = session` 形式取证） ── */
  /** 群公告/关于（`ChatPanelSessionInfo` 解构读） */
  about?: unknown;
  /** 群成员列表（解构读） */
  groupUsers?: unknown[] | undefined;
  /** 是否管理员（`Message` 解构读，用于撤回权限） */
  isAdmin?: boolean | undefined;
  /** 是否已认证（解构读） */
  isCertificated?: boolean | undefined;
  /** 是否禁止邀请（解构读） */
  isForbidInvite?: boolean | undefined;
  /** 是否置顶（`ChatPanelHeader` 解构读） */
  isTop?: boolean | undefined;
  /* ── 以下为 `ChatPanelHeader` / 部门树等消费的扩展字段 ── */
  /** 用户全名（`ChatPanelHeader` 读） */
  fullname?: string | undefined;
  /** 部门名（`ChatPanelHeader` 读） */
  mapDepartmentName?: unknown;
  /** 状态选项（`ChatPanelHeader` 真值判断后渲染） */
  onStatusOption?: unknown;
  /** 弱关联计数（部门/外部联系人扩展） */
  weak_count?: number | undefined;
  /* ── 以下为 `utils.formatSession` **读写**的字段（逐行取证） ── */
  /**
   * 发送者信息。
   * 【为何 id/name 是必填】`utils.formatSession` 在 `if (item.from && !item.sysType)` 分支内
   * **无条件**读取 `item.from.id`（与本人 accountId 比较）与 `item.from.name`（撤回/预览文案，
   * 直接用于模板拼接与 `_l(..., name)`）。即"只要 from 存在，它就是完整的发送者对象"。
   */
  from?: { id: string; name: string; [key: string]: unknown } | undefined;
  /** 系统消息类型：`!item.sysType` 判断是否系统消息 */
  sysType?: number | undefined;
  /** 撤回管理员 id：`item.wdAdminid === accountId` 判断是否管理员撤回 */
  wdAdminid?: string | undefined;
  /** 是否已撤回：决定文案分支 */
  iswd?: boolean | undefined;
  /** 原始时间（`item._time = item.time` 备份，`time` 随后被格式化成文案） */
  _time?: unknown;
  /** @ 成员列表备份（`item.messageAtlist = item.atlist`） */
  messageAtlist?: unknown;
  /* ── 以下为 `actions.ts` 对**会话对象**直接写入的字段（逐行取证） ── */
  /** 未读计数：`actions.ts:79/88` `item.messageCount = result.clearCount / 0` */
  messageCount?: number | undefined;
  /** 群头像：`actions.ts:843` `item.logo = avatar`（`updateGroupAvatar`，`sessionList.map`） */
  logo?: string | undefined;
  /** 是否已验证：`actions.ts:937` `item.isVerified = isVerified`（`currentSessionList.map`） */
  isVerified?: boolean | undefined;
  /** @ 消息体：`actions.ts:128` `item.at_msg = result.at_msg`（更新会话时透传） */
  at_msg?: {
    time?: unknown;
    message_id?: unknown;
    msgid?: unknown;
    [key: string]: unknown;
  } | undefined;
  /** `count`：未读计数（`actions.ts:575` 读 `currentSession.count`；`SessionList` 里当数字用） */
  count?: number | undefined;
  /** `isRender`：渲染标记（`actions.ts:970` 写 `currentSession.isRender`） */
  isRender?: boolean | undefined;
  /** `refer`/`reflist`：引用相关（`actions.ts:1658/1668` 只做真值判断） */
  refer?: unknown;
  reflist?: unknown[] | undefined;
  /**
   * 其余字段按会话类型扩展（群成员、部门、状态等）。
   * 保留 `unknown` 索引签名：这些是**真正 opaque** 的扩展元数据。
   * 上面已按「直接读取 / 解构 / props.session.x / _.get / 等价变量」五种访问形式
   * 把能证明的消费字段全部显式声明；索引签名只兜住不可枚举的扩展。
   * （不以"删除后新增诊断数"作为必要性证明 —— 那种统计会把消费方自身的
   *  隐式 any 一并计入，无法区分"索引承载了真实字段"与"消费方本就没标注"。）
   */
  [key: string]: unknown;
}

/**
 * 出站草稿：`actions.addMessage` 里 `sendMsg: newMessage` 保留的**完整发送对象**。
 *
 * 【真实生产方】`ChatPanelSession` 构造的 `sendMsg` 字面量：
 * `waitingid`（`utils.getUUID()`）、`msg`、`sysType`、`touser`/`togroup`（按会话类型二选一）、
 * `atParam`、`referMessage`、`refer: { msgid }`，并整体 `...param` 展开（带 `type` 等）。
 * `actions.ts:1090` 明确注释「保留发给后端的消息数据，便于重发」，因此这里是**对象**，
 * 不是 `number | string`（那是另一处业务：会话列表的 localStorage 草稿文本）。
 */
export interface ChatOutboundDraft {
  /** 预发送临时 id（`utils.getUUID()`），也是 `ChatMessage.waitingId` 的来源 */
  waitingid?: string | undefined;
  /** 文本内容 */
  msg?: string | undefined;
  /** 系统消息类型（`Constant.MSGTYPE_*`） */
  sysType?: number | undefined;
  /** 单聊接收方 */
  touser?: string | undefined;
  /** 群聊接收方 */
  togroup?: string | undefined;
  /** 消息类型（`Constant.SESSIONTYPE_*`） */
  type?: number | undefined;
  /** @ 参数（群聊） */
  atParam?: unknown;
  /** 引用消息（完整对象，便于重发） */
  referMessage?: unknown;
  /** 引用指向（`{ msgid }`） */
  refer?: { msgid?: string | undefined; [key: string]: unknown } | undefined;
  /** 其余按消息种类扩展的出站字段 */
  [key: string]: unknown;
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
  /**
   * 消息 id。
   * 【真实证据：可为 number】
   * - `MessageView:65` 本地构造提醒消息时 `remind.id = Date.now()`（**数值**），
   *   随后 push 进 `res` 交给 `formatMessages`；
   * - `MessageView:147/155` 代码**自己**用 `typeof id === 'number'` 判断文件/卡片消息。
   * 因此这里是 `string | number`，不是仅 string。
   * 注意与 `ChatSession.id`（会话 id，恒为 string）区分，不做全仓 `string | number` 泛化。
   */
  id?: string | number | undefined;
  /** 预发送消息的临时 id；`REMOVE_MESSAGE` 按 `waitingId` 过滤 */
  waitingId?: string | undefined;
  from?: string | undefined;
  /** 接收方（`socketEvent` 里有 `to : message.from` 的比较） */
  to?: unknown;
  /** 消息类型（数值枚举，消费方按数字比较） */
  type?: number | undefined;
  /** 消息时间（消费方直接展示/比较） */
  time?: number | string | undefined;
  /**
   * 消息正文容器。
   * 【真实消费/生产】`con`（正文）、`files`（附件）、`oldCon`（撤回时由
   * `actions.ts:1274` `item.msg.oldCon = item.msg.con` 写入，用于展示原文）。
   */
  msg?: {
    /** 正文（`htmlDecodeReg(con)` 返回 string；模板插值 `${msg.con}` 使用） */
    con?: string | undefined;
    /**
     * 附件对象（**非数组**，见 `Message/attachment.ts` `hasAttachmentData`：
     * `typeof files === 'object' && !Array.isArray(files)`）。
     * 【真实消费字段】
     * - `MessageToolbar:198` 解构 `{ key, name }` 拼下载 URL；
     * - `ImageMessage` 读 `files.url`、`_.get(files, 'thumbs.web_1')`；
     * - `FileMessage` 等读 `size`/`name`/`id`；
     * - 表情消息读 `isEmotion`，另有 `len`/`fsize`/`aid` 等按消息种类扩展。
     */
    files?: {
      /** 文件存储 key（下载 URL 参数） */
      key?: string | undefined;
      /** 文件名 */
      name?: string | undefined;
      /** 访问 URL */
      url?: string | undefined;
      /** 文件 id */
      id?: string | number | undefined;
      /** 字节大小 */
      size?: number | undefined;
      /** 是否表情 */
      isEmotion?: boolean | undefined;
      /** 缩略图集（`thumbs.web_1` 等） */
      thumbs?: { [key: string]: unknown } | undefined;
      /** 其余按消息种类扩展的附件字段 */
      [key: string]: unknown;
    } | undefined;
    /** 撤回前的原文：`actions.ts:1287` `item.msg.oldCon = item.msg.con`，故同 `con` 类型 */
    oldCon?: string | undefined;
    [key: string]: unknown;
  } | undefined;
  fromAccount?: {
    email?: string | undefined;
    id?: string | undefined;
    logo?: string | undefined;
    name?: string | undefined;
  } | undefined;
  iswd?: boolean | undefined;
  /** 完整出站草稿对象（`actions.ts:1090` `sendMsg: newMessage`，便于重发） */
  sendMsg?: ChatOutboundDraft | undefined;
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
  /* ── 以下为消费方**实际读取/写入**的字段 ── */
  /** `utils/index.ts:281` 处 `message.value = message.id` 赋值（会话化消息时） */
  value?: string | undefined;
  /** 图片消息的 kcFile 标记（`ImageMessage:27` 读） */
  kcFile?: unknown;
  /** 消息正文纯文本（部分分支读 `.content`） */
  content?: unknown;
  /** 未读数（会话化消息时读 `.count`） */
  count?: number | undefined;
  /** 账号 id（会话化消息时读） */
  accountId?: string | undefined;
  /** 头像 / 图标 / 名称 / 图标类型（会话化消息时读） */
  avatar?: string | undefined;
  icon?: string | undefined;
  iconType?: string | undefined;
  name?: string | undefined;
  /* ── 以下为消费方**解构**读取的字段（`const { x } = message` 形式取证） ── */
  /** 群 id（解构读） */
  gid?: string | undefined;
  /** 是否推送类（解构读） */
  isPush?: boolean | undefined;
  /**
   * 位置消息体。
   * 【真实消费方】`MapMessage`：`center: [location.lng, location.lat]`、
   * `location.title`（搜索/展示）、`location.address`（展示）。
   */
  location?: {
    lng?: number | undefined;
    lat?: number | undefined;
    title?: string | undefined;
    address?: string | undefined;
    [key: string]: unknown;
  } | undefined;
  /** 关联用户（解构读） */
  user?: { [key: string]: unknown } | undefined;
  /* ── 以下为 `utils/index.ts` 消息格式化时**读写**的字段 ── */
  /** 群名称（`utils` 读，与 `uname` 二选一展示） */
  groupname?: string | undefined;
  /** 用户名称（`utils` 读） */
  uname?: string | undefined;
  /** 消息 id 别名（`utils: message.msgid = message.id` 赋值，故与 `id` 同类型） */
  msgid?: string | number | undefined;
  /**
   * 格式化的时间文案。
   * 【真实赋值三处】`utils/index.ts:228` 赋 `formatMsgDate(...)`（**string**）；
   * `:237` 与 `:244` 在「同一发送者 3 分钟内」或「重复文本」时赋 **`null`**。
   * 因此类型是 `string | null`，不是 `unknown`。
   */
  timestamp?: string | null;
  /** 未读分隔线标记（`utils` 读） */
  unreadLine?: boolean | undefined;
  /**
   * 引用消息体。
   * 【真实消费方】
   * - 撤回：`actions.ts:1284/1300` `item.refer.msgid == messageId`、`item.refer.iswd = true`；
   * - 展示：`Message` 把 `message.refer` 传给 `MessageRefer`，后者读
   *   `iswd`（已撤回则不跳转）、`msgid`（跳转目标）、`card`、`msgdetail.files`
   *   （`{ id, name, url, size }` 预览附件）。
   */
  refer?: {
    msgid?: string | undefined;
    iswd?: boolean | undefined;
    card?: unknown;
    msgdetail?: {
      files?: { id?: unknown; name?: string | undefined; url?: string | undefined; size?: unknown; [key: string]: unknown } | undefined;
      [key: string]: unknown;
    } | undefined;
    [key: string]: unknown;
  } | undefined;
  /** 其余按消息种类扩展的元数据 */
  [key: string]: unknown;
}

/**
 * `messages` 切片：**以会话 id 为键**的字典（业务本身就是字典语义）。
 *
 * 【元素为何含 `undefined`】`ADD_PAGE_MESSAGE` 的原实现是
 * `action.result.concat(state[action.id])`；当该键**缺失**时，
 * `concat(undefined)` 会在末尾**追加一个真实的 `undefined` 元素**
 * （实测 `[{id:'a'}].concat(undefined)` → 长度 2，第二个元素是 `undefined`）。
 * 这是可达状态，故元素类型如实写成 `ChatMessage | undefined`，
 * **不用非空断言把它从对外类型抹掉**（lead 明确要求）。
 *
 * 【键值为何含 `undefined`】字典取值本身可缺失（未加载过的会话）。
 */
export interface ChatMessagesState {
  [sessionId: string]: (ChatMessage | undefined)[] | undefined;
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
 * 【真实契约是数组】三条读改路径都按数组操作：
 * - `SET_BOTTOM_UNREAD_MESSAGE` 写 `[action.message]`（数组）
 * - `ADD_BOTTOM_UNREAD_MESSAGE` 在已有值上 `.concat([action.message])`
 * - `REMOVE_BOTTOM_UNREAD_MESSAGE` 删除键
 *
 * 【既有不一致，如实记录但不放宽类型】`UPDATE_BOTTOM_UNREAD_MESSAGE` 写的是
 * `action.message`（**单值**），与上面的数组契约不一致 —— 这是生产方既有的越界写入。
 * 若把类型写成 `ChatMessage[] | ChatMessage`，会让所有数组路径都需要额外收窄，
 * 反而掩盖"该字典按数组使用"的真实契约；因此这里**按数组建模**，
 * 单值写入处用擦除标记表达（reducers 内已注明），不修改运行时行为。
 */
export interface ChatBottomUnreadMessageState {
  [sessionId: string]: ChatMessage[] | undefined;
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
