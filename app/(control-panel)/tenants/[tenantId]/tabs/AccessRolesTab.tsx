"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTenantUsers, createTenantAdmin, deleteTenantUser, TenantUser } from "../_accessActions";
import { toast } from "sonner";
import { Trash2, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [phone, setPhone] = useState("");
  const [securityNotes, setSecurityNotes] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
    if (!email || !fullName) {
      toast.error("El nombre completo y correo electrónico son obligatorios.");
      return;
    }
    const res = await createTenantAdmin(tenantId, {
      email,
      fullName,
      jobTitle,
      reportsTo,
      phone,
      securityNotes
    });
    
    if (res.success) {
      toast.success("Usuario Administrador registrado exitosamente.");
      setEmail("");
      setFullName("");
      setJobTitle("");
      setReportsTo("");
      setPhone("");
      setSecurityNotes("");
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
          <CardTitle>Registrar Administrador del Tenant</CardTitle>
          <CardDescription>
            Crea la cuenta maestra de este tenant. Este administrador será responsable de la cuenta y podrá crear otros operadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre Completo *</Label>
              <Input 
                id="fullName" 
                placeholder="Juan Pérez" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico *</Label>
              <Input 
                id="email" 
                type="email"
                placeholder="admin@empresa.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Puesto / Cargo</Label>
              <Input 
                id="jobTitle" 
                placeholder="Ej. Gerente de Operaciones" 
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportsTo">Reporta a (Jefe Directo)</Label>
              <Input 
                id="reportsTo" 
                placeholder="Ej. Director General" 
                value={reportsTo}
                onChange={(e) => setReportsTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono de Contacto</Label>
              <Input 
                id="phone" 
                placeholder="+52 55..." 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="securityNotes">Notas de Seguridad / Verificación</Label>
              <Textarea 
                id="securityNotes" 
                placeholder="Detalles sobre autenticación, ubicación, horarios permitidos..." 
                value={securityNotes}
                onChange={(e) => setSecurityNotes(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCreateAdmin}>Registrar Admin</Button>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usuarios y Telemetría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border w-full overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Uso (Tokens)</TableHead>
                    <TableHead>Última Actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">Cargando usuarios...</TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                        No hay usuarios en este tenant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.fullName || 'Sin Nombre'}</span>
                            <span className="text-xs text-muted-foreground">{user.jobTitle}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{user.email}</span>
                            <span className="text-xs text-muted-foreground">{user.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize font-medium text-primary">{user.role}</span>
                        </TableCell>
                        <TableCell>{user.tokenUsage.toLocaleString()}</TableCell>
                        <TableCell>{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Nunca'}</TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger>
                              <Button variant="ghost" size="icon">
                                <UserCog className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Perfil de Seguridad: {user.fullName}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="font-semibold">Email:</span> <span>{user.email}</span>
                                  <span className="font-semibold">Teléfono:</span> <span>{user.phone || 'N/A'}</span>
                                  <span className="font-semibold">Cargo:</span> <span>{user.jobTitle || 'N/A'}</span>
                                  <span className="font-semibold">Reporta a:</span> <span>{user.reportsTo || 'N/A'}</span>
                                  <span className="font-semibold">Rol Interno:</span> <span>{user.role}</span>
                                </div>
                                <div>
                                  <span className="font-semibold block mb-1">Notas de Seguridad:</span>
                                  <p className="bg-muted p-2 rounded-md whitespace-pre-wrap">{user.securityNotes || 'Sin notas.'}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
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
