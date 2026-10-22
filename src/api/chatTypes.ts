import type { GroupMember } from './groupTypes';
import type { InboxEndpoint, InboxRequest } from './inboxTypes';

type GroupInfo = HapApi.MD.Web.Ajax.ResultModel.Group.GroupModel;
type AccountInfo = HapApi.MD.Web.Ajax.ResultModel.Account.AccountSimpleModel;
type LookupFields<Model> = { [Key in keyof Model]?: Model[Key] | undefined };

/** The observed group lookup fields; raw sender IDs stay scalar before session formatting. */
export type ChatGroupInfo = LookupFields<GroupInfo> & { from?: string | undefined; groupUsers?: GroupMember[] | null | undefined };
export interface ChatGroupParams { groupId?: string | undefined; }
export type ChatGroupEndpoint = InboxEndpoint<ChatGroupParams, ChatGroupInfo | null | undefined>;

/** Shared finite read view for the two actual session lookup producers. */
export type ChatSessionLookup = LookupFields<GroupInfo & AccountInfo> & { from?: string | undefined; groupUsers?: GroupMember[] | null | undefined };
export type ChatSessionLookupRequest = InboxRequest<ChatSessionLookup | null | undefined>;

/** Shared finite request view used by the group/user file and count routers. */
export interface ChatFileQuery {
  groupId?: string | undefined;
  withUser?: string | number | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  keywords?: string | undefined;
  fileType?: number | undefined;
  fromUser?: string | number | undefined;
  sendBy?: string | number | undefined;
  start?: string | undefined;
  end?: string | undefined;
}
export interface ChatCountQuery {
  groupId?: string | undefined;
  withUser?: string | number | undefined;
  keywords?: string | undefined;
  loadTabType?: number | undefined;
}
export interface ChatMatchedCounts {
  matchedMessageCount?: number | undefined;
  matchedFileCount?: number | undefined;
  matchedMemberCount?: number | undefined;
}
/** Raw file row; formatting fields are declared by the actual file view, not by the wire model. */
export interface ChatFileWire {
  fileId?: string | number | undefined;
  name?: string | undefined;
  url?: string | undefined;
  size?: number | undefined;
  time?: string | number | undefined;
  type?: number | undefined;
  createAccount?: { fullname?: string | undefined } | null | undefined;
}
export interface ChatFileListReply { list?: ChatFileWire[] | null | undefined; }
export type GroupFileParams = Omit<ChatFileQuery, 'withUser' | 'sendBy'>;
export type UserFileParams = Omit<ChatFileQuery, 'groupId'>;
export type GroupCountParams = Omit<ChatCountQuery, 'withUser'>;
export type UserCountParams = Omit<ChatCountQuery, 'groupId'>;
export type GroupFileEndpoint = InboxEndpoint<GroupFileParams, ChatFileListReply>;
export type UserFileEndpoint = InboxEndpoint<UserFileParams, ChatFileListReply>;
export type GroupCountEndpoint = InboxEndpoint<GroupCountParams, ChatMatchedCounts>;
export type UserCountEndpoint = InboxEndpoint<UserCountParams, ChatMatchedCounts>;
