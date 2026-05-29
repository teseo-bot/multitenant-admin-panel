import { z } from 'zod';

export const CampaignEventCreateSchema = z.object({
  eventType: z.enum([
    'message_sent', 'message_received', 'tool_call', 
    'handoff_request', 'handoff_completed', 'lead_qualified', 
    'lead_lost', 'state_change', 'error', 'manual_override'
  ]),
  agentRole: z.string().min(1, "El rol del agente es requerido"),
  threadId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  payload: z.record(z.string(), z.any()).default({}),
  occurredAt: z.string().datetime().optional() // ISO 8601
});
