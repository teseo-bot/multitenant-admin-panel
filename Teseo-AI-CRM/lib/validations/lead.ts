import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  company: z.string().max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  status: z.enum(['New', 'Contacted', 'Qualified', 'Lost', 'Won']).default('New'),
  source: z.enum(['inbound_web', 'inbound_telegram', 'inbound_whatsapp', 'outbound_hunter', 'manual', 'referral']).default('inbound_web'),
  icp_score: z.number().min(0).max(100).optional(),
  assigned_node: z.enum(['gatekeeper', 'sdr', 'hunter', 'admin', 'unassigned']).default('unassigned'),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateLeadSchema = z.object({
  status: z.enum(['New', 'Contacted', 'Qualified', 'Lost', 'Won']).optional(),
  sort_order: z.number().optional(),
  assigned_node: z.enum(['gatekeeper', 'sdr', 'hunter', 'admin', 'unassigned']).optional(),
  name: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  icp_score: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
