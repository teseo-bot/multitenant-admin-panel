"use client";

import { useState, useEffect } from "react";
import { useUsers } from "@/hooks/use-users";
import type { UsersFilter, Membership, Role, MembershipStatus } from "@/lib/api/users";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { UserPlus, Trash2, Ban, CheckCircle2, Pencil } from "lucide-react";

// ---------------------------------------------------------------------------
// Catálogo de módulos (seed 013 — ids exactos)
// ---------------------------------------------------------------------------
const MODULE_CATALOG = [
  { id: "crm", name: "CRM Agéntico" },
  { id: "asset-studio", name: "Asset Studio" },
  { id: "analytics", name: "Analítica Labs" },
  { id: "compliance", name: "Compliance Monitor" },
  { id: "lms", name: "Agentic LMS" },
  { id: "finops", name: "FinOps Control" },
] as const;

const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const INVITE_ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];

interface Tenant { id: string; name: string; domain: string; status: string; created_at: string; }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function UsersPage() {
  const [filters, setFilters] = useState<UsersFilter>({});
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);

  const { data: memberships, isLoading, isError, refetch } = useUsers(filters);

  // Load tenant list for filter selector and invite modal
  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setFilter = (patch: Record<string, any>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => setFilters({});

  async function suspendToggle(m: Membership) {
    const action = m.status === "active" ? "suspend" : "reactivate";
    const res = await fetch(`/api/admin/memberships/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success(action === "suspend" ? "Miembro suspendido" : "Miembro reactivado");
      refetch();
    } else {
      toast.error("Acción fallida");
    }
  }

  async function remove(m: Membership) {
    if (!confirm(`¿Eliminar a ${m.email}?`)) return;
    const res = await fetch(`/api/admin/memberships/${m.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Miembro eliminado"); refetch(); }
    else toast.error("No se pudo eliminar");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Usuarios (Global)</h2>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Invitar usuario
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Tenant filter */}
        <div className="space-y-1">
          <Label className="text-xs">Tenant</Label>
          <Select
            value={filters.tenantId ?? "all"}
            onValueChange={(v) => setFilter({ tenantId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Todos los tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Role filter */}
        <div className="space-y-1">
          <Label className="text-xs">Rol</Label>
          <Select
            value={filters.role ?? "all"}
            onValueChange={(v) => setFilter({ role: v === "all" ? undefined : v as Role })}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Module filter */}
        <div className="space-y-1">
          <Label className="text-xs">Módulo</Label>
          <Select
            value={filters.moduleId ?? "all"}
            onValueChange={(v) => setFilter({ moduleId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los módulos</SelectItem>
              {MODULE_CATALOG.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status filter */}
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) => setFilter({ status: v === "all" ? undefined : v as MembershipStatus })}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="suspended">Suspendido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            className="w-52 h-9"
            placeholder="Nombre o email…"
            value={filters.q ?? ""}
            onChange={(e) => setFilter({ q: e.target.value || undefined })}
          />
        </div>

        {/* Clear */}
        {Object.keys(filters).length > 0 && (
          <Button variant="ghost" size="sm" className="h-9 self-end" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : isError ? (
        <div className="text-red-500">Error al cargar usuarios.</div>
      ) : (
        <div className="rounded-md border w-full overflow-x-auto">
          <Table className="w-full min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!memberships || memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                    No hay membresías que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.fullName || "Sin nombre"}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{m.tenantName ?? <span className="text-muted-foreground">—</span>}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        m.role === "OWNER" ? "destructive"
                        : m.role === "ADMIN" ? "default"
                        : "secondary"
                      }
                    >
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={m.status === "active" ? "default" : "outline"}
                      className={m.status === "active" ? "" : "text-muted-foreground"}
                    >
                      {m.status === "active" ? "Activo" : "Suspendido"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.lastActive
                      ? new Date(m.lastActive).toLocaleDateString("es-MX")
                      : "—"}
                  </TableCell>
                  <TableCell>{m.tokenUsage.toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost" size="icon"
                      title="Editar rol"
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      title={m.status === "active" ? "Suspender" : "Reactivar"}
                      onClick={() => suspendToggle(m)}
                    >
                      {m.status === "active"
                        ? <Ban className="h-4 w-4 text-amber-500" />
                        : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      title="Eliminar"
                      onClick={() => remove(m)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modals */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tenants={tenants}
        onDone={() => refetch()}
      />
      {editing && (
        <EditRoleDialog
          member={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onDone={() => refetch()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite dialog (cross-tenant: user picks tenant + email + role)
// ---------------------------------------------------------------------------
function InviteDialog({
  open, onOpenChange, tenants, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenants: Tenant[];
  onDone: () => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTenantId(""); setEmail(""); setRole("MEMBER"); }
  }, [open]);

  async function submit() {
    if (!tenantId) { toast.error("Selecciona un tenant"); return; }
    if (!email) { toast.error("Email requerido"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, email, role }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al invitar"); return; }
      toast.success("Invitación enviada");
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>Crea una invitación en un tenant específico.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tenant</Label>
            <Select value={tenantId} onValueChange={(v) => setTenantId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tenant…" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-email">Correo electrónico</Label>
            <Input
              id="inv-email"
              type="email"
              placeholder="persona@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Rol base</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Enviando…" : "Invitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit role dialog (cross-tenant: only role change; module grants stay in tenant view)
// ---------------------------------------------------------------------------
function EditRoleDialog({
  member, onOpenChange, onDone,
}: {
  member: Membership;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (role === member.role) { onOpenChange(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/memberships/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setRole", role }),
      });
      if (res.ok) {
        toast.success("Rol actualizado");
        onOpenChange(false);
        onDone();
      } else {
        toast.error("No se pudo actualizar el rol");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar rol: {member.fullName || member.email}</DialogTitle>
          <DialogDescription>
            Tenant: {member.tenantName ?? member.tenantId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
