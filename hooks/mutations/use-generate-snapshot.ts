import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useGenerateSnapshot() {
  return useMutation({
    mutationFn: async ({ templateId, versionId }: { templateId: string; versionId?: string }) => {
      const res = await fetch('/api/asset-studio/snapshots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, versionId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate snapshot');
      }

      return res.json() as Promise<{ success: boolean; url: string }>;
    },
    onSuccess: (data) => {
      toast.success('Snapshot generado correctamente', {
        description: 'La imagen ha sido guardada en Supabase Storage.',
        action: {
          label: 'Ver',
          onClick: () => window.open(data.url, '_blank'),
        },
      });
    },
    onError: (error) => {
      toast.error('Error al generar Snapshot', {
        description: error.message,
      });
    },
  });
}
