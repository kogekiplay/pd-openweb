import agentAjax from 'src/api/agent';
import { fetchAgentSessionMessages } from './agentService';
import type { AgentSession, AgentSessionQuery, SessionShareOptions, SharedMessage, ShareError } from './shareTypes';

export const SESSION_SHARE_SCOPE = { PUBLIC: 'public', LOGIN: 'login', ORG: 'org' };
export const SHARE_ERROR = {
  ACCESS_DENIED: 'share_access_denied',
  SESSION_NOT_FOUND: 'session_not_found',
  RATE_LIMIT: 'rate_limit_exceeded',
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function field(value: unknown, name: string): unknown {
  const data = record(value);
  const key = Object.keys(data).find(key => key.toLowerCase() === name.toLowerCase());
  return key ? data[key] : undefined;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function body(value: unknown): unknown {
  return field(value, 'data') ?? value;
}
function list(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    const items = field(value, key);
    if (Array.isArray(items)) return items;
  }
  return [];
}
function timestamp(value: string | number | null): number {
  if (typeof value === 'number') return value;
  const parsed = new Date(String(value || '').replace(/-/g, '/')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function shareError(source: unknown): ShareError {
  const error: ShareError = new Error(text(field(body(source), 'errorMessage')) || 'share request failed');
  error.errorCode = text(field(body(source), 'errorCode')) || undefined;
  const status = field(source, 'status');
  error.status = typeof status === 'number' ? status : undefined;
  return error;
}

export async function fetchAgentSessionPage({
  page = 1,
  size = 50,
  keyword = '',
  agentName = '',
}: AgentSessionQuery = {}): Promise<{ items: AgentSession[]; hasMore: boolean }> {
  const response: unknown = await agentAjax.getAgentSessions(
    { page, size, ...(keyword ? { keyword } : {}), ...(agentName ? { agentName } : {}) },
    { silent: true },
  );
  const raw = list(body(response), ['items', 'sessions', 'list', 'data']);
  const items = raw
    .map(value => {
      const time =
        field(value, 'lastActiveTime') ||
        field(value, 'updateTime') ||
        field(value, 'lastMessageTime') ||
        field(value, 'createTime');
      return {
        sessionId: text(field(value, 'sessionId')) || text(field(value, 'id')),
        title:
          text(field(value, 'firstMessage')) ||
          text(field(value, 'title')) ||
          text(field(value, 'summary')) ||
          _l('未命名会话'),
        updateTime: typeof time === 'string' || typeof time === 'number' ? time : null,
      };
    })
    .filter(value => value.sessionId && !value.sessionId.startsWith('session-bot-'))
    .sort((a, b) => timestamp(b.updateTime) - timestamp(a.updateTime));
  return { items, hasMore: raw.length >= size };
}
export async function fetchAgentSessionTitle(sessionId: string): Promise<string> {
  if (!sessionId) return '';
  try {
    return (await fetchAgentSessionPage({ size: 50 })).items.find(item => item.sessionId === sessionId)?.title || '';
  } catch {
    return '';
  }
}

export async function createSessionShare({
  sessionId,
  scope,
  projectId,
  messageIds,
}: SessionShareOptions): Promise<string> {
  if (!sessionId) throw new Error('Missing sessionId');
  if (scope === SESSION_SHARE_SCOPE.ORG && !projectId) throw new Error('Missing share project');
  if (messageIds && messageIds.length > 100) throw new Error('Too many shared messages');
  const response: unknown = await agentAjax.agentSessionsShares(
    {
      sessionId,
      ...(scope ? { scope } : {}),
      ...(scope === SESSION_SHARE_SCOPE.ORG ? { projectId } : {}),
      ...(messageIds?.length ? { messageIds } : {}),
    },
    { silent: true },
  );
  if (!response || field(response, 'success') === false) throw shareError(response);
  const shareId = text(field(body(response), 'shareId'));
  if (!shareId) throw new Error('create share failed');
  return shareId;
}
export async function fetchSharedSessionMessages({
  shareId,
  clientId,
  page = 1,
  size = 100,
}: {
  shareId: string;
  clientId: string;
  page?: number;
  size?: number;
}): Promise<SharedMessage[]> {
  let response: unknown;
  try {
    response = await agentAjax.getAgentSessionsSharesMessages(
      { shareId, page, size },
      { ...(clientId ? { header: { clientId } } : {}), silent: true },
    );
  } catch (error) {
    throw shareError(error);
  }
  if (field(response, 'success') === false) throw shareError({ data: response });
  const messages = list(body(response), ['items', 'messages', 'list', 'data']);
  return (await fetchAgentSessionMessages(shareId, {
    rawItems: messages.map(record),
    includeUsage: false,
  })) as SharedMessage[];
}
export async function continueSharedSession({
  shareId,
  clientId,
}: {
  shareId: string;
  clientId: string;
}): Promise<{ sessionId: string; forked: boolean }> {
  let response: unknown;
  try {
    response = await agentAjax.agentSessionsSharesContinue(
      { shareId },
      { ...(clientId ? { header: { clientId } } : {}), silent: true },
    );
  } catch (error) {
    throw shareError(error);
  }
  if (!response || field(response, 'success') === false) throw shareError({ data: response });
  const sessionId = text(field(body(response), 'sessionId'));
  if (!sessionId) throw new Error('continue share failed');
  return { sessionId, forked: Boolean(field(body(response), 'forked')) };
}
