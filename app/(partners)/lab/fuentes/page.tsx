// app/(partners)/lab/fuentes/page.tsx
// KL2-W2 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4, P-KL2): pantalla de la
// biblioteca de fuentes del aliado. Tabla (título, tipo, estado de destilación, fecha) +
// "Subir documento" / "Registrar URL" + acción por fila "Destilar a borradores".
//
// El layout (app/(partners)/lab/layout.tsx) ya aplicó requirePartnerMember(); esta página solo
// consume las APIs proxy (que vuelven a guardar) — mismo patrón que las demás páginas del Lab.

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Link2, Sparkles } from "lucide-react";

interface PartnerSourceRow {
  id: string;
  kind: "doc" | "url";
  title: string;
  source_ref: string;
  gcs_object: string | null;
  ingest_status: "registered" | "distilling" | "distilled" | "failed";
  created_at: string;
}

interface PartnerPackageRow {
  id: string;
  slug: string;
  title: string;
}

function useSources() {
  return useQuery<PartnerSourceRow[]>({
    queryKey: ["partners", "me", "sources"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/sources");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar fuentes");
      }
      const data = await res.json();
      return data.sources ?? [];
    },
  });
}

function usePackages() {
  return useQuery<PartnerPackageRow[]>({
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
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: PartnerSourceRow["ingest_status"] }) {
  switch (status) {
    case "registered":
      return <Badge variant="secondary">Registrada</Badge>;
    case "distilling":
      return <Badge variant="outline">Destilando…</Badge>;
    case "distilled":
      return (
        <Badge className="bg-chart-2/10 text-chart-2 dark:bg-chart-2/30 dark:text-chart-2">
          Destilada
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Falló</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function FuentesPage() {
  const { data: sources, isLoading, error, refetch } = useSources();
  const { data: packages } = usePackages();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [distillTarget, setDistillTarget] = useState<PartnerSourceRow | null>(null);

  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: ["partners", "me", "sources"] });
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca de fuentes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            El material crudo jamás se publica; solo los conceptos destilados y aprobados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUrlOpen(true)}>
            <Link2 className="h-4 w-4" />
            Registrar URL
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Subir documento
          </Button>
        </div>
      </div>

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
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sources ?? []).map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {source.kind === "doc" ? "Documento" : "URL"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={source.ingest_status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(source.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={source.kind !== "doc" || source.ingest_status === "distilling"}
                      title={
                        source.kind !== "doc"
                          ? "Destilado de URL no soportado v1"
                          : undefined
                      }
                      onClick={() => setDistillTarget(source)}
                    >
                      <Sparkles className="h-4 w-4" />
                      Destilar a borradores
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(sources ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aún no tienes fuentes. Registra tu primer documento o URL para empezar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <UploadDocDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onDone={invalidateSources}
      />
      <RegisterUrlDialog
        open={urlOpen}
        onOpenChange={setUrlOpen}
        onDone={invalidateSources}
      />
      <DistillDialog
        source={distillTarget}
        packages={packages ?? []}
        onOpenChange={(open) => {
          if (!open) setDistillTarget(null);
        }}
        onDone={invalidateSources}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subir documento
// ---------------------------------------------------------------------------
function UploadDocDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setFile(null);
  };

  async function submit() {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", file);

      const res = await fetch("/api/partners/me/sources", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.status === 409) {
        toast.error("Ya registraste este documento antes");
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Error al subir el documento");
        return;
      }

      toast.success("Documento registrado");
      reset();
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Error de conexión al subir el documento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>
            El archivo se guarda como fuente citable. No se publica hasta que lo destiles y
            apruebes los conceptos resultantes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Título</Label>
            <Input
              id="doc-title"
              placeholder="ej: Machote de contrato de arrendamiento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-file">Archivo</Label>
            <Input
              id="doc-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Subiendo…" : "Subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Registrar URL
// ---------------------------------------------------------------------------
function RegisterUrlDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setUrl("");
  };

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/partners/me/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "url", title, url }),
      });
      const data = await res.json();

      if (res.status === 409) {
        toast.error("Ya registraste esa URL antes");
        return;
      }
      if (!res.ok) {
        const detail = data.details?.[0]?.message;
        toast.error(detail || data.error || "Error al registrar la URL");
        return;
      }

      toast.success("URL registrada");
      reset();
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Error de conexión al registrar la URL");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar URL</DialogTitle>
          <DialogDescription>
            Registra un enlace público como fuente citable en tus conceptos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="url-title">Título</Label>
            <Input
              id="url-title"
              placeholder="ej: Guía oficial de la CONDUSEF"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url-value">URL</Label>
            <Input
              id="url-value"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Destilar a borradores
// ---------------------------------------------------------------------------
function DistillDialog({
  source,
  packages,
  onOpenChange,
  onDone,
}: {
  source: PartnerSourceRow | null;
  packages: PartnerPackageRow[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [packageId, setPackageId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!source) return;
    if (!packageId) {
      toast.error("Selecciona un paquete destino");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/partners/me/sources/${source.id}/distill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: packageId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al destilar la fuente");
        onOpenChange(false);
        onDone();
        return;
      }

      toast.success(`Se generaron ${data.count} borrador(es) en el paquete`);
      setPackageId("");
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Error de conexión al destilar la fuente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!source} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Destilar a borradores</DialogTitle>
          <DialogDescription>
            {source ? (
              <>
                Se generarán borradores en <em>_staging/</em> a partir de{" "}
                <strong>{source.title}</strong>. Los revisas y curas antes de publicar.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Paquete destino</Label>
            <Select value={packageId} onValueChange={(v) => setPackageId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un paquete…" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {packages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aún no tienes paquetes — crea uno primero.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !packageId}>
            {saving ? "Destilando…" : "Destilar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
