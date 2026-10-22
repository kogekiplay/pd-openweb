import type { InboxEndpoint } from './inboxTypes';

export interface KcNodeQuery {
  /** Refer cards forward this unvalidated scalar/property unchanged. */
  id?: unknown;
  path?: string | undefined;
  actionType?: number | undefined;
  versionId?: string | undefined;
  isOldest?: boolean | undefined;
  worksheetId?: string | undefined;
}
/** Raw known node fields consumed by message attachments, sharing and preview; other data remains on the original object. */
export interface KcNodeDetail {
  id?: string | undefined;
  name?: string | undefined;
  ext?: string | undefined;
  size?: number | undefined;
  type?: number | undefined;
  visibleType?: number | undefined;
  isOpenShare?: boolean | undefined;
  shareUrl?: string | undefined;
  viewUrl?: string | undefined;
  /** Preview forwards this server token without interpreting it here. */
  viewType?: unknown;
  downloadUrl?: string | undefined;
  rootInfo?: { project?: { companyDisplayName?: string | undefined } | undefined; owner?: { fullname?: string | undefined } | undefined } | undefined;
  canChangeSharable?: boolean | undefined;
  canChangeEditable?: boolean | undefined;
  canDownload?: boolean | undefined;
  allowDown?: boolean | undefined;
}
export type KcNodeReply = KcNodeDetail | false | null | undefined;
export type KcNodeEndpoint = InboxEndpoint<KcNodeQuery, KcNodeReply>;
