import type { GroupSelectionValue } from 'src/ming-ui/functions/quickSelectGroup/types';
import type { MessageArgs } from 'src/utils/messageLinkTypes';
import type { AttachmentValue } from 'src/utils/controlTypes';

/** File fields read by feed editors; the object itself is retained and serialized with carried metadata. */
export interface FeedAttachment extends Omit<AttachmentValue, 'viewUrl'> {
  /** Knowledge attachments explicitly carry null when no image preview applies. */
  viewUrl?: string | null | undefined;
  originalFileName?: string | undefined;
  docVersionID?: string | undefined;
  fileSize?: number | undefined;
  allowDown?: boolean | string | undefined;
  inEdit?: boolean | undefined;
  twice?: FeedAttachment | null | undefined;
}
export interface FeedPost extends Pick<MessageArgs, 'message' | 'rUserList' | 'rGroupList' | 'categories'> {
  postID: string;
  postType: string | number;
  attachments?: FeedAttachment[] | null | undefined;
  projectIds?: string[] | undefined;
  scope: {
    shareProjects: Array<{ projectId: string }>;
    shareGroups: Array<{ groupId: string }>;
  };
}
export type FeedScope = Omit<GroupSelectionValue, 'isMe'>;
export interface FeedEditRequest {
  postType: string | number;
  postMsg: string;
  scope: FeedScope;
  postId: string;
  oldPostMsg: string;
  attachments?: string | undefined;
  knowledgeAttach?: string | undefined;
}
