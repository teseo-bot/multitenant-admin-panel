"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, MessageCircle, Send, Mail, Globe, Clock } from 'lucide-react';
import type { Lead, LeadSource } from '@/types/lead';
import { useCommandCenterStore } from '@/stores/command-center-store';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

function ChannelIcon({ source }: { source: LeadSource }) {
  switch (source) {
    case 'inbound_whatsapp': return <MessageCircle className="h-3 w-3 text-green-500" aria-label="WhatsApp" />;
    case 'inbound_telegram': return <Send className="h-3 w-3 text-sky-500" aria-label="Telegram" />;
    case 'inbound_web':      return <Globe className="h-3 w-3 text-blue-500" aria-label="Web" />;
    case 'manual':           return <Mail className="h-3 w-3 text-orange-400" aria-label="Manual" />;
    default:                 return <Globe className="h-3 w-3 text-muted-foreground" />;
  }
}

function ChannelLabel({ source }: { source: LeadSource }) {
  const labels: Record<LeadSource, string> = {
    inbound_whatsapp: 'WhatsApp',
    inbound_telegram: 'Telegram',
    inbound_web: 'Web',
    manual: 'Manual',
    outbound_hunter: 'Hunter',
    referral: 'Referral',
  };
  return <span>{labels[source] ?? source}</span>;
}

function LastInteraction({ messages }: { messages?: Array<{ created_at: string }> }) {
  if (!messages || messages.length === 0) return null;
  const latest = messages.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  return (
    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
      <Clock className="h-2.5 w-2.5" />
      {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: es })}
    </span>
  );
}

interface KanbanCardProps {
  lead: Lead & { inbox_messages?: Array<{ content: string; created_at: string; channel: string }> };
  isOverlay?: boolean;
  onClick?: () => void;
}

export function KanbanCard({ lead, isOverlay, onClick }: KanbanCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'Lead',
      lead,
    },
  });

  const { selectedLeadId, setSelectedLeadId } = useCommandCenterStore();
  const isSelected = selectedLeadId === lead.id;

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
      onClick={(e) => {
        // Only trigger click if we are not actively dragging
        if (e.defaultPrevented) return;
        setSelectedLeadId(lead.id);
        if (onClick) onClick();
      }}
    >
      <Card className={`shadow-sm transition-shadow ${isOverlay || isSelected ? 'shadow-md ring-2 ring-primary' : 'hover:shadow-md'}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-sm leading-none">{lead.name}</span>
            <span className="text-xs text-muted-foreground">{lead.company}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center hover:bg-muted focus:outline-none"
              onClick={(e) => e.stopPropagation()} // prevent drag on click
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Edit Lead</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-wrap items-center">
              {lead.source && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex items-center gap-0.5">
                  <ChannelIcon source={lead.source} />
                  <ChannelLabel source={lead.source} />
                </Badge>
              )}
              {lead.icp_score !== null && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  ICP: {lead.icp_score}
                </Badge>
              )}
            </div>
            {lead.assigned_node && lead.assigned_node !== 'unassigned' && (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">
                  {getInitials(lead.assigned_node)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <LastInteraction messages={lead.inbox_messages} />
        </CardContent>
      </Card>
    </div>
  );
}
