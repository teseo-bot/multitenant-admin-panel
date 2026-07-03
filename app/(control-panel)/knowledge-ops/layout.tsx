// app/(control-panel)/knowledge-ops/layout.tsx
// Guard server-side por rol platform_admin (UXUI §1: "Audiencia única: operadores
// Teseo con rol platform_admin. El tenant NUNCA ve estas pantallas — D-C1").
//
// No existe precedente de guard por ROL a nivel de página/layout en el panel: las
// páginas admin existentes (app/(control-panel)/admin/**, tenants/**) son client
// components que dependen únicamente del guard de las API routes
// (requirePlatformAdmin() en lib/auth/guards.ts) y del middleware raíz
// (utils/supabase/middleware.ts), que solo exige sesión autenticada, no rol.
// Aquí se replica requirePlatformAdmin() —la única fuente de verdad de autorización
// del panel— a nivel de layout server component, usando redirect() en vez de un JSON
// 401/403 (esto es una página, no una API route).

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function KnowledgeOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/auth/login?redirectTo=/knowledge-ops");
    }
    redirect("/unauthorized");
  }

  return <>{children}</>;
}
