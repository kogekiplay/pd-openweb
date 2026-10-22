import _ from 'lodash';
import moment from 'moment';
import Emotion from 'src/components/emotion/emotion';
import type { InboxType } from 'src/pages/chat/components/Inbox/constants';
import { INBOXTYPES } from 'src/pages/chat/components/Inbox/constants';
import { htmlDecodeReg, pathCompletion } from 'src/utils/common';
import { dateConvertToUserZone } from 'src/utils/project';
import Constant from './constant';
import type {
  ChatMessage,
  ChatNewMessageWire,
  ChatRawMessageWire,
  ChatSession,
  ChatSessionFormatInput,
  ChatSessionSender,
  ChatSessionWireNormalized,
} from '../redux/types';

/**
 * 格式化消息时间。
 * 【有限声明依据】调用方传 `dateConvertToUserZone(...)`（字符串）与 `file.time`
 * 等时间值；`moment` 接受 `string | number | undefined`，故按此声明；
 * 返回值恒为经 `.format(...)` 得到的字符串。
 */
export const formatMsgDate = (
  dateStr: string | number | undefined,
  isHourMinute = true,
): string => {
  const dateTime = moment(dateStr);
  const now = moment();
  const diff = now.diff(dateTime);
  const milliseconds = diff;
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const year = dateTime.format('YYYY');
  const simpleMonth = dateTime.format('M');
  const simpleDay = dateTime.format('D');
  const hour = dateTime.format('HH');
  const minute = dateTime.format('mm');
  const hourMinute = `${hour}:${minute}`;

  // 处理未来时间的情况
  if (diff < 0) return hourMinute;

  if (minutes < 60) {
    return hourMinute;
  } else if (dateTime.isSame(now, 'd')) {
    return _l('今天') + ` ${hourMinute}`;
  } else if (dateTime.isSame(now.subtract(1, 'd'), 'd')) {
    return _l('昨天') + (isHourMinute ? ` ${hourMinute}` : '');
  } else if (dateTime.format('YYYY') === now.format('YYYY')) {
    return `${_l('%0月%1日', simpleMonth, simpleDay)}` + (isHourMinute ? ` ${hourMinute}` : '');
  }

  return `${_l('%0年%1月%2日', year, simpleMonth, simpleDay)}` + (isHourMinute ? ` ${hourMinute}` : '');
};

/**
 * 置顶优先排序（`sortSession` 的内部辅助）。
 * 【有限声明依据】唯一调用方是 `sortSession`（本文件 99/117 行），
 * 传入的 `top` 来自 `sessions.forEach(item => top.push(item))`，元素即 `ChatSession`；
 * `value` 是当前会话 id（`string`）。返回同一批元素的重排数组。
 */
const sortTop = (list: ChatSession[], value?: string): ChatSession[] => {
  const res: ChatSession[] = [];
  const countList = list.filter(item => item.count);
  const otherList = list.filter(item => !item.count);
  list = countList.concat(otherList);
  if (value) {
    const top: ChatSession[] = [];
    list.forEach(item => {
      if (item.value == value) {
        top.push(item);
      } else {
        res.push(item);
      }
    });
    return top.concat(res);
  } else {
    return list;
  }
};

/**
 * 对置顶和草稿的数据进行排序
 * @param  {Array} sessions 列表
 * @return {Array}          排序之后的结果
 */
/**
 * 会话排序（置顶/计数/其余三段）。
 * 【有限声明依据】消费方与生产方都只用会话对象；返回的是 `sessions` 里的原元素
 * （或 `sortTop` 重排后的原元素），因此元素类型是 `ChatSession`。
 * 排序键 `sendMsg` 在 `ChatSession` 上已如实声明为 `string | null`
 * （`formatSession` 从 localStorage 取的草稿文本）。
 */
export const sortSession = (
  sessions: ChatSession[],
  value?: string,
  messageListShowType: number | undefined = md.global.Account.messageListShowType,
): ChatSession[] => {
  sessions = _.orderBy(sessions, ['sendMsg']);
  // 三个分组桶只装会话对象（下面 push 的都是 sessions 的元素）
  const other: ChatSession[] = [];
  const top: ChatSession[] = [];
  const count: ChatSession[] = [];

  if (messageListShowType === 1) {
    sessions.forEach(item => {
      const isTop = item.top_info ? item.top_info.isTop : false;

      if (isTop) {
        top.push(item);
      } else if (item.count && ('isPush' in item ? item.isPush : true)) {
        count.push(item);
      } else {
        other.push(item);
      }
    });
    const sortList = sortTop(top, value).sort((a, b) => {
      const aHasValue = a.count != null && a.count !== 0;
      const bHasValue = b.count != null && b.count !== 0;
      if (aHasValue && !bHasValue) return -1;
      if (!aHasValue && bHasValue) return 1;
      return 0;
    });
    return count.concat(sortList, other);
  } else {
    sessions.forEach(item => {
      const isTop = item.top_info ? item.top_info.isTop : false;

      if (isTop) {
        top.push(item);
      } else {
        other.push(item);
      }
    });
    return sortTop(top, value).concat(other);
  }
};

/**
 * 处理会话列表的数据
 * @param {*} sessionList
 */
/**
 * 批量格式化会话（API 原始返回或现有会话 → 会话对象）。
 * 【有限声明依据】调用点为 `actions.setSessionList`/`addSessionList`，结果经 `sortSession`
 * 存入 `sessionList`，故是 `ChatSession[]`。入参保留 `Array.isArray` 防御。
 */
export const formatSessionList = (sessionList: ChatSessionFormatInput[]): ChatSession[] => {
  sessionList = (Array.isArray(sessionList) ? sessionList : []).filter(item => item);
  return sessionList.map(item => {
    return formatSession(item);
  });
};

/**
 * 单条会话格式化（原地补 type/isGroup/sendMsg 等派生字段后返回同一对象）。
 * `sendMsg` 在此赋 `localStorage.getItem(...)`（`string | null`），是
 * `ChatSession.sendMsg` 类型的直接来源。
 */
const formatSession = (item: ChatSessionFormatInput): ChatSession => {
  item.type = Number(item.type);
  if (item.type === Constant.SESSIONTYPE_USER || item.type === Constant.SESSIONTYPE_GROUP) {
    item.isGroup = item.type === Constant.SESSIONTYPE_GROUP;
  }

  if (item.from && !item.sysType) {
    const { iswd } = item;
    // 【擦除标记：from 是有限联合（对象 | 字符串）】系统通知透传时 `from` 仍是字符串，
    // 对其取 `.id` 运行期为 `undefined`（与基线完全一致）；这里用擦除式收窄表达该读取，
    // 不改变运行表达式（`as` 被编译器剥离）与原生行为。
    const isSelf = (item.from as ChatSessionSender).id === md.global.Account.accountId;
    const isAdmin = item.wdAdminid === md.global.Account.accountId;
    const isFileTransfer = item.value === 'file-transfer';
    const wdAdminid = item.wdAdminid;

    if (isSelf) {
      // 标注为 string | undefined：wire 的 msg.con 可缺（解码后为空串兜底由 htmlDecodeReg 处理）
      let con: string | undefined = '';

      if (isFileTransfer) {
        con = item.msg!.con;
      } else if (iswd) {
        con = wdAdminid ? `${_l('管理员撤回了一条你的消息')}` : `${_l('你')}${item.msg!.con}`;
      } else {
        con = `${_l('我')}: ${item.msg!.con}`;
      }

      item.msg!.con = con;
    } else {
      // 标注为 string | undefined：wire 的 msg.con 可缺（解码后为空串兜底由 htmlDecodeReg 处理）
      let con: string | undefined = '';

      if (iswd) {
        if (wdAdminid) {
          con = isAdmin
            ? `${_l('你撤回了成员“%0”的一条消息', (item.from as ChatSessionSender).name as string)}` : `${_l('管理员撤回了一条成员消息')}`;
        } else {
          con = `"${(item.from as ChatSessionSender).name}"${item.msg!.con}`;
        }
      } else {
        con = `${(item.from as ChatSessionSender).name}: ${item.msg!.con}`;
      }

      item.msg!.con = con;
    }
  } else {
    switch (item.type) {
      case Constant.SESSIONTYPE_SYSTEM:
        item.name = _l('系统');
        item.iconType = 'system';
        break;
      case Constant.SESSIONTYPE_POST:
        item.name = _l('动态');
        item.iconType = 'post';
        break;
      case Constant.SESSIONTYPE_CALENDAR:
        item.name = _l('日程');
        item.iconType = 'calendar';
        break;
      case Constant.SESSIONTYPE_TASK:
        item.name = _l('任务');
        item.iconType = 'task';
        break;
      case Constant.SESSIONTYPE_KNOWLEDGE:
        item.name = _l('知识');
        item.iconType = 'knowledge';
        break;
      case Constant.SESSIONTYPE_HR:
        item.name = _l('人事');
        item.iconType = 'hr';
        break;
      case Constant.SESSIONTYPE_WORKSHEET:
        item.name = _l('应用');
        item.iconType = 'worksheet';
        break;
      case Constant.SESSIONTYPE_WORKFLOW:
        item.name = _l('工作流');
        item.iconType = 'workflow';
        break;
      default:
        break;
    }
  }

  item._time = item.time;
  item.time = formatMsgDate(dateConvertToUserZone(item.time), false);
  item.messageAtlist = item.atlist;
  item.sendMsg = localStorage.getItem(`textareaValue${item.value}`);
  item.msg!.con = htmlDecodeReg(item.msg!.con);

  // 【归一化点】以上逐属性写入完成后已是 ChatSession 形态；
  // 按 lead 13:23 方案，此处允许归一化之后的局部窄化断言。
  return item as ChatSession;
};

/**
 * 会话列表按 `value` 去重（`_.groupBy('value')` 取每组第一个）。
 * 【有限声明依据】四条 reducer 写入路径都传会话数组；返回值直接存入 `sessionList`，
 * 故元素类型是 `ChatSession`。
 * 【为什么这里可以有非空断言】`value[0]` 在 `noUncheckedIndexedAccess` 下被推断为
 * `ChatSession | undefined`，但 `_.groupBy` 的**分组永不为空**（每个元素必然落入某一组），
 * 因此该 `undefined` 是**不可达**的 —— 与「可达 undefined 不得用 `!` 抹掉」不同。
 * 不改成 `.filter(Boolean)`：那会为类型绿灯改变实现（lead 明确不允许）。
 */
export const filterSessionList = (list: ChatSession[]): ChatSession[] => {
  list = _.chain(list)
    .groupBy('value')
    .map(value => {
      return value[0]!;
    })
    .value();
  return list;
};

/**
 * 处理聊天消息的数据
 * @param {*} messages
 */
/**
 * 批量格式化消息（原始接口返回 → 可渲染消息）。
 *
 * 【为什么保持未标注】它的入参是**接口原始返回**，在 3 个范围外调用点
 * （`MessageView` 里调用 `ajax.getMessage(...)` 之后）`res` 的类型是 `unknown`（来自 `getMessage(...)` 的
 * Promise 结果，经 `_.isArray` 判断后仍未收窄）。一旦把入参标注为 `ChatMessage[]`，
 * 这 3 处会新增 `TS2345` —— 属**范围外**文件，按 lead 规则不在本批编辑、
 * 由 lead 处理实现侧。因此这里保持原有未标注形态，`any` 残留在下方"未覆盖"中如实列出。
 */
/**
 * 批量格式化消息（接口原始返回 → 可渲染消息）。
 * 【有限声明依据】4 个直接生产方（`resetMessage`/`setMessage`/`addPageMessage`/
 * `pushPageMessage`）的载荷都来自这里，返回 `ChatMessage[]`。
 */
export const formatMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map((item, index: number) => {
    return formatMessage(item, messages[index - 1]);
  });
};

/**
 * 单条消息格式化（原地补充 `timestamp`/`isMine`/`isDuplicated` 等派生字段后返回同一对象）。
 * 同 `formatMessages`：入参来自接口原始消息，标注会在范围外调用点新增诊断，故保持未标注。
 */
/**
 * 单条消息格式化（原地补 `timestamp`/`isMine` 等派生字段后返回同一对象）。
 * 【有限声明依据】返回值直接进入 `messages` 字典，故是 `ChatMessage`。
 */
export const formatMessage = (message: ChatMessage, prevMessage?: ChatMessage): ChatMessage => {
  message.timestamp = formatMsgDate(dateConvertToUserZone(message.time));
  message.isMine = message.from === md.global.Account.accountId;
  // 连续消息
  if (
    message &&
    prevMessage &&
    message.from === prevMessage.from &&
    moment(message.time).valueOf() - moment(prevMessage.time).valueOf() <= 60 * 3000
  ) {
    message.timestamp = null;
    if (prevMessage.iswd || prevMessage.sysType) {
      message.isDuplicated = false;
    } else {
      const isText = message.type === Constant.MSGTYPE_TEXT;
      message.isDuplicated = isText;
      if (isText) {
        message.timestamp = null;
      }
    }

    if (message.unreadLine) {
      message.isDuplicated = false;
    }
  }

  return message;
};

/**
 * 处理收到的新消息
 * @param {*} message
 */
/**
 * 把 socket 收到的新消息格式化后并入消息列表。
 * 【有限声明依据】`actions.ts` 的 `receiveMessage` 里用它替换 `message`，
 * 随后参与 `messages` 字典；返回 `ChatMessage`。
 * 入参是**原始 socket 载荷**（未经过 `formatMessage`），故保持未标注并在下方"未覆盖"中列出。
 */
export const formatNewMessage = (
  message: ChatNewMessageWire,
  prevMessage?: ChatMessage,
): ChatMessage => {
  message.iswd = false;
  message.fromAccount = {
    id: message.from as string | undefined,
    name: message.uname,
    logo: message.logo,
  };
  // 【归一化点】以上逐属性写入完成后，对象已是 ChatMessage 形态；
  // 按 lead 13:23 方案，此处允许**归一化之后的局部窄化断言**（不是从 any/unknown 整体 as）。
  return formatMessage(message as ChatMessage, prevMessage);
};

/**
 * 处理收到的新消息处理成会话
 * @param {*} message
 */
/**
 * 把 socket 收到的新消息处理成**会话**对象。
 * 【有限声明依据】`actions.ts` 的 `addSession` 里 `result = utils.formatNewSession(result)` 后
 * 直接进入会话列表流程；返回 `ChatSession`。
 * 入参是**原始 socket 载荷**（`msg` 在该分支里是字符串而非对象），故保持未标注。
 */
/**
 * 公开调用签名：**只接受有限原始 wire**（`from` 只能是发送者 id 字符串、`msg` 按形态有限）。
 * lead 2026-10-20 反例 2（对象 `from` 被再包一层）在此被**编译期拒绝**，
 * 而不是靠末尾 `as` 抹平。
 */
type FormatNewSession = (message: ChatRawMessageWire) => ChatSession;

export const formatNewSession: FormatNewSession = (
  message: ChatRawMessageWire | ChatSessionWireNormalized,
): ChatSession => {
  // 【三层合同（lead 2026-10-20 反例 2 的修法）】
  //   · 原始 wire（**公开签名**）：`from` 只能是 id 字符串；`msg` 系统分支是 string、普通分支是对象；
  //   · 过渡形态（**实现签名**里才允许）：本函数对**同一对象**逐属性原地改型
  //     （系统分支 msg 包成对象；普通分支 from 变成发送者对象）；
  //   · 输出形态：`ChatSession`。
  // 实现签名取"原始 ∪ 过渡"的联合，于是**写入点不需要任何断言**；
  // 运行表达式/对象引用/读取次数与基线逐字一致。
  if ('dtype' in message) {
    // 系统消息
    message.msg = {
      // 读取点擦除式收窄：该分支里 msg 仍是**原始字符串**（尚未被包成对象）。
      con: message.msg as string | undefined,
    };
    message.time = getCurrentTime();
    message.value = message.id;
  } else {
    // 个人或者群组消息
    message.iswd = false;
    message.name = message.isGroup ? message.groupname : message.uname;
    message.msgid = message.id;
    message.value = message.isGroup
      ? message.to
      : md.global.Account.accountId === message.from
        ? message.to
        : (message.from as string | undefined);
    message.logo = message.isGroup ? message.avatar : message.logo;
    message.type = message.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    message.time = message.time ? message.time : getCurrentTime();
    // 【发送者对象：`name` 如实可为 undefined】`uname` 在普通消息 wire 上**可选**
    // （群会话走 `groupname`；lead 反例 `{ id:'m', from:'u', msg:{...}, type:1 }` 就没有 uname），
    // 故这里**不再**用 `message.uname as string` 假装它是 string —— `ChatSessionSender.name`
    // 已如实声明可选。`from` 本身仍按原表达式逐属性写入（不新增默认值/运行检查）。
    message.from = {
      id: message.from as string | undefined,
      name: message.uname,
      avatar: message.logo,
    };
  }

  // 归一化点：以上写入完成后对象已是会话形态，交给 `formatSession` 做统一归一化。
  // 过渡类型是**两分支各自的真实结果**（系统分支无 from），不是"from 必有对象"的单一声称。
  return formatSession(message as ChatSessionWireNormalized);
};

/**
 * 获取UUID
 */
export const getUUID = (function () {
  function id() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return function () {
    return id() + id() + '-' + id() + '-' + id() + '-' + id() + '-' + id() + id() + id();
  };
})();

/**
 * 获取服务器时间
 */
export const getCurrentTime = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
};

export const cardDisposeName = card => {
  const { md, entityid, extra } = card;

  switch (md) {
    case 'task':
      return {
        name: _l('任务'),
        param: {
          task: entityid,
        },
      };
    case 'calendar':
      return {
        name: _l('日程'),
        param: {
          calendar: entityid,
        },
      };
    case 'post':
      return {
        name: _l('动态'),
        noTiele: true,
        isPost: true,
        param: {
          post: entityid,
        },
      };
    case 'vote':
      return {
        name: _l('投票'),
        noTiele: true,
        param: {
          post: entityid,
        },
      };
    case 'kcfile':
      return {
        name: _l('知识'),
      };
    case 'kcfolder':
      return {
        name: _l('知识文件夹'),
        noTiele: true,
      };
    case 'url':
      return {
        name: _l('链接'),
      };
    case 'worksheetrow':
      const { rowId } = extra || {};
      return {
        param: {
          worksheetrow: `${entityid}>${rowId}`,
        },
      };
    case 'worksheet':
      return {
        name: _l('应用'),
        // param: {
        //   worksheet: entityid,
        // }
      };
    default:
      return {
        name: _l('链接'),
      };
  }
};

/**
 * 链接转化,将字符串中的链接转化为成a 标签
 * @param {*} str
 */
export const toLink = str => {
  // url前面加一个空格
  // str = str.replace(/(http|https|ftp):\/\//ig, ' $1://');
  const urlReg = /((http|https|ftp):\/\/|w{1,3}\.)[^\s|<|\u4E00-\u9FA5]+/gi;
  // var urlReg = /((http|https|ftp):\/\/|www)[^\s\|<\|\u4E00-\u9FA5]*[^(http|https|ftp:\/\/)]/ig;
  return str.replace(urlReg, m => {
    let _href = m;

    if (m.match(/^w{1,3}/)) {
      _href = 'http://' + m;
    }

    return '<a class="convertLink" target="_blank" href="' + _href + '">' + m.replace('&', '&amp;') + '</a>';
  });
};

/**
 * 标签转化
 * @param {*} msg
 */
export const tagConvert = msg => {
  return msg.replace(/</g, '&lt').replace(/>/g, '&gt;');
};

/**
 * 解析消息中的文本
 * @param {*} message
 */
export const messageContentParser = message => {
  return Emotion.parse(toLink(tagConvert(message)).replace(/\n/g, '<br>').replace(/\s{2}/g, ' &nbsp;'));
};

/**
 * 格式化文件大小，像8MB20KB这样的显示格式
 * @param {*} size
 */
export const formatFileSize = (size = 0) => {
  let byteSize = Math.round((size / 1024) * 100) / 100;
  let suffix = 'K';

  if (byteSize > 1024) {
    byteSize = Math.round((byteSize / 1024) * 100) / 100;
    suffix = 'M';
  } else {
    byteSize = Number(byteSize).toFixed(0);
  }

  return byteSize + suffix;
};

/**
 * 抖动聊天窗口
 * @param {*} id
 */
export const shake = id => {
  const el = $(`#ChatPanel-${id}`).find('.ChatPanel-sessionList');
  el.addClass('ChatPanel-shake').on(
    'webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend',
    function (this: HTMLElement) {
      $(this).removeClass('ChatPanel-shake');
    },
  );
};

/**
 * 引用消息高亮
 * @param {*} id
 */
export const highlightReferMessage = id => {
  setTimeout(() => {
    const el = $(`#ChatPanel-${id}`).find('.ChatPanel-MessageRefer');
    highlight(el);
  }, 0);
};

/**
 * 消息高亮
 * @param {*} id
 */
export const highlightMessage = id => {
  const el = $(`#Message-${id}`).find('.Message-container');
  highlight(el);
};

/**
 * 高亮dom
 * @param {*} el
 */
const highlight = (el: JQuery<HTMLElement>) => {
  const className = 'highlight';
  el.addClass(className).on(
    'webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend',
    function (this: HTMLElement) {
      $(this).removeClass(className);
    },
  );
};

/**
 * 滚动到底部
 * @param {*} id
 * @param {*} isBottom
 */
export const scrollEnd = (id, isBottom = false) => {
  const scrollView = window[`scrollView-${id}`];

  if (scrollView) {
    const { scrollTop, maxScrollTop } = scrollView.getScrollInfo();

    if (maxScrollTop && (isBottom || maxScrollTop - scrollTop < 200)) {
      scrollView.scrollTo({ top: maxScrollTop });
    }
  }
};

/**
 * 会话列表滚动到顶部
 * @param {*} id
 */
export const sessionListScrollTop = () => {
  const scrollView = $('.ChatList-sessionList-wrapper .scroll-viewport')[0];
  scrollView.scrollTo({ top: 0 });
};

/**
 * 开启消息提示
 */
let flashTitleInterval: null | number = null;

export const flashTitle = () => {
  if (!window.isOpenMessageTwinkle) return;
  if (flashTitleInterval) return;
  flashTitleInterval = window.setInterval(() => {
    let _title = window.document.title;

    if (_title.indexOf('【' + _l('新消息') + '】') === -1) {
      window.document.title = '【' + _l('新消息') + '】' + _title.replace('【　　　】', '');
    } else {
      window.document.title = '【　　　】' + _title.replace('【' + _l('新消息') + '】', '');
    }

    _title = window.document.title;
  }, 600);
};

/**
 * 关闭消息提示
 */
export const removeFlashTitle = (value, sessionList) => {
  const list = sessionList.filter(session => session.value !== value);

  if (!isCount(list)) {
    window.clearInterval(flashTitleInterval);
    flashTitleInterval = null;
    window.document.title = window.document.title.replace('【' + _l('新消息') + '】', '').replace('【　　　】', '');
  }
};

/**
 * 播放提示音。
 *
 * 【必须接住这个 Promise】浏览器的自动播放策略要求页面先有过用户交互，
 * 否则 play() 返回的 Promise 会以 NotAllowedError 拒绝：
 *   Uncaught (in promise) NotAllowedError: play() failed because the user
 *   didn't interact with the document first.
 * 用户一打开页面就收到消息时必然触发（本来也就是放不出声，不是故障），
 * 不接住就变成一条红色的未捕获拒绝，还会污染错误上报。
 */
function playPromptAudio(elementId: string): void {
  if (!window.isOpenMessageSound || !window.isNewTab()) return;

  const audio = document.getElementById(elementId) as HTMLAudioElement | null;
  if (!audio) return;

  // play() 在老浏览器里可能不返回 Promise，所以要判一下再挂 catch
  const played = audio.play();
  if (played && typeof played.catch === 'function') {
    played.catch(() => {
      /* 没有用户交互，放不了就算了 */
    });
  }
}

/**
 * 聊天新消息的语音提示
 */
export const playSessionNewMsgAudio = () => playPromptAudio('sessionNewMsgAudio');

/**
 * 系统新消息的语音提示
 */
export const playSystemNewMsgAudio = () => playPromptAudio('systemNewMsgAudio');

/**
 * 新聊天页
 * @param {*} id
 * @param {*} isGroup
 */
export const windowOpen = (id: string | undefined, name: string | undefined, isGroup: boolean) => {
  const type = isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
  const iTop = (window.screen.availHeight - 660) / 2; // 获得窗口的垂直位置;
  const iLeft = (window.screen.availWidth - 930) / 2; // 获得窗口的水平位置;
  const options = 'width=930,height=598,toolbar=no,menubar=no,location=no,status=no,top=' + iTop + ',left=' + iLeft;
  window.open(
    pathCompletion(`/chat_window?id=${encodeURIComponent(String(id))}&name=${encodeURIComponent(String(name))}&type=${type}`),
    '_blank',
    options,
  );
};

/**
 * 管理全局聊天的窗口
 */
export const chatWindow = {
  set(id: string | undefined) {
    safeLocalStorageSetItem(`chat_window_${id}`, String(true));
  },
  remove(id: string | undefined) {
    localStorage.removeItem(`chat_window_${id}`);
  },
  is(id: string | undefined) {
    return !!localStorage.getItem(`chat_window_${id}`);
  },
};

/**
 * 获取光标的位置
 * @param {*} el
 */
export const getCursortPosition = el => {
  let cursorIndex = 0;

  if (document.selection) {
    el.focus();
    let range = document.selection.createRange();
    range.moveStart('character', -el.value.length);
    cursorIndex = range.text.length;
  } else if (el.selectionStart || el.selectionStart == 0) {
    cursorIndex = el.selectionStart;
  }

  return cursorIndex;
};

/**
 * 记录光标的位置
 * @param {*} id
 */
export const recordCursortPosition = id => {
  const el = $(`#ChatPanel-${id} textarea`);
  window.currentCursortPosition = getCursortPosition(el.get(0));
};

/**
 * 获取 inbox 的 value
 * @param {*} type
 */
export const getInboxId = function (type) {
  switch (type * 1) {
    case Constant.SESSIONTYPE_SYSTEM:
      return 'system';
    case Constant.SESSIONTYPE_POST:
      return 'post';
    case Constant.SESSIONTYPE_CALENDAR:
      return 'calendar';
    case Constant.SESSIONTYPE_TASK:
      return 'task';
    case Constant.SESSIONTYPE_KNOWLEDGE:
      return 'knowledge';
    case Constant.SESSIONTYPE_HR:
      return 'hr';
    case Constant.SESSIONTYPE_WORKSHEET:
      return 'worksheet';
    case Constant.SESSIONTYPE_WORKFLOW:
      return 'workflow';
    default:
      return '';
  }
};

export const getIsInbox = (id: unknown): id is InboxType => _.toArray<unknown>(INBOXTYPES).includes(id);

/**
 * 是否还存在计数
 * @param {*} list
 */
export const isCount = list => {
  let isCount = false;

  for (let i = 0; i < list.length; i++) {
    const session = list[i] || {};
    const hasPush = 'isPush' in session ? session.isPush : true;
    const notSilient = 'isSilent' in session ? !session.isSilent || [1, 2].includes(session.showBadge) : true;

    if (session && session.count && hasPush && notSilient) {
      isCount = true;
      continue;
    }
  }

  return isCount;
};

export const getToolbarConfig = () => {
  const mingoFixing = localStorage.getItem('mingoFixing') === 'true';
  const sessionListFixing = localStorage.getItem('sessionListFixing') === 'true';
  const favoriteFixing = localStorage.getItem('favoriteFixing') === 'true';
  const toolBarOpenType = localStorage.getItem('toolBarOpenType');
  return {
    mingoVisible: toolBarOpenType === 'mingo' && mingoFixing,
    mingoFixing,
    sessionListVisible: toolBarOpenType === 'sessionList' && sessionListFixing,
    sessionListFixing,
    favoriteVisible: toolBarOpenType === 'favorite' && favoriteFixing,
    favoriteFixing,
  };
};

export const convertGroupAbout = value => {
  return value ? toLink(tagConvert(value)).replace(/\r\n|\n/gi, '<br/>') : _l('暂无群公告');
};
