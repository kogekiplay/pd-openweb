import type { InboxEndpoint, InboxRequest } from './inboxTypes';

type GroupInfo = HapApi.MD.Web.Ajax.ResultModel.Group.GroupModel;
type AccountInfo = HapApi.MD.Web.Ajax.ResultModel.Account.AccountSimpleModel;
type LookupFields<Model> = { [Key in keyof Model]?: Model[Key] | undefined };

/** The observed group lookup fields; raw sender IDs stay scalar before session formatting. */
export type ChatGroupInfo = LookupFields<GroupInfo> & { from?: string | undefined };
export interface ChatGroupParams { groupId?: string | undefined; }
export type ChatGroupEndpoint = InboxEndpoint<ChatGroupParams, ChatGroupInfo | null | undefined>;

/** Shared finite read view for the two actual session lookup producers. */
export type ChatSessionLookup = LookupFields<GroupInfo & AccountInfo> & { from?: string | undefined };
export type ChatSessionLookupRequest = InboxRequest<ChatSessionLookup | null | undefined>;
