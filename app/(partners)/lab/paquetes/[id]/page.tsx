// app/(partners)/lab/paquetes/[id]/page.tsx
// KL3-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4): vista de un paquete del
// aliado — lista sus drafts pendientes (título, tipo, sistema, altitud, badge PII, estado) con
// enlace al editor guiado (P-KL3). El botón "Publicar" es un placeholder deshabilitado: el
// flujo real de publicación es KL4-W3/KL5, fuera de alcance de esta WU.
//
// El layout (app/(partners)/lab/layout.tsx) ya aplicó requirePartnerMember() server-side; esta
// página solo consume APIs proxy (que vuelven a guardar) — mismo patrón que fuentes/page.tsx.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { PencilLine, Rocket } from "lucide-react";

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

function PiiBadge({ pii }: { pii: string }) {
  if (pii === "redacted") {
    return <Badge variant="outline">PII redactada</Badge>;
  }
  return (
    <Badge className="bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100">
      Limpio
    </Badge>
  );
}

function draftEditorHref(packageId: string, draftPath: string): string {
  // draft_path llega como "_staging/2026-07-08/slug.md" — cada segmento se codifica por
  // separado para el catch-all [...path] del editor (app/.../drafts/[...path]/page.tsx).
  const encodedSegments = draftPath.split("/").map(encodeURIComponent).join("/");
  return `/lab/paquetes/${packageId}/drafts/${encodedSegments}`;
}

export default function PackageDetailPage() {
  const { id: packageId } = useParams<{ id: string }>();
  const { data: pkg } = usePackage(packageId);
  const { data: drafts, isLoading, error, refetch } = useDrafts(packageId);

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
        <Button disabled title="El flujo de publicación llega con el validador en vivo (KL4/KL5).">
          <Rocket className="h-4 w-4" />
          Publicar (próximamente)
        </Button>
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
                <TableHead>Sistema</TableHead>
                <TableHead>Altitud</TableHead>
                <TableHead>PII</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(drafts ?? []).map((draft) => (
                <TableRow key={draft.path}>
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
              ))}
              {(drafts ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Aún no hay borradores pendientes en este paquete. Destílalos desde la
                    biblioteca de fuentes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
