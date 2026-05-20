export type AgentRole = 'sdr' | 'hunter' | 'gatekeeper' | 'l1_support' | string;
export type Channel = 'whatsapp' | 'email' | 'linkedin' | 'webchat' | string;
export type ThreadStatus = 'active' | 'archived' | 'pending' | 'agent_active' | 'pending_handoff' | 'human_active' | 'resolved';

export interface ThreadSummary {
  id: string;
  threadId: string;
  status: ThreadStatus;
  updatedAt: string;
  leadName: string;
  channel: Channel;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  leadCompany: string;
  assignedAgent: string;
}

export interface Message {
  threadId: string;
  id: string;
  createdAt?: string;
  sender: 'customer' | 'ai_agent' | 'human_admin' | string;
  senderName: string;
  timestamp: string;
  content: string;
  metadata?: {
    confidence?: number;
    toolCalls?: string[];
  };
}

export type HandoffAction = 'take_over' | 'return_to_agent' | 'resolve' | 'escalate' | string;

export interface HandoffPayload {
  reason?: string;
  threadId: string;
  action: HandoffAction;
  operatorId: string;
}
export interface PaginatedThreads {
  nextCursor?: string;
  threads: ThreadSummary[];
}
export interface ThreadFilters {
  status?: ThreadStatus;
  channel?: Channel;
  assignedAgent?: string;
  search?: string;
}
export interface SSEEvent {
  type: string;
  payload: any;
}
