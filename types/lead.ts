export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Won';

export type LeadSource =
  | 'inbound_web'
  | 'inbound_telegram'
  | 'inbound_whatsapp'
  | 'outbound_hunter'
  | 'manual'
  | 'referral';

export type AssignedNode = 'gatekeeper' | 'sdr' | 'hunter' | 'admin' | 'unassigned';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: LeadSource;
  icp_score: number | null;
  assigned_node: AssignedNode;
  sort_order: number;
  thread_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: LeadStatus;
  title: string;
  leads: Lead[];
  wipLimit?: number;
}
