"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Phone, Mail, MessageCircle, Info, Loader2, ArrowRightCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  status: string;
  source: string;
}

interface InboxMessage {
  id: string;
  lead_id: string;
  content: string;
  sender: "bot" | "customer" | "human_admin" | "ai_agent";
  channel: string;
  created_at: string;
}

interface ChatSummary extends Omit<Lead, 'source'> {
  unread: number;
  lastMessage: string | null;
  lastMessageTime: string | null;
  botStatus: "bot_active" | "human_needed" | "human_active";
  channel?: string;
  source?: string;
}

// ==================================================================================================
// [ADR-112/113, SSE, FinOps]: HYBRID FEDERATED DB ARCHITECTURE (Realtime UI sin Serverless Polling)
// ==================================================================================================
// 1. TanStack Query Fetch & Hidratación: 
//    La UI obtiene el estado inicial mediante una sola llamada HTTP a `/api/inbox` (API Bridge).
//    TanStack guarda estos datos en caché y los hidrata instantáneamente en componentes cliente.
//
// 2. Server-Sent Events (SSE) Listener:
//    Implementamos un `useEffect` con `EventSource` hacia `/api/inbox/stream`.
//    Este endpoint de backend mantiene una conexión TCP abierta escuchando (LISTEN) al canal
//    'inbox_updates' que Postgres gatilla con NOTIFY desde el orquestador.
//
// 3. Invalidación Eficiente (FinOps):
//    En lugar de hacer polling (e.g. `refetchInterval: 2000`) y gastar cuotas serverless con la
//    base de datos, sólo cuando el evento SSE nos envía data, invalidamos la caché de TanStack.
//    (`queryClient.invalidateQueries({ queryKey: ["inbox"] })`). Esto obliga a React Query a
//    hacer fetch de `/api/inbox` UNICAMENTE cuando un mensaje nuevo es detectado en la DB.
// ==================================================================================================

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [takeover, setTakeover] = useState(false);
  const [inputText, setInputText] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());

  // TanStack Query: Carga inicial de Leads y Mensajes de manera unificada desde el Bridge API.
  const { data: inboxData, isLoading } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error("Failed to fetch inbox");
      return res.json() as Promise<{ leads: Lead[]; messages: InboxMessage[] }>;
    },
    // Nota: ¡No usamos refetchInterval! (FinOps) Confiamos en SSE para actualizar la vista.
  });

  // SSE Effect: Escucha notificaciones push enviadas por Postgres (LISTEN/NOTIFY) vía Bridge API.
  useEffect(() => {
    const eventSource = new EventSource("/api/inbox/stream");

    eventSource.onmessage = (event) => {
      // Cuando recibimos notificación ('new_message'), invalidamos la query.
      // Esto hace que TanStack Query dispare un re-fetch automático del endpoint /api/inbox en background,
      // y la UI se actualice sin que el usuario tenga que recargar la página.
      console.log("[SSE] Nuevo evento recibido:", event.data);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    };

    eventSource.onerror = (error) => {
      console.error("[SSE] Connection error:", error);
      eventSource.close();
    };

    // Cleanup: Cierra la conexión SSE al desmontar el componente.
    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  // Procesamos la data plana en el modelo relacional de la UI.
  const chats: ChatSummary[] = (inboxData?.leads || []).map(lead => {
    const leadMsgs = inboxData?.messages?.filter(m => m.lead_id === lead.id) || [];
    const lastMsg = leadMsgs.length > 0 ? leadMsgs[0] : null;
    
    let botStatus: "bot_active" | "human_needed" | "human_active" = "bot_active";
    if (lead.status === "attention_required" || lead.status === "lost") botStatus = "human_needed";
    if (leadMsgs.some(m => m.sender === "human_admin")) botStatus = "human_active";

    return {
      ...lead,
      channel: lead.source?.replace('inbound_', ''),
      unread: 0,
      lastMessage: lastMsg ? lastMsg.content : "Sin mensajes",
      lastMessageTime: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      botStatus
    };
  });

  // Selecciona automáticamente el primer chat si no hay ninguno seleccionado.
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Filtramos los mensajes para el chat seleccionado y los ordenamos ascendente.
  const selectedChatMessages = [...(inboxData?.messages?.filter(m => m.lead_id === selectedChatId) || [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Determinamos si el chat actual ya tuvo takeover
  useEffect(() => {
    const hasHuman = selectedChatMessages.some(m => m.sender === "human_admin");
    setTakeover(hasHuman);
  }, [selectedChatId, selectedChatMessages.length]);

  const handlePromoteToPipeline = async () => {
    if (!selectedChatId || !selectedChat || promoting) return;
    setPromoting(true);
    try {
      const sourceMap: Record<string, string> = {
        telegram: 'inbound_telegram',
        whatsapp: 'inbound_whatsapp',
        web: 'inbound_web',
      };
      const rawSource = selectedChat.source ?? 'inbound_web';
      const source = sourceMap[rawSource] ?? rawSource;
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedChat.name,
          status: 'New',
          source,
          metadata: { promoted_from_inbox: true, inbox_lead_id: selectedChatId },
        }),
      });
      if (res.ok) {
        setPromotedIds(prev => new Set(prev).add(selectedChatId));
      }
    } catch (err) {
      console.error('Error promoting lead:', err);
    } finally {
      setPromoting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedChatId) return;

    const newMessage = {
      lead_id: selectedChatId,
      content: inputText,
      sender: "human_admin",
      channel: "web",
    };

    setInputText("");
    
    const res = await fetch(`/api/leads/${selectedChatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMessage),
    });

    if (res.ok) {
      setTakeover(true); 
      // Al enviar el mensaje, invalidamos localmente para refrescar. 
      // Idealmente, el orquestador dispararía el NOTIFY también y el SSE lo actualizaría.
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full border rounded-xl overflow-hidden bg-background">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Inbox (Copiloto)</h2>
          <p className="text-xs text-muted-foreground">Monitor de IA y escalamientos</p>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {isLoading ? (
               <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
            ) : chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedChatId === chat.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 border">
                    <AvatarFallback>{chat.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {chat.source?.includes("whatsapp") && <Phone className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 fill-current bg-background rounded-full" />}
                  {chat.source?.includes("telegram") && <MessageCircle className="w-3 h-3 absolute -bottom-1 -right-1 text-blue-500 fill-current bg-background rounded-full" />}
                  {chat.source?.includes("web") && <MessageCircle className="w-3 h-3 absolute -bottom-1 -right-1 text-gray-500 fill-current bg-background rounded-full" />}
                  {chat.source?.includes("email") && <Mail className="w-3 h-3 absolute -bottom-1 -right-1 text-gray-500 fill-current bg-background rounded-full" />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm truncate">{chat.name}</span>
                    <span className="text-[10px] text-muted-foreground">{chat.lastMessageTime}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                  <div className="mt-1.5 flex gap-1">
                    {chat.botStatus === "bot_active" && <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-600 border-blue-200">Bot Activo</Badge>}
                    {chat.botStatus === "human_needed" && <Badge variant="outline" className="text-[9px] h-4 bg-red-500/10 text-red-600 border-red-200">Atención Requerida</Badge>}
                    {chat.botStatus === "human_active" && <Badge variant="outline" className="text-[9px] h-4 bg-orange-500/10 text-orange-600 border-orange-200">Humano</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background min-h-0">
        {/* Chat Header */}
        {selectedChat ? (
        <>
          <div className="h-16 border-b flex items-center justify-between px-6 bg-card shadow-sm z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{selectedChat.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-sm">{selectedChat.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{selectedChat.source?.replace('inbound_', '')} • {selectedChat.status.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Botón Pasar al Pipeline */}
              {promotedIds.has(selectedChatId!) ? (
                <Button variant="outline" size="sm" disabled className="text-green-600 border-green-300 gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> En Pipeline
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-violet-600 border-violet-300 hover:bg-violet-50"
                  onClick={handlePromoteToPipeline}
                  disabled={promoting}
                >
                  {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}
                  Pasar al Pipeline
                </Button>
              )}
              <div className="flex items-center bg-muted rounded-lg p-1 text-xs font-medium">
                <button 
                  className={cn("px-3 py-1.5 rounded-md flex items-center gap-2 transition-all", !takeover ? "bg-background shadow-sm text-blue-600" : "text-muted-foreground")}
                  onClick={() => setTakeover(false)}
                >
                  <Bot className="w-4 h-4" /> Piloto Automático
                </button>
                <button 
                  className={cn("px-3 py-1.5 rounded-md flex items-center gap-2 transition-all", takeover ? "bg-background shadow-sm text-orange-600" : "text-muted-foreground")}
                  onClick={() => setTakeover(true)}
                >
                  <User className="w-4 h-4" /> Tomar Control
                </button>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          {takeover && (
            <div className="bg-orange-500/10 text-orange-600 border-b border-orange-500/20 px-4 py-2 text-xs flex items-center gap-2">
              <Info className="w-4 h-4" />
              La IA SDR ha pausado sus respuestas. Estás hablando directamente con el prospecto.
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 p-4">
            <div className="space-y-4 max-w-3xl mx-auto pb-4">
              {selectedChatMessages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">No hay mensajes en esta conversación.</div>
              ) : selectedChatMessages.map((msg) => (
                <div key={msg.id} className={cn("flex w-full", msg.sender === "bot" || msg.sender === "ai_agent" || msg.sender === "human_admin" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-xl px-4 py-2 text-sm relative group",
                    (msg.sender === "bot" || msg.sender === "ai_agent") ? "bg-blue-600 text-white rounded-br-none" : 
                    msg.sender === "human_admin" ? "bg-orange-500 text-white rounded-br-none" : 
                    "bg-muted text-foreground rounded-bl-none"
                  )}>
                    {(msg.sender === "bot" || msg.sender === "ai_agent") && <Bot className="w-3 h-3 absolute -left-5 top-1 text-blue-600 opacity-50" />}
                    {msg.sender === "human_admin" && <User className="w-3 h-3 absolute -left-5 top-1 text-orange-500 opacity-50" />}
                    
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span className={cn(
                      "text-[10px] mt-1 block text-right",
                      (msg.sender === "bot" || msg.sender === "ai_agent" || msg.sender === "human_admin") ? "text-white/70" : "text-muted-foreground"
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t bg-card">
            <form className="flex gap-2 max-w-4xl mx-auto" onSubmit={handleSendMessage}>
              <Input 
                className="flex-1 bg-muted/50 border-none focus-visible:ring-1" 
                placeholder={takeover ? "Escribe un mensaje para el lead..." : "El bot está gestionando la conversación. Toma el control para escribir."}
                disabled={!takeover}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <Button type="submit" disabled={!takeover || !inputText.trim()} className={takeover ? "bg-orange-600 hover:bg-orange-700" : ""}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecciona una conversación para comenzar
          </div>
        )}
      </div>
    </div>
  );
}
