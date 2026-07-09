// app/(partners)/lab/contratos/page.tsx
// KL6-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §5): vista de contratos
// del aliado de sesión — solo lectura + botón Firmar (deshabilitado con tooltip).

"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PartnerContractRow } from "@/app/api/partners/me/contracts/route";

function useContracts() {
  return useQuery<{ contracts: PartnerContractRow[] }>({
    queryKey: ["partners", "me", "contracts"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/contracts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al obtener contratos");
      }
      return res.json();
    },
  });
}

function getStatusBadgeVariant(
  status: PartnerContractRow["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "pending_signature":
      return "secondary";
    case "suspended":
    case "terminated":
    case "expired":
      return "destructive";
    case "draft":
      return "outline";
    default:
      return "outline";
  }
}

function getStatusLabel(status: PartnerContractRow["status"]): string {
  const labels: Record<PartnerContractRow["status"], string> = {
    draft: "Borrador",
    pending_signature: "Pendiente de firma",
    active: "Activo",
    suspended: "Suspendido",
    terminated: "Terminado",
    expired: "Expirado",
  };
  return labels[status];
}

function getKindBadgeVariant(kind: "direct" | "marketplace"): "default" | "secondary" {
  return kind === "direct" ? "default" : "secondary";
}

function getKindLabel(kind: "direct" | "marketplace"): string {
  return kind === "direct" ? "Directo" : "Marketplace";
}

export default function ContractosPage() {
  const { data, isLoading, error } = useContracts();

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
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Contratos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona tus contratos con clientes y conoce sus términos.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.contracts || data.contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Aún no tienes contratos</p>
            <p className="mt-1">
              Knowledge Ops te contactará cuando un cliente licencie tu paquete.
            </p>
          </div>
        </div>
      ) : (
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paquete</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Cláusula de derivados</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.package_title || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={getKindBadgeVariant(contract.kind)}>
                      {getKindLabel(contract.kind)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(contract.status)}>
                      {getStatusLabel(contract.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      {format(new Date(contract.valid_from), "d MMM yyyy", { locale: es })}
                    </div>
                    <div className="text-muted-foreground">
                      {format(new Date(contract.valid_until), "d MMM yyyy", { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {contract.derived_knowledge_clause === "client_keeps"
                      ? "Cliente retiene"
                      : "Revisión al salir"}
                  </TableCell>
                  <TableCell className="text-right">
                    {contract.status === "pending_signature" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="cursor-not-allowed"
                        title="La firma OTP llega con PA4-W2"
                      >
                        Firmar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}
    </div>
  );
}
