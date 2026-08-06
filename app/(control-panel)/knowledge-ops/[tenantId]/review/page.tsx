// app/(control-panel)/knowledge-ops/[tenantId]/review/page.tsx
// UXUI P2 — Cola de revisión HITL.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AltitudeChip } from "@/components/knowledge-ops/AltitudeChip";
import { MarkdownViewer } from "@/components/knowledge-ops/MarkdownViewer";
import { LineDiffView } from "@/components/knowledge-ops/LineDiffView";
import { ErrorState } from "@/components/knowledge-ops/ErrorState";
import { usePendingProposals, useReviewProposal, useErrorToast } from "@/lib/knowledge-ops/hooks";
import { useConceptContent } from "@/lib/knowledge-ops/concept-content";
import { useCurrentUserEmail } from "@/lib/knowledge-ops/use-current-user";
import { parseFrontmatter, serializeFrontmatter } from "@/lib/knowledge-ops/parse-frontmatter";
import { ConceptFrontmatterSchema } from "@/lib/kdb/schemas";
import { cn } from "@/lib/utils";

/** Extrae frontmatter.title de new_content para el título del item de lista (UXUI P2). */
function extractTitle(newContent: string, targetPath: string): string {
  const parsed = parseFrontmatter(newContent);
  if (parsed.ok && typeof parsed.data.frontmatter.title === "string") {
    return parsed.data.frontmatter.title;
  }
  return targetPath;
}

export default function KnowledgeOpsReviewPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const reviewerEmail = useCurrentUserEmail();

  const { data: proposals, isLoading, error, refetch } = usePendingProposals(tenantId);
  useErrorToast(error, refetch);

  // "ordenadas por antigüedad" (UXUI P2) — la API devuelve ORDER BY created_at DESC
  // (más reciente primero, ver app/api/kdb/[tenantId]/proposals/route.ts); se invierte
  // en cliente para que la más antigua quede primero (cola FIFO de revisión).
  const orderedProposals = useMemo(() => {
    return proposals ? [...proposals].reverse() : [];
  }, [proposals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && orderedProposals.length > 0) {
      setSelectedId(orderedProposals[0].proposal_id);
    }
    if (selectedId && !orderedProposals.some((p) => p.proposal_id === selectedId)) {
      setSelectedId(orderedProposals[0]?.proposal_id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedProposals]);

  const selected = orderedProposals.find((p) => p.proposal_id === selectedId) ?? null;

  const [editedContent, setEditedContent] = useState<string>("");
  useEffect(() => {
    setEditedContent(selected?.new_content ?? "");
  }, [selected?.proposal_id, selected?.new_content]);

  const hasEdits = selected ? editedContent !== selected.new_content : false;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: liveConcept, isLoading: isLoadingLive } = useConceptContent(
    tenantId,
    selected?.action === "update" ? selected.target_path : null
  );

  const reviewMutation = useReviewProposal(tenantId);

  // Validación Zod inline del frontmatter editado (UXUI P2).
  const validation = useMemo(() => {
    if (!hasEdits) return { ok: true as const, errors: [] as string[] };
    const parsed = parseFrontmatter(editedContent);
    if (!parsed.ok) return { ok: false as const, errors: [parsed.error] };
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    if (!zodResult.success) {
      return {
        ok: false as const,
        errors: zodResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      };
    }
    return { ok: true as const, errors: [] };
  }, [editedContent, hasEdits]);

  const navigateList = (direction: 1 | -1) => {
    if (orderedProposals.length === 0) return;
    const idx = orderedProposals.findIndex((p) => p.proposal_id === selectedId);
    const nextIdx = Math.min(
      Math.max(idx + direction, 0),
      orderedProposals.length - 1
    );
    setSelectedId(orderedProposals[nextIdx].proposal_id);
  };

  const doApprove = () => {
    if (!selected || !reviewerEmail) return;
    if (hasEdits && !validation.ok) {
      toast.error("Corrige los errores de validación antes de aprobar con correcciones.");
      return;
    }
    reviewMutation.mutate(
      {
        proposalId: selected.proposal_id,
        decision: "approved",
        corrected_content: hasEdits ? editedContent : undefined,
        reviewer: reviewerEmail,
      },
      {
        onSuccess: () => toast.success("Proposal aprobada."),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Error al aprobar."),
      }
    );
  };

  const doReject = () => {
    if (!selected || !reviewerEmail) return;
    if (rejectReason.trim().length < 10) {
      toast.error("El motivo de rechazo debe tener al menos 10 caracteres.");
      return;
    }
    reviewMutation.mutate(
      {
        proposalId: selected.proposal_id,
        decision: "rejected",
        reviewer: reviewerEmail,
        reason: rejectReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Proposal rechazada.");
          setRejectOpen(false);
          setRejectReason("");
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Error al rechazar."),
      }
    );
  };

  // Atajos de teclado: a (aprobar), r (rechazar), j/k (navegar lista) — UXUI P2.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (isTyping) return;

      if (e.key === "a") {
        e.preventDefault();
        doApprove();
      } else if (e.key === "r") {
        e.preventDefault();
        setRejectOpen(true);
      } else if (e.key === "j") {
        e.preventDefault();
        navigateList(1);
      } else if (e.key === "k") {
        e.preventDefault();
        navigateList(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editedContent, hasEdits, validation.ok, reviewerEmail, orderedProposals, selectedId]);

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Lista izquierda 30% */}
        <div className="w-[30%] min-w-[280px] overflow-y-auto border-r">
          <div className="border-b p-4">
            <h2 className="font-semibold">Cola HITL</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Cargando…" : `${orderedProposals.length} pendientes`}
            </p>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : orderedProposals.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No hay proposals pendientes de revisión.
            </div>
          ) : (
            <ul aria-label="Lista de proposals pendientes">
              {orderedProposals.map((proposal) => (
                <li key={proposal.proposal_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(proposal.proposal_id)}
                    aria-current={proposal.proposal_id === selectedId}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b px-4 py-3 text-left text-sm hover:bg-muted/50",
                      proposal.proposal_id === selectedId && "bg-muted"
                    )}
                  >
                    <span className="font-medium line-clamp-1">
                      {extractTitle(proposal.new_content, proposal.target_path)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          proposal.action === "create"
                            ? "border-transparent bg-chart-2/10 text-chart-2 dark:bg-chart-2 dark:text-chart-2"
                            : "border-transparent bg-primary/10 text-primary dark:bg-primary dark:text-primary"
                        }
                      >
                        {proposal.action === "create" ? "Crear" : "Actualizar"}
                      </Badge>
                      <AltitudeChip altitude={proposal.altitude as 1 | 2 | 3 | 4 | 5} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {/* MergeProposal no incluye created_at en el contrato (TRD §4);
                          se usa el orden relativo, no una edad absoluta calculable. */}
                      pendiente
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Panel derecho 70% */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Selecciona una proposal de la lista.
            </div>
          ) : (
            <div className="flex-1 space-y-6 p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selected.target_path}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">
                      {selected.action === "create" ? "Crear" : "Actualizar"}
                    </Badge>
                    <AltitudeChip altitude={selected.altitude as 1 | 2 | 3 | 4 | 5} />
                    <span>
                      Drafts de origen: {selected.draft_ids.length} —{" "}
                      {/* No existe endpoint en TRD §9 para leer contenido de _staging/
                          por draft_id; se listan solo los ids. TODO K8-W2: exponer
                          GET /api/kdb/[tenantId]/staging/[draftId] para expandir el
                          contenido real del draft L1 en este panel. */}
                      <span className="font-mono text-xs">
                        {selected.draft_ids.join(", ")}
                      </span>
                    </span>
                  </div>
                </CardHeader>
              </Card>

              {selected.action === "update" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Diff: archivo vivo vs propuesto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingLive ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <LineDiffView
                        oldText={
                          liveConcept
                            ? serializeFrontmatter(liveConcept.frontmatter, liveConcept.body)
                            : ""
                        }
                        newText={selected.new_content}
                      />
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Markdown propuesto (creación)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownViewer content={selected.new_content} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Editor de corrección</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[300px] font-mono text-xs"
                    aria-label="Editor de corrección del contenido propuesto"
                  />
                  {hasEdits && !validation.ok && (
                    <div className="mt-2 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      <p className="font-medium">Errores de validación del frontmatter:</p>
                      <ul className="list-disc pl-4">
                        {validation.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Footer fijo con los 3 botones (UXUI P2) */}
      {selected && (
        <div className="flex items-center justify-end gap-3 border-t bg-background p-4">
          <span className="mr-auto text-xs text-muted-foreground">
            Atajos: <kbd className="rounded border px-1">a</kbd> aprobar ·{" "}
            <kbd className="rounded border px-1">r</kbd> rechazar ·{" "}
            <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd> navegar
          </span>
          <Button
            variant="destructive"
            aria-label="Rechazar proposal"
            onClick={() => setRejectOpen(true)}
            disabled={reviewMutation.isPending}
          >
            Rechazar
          </Button>
          <Button
            variant="outline"
            aria-label="Aprobar con correcciones"
            disabled={!hasEdits || !validation.ok || reviewMutation.isPending || !reviewerEmail}
            onClick={doApprove}
          >
            Aprobar con correcciones
          </Button>
          <Button
            aria-label="Aprobar proposal"
            disabled={hasEdits || reviewMutation.isPending || !reviewerEmail}
            onClick={doApprove}
          >
            Aprobar
          </Button>
        </div>
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo (mínimo 10 caracteres). Esta acción queda
              registrada en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo del rechazo…"
            aria-label="Motivo de rechazo"
            className="min-h-24"
          />
          {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
            <p className="text-xs text-destructive">
              El motivo debe tener al menos 10 caracteres ({rejectReason.trim().length}/10).
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={rejectReason.trim().length < 10}
              onClick={doReject}
            >
              Confirmar rechazo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
