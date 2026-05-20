// export type AgentRole = 'sdr' | 'hunter' | 'gatekeeper' | 'l1_support';
// export type Channel = 'whatsapp' | 'email' | 'linkedin' | 'webchat';

// We inline them or import if available. The RFC implies they might be in './conversation'.
// To avoid errors if the file doesn't exist, we declare them.
// But we'll try to import and if it fails later, we can fix it.
import type { AgentRole, Channel } from './conversation';

// ── Campaign Status Machine ─────────────────────────────────
export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'completed';

// ── Campaign Event Types ────────────────────────────────────
export type CampaignEventType =
  | 'message_sent'
  | 'message_received'
  | 'tool_call'
  | 'handoff_request'
  | 'handoff_completed'
  | 'lead_qualified'
  | 'lead_lost'
  | 'state_change'
  | 'error'
  | 'manual_override';

// ── Core Entities ───────────────────────────────────────────
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  agentRoles: AgentRole[];
  channel: Channel;
  status: CampaignStatus;
  targetAudience: Record<string, unknown>;
  scheduledStart: string | null;    // ISO 8601
  scheduledEnd: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignEvent {
  id: string;
  campaignId: string;
  eventType: CampaignEventType;
  agentRole: AgentRole | null;
  threadId: string | null;
  leadId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;              // ISO 8601
  idempotencyKey?: string | null;
}

export interface CampaignApproval {
  id: string;
  campaignId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected';
  reason: string | null;
  decidedAt: string;
}

// ── Metrics (from materialized view) ────────────────────────
export interface CampaignMetrics {
  campaignId: string;
  messagesSent: number;
  messagesReceived: number;
  leadsQualified: number;
  leadsLost: number;
  handoffsRequested: number;
  handoffsCompleted: number;
  errors: number;
  uniqueThreads: number;
  uniqueLeads: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

// ── API Payloads ────────────────────────────────────────────
export interface CreateCampaignPayload {
  name: string;
  description?: string;
  agentRoles: AgentRole[];
  channel: Channel;
  targetAudience?: Record<string, unknown>;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface UpdateCampaignPayload {
  name?: string;
  description?: string;
  agentRoles?: AgentRole[];
  channel?: Channel;
  status?: CampaignStatus;
  targetAudience?: Record<string, unknown>;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface ApprovalPayload {
  decision: 'approved' | 'rejected';
  reason?: string;
}

// ── Filters & Pagination ────────────────────────────────────
export interface CampaignFilters {
  status?: CampaignStatus;
  channel?: Channel;
  agentRole?: AgentRole;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedCampaigns {
  campaigns: Campaign[];
  nextCursor: string | null;
  totalCount: number;
}

export interface PaginatedEvents {
  events: CampaignEvent[];
  nextCursor: string | null;
  totalCount: number;
}
