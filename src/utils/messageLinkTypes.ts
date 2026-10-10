/** The feed API and discussion API use different names for the same mention fields. */
export interface MessageUserMention {
  name?: string | null | undefined;
  fullname?: string | null | undefined;
  aid?: string | null | undefined;
  accountId?: string | null | undefined;
  [metadata: string]: unknown;
}
export interface MessageGroupMention {
  groupName?: string | null | undefined;
  groupID?: string | null | undefined;
  isDelete?: boolean | null | undefined;
  [metadata: string]: unknown;
}
export interface MessageCategory {
  catID?: string | null | undefined;
  catName?: string | null | undefined;
  [metadata: string]: unknown;
}
export interface MessageArgs {
  message: string;
  rUserList?: Array<MessageUserMention | null | undefined> | null | undefined;
  rGroupList?: MessageGroupMention[] | null | undefined;
  categories?: MessageCategory[] | null | undefined;
  noLink?: boolean | null | undefined;
  filterFace?: boolean | null | undefined;
  doNotEscapeHTML?: boolean | null | undefined;
  /** Existing callers pass this option; the formatter deliberately does not consume it. */
  filterTask?: boolean | null | undefined;
  sourceType?: string | number | null | undefined;
  accountId?: string | null | undefined;
  accountName?: string | null | undefined;
  [metadata: string]: unknown;
}
export type MessageCustomTag = string | readonly [start: string, end: string];
export type MessageTagReplacement = (id: string, name: string) => string;
export type MessagePlainReplacement = (id: string) => string;

function messageObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'string';
}
function optionalBoolean(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'boolean';
}
function isUserMention(value: unknown): value is MessageUserMention | null | undefined {
  return (
    value === null ||
    value === undefined ||
    (messageObject(value) && ['name', 'fullname', 'aid', 'accountId'].every(key => optionalString(value[key])))
  );
}
function isGroupMention(value: unknown): value is MessageGroupMention {
  return (
    messageObject(value) &&
    optionalString(value['groupName']) &&
    optionalString(value['groupID']) &&
    optionalBoolean(value['isDelete'])
  );
}
function isCategory(value: unknown): value is MessageCategory {
  return messageObject(value) && optionalString(value['catID']) && optionalString(value['catName']);
}
function isMessageArgs(value: unknown): value is MessageArgs {
  if (!messageObject(value) || typeof value['message'] !== 'string') return false;
  if (!['noLink', 'filterFace', 'doNotEscapeHTML', 'filterTask'].every(key => optionalBoolean(value[key])))
    return false;
  if (!optionalString(value['accountId']) || !optionalString(value['accountName'])) return false;
  const source = value['sourceType'];
  if (!optionalString(source) && !(typeof source === 'number' && Number.isFinite(source))) return false;
  const users = value['rUserList'],
    groups = value['rGroupList'],
    categories = value['categories'];
  if (users !== undefined && users !== null && (!Array.isArray(users) || !users.every(isUserMention))) return false;
  if (groups !== undefined && groups !== null && (!Array.isArray(groups) || !Array.from(groups).every(isGroupMention)))
    return false;
  if (
    categories !== undefined &&
    categories !== null &&
    (!Array.isArray(categories) || !Array.from(categories).every(isCategory))
  )
    return false;
  return true;
}
/** Validate every declared field while retaining opaque API metadata and nullable mention lists. */
export function decodeMessageArgs(value: unknown): MessageArgs {
  if (!isMessageArgs(value)) throw new TypeError('Invalid message link parameters');
  return value;
}
