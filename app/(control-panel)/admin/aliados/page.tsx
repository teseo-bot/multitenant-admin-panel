// app/(control-panel)/admin/aliados/page.tsx
// Alta de aliados (C.1–C.2 del manual operativo) — Knowledge Ops.
// Lista los partners y permite dar de alta uno nuevo. El backend (POST/GET
// /api/admin/partners, guard requirePlatformAdmin) crea el partner en
// status 'pending_verification' y dispara su bundle vía compiler-client.
// Distinta de /admin/catalogo-aliados (catálogo de paquetes publicados, solo lectura).

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Partner {
  id: string;
  slug: string;
  legal_name: string;
  vertical: string;
  contact_email: string;
  status: string;
  kms_key_id: string | null;
  created_at: string;
}

// Espejo del CreatePartnerBodySchema del backend (app/api/admin/partners/route.ts).
const VERTICALS = ["legal", "marketing", "consultoria", "reclutamiento", "otro"] as const;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

interface CreatePartnerInput {
  slug: string;
  legal_name: string;
  vertical: string;
  contact_email: string;
}

function usePartners() {
  return useQuery<Partner[]>({
    queryKey: ["admin", "partners", "list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/partners");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar aliados");
      }
      const data: { partners: Partner[] } = await res.json();
      return data.partners;
    },
  });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active" || status === "verified") return "default";
  if (status === "pending_verification") return "secondary";
  return "outline";
}

export default function AliadosPage() {
  const { data: partners, isLoading, error, refetch } = usePartners();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Aliados</h2>
          <p className="text-muted-foreground mt-1">
            Alta y estado de aliados del programa de conocimiento certificado.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Alta de aliado
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aliado</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Llave KMS</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners && partners.length > 0 ? (
                partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/aliados/${p.id}`} className="hover:underline">
                        {p.legal_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.vertical}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.contact_email}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.kms_key_id ? (
                        <span className="text-xs font-mono">{p.kms_key_id}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">pendiente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("es-MX")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Aún no hay aliados. Usa “Alta de aliado” para crear el primero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AltaAliadoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function AltaAliadoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [vertical, setVertical] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setSlug("");
    setLegalName("");
    setVertical("");
    setContactEmail("");
    setFormError(null);
  }

  const mutation = useMutation({
    mutationFn: async (input: CreatePartnerInput) => {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 422 trae details[]; 409 slug duplicado; el resto, error genérico.
        const details = Array.isArray(body?.details)
          ? body.details.map((d: { message: string }) => d.message).join("; ")
          : null;
        throw new Error(details || body?.error || "No se pudo crear el aliado");
      }
      return body as Partner;
    },
    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "partners", "list"] });
      toast.success(`Aliado “${partner.legal_name}” creado (pendiente de verificación)`);
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Validación de cliente que refleja al servidor — evita un round-trip obvio.
  const slugValid = SLUG_RE.test(slug);
  const canSubmit =
    slugValid && legalName.trim().length >= 3 && vertical !== "" && contactEmail.includes("@");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    mutation.mutate({
      slug: slug.trim(),
      legal_name: legalName.trim(),
      vertical,
      contact_email: contactEmail.trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Alta de aliado</DialogTitle>
            <DialogDescription>
              El aliado se crea en estado <strong>pendiente de verificación</strong> y se
              dispara la creación de su bundle. La llave KMS se aprovisiona en un paso
              posterior.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="bufete-demo"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Minúsculas, números y guiones; 3–40 caracteres. Identificador único e
                inmutable.
              </p>
              {slug !== "" && !slugValid && (
                <p className="text-xs text-destructive">Formato de slug inválido.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal_name">Razón social</Label>
              <Input
                id="legal_name"
                placeholder="Bufete Demo S.C."
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vertical">Vertical</Label>
              <Select value={vertical} onValueChange={(val) => setVertical(val || "")}>
                <SelectTrigger id="vertical">
                  <SelectValue placeholder="Selecciona una vertical" />
                </SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Correo de contacto</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="contacto@bufetedemo.mx"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                autoComplete="off"
              />
            </div>

            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Creando…" : "Crear aliado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
