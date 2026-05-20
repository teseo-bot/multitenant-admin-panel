"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function ConciergeTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Extraer metadata del estado global (tenant_id, user_id, active_view, token_usage)
    // y disparar el payload hacia el endpoint/webhook del Mission Control.
    console.log("Emitiendo Payload a Mission Control:", { 
        request, 
        timestamp: new Date().toISOString() 
    });
    setIsOpen(false);
    setRequest("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5" />}>
        <Badge variant="secondary" className="px-1 py-0 rounded-sm">Concierge</Badge>
        Solicitar Ajuste
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Soporte Especializado (Concierge)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Describe el ajuste necesario (Ej. Añadir usuario, ajustar tono del bot). 
            Se adjuntará automáticamente tu contexto de sistema.
          </p>
          <Input 
            placeholder="Escribe tu solicitud aquí..." 
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            required
            autoComplete="off"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit">Enviar Solicitud</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}