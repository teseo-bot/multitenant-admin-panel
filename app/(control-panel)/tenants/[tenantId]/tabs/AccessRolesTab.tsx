"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { 
  getTenantUsers, 
  inviteTenantUser, 
  updateTenantUserRole, 
  removeTenantUser,
  getFleetcoPlusStatus,
  toggleFleetcoPlusStatus,
  TenantUser,
  TenantUserRole
} from "../_accessActions";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<TenantUserRole>("Viewer");
  const [fleetcoPlusEnabled, setFleetcoPlusEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [usersRes, plusRes] = await Promise.all([
        getTenantUsers(tenantId),
        getFleetcoPlusStatus(tenantId)
      ]);
      
      if (usersRes.success && usersRes.users) {
        setUsers(usersRes.users);
      } else {
        toast.error(usersRes.error || "Failed to load users");
      }

      if (plusRes.success) {
        setFleetcoPlusEnabled(!!plusRes.enabled);
      }
      setIsLoading(false);
    }
    loadData();
  }, [tenantId]);

  const handleInviteUser = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    
    startTransition(async () => {
      const res = await inviteTenantUser(tenantId, inviteEmail, inviteRole);
      if (res.success) {
        toast.success("User invited successfully");
        setInviteEmail("");
        // Reload users
        const updatedUsersRes = await getTenantUsers(tenantId);
        if (updatedUsersRes.success && updatedUsersRes.users) {
          setUsers(updatedUsersRes.users);
        }
      } else {
        toast.error(res.error || "Failed to invite user");
      }
    });
  };

  const handleRoleChange = (userId: string, newRole: TenantUserRole) => {
    startTransition(async () => {
      // Optimistic update
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      const res = await updateTenantUserRole(userId, newRole);
      if (!res.success) {
        toast.error(res.error || "Failed to update role");
        // Revert on failure
        const updatedUsersRes = await getTenantUsers(tenantId);
        if (updatedUsersRes.success && updatedUsersRes.users) {
          setUsers(updatedUsersRes.users);
        }
      } else {
        toast.success("Role updated");
      }
    });
  };

  const handleRemoveUser = (userId: string) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    
    startTransition(async () => {
      const res = await removeTenantUser(userId);
      if (res.success) {
        toast.success("User removed");
        setUsers(users.filter(u => u.id !== userId));
      } else {
        toast.error(res.error || "Failed to remove user");
      }
    });
  };

  const handleToggleFleetcoPlus = (checked: boolean) => {
    setFleetcoPlusEnabled(checked);
    startTransition(async () => {
      const res = await toggleFleetcoPlusStatus(tenantId, checked);
      if (res.success) {
        toast.success(checked ? "Fleetco+ enabled for this tenant" : "Fleetco+ disabled");
      } else {
        toast.error(res.error || "Failed to update Fleetco+ status");
        setFleetcoPlusEnabled(!checked); // Revert
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fleetco+ Ribbon */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-primary flex items-center gap-2">
                Fleetco+ Ribbon
              </CardTitle>
              <CardDescription>
                Habilita el acceso a funciones premium (Fleetco+) para los usuarios de este tenant.
              </CardDescription>
            </div>
            <Switch
              id="fleetco-plus-mode"
              checked={fleetcoPlusEnabled}
              onCheckedChange={handleToggleFleetcoPlus}
              disabled={isPending}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Users Management */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Tenant</CardTitle>
          <CardDescription>
            Gestiona los accesos y roles de los usuarios que operan dentro de este tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Invite Form */}
          <div className="flex flex-col sm:flex-row gap-3 items-end bg-muted/30 p-4 rounded-lg border">
            <div className="flex-1 w-full space-y-1">
              <Label htmlFor="invite-email">Correo Electrónico</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="w-full sm:w-[180px] space-y-1">
              <Label>Rol</Label>
              <Select 
                value={inviteRole} 
                onValueChange={(value) => setInviteRole(value as TenantUserRole)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInviteUser} disabled={isPending || !inviteEmail} className="w-full sm:w-auto">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Invitar
            </Button>
          </div>

          {/* Users Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                      No hay usuarios registrados en este tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Select 
                          value={user.role} 
                          onValueChange={(value) => handleRoleChange(user.id, value as TenantUserRole)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Owner">Owner</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={isPending}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
