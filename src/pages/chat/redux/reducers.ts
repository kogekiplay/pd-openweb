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
  | { type: 'REMOVE_CURRENT_SESSION'; id: string }
  | { type: 'UPDATE_CURRENT_SESSION'; result: ChatSession[] }
  /* ── inbox 会话列表 ── */
  | { type: 'ADD_INBOX_SESSION'; result: ChatSession[] }
  | { type: 'REMOVE_INBOX_SESSION'; id: string }
  | { type: 'REMOVE_ALL_INBOX_SESSION' }
  | { type: 'UPDATE_INBOX_SESSION'; id: string; data: Partial<ChatSession> }
  /* ── 消息记录 ── */
  // 载荷形状取自真实生产方：
  // - `resetMessage(id, result)` → `utils.formatMessages(res)`（**数组**）
  // - `addMessage` 里 `SET_MESSAGE` 的 result 是**单条** `utils.formatMessage(...)`
  // - `addPageMessage/pushPageMessage(id, result)` → **数组**
  | { type: 'SET_MESSAGE'; id: string; result: ChatMessage | ChatMessage[] }
  | { type: 'ADD_MESSAGE'; id: string; result: ChatMessage }
  | { type: 'ADD_PAGE_MESSAGE'; id: string; result: ChatMessage[] }
  | { type: 'PUSH_PAGE_MESSAGE'; id: string; result: ChatMessage[] }
  | { type: 'REMOVE_MESSAGE'; id: string; messageId: string }
  | { type: 'REMOVE_MESSAGES'; id: string }
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
  | { type: 'UPDATE_BOTTOM_UNREAD_MESSAGE'; id: string; message: ChatMessage }
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
      // 原实现 `result.concat(state[id])`。缺键时 `concat(undefined)` 会在末尾**追加一个
      // undefined 元素**（实测 `[1,2].concat(undefined)` → `[1,2,undefined]`）——原有边界行为，不兜底。
      // `Array.prototype.concat(undefined)` 在类型上不合法，故用**显式分支**表达同一语义；
      // 行为等价已由 reducers.spec.ts 的 A/B 用例证明。
      const existing = state[action.id];

      return Object.assign({}, state, {
        [action.id]: existing === undefined ? [...action.result, undefined] : action.result.concat(existing),
      });
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
      delete state[action.id];
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
      // 【为什么需要类型标注】该键的声明类型是 `ChatMessage[] | ChatMessage`
      // （生产方确实两种都写），所以 `.concat` 在类型上不总存在 —— 这正是真实失败点。
      // 这里把读取结果标注为 `any` 是**局部**的、只为让原表达式原样通过编译，
      // 不改变任何运行时行为，也不扩大对外类型（对外仍是 `ChatBottomUnreadMessageState`）。
      const bottomList: any = state[action.id];

      return Object.assign({}, state, { [action.id]: bottomList.concat([action.message]) });
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
