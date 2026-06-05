"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getLLMKeys, upsertLLMKey, deleteLLMKey, TenantLLMKey } from "../_apiKeysActions";
import { Trash2 } from "lucide-react";

export function ApiKeysTab({ tenantId }: { tenantId: string }) {
  const [keys, setKeys] = useState<TenantLLMKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    fetchKeys();
  }, [tenantId]);

  const fetchKeys = async () => {
    setLoading(true);
    const data = await getLLMKeys(tenantId);
    setKeys(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!provider || !apiKey) {
      toast.error("El proveedor y la API Key son obligatorios.");
      return;
    }
    const res = await upsertLLMKey(tenantId, provider, apiKey);
    if (res.success) {
      toast.success("API Key guardada de forma segura.");
      setApiKey("");
      fetchKeys();
    } else {
      toast.error(res.error || "Error al guardar API Key.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta API Key? Los agentes de este tenant perderán acceso al proveedor.")) {
      const res = await deleteLLMKey(tenantId, id);
      if (res.success) {
        toast.success("API Key eliminada.");
        fetchKeys();
      } else {
        toast.error(res.error || "Error al eliminar.");
      }
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Inyectar API Keys Externas (LLM Providers)</CardTitle>
          <CardDescription>
            Registra las API Keys de los proveedores de IA que usarán los agentes de este tenant.
            Estas claves se inyectarán de manera segura en tiempo de ejecución.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v || "openai")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="google">Google (Gemini)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="together">Together AI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="custom">Custom Endpoint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key Segura</Label>
              <Input 
                type="password"
                placeholder="sk-..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSave}>Guardar en Secret Manager</Button>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>API Keys Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Clave (Enmascarada)</TableHead>
                  <TableHead>Última Actualización</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Cargando llaves...</TableCell>
                  </TableRow>
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No hay API Keys configuradas para este tenant.</TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium capitalize">{k.provider}</TableCell>
                      <TableCell className="font-mono text-xs">{k.apiKeyPrefix}</TableCell>
                      <TableCell>{new Date(k.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}>
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
