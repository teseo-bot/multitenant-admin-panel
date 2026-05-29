"use client";

import { Button } from "@/components/ui/button";
import { ConciergeTrigger } from "./ConciergeTrigger";
import { NuevoLeadModal, NuevoContactoModal, NuevaTareaModal } from "./CRMModals";

export type ViewState = "KANBAN" | "PROSPECT" | "ODOO";

interface RibbonProps {
  activeView: ViewState;
  leadName?: string;
  onBackToKanban?: () => void;
}

export function Ribbon({ activeView, leadName, onBackToKanban }: RibbonProps) {
  return (
    <div className="w-full flex items-center justify-between p-3 border-b bg-background shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        {activeView !== "KANBAN" && (
          <Button variant="ghost" size="sm" onClick={onBackToKanban}>
            &larr; Volver al Kanban
          </Button>
        )}
        <h1 className="text-lg font-semibold tracking-tight">
          {activeView === "KANBAN" ? "Pipeline (Kanban)" : leadName || "Detalle del Prospecto"}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Renderizado Condicional: Máquina de Estados */}
        {activeView === "KANBAN" && (
          <>
            <NuevaTareaModal>
              <Button variant="secondary" size="sm">Nueva Tarea</Button>
            </NuevaTareaModal>
            <NuevoContactoModal>
              <Button variant="secondary" size="sm">Nuevo Contacto</Button>
            </NuevoContactoModal>
            <NuevoLeadModal>
              <Button size="sm">Nuevo Lead</Button>
            </NuevoLeadModal>
          </>
        )}

        {activeView === "PROSPECT" && (
          <>
            <Button variant="secondary" size="sm">Subir Cotización</Button>
            <Button variant="secondary" size="sm">Nueva Nota</Button>
            <Button size="sm">Avanzar Etapa</Button>
          </>
        )}

        {activeView === "ODOO" && (
          <>
            <Button variant="secondary" size="sm">Descargar Factura</Button>
            <Button variant="outline" size="sm">Ver Ticket</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
              Abrir en Odoo ERP
            </Button>
          </>
        )}

        {/* Separador y Módulo Concierge persistente */}
        <div className="w-px h-6 bg-border mx-2" />
        <ConciergeTrigger />
      </div>
    </div>
  );
}