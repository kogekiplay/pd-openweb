import type { InboxEndpoint } from './inboxTypes';

/** Actual callers create account→display-name dictionaries, without widening values to arbitrary objects. */
export type InvitationAccounts = Record<string, string>;
export interface InvitationUserParams {
  sourceId?: string | null | undefined;
  fromType?: number | undefined;
  accountIds?: (string | undefined)[] | undefined;
  accounts?: InvitationAccounts | undefined;
}
export interface InvitationAccountInfoParams { accounts: InvitationAccounts; }
/** Raw fields are forwarded to the existing decoder/dialog; this is not DecodedInviteResult or a promised success enum. */
export interface InvitationRawReply {
  sendMessageResult?: unknown;
  results?: unknown;
}
export type InvitationUserEndpoint = InboxEndpoint<InvitationUserParams, InvitationRawReply | null | undefined>;
export type InvitationAccountInfoEndpoint = InboxEndpoint<InvitationAccountInfoParams, unknown>;
