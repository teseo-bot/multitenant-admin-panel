"use client";

import { useState } from "react";
import { Ribbon } from "@/components/command-center/Ribbon";
import { ProspectCanvas } from "@/components/command-center/ProspectCanvas";
import { KanbanBoard } from "@/components/kanban/kanban-board";

type ViewState = "KANBAN" | "PROSPECT";

export default function CommandCenterPage() {
  const [activeView, setActiveView] = useState<ViewState>("KANBAN");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full min-h-0 bg-background">
      <Ribbon 
        activeView={activeView} 
        leadName={activeView === "PROSPECT" ? "Carlos Lead - Corp Inc" : undefined}
        onBackToKanban={() => setActiveView("KANBAN")}
      />
      {activeView === "KANBAN" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard onProspectSelect={() => setActiveView("PROSPECT")} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <ProspectCanvas />
        </div>
      )}
    </div>
  );
}