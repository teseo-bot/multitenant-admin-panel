// lib/knowledge-ops/use-current-user.ts
// K7-W2: obtiene el email del usuario autenticado (cliente) para poblar `reviewer` en
// POST /api/kdb/[tenantId]/proposals/[proposalId]/review (TRD §9). El guard real de
// autorización ocurre server-side vía requirePlatformAdmin(); esto es solo para
// identificar al reviewer en el payload.

import { useEffect, useState } from "react";

export function useCurrentUserEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.email) {
          setEmail(data.email);
        } else {
          setEmail(null);
        }
      })
      .catch(() => {
        setEmail(null);
      });
  }, []);

  return email;
}
