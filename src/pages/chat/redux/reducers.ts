import { combineReducers } from 'redux';
import * as utils from '../utils/';
import type {
  ChatBottomUnreadMessageState,
  ChatGotoMessageState,
  ChatMessage,
  ChatMessagesState,
  ChatReferMessageState,
  ChatSession,
  ChatToolbarConfig,
} from './types';

/**
 * 本模块的动作类型。
 *
 * 【为什么显式声明】原先每个 reducer 的 `action` 形参都是默认的 `ReduxAction`，
 * 其 `{ [key: string]: any }` 索引签名把 `action.result` / `action.id` / `action.data` /
 * `action.message` / `action.messageId` 全部变成 `any`，于是切片字段整体推导为 `any`。
 *
 * 【载荷依据】全部取自 `actions.ts` 的**真实派发点**：
 * - `resetMessage(id: string, result: any)` / `addPageMessage(id: string, result: any)` →
 *   `{ type, id, result }`；
 * - `SET_SESSION_LIST` / `UPDATE_SESSION_LIST` 的 `result` 是**会话数组**；
 * - `REMOVE_SESSION` / `REMOVE_CURRENT_SESSION` 的 `id` 是**会话 id 字符串**；
 * - `UPDATE_INBOX_SESSION` 的 `id` 与会话的 `value` 比较、`data` 是补丁；
 * - `UPDATE_IS_WINDOW` / `UPDATE_SHOW_ADD_RESSBOOK` / `UPDATE_SOCKET_STATE` 的 `result`
 *   分别是 boolean / boolean / number。
 *
 * 【`result` 用 `any` 的位置说明】`resetMessage` 等生产方签名里 `result` 本身就是 `any`
 * （见 `actions.ts:1001`），此处如实继承；但**消费它的表达式仍然逐字未改**，
 * 且切片的**对外类型**由 `ChatState` 精确约束，不会把 `any` 泄到 `RootState.chat`。
 */
export type ChatAction =
  /* ── 会话列表 ── */
  | { type: 'SET_SESSION_LIST'; result: ChatSession[] }
  | { type: 'ADD_SESSION_LIST'; result: ChatSession[] }
  | { type: 'UPDATE_SESSION_LIST'; result: ChatSession[] }
  | { type: 'REMOVE_SESSION'; id: string }
  | { type: 'ADD_SESSION'; result: ChatSession[] }
  /* ── toolbar 配置 ── */
  | { type: 'SET_TOOLBAR_CONFIG'; result: Partial<ChatToolbarConfig> }
  /* ── 当前会话 ── */
  | { type: 'SET_CURRENT_SESSION'; result: ChatSession }
  /* ── 当前会话列表 ── */
  | { type: 'ADD_CURRENT_SESSION'; result: ChatSession[] }
  // 【按真实生产方】`removeCurrentSession(id: string | undefined)` 会透传会话 id，
  // `formatSession` 不保证会话必有 id，故这里如实放宽（不是收紧）。
  | { type: 'REMOVE_CURRENT_SESSION'; id: string | undefined }
  | { type: 'UPDATE_CURRENT_SESSION'; result: ChatSession[] }
  /* ── inbox 会话列表 ── */
  | { type: 'ADD_INBOX_SESSION'; result: ChatSession[] }
  // 同 REMOVE_CURRENT_SESSION：`removeCurrentInbox(id: string | undefined)`。
  | { type: 'REMOVE_INBOX_SESSION'; id: string | undefined }
  | { type: 'REMOVE_ALL_INBOX_SESSION' }
  | { type: 'UPDATE_INBOX_SESSION'; id: string; data: Partial<ChatSession> }
  /* ── 消息记录 ── */
  // 【载荷形状逐点核对真实 dispatch】全部是**数组**，没有单条形态：
  // - `resetMessage(id, result)`           ← `MessageView:223` `utils.formatMessages(res)`
  // - `setMessage(id, result)`             ← `MessageView:71`  `utils.formatMessages(res)`
  // - `addMessage` 初始 SET                ← `actions.ts:1139` `[utils.formatMessage(...)]`（**已包数组**）
  // - `updateFileMessage` / `updateMessage` ← `newCurrentMessage`（`map` 结果，数组）
  // - `updateWithdrawMessage` SET          ← `currentMessage`（数组）
  // 旧注释说"单条"是错的：真实代码在 SET 前已把它包成数组。
  // 因此动作收紧为 `ChatMessage[]`，与 state 的数组形状一致。
  | { type: 'SET_MESSAGE'; id: string; result: ChatMessage[] }
  | { type: 'ADD_MESSAGE'; id: string; result: ChatMessage }
  | { type: 'ADD_PAGE_MESSAGE'; id: string; result: ChatMessage[] }
  | { type: 'PUSH_PAGE_MESSAGE'; id: string; result: ChatMessage[] }
  | { type: 'REMOVE_MESSAGE'; id: string; messageId: string }
  // 同 REMOVE_CURRENT_SESSION：`removeMessages(id: string | undefined)`。
  | { type: 'REMOVE_MESSAGES'; id: string | undefined }
  | { type: 'UPDATE_MESSAGE'; result: ChatMessagesState }
  /* ── 引用消息 ── */
  | { type: 'SET_REFER_MESSAGE'; id: string; message: ChatMessage }
  | { type: 'REMOVE_REFER_MESSAGE'; id: string }
  /* ── 定位消息 ── */
  | { type: 'SET_GOTO_MESSAGE'; id: string; messageId: string }
  | { type: 'REMOVE_GOTO_MESSAGE'; id: string }
  /* ── 底部未读 ── */
  | { type: 'SET_BOTTOM_UNREAD_MESSAGE'; id: string; message: ChatMessage }
  | { type: 'ADD_BOTTOM_UNREAD_MESSAGE'; id: string; message: ChatMessage }
  | { type: 'REMOVE_BOTTOM_UNREAD_MESSAGE'; id: string }
  // 【载荷是数组，不是单条】`updateWithdrawMessage` 的
  // `bottomUnread = (bottomUnreadMessage)[id] || []` 直接作为 `message` 派发（`actions.ts:1312`），
  // reducer 也是把整个 `action.message` 存进该键 —— 故这里是 `ChatMessage[]`。
  // （与 SET/ADD 不同：那两者的 `message` 是单条，reducer 会包成 `[message]` / 追加。）
  | { type: 'UPDATE_BOTTOM_UNREAD_MESSAGE'; id: string; message: ChatMessage[] }
  /* ── 开关 / socket ── */
  | { type: 'UPDATE_IS_WINDOW'; result: boolean }
  | { type: 'UPDATE_SHOW_ADD_RESSBOOK'; result: boolean }
  | { type: 'UPDATE_SOCKET_STATE'; result: number };

/**
 * 会话列表
 * @param {*} state
 * @param {*} action
 */
const sessionList = (state: ChatSession[] = [], action: ChatAction): ChatSession[] => {
  switch (action.type) {
    case 'SET_SESSION_LIST':
      return utils.filterSessionList(Object.assign([], action.result));
    case 'ADD_SESSION_LIST':
      return utils.filterSessionList(Object.assign([], state.concat(action.result)));
    case 'UPDATE_SESSION_LIST':
      return utils.filterSessionList(Object.assign([], action.result));
    case 'REMOVE_SESSION':
      return utils.filterSessionList(state.filter(item => item.value !== action.id));
    case 'ADD_SESSION':
      return utils.sortSession(utils.filterSessionList(Object.assign([], action.result.concat(state))));
    default:
      return state;
  }
};

/**
 * toolbar 配置数据
 * @param {*} state
 * @param {*} action
 */
const toolbarConfig = (
  state: ChatToolbarConfig = utils.getToolbarConfig(),
  action: ChatAction,
): ChatToolbarConfig => {
  switch (action.type) {
    case 'SET_TOOLBAR_CONFIG':
      return Object.assign({}, state, action.result);
    default:
      return state;
  }
};

/**
 * 当前的会话信息
 * @param {*} state
 * @param {*} action
 */
const currentSession = (state: ChatSession = {}, action: ChatAction): ChatSession => {
  switch (action.type) {
    case 'SET_CURRENT_SESSION':
      return Object.assign({}, action.result);
    default:
      return state;
  }
};

/**
 * 当前聊过天的会话信息
 * @param {*} state
 * @param {*} action
 */
const currentSessionList = (state: ChatSession[] = [], action: ChatAction): ChatSession[] => {
  switch (action.type) {
    case 'ADD_CURRENT_SESSION':
      return Object.assign([], state.concat(action.result));
    case 'REMOVE_CURRENT_SESSION':
      return state.filter(item => item.id !== action.id);
    case 'UPDATE_CURRENT_SESSION':
      return Object.assign([], action.result);
    default:
      return state;
  }
};

/**
 * 当前 inbox 的会话信息
 * @param {*} state
 * @param {*} action
 */
const currentInboxList = (state: ChatSession[] = [], action: ChatAction): ChatSession[] => {
  switch (action.type) {
    case 'ADD_INBOX_SESSION':
      return Object.assign([], state.concat(action.result));
    case 'REMOVE_INBOX_SESSION':
      return state.filter(item => item.id !== action.id);
    case 'REMOVE_ALL_INBOX_SESSION':
      return [];
    case 'UPDATE_INBOX_SESSION':
      return state.map(item => {
        if (item.value === action.id) {
          return {
            ...item,
            ...action.data,
          };
        }

        return item;
      });
    default:
      return state;
  }
};

/**
 * 消息记录
 * @param {*} state
 * @param {*} action
 */
const messages = (state: ChatMessagesState = {}, action: ChatAction): ChatMessagesState => {
  switch (action.type) {
    case 'SET_MESSAGE':
      return Object.assign({}, state, { [action.id]: action.result });
    case 'ADD_MESSAGE':
      // 原实现 `(state[id] || []).concat([result])`：缺键时以空数组起步（**这是原有行为，保留**）
      return Object.assign({}, state, {
        [action.id]: (state[action.id] || []).concat([action.result]),
      });
    case 'ADD_PAGE_MESSAGE': {
      // 【保留原 concat 调用】原实现 `action.result.concat(state[action.id])`；
      // 重写成三元/展开**不普遍等价**（稀疏槽、数组额外属性、Symbol.isConcatSpreadable、
      // 覆写 concat/迭代器、getter/原型都会不同），故调用形状不变。
      //
      // 【为什么用局部标注而不是 `!`】缺键时 `concat(undefined)` 会在末尾追加一个**真实的
      // undefined 元素**（实测 `[{id:'a'}].concat(undefined)` → 长度 2）。这是可达状态，
      // 已如实写进 `ChatMessagesState` 的元素类型 `(ChatMessage | undefined)[]`，
      // **不用非空断言把它从对外类型抹掉**。
      // 这里把 receiver 标注成 `(ChatMessage | undefined)[]`：`concat` 的签名是
      // `(T | ConcatArray<T>)[]`，当 `T` 含 `undefined` 时才能同时接受「数组」与「undefined」
      // 两种实参 —— 这正是原代码运行时会遇到的两种输入。
      // 该标注**零运行时**（只是类型），运行时仍是同一个数组引用。
      const pageResult: (ChatMessage | undefined)[] = action.result;

      return Object.assign({}, state, { [action.id]: pageResult.concat(state[action.id]) });
    }
    case 'PUSH_PAGE_MESSAGE':
      return Object.assign({}, state, { [action.id]: (state[action.id] || []).concat(action.result) });
    case 'REMOVE_MESSAGE':
      const targetState = state[action.id];
      return targetState
        ? Object.assign({}, state, {
            [action.id]: targetState.filter(item => item && item.waitingId !== action.messageId),
          })
        : state;
    case 'REMOVE_MESSAGES':
      // 【现有副作用，保留】先 delete 原 state 的键、再浅复制 —— 不是纯函数。
      // 依 lead 要求：不默默克隆、不修成纯函数；老负例（RTK 开发中间件会报变异）如实保留。
      // 【擦除标记】`action.id` 按真实生产方可为 undefined（见 ChatAction 注释）；
      // 原实现在该情形下把 undefined 转成字符串键 `"undefined"` 去 delete（等于无操作）。
      // 非空断言只擦除类型上的可空，产物与基线逐字一致（tsc/babel 两条管线均已验证）。
      delete state[action.id!];
      return Object.assign({}, state);
    case 'UPDATE_MESSAGE':
      return Object.assign({}, action.result);
    default:
      return state;
  }
};

/**
 * 引用消息
 * @param {*} state
 * @param {*} action
 */
const referMessage = (
  state: ChatReferMessageState = {},
  action: ChatAction,
): ChatReferMessageState => {
  switch (action.type) {
    case 'SET_REFER_MESSAGE':
      return Object.assign({}, state, { [action.id]: action.message });
    case 'REMOVE_REFER_MESSAGE':
      // 【现有副作用，保留】同 REMOVE_MESSAGES：先 delete 原 state 再复制。
      delete state[action.id];
      return Object.assign({}, state);
    default:
      return state;
  }
};

/**
 * 定位到某条消息
 * @param {*} state
 * @param {*} action
 */
const gotoMessage = (state: ChatGotoMessageState = {}, action: ChatAction): ChatGotoMessageState => {
  switch (action.type) {
    case 'SET_GOTO_MESSAGE':
      return Object.assign({}, state, { [action.id]: action.messageId });
    case 'REMOVE_GOTO_MESSAGE':
      // 【现有副作用，保留】先 delete 原 state 再复制。
      delete state[action.id];
      return Object.assign({}, state);
    default:
      return state;
  }
};

/**
 * 底部未读的消息
 * @param {*} state
 * @param {*} action
 */
const bottomUnreadMessage = (
  state: ChatBottomUnreadMessageState = {},
  action: ChatAction,
): ChatBottomUnreadMessageState => {
  switch (action.type) {
    case 'SET_BOTTOM_UNREAD_MESSAGE':
      return Object.assign({}, state, { [action.id]: [action.message] });
    case 'ADD_BOTTOM_UNREAD_MESSAGE':
      // 【原始失败路径，保留】这里是 `state[action.id].concat(...)`：
      // 该键缺失时会抛 TypeError，**不加空数组兜底**（lead 明确要求）。
      // 【保持原失败路径，不用 as】原实现是 `state[action.id].concat(...)`：
      // 该键缺失时抛 TypeError。这里把值取到局部变量再调 `.concat`，
      // 保持"缺键即抛"的行为，同时避免整数组断言。
      // 【必须逐字复现原语义】原实现是 `state[action.id].concat([action.message])`，
      // 它在**三种**情况下都抛错，不能只处理"缺键"：
      //   ① 该键缺失或为 null → "Cannot read properties of undefined/null (reading 'concat')"
      //   ② 该键**不是数组**（例如 `UPDATE_BOTTOM_UNREAD_MESSAGE` 写入的单条消息）
      //      → "bottomList.concat is not a function"
      // 【可达性】`SET_BOTTOM_UNREAD_MESSAGE` 写数组、`UPDATE_BOTTOM_UNREAD_MESSAGE` 写**单值**，
      // 因此 SET→UPDATE→ADD 序列真的能走到 ②。上一版我用 `Array.isArray(...) ? … : [b]`
      // 把 ② 静默包装成成功，**改变了行为**，已改回。
      // 【逐字恢复原表达式】`state[action.id].concat([action.message])`。
      // 这条表达式在三种情况下都抛错，全部是既有行为，必须原样保留：
      //   ① 缺键/undefined → "Cannot read properties of undefined (reading 'concat')"
      //   ② null           → "Cannot read properties of null (reading 'concat')"
      //   ③ 非数组（`UPDATE_BOTTOM_UNREAD_MESSAGE` 写入的单条消息，SET→UPDATE→ADD 可达）
      //                    → "state[action.id].concat is not a function"
      // 【不使用 any】原实现是 `state[action.id].concat([action.message])`，逐字保留。
      // 【窄化依据】该字典真实契约是数组（见 `ChatBottomUnreadMessageState` 与 SET/ADD/REMOVE）；
      // 非空断言只擦除"可能缺键"这层类型上的可空，**零运行时**，
      // 缺键时仍由原生以 "Cannot read properties of undefined (reading 'concat')" 失败。
      return Object.assign({}, state, {
        [action.id]: state[action.id]!.concat([action.message]),
      });
    case 'REMOVE_BOTTOM_UNREAD_MESSAGE':
      // 【现有副作用，保留】先 delete 原 state 再复制。
      delete state[action.id];
      return Object.assign({}, state);
    case 'UPDATE_BOTTOM_UNREAD_MESSAGE':
      return Object.assign({}, state, { [action.id]: action.message });
    default:
      return state;
  }
};

/**
 * 是否在新标签页聊天
 * @param {*} state
 * @param {*} action
 */
const isWindow = (state = false, action: ChatAction): boolean => {
  switch (action.type) {
    case 'UPDATE_IS_WINDOW':
      return action.result;
    default:
      return state;
  }
};

/**
 * 是否显示通讯录
 * @param {*} state
 * @param {*} action
 */
const showAddressBook = (state = false, action: ChatAction): boolean => {
  switch (action.type) {
    case 'UPDATE_SHOW_ADD_RESSBOOK':
      return action.result;
    default:
      return state;
  }
};

/**
 * socket 状态
 * @param {*} state (0：正常、1：正在重连、2：重连失败)
 * @param {*} action
 */
const socketState = (state = 0, action: ChatAction): number => {
  switch (action.type) {
    case 'UPDATE_SOCKET_STATE':
      return action.result;
    default:
      return state;
  }
};

export default combineReducers({
  sessionList,
  toolbarConfig,
  currentSession,
  currentSessionList,
  currentInboxList,
  messages,
  referMessage,
  gotoMessage,
  isWindow,
  showAddressBook,
  bottomUnreadMessage,
  socketState,
});
