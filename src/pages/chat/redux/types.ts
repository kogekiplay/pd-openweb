/**
 * `src/pages/chat/redux` 的有限类型
 *
 * 【为什么需要】`RootState.chat` 的多个字段原本推导为 `any`：reducer 形参用默认的
 * `ReduxAction`（其 `{ [key: string]: any }` 索引签名把 `action.result`/`action.id`/
 * `action.data` 等一起拖成 `any`），helper（`filterSessionList`/`sortSession`/
 * `getToolbarConfig`）的形参/返回也未标注。结果是读任何不存在的字段都能编译通过。
 *
 * 【建模依据】字段全部来自**真实生产方/消费方**：
 * - 生产方：`actions.ts` 里的派发点（`resetMessage`/`addPageMessage`/`pushPageMessage`
 *   的 `result` 已按真实调用收敛为 `ChatMessage[]`）与 `addMessage` 里已写出的消息形状；
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
  /**
   * 会话 id。
   * 【为何允许 number（lead 15:29 实测反例）】`formatNewSession` 的**系统消息分支**只写
   * `value = id`、`time`、`msg`，**不改 `id` 本身** —— 数值 id 会原样返回
   * （`formatter-shapes.cjs`：`systemSessionId: 123` / `systemSessionValue: 123`）。
   */
  /** 会话 id；`REMOVE_SESSION`/`REMOVE_CURRENT_SESSION` 按它过滤 */
  id?: string | undefined;
  /** `filterSessionList` 按 `value` 去重（lodash `groupBy('value')`） */
  /** 去重键；同 `id`：系统分支不改它，数值形态可达 */
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
  /**
   * @ 列表补丁。
   * 【present/undefined 合同（lead 15:29 要求）】如实允许"键存在但值为 `undefined`"：
   * `'atlist' in result` **不证明**值一定是数组，所以这里带 `| undefined`。
   * 消费点若需要 `.length`，用**擦除式非空断言**（零运行时）保留原生的"对 undefined 取属性"失败，
   * 而不是 `as string[]` 把非数组硬说成数组。
   */
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
    /**
     * 预览正文。
     * 【为何允许 `undefined`】`formatSession` 末尾确实把它写成 string，
     * 但 `updateSessionList` 里 `item.msg.con = result.msg` 位于 `'count' in result` 守卫内、
     * **没有 `msg` 守卫**，补丁未带 `msg` 时就会写入 `undefined`。
     * 故这里如实体现在 `string | undefined`，而不是声称"恒为 string"。
     */
    con?: string | undefined;
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
  /** 群公告正文：`Announcement:23/25` `session.about !== value` 比较并回填，实为字符串 */
  about?: string | undefined;
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
  /** 部门名：`ChatPanelHeader:280/283` 先真值判断再**直接作为文本渲染**，故是字符串 */
  mapDepartmentName?: string | undefined;
  /**
   * 个人状态选项。
   * 【复用生成 DTO，不手写形状】`MyStatus/index.tsx:95` 已有同名字段的真实声明：
   * `HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | null | undefined`；
   * `MyStatus:261` 读 `.endTime`、`:271` 回填 `null`。故此处直接复用该 DTO 并允许 `null`。
   */
  onStatusOption?: HapApi.MD.Web.Ajax.ResultModel.Personals.PStatusOption | null | undefined;
  /** 弱关联计数（部门/外部联系人扩展） */
  weak_count?: number | undefined;
  /* ── 以下为 `utils.formatSession` **读写**的字段（逐行取证） ── */
  /**
   * 发送者信息。
   * 【为何 id/name 是必填】`utils.formatSession` 在 `if (item.from && !item.sysType)` 分支内
   * **无条件**读取 `item.from.id`（与本人 accountId 比较）与 `item.from.name`（撤回/预览文案，
   * 直接用于模板拼接与 `_l(..., name)`）。即"只要 from 存在，它就是完整的发送者对象"。
   */
  /**
   * 发送者对象。
   * 【为何 `id` 可选（lead 实测反例）】`formatSession({ from: { name: 'User' } })` 会**成功返回**，
   * 且 `from.id` 仍为 `undefined`（`formatter-shapes.cjs`：
   * `formatSessionCanReturnMissingSenderId: true`）。
   * "读取某字段"不等于"生产方保证该字段必填"——之前声明必填是**过度声称**。
   */
  from?: { id?: string | undefined; name: string; [key: string]: unknown } | undefined;
  /** 系统消息类型：`!item.sysType` 判断是否系统消息 */
  sysType?: number | undefined;
  /** 撤回管理员 id：`item.wdAdminid === accountId` 判断是否管理员撤回 */
  wdAdminid?: string | undefined;
  /** 是否已撤回：决定文案分支 */
  iswd?: boolean | undefined;
  /**
   * 原始时间备份：`utils/index.ts:216` `item._time = item.time`。
   * 【为什么复用 `time` 的合同而不是 unknown】它有**已知生产方**（同一对象的 `time` 字段，
   * 该行赋值发生在 `time` 被 `formatMsgDate` 改写成文案**之前**），
   * 因此可达形态就是 `ChatSession['time']` 的形态（`number | string`）。
   * 用 `unknown` 会把已知来源的类型信息丢掉，属"类型不准确"，不是保守。
   */
  _time?: number | string | undefined;
  /**
   * @ 成员列表备份：`utils/index.ts:217` `item.messageAtlist = item.atlist`。
   * 同 `_time`：来源是同一对象的 `atlist`，可达形态即 `ChatSession['atlist']`（`string[]`）。
   */
  messageAtlist?: string[] | undefined;
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
  /** 引用指向（`{ msgid }`） */
  refer?: { msgid?: string | undefined; [key: string]: unknown } | undefined;
  /* ── 以下为 `addMessage` **实际读取**的出站字段（逐处取证） ── */
  /** 引用消息的完整对象：读 `referMessage.msg.con` / `.type` / `.fromAccount.name` */
  referMessage?:
    | {
        msg?: { con?: string | undefined; [key: string]: unknown } | undefined;
        type?: number | undefined;
        fromAccount?: { name?: string | undefined; [key: string]: unknown } | undefined;
        [key: string]: unknown;
      }
    | undefined;
  /** 卡片消息体：`message.card = newMessage.card` */
  card?: ChatMessage['card'];
  /** 图片/文件附件：`newMessage.file.url` 会被赋值、`message.msg.files = newMessage.file` */
  file?: { key?: string | undefined; url?: string | undefined; [key: string]: unknown } | undefined;
  /** 预发送标记：`message.isPrepare = newMessage.isPrepare || false` */
  isPrepare?: boolean | undefined;
  /** 其余按消息种类扩展的出站字段 */
  [key: string]: unknown;
}

/**
 * **会话的原始 wire 形态**：`/chat_list` 返回、尚未经 `formatSession` 归一化的会话对象。
 *
 * 【与消息 wire 的关键区别（实测取证）】会话的 `from` **已经是对象**，不是 id 字符串：
 * `utils.formatSession` 直接读 `item.from.id`（与本人 accountId 比较）与 `item.from.name`
 * （撤回/预览文案模板），若 `from` 是字符串这两处会得到 `undefined`。
 * 而 socket **消息**的 `from` 才是 id 字符串（由 `formatNewSession` 原地改型成对象）。
 * 两者不能套用同一套 wire 假设。
 *
 * 【字段依据】`formatSession` 实际读写的字段：
 * `from`/`msg`/`type`/`time`/`isGroup`/`sysType`/`wdAdminid`/`iswd`/`value`/`name`/`iconType`/
 * `atlist`（以及它写入的 `_time`/`messageAtlist`/`sendMsg`）。其余按键保留 `unknown` 索引。
 */
/**
 * `updateMessage` 的入参：服务器对**本机发出消息**的回执。
 *
 * 【字段依据】`updateMessage` 里实际读取的表达式：
 * 解构 `{ to, waitingid, socket }`；读 `message.id`；
 * `const { referMessage } = message` 后读其 `id`/`msg.con`/`type`/`time`/`iswd`/
 * `fromAccount.{id,name,logo}`；`socket.{time, refer.msgdetail, msg.files}`；
 * 以及 `'isContact' in message` 判别。
 */
export interface ChatMessageReceiptWire {
  id?: string | number | undefined;
  /** 会话 id（= messages 字典键） */
  to: string;
  /** 预发送临时 id，用来找到本地那条待确认消息 */
  waitingid?: string | undefined;
  /** 转系统消息判别（`'isContact' in message`） */
  isContact?: boolean | undefined;
  /** 被引用消息的原始对象（回执里回填 refer 用） */
  referMessage?:
    | {
        id?: string | number | undefined;
        msg?: { con?: string | undefined; [key: string]: unknown } | undefined;
        type?: number | undefined;
        time?: number | string | undefined;
        iswd?: boolean | undefined;
        fromAccount?:
          | {
              id?: string | undefined;
              name?: string | undefined;
              logo?: string | undefined;
              [key: string]: unknown;
            }
          | undefined;
        [key: string]: unknown;
      }
    | undefined;
  /** 服务器侧附加信息 */
  socket?:
    | {
        time?: number | string | undefined;
        /** 直接写入 `ChatMessage.refer.msgdetail`，故同型 */
        refer?: {
          msgdetail?: NonNullable<ChatMessage['refer']>['msgdetail'];
          [key: string]: unknown;
        } | undefined;
        /** 直接写入 `ChatMessage.msg.files`，故同型 */
        msg?: {
          files?: NonNullable<ChatMessage['msg']>['files'];
          [key: string]: unknown;
        } | undefined;
        [key: string]: unknown;
      }
    | undefined;
  [key: string]: unknown;
}

/**
 * `addMessage` 内部构造的**待发送消息**（`formatMessage` 的入参）。
 *
 * 【为什么单独建这一层】原实现用一段手写内联形状，含 9 个 `any` 字段。
 * 它是"出站草稿 → 存储消息"之间的**过渡形态**：字段全部由 `addMessage` 里的
 * 真实表达式写出（`waitingId: newMessage.waitingid`、`to: newMessage.togroup || newMessage.touser` 等）。
 * 归一化由 `formatMessage` 完成，完成后即成为 `ChatMessage`。
 *
 * 【与 ChatMessage 的关系】`refer` 在这里是**出站摘要** `{ msg, type, user.full_name }`；
 * `ChatMessage.refer` 已按证据把该形态并入联合，因此本类型可直接交给 `formatMessage`，
 * **不需要 `as` 断言**。
 */
export interface ChatPendingMessage {
  waitingId?: string | undefined;
  from: string;
  fromAccount: { email: string; id: string; logo: string; name: string };
  msg: { con?: string | undefined; files?: ChatPendingAttachment | undefined };
  to?: string | undefined;
  type?: number | undefined;
  time?: string | number | undefined;
  iswd: boolean;
  /** 原始出站草稿，便于重发 */
  sendMsg?: ChatOutboundDraft | undefined;
  isMineMessage: boolean;
  sysType?: number | undefined;
  /** 出站引用摘要（写入后随消息存储） */
  refer?:
    | {
        msg?: string | undefined;
        type?: number | undefined;
        user?: { full_name?: string | undefined; [key: string]: unknown } | undefined;
        [key: string]: unknown;
      }
    | undefined;
  /** 卡片消息体：`message.card = newMessage.card`��原样透传 */
  card?: ChatMessage['card'];
  /** 预发送标记 */
  isPrepare?: boolean | undefined;
  /** 与 `ChatMessage` 一致的索引签名（其它按消息种类扩展的键） */
  [key: string]: unknown;
}

/** 待发送消息的附件对象：`newMessage.file` 会被写 `url` 后赋给 `msg.files` */
export interface ChatPendingAttachment {
  key?: string | undefined;
  url?: string | undefined;
  name?: string | undefined;
  size?: number | undefined;
  [key: string]: unknown;
}

/**
 * `updateSessionList` 的**局部补丁**形状：`actions.ts` 内多处
 * `dispatch(updateSessionList({ ... }))` 只带要改的字段。
 * 【字段依据】该函数体内实际访问的键（`'X' in result` 与 `result.X`）：
 * `id`/`clearCount`/`count`/`messageCount`/`addMsg`/`atlist`/`at_msg`/`msg`/`msgId`/
 * `isPush`/`isContact`/`isTop`/`isWithdraw`/`isSession`/`refer`/`reflist`/`sendMsg`/
 * `showBadge`/`time`/`weak`。其余按键保留 `unknown` 索引。
 */
export interface ChatSessionPatch {
  id?: string | undefined;
  clearCount?: number | undefined;
  count?: number | undefined;
  messageCount?: number | undefined;
  addMsg?: string | undefined;
  atlist?: string[] | undefined;
  at_msg?: { [key: string]: unknown } | undefined;
  /**
   * 预览正文：本文件所有 `updateSessionList({ msg })` 传的都是**字符串模板**
   * （`${name}: ${result.msg.con}` / `${name}: ${message.msg.con}`），故是 `string`。
   */
  msg?: string | undefined;
  /**
   * 消息 id 补丁。
   * 【为何是 string】唯一写入点是 `newUserMessage`/`newGroupMessage` 的
   * `msgId: message.id`，而该值同文件内被与**字符串**会话 `value` 直接比较
   * （`sessionList.filter(item => item.value === message.id)`），故按字符串建模。
   */
  msgId?: string | undefined;
  isPush?: boolean | undefined;
  isContact?: boolean | undefined;
  isTop?: boolean | undefined;
  isWithdraw?: boolean | undefined;
  isSession?: boolean | undefined;
  refer?: unknown;
  reflist?: unknown[] | undefined;
  sendMsg?: string | null | undefined;
  showBadge?: number | boolean | undefined;
  time?: number | string | undefined;
  weak?: unknown;
  [key: string]: unknown;
}

export interface ChatRawSessionWire {
  id?: string | number | undefined;
  value?: string | undefined;
  /** 原始时间：归一化后被 `formatMsgDate` 改写成文案，原值备份到 `_time` */
  time?: number | string | undefined;
  /** 原始类型：归一化时 `Number(item.type)` */
  type?: number | string | undefined;
  isGroup?: boolean | undefined;
  sysType?: number | undefined;
  wdAdminid?: string | undefined;
  iswd?: boolean | undefined;
  name?: string | undefined;
  iconType?: string | undefined;
  /**
   * 发送者**对象**（见上：会话 wire 里已是对象）。
   * `name` 声明为必填：`formatSession` 把它传给 `_l('...%0...', item.from.name)`，
   * 而 `_l` 的形参是 `(string | number)[]` —— 即该位置**按字符串使用**。
   */
  from?: { id?: string | undefined; name: string; avatar?: string | undefined; [key: string]: unknown } | undefined;
  /**
   * 预览正文。`con` 声明为 `string | undefined`：wire 阶段是**未解码字符串**，
   * `formatSession` 用 `htmlDecodeReg(con)`（形参 `unknown`、返回 `string`）解码后写回。
   */
  msg?: { con?: string | undefined; files?: unknown; [key: string]: unknown } | undefined;
  atlist?: string[] | undefined;
  /** `formatSession` 归一化时写入的备份字段 */
  _time?: number | string | undefined;
  messageAtlist?: string[] | undefined;
  /** `formatSession` 归一化时从 localStorage 写入的草稿文本 */
  sendMsg?: string | null | undefined;
  [key: string]: unknown;
}

/**
 * **原始 wire 形态**：socket 收到、尚未经 `formatNewMessage` / `formatNewSession` 归一化的载荷。
 *
 * 【为什么单独建这一层（lead 13:23 方案）】这两个 formatter 会**逐属性原地写入**把 wire
 * 变成最终形态：`msg` 由 `string` 改成 `{ con }`、`from` 由 id 字符串改成发送者对象。
 * 因此输入既不能标 `any`（丢信息），也不能直接标最终 `ChatMessage`/`ChatSession`（撒谎）。
 * 三层分别是：本接口（wire）→ 归一化写入后的过渡形态 → 最终输出形态。
 *
 * 【字段依据】`formatNewMessage` / `formatNewSession` 与它们转交的 `formatMessage` /
 * `formatSession` 实际读写的字段，逐行取证；其余按键保留 `unknown` 索引。
 */
/**
 * **普通 socket 消息的原始 wire**（`receiveMessage` → `formatNewMessage` 的真实入参）。
 *
 * 【为什么单独收一层，而不是复用 `ChatRawMessageWire`】
 * `formatNewMessage` **完全不动 `msg`** —— 它只写 `iswd` 与 `fromAccount`，然后转交
 * `formatMessage`。所以输出里 `msg` 保持输入形态。lead 实测反例：
 * `formatNewMessage({..., msg: 'wire string'})` 返回原对象且 `msg` 仍是 **string**
 * （`formatter-shapes.cjs`：`formatNewMessageLeavesStringMsg: "string"`）。
 *
 * 而**真实生产方**传的都是对象 msg：`actions.ts` 里读 `message.msg.con` / `message.msg.files`
 * 共 6 处，说明普通消息的 `msg` 已是 `{ con, files }`。故这里**按真实生产方收紧**为对象，
 * 不再用"string | object"泛化后靠断言抹平。
 */
export interface ChatNewMessageWire {
  id?: string | number | undefined;
  from?: string | undefined;
  uname?: string | undefined;
  logo?: string | undefined;
  /** 真实生产方恒为对象（见上） */
  msg?: { con?: string | undefined; files?: unknown; [key: string]: unknown } | undefined;
  time?: number | string | undefined;
  type?: number | undefined;
  iswd?: boolean | undefined;
  isMine?: boolean | undefined;
  isDuplicated?: boolean | undefined;
  timestamp?: string | null | undefined;
  unreadLine?: boolean | undefined;
  isPush?: boolean | undefined;
  isSession?: boolean | undefined;
  dtype?: unknown;
  fromAccount?:
    | { id?: string | undefined; name?: string | undefined; logo?: string | undefined; [key: string]: unknown }
    | undefined;
  [key: string]: unknown;
}

export interface ChatRawMessageWire {
  /**
   * 消息/会话 id（wire 阶段）。
   * 【为什么是 string 而不是 string | number】`formatNewSession` 的系统消息分支不改 `id`，
   * 若允许数值 id，输出会带数值 id 并**连锁污染**会话列表契约（`removeCurrentSession(id)` 等）。
   * lead 15:29 的要求是：**无法证明是合法生产值时，按生产证据收紧入参**，而不是放宽输出。
   * 真实 socket 消息的 `id` 由服务端给出且下游按字符串比较，故此处收紧为 `string`。
   */
  id?: string | undefined;
  /**
   * 发送者：wire 阶段是 **id 字符串**；`formatNewSession` 会把它**原地改型**成发送者对象。
   * 因此这里如实写成**过渡联合**（lead 方案要求"msg/from 原地改型如实建过渡联合"）。
   */
  from?:
    | string
    | { id?: string | undefined; name?: string | undefined; avatar?: string | undefined; [key: string]: unknown }
    | undefined;
  uname?: string | undefined;
  name?: string | undefined;
  logo?: string | undefined;
  avatar?: string | undefined;
  /** 原始正文：系统消息分支里是 **string**，其余是对象（原地改型的来源） */
  msg?:
    | string
    | { con?: unknown; files?: unknown; oldCon?: unknown; [key: string]: unknown }
    | undefined;
  time?: number | string | undefined;
  type?: number | undefined;
  iswd?: boolean | undefined;
  isMine?: boolean | undefined;
  isDuplicated?: boolean | undefined;
  timestamp?: string | null | undefined;
  unreadLine?: boolean | undefined;
  isGroup?: boolean | undefined;
  groupname?: string | undefined;
  to?: string | undefined;
  value?: string | undefined;
  msgid?: string | number | undefined;
  /** 系统消息判别键（`'dtype' in message`） */
  dtype?: unknown;
  /** 推送类标记：`addSession` 读 `result.isPush` 写进会话补丁 */
  isPush?: boolean | undefined;
  /** 是否会话：`addSession` 在无 id 时写 `result.isSession = false` */
  isSession?: boolean | undefined;
  /** 归一化过程中写入的发送者对象 */
  fromAccount?:
    | { id?: string | undefined; name?: string | undefined; logo?: string | undefined; [key: string]: unknown }
    | undefined;
  [key: string]: unknown;
}

/**
 * **归一化写入后的过渡形态**：`formatNewSession` 完成逐属性写入、但还没交给 `formatSession` 时。
 * 此时 `msg` 与 `from` 已被**原地改型**为对象（见该函数内两处赋值）。
 * 这是 lead 方案里"原地转换过渡"那一层，如实反映"同一对象、字段类型已变"。
 */
/**
 * `formatNewSession` 的**规范化输出形态**（两个分支各自的真实结果）。
 *
 * 【为什么是联合而不是单一接口（lead 实测反例）】
 * - **系统消息分支**（`'dtype' in message`）只写 `msg`（string → `{con}`）、`time`、`value`，
 *   **从不写 `from`** → 输出**可能没有自有 `from`**；`id`/`value` 也保持原始形态（可能是 number）
 *   （`formatter-shapes.cjs`：`systemSessionHasFrom: false` / `systemSessionId: 123`）。
 * - **非系统分支**会把 `from` 由 id 字符串**原地改型**为发送者对象。
 * 所以"from 必有对象"只对非系统分支成立，不能一律断言。
 */
export type ChatSessionWireNormalized =
  | (ChatRawMessageWire & {
      /** 系统分支：msg 被改成对象；from 未被写入 */
      msg: { con?: unknown; files?: unknown; [key: string]: unknown };
      from?: ChatRawMessageWire['from'];
    })
  | (ChatRawMessageWire & {
      /** 非系统分支：msg/from 都被原地改型 */
      msg: { con?: unknown; files?: unknown; [key: string]: unknown };
      from: { id?: string | undefined; name?: string | undefined; avatar?: string | undefined; [key: string]: unknown };
    });

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
   * 注意与 `ChatSession.id` 区分：后者在**类型上**收紧为 `string`（数值会话 id 在 wire 边界被拒，
   * 见 `ChatRawMessageWire.id` 的说明）；但运行期 `formatNewSession` 的系统分支**不会**改写 `id`，
   * 若服务端真发数值 id，运行时会原样带出 —— lead 15:29 已用 `formatter-shapes.cjs` 实测到该形态。
   * 因此"恒为 string"只成立于类型层，不是运行期保证。不做全仓 `string | number` 泛化。
   */
  id?: string | number | undefined;
  /** 预发送消息的临时 id；`REMOVE_MESSAGE` 按 `waitingId` 过滤 */
  waitingId?: string | undefined;
  from?: string | undefined;
  /**
   * 接收方 id。
   * 【真实用法】`socketEvent:123`、`actions.ts:1357/1461` 取
   * `md.global.Account.accountId === message.from ? message.to : message.from` 作为**会话 id**；
   * `actions.ts:1366` `utils.scrollEnd(message.to, true)`，而 `scrollEnd(id, isBottom)` 的 id 是滚动容器 id。
   * 故是字符串，不是 unknown。
   */
  to?: string | undefined;
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
      /**
       * 文件大小（备用字段）：`FileMessage:131` `formatFileSize(files.fsize || files.size)`
       * —— 与 `size` 互为兜底，故同为 number。
       */
      fsize?: number | undefined;
      /**
       * 音频时长：`AudioMessage:67` `parseInt(files.len) || 0`。
       * 注意被 `parseInt` 处理，故**可能是字符串形态**，如实写 `string | number`。
       */
      len?: string | number | undefined;
      /** 附件 id 标记：`FileMessage:34` `!files.id || files.aid` 真值判断 */
      aid?: unknown;
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
  /**
   * 是否通讯录/系统联系人消息。
   * 【证据】两处写入：`actions.ts:165 item.isContact = result.isContact`、
   * `actions.ts:1262 item.isContact = false`；一处读取：`SystemMessage/index.tsx:61`
   * 的 `'isContact' in message`。
   */
  isContact?: boolean | undefined;
  /** 完整出站草稿对象（`actions.ts:1090` `sendMsg: newMessage`，便于重发） */
  sendMsg?: ChatOutboundDraft | undefined;
  isMineMessage?: boolean | undefined;
  isMine?: boolean | undefined;
  isGroup?: boolean | undefined;
  isDuplicated?: boolean | undefined;
  /** 按消息种类**事后补上**的字段 */
  /** 系统消息类型（按数值比较） */
  sysType?: number | undefined;
  /**
   * 卡片消息体。
   * 【已消费字段（逐处取证）】
   * - `md`（11 处，如 `MessageView:154` `card.md === 'worksheet'` / `'kcfile'`）——卡片类型标识；
   * - `title`（`ChatPanelSession` 模板拼接）；
   * - `entityid` / `url`（拼 `'_' + moment(sidext)` 后缀）；
   * - `projectId`、`extra`（`|| {}` 兜底后使用）。
   * 其余按卡片种类扩展的字段留在索引签名里。
   */
  card?: {
    md?: string | undefined;
    title?: string | undefined;
    entityid?: string | undefined;
    url?: string | undefined;
    projectId?: string | undefined;
    extra?: unknown;
    [key: string]: unknown;
  } | undefined;
  isPrepare?: boolean | undefined;
  /** `atlist`：被 @ 的成员列表（`actions.ts` 读取并 filter） */
  atlist?: string[] | undefined;
  /* ── 以下为消费方**实际读取/写入**的字段 ── */
  /** `utils/index.ts:281` 处 `message.value = message.id` 赋值（会话化消息时） */
  value?: string | undefined;
  /**
   * kcFile 附件对象（**非布尔标记**）。
   * 【真实消费】
   * - `MessageToolbar:194` `message.kcFile.downloadUrl`（下载 URL 优先来源）；
   * - `ImageMessage:73` / `FileMessage:98` 把**整个对象**作为 `attachments: [message.kcFile]`
   *   传给预览组件；
   * - `viewUrl` / `size` 同处取用（`viewUrl : ''`、`size : 0` 兜底）。
   */
  kcFile?: {
    downloadUrl?: string | undefined;
    viewUrl?: string | undefined;
    size?: number | undefined;
    [key: string]: unknown;
  } | undefined;
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
  /** 发送者头像：`formatNewMessage` 写 `fromAccount.logo`、`formatNewSession` 读 `message.logo` */
  logo?: string | undefined;
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
    /**
     * 被引用消息 id。
     * 【为何允许 number】`updateMessage` 里 `msgid: referMessage.id`，
     * 而 `referMessage.id` 是 `string | number`；两处消费方都只做 `== messageId` 比较。
     */
    msgid?: string | number | undefined;
    iswd?: boolean | undefined;
    card?: unknown;
    /**
     * 出站摘要形态（**本地发出**且带引用时由 `addMessage` 写入，并随
     * `SET_MESSAGE`/`ADD_MESSAGE` 存进 `messages`，故存储侧确实可达）。
     * 证据：`addMessage` 里 `message.refer = { msg, type, user: { full_name } }`，
     * 随后 `utils.formatMessage(message)` 的结果被 dispatch 进 messages。
     */
    msg?: string | undefined;
    type?: number | undefined;
    /** 引用时刻（`updateMessage` 回执里写入 `time: referMessage.time`） */
    time?: number | string | undefined;
    /** 引用消息的发送者：`SessionItem:37` `item.refer.user.account_id === accountId` 真值链比较 */
    user?:
      | {
          account_id?: string | undefined;
          full_name?: string | undefined;
          /** 引用者头像（`updateMessage` 回执里写入 `avatar: referMessage.fromAccount.logo`） */
          avatar?: string | undefined;
          [key: string]: unknown;
        }
      | undefined;
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

/**
 * `newUserMessage` 的入参：**单聊新消息** socket 事件。
 *
 * 【为何单独建】它与 `ChatRawMessageWire` 的区别不在于字段多少，而在于
 * **该事件里 `from` 已经是字符串**（用户消息的发送者 id），而会话 wire 的
 * `from` 仍是"对象或字符串"的过渡联合。沿用会话 wire 会让这个联合漏进
 * `receiveMessage(id, ...)` 的 `id: string`。
 */
export interface ChatNewUserMessageEvent extends ChatRawMessageWire {
  from: string;
  /** 单聊消息正文：该事件里 msg **已是对象**（会话 wire 的联合不适用） */
  msg: { con?: string | undefined; files?: unknown; oldCon?: unknown; [key: string]: unknown };
  /** 发送者昵称（拼 `"昵称: 正文"` 用） */
  uname?: string | undefined;
  /** 未读数（本 handler 会写它） */
  count?: number | undefined;
  /** 是否群会话（本 handler 会写它） */
  isGroup?: boolean | undefined;
}
