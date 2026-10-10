import type { DecodedInviteResult, InviteAccount, InviteBatch } from './inviteTypes';

function inviteObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isInviteAccount(value: unknown): value is InviteAccount {
  if (!inviteObject(value)) return false;
  for (const key of ['account', 'email', 'mobilePhone', 'fullname'])
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  const status = value['user'];
  return status === undefined || typeof status === 'string' || (typeof status === 'number' && Number.isFinite(status));
}
function accounts(value: unknown): InviteAccount[] {
  // API batches and the legacy folder adapter may omit an empty bucket.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isInviteAccount)) throw new TypeError('Invalid invitation account list');
  return value;
}
function batch(value: unknown): InviteBatch {
  if (!inviteObject(value)) throw new TypeError('Invalid invitation batch');
  return {
    accountInfos: accounts(value['accountInfos']),
    existAccountInfos: accounts(value['existAccountInfos']),
    failedAccountInfos: accounts(value['failedAccountInfos']),
    limitAccountInfos: accounts(value['limitAccountInfos']),
    forbidAccountInfos: accounts(value['forbidAccountInfos']),
  };
}
export function decodeInviteResult(value: unknown): DecodedInviteResult {
  if (!inviteObject(value)) throw new TypeError('Invalid invitation response');
  const status = value['sendMessageResult'];
  if (status === 0) return { sendMessageResult: 0 };
  if (status !== undefined && status !== 1 && status !== 2) throw new TypeError('Invalid invitation response status');
  const decodedStatus = status === 1 ? 1 : status === 2 ? 2 : undefined;
  const results = value['results'];
  if (results === undefined || results === null) {
    if (status === undefined) throw new TypeError('Invitation response has no result');
    return { sendMessageResult: decodedStatus, results: [] };
  }
  if (!Array.isArray(results)) throw new TypeError('Invitation results must be an array');
  return { sendMessageResult: decodedStatus, results: results.map((item: unknown) => batch(item)) };
}
