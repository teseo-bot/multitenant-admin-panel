/**
 * components/lead-detail/LeadDetailHeader.tsx
 * 
 * Top bar for the Lead Detail view.
 * Shows: Lead name, status badge, source icon, ICP score, quick actions.
 * Reactive: status and tags update via SSE-driven TanStack refetch.
 */

"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Globe,
  MoreHorizontal,
} from "lucide-react";
import type { Lead } from "@/types/lead";

interface LeadDetailHeaderProps {
  lead: Lead;
}

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-600 border-blue-200",
  Contacted: "bg-amber-500/10 text-amber-600 border-amber-200",
  Qualified: "bg-green-500/10 text-green-600 border-green-200",
  Lost: "bg-red-500/10 text-red-600 border-red-200",
  Won: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  inbound_whatsapp: <Phone className="w-3.5 h-3.5 text-green-500" />,
  inbound_telegram: <MessageCircle className="w-3.5 h-3.5 text-blue-500" />,
  inbound_web: <Globe className="w-3.5 h-3.5 text-gray-500" />,
  outbound_hunter: <Mail className="w-3.5 h-3.5 text-violet-500" />,
};

export function LeadDetailHeader({ lead }: LeadDetailHeaderProps) {
  return (
    <div className="h-16 border border-b-0 rounded-t-xl flex items-center justify-between px-4 bg-card shrink-0">
      {/* Left: Back + Lead identity */}
      <div className="flex items-center gap-3">
        <Link href="/pipeline">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="text-xs font-semibold">
            {lead.name?.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold">{lead.name}</h1>
            {SOURCE_ICONS[lead.source] ?? null}
          </div>
          <span className="text-xs text-muted-foreground">
            {lead.company || "Sin empresa"} • {lead.email || "Sin email"}
          </span>
        </div>
      </div>

      {/* Right: Status + ICP + Actions */}
      <div className="flex items-center gap-3">
        {/* Reactive: Etapa badge — updates when SSE pushes lead change */}
        <Badge variant="outline" className={STATUS_COLORS[lead.status] || ""}>
          {lead.status}
        </Badge>

        {lead.icp_score != null && (
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded-md">
            ICP: {lead.icp_score}
          </span>
        )}

        <Badge variant="outline" className="text-xs capitalize">
          {lead.assigned_node}
        </Badge>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
