export type MessageSender = 'customer' | 'ai_agent' | 'human_admin';
export type MessageChannel = 'telegram' | 'whatsapp' | 'web' | 'email';

export interface InboxMessage {
  id: string;
  lead_id: string;
  sender: MessageSender;
  channel: MessageChannel;
  content: string;
  external_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
