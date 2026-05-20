import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAgentStreamStore, AgentStreamState } from '@/stores/agent-stream-store';

export function useLeadSSE(leadId: string | undefined) {
  const queryClient = useQueryClient();
  const appendChunk = useAgentStreamStore((state: AgentStreamState) => state.appendChunk);

  useEffect(() => {
    if (!leadId) return;

    // Conectar al endpoint SSE que escucha a pg_notify (y al LangGraph stream)
    const eventSource = new EventSource(`/api/leads/${leadId}/messages/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 1. Refresh Event (Nuevo mensaje consolidado en la DB)
        if (data.refresh) {
          queryClient.invalidateQueries({ queryKey: ['lead-messages', leadId] });
        }
        
        // 2. Chunk Event (Inferencia del LLM en vivo)
        if (data.type === 'agent_chunk' && data.message_id && data.chunk) {
          appendChunk(data.message_id, data.chunk);
        }
        
        // 3. Safety Valve / Andon Cord (Alerta temprana)
        if (data.type === 'safety_valve') {
           // Aquí podríamos disparar un toast() global para alertar al operador
           console.warn('⚠️ Andon Cord disparado por LangGraph:', data.reason);
        }
        
      } catch (err) {
        console.error('Error parseando evento SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('Error en SSE:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [leadId, queryClient, appendChunk]);
}
