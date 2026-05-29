import React from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function TenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenantId } = useAuthStore();
  const queryClient = useQueryClient();

  const handleTenantChange = async (tenantId: string | null) => {
    if (!tenantId) return;
    // Fuga de Datos Visuales: Ejecutar secuencialmente
    await queryClient.cancelQueries();
    queryClient.removeQueries(); // o clear()
    setActiveTenantId(tenantId);
  };

  if (!tenants || tenants.length === 0) return null;

  return (
    <Select value={activeTenantId || ''} onValueChange={handleTenantChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Seleccionar Entorno" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
