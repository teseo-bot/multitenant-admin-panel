// app/(control-panel)/admin/casos/page.tsx
// ADR-224 D-224.2: la cola de curaduría de casos de éxito. Los aliados escriben sus casos en
// aliados.micontexto.com y los mandan a revisión; aquí micontexto los publica o los devuelve.
// Ningún caso se publica sin pasar por aquí.

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ErrorZona, EsqueletoFilas, Pastilla, Seccion, Vacio } from "@/components/ui/piezas";
import type { AliadoResumen, CasoEnCola } from "@/lib/partners/casos-curaduria";
import { LLAVE_COLA, fecha, mensajeDeError } from "./comun";

type CasoEnColaConAliado = CasoEnCola & { aliado: AliadoResumen | null };

export default function CuraduriaCasosPage() {
  const { data, isLoading, error, refetch } = useQuery<{ casos: CasoEnColaConAliado[] }>({
    queryKey: LLAVE_COLA,
    queryFn: async () => {
      const res = await fetch("/api/admin/casos");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeDeError(body, "No se pudo cargar la cola de casos"));
      return body;
    },
  });
  const casos = data?.casos ?? [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Casos en revisión</h2>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Casos de éxito que los aliados mandaron a revisión. Antes de publicar, revisa de dónde sale la cifra y que el
          cliente haya dado permiso o el caso vaya anonimizado (ADR-224 D-224.2).
        </p>
      </div>

      {error ? (
        <ErrorZona
          que={(error as Error).message}
          queHacer="Si dice x-api-key o CURADURIA_M2M_API_KEY, falta la clave de curaduría en el panel o en el compiler."
          accion={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <Seccion titulo="Cola" descripcion="El más antiguo primero" sinPadding>
          {isLoading ? (
            <EsqueletoFilas filas={4} />
          ) : casos.length === 0 ? (
            <Vacio
              titulo="No hay casos esperando revisión"
              descripcion="Cuando un aliado mande un caso desde su portal, aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-border">
              {casos.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/casos/${c.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{c.titulo || c.slug}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.aliado?.legal_name ?? c.partner_id}
                        {c.sector ? ` · ${c.sector}` : ""}
                        {c.tamano ? ` · ${c.tamano}` : ""}
                      </p>
                    </div>
                    {c.motivo_devolucion && <Pastilla tono="aviso">Corregido tras devolución</Pastilla>}
                    {c.version_publicada && <Pastilla>Tiene v{c.version_publicada}</Pastilla>}
                    <span className="w-32 text-right text-[11px] text-muted-foreground">{fecha(c.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
    </div>
  );
}
