"use client";

// ADR-221 — la pantalla que crea el proyecto ES la pantalla del QR.
//
// Los pasos 1 y 3 del loop operativo (crear el proyecto / compartir el QR o el número) se
// colapsan aquí en un solo gesto: creas `plasticos`, y te devuelve la imagen para el slide y
// la palabra que el ponente dirá en voz alta. Antes de esto, `acoeq` y `cluster-plasticos`
// existían sólo porque alguien abrió una consola y escribió el INSERT a mano.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, TriangleAlert } from "lucide-react";
import { normalizarClave, validarClave } from "@/lib/projects/clave";

interface Proyecto {
  id: string;
  slug: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  enlace: string | null;
}

export function ProjectsTab({ tenantId }: { tenantId: string }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [numero, setNumero] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  /** Distinto de la lista vacía: aquí es que falta la 016, y la pantalla lo dice entera. */
  const [faltaMigracion, setFaltaMigracion] = useState(false);

  const [nombre, setNombre] = useState("");
  const [claveEditada, setClaveEditada] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // La clave sigue al nombre hasta que alguien la toca; a partir de ahí manda la persona.
  // Derivarla siempre obligaría a renombrar la conferencia para arreglar la clave, y son dos
  // cosas distintas: el nombre va en la factura, la clave se dice en voz alta.
  const clave = claveEditada ?? normalizarClave(nombre);
  const claveValida = useMemo(() => validarClave(clave), [clave]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/projects`);
      if (res.status === 501) {
        setFaltaMigracion(true);
        setProyectos([]);
        return;
      }
      if (!res.ok) {
        toast.error("No se pudo leer el catálogo de proyectos.");
        return;
      }
      const data = await res.json();
      setFaltaMigracion(false);
      setProyectos(data.proyectos ?? []);
      setNumero(data.numero ?? null);
    } finally {
      setCargando(false);
    }
  }, [tenantId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    if (!claveValida.ok) {
      toast.error(claveValida.error);
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, displayName: nombre.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo dar de alta el proyecto.");
        return;
      }
      toast.success(`Proyecto «${data.proyecto.slug}» dado de alta y abierto.`);
      setNombre("");
      setClaveEditada(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (p: Proyecto, isActive: boolean) => {
    const res = await fetch(`/api/admin/tenants/${tenantId}/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "No se pudo cambiar el estado.");
      return;
    }
    toast.success(
      isActive
        ? `«${p.slug}» abierto: ya se puede vincular.`
        : `«${p.slug}» cerrado. Las conversaciones vivas siguen; no se vinculan nuevas.`
    );
    cargar();
  };

  if (faltaMigracion) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>Falta la migración 016 en esta base</AlertTitle>
        <AlertDescription>
          La tabla <code>tenant_projects</code> no existe aquí, así que no es que este tenant no
          tenga proyectos: es que no hay dónde guardarlos. El CD del panel no aplica migraciones;
          hay que correr <code>016_tenant_projects.sql</code> a mano contra esta base.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Nueva conferencia</CardTitle>
          <CardDescription>
            La <strong>clave</strong> es lo que el ponente dice en voz alta y lo que el asistente
            teclea. Se compara sin distinguir mayúsculas, acentos ni espacios de sobra.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 items-start">
            <div className="space-y-2">
              <Label htmlFor="proyecto-nombre">Nombre</Label>
              <Input
                id="proyecto-nombre"
                placeholder="Cluster de Plásticos Querétaro 2026"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El nombre largo, el de la factura y el informe.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proyecto-clave">Clave</Label>
              <Input
                id="proyecto-clave"
                placeholder="plasticos"
                value={clave}
                onChange={(e) => setClaveEditada(e.target.value)}
                // Sólo se canoniza al salir si la persona LLEGÓ a escribir. Normalizar
                // siempre fijaría `claveEditada` con sólo pasar por el campo, y a partir de
                // ahí el nombre dejaría de arrastrar la clave sin que nada lo indique.
                onBlur={() => setClaveEditada((c) => (c === null ? null : normalizarClave(c)))}
                aria-invalid={clave.length > 0 && !claveValida.ok}
              />
              <p className="text-xs text-muted-foreground">
                {clave.length > 0 && !claveValida.ok ? (
                  <span className="text-destructive">{(claveValida as { error: string }).error}</span>
                ) : (
                  <>Corta y decible. Se guardará como <code>{clave || "…"}</code>.</>
                )}
              </p>
            </div>
          </div>
          <Button onClick={crear} disabled={guardando || !nombre.trim() || !claveValida.ok}>
            {guardando ? "Dando de alta…" : "Dar de alta y abrir"}
          </Button>
        </CardContent>
      </Card>

      {!numero && !cargando && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>Este tenant no tiene línea de WhatsApp</AlertTitle>
          <AlertDescription>
            Los proyectos se dan de alta igual y la clave funciona en cuanto haya línea, pero sin
            un canal <code>whatsapp</code> activo en <code>tenant_channels</code> no hay enlace que
            codificar y no se dibuja ningún QR. Meta exige una línea real y verificada.
          </AlertDescription>
        </Alert>
      )}

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando proyectos…</p>
      ) : proyectos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este tenant todavía no tiene proyectos. El primero que des de alta queda abierto.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {proyectos.map((p) => (
            <Card key={p.id} className={p.isActive ? "" : "opacity-70"}>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="font-mono text-2xl tracking-tight break-all">
                    {p.slug}
                  </CardTitle>
                  <CardDescription className="break-words">{p.displayName}</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={(v: boolean) => alternar(p, v)}
                    aria-label={p.isActive ? "Cerrar la conferencia" : "Abrir la conferencia"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.isActive ? "Abierta" : "Cerrada"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.enlace ? (
                  <>
                    <div className="flex items-start gap-4">
                      {/* El QR se pide al servidor, que es quien tiene el número. Se pinta
                          también con la conferencia cerrada: sirve para revisarlo antes de
                          imprimirlo, y el rótulo de abajo dice qué pasa si alguien lo escanea. */}
                      <img
                        src={`/api/admin/tenants/${tenantId}/projects/${p.id}/qr`}
                        alt={`Código QR de ${p.slug}`}
                        className="size-32 shrink-0 rounded border bg-white p-1"
                      />
                      <div className="min-w-0 space-y-2 text-xs">
                        <p className="text-muted-foreground break-all font-mono">{p.enlace}</p>
                        {/* Ancla suelta y no <Link>: esto descarga un fichero que genera el
                            servidor, no navega dentro de la app. */}
                        <a
                          href={`/api/admin/tenants/${tenantId}/projects/${p.id}/qr?descargar=1`}
                          download={`qr-${p.slug}.svg`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Download className="mr-2 size-3.5" />
                          SVG para el slide
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.isActive ? (
                        <>
                          Quien lo escanee manda <code>{p.slug}</code> y queda vinculado a esta
                          conferencia. El texto precargado se puede borrar antes de enviar: por eso
                          el agente también pregunta.
                        </>
                      ) : (
                        <>
                          Cerrada: quien lo escanee no vincula nada y el agente le ofrecerá hablar
                          con el equipo.
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin línea de WhatsApp no hay QR. La clave <code>{p.slug}</code> ya está
                    reservada y funcionará en cuanto se dé de alta el canal.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
