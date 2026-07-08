// app/(partners)/lab/page.tsx
// KL1-W1: Home mínimo del Lab (esqueleto). El Home real (P-KL1, tarjetas de
// paquetes/borradores/contratos/citas) es de otra WU — aquí solo se deja el
// placeholder y la verificación visual del rol (RP-KL7): el curator ve la acción
// "Puedes publicar", el member no.
//
// El layout ya aplicó el guard (requirePartnerMember); esta página vuelve a
// resolverlo para leer partner/member_role (mismo patrón que las páginas de
// (control-panel), que no comparten contexto entre layout y page).

import { redirect } from "next/navigation";
import { requirePartnerMember } from "@/lib/partners/session";
import { Badge } from "@/components/ui/badge";

export default async function LabHomePage() {
  const guard = await requirePartnerMember();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/auth/login?redirectTo=/lab" : "/unauthorized");
  }

  const { partner, member_role } = guard;
  const isCurator = member_role === "curator";

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Lab</h1>
          <p className="text-muted-foreground">
            {partner.legal_name} · rol <span className="capitalize">{member_role}</span>
          </p>
        </div>
        {isCurator && (
          <Badge variant="default" data-testid="curator-publish-badge">
            Puedes publicar
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Paquetes", desc: "Estado y semáforo de validación" },
          { title: "Borradores pendientes", desc: "Por curar" },
          { title: "Contratos activos", desc: "Vigencia y firma" },
          { title: "Citas del mes", desc: "Métricas de uso" },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-border bg-card p-4 text-card-foreground"
          >
            <h2 className="text-sm font-medium">{card.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Registra tu primera fuente
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
