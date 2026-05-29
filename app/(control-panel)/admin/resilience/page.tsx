'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DLQResiliencePage() {
  const queryClient = useQueryClient();

  const { data: outboxItems, isLoading } = useQuery({
    queryKey: ['dlq'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dlq');
      if (!res.ok) throw new Error('Failed to fetch dlq');
      return res.json();
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/dlq/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to retry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
    }
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Panel de Resiliencia (DLQ)</h1>
      
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {outboxItems?.length === 0 && (
            <div className="p-4 text-muted-foreground text-center">
              No hay eventos fallidos en la cola.
            </div>
          )}
          {outboxItems?.map((item: { id: string; lead_id: string; status: string; attempts: number; last_error: string }) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Lead: {item.lead_id}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.status === 'dead' ? 'bg-destructive/20 text-destructive' :
                    item.status === 'failed' ? 'bg-yellow-500/20 text-yellow-700' :
                    'bg-blue-500/20 text-blue-700'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                  <span>Intentos: {item.attempts}/5</span>
                  <span>Error: {item.last_error || 'Timeout'}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={item.status === 'pending' || retryMutation.isPending}
                onClick={() => retryMutation.mutate(item.id)}
              >
                Forzar Reintento
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
