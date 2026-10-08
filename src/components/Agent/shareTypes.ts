import type { ChatMessage, ChatMessagePart } from './types';

export interface AgentSession {
  sessionId: string;
  title: string;
  updateTime: string | number | null;
}
export interface AgentSessionQuery {
  page?: number;
  size?: number;
  keyword?: string;
  agentName?: string;
}
export interface SessionShareOptions {
  sessionId: string;
  scope?: string | undefined;
  projectId?: string | undefined;
  messageIds?: string[] | undefined;
}
export interface SharedMessage extends Omit<ChatMessage, 'credits' | 'time'> {
  messageId?: string | undefined;
  traceId?: string | undefined;
  credits?: number | null | undefined;
  time?: string | number | null | undefined;
}
export interface SharedAttachment {
  url?: string;
  name?: string;
  size?: number;
  type?: string;
}
export interface SharedPart extends Omit<ChatMessagePart, 'items'> {
  items?: SharedAttachment[];
  children?: SharedPart[];
}
export interface ShareError extends Error {
  errorCode?: string | undefined;
  status?: number | undefined;
}
