import type { InboxEndpoint } from './inboxTypes';

/** Both actual mutation consumers only test truthiness; no reply fields or Boolean shape are promised. */
export type GroupMutationReply = unknown;
export interface GroupAboutParams { groupId?: string | undefined; groupAbout?: string | undefined; }
export interface GroupToPostParams { groupId?: string | undefined; projectId?: string | undefined; }
export type GroupAboutEndpoint = InboxEndpoint<GroupAboutParams, GroupMutationReply>;
export type GroupToPostEndpoint = InboxEndpoint<GroupToPostParams, GroupMutationReply>;
