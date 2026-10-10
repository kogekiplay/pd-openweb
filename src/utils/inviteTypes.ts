/** Only fields used by invitation notices are known; returned member metadata remains opaque. */
export interface InviteAccount {
  account?: string | undefined;
  email?: string | undefined;
  mobilePhone?: string | undefined;
  fullname?: string | undefined;
  user?: number | string | undefined;
  [memberField: string]: unknown;
}
export interface InviteBatch {
  accountInfos: InviteAccount[];
  existAccountInfos: InviteAccount[];
  failedAccountInfos: InviteAccount[];
  limitAccountInfos: InviteAccount[];
  forbidAccountInfos: InviteAccount[];
}
export type DecodedInviteResult =
  { sendMessageResult: 0; results?: undefined } | { sendMessageResult?: 1 | 2 | undefined; results: InviteBatch[] };
export interface InviteHintAccounts {
  accountInfos: InviteAccount[];
  existAccountInfos: InviteAccount[];
}
