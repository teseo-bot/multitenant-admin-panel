"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTenantAgents, createTenantAgent, deleteTenantAgent, TenantAgent } from "../_promptsActions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PromptsTab({ tenantId }: { tenantId: string }) {
  const [agents, setAgents] = useState<TenantAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [moduleAssigned, setModuleAssigned] = useState("sales");
  const [enabledToolsInput, setEnabledToolsInput] = useState("");

  useEffect(() => {
    loadAgents();
  }, [tenantId]);

  async function loadAgents() {
    setIsLoading(true);
    const data = await getTenantAgents(tenantId);
    setAgents(data);
    setIsLoading(false);
  }

  async function handleCreateAgent() {
    if (!name || !systemPrompt) {
      toast.error("El nombre y el prompt son obligatorios.");
      return;
    }
    
    // Parse comma separated tools
    const enabledTools = enabledToolsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const res = await createTenantAgent(tenantId, { 
      name, 
      model, 
      systemPrompt, 
      moduleAssigned,
      enabledTools 
    });

    if (res.success) {
      toast.success("Agente creado exitosamente.");
      setName("");
      setSystemPrompt("");
      setEnabledToolsInput("");
      loadAgents();
    } else {
      toast.error(res.error || "Error al crear agente.");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de eliminar este agente?")) {
      const res = await deleteTenantAgent(tenantId, id);
      if (res.success) {
        toast.success("Agente eliminado.");
        loadAgents();
      } else {
        toast.error(res.error || "Error al eliminar.");
      }
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Crear Nuevo Agente</CardTitle>
          <CardDescription>
            Define un agente, su prompt maestro y asígnale capacidades (Tools / MCP).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del Agente</Label>
              <Input placeholder="Ej. Hunter Bot" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Módulo Asignado</Label>
              <Select value={moduleAssigned} onValueChange={(val) => setModuleAssigned(val || "sales")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventas & Leads</SelectItem>
                  <SelectItem value="support">Soporte Técnico</SelectItem>
                  <SelectItem value="concierge">Conserje (General)</SelectItem>
                  <SelectItem value="hunter">Hunter (Scraping/Outbound)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo LLM</Label>
              <Select value={model} onValueChange={(val) => setModel(val || "gpt-4o")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o (OpenAI)</SelectItem>
                  <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet (Anthropic)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Google)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacidades (Tools / MCP)</Label>
              <Input 
                placeholder="Ej. web_scraper, odoo_mcp, gmail_api" 
                value={enabledToolsInput} 
                onChange={(e) => setEnabledToolsInput(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">Separadas por coma. El orquestador inyectará estas herramientas.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>System Prompt Base</Label>
              <Textarea 
                placeholder="Eres un experto en..." 
                rows={4}
                value={systemPrompt} 
                onChange={(e) => setSystemPrompt(e.target.value)} 
              />
            </div>
          </div>
          <Button onClick={handleCreateAgent}>Crear y Asignar Agente</Button>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Agentes Asignados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Modelo / Tools</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Cargando agentes...</TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No hay agentes configurados.</TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="capitalize">{agent.moduleAssigned}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-sm">{agent.model}</span>
                          <div className="flex flex-wrap gap-1">
                            {agent.enabledTools.map(tool => (
                              <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(agent.id)}>
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
