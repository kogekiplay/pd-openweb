import type { ReactNode } from 'react';
import type { MessageArgs } from 'src/utils/messageLinkTypes';

export interface InboxUser {
  accountId?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
  status?: number | undefined;
}

/** Raw feed comments and posts use the same mention fields. */
export interface InboxPostTopic {
  message?: string | undefined;
  rUserList?: MessageArgs['rUserList'];
  rGroupList?: MessageArgs['rGroupList'];
  categories?: MessageArgs['categories'];
  attachments?: unknown[] | undefined;
  postID?: string | undefined;
  commentID?: string | undefined;
  replyID?: string | number | undefined;
  replyAccountId?: string | undefined;
  replyUserName?: string | undefined;
  commentCount?: string | number | undefined;
  comments?: InboxPostTopic[] | undefined;
  user?: { accountId?: string | undefined; userMiddleHead?: string | undefined; userName?: string | undefined } | undefined;
  replyUser?: { accountId?: string | undefined; userName?: string | undefined } | undefined;
  allowOperate?: string | undefined;
  askDeleteAttachment?: string | undefined;
  Secretary?: unknown;
  createTime?: string | number | undefined;
}

export interface InboxPost extends InboxPostTopic {
  postType?: number | undefined;
  MedalPost?: { MedalName?: string | undefined; MedalPath?: string | undefined; MedalDescription?: string | undefined } | undefined;
  linkTitle?: string | undefined;
  linkUrl?: string | undefined;
  linkThumb?: string | undefined;
  linkDesc?: string | undefined;
}

/** Input to formatTopic; feed and discussion APIs name their fields differently. */
export interface TopicSource extends InboxPostTopic {
  createAccount?: InboxUser | undefined;
  replyId?: string | number | null | undefined;
  sourceId?: string | undefined;
  sourceType?: number | undefined;
  name?: string | undefined;
  discussionId?: string | undefined;
  replyAccount?: InboxUser | null | undefined;
  accountsInMessage?: MessageArgs['rUserList'];
}

/** The formatter preserves missing values and does not add fallback identifiers. */
export interface NormalizedComment {
  createAccount?: InboxUser | undefined;
  attachment?: unknown[] | undefined;
  canDelete?: boolean | undefined;
  isDeleteAttachment?: boolean | number | undefined;
  isReply?: string | number | boolean | undefined;
  replyAccount?: InboxUser | null | undefined;
  sourceId?: string | undefined;
  discussionId?: string | undefined;
  replyId?: string | number | null | undefined;
  message?: string | undefined;
  accountsInMessage?: MessageArgs['rUserList'];
  groupsInMessage?: MessageArgs['rGroupList'];
  createTime?: string | number | undefined;
  name?: string | undefined;
  sourceType?: number | undefined;
}

/** Fields passed to the shared message body by PostReply, PostMention and CommonTopic. */
export interface InboxMessageBody {
  message?: string | undefined;
  inboxId?: string | number | undefined;
  inboxType?: number | string | undefined;
  isFavorite?: '0' | '1' | undefined;
  appId?: string | undefined;
  fullname?: string | undefined;
  accountId?: string | undefined;
  avatar?: string | undefined;
  typeName?: string | undefined;
  sourceId?: string | undefined;
  sourceType?: number | undefined;
  replyId?: string | number | null | undefined;
  replyAccountId?: string | undefined;
  attachments?: unknown[] | undefined;
  isDeleted?: boolean | undefined;
  canReply?: boolean | undefined;
  comments?: TopicSource[] | undefined;
  commentsCount?: number | undefined;
  fromLink?: string | undefined;
  fromMessage?: string | undefined;
  fromTitle?: string | undefined;
  createTime?: string | number | undefined;
  discussionId?: string | undefined;
  extendsId?: string | undefined;
  name?: string | undefined;
  projectId?: string | undefined;
  children?: ReactNode;
}
