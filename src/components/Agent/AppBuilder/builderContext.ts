import { createContext } from 'react';

export interface PendingBuilderEdit {
  module: string;
  card: string;
  text: string;
}
export interface BuilderChatState {
  submitting: boolean;
  pendingEdits: PendingBuilderEdit[];
}

// Panels can mount after the submitting event, so they consume the persistent page state.
export const ChatStateContext = createContext<BuilderChatState>({ submitting: false, pendingEdits: [] });
