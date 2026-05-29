// =============================================================================
// types/outbound.ts — Types for the Outbound Tracking schema (ADR-120)
// =============================================================================

export type OutboundChannel =
  | 'email' | 'linkedin' | 'whatsapp' | 'telegram' | 'phone' | 'sms';

export type OutboundStepType =
  | 'auto_email' | 'manual_email' | 'linkedin_connect' | 'linkedin_message'
  | 'phone_call' | 'sms' | 'whatsapp' | 'telegram' | 'custom_task';

export type OutboundEnrollmentStatus =
  | 'active' | 'paused' | 'completed' | 'bounced'
  | 'replied' | 'unsubscribed' | 'manual_exit';

export type OutboundTouchpointStatus =
  | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'cancelled';

export type OutboundEventType =
  | 'open' | 'click' | 'reply' | 'bounce' | 'unsubscribe' | 'spam_report'
  | 'linkedin_accepted' | 'linkedin_replied' | 'call_connected' | 'call_no_answer';

export interface OutboundSequence {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  channel: OutboundChannel;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutboundSequenceStep {
  id: string;
  sequence_id: string;
  tenant_id: string;
  step_order: number;
  step_type: OutboundStepType;
  delay_hours: number;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OutboundEnrollment {
  id: string;
  tenant_id: string;
  lead_id: string;
  sequence_id: string;
  current_step: number;
  status: OutboundEnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  // Joined fields (optional)
  sequence?: OutboundSequence;
}

export interface OutboundTouchpoint {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  step_id: string | null;
  lead_id: string;
  channel: OutboundChannel;
  status: OutboundTouchpointStatus;
  scheduled_at: string;
  executed_at: string | null;
  external_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined fields (optional)
  step?: OutboundSequenceStep;
  events?: OutboundTrackingEvent[];
}

export interface OutboundTrackingEvent {
  id: string;
  tenant_id: string;
  touchpoint_id: string;
  lead_id: string;
  event_type: OutboundEventType;
  event_data: Record<string, unknown>;
  occurred_at: string;
}

// ─── Semantic Summary (AI-generated per lead) ───────────────────────────────

export interface LeadSemanticSummary {
  lead_id: string;
  /** One-liner: "Enterprise prospect, 50-vehicle fleet, interested in ERP integration" */
  headline: string;
  /** Key signals extracted by AI from conversation + outbound events */
  signals: SemanticSignal[];
  /** AI-suggested next action */
  suggested_action: string | null;
  /** When the summary was last computed */
  generated_at: string;
}

export interface SemanticSignal {
  label: string;
  value: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  source: 'inbound_chat' | 'outbound_touchpoint' | 'osint' | 'manual';
}

// ─── OSINT / Hunter Expediente ──────────────────────────────────────────────

export interface OsintEntry {
  id: string;
  lead_id: string;
  source: string;           // "linkedin", "crunchbase", "google", "whois", etc.
  title: string;
  snippet: string;
  url: string | null;
  fetched_at: string;
  metadata: Record<string, unknown>;
}
