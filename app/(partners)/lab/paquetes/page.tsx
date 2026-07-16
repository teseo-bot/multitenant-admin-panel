// app/(partners)/lab/paquetes/page.tsx
// KL4-W1 (gap de navegación, hallazgo KL3-W1): índice de paquetes del partner con lista,
// creación de nuevo paquete, y navegación al editor de cada paquete.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Folder } from "lucide-react";

interface Package {
  id: string;
  slug: string;
  title: string;
  description?: string;
  systems: string[];
  altitude_max: number;
  status: string;
  created_at: string;
}

const HOCFLIT_SYSTEMS = [
  { value: "h-talento-humano", label: "Talento Humano" },
  { value: "o-operaciones", label: "Operaciones" },
  { value: "c-comercial", label: "Comercial" },
  { value: "f-finanzas", label: "Finanzas" },
  { value: "l-legal", label: "Legal" },
  { value: "i-innovacion", label: "Innovación" },
  { value: "t-tecnologia", label: "Tecnología" },
];

const SYSTEM_LABELS: Record<string, string> = {
  "h-talento-humano": "Talento Humano",
  "o-operaciones": "Operaciones",
  "c-comercial": "Comercial",
  "f-finanzas": "Finanzas",
  "l-legal": "Legal",
  "i-innovacion": "Innovación",
  "t-tecnologia": "Tecnología",
};

function usePackages() {
  return useQuery<{ packages: Package[] }>({
    queryKey: ["partners", "me", "packages"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/packages");
      if (!res.ok) {
        throw new Error("Error al cargar paquetes");
      }
      return res.json();
    },
  });
}

export default function PackagesPage() {
  const { data, isLoading, error } = usePackages();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const packages = data?.packages ?? [];

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Paquetes</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tus paquetes de conocimiento
            </p>
          </div>
          <CreatePackageDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSuccess={() => {
              setDialogOpen(false);
              queryClient.invalidateQueries({
                queryKey: ["partners", "me", "packages"],
              });
            }}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="border rounded-lg p-4 space-y-2"
              >
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertDescription>
              Error al cargar paquetes: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {!isLoading && packages.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="text-lg font-semibold">Sin paquetes aún</p>
              <p className="text-muted-foreground text-sm">
                Crea tu primer paquete para empezar a curar conocimiento
              </p>
            </div>
            <CreatePackageDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              onSuccess={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({
                  queryKey: ["partners", "me", "packages"],
                });
              }}
            />
          </div>
        )}

        {/* Packages list */}
        {!isLoading && packages.length > 0 && (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/lab/paquetes/${pkg.id}`}
                className="block"
              >
                <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors space-y-2 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{pkg.title}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {pkg.slug}
                      </p>
                    </div>
                    <Badge
                      variant={
                        pkg.status === "draft" ? "secondary" : "default"
                      }
                    >
                      {pkg.status === "draft" ? "Borrador" : pkg.status}
                    </Badge>
                  </div>

                  {pkg.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {pkg.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex flex-wrap gap-1">
                      {pkg.systems.map((system) => (
                        <Badge
                          key={system}
                          variant="outline"
                          className="text-xs"
                        >
                          {SYSTEM_LABELS[system] || system}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Alt. máx: <span className="font-semibold">{pkg.altitude_max}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground pt-1">
                    Creado: {new Date(pkg.created_at).toLocaleDateString("es-MX")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CreatePackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function CreatePackageDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePackageDialogProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systems, setSystems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(newTitle));
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60);
  };

  const toggleSystem = (value: string) => {
    setSystems((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!slug.trim()) {
      setError("El slug es requerido");
      return;
    }
    if (systems.length === 0) {
      setError("Debe seleccionar al menos un sistema");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/partners/me/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          systems,
          altitude_max: 3,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Error al crear el paquete");
        return;
      }

      toast.success("Paquete creado correctamente");
      setTitle("");
      setSlug("");
      setDescription("");
      setSystems([]);
      onSuccess();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger>
        <Button type="button">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo paquete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear nuevo paquete</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Título del paquete *</label>
            <Input
              placeholder="ej: Procesos de Selección y Onboarding"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Describe el dominio que cubrirá tu paquete
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Slug (identificador único) *
            </label>
            <Input
              placeholder="procesos-seleccion-onboarding"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isSubmitting}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Minúsculas, números y guiones
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Textarea
              placeholder="Descripción breve del contenido y objetivo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Sistemas que cubre (HOCFLIT) *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {HOCFLIT_SYSTEMS.map((system) => (
                <label
                  key={system.value}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted"
                >
                  <Checkbox
                    checked={systems.includes(system.value)}
                    onCheckedChange={() => toggleSystem(system.value)}
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">{system.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando…" : "Crear paquete"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
