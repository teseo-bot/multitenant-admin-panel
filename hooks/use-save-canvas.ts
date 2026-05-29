import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCanvasStore } from '@/hooks/use-canvas-store';
import { buildCanvasPayload } from '@/lib/canvas-payload';
import { CanvasLayout } from '@/types/canvas';

// El hook ahora requiere templateId
export function useSaveCanvas(templateId: string) {
  const queryClient = useQueryClient();
  const clearDrafts = useCanvasStore((state) => state.clearDrafts);
  const draftAttributes = useCanvasStore((state) => state.draftAttributes);
  const draftNodeOrder = useCanvasStore((state) => state.draftNodeOrder);

  return useMutation({
    mutationFn: async () => {
      // 1. Leer layout base del cache de TanStack Query
      const template = queryClient.getQueryData<any>(['template', templateId]);
      if (!template?.layout) throw new Error('No base layout in cache');
      
      const baseLayout: CanvasLayout = template.layout;

      // 2. Obtener userId del usuario actual
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';

      // 3. Construir payload consolidado
      const canvasData = buildCanvasPayload(
        baseLayout, draftAttributes, draftNodeOrder, templateId, userId
      );

      // 4. Enviar a la API
      const response = await fetch('/api/asset-studio/canvas/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ templateId, canvasData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save canvas');
      }

      return response.json();
    },
    onSuccess: () => {
      // 5. Limpiar drafts de Zustand
      clearDrafts();
      // 6. Invalidar cache para que el próximo fetch traiga canvas_data de DB
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
    },
    onError: (error) => {
      console.error('[Canvas Save Error]:', error);
    }
  });
}