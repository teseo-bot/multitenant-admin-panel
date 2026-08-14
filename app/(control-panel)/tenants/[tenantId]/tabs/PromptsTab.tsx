"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getTenantAgents, getModules, createTenantAgent, deleteTenantAgent, updateTenantAgent,
  TenantAgent, TenantModule,
} from "../_promptsActions";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Modelos que el orquestador puede usar HOY.
 *
 * Es una lista corta y honesta a propósito: la credencial viva en producción es
 * `GEMINI_DIRECT_KEY`, así que ofrecer GPT o Claude aquí sería prometer algo que el runtime no
 * puede cumplir. Cuando la gestión de claves por tenant exista de verdad, esta lista se deriva
 * de los proveedores registrados.
 */
const MODELOS = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
  { id: "gemini-3-flash-preview", name: "Gemini 3.1 Flash" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

const MODELO_POR_DEFECTO = "__default__";

export function PromptsTab({ tenantId }: { tenantId: string }) {
  const [agents, setAgents] = useState<TenantAgent[]>([]);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Error de carga. Distinto de «lista vacía»: ver el comentario de `Resultado` en _promptsActions. */
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [model, setModel] = useState(MODELO_POR_DEFECTO);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [moduleId, setModuleId] = useState("crm");
  const [isActive, setIsActive] = useState(true);
  const [enabledToolsInput, setEnabledToolsInput] = useState("");

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    const [agentesRes, modulosRes] = await Promise.all([getTenantAgents(tenantId), getModules()]);

    if (agentesRes.ok) {
      setAgents(agentesRes.data);
      setLoadError(null);
    } else {
      setAgents([]);
      setLoadError(agentesRes.error);
    }
    if (modulosRes.ok) setModules(modulosRes.data);

    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function handleSaveAgent() {
    if (!name || !systemPrompt || !objective) {
      toast.error("El nombre, el objetivo y el prompt son obligatorios.");
      return;
    }

    const enabledTools = enabledToolsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      name,
      objective,
      moduleId,
      model: model === MODELO_POR_DEFECTO ? null : model,
      systemPrompt,
      enabledTools,
      isActive,
    };

    const res = editingAgentId
      ? await updateTenantAgent(tenantId, editingAgentId, payload)
      : await createTenantAgent(tenantId, payload);

    if (res.success) {
      toast.success(editingAgentId ? "Agente actualizado." : "Agente creado.");
      handleCancelEdit();
      loadAgents();
    } else {
      toast.error(res.error || "No se pudo guardar el agente.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este agente? Si estaba activo, su módulo se queda sin agente y las conversaciones caerán al comportamiento por defecto.")) return;
    const res = await deleteTenantAgent(tenantId, id);
    if (res.success) {
      toast.success("Agente eliminado.");
      loadAgents();
    } else {
      toast.error(res.error || "No se pudo eliminar.");
    }
  }

  function handleEdit(agent: TenantAgent) {
    setEditingAgentId(agent.id);
    setName(agent.name);
    setObjective(agent.objective);
    setModel(agent.model ?? MODELO_POR_DEFECTO);
    setSystemPrompt(agent.systemPrompt);
    setModuleId(agent.moduleId);
    setIsActive(agent.isActive);
    setEnabledToolsInput(agent.enabledTools.join(", "));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingAgentId(null);
    setName("");
    setObjective("");
    setModel(MODELO_POR_DEFECTO);
    setSystemPrompt("");
    setModuleId("crm");
    setIsActive(true);
    setEnabledToolsInput("");
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      {loadError && (
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md border border-destructive/20">
          <strong>No se pudieron cargar los agentes.</strong> {loadError}
        </div>
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{editingAgentId ? "Editar agente" : "Crear agente"}</CardTitle>
          <CardDescription>
            Cada agente pertenece a un módulo. El agente activo de un módulo es el que atiende las
            conversaciones de ese módulo — sólo puede haber uno activo por módulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder="Ej. SDR Fleetco" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input placeholder="Ej. Calificar leads entrantes" value={objective} onChange={(e) => setObjective(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select value={moduleId} onValueChange={(val) => setModuleId(val || "crm")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={(val) => setModel(val || MODELO_POR_DEFECTO)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={MODELO_POR_DEFECTO}>El del sistema</SelectItem>
                  {MODELOS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Herramientas habilitadas</Label>
              <Input
                placeholder="Ej. search_knowledge_base, sync_crm_lead"
                value={enabledToolsInput}
                onChange={(e) => setEnabledToolsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Lista separada por comas. Actúa como <strong>filtro</strong> sobre las herramientas que el
                orquestador ya sabe usar: nombrar una que no existe en el código no la crea. Vacío ⇒ el
                agente usa el juego por defecto de su nodo.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Prompt del sistema</Label>
              <Textarea
                placeholder="Eres un asesor comercial experto..."
                rows={8}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Es la voz del agente en los nodos de cara al cliente. El enrutador interno no la usa:
                clasifica intención, y darle una personalidad rompería el ruteo.
              </p>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="agente-activo" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="agente-activo" className="cursor-pointer">
                Activo — atiende las conversaciones de su módulo
              </Label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveAgent}>{editingAgentId ? "Guardar cambios" : "Crear agente"}</Button>
            {editingAgentId && <Button variant="outline" onClick={handleCancelEdit}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Agentes de este tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente / Objetivo</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Modelo / Herramientas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">Cargando agentes…</TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-destructive h-24">
                      No se pudo leer la lista. El detalle está arriba.
                    </TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      Todavía no hay agentes. Crea el primero con el formulario de arriba.
                    </TableCell>
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
                      <TableCell>{agent.moduleName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-sm">{agent.model ?? "El del sistema"}</span>
                          <div className="flex flex-wrap gap-1">
                            {agent.enabledTools.map((tool) => (
                              <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.isActive ? "default" : "secondary"}>
                          {agent.isActive ? "Activo" : "Inactivo"}
                        </Badge>
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
