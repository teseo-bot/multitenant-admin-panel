import { z } from 'zod';

export const VariableTypeSchema = z.enum(['text', 'url', 'number', 'enum', 'json']);

export const CreateVariableSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1).max(100),
  type: VariableTypeSchema.default('text'),
  defaultValue: z.string().optional(),
  enumOptions: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export const UpdateVariableSchema = CreateVariableSchema.partial();
