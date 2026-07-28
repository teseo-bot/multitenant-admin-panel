// app/(control-panel)/admin/aliados/[id]/page.tsx
// Detalle de un aliado: ficha editable + membresías.
//
// Cablea dos backends que ya existían sin UI: PATCH /api/admin/partners/[id]
// (PA4-W1) y el nuevo /api/admin/partners/[id]/members. La membresía es lo que
// habilita el portal — sin fila en `partner_members` una cuenta autentica bien
// y cae en /unauthorized.
//
// NO se edita aquí el conocimiento del aliado (paquetes/versiones): eso vive en
// el Lab del portal y su firma es la garantía de autoría. Aquí solo supervisión.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Copy } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const VERTICALS = ["legal", "marketing", "consultoria", "reclutamiento", "otro"] as const;
const STATUSES = ["pending_verification", "verified", "suspended", "offboarded"] as const;
const ROLES = ["member", "curator"] as const;

const STATUS_HELP: Record<string, string> = {
  pending_verification: "Alta creada, sin verificar. Sus miembros ya pueden entrar al Lab.",
  verified: "Aliado verificado: puede publicar y firmar paquetes.",
  suspended: "Suspendido: se corta la operación sin borrar nada.",
  offboarded: "Salida del programa. Estado terminal.",
};

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

interface Member {
  partner_id: string;
  user_id: string;
  member_role: string;
  created_at: string;
  onboarded_at: string | null;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "verified") return "default";
  if (status === "pending_verification") return "secondary";
  return "outline";
}

export default function AliadoDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const queryClient = useQueryClient();

  const partnerQuery = useQuery<Partner>({
    queryKey: ["admin", "partners", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/partners/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al cargar el aliado");
      }
      const data = await res.json();
      return data.partner ?? data;
    },
  });

  const membersQuery = useQuery<{ members: Member[]; idp_configured: boolean }>({
    queryKey: ["admin", "partners", id, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/partners/${id}/members`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al cargar las membresías");
      }
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "partners", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "partners", "list"] });
  };

  const updatePartner = useMutation({
    mutationFn: async (patch: Partial<Partner>) => {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Aliado actualizado");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (partnerQuery.isLoading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Skeleton className="h-10 w-[240px]" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <div className="flex-1 p-8 pt-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="text-sm">{(partnerQuery.error as Error)?.message ?? "Aliado no encontrado"}</p>
          <Link href="/admin/aliados" className="mt-2 inline-block text-sm underline">
            Volver a aliados
          </Link>
        </div>
      </div>
    );
  }

  const partner = partnerQuery.data;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="space-y-2">
        <Link
          href="/admin/aliados"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Aliados
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">{partner.legal_name}</h2>
          <Badge variant={statusBadgeVariant(partner.status)}>{partner.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {partner.slug} · alta {new Date(partner.created_at).toLocaleDateString()}
        </p>
      </div>

      <PartnerForm partner={partner} onSave={(patch) => updatePartner.mutate(patch)} isSaving={updatePartner.isPending} />

      <MembersCard
        partnerId={id}
        query={membersQuery}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "partners", id, "members"] })}
      />
    </div>
  );
}

function PartnerForm({
  partner,
  onSave,
  isSaving,
}: {
  partner: Partner;
  onSave: (patch: Partial<Partner>) => void;
  isSaving: boolean;
}) {
  const [legalName, setLegalName] = useState(partner.legal_name);
  const [contactEmail, setContactEmail] = useState(partner.contact_email);
  const [vertical, setVertical] = useState(partner.vertical);
  const [status, setStatus] = useState(partner.status);

  const dirty =
    legalName !== partner.legal_name ||
    contactEmail !== partner.contact_email ||
    vertical !== partner.vertical ||
    status !== partner.status;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ficha</CardTitle>
        <CardDescription>
          El slug y la llave KMS no se editan: identifican al aliado y respaldan la firma de sus paquetes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal_name">Razón social</Label>
            <Input id="legal_name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Correo de contacto</Label>
            <Input
              id="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select value={vertical} onValueChange={(v) => v && setVertical(v)}>
              <SelectTrigger>
                <SelectValue />
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
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{STATUS_HELP[status]}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 border-t pt-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Slug</Label>
            <p className="text-sm font-mono">{partner.slug}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Llave KMS</Label>
            <p className="text-sm font-mono break-all">{partner.kms_key_id ?? "— sin aprovisionar —"}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={!dirty || isSaving}
            onClick={() =>
              onSave({
                legal_name: legalName,
                contact_email: contactEmail,
                vertical,
                status,
              })
            }
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MembersCard({
  partnerId,
  query,
  onChanged,
}: {
  partnerId: string;
  query: ReturnType<typeof useQuery<{ members: Member[]; idp_configured: boolean }>>;
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("member");
  const [createIfMissing, setCreateIfMissing] = useState(true);
  const [setupLink, setSetupLink] = useState<string | null>(null);

  const idpConfigured = query.data?.idp_configured ?? false;

  const addMember = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { member_role: role };
      if (idpConfigured) {
        body.email = email;
        body.create_if_missing = createIfMissing;
      } else {
        body.user_id = userId;
      }

      const res = await fetch(`/api/admin/partners/${partnerId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al agregar el miembro");
      return data as { created_account: boolean; setup_link: string | null };
    },
    onSuccess: (data) => {
      toast.success(data.created_account ? "Cuenta creada y miembro agregado" : "Miembro agregado");
      setSetupLink(data.setup_link ?? null);
      if (!data.setup_link) setDialogOpen(false);
      setEmail("");
      setUserId("");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({ uid, member_role }: { uid: string; member_role: string }) => {
      const res = await fetch(`/api/admin/partners/${partnerId}/members/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al cambiar el rol");
      }
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (uid: string) => {
      const res = await fetch(`/api/admin/partners/${partnerId}/members/${uid}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al quitar el miembro");
      }
    },
    onSuccess: () => {
      toast.success("Miembro removido");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>
            Quién puede entrar al Lab de este aliado. <strong>curator</strong> publica y firma;{" "}
            <strong>member</strong> solo edita.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => { setSetupLink(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Agregar miembro
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : query.isError ? (
          <p className="text-sm text-red-600">{(query.error as Error).message}</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario (uid)</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data && query.data.members.length > 0 ? (
                  query.data.members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-mono text-xs">{m.user_id}</TableCell>
                      <TableCell>
                        <Select
                          value={m.member_role}
                          onValueChange={(v) => v && changeRole.mutate({ uid: m.user_id, member_role: v })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.onboarded_at ? new Date(m.onboarded_at).toLocaleDateString() : "pendiente"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember.mutate(m.user_id)}
                          aria-label="Quitar miembro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      Sin miembros. Este aliado no puede entrar al portal todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar miembro</DialogTitle>
            <DialogDescription>
              {idpConfigured
                ? "El correo se resuelve contra el pool de identidad de aliados."
                : "El puente al Identity Platform de aliados no está configurado: captura el uid de la cuenta."}
            </DialogDescription>
          </DialogHeader>

          {setupLink ? (
            <div className="space-y-3">
              <p className="text-sm">
                Cuenta creada. Pásale este enlace al aliado para que fije su contraseña — no se envía
                correo desde aquí.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={setupLink} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(setupLink);
                    toast.success("Enlace copiado");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {idpConfigured ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="member_email">Correo</Label>
                    <Input
                      id="member_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@aliado.mx"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create_if_missing"
                      checked={createIfMissing}
                      onCheckedChange={(v) => setCreateIfMissing(v === true)}
                    />
                    <Label htmlFor="create_if_missing" className="text-sm font-normal">
                      Crear la cuenta si no existe
                    </Label>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="member_uid">user_id (uid de Identity Platform)</Label>
                  <Input
                    id="member_uid"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {setupLink ? (
              <Button onClick={() => { setSetupLink(null); setDialogOpen(false); }}>Listo</Button>
            ) : (
              <Button
                disabled={addMember.isPending || (idpConfigured ? !email : !userId)}
                onClick={() => addMember.mutate()}
              >
                {addMember.isPending ? "Agregando..." : "Agregar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
