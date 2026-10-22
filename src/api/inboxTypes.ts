import type { InboxItem } from 'src/pages/chat/components/Inbox/payloadTypes';

/** The SDK attaches abort to the same asynchronous request object it returns. */
export type InboxRequest<T> = Promise<T> & { abort: () => void };

/** The ordinary JSON/envelope mode; other SDK modes have a separate opaque overload. */
export type InboxAsyncOptions = ApiOptions & {
  ajaxOptions?: { sync?: false; responseType?: 'json'; agent?: false };
  customParseResponse?: false;
  isReadableStream?: false;
  agent?: false;
};
export interface InboxEndpoint<Params, Response> {
  (args: Params, options?: InboxAsyncOptions): InboxRequest<Response>;
  (args: Params, options: ApiOptions): unknown;
}
export interface PostReplyParams {
  commentID?: string | number | null | undefined;
  postID?: string | undefined;
}
export interface PostReplyResponse {
  Message?: string | null | undefined;
}
export interface DiscussionReplyParams {
  discussionId?: string | number | null | undefined;
  sourceType?: number | undefined;
}
export interface DiscussionReplyResponse {
  code?: number | undefined;
  data?: string | null | undefined;
}
export interface InboxFavoriteParams {
  inboxId?: string | number | undefined;
  inboxFavorite: '0' | '1';
}

export interface InboxMessagesParams {
  pageIndex: number;
  pageSize: number;
  inboxFavorite: 0 | 1;
  type?: string | undefined;
  clearUnread?: boolean | undefined;
  loadType: number;
  creatorId?: string | null | undefined;
  startTime?: string | null | undefined;
  endTime?: string | null | undefined;
  appId?: string | null | undefined;
}
export interface InboxMessagesResponse {
  inboxList?: InboxItem[] | null | undefined;
}
