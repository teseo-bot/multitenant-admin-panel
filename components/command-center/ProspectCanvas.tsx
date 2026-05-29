"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Stepper, Step } from "./Stepper";
import { MessageBubble, MessageSender, MessageChannel } from "./MessageBubble";
import { OmnichannelComposer } from "./OmnichannelComposer";
import { useCommandCenterStore } from "@/stores/command-center-store";
import { createClient } from "@/utils/supabase/client";

const MOCK_STEPS: Step[] = [
  { id: "new", label: "Nuevo", status: "complete" },
  { id: "contacted", label: "Contactado", status: "complete" },
  { id: "presentation", label: "Presentación", status: "current" },
  { id: "negotiation", label: "Negociación", status: "upcoming" },
  { id: "won", label: "Cerrado Ganado", status: "upcoming" },
];

export function ProspectCanvas() {
  const { selectedLeadId } = useCommandCenterStore();
  const [messages, setMessages] = useState<any[]>([]);
  const supabase = createClient();

  const fetchMessages = async () => {
    if (!selectedLeadId) {
      setMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("lead_id", selectedLeadId)
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error(error);
    } else {
      setMessages(data || []);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedLeadId]);

  const mapSender = (dbSender: string): MessageSender => {
    if (dbSender === "bot") return "ai_agent";
    if (dbSender === "human" || dbSender === "human_admin") return "human_admin";
    return "customer";
  };

  const getActorName = (sender: string) => {
    if (sender === "bot") return "Teseo SDR (AI)";
    if (sender === "human" || sender === "human_admin") return "Admin";
    return "Prospecto";
  };

  const getTimestamp = (created_at: string) => {
    return new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Contenedor Principal: Layout Bi-Zonal */}
      <div className="flex flex-1 min-h-0">
        
        {/* Zona Central: Hilo Omnicanal (Aumentado a ~65-70%) */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-border">
          <div className="p-3 border-b bg-muted/10 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Historial de Comunicación</h2>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
              {selectedLeadId ? "Conectado" : "Esperando selección"}
            </span>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {messages.length === 0 && selectedLeadId ? (
                <div className="text-center text-sm text-muted-foreground py-10">No hay mensajes.</div>
              ) : !selectedLeadId ? (
                <div className="text-center text-sm text-muted-foreground py-10">Selecciona un lead para ver la conversación.</div>
              ) : messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  id={msg.id}
                  content={msg.content}
                  sender={mapSender(msg.sender)}
                  channel={(msg.channel || "web") as MessageChannel}
                  timestamp={getTimestamp(msg.created_at)}
                  actorName={getActorName(msg.sender)}
                  isInternalNote={msg.channel === "internal_note"}
                />
              ))}
            </div>
          </ScrollArea>
          
          {/* Zona Central Inferior: Composer Omnicanal */}
          <OmnichannelComposer leadId={selectedLeadId} onMessageSent={fetchMessages} />
        </div>

        {/* Zona Derecha: Panel de Contexto (Aumentado min-w para el Grid del Stepper) */}
        <div className="w-[30%] min-w-[380px] max-w-[420px] flex flex-col min-h-0 bg-card">
          <Tabs defaultValue="attributes" className="flex flex-col flex-1 min-h-0">
            
            {/* Cabecera del Panel Derecho */}
            <div className="px-5 pt-5 pb-0 shrink-0">
              {/* Stepper Compacto Anclado al Top */}
              <Stepper steps={MOCK_STEPS} onStepClick={(id) => console.log("Avanzar a:", id)} />
            </div>

            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pb-0 shrink-0 gap-4 h-10">
              <TabsTrigger 
                value="attributes" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2"
              >
                Atributos
              </TabsTrigger>
              <TabsTrigger 
                value="client" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2"
              >
                Cliente
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2"
              >
                Expediente
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1">
              {/* Tab 1: Atributos y Metadata */}
              <TabsContent value="attributes" className="p-5 m-0 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor del Negocio</h3>
                  <p className="text-3xl font-bold text-foreground tracking-tight">$12,500.00</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Etiquetas</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md dark:bg-blue-900/30 dark:text-blue-400">Enterprise</span>
                    <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-md dark:bg-amber-900/30 dark:text-amber-400">Alta Prioridad</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    Insights (IA)
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </h3>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm border border-border/50 leading-relaxed">
                    Prospecto altamente interesado en la integración con el ERP. Ha preguntado dos veces sobre tiempos de implementación. 
                    <strong>Sugerencia:</strong> Enviar caso de éxito técnico.
                  </div>
                </div>
              </TabsContent>
              
              {/* Tab 2: Cliente (Datos Duros & Acordeones) */}
              <TabsContent value="client" className="p-5 m-0 space-y-4">
                <Accordion className="w-full" defaultValue={["billing"]}>
                  <AccordionItem value="billing">
                    <AccordionTrigger className="text-xs font-semibold py-3">Datos de Facturación</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">Razón Social:</div>
                        <div className="font-medium text-right truncate">Corp Inc S.A. de C.V.</div>
                        <div className="text-muted-foreground">RFC:</div>
                        <div className="font-medium text-right uppercase">CORP990101XYZ</div>
                        <div className="text-muted-foreground">Régimen:</div>
                        <div className="font-medium text-right">601 - General de Ley</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="address">
                    <AccordionTrigger className="text-xs font-semibold py-3">Domicilio Legal</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid gap-1 text-xs">
                        <span className="font-medium">Av. Paseo de la Reforma 222</span>
                        <span className="text-muted-foreground">Piso 4, Oficina 401</span>
                        <span className="text-muted-foreground">Juárez, Cuauhtémoc, 06600</span>
                        <span className="text-muted-foreground">CDMX, México</span>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="custom">
                    <AccordionTrigger className="text-xs font-semibold py-3">Información Específica</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">Volumen Mensual:</div>
                        <div className="font-medium text-right">5,000+ tx</div>
                        <div className="text-muted-foreground">ERP Actual:</div>
                        <div className="font-medium text-right">SAP Business One</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* Tab 3: Archivos y Documentos (Galería Grid) */}
              <TabsContent value="documents" className="p-5 m-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="aspect-square bg-muted/30 rounded-lg border border-border/50 flex flex-col items-center justify-center p-3 text-center hover:bg-muted/80 cursor-pointer transition-colors group">
                    <div className="w-10 h-10 mb-2 rounded bg-red-100 text-red-600 dark:bg-red-900/30 flex items-center justify-center font-bold text-xs">PDF</div>
                    <span className="text-xs font-medium truncate w-full px-1">Cotizacion_v1.pdf</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Hace 2 días</span>
                  </div>
                  <div className="aspect-square bg-muted/30 rounded-lg border border-border/50 flex flex-col items-center justify-center p-3 text-center hover:bg-muted/80 cursor-pointer transition-colors group">
                    <div className="w-10 h-10 mb-2 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center font-bold text-xs">DOC</div>
                    <span className="text-xs font-medium truncate w-full px-1">Brochure.docx</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Hace 5 días</span>
                  </div>
                </div>
                <button className="w-full py-2 border-2 border-dashed rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors mt-4">
                  + Subir Documento
                </button>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

      </div>
    </div>
  );
}