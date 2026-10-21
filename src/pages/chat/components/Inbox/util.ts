// linkify-it 6 去掉了 default export，类要从具名导出取。
import { LinkifyIt } from 'linkify-it';
import moment from 'moment';
import { browserIsMobile, htmlEncodeReg, pathCompletion } from 'src/utils/common';
import { MSGTYPES, SOURCE_TYPE } from './constants';

/** 收件箱创建人 */
interface InboxCreateUser {
  accountId?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
}

/** 收件箱条目（`formatInboxItem` 真实读取的字段；其余在索引签名里） */
export interface InboxItem {
  CreateUser?: InboxCreateUser | undefined;
  /**
   * 收件箱里的讨论对象。`wrappedComp/commonTopic` 直接读 name/sourceId/extendsId/sourceType/
   * message/accountsInMessage/isDeleted/canReply，故逐个声明（其余仍在索引签名里）。
   */
  discussion?:
    | {
        entityName?: string | undefined;
        /** 讨论标题/正文摘要（`mergeFromSourceState` 作为 fromMessage） */
        name?: string | undefined;
        /** 来源实体 id（拼来源链接） */
        sourceId?: string | undefined;
        /** 工作表场景的 `appId|viewId` 串（`extendsId.split('|')[0]`） */
        extendsId?: string | undefined;
        /** 来源类型（`SOURCE_TYPE`） */
        sourceType?: number | undefined;
        /** 讨论正文（`createLinksForMessage` 输入） */
        message?: string | undefined;
        /** 消息 @ 的人（`createLinksForMessage` 的 rUserList） */
        accountsInMessage?: unknown[] | undefined;
        isDeleted?: boolean | undefined;
        canReply?: boolean | undefined;
      }
    | undefined;
  /** 收件箱条目创建时间（`mergeTopicState` 原样透传给消息组件） */
  createTime?: string | number | undefined;
  /** Star 的真实输入和更新值都是字符串标记。 */
  isFavorite?: '0' | '1' | undefined;
  /** 后端可能给字符串数字（本函数用 `parseInt` 归一化） */
  inboxType?: string | number | undefined;
  inboxId?: string | number | undefined;
  /**
   * 动态（Post）类型收件箱条目的载荷。
   * 【为什么显式声明】此前靠根层 `[key: string]: unknown` 兜住，导致拼错 `inboxTyp`/`accountID`
   * 等也会被放行（lead 2026-10-21 反例 2）。真实消费点 `postMention.tsx` 会读它，
   * 故这里按其真实读取形状声明；其余未读字段不再用宽索引兜。
   */
  Post?:
    | {
        postID?: string | undefined;
        message?: string | undefined;
        postType?: number | undefined;
        comments?: unknown[] | undefined;
        commentCount?: string | number | undefined;
        rUserList?: unknown;
        rGroupList?: unknown;
        categories?: unknown;
        linkTitle?: string | undefined;
        linkUrl?: string | undefined;
        linkThumb?: string | undefined;
        linkDesc?: string | undefined;
      }
    | undefined;
}

/** 评论/动态条目（`formatTopic` 两个分支读取字段的并集） */
interface TopicSource {
  user?:
    | {
        accountId?: string | undefined;
        userMiddleHead?: string | undefined;
        userName?: string | undefined;
      }
    | undefined;
  replyID?: string | number | undefined;
  replyUser?:
    | { accountId?: string | undefined; userName?: string | undefined }
    | undefined;
  replyAccountId?: string | undefined;
  replyUserName?: string | undefined;
  allowOperate?: string | undefined;
  attachments?: unknown[] | undefined;
  askDeleteAttachment?: string | undefined;
  postID?: string | undefined;
  commentID?: string | undefined;
  message?: unknown;
  rUserList?: unknown;
  rGroupList?: unknown;
  createTime?: number | string | undefined;
  Secretary?: unknown;
  createAccount?: { accountId?: string | undefined } | undefined;
  replyId?: string | null | undefined;
  sourceId?: string | undefined;
  name?: string | undefined;
  discussionId?: string | undefined;
  replyAccount?: unknown;
  accountsInMessage?: unknown;
}

/**
 * 【真实缺失常量，待 lead 决策】`MSGTYPES` 里没有 `CheckMentioned/CheckReply/CheckComment` 三个键：
 * 这三条 case 的判别值在运行期是 `undefined`，而 `parseInt(inboxType)` 只会得到数值或 NaN，
 * 因此它们**不会命中任何真实消息**（既有死分支）。本批不改行为（新增常量值属于业务变更），
 * 只用擦除式读法把「键缺失」如实表达出来。
 */
export const formatInboxItem = function (inboxItem: InboxItem) {
  const createUser = inboxItem.CreateUser || {};
  const { accountId, fullname, avatar } = createUser;
  // 擦除标记：工作表类消息必带 discussion（原 any 直接解构）；缺省时原实现抛原生 TypeError。
  const { discussion } = inboxItem as { discussion: { entityName?: string | undefined } };

  let typeName = '';
  // 擦除标记：`inboxType` 的声明是 string | number，parseInt 内部 ToString 与 String() 等价。
  // 单次断言即可：`string` 已是该字段联合的成员；parseInt 的 ToString 对数字等价。
  const inboxType = parseInt(inboxItem.inboxType as string, 10);

  switch (inboxType) {
    // 私信 deprecated
    case MSGTYPES.UserMessage:
      typeName = "<span class='textTertiary'>" + _l('对你说') + '</span>';
      break;
    // 各种系统消息
    case MSGTYPES.SystemMessage:
    case MSGTYPES.CalendarMessage:
    case MSGTYPES.TaskMessage:
    case MSGTYPES.FolderMessage:
    case MSGTYPES.KCMessage:
    case MSGTYPES.ApprovalMessage:
    case MSGTYPES.WorkSheetMessage:
    case MSGTYPES.WorkFlowMessage:
    case MSGTYPES.WorkFlowTaskMessage:
    case MSGTYPES.WorkFlowUserTaskMessage:
    case MSGTYPES.WorkFlowSendTaskMessage:
      typeName = '';
      break;
    case MSGTYPES.AttendanceMessage:
      typeName = "<span class='textTertiary'>" + _l('考勤消息') + '</span>';
      break;
    case MSGTYPES.DossierMessage:
      typeName = "<span class='textTertiary'>" + _l('人事消息') + '</span>';
      break;
    // 动态消息
    case MSGTYPES.PostMentionedUser:
      typeName = _l('提到了你');
      break;
    case MSGTYPES.PostMentionedGroup:
      typeName = _l('提到了你所在的群组');
      break;
    case MSGTYPES.PostCommentMentionedUser:
      typeName = _l('在回复中提到了你');
      break;
    case MSGTYPES.PostCommentMentionedGroup:
      typeName = _l('在回复中提到了你所在的群组');
      break;
    case MSGTYPES.PostReply:
      typeName = _l('回复了你');
      break;
    // 任务中心
    case MSGTYPES.TaskComment:
      typeName = _l('发表了任务讨论');
      break;
    case MSGTYPES.TaskMentioned:
      typeName = _l('在任务讨论中提到了你');
      break;
    case MSGTYPES.TaskReply:
      typeName = _l('在任务讨论中回复了你');
      break;
    case MSGTYPES.FolderMentioned:
      typeName = _l('在项目讨论中提到了你');
      break;
    case MSGTYPES.FolderReply:
      typeName = _l('在项目讨论中回复了你');
      break;
    // 日程
    case MSGTYPES.CalendarComment:
      typeName = _l('发表了日程讨论');
      break;
    case MSGTYPES.CalendarMentioned:
      typeName = _l('在日程讨论中提到了你');
      break;
    case MSGTYPES.CalendarReply:
      typeName = _l('在日程讨论中回复了你');
      break;
    // 审批
    case MSGTYPES.ApprovalMentioned:
      typeName = _l('在审批讨论中提到了你');
      break;
    case MSGTYPES.ApprovalReply:
      typeName = _l('在审批讨论中回复了你');
      break;
    case MSGTYPES.ApprovalComment:
      typeName = _l('发表了审批讨论');
      break;
    // 考勤
    case (MSGTYPES as { CheckMentioned?: number }).CheckMentioned as number: // 键缺失，见文件头注释
      typeName = _l('在考勤讨论中提到了你');
      break;
    case (MSGTYPES as { CheckReply?: number }).CheckReply as number:
      typeName = _l('在考勤讨论中回复了你');
      break;
    case (MSGTYPES as { CheckComment?: number }).CheckComment as number:
      typeName = _l('发表了考勤讨论');
      break;
    // 工作表
    case MSGTYPES.WorkSheetReply:
      typeName = _l('在%0讨论中回复了你', htmlEncodeReg(discussion.entityName));
      break;
    case MSGTYPES.WorkSheetMentioned:
      typeName = _l('在%0讨论中提到了你', htmlEncodeReg(discussion.entityName));
      break;
    case MSGTYPES.WorkSheetComment:
      typeName = _l('发表了%0讨论', htmlEncodeReg(discussion.entityName));
      break;
    // 工作表记录
    case MSGTYPES.WorkSheetRowReply:
      typeName = _l('在%0讨论中回复了你', htmlEncodeReg(discussion.entityName));
      break;
    case MSGTYPES.WorkSheetRowMentioned:
      typeName = _l('在%0讨论中提到了你', htmlEncodeReg(discussion.entityName));
      break;
    case MSGTYPES.WorkSheetRowComment:
      typeName = _l('发表了%0讨论', htmlEncodeReg(discussion.entityName));
      break;
    case MSGTYPES.FocusMessage:
      typeName = _l('在%0中发布了讨论', htmlEncodeReg(discussion.entityName));
      break;

    default:
      break;
  }

  return {
    isFavorite: inboxItem.isFavorite,
    typeName: typeName,
    /**
     * user data
     */
    accountId,
    fullname,
    avatar,

    /**
     * avatar data
     */
    inboxType,
    inboxId: inboxItem.inboxId,
  };
};

export const formatTopic = function (item: TopicSource, type: number | undefined) {
  // 两个分支写入的字段并集；调用方均未类型化，这里用记录类型承接
  var formatedData: Record<string, unknown> = {};
  var User;
  var ReplyUser;
  var isReply;
  var canDelete;
  if (type === SOURCE_TYPE.POST) {
    User = item.user as NonNullable<TopicSource['user']>;
    isReply = item.replyID;
    ReplyUser = null;
    if (isReply && item.replyUser) {
      ReplyUser = {
        accountId: item.replyUser.accountId,
        fullname: item.replyUser.userName,
      };
    } else if (isReply && !item.replyUser) {
      ReplyUser = {
        accountId: item.replyAccountId,
        fullname: item.replyUserName,
      };
    }

    canDelete = item.allowOperate === '1' || md.global.Account.accountId === User.accountId;
    formatedData = {
      createAccount: {
        accountId: User.accountId,
        avatar: User.userMiddleHead,
        fullname: User.userName,
        status: item.Secretary ? 2 : 1,
      },
      attachment: item.attachments || [],
      canDelete: canDelete,
      isDeleteAttachment: canDelete && item.askDeleteAttachment === '1',
      isReply: isReply,
      replyAccount: ReplyUser,
      sourceId: item.postID,
      discussionId: item.commentID,
      replyId: item.replyID ? item.replyID : null,
      message: item.message,
      accountsInMessage: item.rUserList,
      groupsInMessage: item.rGroupList,
      createTime: item.createTime,
    };
  } else {
    var topic = item;
    var attachments = topic.attachments;
    User = topic.createAccount as NonNullable<TopicSource['createAccount']>;
    isReply = !!topic.replyId;
    canDelete = User.accountId === md.global.Account.accountId;
    formatedData = {
      canDelete: canDelete,
      // 擦除标记：非帖子分支的 topic 必有 attachments 数组（原 any 直接读）；缺省时原实现抛原生 TypeError。
      isDeleteAttachment: canDelete && attachments!.length,
      sourceId: item.sourceId,
      name: item.name,
      message: topic.message,
      attachment: attachments,
      createAccount: User,
      replyId: topic.replyId,
      discussionId: topic.discussionId,
      createTime: topic.createTime,
      isReply: isReply,
      replyAccount: isReply ? topic.replyAccount : null,
      accountsInMessage: topic.accountsInMessage,
    };
  }

  return { ...formatedData, sourceType: type };
};

export const splitSourceId = (sourceId: string) => {
  let [_sourceId, childId] = sourceId.split('|');
  return {
    sourceId: _sourceId,
    childId,
  };
};

export const buildSourceLink = function (
  type: number | undefined,
  _sourceId: string,
  _extendsId?: string | undefined,
  inboxId?: string | undefined,
) {
  var linkUrl = '';
  const { sourceId, childId } = splitSourceId(_sourceId);

  switch (type) {
    case SOURCE_TYPE.POST:
      linkUrl = '/feeddetail?itemID=' + sourceId;
      break;
    case SOURCE_TYPE.TASK:
      linkUrl = '/apps/task/task_' + sourceId;
      break;
    case SOURCE_TYPE.FOLDER:
      linkUrl = '/apps/task/folder_' + sourceId + '#detail';
      break;
    case SOURCE_TYPE.CALENDAR:
      linkUrl =
        '/apps/calendar/detail_' + (childId ? sourceId + '_' + moment(childId).format('YYYYMMDDHHmmss') : sourceId);
      break;
    case SOURCE_TYPE.WORKSHEET:
      linkUrl = '/worksheet/' + sourceId;
      break;
    case SOURCE_TYPE.WORKSHEETROW:
      if (_extendsId && _extendsId.indexOf('undefined') < 0 && _extendsId.indexOf('null') < 0) {
        const [appId, viewId] = _extendsId.split('|');

        if (!appId || !viewId) {
          linkUrl = `/worksheet/${sourceId}/row/${childId}?inboxId=${inboxId}`;
        } else {
          linkUrl = !browserIsMobile()
            ? `/app/${appId}/${sourceId}/${viewId}/row/${childId}?inboxId=${inboxId}`
            : `/mobile/record/${appId}/${sourceId}/${viewId}/${childId}?inboxId=${inboxId}`; //h5跳到记录详情
        }
      } else {
        linkUrl = `/worksheet/${sourceId}/row/${childId}?inboxId=${inboxId}`;
      }

      break;
    default:
      break;
  }

  return pathCompletion(linkUrl);
};

export function isWithinOneHour(timestamp: number) {
  const currentTime = Date.now();
  const oneHour = 60 * 60 * 1000;
  return Math.abs(currentTime - timestamp) <= oneHour;
}

function makeAnchor(
  doc: Document,
  url: string,
  text: string,
  opts: { target: string; rel: string; className: string; ignoreTags: Set<string> },
) {
  const a = doc.createElement('a');
  a.setAttribute('href', pathCompletion(url));
  a.textContent = text;

  if (opts.target) a.target = opts.target;
  if (opts.rel) a.rel = opts.rel;
  if (opts.className) a.className = opts.className;

  return a;
}

const DEFAULT_IGNORE = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);

export function linkifySanitizedHtml(sanitizedHtml: string, options = {}) {
  const opts = {
    target: '_blank',
    rel: 'noopener noreferrer',
    className: 'auto-link',
    ignoreTags: DEFAULT_IGNORE,
    ...options,
  };
  // v6 把 fuzzyLink 默认值从 true 翻成 false、并新增 urlAuth: false。不显式打开，
  // 聊天消息里的裸域名不再成链，且 http://u:p@h.com/x 会被截断成 http://u（已实测）。
  const linkify = new LinkifyIt({ fuzzyLink: true, urlAuth: true });

  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');

  Array.from(doc.body.querySelectorAll('a[href]')).forEach(a => {
    const href = a.getAttribute('href');
    if (href !== null) a.setAttribute('href', pathCompletion(href));
  });

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentNode;

      // 擦除标记：文本节点的父节点是元素时才有 tagName（原 any 直接读）。
      if (p && p.nodeType === 1 && opts.ignoreTags.has((p as Element).tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    // 擦除标记：walker 只接受非空文本节点（acceptNode 已过滤），故 nodeValue 必有值。
    const text = node.nodeValue as string;
    const matches = linkify.match(text);
    if (!matches) continue;

    const frag = doc.createDocumentFragment();
    let last = 0;

    for (const m of matches) {
      if (m.index > last) frag.append(text.slice(last, m.index));

      const raw = text.slice(m.index, m.lastIndex);
      frag.append(makeAnchor(doc, m.url, raw, opts));

      last = m.lastIndex;
    }

    if (last < text.length) frag.append(text.slice(last));

    // 擦除标记：walker 节点来自 doc.body 子树，必有父节点（原 any 直接调用）。
    node.parentNode!.replaceChild(frag, node);
  }

  return doc.body.innerHTML;
}
