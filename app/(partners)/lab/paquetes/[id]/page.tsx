// app/(partners)/lab/paquetes/[id]/page.tsx
// KL4-W3 (PLAN-KnowledgeLab-Epicas-KL.md): vista de un paquete del aliado — lista sus
// drafts pendientes con semáforo de validación (batch validate vía Promise.allSettled).
// Botón Publicar visible solo si member_role==='curator', deshabilitado si ∃ rojo o sin
// validar. El flujo de publicación (KL5-W1) se inicia desde aquí.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PencilLine, Rocket, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { semaforoFor, countErrors, SEMAFORO_LABELS, type ValidationStatus } from "@/lib/partners/validation-status";
import { type ValidationReport } from "@/lib/partners/compiler-client";

interface PartnerPackageRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  systems: string[];
  altitude_max: number;
  status: string;
  created_at: string;
}

interface PartnerDraftListItem {
  path: string;
  title: string;
  type: string;
  system: string;
  altitude: number;
  pii: string;
  confidence: string;
  updated?: string;
}

interface SessionData {
  member_role: "member" | "curator";
  partner: {
    id: string;
    slug: string;
    legal_name: string;
    status: string;
  };
  uid: string;
}

interface DraftValidationState {
  [draftPath: string]: {
    loading: boolean;
    report?: ValidationReport;
    error?: string;
  };
}

function usePackage(packageId: string) {
  return useQuery<PartnerPackageRow | undefined>({
    queryKey: ["partners", "me", "packages"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/packages");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar paquetes");
      }
      const data = await res.json();
      return data.packages ?? [];
    },
    select: (packages) => (packages as unknown as PartnerPackageRow[])?.find((p) => p.id === packageId),
  });
}

function useDrafts(packageId: string) {
  return useQuery<PartnerDraftListItem[]>({
    queryKey: ["partners", "me", "packages", packageId, "drafts"],
    queryFn: async () => {
      const res = await fetch(`/api/partners/me/packages/${packageId}/drafts`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar borradores");
      }
      const data = await res.json();
      return data.drafts ?? [];
    },
  });
}

function useSession() {
  return useQuery<SessionData>({
    queryKey: ["partners", "me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/session");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al obtener sesión");
      }
      return res.json();
    },
  });
}

function PiiBadge({ pii }: { pii: string }) {
  if (pii === "redacted") {
    return <Badge variant="outline">PII redactada</Badge>;
  }
  return (
    <Badge className="bg-chart-2/10 text-chart-2 dark:bg-chart-2/30 dark:text-chart-2">
      Limpio
    </Badge>
  );
}

function SemaforoIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case "green":
      return <CheckCircle2 className="h-5 w-5 text-chart-2" />;
    case "amber":
      return <AlertCircle className="h-5 w-5 text-primary" />;
    case "red":
      return <Circle className="h-5 w-5 text-destructive fill-destructive" />;
    case "gray":
      return <Circle className="h-5 w-5 text-muted-foreground fill-muted-foreground" />;
  }
}

function draftEditorHref(packageId: string, draftPath: string): string {
  // draft_path llega como "_staging/2026-07-08/slug.md" — cada segmento se codifica por
  // separado para el catch-all [...path] del editor (app/.../drafts/[...path]/page.tsx).
  const encodedSegments = draftPath.split("/").map(encodeURIComponent).join("/");
  return `/lab/paquetes/${packageId}/drafts/${encodedSegments}`;
}

function PublishModal({
  open,
  onOpenChange,
  pkg,
  drafts,
  validationStates,
  onConfirm,
  isPublishing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: PartnerPackageRow | undefined;
  drafts: PartnerDraftListItem[] | undefined;
  validationStates: DraftValidationState;
  onConfirm: (draftPaths: string[]) => Promise<void>;
  isPublishing: boolean;
}) {
  const validDrafts = (drafts ?? []).filter((d) => {
    const status = semaforoFor(validationStates[d.path]?.report);
    return status === "green" || status === "amber";
  });

  const systems = Array.from(new Set(validDrafts.map((d) => d.system)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar paquete</DialogTitle>
          <DialogDescription>Resumen de los cambios que se publicarán</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pkg && (
            <>
              <div>
                <div className="text-sm font-semibold text-muted-foreground">Paquete</div>
                <div className="text-base font-medium">{pkg.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Conceptos</div>
                  <div className="text-2xl font-bold">{validDrafts.length}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Sistemas</div>
                  <div className="text-base font-medium">{systems.join(", ") || "—"}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-muted-foreground">Versión siguiente</div>
                <div className="text-base font-mono font-medium">v1</div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const draftPaths = validDrafts.map((d) => d.path);
              onConfirm(draftPaths);
            }}
            disabled={isPublishing}
          >
            {isPublishing ? "Publicando..." : "Confirmar publicación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PackageDetailPage() {
  const { id: packageId } = useParams<{ id: string }>();
  const { data: pkg } = usePackage(packageId);
  const { data: drafts, isLoading, error, refetch } = useDrafts(packageId);
  const { data: session } = useSession();

  const [validationStates, setValidationStates] = useState<DraftValidationState>({});
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishError, setPublishError] = useState<{
    message: string;
    reports?: any[];
  } | null>(null);

  const publishMutation = useMutation({
    mutationFn: async (draftPaths: string[]) => {
      const res = await fetch(`/api/partners/me/packages/${packageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_paths: draftPaths }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw {
          status: res.status,
          error: body.error || "Error al publicar",
          reports: body.reports,
        };
      }

      return res.json();
    },
    onSuccess: (data) => {
      setPublishModalOpen(false);
      setPublishError(null);
      // Mostrar pantalla de éxito (versión, hash, etc.)
      alert(`Publicado exitosamente!\nVersión: ${data.version}\nHash: ${data.manifest_sha256}`);
      // Recargar la lista de borradores
      refetch();
    },
    onError: (err: any) => {
      setPublishError({
        message: err.error,
        reports: err.reports,
      });
    },
  });

  // Batch validate drafts on component mount and when drafts change
  useEffect(() => {
    if (!drafts || drafts.length === 0) {
      return;
    }

    const validateDrafts = async () => {
      // Leer cada draft desde el editor
      const validationPromises = drafts.map(async (draft) => {
        // Marcar como loading
        setValidationStates((prev) => ({
          ...prev,
          [draft.path]: { loading: true },
        }));

        try {
          // Obtener el markdown del draft
          const draftRes = await fetch(`/api/partners/me/drafts/get?path=${encodeURIComponent(draft.path)}`).catch(() => null);

          if (!draftRes || !draftRes.ok) {
            throw new Error("Error al leer el draft");
          }

          const draftData = await draftRes.json();
          const markdown = draftData.markdown || "";

          // Validar el draft
          const validateRes = await fetch("/api/partners/me/drafts/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draft_path: draft.path,
              markdown,
              package_id: packageId,
            }),
          });

          if (!validateRes.ok) {
            throw new Error("Error de validación");
          }

          const report = await validateRes.json();
          setValidationStates((prev) => ({
            ...prev,
            [draft.path]: { loading: false, report },
          }));
        } catch (err) {
          setValidationStates((prev) => ({
            ...prev,
            [draft.path]: {
              loading: false,
              error: err instanceof Error ? err.message : "Error desconocido",
            },
          }));
        }
      });

      // Ejecutar todas las validaciones en paralelo
      await Promise.allSettled(validationPromises);
    };

    validateDrafts();
  }, [drafts, packageId]);

  // Calcular si se puede publicar
  const canPublish =
    session?.member_role === "curator" &&
    drafts &&
    drafts.length > 0 &&
    drafts.every((draft) => {
      const state = validationStates[draft.path];
      if (!state || state.loading) {
        return false; // Sin validar aún
      }
      if (state.error) {
        return false; // Error en la validación
      }
      const status = semaforoFor(state.report);
      return status !== "red"; // No tiene errores
    });

  // Contar errores totales
  const totalErrors = Object.values(validationStates).reduce((sum, state) => {
    return sum + countErrors(state.report);
  }, 0);

  // Contar drafts sin validar
  const unvalidatedCount = drafts?.filter(
    (draft) => !validationStates[draft.path] || validationStates[draft.path].loading
  ).length ?? 0;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {pkg?.title ?? "Paquete"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Borradores pendientes de curar. Los ya publicados no aparecen aquí (quedan en el
            historial del paquete).
          </p>
        </div>

        {session?.member_role === "curator" ? (
          <Tooltip>
            <TooltipTrigger>
              <Button
                onClick={() => {
                  setPublishError(null);
                  setPublishModalOpen(true);
                }}
                disabled={!canPublish || publishMutation.isPending}
              >
                <Rocket className="h-4 w-4" />
                {publishMutation.isPending ? "Publicando..." : "Publicar"}
              </Button>
            </TooltipTrigger>
            {!canPublish && (
              <TooltipContent>
                {totalErrors > 0
                  ? `${totalErrors} concepto${totalErrors !== 1 ? "s" : ""} con errores de estructura`
                  : unvalidatedCount > 0
                    ? "Validando borradores..."
                    : "Todos los conceptos son válidos"}
              </TooltipContent>
            )}
          </Tooltip>
        ) : (
          <Button disabled title="Solo los curadores pueden publicar">
            <Rocket className="h-4 w-4" />
            Publicar
          </Button>
        )}
      </div>

      {publishError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <div className="text-sm font-semibold text-destructive mb-2">{publishError.message}</div>
          {publishError.reports && publishError.reports.length > 0 && (
            <div className="text-xs space-y-2">
              {publishError.reports.map((report, idx) => (
                <div key={idx} className="bg-background p-2 rounded border border-destructive/20">
                  <div className="font-mono text-destructive/80">{report.path}</div>
                  {report.findings
                    .filter((f: any) => f.severity === "error")
                    .map((f: any, fidx: number) => (
                      <div key={fidx} className="ml-4 text-destructive/70">
                        • {f.message_es}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}{" "}
          <Button variant="link" className="px-1" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Sistema</TableHead>
                <TableHead>Altitud</TableHead>
                <TableHead>PII</TableHead>
                <TableHead>Confianza</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(drafts ?? []).map((draft) => {
                const state = validationStates[draft.path];
                const status = semaforoFor(state?.report);

                return (
                  <TableRow key={draft.path}>
                    <TableCell>
                      {state?.loading ? (
                        <div className="flex items-center gap-2">
                          <Circle className="h-4 w-4 text-muted-foreground animate-pulse" />
                          <span className="text-xs text-muted-foreground">validando...</span>
                        </div>
                      ) : state?.error ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <Circle className="h-5 w-5 text-muted-foreground fill-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>{state.error}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <div>
                              <SemaforoIcon status={status} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{SEMAFORO_LABELS[status]}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {draft.title || <span className="text-muted-foreground italic">Sin título</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{draft.type || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{draft.system || "—"}</TableCell>
                    <TableCell className="text-sm">{draft.altitude}</TableCell>
                    <TableCell>
                      <PiiBadge pii={draft.pii} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {draft.confidence || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" render={<Link href={draftEditorHref(packageId, draft.path)} />}>
                        <PencilLine className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(drafts ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Aún no hay borradores pendientes en este paquete. Destílalos desde la
                    biblioteca de fuentes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        pkg={pkg}
        drafts={drafts}
        validationStates={validationStates}
        onConfirm={async (draftPaths) => {
          await publishMutation.mutateAsync(draftPaths);
        }}
        isPublishing={publishMutation.isPending}
      />
    </div>
  );
}
