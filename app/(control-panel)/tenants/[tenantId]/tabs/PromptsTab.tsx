"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTenantAgents, createTenantAgent, deleteTenantAgent, updateTenantAgent, TenantAgent } from "../_promptsActions";
import { getLLMKeys, TenantLLMKey } from "../_apiKeysActions";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MODEL_OPTIONS: Record<string, { id: string, name: string }[]> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }, { id: "gpt-4-turbo", name: "GPT-4 Turbo" }],
  anthropic: [{ id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet" }, { id: "claude-3-opus-latest", name: "Claude 3 Opus" }],
  google: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }, 
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
    { id: "gemini-3-flash-preview", name: "Gemini 3.1 Flash" }
  ],
  deepseek: [{ id: "deepseek-chat", name: "DeepSeek Chat" }, { id: "deepseek-reasoner", name: "DeepSeek Reasoner" }],
  groq: [{ id: "llama3-70b-8192", name: "Llama 3 70B (Groq)" }],
  together: [{ id: "meta-llama/Llama-3-70b-chat-hf", name: "Llama 3 70B (Together)" }],
  custom: [{ id: "custom-model", name: "Custom Model" }]
};

export function PromptsTab({ tenantId }: { tenantId: string }) {
  const [agents, setAgents] = useState<TenantAgent[]>([]);
  const [llmKeys, setLlmKeys] = useState<TenantLLMKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [moduleAssigned, setModuleAssigned] = useState("crm");
  const [enabledToolsInput, setEnabledToolsInput] = useState("");

  useEffect(() => {
    loadAgents();
  }, [tenantId]);

  async function loadAgents() {
    setIsLoading(true);
    const [data, keysData] = await Promise.all([
      getTenantAgents(tenantId),
      getLLMKeys(tenantId)
    ]);
    setAgents(data);
    setLlmKeys(keysData);
    setIsLoading(false);
  }

  async function handleSaveAgent() {
    if (!name || !systemPrompt || !objective) {
      toast.error("El nombre, objetivo y el prompt son obligatorios.");
      return;
    }
    
    // Parse comma separated tools
    const enabledTools = enabledToolsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let res;
    if (editingAgentId) {
      res = await updateTenantAgent(tenantId, editingAgentId, {
        name,
        objective,
        model,
        systemPrompt,
        moduleAssigned,
        enabledTools
      });
    } else {
      res = await createTenantAgent(tenantId, { 
        name, 
        objective,
        model, 
        systemPrompt, 
        moduleAssigned,
        enabledTools 
      });
    }

    if (res.success) {
      toast.success(editingAgentId ? "Agente actualizado exitosamente." : "Agente creado exitosamente.");
      handleCancelEdit();
      loadAgents();
    } else {
      toast.error(res.error || "Error al guardar agente.");
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

  function handleEdit(agent: TenantAgent) {
    setEditingAgentId(agent.id);
    setName(agent.name);
    setObjective(agent.objective);
    setModel(agent.model);
    setSystemPrompt(agent.systemPrompt);
    setModuleAssigned(agent.moduleAssigned);
    setEnabledToolsInput(agent.enabledTools.join(", "));
    
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingAgentId(null);
    setName("");
    setObjective("");
    setModel("");
    setSystemPrompt("");
    setEnabledToolsInput("");
  }

  // Available models based on registered keys
  const availableModels = llmKeys.flatMap(k => MODEL_OPTIONS[k.provider] || []);
  const hasKeys = llmKeys.length > 0;

  return (
    <div className="space-y-6 w-full min-w-0">
      {!hasKeys && !isLoading && (
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md border border-destructive/20">
          <strong>Atención:</strong> No hay API Keys configuradas en este tenant. Registra un proveedor (ej. OpenAI, Anthropic) en la pestaña &quot;API Keys&quot; para habilitar los modelos.
        </div>
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{editingAgentId ? "Editar Agente" : "Crear Nuevo Agente"}</CardTitle>
          <CardDescription>
            {editingAgentId ? "Modifica la configuración y los prompts de este agente." : "Define un agente, su objetivo, prompt maestro y asígnale capacidades (Tools / MCP)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del Agente</Label>
              <Input placeholder="Ej. Hunter Bot" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo del Agente</Label>
              <Input placeholder="Ej. Calificación de Leads Outbound" value={objective} onChange={(e) => setObjective(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Módulo Padre</Label>
              <Select value={moduleAssigned} onValueChange={(val) => setModuleAssigned(val || "crm")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm">CRM (Customer Relationship Management)</SelectItem>
                  <SelectItem value="assets_studio">Assets Studio (Próximamente)</SelectItem>
                  <SelectItem value="compliance">Compliance & Legal (Próximamente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo LLM</Label>
              <Select value={model} onValueChange={(val) => setModel(val || "")} disabled={!hasKeys && !model}>
                <SelectTrigger>
                  <SelectValue placeholder={hasKeys ? "Selecciona modelo..." : "Sin proveedores"} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                  {model && !availableModels.find(m => m.id === model) && (
                     <SelectItem value={model}>{model} (Actual)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Capacidades (Tools / MCP)</Label>
              <Input 
                placeholder="Ej. web_scraper, odoo_mcp, gmail_api" 
                value={enabledToolsInput} 
                onChange={(e) => setEnabledToolsInput(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">
                Lista separada por comas con el ID exacto de la herramienta. El motor orquestador (LangGraph/LangChain) 
                leerá estos IDs y hará el binding dinámico. No requieres inyectar JSON aquí.
              </p>
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
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveAgent}>
              {editingAgentId ? "Actualizar Agente" : "Crear y Asignar Agente"}
            </Button>
            {editingAgentId && (
              <Button variant="outline" onClick={handleCancelEdit}>Cancelar Edición</Button>
            )}
          </div>
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
                  <TableHead>Agente / Objetivo</TableHead>
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
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{agent.name}</span>
                          <span className="text-xs text-muted-foreground">{agent.objective}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {agent.moduleAssigned.replace('_', ' ')}
                      </TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)}>
                          <Edit className="h-4 w-4 text-primary" />
                        </Button>
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
