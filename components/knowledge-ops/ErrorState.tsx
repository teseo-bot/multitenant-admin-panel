// components/knowledge-ops/ErrorState.tsx
// Regla transversal UXUI: "Errores API: toast con mensaje del servidor + botón
// reintentar; nunca silenciar." Se usa junto con un efecto que dispara el toast al
// aparecer el error, y además deja un estado inline con botón "Reintentar" para no
// depender solo del toast efímero.

import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="text-sm text-destructive">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        aria-label="Reintentar solicitud"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}
