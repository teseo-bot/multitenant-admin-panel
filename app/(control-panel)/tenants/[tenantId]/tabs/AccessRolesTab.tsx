"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, UserPlus, Pencil, Ban, CheckCircle2 } from "lucide-react";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
type Level = "NONE" | "READ" | "WRITE";

interface Membership {
  id: string; email: string | null; fullName: string | null;
  role: Role; status: "active" | "suspended";
  lastActive: string | null; tokenUsage: number;
}
interface TenantModule { moduleId: string; name: string; isActive: boolean; }

const INVITE_ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];
const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const needsModules = (r: Role) => r === "MEMBER" || r === "VIEWER";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [loading, setLoading] = useState(true);

  const activeModules = modules.filter((m) => m.isActive);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, modRes] = await Promise.all([
        fetch(`/api/admin/memberships?tenantId=${tenantId}`),
        fetch(`/api/admin/tenants/${tenantId}/modules`),
      ]);
      setMembers(mRes.ok ? await mRes.json() : []);
      setModules(modRes.ok ? await modRes.json() : []);
    } catch {
      toast.error("Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // --- Invitar ---
  const [inviteOpen, setInviteOpen] = useState(false);

  async function suspendToggle(m: Membership) {
    const action = m.status === "active" ? "suspend" : "reactivate";
    const res = await fetch(`/api/admin/memberships/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) { toast.success(action === "suspend" ? "Miembro suspendido" : "Miembro reactivado"); load(); }
    else toast.error("Acción fallida");
  }

  async function remove(m: Membership) {
    if (!confirm(`¿Eliminar a ${m.email}?`)) return;
    const res = await fetch(`/api/admin/memberships/${m.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Miembro eliminado"); load(); }
    else toast.error("No se pudo eliminar");
  }

  const [editing, setEditing] = useState<Membership | null>(null);

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Acceso y Roles</CardTitle>
            <CardDescription>Gestiona los miembros de este tenant, sus roles y el acceso a módulos.</CardDescription>
          </div>
          <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Invitar miembro</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border w-full overflow-x-auto">
            <Table className="w-full min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Uso (tokens)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Cargando…</TableCell></TableRow>
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">No hay miembros en este tenant.</TableCell></TableRow>
                ) : members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.fullName || "Sin nombre"}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "OWNER" ? "destructive" : m.role === "ADMIN" ? "default" : "secondary"}>{m.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "default" : "outline"} className={m.status === "active" ? "" : "text-muted-foreground"}>
                        {m.status === "active" ? "Activo" : "Suspendido"}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.tokenUsage.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" title="Editar rol y módulos" onClick={() => setEditing(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={m.status === "active" ? "Suspender" : "Reactivar"} onClick={() => suspendToggle(m)}>
                        {m.status === "active" ? <Ban className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen} onOpenChange={setInviteOpen}
        tenantId={tenantId} activeModules={activeModules} onDone={load}
      />
      {editing && (
        <EditDialog
          member={editing} activeModules={activeModules}
          onOpenChange={(o) => !o && setEditing(null)} onDone={load}
        />
      )}
    </div>
  );
}

/* ---------------- Invite (2 pasos) ---------------- */
function InviteDialog({
  open, onOpenChange, tenantId, activeModules, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  tenantId: string; activeModules: TenantModule[]; onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [grants, setGrants] = useState<Record<string, Level>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setStep(1); setEmail(""); setRole("MEMBER"); setGrants({}); } }, [open]);

  async function submit() {
    if (!email) { toast.error("Email requerido"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invitations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, email, role }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al invitar"); return; }

      if (needsModules(role) && data.membershipId) {
        const entries = Object.entries(grants).filter(([, lvl]) => lvl !== "NONE")
          .map(([moduleId, level]) => ({ moduleId, level }));
        if (entries.length) {
          await fetch(`/api/admin/memberships/${data.membershipId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "setModules", grants: entries }),
          });
        }
      }
      toast.success("Invitación enviada");
      onOpenChange(false); onDone();
    } finally { setSaving(false); }
  }

  const goNext = () => {
    if (!email) { toast.error("Email requerido"); return; }
    if (needsModules(role)) setStep(2); else submit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Paso 1: identidad y rol base." : "Paso 2: acceso a módulos."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inv-email">Correo electrónico</Label>
              <Input id="inv-email" type="email" placeholder="persona@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rol base</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {role === "ADMIN" && <p className="text-xs text-muted-foreground">ADMIN tiene acceso implícito a todos los módulos activos.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Define el acceso a cada módulo activo del tenant.</p>
            {activeModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este tenant no tiene módulos activos.</p>
            ) : activeModules.map((mod) => (
              <div key={mod.moduleId} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{mod.name}</span>
                <Select value={grants[mod.moduleId] || "NONE"} onValueChange={(v) => setGrants((g) => ({ ...g, [mod.moduleId]: v as Level }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin acceso</SelectItem>
                    <SelectItem value="READ">Lectura</SelectItem>
                    <SelectItem value="WRITE">Escritura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {step === 2 && <Button variant="ghost" onClick={() => setStep(1)}>Atrás</Button>}
          {step === 1
            ? <Button onClick={goNext} disabled={saving}>{needsModules(role) ? "Siguiente" : "Invitar"}</Button>
            : <Button onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Invitar"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Editar rol + módulos ---------------- */
function EditDialog({
  member, activeModules, onOpenChange, onDone,
}: {
  member: Membership; activeModules: TenantModule[];
  onOpenChange: (o: boolean) => void; onDone: () => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [grants, setGrants] = useState<Record<string, Level>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/memberships/${member.id}`);
      if (res.ok) {
        const data = await res.json();
        const g: Record<string, Level> = {};
        for (const grant of data.grants || []) g[grant.moduleId] = grant.level;
        setGrants(g);
      }
    })();
  }, [member.id]);

  async function save() {
    setSaving(true);
    try {
      if (role !== member.role) {
        await fetch(`/api/admin/memberships/${member.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setRole", role }),
        });
      }
      if (needsModules(role)) {
        const entries = activeModules.map((mod) => ({ moduleId: mod.moduleId, level: grants[mod.moduleId] || "NONE" }));
        await fetch(`/api/admin/memberships/${member.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setModules", grants: entries }),
        });
      }
      toast.success("Cambios guardados");
      onOpenChange(false); onDone();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar: {member.fullName || member.email}</DialogTitle>
          <DialogDescription>Rol y acceso a módulos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {needsModules(role) ? (
            <div className="space-y-3">
              <Label>Módulos</Label>
              {activeModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin módulos activos.</p>
              ) : activeModules.map((mod) => (
                <div key={mod.moduleId} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{mod.name}</span>
                  <Select value={grants[mod.moduleId] || "NONE"} onValueChange={(v) => setGrants((g) => ({ ...g, [mod.moduleId]: v as Level }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin acceso</SelectItem>
                      <SelectItem value="READ">Lectura</SelectItem>
                      <SelectItem value="WRITE">Escritura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{role} tiene acceso implícito a todos los módulos activos.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
