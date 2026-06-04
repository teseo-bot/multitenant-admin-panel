"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-6 w-full max-w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-primary">Fleetco+ Ribbon</CardTitle>
          <CardDescription>
            Habilita el acceso a funciones premium (Fleetco+) para los usuarios de este tenant.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usuarios del Tenant</CardTitle>
          <CardDescription>
            Gestiona los accesos y roles de los usuarios que operan dentro de este tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 min-w-0 w-full space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" placeholder="usuario@empresa.com" className="w-full" />
            </div>
            <div className="w-full sm:w-[200px] space-y-2">
              <Label>Rol</Label>
              <Select defaultValue="viewer">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full sm:w-auto">Invitar</Button>
          </div>

          <div className="rounded-md border mt-4 w-full overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                      No hay usuarios registrados en este tenant.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
