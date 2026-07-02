// lib/knowledge-ops/use-current-user.ts
// K7-W2: obtiene el email del usuario autenticado (cliente) para poblar `reviewer` en
// POST /api/kdb/[tenantId]/proposals/[proposalId]/review (TRD §9). El guard real de
// autorización ocurre server-side vía requirePlatformAdmin(); esto es solo para
// identificar al reviewer en el payload, siguiendo el mismo patrón de
// createClient() de utils/supabase/client usado en control-panel-sidebar.tsx.

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useCurrentUserEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? null);
    });
  }, []);

  return email;
}
