import type { SelectedQuickUser } from '../../ming-ui/functions/quickSelectUser/types';

/** The existing mentions renderer also accepts absent/null display fields. IDs are never fabricated. */
export interface CommentMentionCandidate extends Pick<SelectedQuickUser, 'accountId'> {
  avatar: string | null | undefined;
  fullname: string | null | undefined;
  job: string;
}
export interface CalendarMentionMember {
  accountID?: string | null | undefined;
  head?: string | null | undefined;
  memberName?: string | null | undefined;
}
export interface CalendarMentionSource {
  createUser?: string | null | undefined;
  members?: CalendarMentionMember[] | undefined;
}
export interface TaskMentionAccount {
  accountID?: string | null | undefined;
  avatar?: string | null | undefined;
  fullName?: string | null | undefined;
  fullname?: string | null | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Invalid mention source');
  return value;
}
function stringField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid mention account/display field');
}
function numberField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') return value;
  throw new TypeError('Invalid task member discriminator');
}
function list(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid mention member list');
  return Array.from(value);
}
function calendarMember(value: unknown): CalendarMentionMember {
  const member = record(value);
  return {
    accountID: stringField(member['accountID']),
    head: stringField(member['head']),
    memberName: stringField(member['memberName']),
  };
}
type UncheckedCandidate = Omit<CommentMentionCandidate, 'accountId'> & {
  accountId: string | null | undefined;
};
function uniqueCandidates(
  accounts: UncheckedCandidate[],
  currentAccountId: string | undefined,
): CommentMentionCandidate[] {
  const accountIds = new Set<string>();
  const result: CommentMentionCandidate[] = [];
  for (const account of accounts) {
    const id = account.accountId;
    if (!id || id === currentAccountId || accountIds.has(id)) continue;
    accountIds.add(id);
    result.push({ ...account, accountId: id });
    if (result.length === 20) break;
  }
  return result;
}

export function getCalendarAtData(value: unknown, currentAccountId?: string): CommentMentionCandidate[] {
  const source = record(value);
  const createUser = stringField(source['createUser']);
  const members = list(source['members']).map(calendarMember);
  const creator = members.find(member => member.accountID === createUser);
  const ordered = creator
    ? [creator, ...members.filter(member => member.accountID !== createUser)]
    : members.filter(member => member.accountID !== createUser);
  return uniqueCandidates(
    ordered.map((member, index) => ({
      accountId: member.accountID,
      avatar: member.head?.replace(/imageView2\/\d\/w\/\d+\/h\/\d+(\/q\/\d+)?/, 'imageView2/1/w/48/h/48/q/90'),
      fullname: member.memberName,
      job: index === 0 && member.accountID === createUser ? _l('组织者') : _l('出席者'),
    })),
    currentAccountId,
  );
}

function taskCandidate(value: unknown, owner: boolean): UncheckedCandidate | undefined {
  if (value === undefined || value === null) return undefined;
  const account = record(value);
  const fullName = stringField(account['fullName']);
  return {
    accountId: stringField(account['accountID']),
    avatar: stringField(account['avatar']),
    fullname: owner ? fullName : fullName || stringField(account['fullname']),
    job: owner ? _l('负责人') : _l('参与者'),
  };
}
export function getTaskAtData(value: unknown, currentAccountId?: string): CommentMentionCandidate[] {
  const source = record(value);
  const accounts: UncheckedCandidate[] = [];
  const owner = taskCandidate(source['charge'], true);
  if (owner) accounts.push(owner);
  for (const value of list(source['member'] ?? undefined)) {
    const member = record(value);
    if (numberField(member['type']) !== 0 || numberField(member['status']) === 2) continue;
    const account = taskCandidate(member['account'], false);
    if (account) accounts.push(account);
  }
  return uniqueCandidates(accounts, currentAccountId);
}
