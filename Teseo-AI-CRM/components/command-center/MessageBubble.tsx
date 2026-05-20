"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Mail, Bot, User, Phone } from "lucide-react";

export type MessageSender = "customer" | "ai_agent" | "human_admin";
export type MessageChannel = "telegram" | "whatsapp" | "web" | "email";

export interface MessageBubbleProps {
  id: string;
  content: string;
  sender: MessageSender;
  channel: MessageChannel;
  timestamp: string;
  actorName: string;
  avatarUrl?: string;
  isInternalNote?: boolean;
}

export function MessageBubble({
  content,
  sender,
  channel,
  timestamp,
  actorName,
  avatarUrl,
  isInternalNote = false,
}: MessageBubbleProps) {
  const isOutbound = sender !== "customer";

  // Determinar icono del canal
  const renderChannelIcon = () => {
    switch (channel) {
      case "whatsapp": return <Phone className="w-3 h-3 text-green-500" />;
      case "telegram": return <Send className="w-3 h-3 text-blue-500" />;
      case "email": return <Mail className="w-3 h-3 text-red-500" />;
      default: return <MessageCircle className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Determinar icono de fallback del actor
  const renderActorFallback = () => {
    if (sender === "ai_agent") return <Bot className="w-4 h-4 text-primary" />;
    return <User className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className={cn(
      "flex w-full gap-3 mb-4",
      isOutbound ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar + Channel Badge */}
      <div className="relative shrink-0 flex flex-col items-center">
        <Avatar className="w-8 h-8 border shadow-sm">
          <AvatarImage src={avatarUrl} alt={actorName} />
          <AvatarFallback className={isOutbound ? "bg-primary/10" : "bg-muted"}>
            {renderActorFallback()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border">
          {renderChannelIcon()}
        </div>
      </div>

      {/* Burbuja de Mensaje */}
      <div className={cn(
        "flex flex-col max-w-[75%]",
        isOutbound ? "items-end" : "items-start"
      )}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-medium text-muted-foreground">
            {actorName}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {timestamp}
          </span>
        </div>
        
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm",
          isInternalNote 
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-tr-none" 
            : isOutbound 
              ? "bg-primary text-primary-foreground rounded-tr-none" 
              : "bg-muted border rounded-tl-none"
        )}>
          {content}
        </div>
      </div>
    </div>
  );
}