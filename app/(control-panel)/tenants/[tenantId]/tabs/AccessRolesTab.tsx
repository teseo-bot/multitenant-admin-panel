"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTenantUsers, createTenantAdmin, deleteTenantUser, TenantUser } from "../_accessActions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    loadUsers();
  }, [tenantId]);

  async function loadUsers() {
    setIsLoading(true);
    const data = await getTenantUsers(tenantId);
    setUsers(data);
    setIsLoading(false);
  }

  async function handleCreateAdmin() {
    if (!email) {
      toast.error("El correo electrónico es obligatorio.");
      return;
    }
    const res = await createTenantAdmin(tenantId, email);
    if (res.success) {
      toast.success("Usuario Administrador creado exitosamente.");
      setEmail("");
      loadUsers();
    } else {
      toast.error(res.error || "Error al crear administrador.");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de eliminar este usuario?")) {
      const res = await deleteTenantUser(tenantId, id);
      if (res.success) {
        toast.success("Usuario eliminado.");
        loadUsers();
      } else {
        toast.error(res.error || "Error al eliminar.");
      }
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Invitar Administrador</CardTitle>
          <CardDescription>
            Crea el usuario administrador para este tenant. Este usuario tendrá permisos para invitar a su vez a otros operadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 min-w-0 w-full space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email"
                placeholder="admin@empresa.com" 
                className="w-full" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button className="w-full sm:w-auto" onClick={handleCreateAdmin}>Crear Admin</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usuarios y Telemetría</CardTitle>
          <CardDescription>
            Uso de tokens y actividad de los usuarios registrados en este tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border w-full overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Uso (Tokens)</TableHead>
                    <TableHead>Última Actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">Cargando usuarios...</TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                        No hay usuarios en este tenant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>{user.tokenUsage.toLocaleString()}</TableCell>
                        <TableCell>{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Nunca'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
