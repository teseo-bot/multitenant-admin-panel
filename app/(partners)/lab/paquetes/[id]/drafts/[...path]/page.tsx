// app/(partners)/lab/paquetes/[id]/drafts/[...path]/page.tsx
// KL3-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4 P-KL3): editor guiado de
// 3 paneles. Esta WU construye izquierdo (guía: plantilla + sistema/altitud) y centro
// (markdown + preview); el derecho (validador en vivo) es KL4-W1 y queda como placeholder.
//
// `[...path]` porque `draft_path` incluye subcarpetas de fecha
// (`_staging/2026-07-08/slug.md`) — Next.js entrega los segmentos ya decodificados, así que
// solo se unen con "/" para reconstruir el path lógico.
//
// Guardar = PATCH /api/partners/me/drafts/update (proxy a /internal/partner-draft-update,
// PA2-W3 ya existente) — SIN autosave (v1 explícito). El selector de tipo aplica la plantilla
// SOLO sobre un draft vacío o con confirmación explícita (no se sobreescribe curaduría en
// progreso por accidente). El selector de sistema/altitud actualiza el frontmatter en el
// textarea vía manipulación de texto quirúrgica (lib/partners/templates.ts:
// setFrontmatterSystem/setFrontmatterAltitude) — no hay parser YAML nuevo en el panel.

"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownViewer } from "@/components/knowledge-ops/MarkdownViewer";
import {
  CONCEPT_TYPES,
  CONCEPT_TEMPLATES,
  buildTemplateMarkdown,
  setFrontmatterSystem,
  setFrontmatterAltitude,
  readFrontmatterHints,
  type ConceptType,
  type HocflitSystem,
} from "@/lib/partners/templates";
import { HOCFLIT_SYSTEMS } from "@/lib/kdb/schemas";

const SYSTEM_LABELS: Record<HocflitSystem, string> = {
  "h-talento-humano": "Talento Humano",
  "o-operaciones": "Operaciones",
  "c-comercial": "Comercial",
  "f-finanzas": "Finanzas",
  "l-legal": "Legal",
  "i-innovacion": "Innovación",
  "t-tecnologia": "Tecnología",
};

const ALTITUDE_OPTIONS = [1, 2, 3, 4, 5];

function useDraft(draftPath: string) {
  return useQuery<{ markdown: string }>({
    queryKey: ["partners", "me", "drafts", draftPath],
    queryFn: async () => {
      const res = await fetch(`/api/partners/me/drafts/get?path=${encodeURIComponent(draftPath)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al leer el borrador");
      }
      return res.json();
    },
    enabled: draftPath.length > 0,
  });
}

/** Recorta el bloque `---...---` para la vista previa (solo se previsualiza el cuerpo). */
function stripFrontmatterForPreview(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

export default function DraftEditorPage() {
  const params = useParams<{ id: string; path: string[] }>();
  const packageId = params.id;
  const draftPath = useMemo(() => (params.path ?? []).join("/"), [params.path]);

  const { data, isLoading, error } = useDraft(draftPath);
  const queryClient = useQueryClient();

  const [markdown, setMarkdown] = useState<string>("");
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selectedType, setSelectedType] = useState<ConceptType>("Insight");
  const [selectedSystem, setSelectedSystem] = useState<HocflitSystem>("l-legal");
  const [selectedAltitude, setSelectedAltitude] = useState<number>(3);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Precarga: solo la primera vez que llega el contenido del draft (no pisar ediciones en
  // curso si react-query revalida en segundo plano).
  useEffect(() => {
    if (data && !loadedOnce) {
      setMarkdown(data.markdown);
      const hints = readFrontmatterHints(data.markdown);
      if (hints.system) setSelectedSystem(hints.system);
      if (hints.altitude) setSelectedAltitude(hints.altitude);
      setLoadedOnce(true);
    }
  }, [data, loadedOnce]);

  function applyTemplate() {
    setMarkdown(buildTemplateMarkdown(selectedType, selectedSystem));
    toast.success("Plantilla insertada");
  }

  function handleInsertTemplateClick() {
    if (markdown.trim() === "") {
      applyTemplate();
    } else {
      setConfirmOverwriteOpen(true);
    }
  }

  function handleSystemChange(value: string | null) {
    if (!value) return;
    const system = value as HocflitSystem;
    setSelectedSystem(system);
    setMarkdown((prev) => setFrontmatterSystem(prev, system));
  }

  function handleAltitudeChange(value: string | null) {
    if (!value) return;
    const altitude = Number(value);
    setSelectedAltitude(altitude);
    setMarkdown((prev) => setFrontmatterAltitude(prev, altitude));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/partners/me/drafts/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_path: draftPath, markdown }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || "Error al guardar el borrador");
        return;
      }
      toast.success("Borrador guardado");
      queryClient.invalidateQueries({ queryKey: ["partners", "me", "packages", packageId, "drafts"] });
    } catch {
      toast.error("Error de conexión al guardar el borrador");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h1 className="text-lg font-semibold">Editor de concepto</h1>
          <p className="text-muted-foreground font-mono text-xs">{draftPath}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_280px]">
        {/* Panel izquierdo: guía */}
        <div className="flex flex-col gap-4 overflow-y-auto border-r p-4">
          <div className="space-y-2">
            <Label>Tipo de concepto</Label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ConceptType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONCEPT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CONCEPT_TEMPLATES[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full" onClick={handleInsertTemplateClick}>
              Insertar plantilla
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Sistema HOCFLIT</Label>
            <Select value={selectedSystem} onValueChange={handleSystemChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOCFLIT_SYSTEMS.map((system) => (
                  <SelectItem key={system} value={system}>
                    {SYSTEM_LABELS[system]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Altitud (1-5)</Label>
            <Select value={String(selectedAltitude)} onValueChange={handleAltitudeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALTITUDE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Guía sugerida — {CONCEPT_TEMPLATES[selectedType].label}</Label>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 text-xs text-muted-foreground">
              {CONCEPT_TEMPLATES[selectedType].body}
            </pre>
          </div>
        </div>

        {/* Panel central: editor + preview */}
        <div className="grid min-h-0 grid-rows-2 gap-2 p-4">
          <Textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="h-full resize-none font-mono text-xs"
            placeholder="Selecciona un tipo e inserta la plantilla para empezar…"
          />
          <div className="overflow-y-auto rounded-md border p-3">
            <MarkdownViewer content={stripFrontmatterForPreview(markdown)} />
          </div>
        </div>

        {/* Panel derecho: validador en vivo — KL4-W1, placeholder */}
        <div className="flex flex-col items-center justify-center gap-2 border-l border-dashed p-4 text-center text-sm text-muted-foreground">
          <p className="font-medium">Validación (KL4)</p>
          <p className="text-xs">
            El checklist N1/N2/N3 y los quick-fixes llegan con el panel validador del editor.
          </p>
        </div>
      </div>

      <Dialog open={confirmOverwriteOpen} onOpenChange={setConfirmOverwriteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Sobrescribir el borrador?</DialogTitle>
            <DialogDescription>
              Ya hay contenido en el editor. Insertar la plantilla de{" "}
              <strong>{CONCEPT_TEMPLATES[selectedType].label}</strong> reemplaza TODO el texto
              actual. Esta acción no se guarda sola — puedes deshacerla sin guardar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOverwriteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                applyTemplate();
                setConfirmOverwriteOpen(false);
              }}
            >
              Sobrescribir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
