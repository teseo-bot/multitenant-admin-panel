"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function AccessRolesTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Usuarios del Tenant</CardTitle>
            <Badge variant="secondary">WIP</Badge>
          </div>
          <CardDescription>
            Gestiona los accesos y roles de los usuarios que operan dentro de este tenant. (Funcionalidad en desarrollo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-end opacity-50 pointer-events-none">
            <div className="flex-1 min-w-0 w-full space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" placeholder="usuario@empresa.com" className="w-full" disabled />
            </div>
            <div className="w-full sm:w-[200px] space-y-2">
              <Label>Rol</Label>
              <Select defaultValue="viewer" disabled>
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
            <Button className="w-full sm:w-auto" disabled>Invitar</Button>
          </div>

          <div className="rounded-md border mt-4 w-full overflow-hidden opacity-50">
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
                      Datos mockeados en desarrollo.
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
