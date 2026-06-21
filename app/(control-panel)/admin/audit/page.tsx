"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditEvent {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  targetUser: string | null;
  action: string;
  detail: unknown;
  createdAt: string;
}

export default function AuditPage() {
  const [action, setAction] = useState<string>("");

  const { data, isLoading, error } = useQuery<AuditEvent[]>({
    queryKey: ["audit", action],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit events");
      return res.json();
    },
  });

  const events = data || [];

  const actionVariant = (act: string): "default" | "secondary" | "destructive" | "outline" => {
    if (act === "delete") return "destructive";
    if (act === "invite") return "default";
    if (act === "role_change") return "secondary";
    return "outline";
  };

  return (
    <div className="p-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground mt-2">
          Registro de auditoría de la plataforma. Quién, qué y cuándo.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="w-48">
          <label className="text-sm font-medium block mb-2">Filtrar por acción</label>
          <Select value={action} onValueChange={(val) => setAction(val || "")}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="invite">Invite</SelectItem>
              <SelectItem value="role_change">Role Change</SelectItem>
              <SelectItem value="module_grant">Module Grant</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border w-full overflow-x-auto">
        <Table className="w-full min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Usuario objetivo</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-destructive">
                  Error al cargar eventos de auditoría.
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                  No hay eventos de auditoría.
                </TableCell>
              </TableRow>
            ) : (
              events.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell>{new Date(evt.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(evt.action)}>{evt.action}</Badge>
                  </TableCell>
                  <TableCell>{evt.tenantId || "—"}</TableCell>
                  <TableCell>{evt.targetUser || "—"}</TableCell>
                  <TableCell>{evt.actorId || "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{JSON.stringify(evt.detail)}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
