"use client";

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './kanban-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Lead, LeadStatus } from '@/types/lead';

interface KanbanColumnProps {
  id: LeadStatus;
  title: string;
  leads: Lead[];
  onProspectSelect?: () => void;
}

export function KanbanColumn({ id, title, leads, onProspectSelect }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div className="flex w-80 shrink-0 flex-col rounded-lg bg-muted/30">
      <div className="flex items-center justify-between p-4">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="rounded-full">
          {leads.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className="flex min-h-[150px] flex-col gap-2 p-2"
        >
          <SortableContext
            id={id}
            items={leads.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {leads.map((lead) => (
              <KanbanCard key={lead.id} lead={lead} onClick={onProspectSelect} />
            ))}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}