// app/(partners)/lab/contratos/page.tsx
// KL6-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §5): vista de contratos
// del aliado de sesión — solo lectura + botón Firmar.
//
// PA4-W4a: activa el botón Firmar (antes deshabilitado con tooltip "La firma OTP llega
// con PA4-W2") con un diálogo de OTP contra `POST /api/partners/me/contracts/{id}/sign`
// (PA4-W2, ya existente): sin body solicita el código, con `{code}` lo verifica. Patrón de
// diálogo + toasts (sonner) espejado de app/(partners)/lab/fuentes/page.tsx.

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const queryClient = useQueryClient();

  const [signTarget, setSignTarget] = useState<PartnerContractRow | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  async function handleFirmarClick(contract: PartnerContractRow) {
    setRequestingId(contract.id);
    try {
      const res = await fetch(`/api/partners/me/contracts/${contract.id}/sign`, {
        method: "POST",
      });
      if (res.status === 202) {
        toast.success("Código enviado a tu correo");
        setSignTarget(contract);
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || "Error al solicitar el código de firma");
    } catch {
      toast.error("Error de conexión al solicitar el código de firma");
    } finally {
      setRequestingId(null);
    }
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
                        disabled={requestingId === contract.id}
                        onClick={() => handleFirmarClick(contract)}
                      >
                        {requestingId === contract.id ? "Enviando…" : "Firmar"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}

      <SignOtpDialog
        contract={signTarget}
        onOpenChange={(open) => {
          if (!open) setSignTarget(null);
        }}
        onSigned={() => {
          setSignTarget(null);
          queryClient.invalidateQueries({ queryKey: ["partners", "me", "contracts"] });
          toast.success("Contrato firmado");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diálogo de firma OTP (PA4-W4a)
// ---------------------------------------------------------------------------
function SignOtpDialog({
  contract,
  onOpenChange,
  onSigned,
}: {
  contract: PartnerContractRow | null;
  onOpenChange: (open: boolean) => void;
  onSigned: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function verify() {
    if (!contract) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/partners/me/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setCode("");
        onSigned();
        return;
      }

      const body = await res.json().catch(() => ({}));
      switch (res.status) {
        case 401: {
          const remaining = body?.attempts_remaining;
          setErrorMsg(
            typeof remaining === "number"
              ? `Código incorrecto (${remaining} intento(s) restante(s))`
              : "Código incorrecto"
          );
          break;
        }
        case 410:
          setErrorMsg("El código expiró, solicita uno nuevo");
          break;
        case 423:
        case 429:
          setErrorMsg("Demasiados intentos fallidos, bloqueado temporalmente");
          break;
        case 422:
          setErrorMsg("El contrato no tiene términos, no se puede firmar");
          break;
        default:
          setErrorMsg(body?.error || "Error al verificar el código");
      }
    } catch {
      setErrorMsg("Error de conexión al verificar el código");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog
      open={!!contract}
      onOpenChange={(open) => {
        if (!open) {
          setCode("");
          setErrorMsg(null);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Firmar contrato</DialogTitle>
          <DialogDescription>
            Ingresa el código de 6 dígitos enviado a tu correo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="otp-code">Código</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={verifying}
            />
          </div>
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        </div>
        <DialogFooter>
          <Button onClick={verify} disabled={verifying || code.length !== 6}>
            {verifying ? "Verificando…" : "Verificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
