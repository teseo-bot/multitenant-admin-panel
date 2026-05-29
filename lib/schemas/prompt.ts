import { z } from 'zod';

export const AgentRoleSchema = z.enum(['sdr', 'gatekeeper', 'hunter', 'l1_support']);

export const CreatePromptTemplateSchema = z.object({
  role: AgentRoleSchema,
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const UpdatePromptTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const CreatePromptVersionSchema = z.object({
  content: z.string().min(1),
  changelog: z.string().optional(),
});

export const UpdatePromptVersionSchema = z.object({
  changelog: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

