// app/(control-panel)/admin/casos/[id]/page.tsx
// ADR-224 D-224.2: la ficha de curaduría de un caso de éxito.
//
// A la izquierda, el caso tal como lo leerá el prospecto y su encabezado; a la derecha, lo que la
// curaduría tiene que comprobar: la evidencia de la cifra y el permiso del cliente. Publicar exige
// marcar las dos comprobaciones; devolver exige un motivo, que es lo que el aliado leerá.
// El compiler vuelve a revisar el caso entero al publicar y calcula el embedding del dolor.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ErrorZona, EsqueletoFilas, Kicker, Pastilla, Seccion } from "@/components/ui/piezas";
import { MarkdownViewer } from "@/components/knowledge-ops/MarkdownViewer";
import {
  MOTIVO_DEVOLUCION_MIN,
  type AliadoResumen,
  type CasoParaCuraduria,
  type FuenteEvidencia,
} from "@/lib/partners/casos-curaduria";
import { ESTADO_ETIQUETA, LLAVE_COLA, TONO_ESTADO, fecha, llaveCaso, mensajeDeError } from "../comun";

interface Ficha {
  caso: CasoParaCuraduria;
  aliado: AliadoResumen | null;
  fuentes: FuenteEvidencia[];
}

type Obj = Record<string, any>;

const PERMISO: Record<string, string> = {
  explicito: "El cliente autorizó publicar su nombre",
  anonimizado: "Caso anonimizado",
};
const TIPO_EVIDENCIA: Record<string, string> = {
  documento: "Documento",
  metricas_cliente: "Métricas del cliente",
  testimonio_firmado: "Testimonio firmado",
  publicacion: "Publicación",
};
const TAMANO: Record<string, string> = { micro: "Micro", pequena: "Pequeña", mediana: "Mediana", grande: "Grande" };
const mxn = (n: unknown) => (typeof n === "number" ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }) : "—");

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-1.5 text-[13px]">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function CuraduriaCasoPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery<Ficha>({
    queryKey: llaveCaso(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/casos/${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeDeError(body, "No se pudo cargar el caso"));
      return body;
    },
  });

  const [evidenciaRevisada, setEvidenciaRevisada] = useState(false);
  const [permisoConfirmado, setPermisoConfirmado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<"publicar" | "devolver" | null>(null);

  if (error) {
    return (
      <div className="flex-1 p-8 pt-6">
        <ErrorZona
          que={(error as Error).message}
          queHacer="Vuelve a la cola e intenta de nuevo."
          accion={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex-1 p-8 pt-6">
        <EsqueletoFilas filas={8} />
      </div>
    );
  }

  const { caso, aliado, fuentes } = data;
  const fm = caso.frontmatter as Obj;
  const imp = (fm.implementacion ?? {}) as Obj;
  const res = (fm.resultado ?? {}) as Obj;
  const ev = (fm.evidencia ?? {}) as Obj;
  const enRevision = caso.estado === "en_revision";

  const accion = async (tipo: "publicar" | "devolver") => {
    setOcupado(tipo);
    try {
      const r = await fetch(`/api/admin/casos/${id}/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: tipo === "devolver" ? JSON.stringify({ motivo }) : "{}",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(mensajeDeError(body, tipo === "publicar" ? "No se pudo publicar" : "No se pudo devolver"));
        if (r.status === 409) refetch();
        return;
      }
      toast.success(
        tipo === "publicar"
          ? `Publicado como versión ${(body as { caso: CasoParaCuraduria }).caso.version_publicada}.`
          : "Devuelto al aliado con tu motivo."
      );
      queryClient.invalidateQueries({ queryKey: LLAVE_COLA });
      refetch();
      setMotivo("");
    } catch (err) {
      console.error("[curaduria.casos]", err);
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setOcupado(null);
    }
  };

  const puedePublicar = enRevision && caso.hallazgos.length === 0 && evidenciaRevisada && permisoConfirmado && ocupado === null;
  const puedeDevolver = enRevision && motivo.trim().length >= MOTIVO_DEVOLUCION_MIN && ocupado === null;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/admin/casos" className="mt-2 text-muted-foreground hover:text-foreground" aria-label="Volver a la cola">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{caso.titulo || caso.slug}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Caso presentado por <span className="font-medium text-foreground">{aliado?.legal_name ?? caso.partner_id}</span>
            {" · "}
            <span className="font-mono">{caso.slug}</span>
          </p>
        </div>
        <Pastilla tono={TONO_ESTADO[caso.estado]} punto>
          {ESTADO_ETIQUETA[caso.estado]}
          {caso.version_publicada ? ` · v${caso.version_publicada}` : ""}
        </Pastilla>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Seccion titulo="Lo que leerá el prospecto" descripcion="El cuerpo en sus seis partes">
            <MarkdownViewer content={caso.cuerpo_md} />
          </Seccion>

          <Seccion titulo="Encabezado" descripcion="Con esto se elige el caso para cada prospecto (D-224.4)">
            <div className="divide-y divide-border">
              <Dato etiqueta="Resumen de una línea">{fm.resumen ?? "—"}</Dato>
              <Dato etiqueta="Dolor canónico">{fm.dolor_canonico ?? "—"}</Dato>
              <Dato etiqueta="Sector · tamaño">
                <span className="font-mono">{fm.sector ?? "—"}</span> · {TAMANO[fm.tamano] ?? fm.tamano ?? "—"}
                {fm.ubicacion ? ` · ${fm.ubicacion}` : ""}
              </Dato>
              <Dato etiqueta="Anonimizado">{fm.anonimizado ? "Sí" : "No: nombra al cliente"}</Dato>
              <Dato etiqueta="Bloques HOCFLIT">
                <span className="font-mono">{Array.isArray(fm.bloques_hocflit) ? fm.bloques_hocflit.join(", ") : "—"}</span>
              </Dato>
              <Dato etiqueta="Tecnologías">{Array.isArray(fm.tecnologias) ? fm.tecnologias.join(", ") : "—"}</Dato>
              <Dato etiqueta="Implementación">
                {imp.duracion_semanas ?? "—"} semanas · {mxn(imp.costo_mxn?.min)} a {mxn(imp.costo_mxn?.max)}
                {imp.obstaculo ? <span className="block text-muted-foreground">Obstáculo: {imp.obstaculo}</span> : null}
              </Dato>
              <Dato etiqueta="Resultado">
                {res.kpi ?? "—"}: <span className="font-mono">{String(res.antes ?? "—")}</span> →{" "}
                <span className="font-mono">{String(res.despues ?? "—")}</span> {res.unidad ?? ""}
                {res.periodo_meses ? ` (medido en ${res.periodo_meses} meses)` : ""}
              </Dato>
            </div>
          </Seccion>

          <Seccion titulo="Nota del consultor" descripcion="Interna. Nunca se le envía al prospecto">
            <p className="whitespace-pre-wrap text-[13px]">{caso.nota_consultor_md || "—"}</p>
          </Seccion>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Seccion titulo="Evidencia" descripcion={TIPO_EVIDENCIA[ev.tipo] ?? "Sin tipo"}>
            <div className="space-y-3 text-[13px]">
              <div>
                <Kicker>Permiso del cliente</Kicker>
                <p className="mt-1">{PERMISO[ev.permiso_cliente] ?? "—"}</p>
              </div>
              <div>
                <Kicker>Fuentes</Kicker>
                <ul className="mt-1 space-y-1.5">
                  {fuentes.length === 0 && <li className="text-muted-foreground">Sin fuentes.</li>}
                  {fuentes.map((f) => (
                    <li key={f.ref} className="break-all">
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                          {f.titulo ?? f.url}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span>{f.titulo ?? "Documento sin registrar en la biblioteca del aliado"}</span>
                      )}
                      {f.gcs_object && <span className="block font-mono text-[11px] text-muted-foreground">{f.gcs_object}</span>}
                      {!f.url && !f.gcs_object && <span className="block font-mono text-[11px] text-muted-foreground">{f.ref}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Seccion>

          {caso.motivo_devolucion && (
            <Seccion titulo={enRevision ? "Se devolvió antes por" : "Motivo de la devolución"}>
              <p className="whitespace-pre-wrap text-[13px]">{caso.motivo_devolucion}</p>
            </Seccion>
          )}

          {enRevision ? (
            <Seccion titulo="Curaduría" descripcion="Publicar o devolver al aliado">
              <div className="space-y-4">
                {caso.hallazgos.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[12px]">
                    <p className="font-medium">El caso no cumple el contrato y no se puede publicar:</p>
                    <ul className="mt-1 list-disc pl-4">
                      {caso.hallazgos.map((h, i) => (
                        <li key={`${h.campo}-${i}`}>{h.mensaje_es}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-[13px]">
                    <Checkbox className="mt-0.5" checked={evidenciaRevisada} onCheckedChange={(v) => setEvidenciaRevisada(v === true)} />
                    Revisé la evidencia y sostiene la cifra de antes y después.
                  </label>
                  <label className="flex items-start gap-2 text-[13px]">
                    <Checkbox className="mt-0.5" checked={permisoConfirmado} onCheckedChange={(v) => setPermisoConfirmado(v === true)} />
                    {fm.anonimizado
                      ? "Confirmé que el caso no permite identificar al cliente."
                      : "Confirmé que el cliente autorizó publicar su nombre."}
                  </label>
                  <Button className="w-full" disabled={!puedePublicar} onClick={() => accion("publicar")}>
                    {ocupado === "publicar" ? "Publicando…" : "Publicar"}
                  </Button>
                </div>
                <div className="hairline-t space-y-2 pt-4">
                  <Textarea
                    value={motivo}
                    placeholder="Qué tiene que corregir el aliado. Lo leerá tal cual."
                    className="min-h-24"
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <Button variant="outline" className="w-full" disabled={!puedeDevolver} onClick={() => accion("devolver")}>
                    {ocupado === "devolver" ? "Devolviendo…" : "Devolver al aliado"}
                  </Button>
                </div>
              </div>
            </Seccion>
          ) : (
            <Seccion titulo="Curaduría">
              <p className="text-[13px] text-muted-foreground">
                {caso.estado === "borrador"
                  ? "Está en manos del aliado. Volverá a la cola cuando lo mande otra vez."
                  : caso.estado === "publicado"
                    ? `Publicado${caso.revisado_at ? ` el ${fecha(caso.revisado_at)}` : ""}.`
                    : "Retirado: ya no se muestra a prospectos."}
              </p>
            </Seccion>
          )}

          {caso.versiones.length > 0 && (
            <Seccion titulo="Versiones publicadas" sinPadding>
              <ul className="divide-y divide-border">
                {caso.versiones.map((v) => (
                  <li key={v.version} className="px-3 py-2 text-[12px]">
                    <span className="font-medium">v{v.version}</span> · {fecha(v.publicado_at)}
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">{v.content_sha256}</span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
        </aside>
      </div>
    </div>
  );
}
