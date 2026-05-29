"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  id: string;
  label: string;
  status: "complete" | "current" | "upcoming";
}

interface StepperProps {
  steps: Step[];
  onStepClick?: (id: string) => void;
}

export function Stepper({ steps, onStepClick }: StepperProps) {
  return (
    <div className="w-full pb-4 mb-4 border-b">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Etapa actual del Lead
      </div>
      <div className="grid grid-cols-5 gap-2 w-full">
        {steps.map((step, index) => (
          <button 
            key={step.id}
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 group w-full", 
              onStepClick ? "cursor-pointer" : "cursor-default"
            )}
            title={step.label}
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all",
              step.status === "complete" ? "bg-primary border-primary text-primary-foreground" :
              step.status === "current" ? "border-primary text-primary shadow-sm" :
              "border-muted bg-muted/30 text-muted-foreground group-hover:border-primary/50"
            )}>
              {step.status === "complete" ? <Check className="w-3 h-3" /> : index + 1}
            </div>
            <span className={cn(
              "text-[9px] font-medium text-center leading-tight truncate w-full px-1",
              step.status === "upcoming" ? "text-muted-foreground/70" : "text-foreground"
            )}>
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}