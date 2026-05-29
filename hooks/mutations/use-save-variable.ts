import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface SaveVariableVars {
  id?: string; // If provided, it's an update, else create
  key: string;
  label: string;
  type: 'text' | 'url' | 'number' | 'enum' | 'json';
  defaultValue?: string;
  enumOptions?: string[];
  required?: boolean;
  description?: string;
}

async function saveVariable(vars: SaveVariableVars) {
  const isUpdate = !!vars.id;
  const url = isUpdate ? `/api/variables/${vars.id}` : '/api/variables';
  const method = isUpdate ? 'PATCH' : 'POST';
  
  const { id, ...body } = vars;

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save variable');
  }
  return res.json();
}

export function useSaveVariable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveVariable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variables.all });
    },
  });
}
