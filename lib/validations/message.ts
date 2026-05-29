import { z } from 'zod';

export const messageChannelEnum = z.enum(['telegram', 'whatsapp', 'web', 'email']);
export const messageSenderEnum = z.enum(['customer', 'ai_agent', 'human_admin']);

export const createMessageSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000, 'Message too long'),
  channel: messageChannelEnum,
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MessageChannel = z.infer<typeof messageChannelEnum>;
export type MessageSender = z.infer<typeof messageSenderEnum>;