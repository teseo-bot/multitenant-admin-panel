"use client";

import React, { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useLeads } from '@/hooks/queries/use-leads';
import { useMoveLeadMutation } from '@/hooks/mutations/use-move-lead';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import type { Lead, LeadStatus } from '@/types/lead';

const COLUMNS: { id: LeadStatus; title: string }[] = [
  { id: 'New', title: 'New' },
  { id: 'Contacted', title: 'Contacted' },
  { id: 'Qualified', title: 'Qualified' },
  { id: 'Won', title: 'Won' },
  { id: 'Lost', title: 'Lost' },
];

export function KanbanBoard({ onProspectSelect }: { onProspectSelect?: () => void }) {
  const { data: leads = [], isLoading } = useLeads();
  const moveLeadMutation = useMoveLeadMutation();
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const leadsByColumn = useMemo(() => {
    const grouped = COLUMNS.reduce((acc, col) => {
      acc[col.id] = [];
      return acc;
    }, {} as Record<LeadStatus, Lead[]>);

    leads.forEach((lead) => {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    });

    // Order each column by sort_order ascending
    for (const key in grouped) {
      grouped[key as LeadStatus].sort((a, b) => a.sort_order - b.sort_order);
    }

    return grouped;
  }, [leads]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    const activeLeadItem = leads.find((l) => l.id === leadId);
    if (!activeLeadItem) return;

    let newStatus: LeadStatus | null = null;
    let targetIndex = -1;
    let columnLeads: Lead[] = [];

    const isOverColumn = !!COLUMNS.find((col) => col.id === overId);

    if (isOverColumn) {
      newStatus = overId as LeadStatus;
      columnLeads = leadsByColumn[newStatus].filter(l => l.id !== leadId);
      targetIndex = columnLeads.length; // Drop at the end of the column
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) {
        newStatus = overLead.status;
        columnLeads = leadsByColumn[newStatus].filter(l => l.id !== leadId);
        targetIndex = columnLeads.findIndex(l => l.id === overId);
        // If dropping 'after' something, DndKit logic might mean we adjust index
        // But for simplicity of sortable, targetIndex is the index of the item we dropped over.
        // Let's ensure targetIndex is valid. If not found, append.
        if (targetIndex === -1) {
            targetIndex = columnLeads.length;
        } else {
            // Determine if dropping above or below the overLead.
            // DndKit usually provides info via event.active.rect vs event.over.rect
            // But basic sortable logic often assumes inserting at the overLead's index.
            // We'll just insert at `targetIndex`.
        }
      }
    }

    // No-op if dropping in same spot
    if (newStatus === activeLeadItem.status && overId === leadId) {
      return;
    }

    if (newStatus) {
      moveLeadMutation.mutate({ leadId, newStatus, targetIndex, columnLeads });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading board...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            leads={leadsByColumn[col.id]}
            onProspectSelect={onProspectSelect}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
