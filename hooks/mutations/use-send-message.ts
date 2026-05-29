import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface SendMessageInput {
  leadId: string;
  content: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, content }: SendMessageInput) => {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, sender: 'human' }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalida caché de mensajes para actualizar UI
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads.messages(variables.leadId),
      });
    },
  });
}
