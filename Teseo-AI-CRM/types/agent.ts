import type { AgentRole } from './conversation';

export interface AgentAction {
  type: 'message' | 'tool_call' | 'handoff_request' | 'state_update';
  agentRole: AgentRole;
  payload: Record<string, unknown>;
  timestamp: string;
}
