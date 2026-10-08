import type { AgentSession } from 'src/components/Agent/shareTypes';

export interface SessionAction {
  type: string;
  session: AgentSession;
}
