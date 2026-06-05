"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTenantIntegrations, upsertTenantIntegration, deleteTenantIntegration, TenantIntegration } from "../_integrationsActions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function IntegrationsTab({ tenantId }: { tenantId: string }) {
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [toolId, setToolId] = useState("");
  const [configJson, setConfigJson] = useState('{\n  "api_key": "",\n  "url": ""\n}');

  useEffect(() => {
    loadIntegrations();
  }, [tenantId]);

  async function loadIntegrations() {
    setIsLoading(true);
    const data = await getTenantIntegrations(tenantId);
    setIntegrations(data);
    setIsLoading(false);
  }

  async function handleUpsert() {
    if (!toolId) {
      toast.error("El Tool ID es obligatorio.");
      return;
    }
    
    try {
      JSON.parse(configJson); // pre-validate
    } catch (e) {
      toast.error("El formato JSON es inválido.");
      return;
    }

    const res = await upsertTenantIntegration(tenantId, toolId, configJson);
    if (res.success) {
      toast.success("Integración guardada exitosamente.");
      setToolId("");
      setConfigJson('{\n  "api_key": "",\n  "url": ""\n}');
      loadIntegrations();
    } else {
      toast.error(res.error || "Error al guardar integración.");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de eliminar esta integración?")) {
      const res = await deleteTenantIntegration(tenantId, id);
      if (res.success) {
        toast.success("Integración eliminada.");
        loadIntegrations();
      } else {
        toast.error(res.error || "Error al eliminar.");
      }
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Configurar Integración (Tool / MCP)</CardTitle>
          <CardDescription>
            Registra las credenciales, URLs o variables de entorno específicas para este tenant. 
            El orquestador las inyectará de forma segura cuando el agente utilice la herramienta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tool ID exacto</Label>
              <Input 
                placeholder="Ej. odoo_mcp" 
                value={toolId} 
                onChange={(e) => setToolId(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">Debe coincidir con el ID colocado en Prompts & IA.</p>
            </div>
            
            <div className="space-y-2 sm:col-span-2">
              <Label>Configuración (JSON)</Label>
              <Textarea 
                className="font-mono text-sm"
                rows={6}
                value={configJson} 
                onChange={(e) => setConfigJson(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">
                Define el JSON con las variables necesarias. Ej: {"{"}"api_key": "123", "base_url": "https://"{ "}"}
              </p>
            </div>
          </div>
          <Button onClick={handleUpsert}>Guardar Integración</Button>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Integraciones Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool ID</TableHead>
                  <TableHead>Configuración</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">Cargando integraciones...</TableCell>
                  </TableRow>
                ) : integrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground h-24">No hay integraciones configuradas.</TableCell>
                  </TableRow>
                ) : (
                  integrations.map((integ) => (
                    <TableRow key={integ.id}>
                      <TableCell className="font-medium">{integ.toolId}</TableCell>
                      <TableCell>
                        <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto max-w-xs md:max-w-md">
                          {integ.config}
                        </pre>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integ.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
