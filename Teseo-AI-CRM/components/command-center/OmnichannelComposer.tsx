"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Type, Smile, Paperclip, Mic, Send, ChevronDown, Phone, Mail, MessageCircle, StickyNote } from "lucide-react";

export type ChannelOption = "whatsapp" | "telegram" | "email" | "internal_note" | "web";

export function OmnichannelComposer({ leadId, onMessageSent }: { leadId?: string | null, onMessageSent?: () => void }) {
  const [message, setMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<ChannelOption>("whatsapp");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !leadId || isSending) return;
    
    setIsSending(true);
    
    try {
      const newMessage = {
        lead_id: leadId,
        content: message,
        sender: "human_admin",
        channel: selectedChannel,
      };

      // Call API to propagate the message
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMessage),
      });

      if (res.ok) {
        setMessage("");
        if (onMessageSent) onMessageSent();
      } else {
        console.error("Failed to send message via API");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const renderChannelIcon = (channel: ChannelOption) => {
    switch (channel) {
      case "whatsapp": return <Phone className="w-4 h-4 text-green-500 mr-2" />;
      case "telegram": return <Send className="w-4 h-4 text-blue-500 mr-2" />;
      case "email": return <Mail className="w-4 h-4 text-red-500 mr-2" />;
      case "internal_note": return <StickyNote className="w-4 h-4 text-amber-500 mr-2" />;
      default: return <MessageCircle className="w-4 h-4 mr-2" />;
    }
  };

  const getChannelLabel = (channel: ChannelOption) => {
    switch (channel) {
      case "whatsapp": return "WhatsApp";
      case "telegram": return "Telegram";
      case "email": return "Correo";
      case "internal_note": return "Nota Interna";
      default: return "Mensaje";
    }
  };

  return (
    <div className="p-4 border-t bg-card shrink-0">
      <div className="flex items-end gap-2">
        {/* Botón de acciones rápidas (+) */}
        <Button variant="secondary" size="icon" className="shrink-0 rounded-full w-10 h-10 border-border/50 hover:bg-muted">
          <Plus className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* Contenedor central tipo píldora */}
        <div className="flex-1 flex items-center bg-muted/40 border border-input rounded-3xl px-3 py-1 focus-within:ring-1 focus-within:ring-ring transition-shadow min-h-[44px]">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Responder vía ${getChannelLabel(selectedChannel)}...`}
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 min-h-[36px]"
            disabled={!leadId || isSending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          {/* Herramientas integradas en el input (Ghost Buttons) */}
          <div className="flex items-center text-muted-foreground gap-0.5">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:text-foreground">
              <Type className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:text-foreground">
              <Smile className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:text-foreground">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:text-foreground">
              <Mic className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Split Button de Envío (Send + Dropdown Selector) */}
        <div className="flex items-center bg-primary text-primary-foreground rounded-full shadow-sm shrink-0 transition-opacity hover:opacity-90">
          <button 
            onClick={handleSend}
            disabled={!leadId || isSending || !message.trim()}
            className="pl-4 pr-3 h-10 flex items-center justify-center rounded-l-full disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-primary-foreground/20" />
          
          <DropdownMenu>
            <DropdownMenuTrigger render={<button className="pl-2 pr-3 h-10 flex items-center justify-center rounded-r-full outline-none" />}>
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
              <DropdownMenuItem onClick={() => setSelectedChannel("whatsapp")} className="cursor-pointer">
                {renderChannelIcon("whatsapp")} WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedChannel("telegram")} className="cursor-pointer">
                {renderChannelIcon("telegram")} Telegram
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedChannel("email")} className="cursor-pointer">
                {renderChannelIcon("email")} Correo Electrónico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedChannel("internal_note")} className="cursor-pointer">
                {renderChannelIcon("internal_note")} Nota Interna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}