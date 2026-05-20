import { z } from 'zod';

export const LeadAssignResultSchema = z.object({
  assigned_node: z.enum(['gatekeeper', 'sdr', 'hunter', 'admin', 'unassigned']),
  thread_id: z.string().uuid().or(z.string()),
  assigned_at: z.string().datetime().optional(),
}).strict();

export type LeadAssignResult = z.infer<typeof LeadAssignResultSchema>;
