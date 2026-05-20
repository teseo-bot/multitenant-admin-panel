import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { VariableDef } from '@/types/variable';

async function fetchVariableDefs(): Promise<VariableDef[]> {
  const res = await fetch('/api/variables');
  if (!res.ok) throw new Error('Failed to fetch variables');
  const data = await res.json();
  
  return data.map((v: any) => ({
    id: v.id,
    tenantId: v.tenant_id,
    key: v.key,
    label: v.label,
    type: v.type,
    defaultValue: v.default_value,
    enumOptions: v.enum_options,
    required: v.required,
    description: v.description,
    createdAt: v.created_at,
  }));
}

export function useVariableDefs() {
  return useQuery({
    queryKey: queryKeys.variables.all,
    queryFn: fetchVariableDefs,
  });
}
